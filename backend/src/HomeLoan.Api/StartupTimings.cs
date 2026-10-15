using System.Diagnostics;

namespace HomeLoan.Api;

/// <summary>
/// Measures where start-up time goes, so cold-start work is driven by data. Logged once per process
/// when the host has started (on Lambda, that's the end of the INIT phase).
/// </summary>
internal sealed partial class StartupTimings
{
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly long runtimeToMainMs = (long)(DateTime.Now - Process.GetCurrentProcess().StartTime).TotalMilliseconds;
    private long builderMs;
    private long secretsMs;
    private long servicesMs;
    private long buildMs;

    public void BuilderCreated() => builderMs = clock.ElapsedMilliseconds;

    public void SecretsResolved() => secretsMs = clock.ElapsedMilliseconds;

    public void ServicesConfigured() => servicesMs = clock.ElapsedMilliseconds;

    public void AppBuilt() => buildMs = clock.ElapsedMilliseconds;

    /// <summary>Logs the phases (each as a duration) once the host has started.</summary>
    public void LogWhenStarted(WebApplication app) =>
        app.Lifetime.ApplicationStarted.Register(() => LogStartup(
            app.Logger,
            runtimeToMainMs,
            builderMs,
            secretsMs - builderMs,
            servicesMs - secretsMs,
            buildMs - servicesMs,
            clock.ElapsedMilliseconds - buildMs,
            clock.ElapsedMilliseconds));

    [LoggerMessage(Level = LogLevel.Information, Message =
        "Startup timings ms: runtimeToMain={RuntimeToMainMs} createBuilder={CreateBuilderMs} secrets={SecretsMs} " +
        "configureServices={ConfigureServicesMs} build={BuildMs} startHost={StartHostMs} totalSinceMain={TotalMs}")]
    private static partial void LogStartup(
        ILogger logger, long runtimeToMainMs, long createBuilderMs, long secretsMs, long configureServicesMs,
        long buildMs, long startHostMs, long totalMs);
}
