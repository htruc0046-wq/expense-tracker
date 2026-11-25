import os
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from dotenv import load_dotenv
from flask import Flask, jsonify, request, render_template, session
from flask_wtf.csrf import CSRFProtect, generate_csrf
from sqlalchemy import func
from sqlalchemy.exc import OperationalError

from config import Config
from models import db, User, Transaction


load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)
csrf = CSRFProtect(app)

INCOME_CATEGORIES = {"Lương", "Thưởng", "Tiền làm thêm", "Kinh doanh", "Khác"}
EXPENSE_CATEGORIES = {"Ăn uống", "Mua sắm", "Đi lại", "Hóa đơn", "Giải trí", "Học tập", "Sức khỏe", "Khác"}


def current_user():
    user_id = session.get("user_id")
    return db.session.get(User, user_id) if user_id else None


def login_required():
    user = current_user()
    if not user:
        return None, (jsonify({"error": "Phiên đăng nhập đã hết hạn."}), 401)
    return user, None


def validate_transaction(data):
    name = str(data.get("name", "")).strip()
    transaction_type = str(data.get("type", "")).strip()
    category = str(data.get("category", "")).strip()
    date_text = str(data.get("date", "")).strip()

    if not name or len(name) > 60:
        raise ValueError("Tên giao dịch không hợp lệ.")
    if transaction_type not in {"income", "expense"}:
        raise ValueError("Loại giao dịch không hợp lệ.")
    allowed = INCOME_CATEGORIES if transaction_type == "income" else EXPENSE_CATEGORIES
    if category not in allowed:
        raise ValueError("Danh mục không phù hợp.")
    try:
        amount = Decimal(str(data.get("amount")))
        if amount < Decimal("1000") or amount.as_tuple().exponent < -2:
            raise ValueError
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Số tiền phải là số hợp lệ và tối thiểu 1.000 ₫.")
    try:
        transaction_date = datetime.strptime(date_text, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Ngày giao dịch không hợp lệ.")
    return name, amount, transaction_type, category, transaction_date


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/csrf")
def csrf_token():
    return jsonify({"csrfToken": generate_csrf()})


@app.get("/api/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False}), 401
    return jsonify({"authenticated": True, "user": user.to_dict()})


@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    confirmation = str(data.get("confirmation", ""))

    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"error": "Email không đúng định dạng."}), 400
    if not name or len(name) > 50:
        return jsonify({"error": "Họ và tên không hợp lệ."}), 400
    if len(password) < 6:
        return jsonify({"error": "Mật khẩu phải có ít nhất 6 ký tự."}), 400
    if password != confirmation:
        return jsonify({"error": "Mật khẩu xác nhận không khớp."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email này đã được đăng ký."}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    session.clear()
    session["user_id"] = user.id
    return jsonify({
        "message": "Tạo tài khoản thành công.",
        "user": user.to_dict(),
        "csrfToken": generate_csrf(),
    }), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    password = str(data.get("password", ""))
    if not name or len(name) > 100 or not password:
        return jsonify({"error": "Tên đăng nhập hoặc mật khẩu không đúng."}), 401
    users = User.query.filter(func.lower(User.name) == name.lower()).all()
    user = next((candidate for candidate in users if candidate.check_password(password)), None)
    if not user:
        return jsonify({"error": "Tên đăng nhập hoặc mật khẩu không đúng."}), 401
    session.clear()
    session["user_id"] = user.id
    return jsonify({
        "message": "Đăng nhập thành công.",
        "user": user.to_dict(),
        "csrfToken": generate_csrf(),
    })


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"message": "Đăng xuất thành công.", "csrfToken": generate_csrf()})


@app.post("/api/password")
def change_password():
    user, error = login_required()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    old_password = str(data.get("oldPassword", ""))
    new_password = str(data.get("newPassword", ""))
    confirmation = str(data.get("confirmation", ""))
    if not user.check_password(old_password):
        return jsonify({"error": "Mật khẩu hiện tại không đúng."}), 400
    if len(new_password) < 6:
        return jsonify({"error": "Mật khẩu mới phải có ít nhất 6 ký tự."}), 400
    if new_password != confirmation:
        return jsonify({"error": "Mật khẩu xác nhận không khớp."}), 400
    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Đổi mật khẩu thành công."})


@app.get("/api/transactions")
def list_transactions():
    user, error = login_required()
    if error:
        return error
    query = Transaction.query.filter_by(user_id=user.id)
    name = request.args.get("search", "").strip()
    transaction_type = request.args.get("type", "all")
    category = request.args.get("category", "all")
    from_date = request.args.get("from")
    to_date = request.args.get("to")

    if name:
        query = query.filter(Transaction.name.ilike(f"%{name}%"))
    if transaction_type in {"income", "expense"}:
        query = query.filter_by(transaction_type=transaction_type)
    if category != "all" and category:
        query = query.filter_by(category=category)
    if from_date:
        try:
            query = query.filter(Transaction.date >= datetime.strptime(from_date, "%Y-%m-%d").date())
        except ValueError:
            return jsonify({"error": "Khoảng ngày không hợp lệ."}), 400
    if to_date:
        try:
            query = query.filter(Transaction.date <= datetime.strptime(to_date, "%Y-%m-%d").date())
        except ValueError:
            return jsonify({"error": "Khoảng ngày không hợp lệ."}), 400

    sort = request.args.get("sort", "newest")
    order = Transaction.date.asc() if sort == "oldest" else Transaction.date.desc()
    transactions = query.order_by(order, Transaction.created_at.desc()).all()
    income = sum((t.amount for t in transactions if t.transaction_type == "income"), Decimal("0"))
    expense = sum((t.amount for t in transactions if t.transaction_type == "expense"), Decimal("0"))
    return jsonify({
        "transactions": [t.to_dict() for t in transactions],
        "summary": {"income": float(income), "expense": float(expense), "balance": float(income - expense)}
    })


@app.post("/api/transactions")
def create_transaction():
    user, error = login_required()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    try:
        name, amount, transaction_type, category, transaction_date = validate_transaction(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    transaction = Transaction(user_id=user.id, name=name, amount=amount,
                              transaction_type=transaction_type, category=category, date=transaction_date)
    db.session.add(transaction)
    db.session.commit()
    return jsonify({"message": "Đã thêm giao dịch.", "transaction": transaction.to_dict()}), 201


@app.put("/api/transactions/<int:transaction_id>")
def update_transaction(transaction_id):
    user, error = login_required()
    if error:
        return error
    transaction = db.session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        return jsonify({"error": "Không tìm thấy giao dịch."}), 404
    data = request.get_json(silent=True) or {}
    try:
        name, amount, transaction_type, category, transaction_date = validate_transaction(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    transaction.name = name
    transaction.amount = amount
    transaction.transaction_type = transaction_type
    transaction.category = category
    transaction.date = transaction_date
    db.session.commit()
    return jsonify({"message": "Đã cập nhật giao dịch.", "transaction": transaction.to_dict()})


@app.delete("/api/transactions/<int:transaction_id>")
def delete_transaction(transaction_id):
    user, error = login_required()
    if error:
        return error
    transaction = db.session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        return jsonify({"error": "Không tìm thấy giao dịch."}), 404
    db.session.delete(transaction)
    db.session.commit()
    return jsonify({"message": "Đã xóa giao dịch."})


@app.errorhandler(400)
def bad_request(_error):
    return jsonify({"error": "Dữ liệu gửi lên không hợp lệ."}), 400


@app.errorhandler(403)
def forbidden(_error):
    return jsonify({"error": "Phiên CSRF không hợp lệ. Vui lòng tải lại trang."}), 403


with app.app_context():
    try:
        db.create_all()
    except OperationalError as exc:
        app.logger.warning("SQL Server unavailable: %s", exc)


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1")
