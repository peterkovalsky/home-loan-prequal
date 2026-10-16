using System.Text.Json;
using HomeLoan.Application.Common;

namespace HomeLoan.Application.Drafts;

/// <summary>The journey steps that can hold a draft. Must match CK_ApplicationDraft_Step.</summary>
public static class DraftSteps
{
    public const string LoanDetails = "loan-details";
    public const string AboutYou = "about-you";

    public static bool IsKnown(string step) => step is LoanDetails or AboutYou;
}

public sealed record Draft(string Step, string Data, DateTime UpdatedAt);

public interface IDraftRepository
{
    Task<IReadOnlyList<Draft>> GetAllAsync(int applicationId, CancellationToken cancellationToken);

    /// <summary>Inserts or replaces the step's draft: last write wins.</summary>
    Task SaveAsync(int applicationId, string journeyStep, string data, CancellationToken cancellationToken);

    Task DeleteAsync(int applicationId, string journeyStep, CancellationToken cancellationToken);
}

/// <summary>A draft as the client sent it, plus when it was saved.</summary>
public sealed record DraftDto(JsonElement Data, DateTime UpdatedAt);

public sealed class GetDraftsHandler(IDraftRepository repository)
{
    public async Task<IReadOnlyDictionary<string, DraftDto>> HandleAsync(int applicationId, CancellationToken cancellationToken)
    {
        var drafts = await repository.GetAllAsync(applicationId, cancellationToken);
        return drafts.ToDictionary(
            d => d.Step,
            d =>
            {
                using var document = JsonDocument.Parse(d.Data);
                return new DraftDto(document.RootElement.Clone(), DateTime.SpecifyKind(d.UpdatedAt, DateTimeKind.Utc));
            });
    }
}

/// <summary>
/// Saves whatever the customer has typed so far. Deliberately not validated field by field: a
/// draft is incomplete by definition. Validation happens when the step is saved for real.
/// </summary>
public sealed class SaveDraftHandler(IDraftRepository repository, IUnitOfWork unitOfWork)
{
    /// <summary>Characters of JSON text. Must match CK_ApplicationDraft_Data.</summary>
    public const int MaxLength = 32768;

    public async Task<Result<bool>> HandleAsync(int applicationId, string step, JsonElement draft, CancellationToken cancellationToken)
    {
        if (!DraftSteps.IsKnown(step))
        {
            return AppError.NotFound($"There is no step called '{step}'.");
        }
        if (draft.ValueKind != JsonValueKind.Object)
        {
            return AppError.Validation("draft", "A draft must be a JSON object.");
        }
        var data = draft.GetRawText();
        if (data.Length > MaxLength)
        {
            return AppError.Validation("draft", $"A draft can be at most {MaxLength} characters.");
        }

        await repository.SaveAsync(applicationId, step, data, cancellationToken);
        await unitOfWork.CommitAsync(cancellationToken);
        return true;
    }
}
