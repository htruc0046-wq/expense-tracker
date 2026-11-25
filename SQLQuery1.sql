USE expense_tracker;
GO

CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSDATETIME()
);
GO

CREATE TABLE Transactions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Name NVARCHAR(255) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Type NVARCHAR(20) NOT NULL,
    Category NVARCHAR(100) NOT NULL,
    TransactionDate DATE NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Transactions_Users
        FOREIGN KEY (UserId) REFERENCES Users(Id)
        ON DELETE CASCADE,

    CONSTRAINT CK_Transactions_Amount
        CHECK (Amount > 0),

    CONSTRAINT CK_Transactions_Type
        CHECK (Type IN (N'income', N'expense'))
);
GO

SELECT name FROM sys.tables;

SELECT * FROM Users;

SELECT * FROM Transactions;