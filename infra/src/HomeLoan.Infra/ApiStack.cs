using Amazon.CDK;
using Amazon.CDK.AWS.Apigatewayv2;
using Amazon.CDK.AWS.Budgets;
using Amazon.CDK.AWS.CloudWatch;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.Events;
using EventTargets = Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.Ecr.Assets;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AwsApigatewayv2Integrations;
using Amazon.CDK.Triggers;
using Constructs;

namespace HomeLoan.Infra;

/// <summary>
/// The stateless half: the API and migrator as Lambda container images, the HTTPS endpoint, and the
/// guard rails (throttling, log retention, an error alarm, a budget).
/// </summary>
internal sealed class ApiStack : Stack
{
    public ApiStack(Construct scope, string id, DeploymentSettings settings, DataStack data, IStackProps props)
        : base(scope, id, props)
    {
        var database = new Dictionary<string, string>
        {
            ["Database__Host"] = data.Database.DbInstanceEndpointAddress,
            ["Database__Port"] = data.Database.DbInstanceEndpointPort,
            ["Database__Name"] = DataStack.DatabaseName,
            ["Database__AppSecretArn"] = data.AppLoginSecret.SecretArn,
            // One setting for both: the API stops resuming, the purge deletes, at the same age.
            ["Applications__ResumeExpiryDays"] = settings.ResumeExpiryDays.ToString(System.Globalization.CultureInfo.InvariantCulture)
        };

        var migrator = Function(this, "MigratorFunction", "migrator-lambda", data, memoryMb: 512, Duration.Minutes(5),
            new Dictionary<string, string>(database) { ["Database__AdminSecretArn"] = data.Database.Secret!.SecretArn });
        data.Database.Secret.GrantRead(migrator);
        data.AppLoginSecret.GrantRead(migrator);

        var environment = new Dictionary<string, string>(database) { ["ASPNETCORE_ENVIRONMENT"] = "Production" };
        for (var i = 0; i < settings.AllowedOrigins.Count; i++)
        {
            environment[$"Cors__AllowedOrigins__{i}"] = settings.AllowedOrigins[i];
        }
        var api = Function(this, "ApiFunction", "lambda", data, settings.ApiMemoryMb, Duration.Seconds(15), environment);
        // Caps database connections and the bill; the account allows 400.
        ((CfnFunction)api.Node.DefaultChild!).ReservedConcurrentExecutions = 10;
        data.AppLoginSecret.GrantRead(api); // The API can read only its own login, never the admin secret.

        // Migrations are part of the deployment: run before the new API version goes live, and a
        // failure fails (and rolls back) the deploy. Re-runs whenever the migrator image changes.
        var migrate = new Trigger(this, "MigrateOnDeploy", new TriggerProps
        {
            Handler = migrator,
            Timeout = Duration.Minutes(10),
            InvocationType = InvocationType.REQUEST_RESPONSE,
            ExecuteOnHandlerChange = true
        });
        migrate.ExecuteBefore(api);

        // Personal data isn't kept longer than needed: once a day the migrator (which has the admin
        // login) deletes drafts of inactive applications and inactive unfinished ones. 16:00 UTC is
        // 2-3am in Sydney.
        new Rule(this, "PurgeExpiredDaily", new RuleProps
        {
            Description = "Deletes expired drafts and unfinished applications.",
            Schedule = Schedule.Cron(new Amazon.CDK.AWS.Events.CronOptions { Minute = "0", Hour = "16" }),
            Targets =
            [
                new EventTargets.LambdaFunction(migrator, new EventTargets.LambdaFunctionProps
                {
                    Event = RuleTargetInput.FromObject(new Dictionary<string, object> { ["task"] = "purge-expired" }),
                    RetryAttempts = 2
                })
            ]
        });

        // API Gateway calls a published version through the "live" alias. Provisioned concurrency
        // (cdk.json apiProvisionedConcurrency) keeps that many instances initialised, so the first
        // request after a deploy, or after idle, has no cold start. 0 means on demand.
        var live = new Alias(this, "ApiLive", new AliasProps
        {
            AliasName = "live",
            Version = api.CurrentVersion,
            ProvisionedConcurrentExecutions = settings.ApiProvisionedConcurrency > 0 ? settings.ApiProvisionedConcurrency : null
        });

        var accessLogs = new LogGroup(this, "AccessLogs", new LogGroupProps
        {
            Retention = RetentionDays.ONE_WEEK,
            RemovalPolicy = RemovalPolicy.DESTROY
        });
        var httpApi = new HttpApi(this, "HttpApi", new HttpApiProps
        {
            ApiName = "homeloan",
            Description = "Home loan pre-qualification API",
            DefaultIntegration = new HttpLambdaIntegration("ApiIntegration", live),
            // CORS is the app's job (same behaviour as locally); API Gateway CORS would conflict.
        });
        var stage = (CfnStage)httpApi.DefaultStage!.Node.DefaultChild!;
        stage.DefaultRouteSettings = new CfnStage.RouteSettingsProperty
        {
            // No auth on this exercise API, so throttle to limit abuse and cost.
            ThrottlingRateLimit = 20,
            ThrottlingBurstLimit = 40
        };
        stage.AccessLogSettings = new CfnStage.AccessLogSettingsProperty
        {
            DestinationArn = accessLogs.LogGroupArn,
            // No client IP: it's personal data and not needed to operate this.
            Format = """{"requestId":"$context.requestId","method":"$context.httpMethod","path":"$context.path","status":"$context.status","latencyMs":"$context.responseLatency","integrationLatencyMs":"$context.integrationLatency","integrationError":"$context.integrationErrorMessage"}"""
        };

        new Alarm(this, "ApiErrors", new AlarmProps
        {
            AlarmDescription = "The API Lambda threw or timed out.",
            Metric = live.MetricErrors(new MetricOptions { Period = Duration.Minutes(5), Statistic = "Sum" }),
            Threshold = 1,
            EvaluationPeriods = 1,
            ComparisonOperator = ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            TreatMissingData = TreatMissingData.NOT_BREACHING
        });

        if (settings.BudgetEmail is { } email)
        {
            AddBudget(email);
        }

        new CfnOutput(this, "ApiEndpoint", new CfnOutputProps { Value = httpApi.ApiEndpoint, Description = "HTTPS base URL; the API is under /api" });
    }

    private static DockerImageFunction Function(
        Construct scope, string id, string target, DataStack data, int memoryMb, Duration timeout, IDictionary<string, string> environment) =>
        new(scope, id, new DockerImageFunctionProps
        {
            Code = DockerImageCode.FromImageAsset(RepoPaths.Backend, new AssetImageCodeProps
            {
                Target = target,
                Platform = Platform_.LINUX_ARM64,
                Exclude = ["**/bin", "**/obj", "tests", "scripts", "**/TestResults"]
            }),
            Architecture = Architecture.ARM_64,
            MemorySize = memoryMb,
            Timeout = timeout,
            Vpc = data.Vpc,
            VpcSubnets = new SubnetSelection { SubnetType = SubnetType.PRIVATE_ISOLATED },
            SecurityGroups = [data.LambdaSecurityGroup],
            AllowPublicSubnet = false,
            Environment = environment,
            LogGroup = new LogGroup(scope, $"{id}Logs", new LogGroupProps
            {
                Retention = RetentionDays.ONE_WEEK,
                RemovalPolicy = RemovalPolicy.DESTROY
            })
        });

    private void AddBudget(string email) =>
        new CfnBudget(this, "MonthlyBudget", new CfnBudgetProps
        {
            Budget = new CfnBudget.BudgetDataProperty
            {
                BudgetName = "homeloan-monthly",
                BudgetType = "COST",
                TimeUnit = "MONTHLY",
                BudgetLimit = new CfnBudget.SpendProperty { Amount = 20, Unit = "USD" }
            },
            // CloudFormation union types surface as object in C#, so plain arrays rather than collection expressions.
            NotificationsWithSubscribers = new object[]
            {
                Notification("ACTUAL", 80, email),
                Notification("FORECASTED", 100, email)
            }
        });

    private static CfnBudget.NotificationWithSubscribersProperty Notification(string type, double percent, string email) => new()
    {
        Notification = new CfnBudget.NotificationProperty
        {
            NotificationType = type,
            ComparisonOperator = "GREATER_THAN",
            Threshold = percent,
            ThresholdType = "PERCENTAGE"
        },
        Subscribers = new object[] { new CfnBudget.SubscriberProperty { SubscriptionType = "EMAIL", Address = email } }
    };
}
