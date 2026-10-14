using System.ComponentModel.DataAnnotations;

namespace HomeLoan.Infrastructure.Data;

/// <summary>Bound from <c>ConnectionStrings</c>. The API connects as the least-privilege <c>homeloan_app</c> login.</summary>
public sealed class DatabaseOptions
{
    public const string Section = "ConnectionStrings";

    [Required(ErrorMessage = "ConnectionStrings:HomeLoan is required.")]
    public string HomeLoan { get; set; } = string.Empty;
}
