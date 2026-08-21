/* user-management.js — CRUD user + audit trail (RBAC). */

(function () {
  const API_BASE = (function () {
    try { if (location.protocol === "file:") return "http://localhost:3000/api"; } catch (e) {}
    return "/api";
  })();

  if (!authGuard()) {
    document.getElementById("user-tbody").innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);padding:16px;">Akses ditolak. Silakan <a href="login.html">login</a>.</td></tr>';
    document.getElementById("audit-tbody").innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);padding:16px;">Akses ditolak.</td></tr>';
    document.getElementById("btn-add-user").disabled = true;
    return;
  }

  function authReq(method, path, body) {
    const token = localStorage.getItem("rv_auth_token");
    const xhr = new XMLHttpRequest();
    xhr.open(method, API_BASE + path, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.send(body !== undefined ? JSON.stringify(body) : null);
    if (xhr.status < 200 || xhr.status >= 300) return null;
    return xhr.responseText ? JSON.parse(xhr.responseText) : null;
  }

  const ROLES = [
    { value: "superadmin", label: "Super Admin / System Owner" },
    { value: "admin", label: "Admin Datacenter / Infrastructure Manager" },
    { value: "engineer", label: "Network/Server Engineer" },
    { value: "operator", label: "Operator / Technician" },
    { value: "auditor", label: "Auditor / Compliance Officer" },
    { value: "viewer", label: "Viewer / Guest" },
  ];
  const PRIVILEGES = [
    { value: "crud", label: "CRUD (Create, Read, Update, Delete)" },
    { value: "rw", label: "Read/Write (tanpa Delete)" },
    { value: "read", label: "Read-only" },
  ];
  const AUTH_METHODS = [
    { value: "local", label: "Username / Password (local)" },
    { value: "sso", label: "SSO (placeholder)" },
    { value: "ldap", label: "LDAP (placeholder)" },
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderUsers() {
    const rows = authReq("GET", "/users") || [];
    const me = (function () { try { return JSON.parse(localStorage.getItem("rv_auth_user") || "null"); } catch (e) { return null; } })();
    const canEdit = me && ["superadmin", "admin"].includes(me.role);
    document.getElementById("user-count").textContent = rows.length;
    const tbody = document.getElementById("user-tbody");
    tbody.innerHTML = rows.map(u => {
      const roleLabel = ROLES.find(r => r.value === u.role)?.label || u.role;
      const privLabel = PRIVILEGES.find(p => p.value === u.privileges)?.label || u.privileges;
      return `<tr>
        <td class="mono">${esc(u.username)}</td>
        <td>${esc(u.name)}</td>
        <td>${esc(roleLabel)}</td>
        <td>${esc(u.dept)}</td>
        <td class="mono" style="font-size:11px;">${esc(u.scope_site || "—")}</td>
        <td>${esc(privLabel)}</td>
        <td>${esc(u.auth_method || "local")}</td>
        <td>${canEdit ? '<div class="row-actions"><button class="row-action" data-act="edit" data-id="' + esc(u.id) + '"><i class="fa-solid fa-pen"></i></button><button class="row-action danger" data-act="del" data-id="' + esc(u.id) + '"><i class="fa-solid fa-trash"></i></button></div>' : ""}</td>
      </tr>`;
    }).join("") || '<tr><td colspan="8" style="color:var(--text-muted);padding:16px;">Tidak ada user.</td></tr>';
    tbody.querySelectorAll("button[data-act]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        if (b.dataset.act === "edit") openUserForm(id);
        else if (b.dataset.act === "del") {
          if (!confirm("Hapus user ini?")) return;
          authReq("DELETE", "/users/" + encodeURIComponent(id));
          renderUsers();
          renderAudit();
        }
      });
    });
  }

  function renderAudit() {
    const data = authReq("GET", "/audit") || {};
    const rows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);
    const tbody = document.getElementById("audit-tbody");
    tbody.innerHTML = rows.slice(0, 50).map(r => `<tr>
      <td class="mono" style="font-size:11px;">${esc(r.created_at)}</td>
      <td class="mono">${esc(r.user_id)}</td>
      <td>${esc(r.action)}</td>
      <td class="mono">${esc(r.target)}</td>
      <td>${esc(r.detail)}</td>
      <td class="mono" style="font-size:11px;">${esc(r.ip)}</td>
    </tr>`).join("") || '<tr><td colspan="6" style="color:var(--text-muted);padding:16px;">Tidak ada log.</td></tr>';
  }

  function openUserForm(id) {
    const modal = document.getElementById("user-modal");
    const title = document.getElementById("user-modal-title");
    const grid = document.getElementById("user-form-grid");
    const rec = id ? (authReq("GET", "/users") || []).find(u => u.id === id) : null;
    title.textContent = rec ? "Edit User" : "Tambah User";
    grid.innerHTML = `
      <div class="full"><label class="form-label">Username</label><input class="form-input" data-f="username" value="${esc(rec ? rec.username : "")}" ${rec ? "" : 'required'}></div>
      <div class="full"><label class="form-label">${rec ? "Password (kosongkan jika tidak diubah)" : "Password"}</label><input class="form-input" type="password" data-f="password" value=""></div>
      <div class="full"><label class="form-label">Nama Lengkap</label><input class="form-input" data-f="name" value="${esc(rec ? rec.name : "")}" required></div>
      <div><label class="form-label">Role</label><select class="form-input" data-f="role">${ROLES.map(r => `<option value="${r.value}"${rec && rec.role === r.value ? " selected" : ""}>${esc(r.label)}</option>`).join("")}</select></div>
      <div><label class="form-label">Privileges</label><select class="form-input" data-f="privileges">${PRIVILEGES.map(p => `<option value="${p.value}"${rec && rec.privileges === p.value ? " selected" : ""}>${esc(p.label)}</option>`).join("")}</select></div>
      <div><label class="form-label">Departemen</label><input class="form-input" data-f="dept" value="${esc(rec ? rec.dept : "")}"></div>
      <div><label class="form-label">Kontak</label><input class="form-input" data-f="contact" value="${esc(rec ? rec.contact : "")}"></div>
      <div class="full"><label class="form-label">Scope Site (comma-separated, kosong = semua)</label><input class="form-input" data-f="scope_site" value="${esc(rec ? rec.scope_site : "")}" placeholder="DC1,DC2"></div>
      <div class="full"><label class="form-label">Scope Rack (kosong = semua)</label><input class="form-input" data-f="scope_rack" value="${esc(rec ? rec.scope_rack : "")}" placeholder="R1-A12"></div>
      <div class="full"><label class="form-label">Auth Method</label><select class="form-input" data-f="auth_method">${AUTH_METHODS.map(a => `<option value="${a.value}"${rec && rec.auth_method === a.value ? " selected" : ""}>${esc(a.label)}</option>`).join("")}</select></div>
    `;
    modal.style.display = "flex";
    document.getElementById("user-save").onclick = () => {
      const out = rec || { id: "" };
      const fields = ["username", "name", "role", "dept", "contact", "scope_site", "scope_rack", "scope_zone", "privileges", "auth_method", "notification_pref"];
      fields.forEach(f => {
        const el = grid.querySelector(`[data-f="${f}"]`);
        if (el) out[f] = el.value.trim();
      });
      const pw = grid.querySelector('[data-f="password"]').value.trim();
      if (pw) out.password_hash = toB64(pw);
      if (!out.username) { alert("Username wajib."); return; }
      const method = rec ? "PUT" : "POST";
      const path = rec ? "/users/" + encodeURIComponent(rec.id) : "/users";
      const res = authReq(method, path, out);
      if (!res) { alert("Gagal menyimpan."); return; }
      modal.style.display = "none";
      renderUsers();
      renderAudit();
    };
  }

  function toB64(s) {
    const str = String(s == null ? "" : s);
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      return btoa(str);
    }
  }
  function seedTemplateUsers() {
    if (!confirm("Muat template user? Akan menambahkan 4 user contoh (jika username belum ada).")) return;
    const templates = [
      { username: "admin1", password: "admin123", name: "Admin Datacenter", role: "admin", dept: "IT", contact: "admin@dc.local", scope_site: "DC1,DC2", scope_rack: "", privileges: "crud", auth_method: "local" },
      { username: "engineer1", password: "engineer123", name: "Network Engineer", role: "engineer", dept: "Network", contact: "neteng@dc.local", scope_site: "DC1", scope_rack: "R1-A01,R1-A02", privileges: "rw", auth_method: "local" },
      { username: "operator1", password: "operator123", name: "Operator Site", role: "operator", dept: "Operations", contact: "ops@dc.local", scope_site: "DC1,DC2,DC3", scope_rack: "", privileges: "read", auth_method: "local" },
      { username: "viewer1", password: "viewer123", name: "Guest Viewer", role: "viewer", dept: "Auditor", contact: "viewer@dc.local", scope_site: "", scope_rack: "", privileges: "read", auth_method: "local" },
    ];
    let done = 0;
    templates.forEach(t => {
      const payload = { ...t, password_hash: toB64(t.password) };
      const res = authReq("POST", "/users", payload);
      if (res) done++;
    });
    alert(`Template user dimuat: ${done}/${templates.length} user dibuat.\n\nKredensial:\n- admin1 / admin123\n- engineer1 / engineer123\n- operator1 / operator123\n- viewer1 / viewer123`);
    renderUsers();
    renderAudit();
  }

  document.getElementById("btn-add-user").addEventListener("click", () => openUserForm(null));
  document.getElementById("btn-template-users").addEventListener("click", seedTemplateUsers);
  document.getElementById("user-modal-close").addEventListener("click", () => document.getElementById("user-modal").style.display = "none");
  document.getElementById("user-cancel").addEventListener("click", () => document.getElementById("user-modal").style.display = "none");
  document.getElementById("user-modal").addEventListener("click", e => { if (e.target === document.getElementById("user-modal")) document.getElementById("user-modal").style.display = "none"; });
  document.getElementById("btn-logout").addEventListener("click", () => { localStorage.removeItem("rv_auth_token"); localStorage.removeItem("rv_auth_user"); location.reload(); });
  document.getElementById("user-search").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll("#user-tbody tr").forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  renderUsers();
  renderAudit();
})();
