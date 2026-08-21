/* ops.js — Mesin bersama untuk modul Operasional:
   Kunjungan Site (visits), Incident Report (incidents), Maintenance (maintenance).
   Data layer: API /api/<kind> (Express+SQLite) dengan fallback localStorage
   bila backend tidak tersedia. Konfigurasi per modul via window.OPS_CONFIG. */

(function () {
  const OPS = window.OPS = window.OPS || {};

  // ---- Data layer (API dulu, fallback localStorage) ----
  const API = (function () {
    try {
      if (location.protocol === "file:") return "http://localhost:3000/api";
    } catch (e) {}
    return "/api";
  })();

  async function api(method, path, body) {
    try {
      const init = { method, headers: {} };
      try {
        const token = localStorage.getItem("rv_auth_token");
        if (token) init.headers["Authorization"] = "Bearer " + token;
      } catch (e) {}
      if (body !== undefined) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      const res = await fetch(API + path, init);
      if (!res.ok) return null;
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      return null;
    }
  }

  const storeKey = k => "ops-" + k;
  function lsLoad(kind) {
    try { return JSON.parse(localStorage.getItem(storeKey(kind)) || "[]"); } catch (e) { return []; }
  }
  function lsSave(kind, rows) {
    try { localStorage.setItem(storeKey(kind), JSON.stringify(rows)); } catch (e) {}
  }

  // ---- Master keys & normalisasi (konsisten dengan js/keys.js canonKey) ----
  // Record OPS menyimpan masterKey, bukan nama tampilan:
  //   site  → site.id ("DC1"), ditampilkan sebagai nama via OPS.siteName().
  //   asset → deviceKey canonical (uppercase) dari registri master device.
  const canonKey = (typeof window !== "undefined" && window.canonKey) || function (name) {
    return String(name == null ? "" : name).trim().toUpperCase().replace(/\s+/g, " ");
  };
  OPS.canonKey = canonKey;

  const FALLBACK_SITES = [];
  // Daftar site = master dari tabel `sites` di SQLite (GET /api/sites), agar
  // site baru (mis. "DC Pugeran") otomatis muncul di picklist OPS tanpa perlu
  // hardcode. Bila backend tidak aktif, list kosong (user harus login & server jalan).
  let SITE_LIST = [];
  const SITE_BY_ID = {};
  const SITE_BY_NAME = {};
  function rebuildSiteMaps() {
    Object.keys(SITE_BY_ID).forEach(k => delete SITE_BY_ID[k]);
    Object.keys(SITE_BY_NAME).forEach(k => delete SITE_BY_NAME[k]);
    SITE_LIST.forEach(s => {
      SITE_BY_ID[s.id] = s.name;
      SITE_BY_NAME[s.name] = s.id;
      SITE_BY_NAME[s.name.replace(/-/g, "—")] = s.id;
    });
  }
  let sitesPromise = null;
  function refreshSites() {
    if (!sitesPromise) {
      sitesPromise = (async () => {
        const rows = await api("GET", "/sites");
        if (Array.isArray(rows) && rows.length) {
          SITE_LIST = rows.filter(s => s.id && s.name).map(s => ({ id: String(s.id).trim().toUpperCase(), name: String(s.name) }));
          rebuildSiteMaps();
        }
      })().catch(() => {});
    }
    return sitesPromise;
  }
  OPS.refreshSites = refreshSites;
  OPS.siteList = function () { return SITE_LIST.slice(); };
  rebuildSiteMaps();
  refreshSites();
  // Migrasi read-time: nilai lama (nama tampilan "DC1 — Cilandak" / "DC1 - Cilandak")
  // dikonversi ke site.id saat load, tanpa menulis ulang DB. Idempoten.
  function siteId(v) {
    if (v == null) return v;
    const s = String(v).trim();
    if (SITE_BY_NAME[s]) return SITE_BY_NAME[s];
    if (SITE_BY_ID[s] !== undefined) return s;
    return v;
  }
  function normalizeSites(rows) {
    return rows.map(r => { if (r && r.site) r.site = siteId(r.site); return r; });
  }
  OPS.siteName = function (v) {
    if (v == null || v === "") return "—";
    return SITE_BY_ID[v] !== undefined ? SITE_BY_ID[v] : String(v);
  };

  // primaryKey baru (opaque, immutable, anti-bentrok) — sama dengan server.js genId().
  function genId(kind) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return kind + "-" + crypto.randomUUID();
    return kind + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  // magicKey `no` (mis. INC-2026-0001): unik per prefix-tahun — dihitung dari
  // nomor terbesar yang ADA, bukan rows.length, agar tidak duplikat saat data
  // lama dihapus (rows.length+1 mengarah ke nomor yang sudah terpakai).
  function nextNo(cfg, rows) {
    const pfx = cfg.prefix + "-" + new Date().getFullYear() + "-";
    let max = 0;
    rows.forEach(r => {
      if (typeof r.no === "string" && r.no.indexOf(pfx) === 0) {
        const n = parseInt(r.no.slice(pfx.length), 10);
        if (!isNaN(n)) max = Math.max(max, n);
      }
    });
    return pfx + String(max + 1).padStart(4, "0");
  }

  // Registri master device (untuk picklist asset): API /api/devices dulu,
  // fallback localStorage rv_servers/rv_switches/rv_accessories. Hasil di-cache.
  // Device sekarang menyimpan site (site.id) & rackId — ditampilkan di picklist
  // supaya user tahu lokasi device saat memilih asset.
  let deviceCache = null;
  OPS.deviceList = async function () {
    if (deviceCache) return deviceCache;
    let out = [];
    const rows = await api("GET", "/devices");
    if (Array.isArray(rows) && rows.length) {
      out = rows.map(d => ({
        deviceKey: d.deviceKey,
        name: d.name || d.deviceKey,
        type: d.type || "",
        site: d.site || "",
        siteName: d.siteName || "",
        rackId: d.rackId || "",
      }));
    } else {
      ["rv_servers", "rv_switches", "rv_accessories"].forEach(k => {
        try {
          const raw = JSON.parse(localStorage.getItem(k) || "[]");
          (Array.isArray(raw) ? raw : []).forEach(d => {
            const key = d.deviceKey || d.name || d.hostname;
            if (key) out.push({ deviceKey: canonKey(key), name: String(key), type: d.type || "" });
          });
        } catch (e) { /* abaikan */ }
      });
    }
    const seen = {};
    out = out.filter(d => {
      const k = canonKey(d.deviceKey || d.name);
      if (!k || seen[k]) return false;
      seen[k] = 1;
      return true;
    });
    out.sort((a, b) => a.name.localeCompare(b.name));
    deviceCache = out;
    return out;
  };

  OPS.load = async function (kind) {
    const rows = await api("GET", "/" + kind);
    if (Array.isArray(rows)) return normalizeSites(rows);
    return normalizeSites(lsLoad(kind));
  };
  OPS.save = async function (kind, rec) {
    const res = await api("POST", "/" + kind, rec);
    if (res && res.ok) return true;
    const rows = lsLoad(kind);
    const i = rows.findIndex(r => r.id === rec.id);
    if (i >= 0) rows[i] = rec; else rows.unshift(rec);
    lsSave(kind, rows);
    return true;
  };
  OPS.remove = async function (kind, id) {
    await api("DELETE", "/" + kind + "/" + encodeURIComponent(id), null);
    const rows = lsLoad(kind).filter(r => r.id !== id);
    lsSave(kind, rows);
  };

  // ---- Lampiran file (PDF) ----
  // Backend: upload file (PDF/image) ke /api/uploads/<kind>/<ref> -> {url,name,size}.
  // Fallback (tanpa server): file kecil disimpan sebagai base64 data-URL.
  OPS.upload = async function (kind, ref, file) {
    try {
      const ct = file.type || "application/pdf";
      const res = await fetch(API + "/uploads/" + kind + "/" + encodeURIComponent(ref) + "?name=" + encodeURIComponent(file.name), {
        method: "POST",
        headers: { "Content-Type": ct },
        body: file,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  };
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
  }

  OPS.fetchAttachments = async function (kind, refId) {
    const data = await api("GET", "/attachments/" + kind + "/" + encodeURIComponent(refId));
    return Array.isArray(data) ? data : [];
  };

  OPS.auditLog = async function (action, target, detail) {
    try {
      await fetch(API + "/audit/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, target, detail })
      });
    } catch (e) { /* abaikan */ }
  };

  // ---- Seed legacy: data sudah di SQLite via server.js ----
  OPS.seed = function () {};

  // ---- Helper render ----
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  OPS.esc = esc;

  OPS.statusBadge = function (status, labels) {
    const label = (labels && labels[status]) || status;
    return '<span class="st st-' + esc(status) + '"><span class="bdot"></span>' + esc(label) + '</span>';
  };
  OPS.sevBadge = function (sev) {
    if (!sev) return "—";
    const map = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
    return '<span class="sev-chip sev-' + esc(sev) + '">' + esc(map[sev] || sev) + '</span>';
  };
  OPS.fmtDate = function (v) {
    if (!v) return "—";
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    return m ? esc(m[1] + " " + m[2]) : esc(v);
  };
  OPS.fmtDateTime = function (v) {
    if (!v) return "—";
    const s = String(v);
    const dm = s.match(/(\d{4}-\d{2}-\d{2})/);
    const tm = s.match(/(\d{2}:\d{2})/);
    const date = dm ? dm[1] : null;
    const time = tm ? tm[1] : "00:00";
    if (!date) return "—";
    return esc(date + " " + time);
  };
  OPS.parseDate = function (v) {
    if (!v) return null;
    const m = String(v).match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  };
  OPS.filterByDateRange = function (rows, dateField, from, to) {
    if (!from && !to) return rows;
    return rows.filter(r => {
      const d = OPS.parseDate(r[dateField]);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  };

  // ---- Workflow (open -> in_progress -> resolved/closed) ----
  OPS.nextStatus = function (cfg, status) {
    const flow = cfg.statusFlow || [];
    const i = flow.indexOf(status);
    if (i < 0 || i >= flow.length - 1) return null;
    return flow[i + 1];
  };

  OPS.nextStatuses = function (cfg, status) {
    const flow = cfg.statusFlow || [];
    const transitions = cfg.statusTransitions || {};
    const result = [];
    const i = flow.indexOf(status);
    if (i >= 0 && i < flow.length - 1) {
      result.push(flow[i + 1]);
    }
    Object.keys(transitions).forEach(k => {
      const parts = k.split(" -> ");
      if (parts[0] === status && !result.includes(parts[1])) {
        result.push(parts[1]);
      }
    });
    return result;
  };

  // ---- Rendering halaman (dipanggil setelah DOM siap) ----
  OPS.render = async function (cfg) {
    await refreshSites();
    const root = document.getElementById("ops-root");
    if (!root) return;
    root.innerHTML =
      '<div class="tabs" id="ops-tabs"></div>' +
      '<div class="ops-summary" id="ops-summary"></div>' +
      '<div class="ops-toolbar">' +
        '<select class="form-input" id="ops-filter" style="width:auto;"><option value="all">Semua Status</option></select>' +
        '<select class="form-input" id="ops-assignee" style="width:auto;"><option value="all">Semua Assignee</option></select>' +
        '<select class="form-input" id="ops-transition-filter" style="width:auto;"><option value="all">Semua Transisi</option></select>' +
        '<input class="form-input" id="ops-date-from" type="date" style="width:auto;" placeholder="Dari">' +
        '<span style="color:var(--text-muted);padding:0 4px;">—</span>' +
        '<input class="form-input" id="ops-date-to" type="date" style="width:auto;" placeholder="Sampai">' +
        '<span style="color:var(--text-muted);padding:0 4px;font-size:11px;">Transisi:</span>' +
        '<input class="form-input" id="ops-trans-date-from" type="date" style="width:auto;" placeholder="Dari">' +
        '<span style="color:var(--text-muted);padding:0 4px;">—</span>' +
        '<input class="form-input" id="ops-trans-date-to" type="date" style="width:auto;" placeholder="Sampai">' +
        '<input class="form-input" id="ops-search" type="text" placeholder="Cari…" style="width:220px;">' +
        '<span class="spacer"></span>' +
        '<button class="btn ghost" id="ops-export" title="Export CSV"><i class="fa-solid fa-download"></i></button>' +
        '<button class="btn ghost" id="ops-export-history" title="Export History Transisi"><i class="fa-solid fa-clock-rotate-left"></i></button>' +
        '<button class="btn ghost" id="ops-print" title="Print"><i class="fa-solid fa-print"></i></button>' +
        '<button class="btn primary" id="ops-add"><i class="fa-solid fa-plus"></i> Tambah</button>' +
      '</div>' +
      '<div class="card" style="overflow:visible;"><table><thead><tr id="ops-thead"></tr></thead><tbody id="ops-tbody"></tbody></table></div>' +
      '<div id="ops-toast-container" style="position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;"></div>';

    let rows = await OPS.load(cfg.kind);
    if (!rows.length) { OPS.seed(cfg.kind); rows = await OPS.load(cfg.kind); }

    const elTabs = document.getElementById("ops-tabs");
    const elSummary = document.getElementById("ops-summary");
    const elFilter = document.getElementById("ops-filter");
    const elSearch = document.getElementById("ops-search");
    const elThead = document.getElementById("ops-thead");
    const elTbody = document.getElementById("ops-tbody");
    let activeTab = cfg.tabs[0].id;
    let filterStatus = "all";
    let q = "";
    let dateFrom = "";
    let dateTo = "";
    let filterAssignee = "all";
    let filterTransition = "all";
    let transDateFrom = "";
    let transDateTo = "";
    const elDateFrom = document.getElementById("ops-date-from");
    const elDateTo = document.getElementById("ops-date-to");
    const elAssignee = document.getElementById("ops-assignee");
    const elTransitionFilter = document.getElementById("ops-transition-filter");
    const elTransDateFrom = document.getElementById("ops-trans-date-from");
    const elTransDateTo = document.getElementById("ops-trans-date-to");

    // Populate assignee options dinamis dari data (hanya once)
    const assignees = Array.from(new Set(rows.map(r => (r.assignee || "").trim()).filter(Boolean))).sort();
    if (elAssignee && assignees.length) {
      assignees.forEach(a => {
        const o = document.createElement("option");
        o.value = a; o.textContent = a; elAssignee.appendChild(o);
      });
    }

    // Populate transition filter options dari statusFlow
    if (elTransitionFilter && cfg.statusFlow && cfg.statusFlow.length) {
      const flow = cfg.statusFlow;
      const labels = cfg.statusLabels || {};
      const allHistStatuses = new Set();
      rows.forEach(r => {
        const hist = r.status_history || [];
        hist.forEach(h => {
          if (h.from) allHistStatuses.add(h.from);
          if (h.to) allHistStatuses.add(h.to);
        });
      });
      const uniqueStatuses = Array.from(allHistStatuses).sort();
      uniqueStatuses.forEach(s => {
        const o = document.createElement("option");
        o.value = "hist:" + s;
        o.textContent = "Pernah " + (labels[s] || s);
        elTransitionFilter.appendChild(o);
      });
      flow.forEach((s, i) => {
        if (i > 0) {
          const from = flow[i - 1];
          const to = s;
          const o = document.createElement("option");
          o.value = "trans:" + from + "->" + to;
          o.textContent = (labels[from] || from) + " → " + (labels[to] || to);
          elTransitionFilter.appendChild(o);
        }
      });
      const createdOpt = document.createElement("option");
      createdOpt.value = "created";
      createdOpt.textContent = "Dibuat (Record Baru)";
      elTransitionFilter.appendChild(createdOpt);
      const todayOpt = document.createElement("option");
      todayOpt.value = "today";
      todayOpt.textContent = "Transisi Hari Ini";
      elTransitionFilter.appendChild(todayOpt);
    }

    cfg.statusLabels = cfg.statusLabels || {};

    // Status efektif: modul boleh menurunkan status tampilan tanpa mengubah data
    // (mis. jadwal maintenance yang lewat tanggal otomatis dianggap "overdue").
    function effStatus(r) {
      if (cfg.deriveStatus) {
        const s = cfg.deriveStatus(r);
        if (s) return s;
      }
      return r.status;
    }
    function view(r) { return Object.assign({}, r, { status: effStatus(r) }); }

    function isToday(dateStr) {
      if (!dateStr) return false;
      const m = String(dateStr).match(/(\d{4}-\d{2}-\d{2})/);
      if (!m) return false;
      const d = new Date(m[1] + "T00:00:00");
      if (isNaN(d.getTime())) return false;
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    function hasTransitionToday(r) {
      const hist = r.status_history || [];
      return hist.some(h => isToday(h.at));
    }

    function drawTabs() {
      elTabs.innerHTML = cfg.tabs.map(t => {
        const n = rows.filter(r => !t.filter || t.filter.indexOf(effStatus(r)) >= 0).length;
        return '<button class="tab-btn' + (t.id === activeTab ? " active" : "") + '" data-tab="' + t.id + '">' +
          (t.icon ? '<i class="fa-solid ' + t.icon + '"></i>' : "") + '<span>' + t.label + '</span>' +
          '<span class="tab-count">' + n + '</span></button>';
      }).join("");
      elTabs.querySelectorAll(".tab-btn").forEach(b => {
        b.addEventListener("click", () => { activeTab = b.dataset.tab; filterStatus = "all"; drawTabs(); drawFilter(); drawSummary(); drawTable(); });
      });
    }

    function drawSummary() {
      const tab = cfg.tabs.find(t => t.id === activeTab);
      const pool = rows.map(view).filter(r => !tab.filter || tab.filter.indexOf(r.status) >= 0);
      let items = (tab.summary || []).map(s => {
        const n = pool.filter(r => !s.match || s.match(r)).length;
        return '<div class="ops-stat"><div class="ops-stat-label">' + esc(s.label) + '</div><div class="ops-stat-value">' + n + '</div></div>';
      }).join("");
      const todayCount = pool.filter(r => hasTransitionToday(r)).length;
      if (todayCount > 0) {
        items += '<div class="ops-stat ops-stat-trans-today"><div class="ops-stat-label">Transisi Hari Ini</div><div class="ops-stat-value">' + todayCount + '</div></div>';
      }
      elSummary.innerHTML = items;
    }

    function matches(r) {
      if (filterStatus !== "all" && effStatus(r) !== filterStatus) return false;
      if (filterAssignee !== "all" && (r.assignee || "") !== filterAssignee) return false;
      if (filterTransition !== "all") {
        const hist = r.status_history || [];
        if (filterTransition.indexOf("hist:") === 0) {
          const targetStatus = filterTransition.slice(5);
          const ever = hist.some(h => h.from === targetStatus || h.to === targetStatus);
          if (!ever) return false;
        } else if (filterTransition.indexOf("trans:") === 0) {
          const parts = filterTransition.slice(6).split("->");
          if (parts.length !== 2) return false;
          const [from, to] = parts;
          const found = hist.some(h => h.from === from && h.to === to);
          if (!found) return false;
        } else if (filterTransition === "created") {
          const hasCreated = hist.some(h => h.from === null);
          if (!hasCreated) return false;
        } else if (filterTransition === "today") {
          const todayTrans = hist.some(h => isToday(h.at));
          if (!todayTrans) return false;
        }
      }
      if (transDateFrom || transDateTo) {
        const hist = r.status_history || [];
        if (transDateFrom || transDateTo) {
          const hasMatch = hist.some(h => {
            const d = OPS.parseDate(h.at);
            if (!d) return false;
            if (transDateFrom && d < transDateFrom) return false;
            if (transDateTo && d > transDateTo) return false;
            return true;
          });
          if (!hasMatch) return false;
        }
      }
      const dateField = cfg.dateField || "created_at";
      if (dateFrom || dateTo) {
        const d = OPS.parseDate(r[dateField]);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      if (!q) return true;
      const hay = cfg.columns.map(c => r[c.key] || "").join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    }

    function drawFilter() {
      const tab = cfg.tabs.find(t => t.id === activeTab);
      const opts = ["all"].concat(tab.filter || []);
      elFilter.innerHTML = opts.map(s => '<option value="' + s + '">' + (s === "all" ? "Semua Status" : (cfg.statusLabels[s] || s)) + '</option>').join("");
      if (opts.indexOf(filterStatus) < 0) filterStatus = "all";
      elFilter.value = filterStatus;
    }

    function drawTable() {
      const tab = cfg.tabs.find(t => t.id === activeTab);
      elThead.innerHTML = cfg.columns.map(c => "<th>" + esc(c.label) + "</th>").join("") + "<th></th>";
      const pool = rows.map(view).filter(r => (!tab.filter || tab.filter.indexOf(r.status) >= 0) && matches(r));
      if (!pool.length) {
        elTbody.innerHTML = '<tr><td colspan="' + (cfg.columns.length + 1) + '" style="color:var(--text-muted);padding:16px;">Tidak ada data.</td></tr>';
        return;
      }
      elTbody.innerHTML = pool.map(r => {
        const tds = cfg.columns.map(c => {
          const html = c.render ? c.render(r, OPS) : esc(r[c.key] || "—");
          return "<td" + (c.mono ? ' class="mono"' : "") + ">" + html + "</td>";
        }).join("");
        const nextOptions = OPS.nextStatuses(cfg, r.status);
        const hist = r.status_history || [];
        const historyTooltip = hist.map(h => h.at + " (" + h.by + "): " + (h.from || "") + " → " + (h.to || "") + (h.note ? " - " + h.note : "")).join("\n") || "Tidak ada history";
        let nextBtn = "";
        if (nextOptions.length === 1) {
          nextBtn = '<div class="ops-next-wrap">' +
            '<button title="Transisi / Edit" data-act="next-menu" data-id="' + esc(r.id) + '"><i class="fa-solid fa-chevron-right"></i></button>' +
            '<div class="ops-next-menu hidden" id="next-menu-' + esc(r.id) + '">' +
            '<button data-act="next" data-target="' + esc(nextOptions[0]) + '" data-id="' + esc(r.id) + '">' + esc(cfg.statusLabels[nextOptions[0]] || nextOptions[0]) + '</button>' +
            '<button data-act="edit" data-id="' + esc(r.id) + '"><i class="fa-solid fa-pen" style="margin-right:4px;"></i>Edit Data</button>' +
            '</div></div>';
        } else if (nextOptions.length > 1) {
          nextBtn = '<div class="ops-next-wrap">' +
            '<button title="Transisi / Edit" data-act="next-menu" data-id="' + esc(r.id) + '"><i class="fa-solid fa-chevron-right"></i></button>' +
            '<div class="ops-next-menu hidden" id="next-menu-' + esc(r.id) + '">' +
            nextOptions.map(ns => '<button data-act="next" data-target="' + esc(ns) + '" data-id="' + esc(r.id) + '">' + esc(cfg.statusLabels[ns] || ns) + '</button>').join("") +
            '<button data-act="edit" data-id="' + esc(r.id) + '"><i class="fa-solid fa-pen" style="margin-right:4px;"></i>Edit Data</button>' +
            '</div></div>';
        } else {
          nextBtn = '<div class="ops-next-wrap">' +
            '<button title="Edit Data" data-act="next-menu" data-id="' + esc(r.id) + '"><i class="fa-solid fa-chevron-right"></i></button>' +
            '<div class="ops-next-menu hidden" id="next-menu-' + esc(r.id) + '">' +
            '<button data-act="edit" data-id="' + esc(r.id) + '"><i class="fa-solid fa-pen" style="margin-right:4px;"></i>Edit Data</button>' +
            '</div></div>';
        }
         const actions =
          '<div class="row-actions">' +
          '<button title="Lihat Detail" data-act="detail" data-id="' + esc(r.id) + '"><i class="fa-solid fa-eye"></i></button>' +
          '<button title="History Transisi" data-act="history" data-id="' + esc(r.id) + '"><i class="fa-solid fa-clock-rotate-left"></i></button>' +
          nextBtn +
          '<button title="Hapus" class="danger" data-act="del" data-id="' + esc(r.id) + '"><i class="fa-solid fa-trash"></i></button>' +
          '</div>';
        const rowClass = hasTransitionToday(r) ? ' class="ops-row-trans-today"' : "";
        return "<tr" + rowClass + ">" + tds + "<td>" + actions + "</td></tr>";
      }).join("");
      elTbody.querySelectorAll("button[data-act]").forEach(b => {
        b.addEventListener("click", async () => {
          const id = b.dataset.id;
          if (b.dataset.act === "detail") {
            const rec = rows.find(r => r.id === id);
            if (rec) showDetailModal(cfg, rec);
            return;
          } else if (b.dataset.act === "edit") {
            const rec = rows.find(r => r.id === id);
            if (rec) openForm(rec);
            return;
          } else if (b.dataset.act === "history") {
            const rec = rows.find(r => r.id === id);
            if (!rec) return;
            historyRec = rec;
            const hist = rec.status_history || [];
            const historyOverlay = document.getElementById("ops-history-overlay");
            const historyContent = document.getElementById("ops-history-content");
            const historySub = document.getElementById("ops-history-sub");
            if (!historyOverlay || !historyContent) return;
            historySub.textContent = (rec.no || rec.id || "") + " — " + (rec.title || rec.tujuan || "");
            if (!hist.length) {
              historyContent.innerHTML = '<div style="color:var(--text-muted);padding:16px;">Belum ada history transisi untuk record ini.</div>';
            } else {
              historyContent.innerHTML = hist.map((h, idx) => {
                const when = h.at || "—";
                const who = h.by || "anon";
                const isCreated = h.from === null && idx === 0;
                const from = isCreated ? null : (h.from || rec.status);
                const to = h.to || rec.status;
                const isEdit = h.from === h.to && h.from !== null && h.edited_fields;
                const badge = isCreated
                  ? '<span style="display:inline-block;background:var(--accent,#4f8cff);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Dibuat</span>'
                  : isEdit
                  ? '<span style="display:inline-block;background:var(--warning,#f59e0b);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Edit Data</span>'
                  : (cfg.statusLabels[from] || from) + ' <i class="fa-solid fa-arrow-right" style="margin:0 6px;font-size:10px;"></i> ' + (cfg.statusLabels[to] || to);
                const note = h.note && h.note !== "Record dibuat" ? '<div style="margin-top:4px;color:var(--text-muted);font-size:12px;">Catatan: ' + esc(h.note) + '</div>' : "";
                const fields = h.fields && Object.keys(h.fields).length ? '<div style="margin-top:4px;font-size:12px;">Data: ' + Object.entries(h.fields).map(([k, v]) => '<span style="display:inline-block;background:var(--bg-surface-2,#232733);padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;">' + esc(k) + ' = ' + esc(v) + '</span>').join("") + '</div>' : "";
                const editedFields = h.edited_fields && Object.keys(h.edited_fields).length ? '<div style="margin-top:4px;font-size:12px;">Perubahan: ' + Object.entries(h.edited_fields).map(([k, v]) => '<span style="display:inline-block;background:var(--bg-surface-2,#232733);padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;">' + esc(k) + ' → ' + esc(v) + '</span>').join("") + '</div>' : "";
                const atts = h.attachments && h.attachments.length ? '<div style="margin-top:6px;font-size:12px;">Lampiran: ' + h.attachments.map(a => '<a href="' + esc(a.url) + '" target="_blank" style="display:inline-block;background:var(--bg-surface-2,#232733);padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;color:var(--accent,#4f8cff);text-decoration:none;"><i class="fa-solid fa-paperclip" style="margin-right:4px;"></i>' + esc(a.name) + '</a>').join("") + '</div>' : "";
                return '<div style="padding:12px;border-bottom:1px solid var(--border,#2a2f3a);">' +
                  '<div style="font-weight:600;color:var(--text-primary,#e8ecf2);">' + badge + '</div>' +
                  '<div style="font-size:12px;color:var(--text-muted,#9aa4b2);margin-top:4px;">' + esc(when) + ' · ' + esc(who) + '</div>' +
                  note + fields + editedFields + atts +
                '</div>';
              }).join("");
            }
            historyOverlay.style.display = "flex";
            return;
          }
          if (b.dataset.act === "next-menu") {
            const menuId = "next-menu-" + id;
            const menu = document.getElementById(menuId);
            if (menu) {
              document.querySelectorAll(".ops-next-menu:not(.hidden)").forEach(m => { if (m !== menu) m.classList.add("hidden"); });
              menu.classList.toggle("hidden");
            }
            return;
          }
          if (b.dataset.act === "next" || b.dataset.act === "edit") {
            document.querySelectorAll(".ops-next-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
          }
          if (b.dataset.act === "next") {
            const rec = rows.find(r => r.id === id);
            const target = b.dataset.target;
            if (rec && target) { showTransitionModal(cfg, rec, target); }
          } else if (b.dataset.act === "del") {
            const rec = rows.find(r => r.id === id);
            if (!rec) return;
            if (!confirm("Hapus catatan \"" + (rec.no || rec.id) + "\"?")) return;
            if (!confirm("Yakin ingin menghapus permanen? Data yang dihapus tidak dapat dikembalikan.")) return;
            OPS.auditLog("ops.delete", cfg.kind + ":" + (rec.no || rec.id), "Dihapus oleh user");
            await OPS.remove(cfg.kind, id);
            rows = await OPS.load(cfg.kind);
            redraw();
            showToast("Catatan " + (rec.no || id) + " berhasil dihapus.", "success");
          }
        });
      });
    }

    function redraw() { drawTabs(); drawFilter(); drawSummary(); drawTable(); }

    // ---- Transition modal with validation + status_history ----
    const transOverlay = document.getElementById("ops-transition-overlay");
    const transTitle = document.getElementById("ops-transition-title");
    const transSub = document.getElementById("ops-transition-sub");
    const transGrid = document.getElementById("ops-transition-grid");
    const transBtnText = document.getElementById("ops-transition-btn-text");
    let transRec = null;
    let transNext = null;
    let historyRec = null;

    function showTransitionModal(cfg, rec, nextStatus) {
      transRec = rec;
      transNext = nextStatus;
      const flow = cfg.statusFlow || [];
      const fromIdx = flow.indexOf(rec.status);
      const toIdx = flow.indexOf(nextStatus);
      const fromLabel = cfg.statusLabels[rec.status] || rec.status;
      const toLabel = cfg.statusLabels[nextStatus] || nextStatus;
      transTitle.textContent = "Ubah Status: " + fromLabel + " → " + toLabel;
      transSub.textContent = cfg.pageTitle || cfg.kind || "";

      const transConfig = cfg.statusTransitions || {};
      const key = rec.status + " -> " + nextStatus;
      const rule = transConfig[key] || { fields: [], note: "Ubah status" };
      transBtnText.textContent = toLabel;

      // Record summary (read-only)
      const summaryCols = cfg.columns.filter(c => c.key !== "status");
      let summaryHtml = '<div class="trans-summary">';
      summaryHtml += '<div class="trans-summary-header">Ringkasan Record</div>';
      summaryCols.forEach(c => {
        const val = rec[c.key] || "—";
        const display = c.render ? c.render(rec, OPS) : esc(val);
        summaryHtml += '<div class="trans-summary-row"><span class="trans-summary-label">' + esc(c.label) + '</span><span class="trans-summary-value">' + display + '</span></div>';
      });
      summaryHtml += '</div><hr style="margin:12px 0;border:none;border-top:1px solid var(--border,#e5e7eb);">';

      const fields = (rule.fields || []).map(f => {
        const def = cfg.formFields.find(ff => ff.key === f);
        const val = rec[f] || "";
        if (!def) return '<div class="full"><label class="form-label">' + esc(f) + '</label><input class="form-input" data-tf="' + esc(f) + '" value="' + esc(val) + '" required></div>';
        if (def.type === "select") {
          const opts = (def.options || []).map(o => '<option value="' + esc(o.value) + '"' + (val === o.value ? " selected" : "") + '>' + esc(o.label) + '</option>').join("");
          return '<div class="full"><label class="form-label">' + esc(def.label) + '</label><select class="form-input" data-tf="' + esc(f) + '" required><option value="">— Pilih —</option>' + opts + '</select></div>';
        }
        return '<div class="full"><label class="form-label">' + esc(def.label) + '</label><input class="form-input" type="' + (def.type || "text") + '" data-tf="' + esc(f) + '" value="' + esc(val) + '" required></div>';
      }).join("");

      const noteRequired = rule.noteRequired ? ' <span style="color:var(--danger,#f4574d);">*</span>' : '';
      transGrid.innerHTML = summaryHtml + fields +
        '<div class="full"><label class="form-label">Catatan Transisi' + noteRequired + '</label><textarea class="form-input" data-tf="trans_note" rows="2" placeholder="' + (rule.noteRequired ? 'Wajib diisi' : 'Catatan tambahan (opsional)') + '"' + (rule.noteRequired ? ' required' : '') + '></textarea></div>' +
        '<div class="full"><label class="form-label">Lampiran (PDF/Gambar)</label><input class="form-input" type="file" data-tf="trans_attach" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"><div class="form-hint">Bisa pilih beberapa file sekaligus (PDF, JPG, PNG, WEBP)</div></div>';
      transOverlay.style.display = "flex";
      const firstInput = transGrid.querySelector("[required]");
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }

    function closeTransition() { transOverlay.style.display = "none"; transRec = null; transNext = null; }

    document.getElementById("ops-transition-close").addEventListener("click", closeTransition);
    document.getElementById("ops-transition-cancel").addEventListener("click", closeTransition);
    document.getElementById("ops-transition-edit").addEventListener("click", () => {
      if (!transRec) return;
      const rec = transRec;
      closeTransition();
      openForm(rec);
    });
    transOverlay.addEventListener("click", e => { if (e.target === transOverlay) closeTransition(); });

    function closeHistory() { const el = document.getElementById("ops-history-overlay"); if (el) el.style.display = "none"; historyRec = null; }
    const historyCloseBtn = document.getElementById("ops-history-close");
    const historyCloseBtn2 = document.getElementById("ops-history-close-btn");
    const historyOverlay = document.getElementById("ops-history-overlay");
    if (historyCloseBtn) historyCloseBtn.addEventListener("click", closeHistory);
    if (historyCloseBtn2) historyCloseBtn2.addEventListener("click", closeHistory);
    if (historyOverlay) historyOverlay.addEventListener("click", e => { if (e.target === historyOverlay) closeHistory(); });
    const historyPrintBtn = document.getElementById("ops-history-print-btn");
    if (historyPrintBtn) historyPrintBtn.addEventListener("click", () => {
      const rec = historyRec;
      if (!rec) { alert("Tidak ada data untuk print."); return; }
      printHistory(rec);
    });

    function printHistory(rec) {
      if (!rec && historyRec) rec = historyRec;
      if (!rec) { alert("Tidak ada data untuk print."); return; }
      const hist = rec.status_history || [];
      const companyName = (typeof BRAND !== "undefined" && BRAND.companyName) ? BRAND.companyName : "RackView";
      let logoUrl = (typeof BRAND !== "undefined" && BRAND.logoUrl) ? BRAND.logoUrl : "";
      const logoText = (typeof BRAND !== "undefined" && BRAND.logoSmallText) ? BRAND.logoSmallText : "RV";
      if (logoUrl && logoUrl.indexOf("http") !== 0) {
        const origin = (window && window.location && window.location.origin) ? window.location.origin : "";
        logoUrl = origin + logoUrl;
      }
      const win = window.open("", "_blank", "width=800,height=600");
      if (!win) { alert("Popup diblokir. Izinkan popup untuk print."); return; }
      const logoHtml = logoUrl ? '<img src="' + esc(logoUrl) + '" style="width:48px;height:48px;object-fit:contain;border-radius:10px;">' : '<div class="logo">' + esc(logoText) + '</div>';
      const html = '<!DOCTYPE html><html><head><title>History Transisi - ' + esc(rec.no || rec.id || "") + '</title>' +
        '<style>' +
        '@page { size: A4; margin: 20mm; }' +
        'body { font-family: "IBM Plex Sans", sans-serif; color: #1c2632; padding: 24px; }' +
        '.header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1c2632; }' +
        '.logo { width: 48px; height: 48px; border-radius: 10px; background: #1c2632; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }' +
        '.company { font-size: 20px; font-weight: 700; }' +
        '.title { font-size: 14px; color: #6b7280; margin-top: 2px; }' +
        '.record-info { margin-bottom: 20px; padding: 12px; background: #f3f4f6; border-radius: 8px; }' +
        '.record-info div { margin: 4px 0; font-size: 13px; }' +
        '.record-info .label { font-weight: 600; color: #374151; }' +
        '.history-item { padding: 14px 0; border-bottom: 1px solid #e5e7eb; }' +
        '.history-item:last-child { border-bottom: none; }' +
        '.history-transition { font-size: 16px; font-weight: 600; color: #1c2632; }' +
        '.history-meta { font-size: 12px; color: #6b7280; margin-top: 4px; }' +
        '.history-note { margin-top: 6px; font-size: 13px; color: #4b5563; padding: 8px; background: #f9fafb; border-radius: 6px; }' +
        '.history-fields { margin-top: 8px; }' +
        '.history-field { display: inline-block; background: #e5e7eb; padding: 3px 10px; border-radius: 4px; margin: 3px 6px 3px 0; font-size: 12px; font-weight: 500; }' +
        '.history-attach { margin-top: 6px; font-size: 12px; }' +
        '.history-attach a { display: inline-block; background: #e0e7ff; padding: 3px 10px; border-radius: 4px; margin: 3px 6px 3px 0; color: #3730a3; text-decoration: none; }' +
        '.footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }' +
        '</style></head><body>' +
        '<div class="header">' + logoHtml + '<div><div class="company">' + esc(companyName) + '</div><div class="title">History Transisi Status</div></div></div>' +
        '<div class="record-info">' +
        '<div><span class="label">No:</span> ' + esc(rec.no || rec.id || "") + '</div>' +
        '<div><span class="label">Judul:</span> ' + esc(rec.title || rec.tujuan || "") + '</div>' +
        '<div><span class="label">Status Saat Ini:</span> ' + esc(rec.status || "") + '</div>' +
        '<div><span class="label">Dicetak:</span> ' + new Date().toLocaleString("id-ID") + '</div>' +
        '</div>' +
        hist.map((h, idx) => {
          const isCreated = h.from === null && idx === 0;
          const isEdit = h.from === h.to && h.from !== null && h.edited_fields;
          const from = isCreated ? null : (h.from || rec.status);
          const to = h.to || rec.status;
          const transitionHtml = isCreated
            ? '<span style="display:inline-block;background:#4f8cff;color:#fff;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:600;">Dibuat</span>'
            : isEdit
            ? '<span style="display:inline-block;background:#f59e0b;color:#fff;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:600;">Edit Data</span>'
            : esc(cfg.statusLabels[from] || from) + ' <i class="fa-solid fa-arrow-right" style="margin:0 8px;font-size:12px;"></i> ' + esc(cfg.statusLabels[to] || to);
          const note = h.note && h.note !== "Record dibuat" ? '<div class="history-note"><strong>Catatan:</strong> ' + esc(h.note) + '</div>' : "";
          const fields = h.fields && Object.keys(h.fields).length ? '<div class="history-fields">' + Object.entries(h.fields).map(([k, v]) => '<span class="history-field">' + esc(k) + ' = ' + esc(v) + '</span>').join("") + '</div>' : "";
          const editedFields = h.edited_fields && Object.keys(h.edited_fields).length ? '<div class="history-fields" style="border-left:3px solid #f59e0b;padding-left:8px;margin-top:6px;"><strong>Perubahan:</strong> ' + Object.entries(h.edited_fields).map(([k, v]) => '<span class="history-field" style="background:#fef3c7;">' + esc(k) + ' → ' + esc(v) + '</span>').join("") + '</div>' : "";
          const atts = h.attachments && h.attachments.length ? '<div class="history-attach"><strong>Lampiran:</strong> ' + h.attachments.map(a => '<a href="' + esc(a.url) + '" target="_blank">' + esc(a.name) + '</a>').join("") + '</div>' : "";
          return '<div class="history-item">' +
            '<div class="history-transition">' + transitionHtml + '</div>' +
            '<div class="history-meta">' + esc(h.at || "—") + ' · ' + esc(h.by || "anon") + '</div>' +
            note + fields + editedFields + atts +
          '</div>';
        }).join("") +
        '<div class="footer">Dicetak dari ' + esc(companyName) + ' · ' + new Date().toLocaleDateString("id-ID") + '</div>' +
        '</body></html>';
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    }

    function showToast(message, type) {
      type = type || "success";
      const container = document.getElementById("ops-toast-container");
      if (!container) return;
      const toast = document.createElement("div");
      toast.style.cssText = "padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;color:#fff;min-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.25);animation:ops-toast-in .25s ease-out;";
      if (type === "success") toast.style.background = "var(--success, #3fca8c)";
      else if (type === "error") toast.style.background = "var(--danger, #f4574d)";
      else toast.style.background = "var(--accent, #4f8cff)";
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity .3s";
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
      }, 3000);
    }

    // ---- Detail View Modal ----
    let detailRec = null;
    function showDetailModal(cfg2, rec) {
      detailRec = rec;
      const overlay = document.getElementById("ops-detail-overlay");
      const title = document.getElementById("ops-detail-title");
      const sub = document.getElementById("ops-detail-sub");
      const body = document.getElementById("ops-detail-body");
      if (!overlay || !body) return;

      title.textContent = "Detail " + (cfg2.pageTitle || cfg2.kind);
      sub.textContent = (rec.no || rec.id || "");

      let html = '<div class="detail-section">';
      html += '<div class="detail-section-title">Data Record</div>';
      cfg2.columns.forEach(c => {
        const val = rec[c.key];
        const display = c.render ? c.render(rec, OPS) : esc(val || "—");
        html += '<div class="detail-row"><span class="detail-label">' + esc(c.label) + '</span><span class="detail-value">' + display + '</span></div>';
      });
      if (rec.created_at) {
        html += '<div class="detail-row"><span class="detail-label">Dibuat</span><span class="detail-value">' + esc(rec.created_at) + (rec.created_by ? ' oleh ' + esc(rec.created_by) : '') + '</span></div>';
      }
      html += '</div>';

      const hist = rec.status_history || [];
      if (hist.length) {
        html += '<div class="detail-section">';
        html += '<div class="detail-section-title">History Transisi (' + hist.length + ')</div>';
        hist.forEach((h, idx) => {
          const isCreated = h.from === null && idx === 0;
          const isEdit = h.from === h.to && h.from !== null && h.edited_fields;
          const atts = h.attachments && h.attachments.length ? '<div class="detail-attach">' + h.attachments.map(a => '<a href="' + esc(a.url) + '" target="_blank"><i class="fa-solid fa-paperclip"></i> ' + esc(a.name) + '</a>').join("") + '</div>' : "";
          const transitionHtml = isCreated
            ? '<span style="display:inline-block;background:var(--accent,#4f8cff);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Dibuat</span>'
            : isEdit
            ? '<span style="display:inline-block;background:var(--warning,#f59e0b);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Edit Data</span>'
            : esc(cfg2.statusLabels[h.from] || h.from || "—") + ' <i class="fa-solid fa-arrow-right" style="margin:0 6px;font-size:10px;"></i> ' + esc(cfg2.statusLabels[h.to] || h.to || "—");
          const editedFields = h.edited_fields && Object.keys(h.edited_fields).length ? '<div class="detail-history-note" style="background:#fef3c7;border-left:3px solid #f59e0b;">Perubahan: ' + Object.entries(h.edited_fields).map(([k, v]) => '<span class="detail-attach-item">' + esc(k) + ' → ' + esc(v) + '</span>').join("") + '</div>' : "";
          html += '<div class="detail-history-item">' +
            '<div class="detail-history-transition">' + transitionHtml + '</div>' +
            '<div class="detail-history-meta">' + esc(h.at || "—") + ' · ' + esc(h.by || "anon") + '</div>' +
            (h.note && h.note !== "Record dibuat" ? '<div class="detail-history-note">Catatan: ' + esc(h.note) + '</div>' : "") +
            editedFields + atts +
          '</div>';
        });
        html += '</div>';
      }

      body.innerHTML = html;
      overlay.style.display = "flex";
    }

    function closeDetail() {
      const el = document.getElementById("ops-detail-overlay");
      if (el) el.style.display = "none";
      detailRec = null;
    }

    const detailCloseBtn = document.getElementById("ops-detail-close");
    const detailCloseBtn2 = document.getElementById("ops-detail-close-btn");
    const detailOverlay = document.getElementById("ops-detail-overlay");
    if (detailCloseBtn) detailCloseBtn.addEventListener("click", closeDetail);
    if (detailCloseBtn2) detailCloseBtn2.addEventListener("click", closeDetail);
    if (detailOverlay) detailOverlay.addEventListener("click", e => { if (e.target === detailOverlay) closeDetail(); });

    const detailPrintBtn = document.getElementById("ops-detail-print-btn");
    if (detailPrintBtn) detailPrintBtn.addEventListener("click", () => {
      if (!detailRec) return;
      printDetail(cfg, detailRec);
    });

    function printDetail(cfg2, rec) {
      if (!rec) return;
      const companyName = (typeof BRAND !== "undefined" && BRAND.companyName) ? BRAND.companyName : "RackView";
      let logoUrl = (typeof BRAND !== "undefined" && BRAND.logoUrl) ? BRAND.logoUrl : "";
      const logoText = (typeof BRAND !== "undefined" && BRAND.logoSmallText) ? BRAND.logoSmallText : "RV";
      if (logoUrl && logoUrl.indexOf("http") !== 0) {
        const origin = (window && window.location && window.location.origin) ? window.location.origin : "";
        logoUrl = origin + logoUrl;
      }
      const logoHtml = logoUrl ? '<img src="' + esc(logoUrl) + '" style="width:48px;height:48px;object-fit:contain;border-radius:10px;">' : '<div class="logo">' + esc(logoText) + '</div>';

      let rows = "";
      cfg2.columns.forEach(c => {
        const val = rec[c.key];
        const display = c.render ? c.render(rec, OPS) : esc(val || "—");
        rows += '<tr><td style="font-weight:600;width:35%;background:#f3f4f6;">' + esc(c.label) + '</td><td>' + display + '</td></tr>';
      });
      if (rec.created_at) rows += '<tr><td style="font-weight:600;background:#f3f4f6;">Dibuat</td><td>' + esc(rec.created_at) + (rec.created_by ? ' oleh ' + esc(rec.created_by) : '') + '</td></tr>';

      const hist = rec.status_history || [];
      let histRows = "";
      if (hist.length) {
        histRows = '<div style="margin-top:24px;"><h3 style="font-size:16px;margin-bottom:12px;">History Transisi</h3>' +
          '<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left;">Dari</th><th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left;">Ke</th><th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left;">Waktu</th><th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left;">Oleh</th><th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left;">Catatan</th></tr></thead><tbody>';
        hist.forEach((h, idx) => {
          const isCreated = h.from === null && idx === 0;
          const isEdit = h.from === h.to && h.from !== null && h.edited_fields;
          const atts = h.attachments && h.attachments.length ? '<br><span style="font-size:11px;color:#6b7280;">Lampiran: ' + h.attachments.map(a => a.name).join(", ") + '</span>' : "";
          const editedFields = h.edited_fields && Object.keys(h.edited_fields).length ? '<br><span style="font-size:11px;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:3px;">Perubahan: ' + Object.entries(h.edited_fields).map(([k, v]) => k + " → " + v).join(", ") + '</span>' : "";
          const fromCell = isCreated ? '<em style="color:#4f8cff;">(Dibuat)</em>' : isEdit ? '<em style="color:#f59e0b;">(Edit Data)</em>' : esc(cfg2.statusLabels[h.from] || h.from || "—");
          const toCell = isEdit ? '<em style="color:#f59e0b;">(Edit Data)</em>' : esc(cfg2.statusLabels[h.to] || h.to || "—");
          const noteCell = (h.note && h.note !== "Record dibuat") ? esc(h.note) : "—";
          histRows += '<tr><td style="border:1px solid #d1d5db;padding:6px;">' + fromCell + '</td><td style="border:1px solid #d1d5db;padding:6px;">' + toCell + '</td><td style="border:1px solid #d1d5db;padding:6px;">' + esc(h.at || "—") + '</td><td style="border:1px solid #d1d5db;padding:6px;">' + esc(h.by || "anon") + '</td><td style="border:1px solid #d1d5db;padding:6px;">' + noteCell + editedFields + atts + '</td></tr>';
        });
        histRows += '</tbody></table></div>';
      }

      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) { alert("Popup diblokir. Izinkan popup untuk export."); return; }
      const html = '<!DOCTYPE html><html><head><title>Detail ' + esc(cfg2.pageTitle || cfg2.kind) + ' - ' + esc(rec.no || rec.id || "") + '</title>' +
        '<style>@page { size: A4; margin: 20mm; } body { font-family: "IBM Plex Sans", sans-serif; color: #1c2632; padding: 24px; }' +
        '.header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1c2632; }' +
        '.logo { width: 48px; height: 48px; border-radius: 10px; background: #1c2632; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }' +
        '.company { font-size: 20px; font-weight: 700; } .title { font-size: 14px; color: #6b7280; margin-top: 2px; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 12px; } th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 13px; }' +
        'th { background: #f3f4f6; font-weight: 600; } tr:nth-child(even) { background: #f9fafb; }' +
        '.footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }' +
        '</style></head><body>' +
        '<div class="header">' + logoHtml + '<div><div class="company">' + esc(companyName) + '</div><div class="title">Detail ' + esc(cfg2.pageTitle || cfg2.kind) + '</div></div></div>' +
        '<table>' + rows + '</table>' + histRows +
        '<div class="footer">Dicetak dari ' + esc(companyName) + ' · ' + new Date().toLocaleDateString("id-ID") + '</div>' +
        '</body></html>';
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    }

    document.getElementById("ops-transition-confirm").addEventListener("click", async () => {
      if (!transRec || !transNext) return;
      const cfg2 = cfg;
      const transConfig = cfg2.statusTransitions || {};
      const prevStatus = transRec.status;
      const key = prevStatus + " -> " + transNext;
      const rule = transConfig[key] || { fields: [], note: "Ubah status" };

      const out = {};
      const missingTrans = [];
      let ok = true;
      let attachFiles = null;
      transGrid.querySelectorAll("[data-tf]").forEach(el => {
        const k = el.dataset.tf;
        if (k === "trans_attach") { attachFiles = el.files ? Array.from(el.files) : []; return; }
        const v = el.value.trim();
        if (k === "trans_note") { out[k] = v; return; }
        if (rule.fields.indexOf(k) >= 0 && !v) { ok = false; const def = cfg2.formFields.find(ff => ff.key === k); missingTrans.push(def ? def.label : k); el.classList.add("form-invalid"); }
        else el.classList.remove("form-invalid");
        out[k] = v;
      });
      if (!ok) {
        alert("Lengkapi field wajib untuk transisi ini:\n\n" + missingTrans.map(n => "• " + n).join("\n") + "\n\nField yang wajib ditandai garis merah.");
        return;
      }
      if (rule.noteRequired && !out.trans_note) { alert("Catatan transisi wajib diisi untuk transisi ini."); return; }

      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
      const me = (function () { try { return JSON.parse(localStorage.getItem("rv_auth_user") || "null"); } catch (e) { return null; } })();
      const user = me ? (me.name || me.username || "anon") : "anon";

      // Upload attachments for this transition
      const attachments = [];
      if (attachFiles && attachFiles.length) {
        for (const f of attachFiles) {
          const up = await OPS.upload(cfg2.kind, transRec.id, f);
          if (up && up.url) {
            attachments.push({ id: up.id, name: f.name, size: f.size, url: up.url });
          } else if (f.size <= 1500 * 1024) {
            const du = await fileToDataUrl(f);
            attachments.push({ name: f.name, size: f.size, url: du });
          } else {
            alert("Backend tidak aktif & file >1.5MB — lampiran '" + f.name + "' dilewati.");
          }
        }
      }

      transRec.status_history = transRec.status_history || [];
      transRec.status_history.push({
        from: prevStatus,
        to: transNext,
        at: now,
        by: user,
        note: out.trans_note || "",
        fields: Object.keys(out).filter(k => k !== "trans_note" && out[k]).reduce((a, k) => { a[k] = out[k]; return a; }, {}),
        attachments: attachments.length ? attachments : undefined
      });

      transRec.status = transNext;
      Object.keys(out).forEach(k => { if (k !== "trans_note") transRec[k] = out[k]; });
      await OPS.save(cfg2.kind, transRec);
      rows = await OPS.load(cfg2.kind);
      closeTransition();
      redraw();
      showToast("Status berhasil diubah: " + (cfg.statusLabels[transRec.status] || transRec.status), "success");
      showDetailModal(cfg2, transRec);
    });

    elFilter.addEventListener("change", () => { filterStatus = elFilter.value; drawSummary(); drawTable(); });
    if (elAssignee) elAssignee.addEventListener("change", () => { filterAssignee = elAssignee.value; drawTable(); });
    if (elTransitionFilter) elTransitionFilter.addEventListener("change", () => { filterTransition = elTransitionFilter.value; drawTable(); });
    if (elTransDateFrom) elTransDateFrom.addEventListener("input", () => { transDateFrom = (elTransDateFrom.value || "").trim(); drawTable(); });
    if (elTransDateTo) elTransDateTo.addEventListener("input", () => { transDateTo = (elTransDateTo.value || "").trim(); drawTable(); });
    elSearch.addEventListener("input", () => { q = elSearch.value.trim().toLowerCase(); drawTable(); });
    if (elDateFrom) elDateFrom.addEventListener("input", () => { dateFrom = (elDateFrom.value || "").trim(); drawTable(); });
    if (elDateTo) elDateTo.addEventListener("input", () => { dateTo = (elDateTo.value || "").trim(); drawTable(); });
    document.getElementById("ops-add").addEventListener("click", () => openForm());

    // Export CSV (view saat ini)
    const btnExport = document.getElementById("ops-export");
    if (btnExport) btnExport.addEventListener("click", () => {
      const tab = cfg.tabs.find(t => t.id === activeTab);
      const pool = rows.map(view).filter(r => (!tab.filter || tab.filter.indexOf(r.status) >= 0) && matches(r));
      if (!pool.length) { alert("Tidak ada data untuk diekspor."); return; }
      const header = cfg.columns.map(c => c.label).join(",");
      const rowsCsv = pool.map(r => cfg.columns.map(c => {
        let val = c.render ? c.render(r, OPS) : esc(r[c.key] || "—");
        val = val.replace(/<[^>]+>/g, "").replace(/"/g, '""');
        return '"' + val + '"';
      }).join(","));
      const csv = [header, ...rowsCsv].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (cfg.kind || "ops") + "-" + activeTab + ".csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // Export History Transisi (CSV terpisah)
    const btnExportHistory = document.getElementById("ops-export-history");
    if (btnExportHistory) btnExportHistory.addEventListener("click", () => {
      const tab = cfg.tabs.find(t => t.id === activeTab);
      const pool = rows.map(view).filter(r => (!tab.filter || tab.filter.indexOf(r.status) >= 0) && matches(r));
      if (!pool.length) { alert("Tidak ada data untuk diekspor."); return; }
      const header = "No,Title,From,To,Waktu,By,Catatan,Fields";
      const rowsCsv = [];
      pool.forEach(r => {
        const no = r.no || r.id || "";
        const title = (r.title || r.tujuan || "").replace(/"/g, '""');
        const hist = r.status_history || [];
        if (!hist.length) {
          rowsCsv.push('"' + no + '","' + title + '","(Belum ada transisi)","' + r.status + '","","","",""');
        } else {
          hist.forEach((h, idx) => {
            const isCreated = h.from === null && idx === 0;
            const from = isCreated ? "(Dibuat)" : (h.from || "");
            const to = h.to || "";
            const at = h.at || "";
            const by = (h.by || "").replace(/"/g, '""');
            const note = (h.note || "").replace(/"/g, '""');
            const fields = h.fields ? Object.entries(h.fields).map(([k, v]) => k + "=" + v).join("; ") : "";
            rowsCsv.push('"' + no + '","' + title + '","' + from + '","' + to + '","' + at + '","' + by + '","' + note + '","' + fields.replace(/"/g, '""') + '"');
          });
        }
      });
      const csv = [header, ...rowsCsv].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (cfg.kind || "ops") + "-" + activeTab + "-history.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // Print tabel (window.print)
    const btnPrint = document.getElementById("ops-print");
    if (btnPrint) btnPrint.addEventListener("click", () => {
      const tab = cfg.tabs.find(t => t.id === activeTab);
      const pool = rows.map(view).filter(r => (!tab.filter || tab.filter.indexOf(r.status) >= 0) && matches(r));
      if (!pool.length) { alert("Tidak ada data untuk dicetak."); return; }
      const companyName = (typeof BRAND !== "undefined" && BRAND.companyName) ? BRAND.companyName : "RackView";
      let logoUrl = (typeof BRAND !== "undefined" && BRAND.logoUrl) ? BRAND.logoUrl : "";
      const logoText = (typeof BRAND !== "undefined" && BRAND.logoSmallText) ? BRAND.logoSmallText : "RV";
      if (logoUrl && logoUrl.indexOf("http") !== 0) {
        const origin = (window && window.location && window.location.origin) ? window.location.origin : "";
        logoUrl = origin + logoUrl;
      }
      const logoHtml = logoUrl ? '<img src="' + esc(logoUrl) + '" style="width:48px;height:48px;object-fit:contain;border-radius:10px;">' : '<div class="logo">' + esc(logoText) + '</div>';
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) { alert("Popup diblokir. Izinkan popup untuk print."); return; }
      win.document.write('<!DOCTYPE html><html><head><title>' + esc(cfg.pageTitle || cfg.kind) + ' — ' + esc(tab.label) + '</title>' +
        '<style>' +
        '@page { size: A4; margin: 20mm; }' +
        'body { font-family: "IBM Plex Sans", sans-serif; color: #1c2632; padding: 24px; }' +
        '.header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1c2632; }' +
        '.logo { width: 48px; height: 48px; border-radius: 10px; background: #1c2632; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; }' +
        '.company { font-size: 20px; font-weight: 700; }' +
        'h2 { font-size: 18px; margin-bottom: 16px; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 12px; }' +
        'th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 12px; }' +
        'th { background: #f3f4f6; font-weight: 600; }' +
        'tr:nth-child(even) { background: #f9fafb; }' +
        '.footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }' +
        '</style></head><body>' +
        '<div class="header">' + logoHtml + '<div><div class="company">' + esc(companyName) + '</div><div class="title">' + esc(cfg.pageTitle || cfg.kind) + ' — ' + esc(tab.label) + '</div></div></div>' +
        '<table><thead><tr>' + cfg.columns.map(c => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>');
      pool.forEach(r => {
        win.document.write('<tr>' + cfg.columns.map(c => {
          const html = c.render ? c.render(r, OPS) : esc(r[c.key] || "—");
          return '<td>' + html + '</td>';
        }).join('') + '</tr>');
      });
      win.document.write('</tbody></table><div class="footer">Dicetak dari ' + esc(companyName) + ' · ' + new Date().toLocaleDateString("id-ID") + '</div></body></html>');
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    });

    // ---- Form modal ----
    const overlay = document.getElementById("ops-overlay");
    function openForm(rec, prefill) {
      openFormAsync(rec, prefill);
    }
    async function openFormAsync(rec, prefill) {
      await buildForm(rec, prefill);
      overlay.style.display = "flex";
    }
    function closeForm() { overlay.style.display = "none"; }
    async function buildForm(rec, prefill) {
      const t = document.getElementById("ops-form-title");
      const s = document.getElementById("ops-form-sub");
      const grid = document.getElementById("ops-form-grid");
      const save = document.getElementById("ops-form-save");
      const isEdit = !!rec;
      t.textContent = isEdit ? "Edit " + cfg.pageTitle : "Tambah " + cfg.pageTitle;
      s.textContent = cfg.formSub || "";
      const noBaru = nextNo(cfg, rows);

      const devices = await OPS.deviceList();

      grid.innerHTML = cfg.formFields.filter(f => {
        if (isEdit && f.key === "status") return false;
        return true;
      }).map(f => {
        let input;
        if (f.type === "select") {
          let opts = f.options;
          if (f.source === "sites") opts = OPS.siteList().map(s => ({ value: s.id, label: s.name }));
          else if (typeof opts === "function") opts = opts();
          input = '<select class="form-input" data-f="' + f.key + '"' + (f.required ? " required" : "") + '>' +
            opts.map(o => '<option value="' + esc(o.value) + '"' + ((rec ? rec[f.key] : f.default) === o.value ? " selected" : "") + '>' + esc(o.label) + '</option>').join("") + '</select>';
        } else if (f.type === "textarea") {
          input = '<textarea class="form-input" data-f="' + f.key + '" rows="3" placeholder="' + esc(f.placeholder || "") + '">' + esc((rec && rec[f.key]) || "") + '</textarea>';
        } else if (f.type === "file") {
          const existing = rec && rec[f.key] && rec[f.key].length ? rec[f.key] : [];
          const existingHtml = existing.length ? '<div class="form-hint" style="margin-top:4px;">File saat ini: ' + existing.map(x => x.name).join(", ") + '</div>' : "";
          input = '<input class="form-input" type="file" data-f="' + f.key + '"' + (f.multiple === false ? "" : " multiple") + ' accept="' + esc(f.accept || ".pdf,application/pdf") + '">' +
            (f.hint ? '<div class="form-hint">' + esc(f.hint) + '</div>' : "") + existingHtml;
        } else if (f.source === "devices") {
          const dl = "ops-dl-" + f.key;
          const devs = devices;
          input = '<input class="form-input" type="text" data-f="' + f.key + '" list="' + dl + '" value="' + esc((rec ? rec[f.key] : "") || "") + '"' + (f.required ? " required" : "") + ' placeholder="' + esc(f.placeholder || "") + '">' +
            '<datalist id="' + dl + '">' + devs.map(d => '<option value="' + esc(d.name) + '">' + esc((d.siteName ? d.siteName + (d.rackId ? " · " + d.rackId : "") : d.type)) + '</option>').join("") + '</datalist>';
        } else {
          let val = (rec ? rec[f.key] : (f.default || ""));
          if (!rec && !f.default) {
            if (f.type === "date") val = new Date().toISOString().slice(0, 10);
            else if (f.type === "datetime-local") val = new Date().toISOString().slice(0, 16);
          }
          input = '<input class="form-input" type="' + (f.type || "text") + '" data-f="' + f.key + '" value="' + esc(val) + '"' + (f.required ? " required" : "") + ' placeholder="' + esc(f.placeholder || "") + '">';
        }
        return '<div class="' + (f.full ? "full" : "") + '"><label class="form-label">' + esc(f.label) + (f.required ? '<span class="ops-required-mark">*</span>' : '') + '</label>' + input + '</div>';
      }).join("") + (isEdit ? '<div class="full"><label class="form-label">Catatan Edit <span style="color:var(--danger,#f4574d);">*</span></label><textarea class="form-input" data-f="edit_note" rows="2" placeholder="Alasan edit data" required></textarea><div class="form-hint">Wajib diisi untuk audit trail</div></div>' : '');

      // Prefill dari deep-link (?rack= / ?site=) untuk catatan trouble rack.
      if (prefill && !isEdit) {
        Object.keys(prefill).forEach(k => {
          const el = grid.querySelector('[data-f="' + k + '"]');
          if (!el) return;
          if (k === "site" && el.tagName === "SELECT") {
            const siteId = siteId(prefill.site);
            const exists = Array.from(el.options).some(o => o.value === siteId);
            if (exists) el.value = siteId;
          } else if (k === "rack" && el.tagName === "SELECT") {
            const exists = Array.from(el.options).some(o => o.value === prefill.rack);
            if (exists) el.value = prefill.rack;
          } else {
            el.value = prefill[k];
          }
        });
      }
      save.onclick = async () => {
        const out = rec ? Object.assign({}, rec) : { id: genId(cfg.kind), no: noBaru, created_at: new Date().toISOString().slice(0, 16).replace("T", " ") };
        const filesByKey = {};
        const missing = [];
        grid.querySelectorAll("[data-f]").forEach(el => {
          const k = el.dataset.f;
          const field = cfg.formFields.find(x => x.key === k);
          if (field && field.type === "file") {
            if (field.required && (!el.files || !el.files.length)) { missing.push(field.label); el.classList.add("form-invalid"); }
            else el.classList.remove("form-invalid");
            if (el.files && el.files.length) filesByKey[k] = Array.from(el.files);
            return;
          }
          const v = el.value.trim();
          if (field && field.required && !v) { missing.push(field.label); el.classList.add("form-invalid"); }
          else el.classList.remove("form-invalid");
          if (field && field.source === "devices") out[k] = canonKey(v);
          else if (field && field.source === "sites") out[k] = siteId(v);
          else out[k] = v;
        });
        if (missing.length) {
          const names = [...new Set(missing)];
          alert("Lengkapi field wajib berikut:\n\n" + names.map(n => "• " + n).join("\n") + "\n\nField yang wajib ditandai dengan garis merah di form.");
          grid.querySelector(".form-invalid");
          return;
        }
         if (out.resolved_at && out.occurred_at) {
           const rd = String(out.resolved_at).slice(0, 10);
           const od = String(out.occurred_at).slice(0, 10);
           if (rd < od) { alert("Resolved At tidak boleh sebelum Tanggal Kejadian."); return; }
         }
        for (const k of Object.keys(filesByKey)) {
          const atts = [];
          for (const f of filesByKey[k]) {
            const up = await OPS.upload(cfg.kind, out.id, f);
            if (up && up.url) {
              atts.push({ id: up.id, name: f.name, size: f.size, url: up.url });
            } else if (f.size <= 1500 * 1024) {
              const du = await fileToDataUrl(f);
              atts.push({ name: f.name, size: f.size, url: du });
            } else {
              alert("Backend tidak aktif & file >1.5MB — lampiran '" + f.name + "' dilewati. Jalankan server (npm start) untuk upload penuh.");
            }
          }
          out[k] = (out[k] || []).concat(atts);
        }
        const isEdit = !!rec;
        if (!isEdit) {
          const me = (typeof authMe === "function") ? authMe() : null;
          out.created_by = me ? (me.name || me.username || "System Owner") : "System Owner";
          out.status_history = [{
            from: null,
            to: out.status || "planned",
            at: out.created_at,
            by: out.created_by,
            note: "Record dibuat"
          }];
        }
        const changes = [];
        if (isEdit) {
          const editNote = out.edit_note || "";
          delete out.edit_note;
          for (const k of Object.keys(out)) {
            if (k === "id" || k === "no" || k === "created_at" || k === "status_history" || k === "created_by") continue;
            const oldVal = String(rec[k] || "");
            const newVal = String(out[k] || "");
            if (oldVal !== newVal) {
              const field = cfg.formFields.find(f => f.key === k);
              const label = field ? field.label : k;
              changes.push({ key: k, label: label, old: rec[k] || "", new: out[k] || "" });
            }
          }
          if (changes.length) {
            const now = new Date().toISOString().slice(0, 16).replace("T", " ");
            const me = (typeof authMe === "function") ? authMe() : null;
            const user = me ? (me.name || me.username || "anon") : "anon";
            out.status_history = out.status_history || [];
            out.status_history.push({
              from: out.status,
              to: out.status,
              at: now,
              by: user,
              note: editNote || "Data diperbarui",
              edited_fields: changes.reduce((a, c) => { a[c.label] = c.new || "(kosong)"; return a; }, {})
            });
            OPS.auditLog("ops.edit", cfg.kind + ":" + (out.no || out.id), changes.map(c => c.label + ": " + (c.old || "(kosong)") + " → " + (c.new || "(kosong)")).join("; "));
          }
        }
        await OPS.save(cfg.kind, out);
        rows = await OPS.load(cfg.kind);
        closeForm();
        redraw();
        if (isEdit && changes.length) {
          showToast(changes.length + " field diperbarui.", "success");
        } else if (isEdit) {
          showToast("Tidak ada perubahan.", "info");
        } else {
          showToast("Record baru ditambahkan.", "success");
        }
      };
    }

    document.getElementById("ops-close").addEventListener("click", closeForm);
    document.getElementById("ops-cancel").addEventListener("click", closeForm);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeForm(); });

    drawTabs();
    drawFilter();
    drawSummary();
    drawTable();

    // Deep-link lintas modul: maintenance ?q=INC-2026-0002 → isi pencarian
    // otomatis sehingga pengguna langsung melihat insiden/kunjungan terkait.
    let qp = null;
    try {
      const m = (location.search || "").match(/[?&]q=([^&]*)/);
      if (m) qp = decodeURIComponent(m[1].replace(/\+/g, " "));
    } catch (e) {}
    if (qp) { elSearch.value = qp; q = qp.trim().toLowerCase(); drawTable(); }

    // Deep-link form: ?rack=R3-C05&site=DC3 → buka modal Tambah dengan field
    // site & rack terisi otomatis (dipakai tombol "Lapor Trouble" di Rack Elevation).
    try {
      const pm = (location.search || "").match(/[?&]rack=([^&]*)/);
      const sm = (location.search || "").match(/[?&]site=([^&]*)/);
      if (pm || sm) {
        const prefill = {};
        if (pm) prefill.rack = decodeURIComponent(pm[1].replace(/\+/g, " "));
        if (sm) prefill.site = decodeURIComponent(sm[1].replace(/\+/g, " "));
        openForm(null, prefill);
      }
    } catch (e) {}
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (window.OPS_CONFIG) {
      OPS.render(window.OPS_CONFIG).catch(e => console.error("OPS.render error:", e));
    }
    document.addEventListener("click", e => {
      if (!e.target.closest(".ops-next-wrap")) {
        document.querySelectorAll(".ops-next-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
      }
    });
  });
})();
