using HomeLoan.Api;
using HomeLoan.Secrets;

var timings = new StartupTimings();
// On AWS: turn the configured secret ARNs into a connection string (a no-op locally). The fetch is
// the largest part of a cold start, so it starts now and overlaps with creating the builder. The
// ARNs come from environment variables, which is how the stack sets them.
var secrets = DatabaseSecrets.ResolveAsync(new ConfigurationBuilder().AddEnvironmentVariables().Build());
var builder = WebApplication.CreateBuilder(args);
timings.BuilderCreated();
builder.Configuration.AddInMemoryCollection(await secrets);
timings.SecretsResolved();
builder.ConfigureServices();
timings.ServicesConfigured();

var app = builder.Build();
timings.AppBuilt();
app.ConfigurePipeline();
timings.Log(app);
await app.RunAsync();

/// <summary>Entry point; public so WebApplicationFactory can host it in tests.</summary>
public partial class Program;
