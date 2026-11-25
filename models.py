from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash


db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "Users"

    id = db.Column("Id", db.Integer, primary_key=True)
    name = db.Column("Name", db.Unicode(100), nullable=False)
    email = db.Column("Email", db.Unicode(255), unique=True, nullable=False)
    password_hash = db.Column("PasswordHash", db.Unicode(255), nullable=False)
    created_at = db.Column("CreatedAt", db.DateTime, nullable=False, default=datetime.utcnow)
    transactions = db.relationship("Transaction", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method="scrypt")

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email}


class Transaction(db.Model):
    __tablename__ = "Transactions"

    id = db.Column("Id", db.Integer, primary_key=True)
    user_id = db.Column("UserId", db.Integer, db.ForeignKey("Users.Id", ondelete="CASCADE"), nullable=False)
    name = db.Column("Name", db.Unicode(255), nullable=False)
    amount = db.Column("Amount", db.Numeric(18, 2), nullable=False)
    transaction_type = db.Column("Type", db.Unicode(20), nullable=False)
    category = db.Column("Category", db.Unicode(100), nullable=False)
    date = db.Column("TransactionDate", db.Date, nullable=False)
    created_at = db.Column("CreatedAt", db.DateTime, nullable=False, default=datetime.utcnow)
    user = db.relationship("User", back_populates="transactions")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount": float(self.amount),
            "type": self.transaction_type,
            "category": self.category,
            "date": self.date.isoformat(),
            "createdAt": self.created_at.isoformat(),
        }
