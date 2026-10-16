-- Each visitor gets their own application, reached only with its resume token, and can save
-- incomplete answers as drafts. See docs/plans/06-server-drafts.md.

-- New ids come from a sequence: POST creates the application, the server picks the id. (A column
-- can't be made IDENTITY in place.) Starts above the ids that tests and demos used before.
CREATE SEQUENCE app.ApplicationId AS int START WITH 1000000 INCREMENT BY 1;

ALTER TABLE app.Application
    ADD CONSTRAINT DF_Application_Id DEFAULT (NEXT VALUE FOR app.ApplicationId) FOR Id;

-- SHA-256 of the resume token; the token itself is never stored. Nullable only for applications
-- created before tokens existed: nothing can match NULL, so they can't be reached, and they age
-- out with everything else inactive.
ALTER TABLE app.Application ADD
    ResumeTokenHash binary(32) NULL,
    LastActivityAt datetime2(3) NOT NULL CONSTRAINT DF_Application_LastActivityAt DEFAULT SYSUTCDATETIME();

-- The daily purge finds inactive applications by this.
CREATE INDEX IX_Application_LastActivityAt ON app.Application (LastActivityAt);

-- Answers as typed, before they pass validation. Kept apart from the validated tables so a
-- half-filled form can't weaken their constraints. Deleted when the step is saved for real.
CREATE TABLE app.ApplicationDraft (
    ApplicationId int NOT NULL,
    Step varchar(30) NOT NULL,
    Data nvarchar(max) NOT NULL,
    UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_ApplicationDraft_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ApplicationDraft PRIMARY KEY (ApplicationId, Step),
    CONSTRAINT FK_ApplicationDraft_Application FOREIGN KEY (ApplicationId) REFERENCES app.Application (Id) ON DELETE CASCADE,
    CONSTRAINT CK_ApplicationDraft_Step CHECK (Step IN ('loan-details', 'about-you')),
    -- A JSON object, at most 32 KB of text. The API checks the same, with a friendlier message.
    CONSTRAINT CK_ApplicationDraft_Data CHECK (ISJSON(Data, OBJECT) = 1 AND LEN(Data) <= 32768)
);
