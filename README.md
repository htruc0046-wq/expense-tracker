# Expense Tracker

Website quản lý thu chi cá nhân, xây dựng bằng Flask, SQL Server, SQLAlchemy và JavaScript thuần. Giao diện hỗ trợ đăng ký, đăng nhập bằng họ tên và mật khẩu, quản lý giao dịch, thống kê, bộ lọc và đổi mật khẩu.

## Yêu cầu

- Python 3.10 trở lên
- Microsoft SQL Server và SQL Server Management Studio (SSMS)
- Microsoft ODBC Driver 17 for SQL Server
- Windows Authentication hoặc một SQL Server login có quyền tạo và sử dụng database `expense_tracker`

## Cài đặt SQL Server

Mở `SQLQuery1.sql` trong SSMS, kết nối đúng SQL Server instance rồi chạy script. Script tạo database `expense_tracker` nếu chưa có và tạo/cập nhật các bảng `Users` và `Transactions`.

Nếu dùng Windows Authentication, tài khoản Windows đang chạy Flask cần quyền truy cập database. Nếu dùng SQL Server Authentication, tạo/cấp quyền cho SQL login trong SSMS và cập nhật `DATABASE_URL` trong `.env`.

## Chạy ứng dụng trên Windows

Mở PowerShell tại thư mục dự án:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Mở `.env`, thay `SECRET_KEY` bằng giá trị ngẫu nhiên dài và kiểm tra `DATABASE_URL` khớp với SQL Server instance, ODBC driver và phương thức xác thực trên máy.

Ví dụ tạo secret key:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Sau đó chạy Flask:

```powershell
python app.py
```

Mở http://127.0.0.1:5000 trong trình duyệt.

### Cấu hình database

Cấu hình mẫu trong `.env.example` dùng Windows Integrated Authentication cho SQL Server cục bộ:

```dotenv
DATABASE_URL=mssql+pyodbc://localhost/expense_tracker?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes&TrustServerCertificate=yes
```

Nếu instance SQL Server có tên, thay `localhost` bằng tên server/instance thích hợp, ví dụ `localhost\SQLEXPRESS` (mã hóa dấu `\` thành `%5C` trong URL). Với SQL Server Authentication, dùng URL có username và password đã URL-encode:

```dotenv
DATABASE_URL=mssql+pyodbc://USERNAME:PASSWORD@SERVER/expense_tracker?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes
```

Không đưa `.env`, mật khẩu database hoặc secret key thật lên GitHub.

## Cấu trúc dự án

```text
app.py              Flask routes, REST API và CSRF
config.py           Cấu hình Flask và SQLAlchemy
models.py           Mô hình Users và Transactions
SQLQuery1.sql       Script chuẩn bị schema SQL Server
requirements.txt    Thư viện Python
templates/
  index.html        Template giao diện Flask
static/
  app.js            Giao tiếp frontend/API
  styles.css        Giao diện
```

## Lưu ý bảo mật

- Mật khẩu người dùng được băm ở backend bằng Werkzeug.
- Các thay đổi dữ liệu cần CSRF token và phiên đăng nhập.
- Mỗi giao dịch được giới hạn theo người dùng đăng nhập.
- Chỉ dùng Flask development server cho phát triển cục bộ; triển khai thực tế cần cấu hình production server, HTTPS và secret key riêng.
