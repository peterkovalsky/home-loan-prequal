using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.CDK;
using Amazon.CDK.Assertions;

namespace HomeLoan.Infra.Tests;

/// <summary>
/// The security and cost properties the design depends on, checked on the synthesized CloudFormation
/// so a refactor can't quietly open the database or widen a role.
/// </summary>
public sealed class StackTests
{
    private static readonly string[] AvailabilityZones = ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"];

    private static (Template Oidc, Template Data, Template Api) Synth(string budgetEmail = "")
    {
        var app = new App(new AppProps
        {
            Context = new Dictionary<string, object>
            {
                ["account"] = "085843960390",
                ["region"] = "ap-southeast-2",
                ["githubRepository"] = "peterkovalsky/home-loan-prequal",
                ["githubEnvironment"] = "aws",
                ["allowedOrigins"] = "http://localhost:4200",
                ["budgetEmail"] = budgetEmail,
                ["@aws-cdk/core:defaultCrossStackReferences"] = "strong",
                ["availability-zones:account=085843960390:region=ap-southeast-2"] = AvailabilityZones
            }
        });
        var settings = DeploymentSettings.From(app);
        var env = new Amazon.CDK.Environment { Account = settings.Account, Region = settings.Region };
        var oidc = new GitHubOidcStack(app, "Oidc", settings, new StackProps { Env = env });
        var data = new DataStack(app, "Data", new StackProps { Env = env });
        var api = new ApiStack(app, "Api", settings, data, new StackProps { Env = env });
        return (Template.FromStack(oidc), Template.FromStack(data), Template.FromStack(api));
    }

    private static readonly Lazy<(Template Oidc, Template Data, Template Api)> Templates = new(() => Synth());

    private static JsonNode Json(Template template) => JsonNode.Parse(JsonSerializer.Serialize(template.ToJSON()))!;

    private static IEnumerable<JsonNode> Resources(Template template, string type) =>
        Json(template)["Resources"]!.AsObject().Select(r => r.Value!).Where(r => (string?)r["Type"] == type);

    [Fact]
    public void The_database_is_private_encrypted_sql_server_express()
    {
        var db = Resources(Templates.Value.Data, "AWS::RDS::DBInstance").Single()["Properties"]!;

        Assert.Equal("sqlserver-ex", (string?)db["Engine"]);
        Assert.False((bool)db["PubliclyAccessible"]!);
        Assert.True((bool)db["StorageEncrypted"]!);
        Assert.False((bool)db["MultiAZ"]!);
        Assert.Equal("db.t3.micro", (string?)db["DBInstanceClass"]);
    }

    [Fact]
    public void Only_the_lambda_security_group_may_reach_sql_server()
    {
        var data = Json(Templates.Value.Data).ToJsonString();
        var ingress = Resources(Templates.Value.Data, "AWS::EC2::SecurityGroupIngress").Select(r => r["Properties"]!).ToList();

        var sql = Assert.Single(ingress, r => (int?)r["FromPort"] == 1433);
        Assert.NotNull(sql["SourceSecurityGroupId"]);
        Assert.Null(sql["CidrIp"]);
        Assert.DoesNotContain("0.0.0.0/0", data, StringComparison.Ordinal);
    }

    [Fact]
    public void There_is_no_route_to_or_from_the_internet()
    {
        Templates.Value.Data.ResourceCountIs("AWS::EC2::NatGateway", 0);
        Templates.Value.Data.ResourceCountIs("AWS::EC2::InternetGateway", 0);
        Templates.Value.Data.HasResourceProperties("AWS::EC2::VPCEndpoint", new Dictionary<string, object>
        {
            ["ServiceName"] = "com.amazonaws.ap-southeast-2.secretsmanager",
            ["PrivateDnsEnabled"] = true
        });
    }

    [Fact]
    public void Both_functions_are_arm64_container_images_inside_the_vpc()
    {
        var functions = Resources(Templates.Value.Api, "AWS::Lambda::Function")
            .Select(f => f["Properties"]!)
            .Where(p => (string?)p["PackageType"] == "Image")
            .ToList();

        Assert.Equal(2, functions.Count);
        Assert.All(functions, f =>
        {
            Assert.Equal("arm64", (string?)f["Architectures"]![0]);
            Assert.NotNull(f["VpcConfig"]!["SubnetIds"]);
        });
    }

    [Fact]
    public void The_api_can_read_only_its_own_secret()
    {
        var api = Json(Templates.Value.Api);
        var apiRole = (string)api["Resources"]!.AsObject()
            .Single(r => (string?)r.Value!["Type"] == "AWS::Lambda::Function" && ((string?)r.Value["Properties"]!["MemorySize"]?.ToString()) == "1024")
            .Value!["Properties"]!["Role"]!["Fn::GetAtt"]![0]!;
        var policy = Resources(Templates.Value.Api, "AWS::IAM::Policy")
            .Single(p => p["Properties"]!["Roles"]!.AsArray().Any(r => (string?)r!["Ref"] == apiRole));

        var secretStatements = policy["Properties"]!["PolicyDocument"]!["Statement"]!.AsArray()
            .Where(s => s!["Action"]!.ToJsonString().Contains("secretsmanager:GetSecretValue", StringComparison.Ordinal))
            .ToList();

        var resource = Assert.Single(secretStatements)!["Resource"]!.ToJsonString();
        Assert.Contains("AppLoginSecret", resource, StringComparison.Ordinal);
        Assert.DoesNotContain("DatabaseSecret", resource, StringComparison.Ordinal);
    }

    [Fact]
    public void Github_can_deploy_only_from_this_repos_aws_environment_and_only_via_cdk_roles()
    {
        var role = Resources(Templates.Value.Oidc, "AWS::IAM::Role").Single()["Properties"]!;
        var condition = role["AssumeRolePolicyDocument"]!["Statement"]![0]!["Condition"]!["StringEquals"]!;
        var statements = Resources(Templates.Value.Oidc, "AWS::IAM::Policy").Single()["Properties"]!["PolicyDocument"]!["Statement"]!.AsArray();

        Assert.Equal("repo:peterkovalsky/home-loan-prequal:environment:aws", (string?)condition["token.actions.githubusercontent.com:sub"]);
        Assert.Equal("sts.amazonaws.com", (string?)condition["token.actions.githubusercontent.com:aud"]);
        var only = Assert.Single(statements)!;
        Assert.Equal("sts:AssumeRole", (string?)only["Action"]);
        Assert.Contains("cdk-hnb659fds-", only["Resource"]!.ToJsonString(), StringComparison.Ordinal);
    }

    [Fact]
    public void The_http_api_is_throttled_and_logs_access_without_client_ips()
    {
        var stage = Resources(Templates.Value.Api, "AWS::ApiGatewayV2::Stage").Single()["Properties"]!;

        Assert.Equal(20, (double)stage["DefaultRouteSettings"]!["ThrottlingRateLimit"]!);
        Assert.Equal(40, (double)stage["DefaultRouteSettings"]!["ThrottlingBurstLimit"]!);
        Assert.DoesNotContain("sourceIp", (string)stage["AccessLogSettings"]!["Format"]!, StringComparison.Ordinal);
    }

    [Fact]
    public void Migrations_run_on_deploy_before_the_new_api_version()
    {
        var api = Json(Templates.Value.Api)["Resources"]!.AsObject();
        var trigger = api.Single(r => ((string?)r.Value!["Type"])?.StartsWith("Custom::Trigger", StringComparison.Ordinal) == true);
        var apiFunction = api.Single(r => (string?)r.Value!["Type"] == "AWS::Lambda::Function"
            && r.Value["Properties"]!["MemorySize"]?.ToString() == "1024");

        Assert.Contains(trigger.Key, apiFunction.Value!["DependsOn"]!.ToJsonString(), StringComparison.Ordinal);
    }

    [Fact]
    public void A_budget_is_only_created_when_an_email_is_configured()
    {
        Templates.Value.Api.ResourceCountIs("AWS::Budgets::Budget", 0);
        Synth(budgetEmail: "alerts@example.com").Api.ResourceCountIs("AWS::Budgets::Budget", 1);
    }
}
