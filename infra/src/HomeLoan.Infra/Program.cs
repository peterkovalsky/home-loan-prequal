using Amazon.CDK;
using HomeLoan.Infra;

var app = new App();
var settings = DeploymentSettings.From(app);
var environment = new Amazon.CDK.Environment { Account = settings.Account, Region = settings.Region };

// Deployed once, locally, at bootstrap time; then GitHub Actions deploys the other two on every push to main.
new GitHubOidcStack(app, "HomeLoanGitHubOidc", settings, new StackProps { Env = environment });

var data = new DataStack(app, "HomeLoanData", new StackProps { Env = environment });
new ApiStack(app, "HomeLoanApi", settings, data, new StackProps { Env = environment });

Tags.Of(app).Add("project", "home-loan-prequal");
app.Synth();
