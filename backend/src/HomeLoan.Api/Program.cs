using HomeLoan.Api;
using HomeLoan.Secrets;

var builder = WebApplication.CreateBuilder(args);
// On AWS: turn the configured secret ARNs into a connection string (a no-op locally).
await DatabaseSecrets.ApplyAsync(builder.Configuration);
builder.ConfigureServices();

var app = builder.Build();
app.ConfigurePipeline();
await app.RunAsync();

/// <summary>Entry point; public so WebApplicationFactory can host it in tests.</summary>
public partial class Program;
