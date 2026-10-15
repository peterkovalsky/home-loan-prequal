using Amazon.CDK;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.RDS;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;
using InstanceType = Amazon.CDK.AWS.EC2.InstanceType;

namespace HomeLoan.Infra;

/// <summary>
/// The stateful half: a private network and the SQL Server database. Nothing here can reach, or be
/// reached from, the internet. Lambda talks to the database on 1433 and to Secrets Manager through a
/// private endpoint; there is no NAT gateway.
/// </summary>
internal sealed class DataStack : Stack
{
    public const string DatabaseName = "HomeLoan";

    public DataStack(Construct scope, string id, IStackProps props) : base(scope, id, props)
    {
        Vpc = new Vpc(this, "Vpc", new VpcProps
        {
            // Explicit AZs (RDS needs two even when single-AZ) keep synth free of AWS lookups, so it is
            // deterministic and runs in CI without credentials.
            AvailabilityZones = ["ap-southeast-2a", "ap-southeast-2b"],
            NatGateways = 0,
            SubnetConfiguration =
            [
                new SubnetConfiguration { Name = "isolated", SubnetType = SubnetType.PRIVATE_ISOLATED, CidrMask = 24 }
            ]
        });
        var isolated = new SubnetSelection { SubnetType = SubnetType.PRIVATE_ISOLATED };

        LambdaSecurityGroup = new SecurityGroup(this, "LambdaSecurityGroup", new SecurityGroupProps
        {
            Vpc = Vpc,
            AllowAllOutbound = false,
            Description = "Lambda functions: out to the database and the Secrets Manager endpoint only."
        });
        var databaseSecurityGroup = new SecurityGroup(this, "DatabaseSecurityGroup", new SecurityGroupProps
        {
            Vpc = Vpc,
            AllowAllOutbound = false,
            Description = "SQL Server: in from the Lambda functions only."
        });
        var endpointSecurityGroup = new SecurityGroup(this, "EndpointSecurityGroup", new SecurityGroupProps
        {
            Vpc = Vpc,
            AllowAllOutbound = false,
            Description = "Secrets Manager endpoint: HTTPS in from the Lambda functions only."
        });
        databaseSecurityGroup.AddIngressRule(LambdaSecurityGroup, Port.Tcp(1433), "SQL from Lambda");
        LambdaSecurityGroup.AddEgressRule(databaseSecurityGroup, Port.Tcp(1433), "SQL to the database");
        endpointSecurityGroup.AddIngressRule(LambdaSecurityGroup, Port.Tcp(443), "HTTPS from Lambda");
        LambdaSecurityGroup.AddEgressRule(endpointSecurityGroup, Port.Tcp(443), "HTTPS to Secrets Manager");

        // One AZ halves the endpoint's hourly cost; functions in the other AZ reach it across AZs.
        Vpc.AddInterfaceEndpoint("SecretsManagerEndpoint", new InterfaceVpcEndpointOptions
        {
            Service = InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            Subnets = new SubnetSelection { Subnets = [Vpc.IsolatedSubnets[0]] },
            SecurityGroups = [endpointSecurityGroup],
            PrivateDnsEnabled = true
        });

        Database = new DatabaseInstance(this, "Database", new DatabaseInstanceProps
        {
            // Pinned (and auto minor upgrade off) so the template matches what's running: with auto
            // upgrades on, RDS would move ahead and the next deploy would try to downgrade it.
            Engine = DatabaseInstanceEngine.SqlServerEx(new SqlServerExInstanceEngineProps
            {
                Version = SqlServerEngineVersion.Of("16.00.4265.3.v1", "16.00")
            }),
            LicenseModel = LicenseModel.LICENSE_INCLUDED,
            InstanceType = InstanceType.Of(InstanceClass.T3, InstanceSize.MICRO),
            Vpc = Vpc,
            VpcSubnets = isolated,
            SecurityGroups = [databaseSecurityGroup],
            PubliclyAccessible = false,
            MultiAz = false,
            AllocatedStorage = 20,
            StorageType = StorageType.GP3,
            StorageEncrypted = true,
            Credentials = Credentials.FromGeneratedSecret("homeloan_admin"),
            CaCertificate = CaCertificate.RDS_CA_RSA2048_G1,
            AutoMinorVersionUpgrade = false,
            BackupRetention = Duration.Days(1),
            // An exercise environment that must tear down cleanly. Production: RETAIN, deletion
            // protection, final snapshot, Multi-AZ.
            DeletionProtection = false,
            RemovalPolicy = RemovalPolicy.DESTROY,
            DeleteAutomatedBackups = true
        });

        // The API's least-privilege login (created by the migrator). Characters that would break a
        // connection string or the SQL literal are excluded.
        AppLoginSecret = new Secret(this, "AppLoginSecret", new SecretProps
        {
            Description = "SQL login used by the HomeLoan API (DML only).",
            GenerateSecretString = new SecretStringGenerator
            {
                SecretStringTemplate = "{\"username\":\"homeloan_app\"}",
                GenerateStringKey = "password",
                PasswordLength = 32,
                ExcludeCharacters = ";'\"=,{}\\/@` "
            },
            RemovalPolicy = RemovalPolicy.DESTROY
        });
    }

    public Vpc Vpc { get; }

    public SecurityGroup LambdaSecurityGroup { get; }

    public DatabaseInstance Database { get; }

    public Secret AppLoginSecret { get; }
}
