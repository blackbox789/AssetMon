/* auth.js — Auth helpers: login/logout/me/role checks. */

const AUTH_TOKEN_KEY = "rv_auth_token";
const AUTH_USER_KEY = "rv_auth_user";

function apiAuthRequest(method, path, body) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const xhr = new XMLHttpRequest();
  xhr.open(method, path, false);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
  xhr.send(body !== undefined ? JSON.stringify(body) : null);
  if (xhr.status < 200 || xhr.status >= 300) return null;
  return xhr.responseText ? JSON.parse(xhr.responseText) : null;
}

function authLogin(username, password) {
  const r = apiAuthRequest("POST", "/api/auth/login", { username, password });
  if (r && r.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, r.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: r.token, username: r.username, name: r.name, role: r.role }));
    updateSidebarUser();
    return r;
  }
  return null;
}

function authLogout() {
  const me = authMe();
  apiAuthRequest("POST", "/api/auth/logout");
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  updateSidebarUser();
  return me;
}

function authMe() {
  try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null"); } catch (e) { return null; }
}

function authHasRole(...roles) {
  const me = authMe();
  if (!me) return false;
  const roleHierarchy = { superadmin: 7, admin: 6, engineer: 5, operator: 4, auditor: 3, viewer: 1 };
  const userLevel = roleHierarchy[me.role] || 0;
  for (const role of roles) {
    const requiredLevel = roleHierarchy[role] || 0;
    if (userLevel >= requiredLevel) return true;
  }
  return false;
}

function authScopeSites() {
  const me = authMe();
  if (!me) return [];
  const raw = (me.scope_site || "").trim();
  if (!raw) return [];
  return raw.split(/[,]+/).map(s => s.trim()).filter(Boolean);
}

function authInScopeSite(siteId) {
  if (!siteId) return true;
  const scope = authScopeSites();
  if (!scope.length) return true;
  return scope.includes(String(siteId).trim());
}

function updateSidebarUser() {
  const me = authMe();
  const name = me ? (me.name || me.username || "User") : "Guest";
  const role = me ? (me.role || "") : "";
  // Sidebar user
  const el = document.getElementById("sidebar-user");
  if (el) el.textContent = name;
  // Topbar user chip
  const topName = document.getElementById("topbar-username");
  if (topName) topName.textContent = name;
  const topRole = document.getElementById("topbar-role");
  if (topRole) topRole.textContent = role || "User";
  const topAvatar = document.getElementById("topbar-avatar");
  if (topAvatar) {
    const initials = name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
    topAvatar.textContent = initials || "?";
  }
}

function authGuard(options) {
  const me = authMe();
  if (!me) {
    if (options && options.redirect !== false) {
      const path = location.pathname;
      const fileName = path.substring(path.lastIndexOf("/") + 1).split("#")[0].split("?")[0];
      const next = fileName || "dashboard.html";
      console.log("[authGuard] redirecting to login.html?next=" + next);
      location.href = "login.html?next=" + encodeURIComponent(next);
    }
    return null;
  }
  return me;
}

// Auto-update sidebar on load
try { updateSidebarUser(); } catch (e) {}
