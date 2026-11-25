IF DB_ID(N'expense_tracker') IS NULL
BEGIN
    CREATE DATABASE expense_tracker;
END;
GO

USE expense_tracker;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSDATETIME()
    );
END;
GO

IF OBJECT_ID(N'dbo.Transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Transactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Name NVARCHAR(255) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        Type NVARCHAR(20) NOT NULL,
        Category NVARCHAR(100) NOT NULL,
        TransactionDate DATE NOT NULL,
        CreatedAt DATETIME2 DEFAULT SYSDATETIME(),

        CONSTRAINT FK_Transactions_Users
            FOREIGN KEY (UserId)
            REFERENCES dbo.Users(Id)
            ON DELETE CASCADE,

        CONSTRAINT CK_Transactions_Amount
            CHECK (Amount > 0),

        CONSTRAINT CK_Transactions_Type
            CHECK (Type IN (N'income', N'expense'))
    );
END;
GO

SELECT name FROM sys.tables;
GO
