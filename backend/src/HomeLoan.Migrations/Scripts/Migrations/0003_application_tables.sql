-- All timestamps are UTC. Every query is by ApplicationId, which is the PK or the leading key of each table.

CREATE TABLE app.Application (
    -- Not IDENTITY: the client addresses the application by id in the URL (PUT creates it).
    Id int NOT NULL CONSTRAINT PK_Application PRIMARY KEY,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Application_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Application_Id CHECK (Id > 0)
);

CREATE TABLE app.LoanDetails (
    ApplicationId int NOT NULL CONSTRAINT PK_LoanDetails PRIMARY KEY,
    PurposeCode smallint NOT NULL,
    PropertyUsageCode smallint NOT NULL,
    ApplicantCountCode tinyint NOT NULL,
    IsSameHousehold bit NULL,
    NumberOfDependants tinyint NOT NULL,
    LoanAmount decimal(12, 2) NOT NULL,
    Deposit decimal(12, 2) NULL,
    EstimatedPropertyValue decimal(12, 2) NOT NULL,
    IsAddressKnown bit NOT NULL,
    Address nvarchar(200) NULL,
    StateCode smallint NULL,
    RowVersion rowversion NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_LoanDetails_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_LoanDetails_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_LoanDetails_Application FOREIGN KEY (ApplicationId) REFERENCES app.Application (Id) ON DELETE CASCADE,
    CONSTRAINT FK_LoanDetails_Purpose FOREIGN KEY (PurposeCode) REFERENCES ref.LendingPurpose (Code),
    CONSTRAINT FK_LoanDetails_PropertyUsage FOREIGN KEY (PropertyUsageCode) REFERENCES ref.PropertyUsage (Code),
    CONSTRAINT FK_LoanDetails_ApplicantCount FOREIGN KEY (ApplicantCountCode) REFERENCES ref.ApplicantCount (Code),
    CONSTRAINT FK_LoanDetails_State FOREIGN KEY (StateCode) REFERENCES ref.AuState (Code),
    CONSTRAINT CK_LoanDetails_Dependants CHECK (NumberOfDependants <= 20),
    CONSTRAINT CK_LoanDetails_Amounts CHECK (LoanAmount > 0 AND EstimatedPropertyValue > 0),
    CONSTRAINT CK_LoanDetails_Deposit CHECK (Deposit IS NULL OR (Deposit >= 0 AND Deposit <= EstimatedPropertyValue)),
    -- The household question is only asked when more than one person is applying.
    CONSTRAINT CK_LoanDetails_Household CHECK (
        (ApplicantCountCode = 1 AND IsSameHousehold IS NULL) OR (ApplicantCountCode > 1 AND IsSameHousehold IS NOT NULL)),
    -- Either the address is known, or we only ask for the state.
    CONSTRAINT CK_LoanDetails_AddressOrState CHECK (
        (IsAddressKnown = 1 AND Address IS NOT NULL AND LEN(TRIM(Address)) > 0 AND StateCode IS NULL)
        OR (IsAddressKnown = 0 AND Address IS NULL AND StateCode IS NOT NULL))
    -- "Deposit only when buying" is enforced by the validator using ref.LendingPurpose.IsPurchase;
    -- a CHECK here would have to hard-code purpose codes.
);

-- Owns the applicant set for an application and carries its concurrency version, so saving
-- loan details doesn't invalidate the ETag the client holds for applicants (and vice versa).
CREATE TABLE app.ApplicantSet (
    ApplicationId int NOT NULL CONSTRAINT PK_ApplicantSet PRIMARY KEY,
    RowVersion rowversion NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_ApplicantSet_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_ApplicantSet_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ApplicantSet_Application FOREIGN KEY (ApplicationId) REFERENCES app.Application (Id) ON DELETE CASCADE
);

CREATE TABLE app.Applicant (
    Id int IDENTITY (1, 1) NOT NULL CONSTRAINT PK_Applicant PRIMARY KEY NONCLUSTERED,
    ApplicationId int NOT NULL,
    Ordinal tinyint NOT NULL,
    TitleCode tinyint NOT NULL,
    FirstName nvarchar(50) NOT NULL,
    LastName nvarchar(50) NOT NULL,
    Email nvarchar(254) NULL,
    Mobile char(10) NOT NULL,
    DateOfBirth date NOT NULL,
    CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_Applicant_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_Applicant_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Applicant_ApplicantSet FOREIGN KEY (ApplicationId) REFERENCES app.ApplicantSet (ApplicationId) ON DELETE CASCADE,
    CONSTRAINT FK_Applicant_Title FOREIGN KEY (TitleCode) REFERENCES ref.Title (Code),
    -- Structural ceiling only; the business maximum (4) is configuration, enforced by the validator.
    CONSTRAINT CK_Applicant_Ordinal CHECK (Ordinal BETWEEN 1 AND 10),
    CONSTRAINT CK_Applicant_Names CHECK (LEN(TRIM(FirstName)) > 0 AND LEN(TRIM(LastName)) > 0),
    CONSTRAINT CK_Applicant_PrimaryEmail CHECK (Ordinal <> 1 OR Email IS NOT NULL),
    CONSTRAINT CK_Applicant_Email CHECK (Email IS NULL OR Email LIKE N'%_@_%._%'),
    -- Stored normalised (04XXXXXXXX); the API normalises +61 / spaces before saving.
    CONSTRAINT CK_Applicant_Mobile CHECK (Mobile LIKE '04[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    -- The 18+ rule needs "today", so it lives in the application layer.
    CONSTRAINT CK_Applicant_DateOfBirth CHECK (DateOfBirth >= '1900-01-01')
);

-- The only read is "all applicants for an application, in order": cluster on it so a set is one seek.
CREATE UNIQUE CLUSTERED INDEX UX_Applicant_ApplicationId_Ordinal ON app.Applicant (ApplicationId, Ordinal);

-- Insert-only audit of agreement to the pre-qualification and privacy terms.
CREATE TABLE app.ConsentRecord (
    Id int IDENTITY (1, 1) NOT NULL CONSTRAINT PK_ConsentRecord PRIMARY KEY,
    ApplicationId int NOT NULL,
    TermsVersion varchar(20) NOT NULL,
    AcceptedAt datetime2(3) NOT NULL CONSTRAINT DF_ConsentRecord_AcceptedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ConsentRecord_Application FOREIGN KEY (ApplicationId) REFERENCES app.Application (Id) ON DELETE CASCADE,
    CONSTRAINT UQ_ConsentRecord_ApplicationId_TermsVersion UNIQUE (ApplicationId, TermsVersion),
    CONSTRAINT CK_ConsentRecord_TermsVersion CHECK (LEN(TRIM(TermsVersion)) > 0)
);
