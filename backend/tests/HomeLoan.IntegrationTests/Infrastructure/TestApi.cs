using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace HomeLoan.IntegrationTests.Infrastructure;

/// <summary>Request bodies as the front end sends them, and small HTTP helpers.</summary>
internal static class TestApi
{
    public const string LoanDetails = "/api/applications/1/loan-details";
    public const string Applicants = "/api/applications/1/applicants";

    public static JsonObject LoanDetailsBody(int numberOfApplicants = 1) => new()
    {
        ["purpose"] = 1006,
        ["propertyUsage"] = 1003,
        ["numberOfApplicants"] = numberOfApplicants,
        ["isSameHousehold"] = numberOfApplicants == 1 ? null : true,
        ["numberOfDependants"] = 0,
        ["loanAmount"] = 500000,
        ["deposit"] = null,
        ["estimatedPropertyValue"] = 900000,
        ["isAddressKnown"] = false,
        ["address"] = null,
        ["state"] = 1001
    };

    public static JsonObject Applicant(string firstName = "Alex", string? email = "alex@example.com", string mobile = "0412 345 678") => new()
    {
        ["title"] = 1,
        ["firstName"] = firstName,
        ["lastName"] = "Taylor",
        ["email"] = email,
        ["mobile"] = mobile,
        ["dateOfBirth"] = "1988-03-14"
    };

    public static JsonObject ApplicantsBody(string termsVersion = "2026-10", params JsonObject[] applicants) => new()
    {
        ["applicants"] = new JsonArray(applicants.Length == 0 ? [Applicant()] : applicants.Cast<JsonNode>().ToArray()),
        ["consent"] = new JsonObject { ["accepted"] = true, ["termsVersion"] = termsVersion }
    };

    public static Task<HttpResponseMessage> PutAsync(this HttpClient client, string url, JsonNode body, string? ifMatch = null) =>
        client.SendAsync(Put(url, new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"), ifMatch));

    public static Task<HttpResponseMessage> PutRawAsync(this HttpClient client, string url, string json) =>
        client.SendAsync(Put(url, new StringContent(json, Encoding.UTF8, "application/json"), null));

    public static string ETag(this HttpResponseMessage response) =>
        response.Headers.ETag?.ToString() ?? throw new InvalidOperationException("No ETag.");

    public static async Task<JsonObject> JsonAsync(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonObject>())!;

    public static async Task<Dictionary<string, string[]>> ValidationErrorsAsync(this HttpResponseMessage response)
    {
        var body = await response.JsonAsync();
        return body["errors"].Deserialize<Dictionary<string, string[]>>()!;
    }

    /// <summary>Saves loan details for application 1 and returns the response.</summary>
    public static async Task<HttpResponseMessage> SaveLoanDetailsAsync(this HttpClient client, int numberOfApplicants = 1, string? ifMatch = null)
    {
        var response = await client.PutAsync(LoanDetails, LoanDetailsBody(numberOfApplicants), ifMatch);
        response.EnsureSuccessStatusCode();
        return response;
    }

    private static HttpRequestMessage Put(string url, HttpContent content, string? ifMatch)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url) { Content = content };
        if (ifMatch is not null)
        {
            request.Headers.IfMatch.Add(EntityTagHeaderValue.Parse(ifMatch));
        }
        return request;
    }
}
