using Amazon.CDK;
using Amazon.CDK.AWS.IAM;
using Constructs;

namespace HomeLoan.Infra;

/// <summary>
/// One-time: lets GitHub Actions deploy without stored AWS keys. The role is trusted only for jobs in
/// this repository's "aws" environment (whose deployment branch is restricted to main), and can do
/// nothing itself except assume the CDK bootstrap roles that perform the deployment.
/// </summary>
internal sealed class GitHubOidcStack : Stack
{
    public const string DeployRoleName = "homeloan-github-deploy";

    public GitHubOidcStack(Construct scope, string id, DeploymentSettings settings, IStackProps props)
        : base(scope, id, props)
    {
        var provider = new OidcProviderNative(this, "GitHubProvider", new OidcProviderNativeProps
        {
            Url = "https://token.actions.githubusercontent.com",
            ClientIds = ["sts.amazonaws.com"]
        });

        // With `environment:` on the job, GitHub's token subject is repo:<owner/repo>:environment:<name>.
        var role = new Role(this, "DeployRole", new RoleProps
        {
            RoleName = DeployRoleName,
            Description = "GitHub Actions deploys of home-loan-prequal (via the CDK bootstrap roles).",
            MaxSessionDuration = Duration.Hours(1),
            AssumedBy = new WebIdentityPrincipal(provider.OidcProviderArn, new Dictionary<string, object>
            {
                ["StringEquals"] = new Dictionary<string, string>
                {
                    ["token.actions.githubusercontent.com:aud"] = "sts.amazonaws.com",
                    ["token.actions.githubusercontent.com:sub"] = $"repo:{settings.GitHubRepository}:environment:{settings.GitHubEnvironment}"
                }
            })
        });

        role.AddToPolicy(new PolicyStatement(new PolicyStatementProps
        {
            Sid = "AssumeCdkBootstrapRoles",
            Actions = ["sts:AssumeRole"],
            Resources = [$"arn:aws:iam::{Account}:role/cdk-hnb659fds-*-{Account}-{Region}"]
        }));

        new CfnOutput(this, "DeployRoleArn", new CfnOutputProps { Value = role.RoleArn });
    }
}
