const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let currentUser = null;
let authMode = "login";
let csrfToken = "";
let allTransactions = [];
let pendingDeleteId = null;

const INCOME_CATEGORIES = ["Lương", "Thưởng", "Tiền làm thêm", "Kinh doanh", "Khác"];
const EXPENSE_CATEGORIES = ["Ăn uống", "Mua sắm", "Đi lại", "Hóa đơn", "Giải trí", "Học tập", "Sức khỏe", "Khác"];

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.background = isError ? "#b85d58" : "";
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

async function api(url, options = {}) {
  if (!csrfToken) {
    const response = await fetch("/api/csrf");
    const data = await response.json();
    csrfToken = data.csrfToken;
  }
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.method && options.method !== "GET") headers["X-CSRFToken"] = csrfToken;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra.");
  return data;
}

async function loadSession() {
  try {
    const data = await api("/api/me");
    currentUser = data.user;
    enterApp();
  } catch {
    currentUser = null;
    $("#authScreen").classList.remove("hidden");
  }
}

function setAuthMode(mode) {
  authMode = mode;
  $$(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.auth === mode));
  $("#nameField").hidden = mode !== "register";
  $("#confirmPasswordField").hidden = mode !== "register";
  $("#authName").required = mode === "register";
  $("#authConfirmPassword").required = mode === "register";
  $("#authIdentifierLabel").textContent = mode === "login" ? "Họ và tên" : "Email";
  $("#authEmail").type = mode === "login" ? "text" : "email";
  $("#authEmail").placeholder = mode === "login" ? "Nhập họ và tên" : "name@example.com";
  $("#authEmail").autocomplete = mode === "login" ? "username" : "email";
  $("#authTitle").textContent = mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới";
  $("#authSubtitle").textContent = mode === "login" ? "Đăng nhập để quản lý tài chính của bạn" : "Bắt đầu theo dõi thu chi mỗi ngày";
  $("#authSubmit").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  $("#authError").textContent = "";
}

$("#authForm").onsubmit = async (event) => {
  event.preventDefault();
  const identifier = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  $("#authError").textContent = "";
  $("#authSubmit").disabled = true;
  $("#authSubmit").textContent = "Đang xử lý...";
  try {
    if (authMode === "register") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) throw new Error("Email không đúng định dạng.");
      if (!$("#authName").value.trim()) throw new Error("Vui lòng nhập họ và tên.");
      if (password.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
      if (password !== $("#authConfirmPassword").value) throw new Error("Mật khẩu xác nhận không khớp.");
      const data = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ name: $("#authName").value.trim(), email: identifier, password, confirmation: $("#authConfirmPassword").value }),
      });
      csrfToken = data.csrfToken;
      currentUser = data.user;
      showToast(data.message);
    } else {
      if (!identifier) throw new Error("Vui lòng nhập tên đăng nhập.");
      const data = await api("/api/login", { method: "POST", body: JSON.stringify({ name: identifier, password }) });
      csrfToken = data.csrfToken;
      currentUser = data.user;
      showToast(data.message);
    }
    enterApp();
  } catch (error) {
    $("#authError").textContent = error.message;
    showToast(error.message, true);
  } finally {
    $("#authSubmit").disabled = false;
    $("#authSubmit").textContent = authMode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  }
};

function enterApp() {
  $("#authScreen").classList.add("hidden");
  $("#userName").textContent = currentUser.name;
  $("#userAvatar").textContent = currentUser.name.charAt(0).toUpperCase();
  $("#profileName").textContent = currentUser.name;
  $("#profileNameDetail").textContent = currentUser.name;
  $("#profileEmail").textContent = currentUser.email;
  $("#profileEmailDetail").textContent = currentUser.email;
  $("#profileAvatar").textContent = currentUser.name.charAt(0).toUpperCase();
  $("#authForm").reset();
  renderAll();
}

function getCategoryIcon(category, type) {
  if (type === "income") return '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  if (category === "Ăn uống") return '<svg viewBox="0 0 24 24"><path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M16 3v18M16 3c3 2 4 6 4 9h-4"/></svg>';
  if (category === "Đi lại") return '<svg viewBox="0 0 24 24"><path d="M5 16h14l-1-7H6l-1 7ZM7 16v3M17 16v3M8 9l1-3h6l1 3M8 12h.01M16 12h.01"/></svg>';
  if (category === "Mua sắm") return '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1 14H6L5 7ZM9 7a3 3 0 0 1 6 0"/></svg>';
  if (category === "Hóa đơn") return '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6"/></svg>';
  if (category === "Giải trí") return '<svg viewBox="0 0 24 24"><path d="M4 12h16M6 8v8M18 8v8M8 5l8 14M16 5L8 19"/></svg>';
  if (category === "Học tập") return '<svg viewBox="0 0 24 24"><path d="M3 6l9-3 9 3-9 3-9-3ZM7 8v7c3 2 7 2 10 0V8"/></svg>';
  if (category === "Sức khỏe") return '<svg viewBox="0 0 24 24"><path d="M12 21S3 16 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12Z"/><path d="M8 12h8M12 8v8"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M4 11h16M12 11v8"/></svg>';
}

function renderTransactionRow(transaction) {
  const prefix = transaction.type === "income" ? "+" : "-";
  return `<div class="transaction-row"><div class="transaction-main"><div class="category-icon ${transaction.type}">${getCategoryIcon(transaction.category, transaction.type)}</div><div><strong>${escapeHtml(transaction.name)}</strong><small>${transaction.type === "income" ? "Khoản thu" : "Khoản chi"}</small></div></div><span class="category-chip">${escapeHtml(transaction.category)}</span><span class="transaction-date">${formatDate(transaction.date)}</span><span class="amount ${transaction.type}">${prefix}${formatCurrency(transaction.amount)}</span><div class="row-actions"><button class="row-action edit" type="button" data-id="${transaction.id}" aria-label="Sửa giao dịch"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="row-action delete" type="button" data-id="${transaction.id}" aria-label="Xóa giao dịch"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></div></div>`;
}

async function renderAll() {
  if (!currentUser) return;
  try {
    const data = await api("/api/transactions");
    allTransactions = data.transactions;
    $("#incomeAmount").textContent = formatCurrency(data.summary.income);
    $("#expenseAmount").textContent = formatCurrency(data.summary.expense);
    $("#balanceAmount").textContent = formatCurrency(data.summary.balance);
    $("#recentTransactions").innerHTML = allTransactions.length
      ? allTransactions.slice(0, 5).map(renderTransactionRow).join("")
      : '<div class="empty-state"><strong>Chưa có giao dịch</strong><span>Nhấn “Thêm giao dịch” để bắt đầu.</span></div>';
    renderCharts(allTransactions);
    applyFilters();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderCharts(transactions) {
  const monthTotals = {};
  const categoryTotals = {};
  transactions.forEach((item) => {
    const month = item.date.slice(0, 7);
    if (!monthTotals[month]) monthTotals[month] = { income: 0, expense: 0 };
    monthTotals[month][item.type] += item.amount;
    if (item.type === "expense") categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
  });
  const months = Object.keys(monthTotals).sort().slice(-6);
  if (!months.length) {
    $("#monthChart").innerHTML = '<div class="chart-empty">Chưa có dữ liệu theo tháng</div>';
  } else {
    const max = Math.max(...months.flatMap((month) => [monthTotals[month].income, monthTotals[month].expense]), 1);
    $("#monthChart").innerHTML = months.map((month) => {
      const label = month.split("-")[1] + "/" + month.split("-")[0].slice(2);
      return `<div class="month-column" data-label="${label}"><i class="month-bar income" style="height:${Math.round(monthTotals[month].income / max * 100)}%"></i><i class="month-bar expense" style="height:${Math.round(monthTotals[month].expense / max * 100)}%"></i></div>`;
    }).join("");
  }
  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!categories.length) {
    $("#categoryStats").innerHTML = '<div class="chart-empty">Chưa có chi tiêu theo danh mục</div>';
  } else {
    const maxCategory = categories[0][1];
    const colors = ["#159a78", "#69bfa7", "#e6a04a", "#7899b5", "#9b85bd", "#e66b64"];
    $("#categoryStats").innerHTML = categories.map(([name, amount], index) =>
      `<div class="category-stat"><span class="category-stat-name">${escapeHtml(name)}</span><div class="category-track"><i style="width:${Math.round(amount / maxCategory * 100)}%;background:${colors[index]}"></i></div><strong>${formatCurrency(amount)}</strong></div>`
    ).join("");
  }
}

async function applyFilters() {
  if (!currentUser) return;
  const params = new URLSearchParams({
    search: $("#searchInput").value.trim(),
    type: $("#typeFilter").value,
    category: $("#categoryFilter").value,
    from: $("#fromDateFilter").value,
    to: $("#toDateFilter").value,
    sort: $("#sortFilter").value,
  });
  try {
    const data = await api("/api/transactions?" + params.toString());
    $("#allTransactions").innerHTML = data.transactions.length
      ? data.transactions.map(renderTransactionRow).join("")
      : '<div class="empty-state"><strong>Không tìm thấy giao dịch</strong><span>Thử thay đổi từ khóa hoặc bộ lọc.</span></div>';
  } catch (error) {
    showToast(error.message, true);
  }
}

function updateCategoryOptions(type, selectedCategory) {
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  $("#transactionCategory").innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join("");
  if (selectedCategory && categories.includes(selectedCategory)) $("#transactionCategory").value = selectedCategory;
}

function openTransactionModal(transaction = null) {
  $("#transactionForm").reset();
  $("#transactionId").value = transaction?.id || "";
  $("#modalTitle").textContent = transaction ? "Chỉnh sửa giao dịch" : "Thêm giao dịch";
  $("#transactionDate").value = transaction?.date || new Date().toISOString().slice(0, 10);
  if (transaction) {
    $("#transactionName").value = transaction.name;
    $("#transactionAmount").value = transaction.amount;
    $(`input[name="type"][value="${transaction.type}"]`).checked = true;
    updateCategoryOptions(transaction.type, transaction.category);
  } else {
    $('input[name="type"][value="expense"]').checked = true;
    updateCategoryOptions("expense");
  }
  $("#transactionModal").classList.remove("hidden");
  $("#transactionName").focus();
}

function closeTransactionModal() { $("#transactionModal").classList.add("hidden"); }

$("#transactionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#transactionId").value;
  const payload = {
    name: $("#transactionName").value.trim(),
    amount: Number($("#transactionAmount").value),
    date: $("#transactionDate").value,
    category: $("#transactionCategory").value,
    type: $('input[name="type"]:checked').value,
  };
  if (!payload.name || payload.amount < 1000) {
    showToast("Vui lòng nhập tên và số tiền hợp lệ.", true);
    return;
  }
  try {
    const data = await api(id ? `/api/transactions/${id}` : "/api/transactions", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    closeTransactionModal();
    await renderAll();
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

document.addEventListener("click", (event) => {
  const edit = event.target.closest(".row-action.edit");
  const remove = event.target.closest(".row-action.delete");
  if (edit) {
    const transaction = allTransactions.find((item) => String(item.id) === edit.dataset.id);
    if (transaction) openTransactionModal(transaction);
  }
  if (remove) {
    pendingDeleteId = remove.dataset.id;
    const transaction = allTransactions.find((item) => String(item.id) === pendingDeleteId);
    $("#confirmMessage").textContent = `Giao dịch "${transaction?.name || ""}" sẽ bị xóa khỏi lịch sử.`;
    $("#confirmModal").classList.remove("hidden");
  }
});

$("#acceptConfirm").addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  try {
    const data = await api(`/api/transactions/${pendingDeleteId}`, { method: "DELETE" });
    $("#confirmModal").classList.add("hidden");
    pendingDeleteId = null;
    await renderAll();
    showToast(data.message);
  } catch (error) {
    showToast(error.message, true);
  }
});

$("#cancelConfirm").addEventListener("click", () => { pendingDeleteId = null; $("#confirmModal").classList.add("hidden"); });
$$(".auth-tab").forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.auth)));
$("#togglePassword").addEventListener("click", () => { $("#authPassword").type = $("#authPassword").type === "password" ? "text" : "password"; });
["addTransactionButton", "addTransactionButton2"].forEach((id) => $("#" + id).addEventListener("click", () => openTransactionModal()));
$("#closeModal").addEventListener("click", closeTransactionModal);
$("#cancelModal").addEventListener("click", closeTransactionModal);
$("#transactionModal").addEventListener("click", (event) => { if (event.target === $("#transactionModal")) closeTransactionModal(); });
$$('input[name="type"]').forEach((radio) => radio.addEventListener("change", () => updateCategoryOptions(radio.value)));
["searchInput", "typeFilter", "categoryFilter", "fromDateFilter", "toDateFilter", "sortFilter"].forEach((id) => $("#" + id).addEventListener(id === "searchInput" ? "input" : "change", applyFilters));

$$(".nav-item").forEach((item) => item.addEventListener("click", () => {
  $$(".nav-item").forEach((nav) => nav.classList.remove("active"));
  item.classList.add("active");
  const view = item.dataset.view;
  $("#overviewView").classList.toggle("hidden", view !== "overview");
  $("#transactionsView").classList.toggle("hidden", view !== "transactions");
  $("#profileView").classList.toggle("hidden", view !== "profile");
  $("#pageTitle").textContent = view === "overview" ? "Tổng quan" : view === "transactions" ? "Giao dịch" : "Thông tin cá nhân";
  $(".sidebar").classList.remove("open");
}));

$(".profile").addEventListener("click", () => {
  $$(".nav-item").forEach((nav) => nav.classList.toggle("active", nav.dataset.view === "profile"));
  $("#overviewView").classList.add("hidden");
  $("#transactionsView").classList.add("hidden");
  $("#profileView").classList.remove("hidden");
  $("#pageTitle").textContent = "Thông tin cá nhân";
});
$("#menuButton").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

$("#logoutButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/logout", { method: "POST", body: "{}" });
    csrfToken = data.csrfToken;
  } catch (error) {
    showToast(error.message, true);
  }
  currentUser = null;
  allTransactions = [];
  $("#authScreen").classList.remove("hidden");
  setAuthMode("login");
});

$("#changePasswordButton").addEventListener("click", () => { $("#passwordForm").reset(); $("#passwordError").textContent = ""; $("#passwordModal").classList.remove("hidden"); });
function closePasswordModal() { $("#passwordModal").classList.add("hidden"); }
$("#closePasswordModal").addEventListener("click", closePasswordModal);
$("#cancelPassword").addEventListener("click", closePasswordModal);
$("#passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#passwordError").textContent = "";
  const payload = { oldPassword: $("#oldPassword").value, newPassword: $("#newPassword").value, confirmation: $("#confirmPassword").value };
  try {
    const data = await api("/api/password", { method: "POST", body: JSON.stringify(payload) });
    closePasswordModal();
    showToast(data.message);
  } catch (error) {
    $("#passwordError").textContent = error.message;
  }
});

const now = new Date();
$("#todayLabel").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(now).toUpperCase();
$("#transactionDate").value = now.toISOString().slice(0, 10);
updateCategoryOptions("expense");
setAuthMode("login");
loadSession();
