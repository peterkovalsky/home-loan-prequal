using HomeLoan.Api;
using HomeLoan.Secrets;

var timings = new StartupTimings();
var builder = WebApplication.CreateBuilder(args);
timings.BuilderCreated();
// On AWS: turn the configured secret ARNs into a connection string (a no-op locally).
await DatabaseSecrets.ApplyAsync(builder.Configuration);
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
