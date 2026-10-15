using HomeLoan.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HomeLoan.UnitTests.Infrastructure;

public class DbSessionTests
{
    [Fact]
    public void Can_be_disposed_by_a_synchronously_disposed_scope_as_the_Lambda_adapter_does()
    {
        var services = new ServiceCollection();
        services.AddSingleton(Options.Create(new DatabaseOptions { HomeLoan = "Server=unused" }));
        services.AddSingleton(typeof(Microsoft.Extensions.Logging.ILogger<>), typeof(NullLogger<>));
        services.AddScoped<DbSession>();
        using var provider = services.BuildServiceProvider();

        var scope = provider.CreateScope();
        _ = scope.ServiceProvider.GetRequiredService<DbSession>();

        // Before the fix this threw: "type only implements IAsyncDisposable".
        scope.Dispose();
    }
}
