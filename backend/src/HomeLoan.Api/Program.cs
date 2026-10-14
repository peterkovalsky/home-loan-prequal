using HomeLoan.Api;

var builder = WebApplication.CreateBuilder(args);
builder.ConfigureServices();

var app = builder.Build();
app.ConfigurePipeline();
await app.RunAsync();

/// <summary>Entry point; public so WebApplicationFactory can host it in tests.</summary>
public partial class Program;
