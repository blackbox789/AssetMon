/* login.js — Login flow with backend auth */

(function () {
  const API_BASE = (function () {
    try { if (location.protocol === "file:") return "http://localhost:3000/api"; } catch (e) {}
    return "/api";
  })();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function getNextPage() {
    try {
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      if (next && /^[a-zA-Z0-9_\-/.]+$/.test(next)) {
        return next;
      }
    } catch (e) {}
    return "dashboard.html";
  }

  // Selalu tampilkan form login. Tidak ada auto-redirect dari token lama —
  // user harus login ulang tiap kali membuka login.html.

  // Password visibility toggle
  const passInput = document.getElementById("password");
  const toggleBtn = document.querySelector(".login-toggle-pass");
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener("click", function () {
      const isPassword = passInput.type === "password";
      passInput.type = isPassword ? "text" : "password";
      toggleBtn.classList.toggle("fa-eye", !isPassword);
      toggleBtn.classList.toggle("fa-eye-slash", isPassword);
    });
  }

  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const statusLine = document.getElementById("status-line");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const rememberMe = document.querySelector('.login-remember input[type="checkbox"]');
    if (!username || !password) {
      statusLine.textContent = "Isi username dan password.";
      statusLine.style.color = "var(--danger)";
      return;
    }
    statusLine.textContent = "Signing in…";
    statusLine.style.color = "";
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_BASE + "/auth/login", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        const r = JSON.parse(xhr.responseText || "{}");
        if (r.token) {
          localStorage.setItem("rv_auth_token", r.token);
          localStorage.setItem("rv_auth_user", JSON.stringify({ id: r.token, username: r.username, name: r.name, role: r.role }));
          if (rememberMe && rememberMe.checked) {
            localStorage.setItem("rv_auth_remember", "1");
          }
          statusLine.textContent = "Berhasil!";
          statusLine.style.color = "var(--success)";
          setTimeout(() => { window.location.href = getNextPage(); }, 400);
        } else {
          statusLine.textContent = "Login gagal.";
          statusLine.style.color = "var(--danger)";
        }
      } else {
        const msg = xhr.status === 401 ? "Username atau password salah." : "Gagal terhubung ke server.";
        statusLine.textContent = msg;
        statusLine.style.color = "var(--danger)";
      }
    };
    xhr.onerror = function () {
      statusLine.textContent = "Gagal terhubung ke server.";
      statusLine.style.color = "var(--danger)";
    };
    xhr.send(JSON.stringify({ username, password }));
  });
})();

