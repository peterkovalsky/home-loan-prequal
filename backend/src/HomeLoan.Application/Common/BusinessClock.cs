using Microsoft.Extensions.Options;

namespace HomeLoan.Application.Common;

public interface IBusinessClock
{
    /// <summary>Today's date in the business time zone.</summary>
    DateOnly Today { get; }

    DateTime UtcNow { get; }
}

/// <summary>
/// Without this, someone turning 18 today would be rejected on a Sydney morning, while UTC is
/// still on yesterday's date.
/// </summary>
public sealed class BusinessClock(TimeProvider time, IOptions<ClockOptions> options) : IBusinessClock
{
    private readonly TimeZoneInfo zone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(time.GetUtcNow(), zone).DateTime);

    public DateTime UtcNow => time.GetUtcNow().UtcDateTime;
}
