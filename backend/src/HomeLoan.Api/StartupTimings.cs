using System.Diagnostics;

namespace HomeLoan.Api;

/// <summary>
/// Measures where start-up time goes, so cold-start work is driven by data. Logged once per process,
/// just before the host runs. Not on ApplicationStarted: under the Lambda hosting adapter, starting
/// the server runs the runtime loop and never returns, so that event never fires. On Lambda, the
/// INIT Duration minus runtimeToMain and totalSinceMain is the time spent starting the host itself.
/// <c>secrets</c> is only the wait after creating the builder: the fetch starts before it.
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

    /// <summary>Logs the phases, each as a duration. Call it last, just before the host runs.</summary>
    public void Log(WebApplication app) => LogStartup(
        app.Logger,
        runtimeToMainMs,
        builderMs,
        secretsMs - builderMs,
        servicesMs - secretsMs,
        buildMs - servicesMs,
        clock.ElapsedMilliseconds - buildMs,
        clock.ElapsedMilliseconds);

    [LoggerMessage(Level = LogLevel.Information, Message =
        "Startup timings ms: runtimeToMain={RuntimeToMainMs} createBuilder={CreateBuilderMs} secrets={SecretsMs} " +
        "configureServices={ConfigureServicesMs} build={BuildMs} pipeline={PipelineMs} totalSinceMain={TotalMs}")]
    private static partial void LogStartup(
        ILogger logger, long runtimeToMainMs, long createBuilderMs, long secretsMs, long configureServicesMs,
        long buildMs, long pipelineMs, long totalMs);
}
