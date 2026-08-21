/* audit-log.js — Audit log/trail/history viewer (RBAC: superadmin/admin/auditor). */

(function () {
  const API_BASE = (function () {
    try { if (location.protocol === "file:") return "http://localhost:3000/api"; } catch (e) {}
    return "/api";
  })();

  if (!authGuard()) {
    const tb = document.getElementById("al-tbody");
    if (tb) tb.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);padding:16px;">Akses ditolak. Silakan <a href="login.html">login</a> sebagai superadmin/admin.</td></tr>';
    return;
  }

  const PAGE_SIZE = 50;
  let ROWS = [];
  let USERS = [];
  let page = 1;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const qs = el => (el ? (el.value || "").trim() : "");
  const qdate = el => (el ? (el.value || "").trim() : "");

  function authFetch(path) {
    return fetch(API_BASE + path, { headers: authHeaders() }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  }
  function authHeaders() {
    const h = {};
    try { const t = localStorage.getItem("rv_auth_token"); if (t) h["Authorization"] = "Bearer " + t; } catch (e) {}
    return h;
  }

  // ---- Action → badge + label mapping ----
  function classify(action) {
    const a = String(action || "").toLowerCase();
    if (a.startsWith("auth")) return { cat: "auth", label: a.replace(/^auth\./, "").replace(/^./, c => c.toUpperCase()), icon: "fa-right-to-bracket", cls: "auth" };
    if (a.startsWith("user.")) return { cat: "user", label: "User " + a.replace(/^user\./, "").replace(/^./, c => c.toUpperCase()), icon: "fa-users", cls: a.endsWith(".delete") ? "delete" : a.endsWith(".create") ? "create" : "update" };
    if (a === "ops.transition") return { cat: "ops", label: "Transisi Status", icon: "fa-arrows-turn-to-dots", cls: "transition" };
    if (a.startsWith("ops.")) return { cat: "ops", label: "OPS " + a.replace(/^ops\./, "").replace(/^./, c => c.toUpperCase()), icon: "fa-clipboard-list", cls: a.endsWith(".delete") ? "delete" : a.endsWith(".create") ? "create" : "ops" };
    if (a.startsWith("device.") || a.startsWith("rack.") || a.startsWith("site.") || a.startsWith("server.") || a.startsWith("storage.") || a.startsWith("map.")) {
      return { cat: "asset", label: a.replace(/\./g, " ").replace(/^./, c => c.toUpperCase()), icon: "fa-server", cls: a.endsWith(".delete") ? "delete" : a.endsWith(".create") ? "create" : "asset" };
    }
    if (a.startsWith("brand.")) return { cat: "brand", label: "Branding " + a.replace(/^brand\./, "").replace(/^./, c => c.toUpperCase()), icon: "fa-palette", cls: "brand" };
    return { cat: "misc", label: a, icon: "fa-circle-info", cls: "misc" };
  }

  function userName(uid) {
    if (!uid) return "anon";
    const u = USERS.find(x => x.id === uid);
    if (u) return u.name ? u.name + " (" + u.username + ")" : u.username;
    return uid;
  }

  // ---- KPI ----
  function statCard(label, value, sub, icon, tone) {
    const tones = {
      green: ["var(--accent-dim)", "var(--accent-text)"],
      blue: ["var(--info-dim)", "var(--info)"],
      violet: ["var(--violet-dim)", "var(--violet)"],
      amber: ["var(--warning-dim)", "var(--warning)"],
      red: ["var(--danger-dim)", "var(--danger)"],
      grey: ["var(--bg-surface-3)", "var(--text-muted)"],
    };
    const [bg, fg] = tones[tone] || tones.grey;
    return '<div class="card stat-card"><div class="stat-top"><span class="stat-label">' + label + '</span><span class="stat-icon" style="background:' + bg + ';color:' + fg + ';">' + icon + '</span></div><div class="stat-value">' + value + '</div><div class="stat-delta">' + sub + '</div></div>';
  }

  async function renderKPI() {
    const s = await authFetch("/audit/summary");
    const el = document.getElementById("al-kpi");
    if (!s) {
      el.innerHTML = statCard("Audit", "—", "Backend tidak tersedia / akses terbatas", '<i class="fa-solid fa-file-lines"></i>', "grey");
      return;
    }
    el.innerHTML = [
      statCard("Total Aktivitas", s.total, s.today + " aktivitas hari ini", '<i class="fa-solid fa-clock-rotate-left"></i>', "blue"),
      statCard("Login", s.login, "total event login", '<i class="fa-solid fa-right-to-bracket"></i>', "violet"),
      statCard("User (CRUD)", s.user, "create / update / delete user", '<i class="fa-solid fa-users-gear"></i>', s.user ? "amber" : "green"),
      statCard("Operasional", s.ops, "transisi status & CRUD OPS", '<i class="fa-solid fa-arrows-turn-to-dots"></i>', s.ops ? "green" : "grey"),
    ].join("");
  }

  // ---- Filter helpers ----
  function catMatch(a, cat) {
    if (!cat) return true;
    if (cat === "auth") return a.startsWith("auth.");
    if (cat === "user") return a.startsWith("user.");
    if (cat === "ops") return a.startsWith("ops.");
    if (cat === "asset") return a.startsWith("device.") || a.startsWith("rack.") || a.startsWith("site.") || a.startsWith("server.") || a.startsWith("map.");
    if (cat === "brand") return a.startsWith("brand.");
    return true;
  }

  function buildQuery() {
    const params = new URLSearchParams();
    const q = qs(document.getElementById("al-search"));
    const cat = qs(document.getElementById("al-cat"));
    const action = qs(document.getElementById("al-action"));
    const from = qdate(document.getElementById("al-from"));
    const to = qdate(document.getElementById("al-to"));
    if (q) params.set("q", q);
    if (action && action !== "all") params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to + " 23:59:59");
    if (cat && !action) {
      // kategori dipetakan ke pola aksi untuk filter server-side
      if (cat === "auth") params.set("action", "auth.");
      else if (cat === "user") params.set("action", "user.");
      else if (cat === "ops") params.set("action", "ops.");
      else if (cat === "brand") params.set("action", "brand.");
    }
    params.set("limit", "2000");
    return params;
  }

  function populateActionOptions() {
    const sel = document.getElementById("al-action");
    const actions = [...new Set(ROWS.map(r => r.action))].sort();
    sel.innerHTML = '<option value="">Semua Aksi</option>' + actions.map(a => '<option value="' + esc(a) + '">' + esc(classify(a).label) + '</option>').join("");
  }

  // ---- Table + pager ----
  function renderTable() {
    const tbody = document.getElementById("al-tbody");
    const info = document.getElementById("al-count");
    const cat = qs(document.getElementById("al-cat"));
    const action = qs(document.getElementById("al-action"));
    const q = qs(document.getElementById("al-search")).toLowerCase();
    const from = qdate(document.getElementById("al-from"));
    const to = qdate(document.getElementById("al-to"));

    let rows = ROWS.filter(r => catMatch(r.action, cat));
    if (action) rows = rows.filter(r => r.action === action);
    if (q) rows = rows.filter(r => String(r.user_id + " " + r.action + " " + r.target + " " + r.detail).toLowerCase().includes(q));
    if (from) rows = rows.filter(r => String(r.created_at || "").slice(0, 10) >= from);
    if (to) rows = rows.filter(r => String(r.created_at || "").slice(0, 10) <= to);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * PAGE_SIZE;
    const slice = rows.slice(start, start + PAGE_SIZE);

    info.textContent = rows.length + " aktivitas" + (rows.length ? " · hal " + page + "/" + totalPages : "");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);padding:16px;">Tidak ada log yang cocok dengan filter.</td></tr>';
    } else {
      tbody.innerHTML = slice.map(r => {
        const c = classify(r.action);
        return `<tr>
          <td class="mono" style="font-size:11px;white-space:nowrap;">${esc(fmtDate(r.created_at))}</td>
          <td style="font-size:12.5px;">${esc(userName(r.user_id))}</td>
          <td><span class="al-act ${c.cls}"><i class="fa-solid ${c.icon}"></i>${esc(c.label)}</span></td>
          <td class="mono" style="font-size:11.5px;">${esc(r.target)}</td>
          <td class="al-detail" title="${esc(r.detail)}">${esc(r.detail)}</td>
          <td class="mono" style="font-size:11px;">${esc(r.ip || "—")}</td>
        </tr>`;
      }).join("");
    }

    renderPager(rows.length, totalPages);
  }

  function fmtDate(s) {
    return String(s || "").replace("T", " ").slice(0, 16);
  }

  function renderPager(count, totalPages) {
    const pg = document.getElementById("al-pager");
    pg.innerHTML =
      '<button ' + (page <= 1 ? "disabled" : "") + ' data-pg="prev"><i class="fa-solid fa-chevron-left"></i></button>' +
      '<span class="al-pg-info">' + count + ' log</span>' +
      '<button class="al-pg-page" disabled>' + page + ' / ' + totalPages + '</button>' +
      '<button ' + (page >= totalPages ? "disabled" : "") + ' data-pg="next"><i class="fa-solid fa-chevron-right"></i></button>';
    pg.querySelectorAll("button[data-pg]").forEach(b => b.addEventListener("click", () => {
      page += b.dataset.pg === "next" ? 1 : -1;
      renderTable();
    }));
  }

  // ---- Export CSV ----
  function downloadCsv(filename, content) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }
  const qcsv = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  function exportCsv() {
    const rows = ROWS.map(r => ({
      waktu: fmtDate(r.created_at),
      user: userName(r.user_id),
      aksi: classify(r.action).label,
      target: r.target,
      detail: r.detail,
      ip: r.ip || "",
    }));
    const head = ["waktu", "user", "aksi", "target", "detail", "ip"];
    const lines = [head.join(",")].concat(rows.map(r => head.map(h => qcsv(r[h])).join(",")));
    downloadCsv("audit-log-" + new Date().toISOString().slice(0, 10) + ".csv", lines.join("\n"));
  }

  // ---- init ----
  async function init() {
    // ambil daftar user untuk mapping user_id → nama
    try { USERS = (await authFetch("/users")) || []; } catch (e) { USERS = []; }

    renderKPI();
    refresh();

    document.getElementById("al-search").addEventListener("input", () => { page = 1; refresh(); });
    document.getElementById("al-cat").addEventListener("change", () => { page = 1; refresh(); });
    document.getElementById("al-action").addEventListener("change", () => { page = 1; renderTable(); });
    document.getElementById("al-from").addEventListener("change", () => { page = 1; refresh(); });
    document.getElementById("al-to").addEventListener("change", () => { page = 1; refresh(); });
    document.getElementById("al-reset").addEventListener("click", () => {
      ["al-search", "al-action", "al-from", "al-to"].forEach(id => { document.getElementById(id).value = ""; });
      document.getElementById("al-cat").value = "";
      page = 1;
      refresh();
    });
    document.getElementById("al-export").addEventListener("click", exportCsv);
  }

  async function refresh() {
    const data = await authFetch("/audit?" + buildQuery().toString());
    ROWS = (data && Array.isArray(data.rows)) ? data.rows : [];
    populateActionOptions();
    renderTable();
  }

  init();
})();