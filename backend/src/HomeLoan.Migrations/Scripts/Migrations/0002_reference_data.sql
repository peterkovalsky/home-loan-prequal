-- Lookup tables instead of CHECK (... IN (...)) constraints: adding a title or a state is an INSERT,
-- and facts about a code (such as whether a purpose is a purchase) live next to the code.

CREATE TABLE ref.LendingPurpose (
    Code smallint NOT NULL CONSTRAINT PK_LendingPurpose PRIMARY KEY,
    Name nvarchar(50) NOT NULL CONSTRAINT UQ_LendingPurpose_Name UNIQUE,
    IsPurchase bit NOT NULL
);

CREATE TABLE ref.PropertyUsage (
    Code smallint NOT NULL CONSTRAINT PK_PropertyUsage PRIMARY KEY,
    Name nvarchar(50) NOT NULL CONSTRAINT UQ_PropertyUsage_Name UNIQUE
);

-- The answer to "Who's applying for the loan?". MaxApplicants NULL means "use the configured maximum".
CREATE TABLE ref.ApplicantCount (
    Code tinyint NOT NULL CONSTRAINT PK_ApplicantCount PRIMARY KEY,
    Name nvarchar(50) NOT NULL CONSTRAINT UQ_ApplicantCount_Name UNIQUE,
    MinApplicants tinyint NOT NULL,
    MaxApplicants tinyint NULL,
    CONSTRAINT CK_ApplicantCount_Range CHECK (MinApplicants >= 1 AND (MaxApplicants IS NULL OR MaxApplicants >= MinApplicants))
);

CREATE TABLE ref.AuState (
    Code smallint NOT NULL CONSTRAINT PK_AuState PRIMARY KEY,
    Abbreviation varchar(3) NOT NULL CONSTRAINT UQ_AuState_Abbreviation UNIQUE
);

CREATE TABLE ref.Title (
    Code tinyint NOT NULL CONSTRAINT PK_Title PRIMARY KEY,
    Name nvarchar(10) NOT NULL CONSTRAINT UQ_Title_Name UNIQUE
);

INSERT INTO ref.LendingPurpose (Code, Name, IsPurchase) VALUES
    (1000, N'Construction', 1),
    (1001, N'Further advance', 0),
    (1002, N'Other', 0),
    (1003, N'Purchase existing dwelling', 1),
    (1004, N'Purchase new dwelling', 1),
    (1006, N'Refinance', 0);

INSERT INTO ref.PropertyUsage (Code, Name) VALUES
    (1002, N'Investment (residential)'),
    (1003, N'Owner occupied');

INSERT INTO ref.ApplicantCount (Code, Name, MinApplicants, MaxApplicants) VALUES
    (1, N'Just me', 1, 1),
    (2, N'Two of us', 2, 2),
    (3, N'More than two', 3, NULL);

INSERT INTO ref.AuState (Code, Abbreviation) VALUES
    (1000, 'ACT'), (1001, 'NSW'), (1002, 'NT'), (1003, 'QLD'),
    (1004, 'SA'), (1005, 'TAS'), (1006, 'VIC'), (1007, 'WA');

INSERT INTO ref.Title (Code, Name) VALUES
    (1, N'Mr'), (2, N'Mrs'), (3, N'Ms'), (4, N'Miss'), (5, N'Dr');
