/* ============================================
   RackView — ISP List
   Dedicated ISP management page.
   Reads/writes devices table (type=isp).
   ============================================ */

(function () {
  "use strict";

  const tbody = document.getElementById("isp-tbody");
  const countText = document.getElementById("isp-count-text");
  const detailBody = document.getElementById("detail-body");
  const searchEl = document.getElementById("isp-search");
  const fSite = document.getElementById("f-site");
  const fStatus = document.getElementById("f-status");
  const ctxBar = document.getElementById("isp-ctx-bar");

  const API = (typeof API_BASE !== "undefined" ? API_BASE : "/api");
  const PAGE_SIZE = 20;
  let currentPage = 1;
  let selectedKey = null;
  let ispRecords = []; // [{deviceKey, ...data}]
  const BGP_CACHE = {};  // key → [{router, localAsn, remoteAsn, prefixAdv, prefixRecv, port, ip}]
  const PORT_MAP_KEY = "rv_port_maps";

  function buildBgpCache() {
    BGP_CACHE.__loaded = true;
    try {
      const pm = JSON.parse(localStorage.getItem(PORT_MAP_KEY) || "{}");
      Object.entries(pm).forEach(([devKey, map]) => {
        if (!map || !Array.isArray(map.rows)) return;
        map.rows.forEach(row => {
          const connTo = row.connectedTo || "";
          const connType = row.connType || "";
          const ispKey = connTo.startsWith("ISP-") || connType === "isp" ? connTo : "";
          if (!ispKey) return;
          const key = canonKey(ispKey);
          (BGP_CACHE[key] = BGP_CACHE[key] || []).push({
            router: devKey,
            localAsn: row.bgpLocalAsn || "",
            remoteAsn: row.bgpRemoteAsn || "",
            prefixAdv: row.bgpPrefixAdvertised || "",
            prefixRecv: row.bgpPrefixReceived || "",
            port: row.port || "",
            ip: row.ip || "",
          });
        });
      });
    } catch (e) {}
  }

  function getBgpSessions(isp) {
    if (!BGP_CACHE.__loaded) buildBgpCache();
    const key = canonKey(isp.name);
    return BGP_CACHE[key] || [];
  }

  function bgpStatus(sessions) {
    if (!sessions.length) return "none";
    const hasLocal = sessions.some(s => s.localAsn && s.remoteAsn);
    if (hasLocal) return "established";
    const hasPartial = sessions.some(s => s.localAsn || s.remoteAsn);
    return hasPartial ? "active" : "idle";
  }

  /* ---- helpers ---- */
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function canonKey(s) { return String(s || "").trim().toUpperCase().replace(/\s+/g, " "); }

  /* ---- SQLite fetch ---- */
  async function loadFromDb() {
    try {
      let list;
      if (typeof apiGetDevices === "function") { list = apiGetDevices(); }
      else {
        const res = await fetch(API + "/devices");
        if (!res.ok) return;
        list = await res.json();
      }
      if (!Array.isArray(list)) return;
      ispRecords = list
        .filter(d => String(d.type || "").toLowerCase() === "isp")
        .map(d => {
          let data = {};
          try { data = typeof d.data === "string" ? (JSON.parse(d.data) || {}) : (d.data || {}); } catch (e) {}
          return { deviceKey: d.deviceKey, ...data };
        });
    } catch (e) {}
  }

  function saveLocal(isp) {
    try {
      const key = "rv_accessories";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      const i = arr.findIndex(a => canonKey(a.name) === canonKey(isp.name) && a.type === "isp");
      if (i >= 0) arr[i] = { ...arr[i], ...isp };
      else arr.unshift(isp);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  function apiSaveISP(isp) {
    try { if (typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: canonKey(isp.name), type: "isp", name: canonKey(isp.name), data: isp }); } catch (e) {}
  }

  function apiDeleteISP(deviceKey) {
    try { if (typeof apiDeleteDevice === "function") apiDeleteDevice(deviceKey); } catch (e) {}
  }

  function apiDeleteISPMaps(deviceKey) {
    try { if (typeof apiDeleteMap === "function") { apiDeleteMap("port", deviceKey); apiDeleteMap("power", deviceKey); } } catch (e) {}
  }

  function postAudit(action, target, detail) {
    try {
      const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
      fetch(base + "/audit/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, target, detail })
      });
    } catch (e) {}
  }

  /* ---- ISP-specific field labels ---- */
  const ISP_SECTIONS = [
    { title: "Identitas Provider", icon: "fa-cloud", fields: [
      ["ispName", "ISP Name"], ["asn", "ASN"], ["company", "Company / Legal Name"], ["website", "Website"],
      ["site", "Site / DC"], ["popLocation", "POP / Peering Location"], ["status", "Status"],
    ]},
    { title: "Layanan & Bandwidth", icon: "fa-gauge-high", fields: [
      ["serviceType", "Service Type"], ["bandwidthDown", "Bandwidth Down"], ["bandwidthUp", "Bandwidth Up"],
      ["cir", "Committed Information Rate (CIR)"], ["burstBw", "Burst Bandwidth"],
    ]},
    { title: "IP & Network", icon: "fa-network-wired", fields: [
      ["ipRanges", "IP Ranges (Public)"], ["subnetMask", "Subnet Mask"], ["gateway", "Gateway"],
      ["publicIp", "Public IP (Router-facing)"], ["dnsPrimary", "DNS Primary"], ["dnsSecondary", "DNS Secondary"],
    ]},
    { title: "Connectivity", icon: "fa-plug", fields: [
      ["handoffType", "Handoff Type"], ["interfaceType", "Interface Type"],
      ["physicalPath", "Physical Path (Redundancy)"], ["portSpeed", "Port Speed"],
    ]},
    { title: "Routing & BGP", icon: "fa-route", fields: [
      ["bgpLocalAsn", "BGP Local ASN (Datacenter)"], ["bgpRemoteAsn", "BGP Remote ASN (ISP)"],
      ["bgpPassword", "BGP Password"], ["bgpPrefixAdv", "BGP Prefix Advertised"],
      ["bgpPrefixRecv", "BGP Prefix Received"], ["routingProtocol", "Routing Protocol"],
      ["routeType", "Route Type (Full/Default)"],
    ]},
    { title: "Kontrak & SLA", icon: "fa-file-contract", fields: [
      ["contractNo", "Contract No"], ["contractStart", "Contract Start"], ["contractEnd", "Contract End"],
      ["slaUptime", "SLA Uptime"], ["slaMttr", "SLA MTTR"], ["penaltyClause", "Penalty Clause"],
    ]},
    { title: "Kontak & Support", icon: "fa-headset", fields: [
      ["nocPhone", "NOC Phone"], ["nocEmail", "NOC Email"], ["nocHours", "NOC Hours"],
      ["accountManager", "Account Manager"], ["accountPhone", "Account Phone"], ["accountEmail", "Account Email"],
      ["techContact", "Technical Contact"],
    ]},
    { title: "Redundancy & Failover", icon: "fa-rotate", fields: [
      ["redundancyType", "Redundancy Type"], ["failoverMethod", "Failover Method"],
      ["secondaryIsp", "Secondary ISP"], ["notes", "Notes"],
    ]},
  ];

  /* ---- Render ---- */
  function renderStats() {
    const total = ispRecords.length;
    const active = ispRecords.filter(r => (r.status || "active").toLowerCase() === "active").length;
    const backup = ispRecords.filter(r => (r.redundancyType || "").toLowerCase().includes("backup")).length;
    const asnCount = new Set(ispRecords.map(r => r.asn).filter(Boolean)).size;
    document.getElementById("st-total").textContent = total;
    document.getElementById("st-active").textContent = active;
    document.getElementById("st-backup").textContent = backup;
    const elAsn = document.getElementById("st-asn");
    if (elAsn) elAsn.textContent = asnCount;
    document.getElementById("st-total-sub").textContent = `${asnCount} ASN · ${new Set(ispRecords.map(r => r.popLocation).filter(Boolean)).size} POP`;
    // BGP sessions stat
    let bgpEst = 0, bgpPartial = 0;
    ispRecords.forEach(r => {
      const s = getBgpSessions(r);
      const st = bgpStatus(s);
      if (st === "established") bgpEst++;
      else if (st === "active") bgpPartial++;
    });
    const elBgp = document.getElementById("st-bgp");
    if (elBgp) elBgp.textContent = bgpEst + bgpPartial;
    const elBgpSub = document.getElementById("st-bgp-sub");
    if (elBgpSub) elBgpSub.textContent = `${bgpEst} established · ${bgpPartial} negotiating`;
  }

  const fBgp = document.getElementById("f-bgp");

  function matchFilters(r) {
    const q = (searchEl ? searchEl.value : "").trim().toLowerCase();
    const site = fSite ? fSite.value : "all";
    const status = fStatus ? fStatus.value : "all";
    const bgpFilter = fBgp ? fBgp.value : "all";
    if (site !== "all" && (r.site || "all") !== site) return false;
    if (status !== "all" && (r.status || "active").toLowerCase() !== status) return false;
    if (bgpFilter !== "all") {
      const sessions = getBgpSessions(r);
      const st = bgpStatus(sessions);
      if (st !== bgpFilter) return false;
    }
    if (q) {
      const hay = [r.name, r.ispName, r.asn, r.ipRanges, r.contractNo, r.slaUptime, r.popLocation, r.company, ...(r.tags || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderPagination(total) {
    const wrap = document.getElementById("isp-pagination");
    if (!wrap) return;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), pages);
    const btns = [];
    btns.push(`<button type="button" data-pg="prev" ${currentPage === 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`);
    const shown = new Set([1, pages, currentPage, currentPage - 1, currentPage + 1].filter(p => p >= 1 && p <= pages));
    let last = 0;
    [...shown].sort((a, b) => a - b).forEach(p => {
      if (p - last > 1) btns.push(`<span class="pg-info">…</span>`);
      btns.push(`<button type="button" data-pg="${p}" class="${p === currentPage ? "active" : ""}">${p}</button>`);
      last = p;
    });
    btns.push(`<button type="button" data-pg="next" ${currentPage === pages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`);
    const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, total);
    btns.push(`<span class="pg-info">Menampilkan <b>${from}–${to}</b> dari <b>${total}</b> ISP</span>`);
    wrap.innerHTML = btns.join("");
    wrap.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        const v = b.dataset.pg;
        const next = v === "prev" ? currentPage - 1 : v === "next" ? currentPage + 1 : parseInt(v, 10);
        currentPage = next;
        renderRows();
      });
    });
  }

  function renderRows() {
    const list = ispRecords.filter(matchFilters);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), pages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageList = list.slice(start, start + PAGE_SIZE);
    const from = list.length ? start + 1 : 0;
    const to = Math.min(start + PAGE_SIZE, list.length);
    if (countText) countText.textContent = list.length ? `Menampilkan ${from}–${to} dari ${list.length} ISP` : "Menampilkan 0 ISP";
    renderPagination(list.length);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:28px;">Tidak ada ISP yang cocok dengan filter.</td></tr>`;
      return;
    }
    tbody.innerHTML = pageList.map(r => {
      const active = canonKey(r.name) === selectedKey;
      const bgpSessions = getBgpSessions(r);
      const bgpSt = bgpStatus(bgpSessions);
      const bgpBadge = bgpSt === "established"
        ? `<span class="badge bgp-established"><span class="bdot"></span>Established</span>`
        : bgpSt === "active"
          ? `<span class="badge bgp-active"><span class="bdot"></span>Negotiating</span>`
          : `<span class="badge bgp-idle"><span class="bdot"></span>${bgpSessions.length ? "Idle" : "No Sessions"}</span>`;
      const connRouters = bgpSessions.length ? bgpSessions.slice(0, 3).map(s => s.router).join(", ") + (bgpSessions.length > 3 ? ` +${bgpSessions.length - 3}` : "") : "—";
      return `<tr data-key="${esc(r.name)}" class="${active ? "row-selected" : ""}">
        <td><div class="strong">${esc(r.ispName || r.name)}</div><div class="mono" style="font-size:11px;">${esc(r.company || "—")}</div></td>
        <td class="mono">${esc(r.asn || "—")}</td>
        <td class="mono" style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(bgpSessions.map(s=>s.router).join(", "))}">${esc(connRouters || "—")}</td>
        <td>${bgpBadge}</td>
        <td>${esc(r.bandwidthDown || r.bandwidth || "—")}</td>
        <td class="mono" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(r.ipRanges || "")}">${esc(r.ipRanges || "—")}</td>
        <td>${esc(r.contractNo || "—")}</td>
        <td>${esc(r.slaUptime || r.sla || "—")}</td>
        <td>${esc(r.popLocation || "—")}</td>
        <td><span class="badge ${(r.status || "active").toLowerCase() === "active" ? "isp-active" : "isp-inactive"}"><span class="bdot"></span>${esc(r.status || "Active")}</span></td>
      </tr>`;
    }).join("");
    tbody.querySelectorAll("tr").forEach(tr => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("button, a")) return;
        selectedKey = tr.dataset.key;
        tbody.querySelectorAll("tr").forEach(r => r.classList.toggle("row-selected", r === tr));
        renderDetail(ispRecords.find(x => canonKey(x.name) === selectedKey));
        updateCtxBar();
      });
    });
    updateCtxBar();
  }

  /* ---- Detail panel ---- */
  function renderDetail(r) {
    if (!r) {
      detailBody.innerHTML = `<div class="form-hint">Pilih ISP pada tabel untuk melihat detail.</div>`;
      return;
    }
    let html = "";
    ISP_SECTIONS.forEach(sec => {
      const fields = sec.fields.filter(([k]) => r[k]);
      if (!fields.length) return;
      html += `<div style="margin-bottom:12px;"><div style="font-size:11.5px;font-weight:600;color:var(--accent-text);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;"><i class="fa-solid ${sec.icon}" style="margin-right:4px;"></i> ${sec.title}</div>`;
      fields.forEach(([k, label]) => {
        html += `<div class="isp-detail-field"><div class="isp-detail-label">${esc(label)}</div><div class="isp-detail-value">${esc(r[k] || "—")}</div></div>`;
      });
      html += `</div>`;
    });
    if (r.notes) {
      html += `<div style="margin-top:8px;"><div style="font-size:11.5px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Notes</div><div style="font-size:13px;color:var(--text-primary);white-space:pre-wrap;">${esc(r.notes)}</div></div>`;
    }
    // BGP sessions
    const sessions = getBgpSessions(r);
    if (sessions.length) {
      const st = bgpStatus(sessions);
      const statusClass = st === "established" ? "bgp-established" : st === "active" ? "bgp-active" : "bgp-idle";
      html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-soft);">
        <div style="font-size:11.5px;font-weight:600;color:var(--accent-text);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;"><i class="fa-solid fa-route"></i> BGP Sessions (${sessions.length})</div>
        <div style="margin-bottom:8px;">
          <span class="badge ${statusClass}"><span class="bdot"></span>${st === "established" ? "Established" : st === "active" ? "Negotiating" : "Idle"}</span>
        </div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <thead><tr style="border-bottom:1px solid var(--border-soft);"><th style="text-align:left;padding:4px 0;">Router</th><th style="text-align:left;padding:4px 0;">Local ASN</th><th style="text-align:left;padding:4px 0;">Remote ASN</th><th style="text-align:left;padding:4px 0;">Prefixes</th><th style="text-align:left;padding:4px 0;">Port</th></tr></thead>
          <tbody>
          ${sessions.map(s => `<tr style="border-bottom:1px solid var(--border-soft);"><td class="mono" style="padding:4px 0;">${esc(s.router)}</td><td class="mono" style="padding:4px 0;">${esc(s.localAsn || "—")}</td><td class="mono" style="padding:4px 0;">${esc(s.remoteAsn || "—")}</td><td style="padding:4px 0;font-size:11px;">Adv: ${esc(s.prefixAdv || "—")}<br>Recv: ${esc(s.prefixRecv || "—")}</td><td class="mono" style="padding:4px 0;">${esc(s.port || "—")}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    }
    detailBody.innerHTML = html;
  }

  /* ---- Ctx bar ---- */
  function updateCtxBar() {
    if (!ctxBar) return;
    const r = ispRecords.find(x => canonKey(x.name) === selectedKey);
    if (!r) { ctxBar.hidden = true; return; }
    ctxBar.hidden = false;
    const sessions = getBgpSessions(r);
    const bgpSt = bgpStatus(sessions);
    const bgpLabel = sessions.length ? `${sessions.length} BGP · ${bgpSt}` : "No BGP sessions";
    ctxBar.innerHTML = `<div class="ctx-bar-info"><i class="fa-solid fa-caret-right"></i> <b>${name}</b></div>
      <div class="ctx-bar-bgp" style="margin-right:12px;"><span class="badge ${(bgpSt === "established" ? "bgp-established" : bgpSt === "active" ? "bgp-active" : "bgp-idle")}" style="font-size:11px;"><span class="bdot"></span>${esc(bgpLabel)}</span></div>
      <div class="ctx-bar-actions">
        <button type="button" class="ctx-btn" data-ctx="view"><i class="fa-solid fa-eye"></i> Lihat</button>
        <button type="button" class="ctx-btn" data-ctx="edit"><i class="fa-solid fa-pen"></i> Edit</button>
        <button type="button" class="ctx-btn" data-ctx="port"><i class="fa-solid fa-ethernet"></i> Port Map</button>
        <button type="button" class="ctx-btn danger" data-ctx="delete"><i class="fa-solid fa-trash"></i> Hapus</button>
        <button type="button" class="ctx-btn" data-ctx="close"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    ctxBar.onclick = (e) => {
      const btn = e.target.closest("[data-ctx]");
      if (!btn) return;
      const act = btn.dataset.ctx;
      if (act === "close") { selectedKey = null; renderDetail(null); renderRows(); return; }
      if (act === "view") { openViewISP(r); return; }
      if (act === "edit") { openEditISP(r); return; }
      if (act === "port") {
        const key = canonKey(r.name);
        if (typeof openPortMap === "function") openPortMap(key, false, 0, { type: "isp" });
        else window.open("port-map.html?device=" + encodeURIComponent(key), "_blank", "noopener");
        return;
      }
      if (act === "delete") { deleteISP(r); return; }
    };
  }

  /* ---- View modal ---- */
  function openViewISP(r) {
    const body = document.getElementById("isp-view-body");
    const overlay = document.getElementById("isp-view-overlay");
    if (!body || !overlay) return;
    document.getElementById("isp-view-title").textContent = r.ispName || r.name;
    document.getElementById("isp-view-sub").textContent = `ASN: ${r.asn || "—"} · ${r.serviceType || "ISP"}`;
    let html = "";
    ISP_SECTIONS.forEach(sec => {
      const fields = sec.fields.filter(([k]) => r[k]);
      if (!fields.length) return;
      html += `<div style="margin-bottom:12px;"><div style="font-size:11.5px;font-weight:600;color:var(--accent-text);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;"><i class="fa-solid ${sec.icon}" style="margin-right:4px;"></i> ${sec.title}</div>`;
      fields.forEach(([k, label]) => {
        html += `<div class="isp-detail-field"><div class="isp-detail-label">${esc(label)}</div><div class="isp-detail-value">${esc(r[k] || "—")}</div></div>`;
      });
      html += `</div>`;
    });
    if (r.notes) html += `<div style="margin-top:8px;font-size:13px;white-space:pre-wrap;">${esc(r.notes)}</div>`;

    // BGP sessions in view modal
    const sessions = getBgpSessions(r);
    if (sessions.length) {
      const st = bgpStatus(sessions);
      html += `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-soft);">
        <div style="font-size:11.5px;font-weight:600;color:var(--accent-text);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;"><i class="fa-solid fa-route"></i> BGP Sessions (${sessions.length})</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <tbody>
          ${sessions.map(s => `<tr><td class="mono" style="padding:4px 0;min-width:120px;">${esc(s.router)}</td><td style="padding:4px 0;font-size:11px;">ASN ${esc(s.localAsn || "—")} ↔ ${esc(s.remoteAsn || "—")} · Port ${esc(s.port || "—")}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    }

    body.innerHTML = html;
    const editBtn = document.getElementById("isp-view-edit-btn");
    if (editBtn) editBtn.onclick = () => { closeView(); openEditISP(r); };
    overlay.classList.add("open");
  }
  function closeView() { const o = document.getElementById("isp-view-overlay"); if (o) o.classList.remove("open"); }

  /* ---- Add / Edit modal ---- */
  function buildSiteOptions(current) {
    const sites = typeof RACK_SITES !== "undefined" ? RACK_SITES : [
      { id: "DC1", name: "DC1 — Cilandak" },
      { id: "DC2", name: "DC2 — Cikupa" },
      { id: "DC3", name: "DC3 — Surabaya" },
      { id: "DC4", name: "DC4 — Bandung" },
    ];
    const arr = Array.isArray(sites) ? sites : [];
    return arr.map(s => {
      const id = s.id || s.siteId || s.code || "";
      const name = s.name || (s.siteName ? s.siteName : (s.id || ""));
      const selected = current && (String(current).toLowerCase() === String(id).toLowerCase() || String(current).toLowerCase() === String(name).toLowerCase());
      return `<option value="${esc(id)}" ${selected ? "selected" : ""}>${esc(name)}</option>`;
    }).join("") || `<option value="DC1"${current === "DC1" ? " selected" : ""}>DC1 — Cilandak</option><option value="DC2" ${current === "DC2" ? " selected" : ""}>DC2 — Cikupa</option>`;
  }

  function buildFormHTML(prefix, r) {
    const p = prefix || "";
    let html = "";
    ISP_SECTIONS.forEach(sec => {
      html += `<div class="card form-card isp-form-card" style="margin-bottom:14px;">
        <div class="card-head"><div><div class="card-title"><i class="fa-solid ${sec.icon}" style="color:var(--accent);margin-right:6px;"></i> ${sec.title}</div></div></div>
        <div class="isp-form-grid">`;
      sec.fields.forEach(([k, label]) => {
        const val = r ? esc(r[k] || "") : "";
        const isTextarea = ["notes", "bgpPrefixAdv", "bgpPrefixRecv", "physicalPath", "penaltyClause"].includes(k);
        const isSelect = ["serviceType", "handoffType", "interfaceType", "routingProtocol", "routeType", "redundancyType", "failoverMethod", "status"].includes(k);
        const isSite = k === "site";
        if (isSite) {
          html += `<div class="m-field"><label class="form-label">${esc(label)}</label><select class="form-input" data-isp="${k}">
            <option value="">Pilih site…</option>
            ${buildSiteOptions(r ? r[k] : "")}
          </select></div>`;
        } else if (isSelect) {
          const opts = getSelectOptions(k, r ? r[k] : "");
          html += `<div class="m-field"><label class="form-label">${esc(label)}</label><select class="form-input" data-isp="${k}">${opts}</select></div>`;
        } else if (isTextarea) {
          html += `<div class="m-field full"><label class="form-label">${esc(label)}</label><textarea class="form-input" data-isp="${k}" rows="2" placeholder="…">${val}</textarea></div>`;
        } else {
          html += `<div class="m-field"><label class="form-label">${esc(label)}</label><input class="form-input" type="text" data-isp="${k}" value="${val}" placeholder="…"></div>`;
        }
      });
      html += `</div></div>`;
    });
    return html;
  }

  function getSelectOptions(field, current) {
    const maps = {
      serviceType: ["Dedicated", "Shared", "MPLS", "Leased Line", "Metro Ethernet", "VPN", "Lainnya"],
      handoffType: ["Fiber (Single-mode)", "Fiber (Multi-mode)", "Copper (Cat6/Cat6a)", "Wireless (PtP)", "Coaxial"],
      interfaceType: ["1G SFP", "10G SFP+", "25G SFP28", "40G QSFP+", "100G QSFP28", "100GE", "Lainnya"],
      routingProtocol: ["BGP", "Static", "OSPF", "EIGRP", "RIP", "BGP + Static"],
      routeType: ["Full Route", "Default Route", "Partial Route", "Custom"],
      redundancyType: ["Single ISP", "Dual ISP (Active-Active)", "Dual ISP (Active-Passive)", "Multi-ISP", "Backup Only"],
      failoverMethod: ["BGP Failover", "DNS Failover", "Manual Failover", "VRRP/HSRP", "None"],
      status: ["Active", "Backup", "Provisioning", "Suspended", "Decommissioned"],
    };
    const opts = maps[field] || [];
    return opts.map(o => `<option value="${o}"${(current || "").toLowerCase() === o.toLowerCase() ? " selected" : ""}>${o}</option>`).join("");
  }

  function collectFormFields(formEl) {
    const out = {};
    formEl.querySelectorAll("[data-isp]").forEach(el => {
      const k = el.dataset.isp;
      const v = el.tagName === "TEXTAREA" ? el.value.trim() : el.value.trim();
      if (v) out[k] = v;
    });
    return out;
  }

  function openAddISP() {
    const body = document.getElementById("isp-form-body");
    const overlay = document.getElementById("isp-form-overlay");
    const title = document.getElementById("isp-form-title");
    if (!body || !overlay) return;
    title.textContent = "Add ISP";
    document.getElementById("isp-name-input").value = "";
    document.getElementById("isp-name-input").readOnly = false;
    body.innerHTML = buildFormHTML("add-", null) + `
      <div class="m-field" style="margin-top:12px;">
        <label class="form-label">Tags</label>
        <div class="tag-picker" id="isp-tag-picker">
          <div class="chip" data-tag="production">production</div>
          <div class="chip" data-tag="backup">backup</div>
          <div class="chip" data-tag="primary">primary</div>
          <div class="chip" data-tag="redundancy">redundancy</div>
          <button class="chip chip-add" type="button" data-add-chip"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="chip-add-row" data-add-row style="display:none;">
          <input class="form-input" type="text" data-add-input placeholder="Tag lain, mis. critical">
          <button class="btn primary btn-sm" type="button" data-add-confirm"><i class="fa-solid fa-check"></i></button>
          <button class="btn ghost btn-sm" type="button" data-add-cancel"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`;
    delete body.dataset.editKey;
    overlay.classList.add("open");
    wireTagPicker(document.getElementById("isp-tag-picker"));
  }

  function openEditISP(r) {
    const body = document.getElementById("isp-form-body");
    const overlay = document.getElementById("isp-form-overlay");
    const title = document.getElementById("isp-form-title");
    if (!body || !overlay) return;
    title.textContent = "Edit ISP";
    document.getElementById("isp-name-input").value = r.name || "";
    document.getElementById("isp-name-input").readOnly = true;
    body.innerHTML = buildFormHTML("edit-", r) + `
      <div class="m-field" style="margin-top:12px;">
        <label class="form-label">Tags</label>
        <div class="tag-picker" id="isp-tag-picker">${(r.tags || []).map(t => `<div class="chip active" data-tag="${esc(t)}">${esc(t)}</div>`).join("")}
          <button class="chip chip-add" type="button" data-add-chip"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="chip-add-row" data-add-row style="display:none;">
          <input class="form-input" type="text" data-add-input placeholder="Tag lain, mis. critical">
          <button class="btn primary btn-sm" type="button" data-add-confirm"><i class="fa-solid fa-check"></i></button>
          <button class="btn ghost btn-sm" type="button" data-add-cancel"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`;
    body.dataset.editKey = r.name;
    overlay.classList.add("open");
    wireTagPicker(document.getElementById("isp-tag-picker"));
  }

  function closeForm() { const o = document.getElementById("isp-form-overlay"); if (o) o.classList.remove("open"); }

  async function saveISP() {
    const overlay = document.getElementById("isp-form-overlay");
    const body = document.getElementById("isp-form-body");
    if (!overlay || !body) return;
    const isEdit = body.dataset.editKey;
    const fields = collectFormFields(body);
    // name/hostname field
    const nameEl = document.querySelector("#isp-name-input");
    let name = nameEl ? nameEl.value.trim() : "";
    if (!isEdit && !name) {
      if (nameEl) { nameEl.focus(); nameEl.style.outline = "1px solid var(--danger)"; setTimeout(() => nameEl.style.outline = "", 1500); }
      return;
    }
    if (isEdit) name = body.dataset.editKey;
    name = canonKey(name);
    fields.name = name;
    if (fields.ispName) fields.serial = fields.ispName;

    // Collect tags
    const tagPicker = document.getElementById("isp-tag-picker");
    if (tagPicker) {
      const tags = [...tagPicker.querySelectorAll(".chip.active")].map(c => c.dataset.tag).filter(Boolean);
      if (tags.length) fields.tags = tags;
    }

    const deviceKey = name;
    // Save to SQLite
    apiSaveISP({ ...fields, type: "isp" });
    saveLocal({ ...fields, name, type: "isp" });

    // Audit log
    const action = isEdit ? "device.update" : "device.create";
    postAudit(action, "isp/" + deviceKey, (fields.ispName || name) + (fields.asn ? " (" + fields.asn + ")" : ""));

    // Reload
    await loadFromDb();
    render();
    closeForm();

    // Select the saved ISP
    selectedKey = deviceKey;
    renderDetail(ispRecords.find(x => canonKey(x.name) === selectedKey));
    updateCtxBar();

    if (typeof showToast === "function") showToast("ISP " + name + " berhasil disimpan.", "success");
  }

  async function deleteISP(r) {
    const name = r.name || r.ispName;
    const ok = typeof window.confirmDoubleDelete === "function"
      ? window.confirmDoubleDelete(name)
      : (confirm("Hapus " + name + "?") && confirm("Yakin ingin menghapus permanen?"));
    if (!ok) return;
    await     apiDeleteISP(canonKey(r.name));
    apiDeleteISPMaps(canonKey(r.name));
    postAudit("device.delete", "isp/" + canonKey(r.name), r.ispName || name);
    // Clean localStorage
    try {
      const arr = JSON.parse(localStorage.getItem("rv_accessories") || "[]");
      localStorage.setItem("rv_accessories", JSON.stringify(arr.filter(a => !(canonKey(a.name) === canonKey(r.name) && a.type === "isp"))));
    } catch (e) {}
    // Clean port map
    try {
      const pm = JSON.parse(localStorage.getItem("rv_port_map") || "{}");
      if (pm[canonKey(r.name)]) { delete pm[canonKey(r.name)]; localStorage.setItem("rv_port_map", JSON.stringify(pm)); }
    } catch (e) {}
    if (selectedKey === canonKey(r.name)) { selectedKey = null; renderDetail(null); }
    await loadFromDb();
    render();
    if (typeof showToast === "function") showToast("ISP " + name + " berhasil dihapus.", "success");
  }

  /* ---- Tag picker helper ---- */
  function wireTagPicker(el) {
    if (!el) return;
    el.querySelectorAll(".chip[data-tag]").forEach(c => {
      c.addEventListener("click", () => c.classList.toggle("active"));
    });
    const addBtn = el.querySelector("[data-add-chip]");
    const addRow = el.querySelector("[data-add-row]");
    if (addBtn && addRow) {
      addBtn.addEventListener("click", () => { addBtn.style.display = "none"; addRow.style.display = "flex"; addRow.querySelector("input").focus(); });
      addRow.querySelector("[data-add-confirm]")?.addEventListener("click", () => {
        const inp = addRow.querySelector("input");
        const v = inp.value.trim().toLowerCase();
        if (v) { const c = document.createElement("div"); c.className = "chip active"; c.dataset.tag = v; c.textContent = v; el.insertBefore(addBtn.parentElement, addBtn.parentElement.previousElementSibling?.previousElementSibling || null).before(c); c.addEventListener("click", () => c.classList.toggle("active")); inp.value = ""; }
        addBtn.style.display = ""; addRow.style.display = "none";
      });
      addRow.querySelector("[data-add-cancel]")?.addEventListener("click", () => { addBtn.style.display = ""; addRow.style.display = "none"; });
    }
  }

  /* ---- Init ---- */
  async function render() {
    renderStats();
    renderRows();
  }

  async function init() {
    await loadFromDb();
    // Also merge from localStorage (fallback)
    try {
      const acc = JSON.parse(localStorage.getItem("rv_accessories") || "[]");
      const localISPs = acc.filter(a => a.type === "isp");
      const dbKeys = new Set(ispRecords.map(r => canonKey(r.name)));
      localISPs.forEach(a => {
        if (!dbKeys.has(canonKey(a.name))) ispRecords.unshift(a);
      });
    } catch (e) {}
    buildBgpCache();
    render();
  }

  // Event listeners
  if (searchEl) searchEl.addEventListener("input", () => { currentPage = 1; renderRows(); });
  if (fSite) fSite.addEventListener("change", () => { currentPage = 1; renderRows(); });
  if (fStatus) fStatus.addEventListener("change", () => { currentPage = 1; renderRows(); });
  if (fBgp) fBgp.addEventListener("change", () => { currentPage = 1; renderRows(); });

  // Add button
  const btnAdd = document.getElementById("btn-add-isp");
  if (btnAdd) btnAdd.addEventListener("click", openAddISP);

  // Open modal button (topbar)
  const openAddBtn = document.getElementById("open-add-asset");
  if (openAddBtn) openAddBtn.addEventListener("click", openAddISP);

  // Modal close/save
  const formClose = document.getElementById("isp-form-close");
  if (formClose) formClose.addEventListener("click", closeForm);
  const formCancel = document.getElementById("isp-form-cancel");
  if (formCancel) formCancel.addEventListener("click", closeForm);
  const formSave = document.getElementById("isp-form-save");
  if (formSave) formSave.addEventListener("click", saveISP);
  const formOverlay = document.getElementById("isp-form-overlay");
  if (formOverlay) formOverlay.addEventListener("click", (e) => { if (e.target === formOverlay) closeForm(); });

  // View modal close
  const viewClose = document.getElementById("isp-view-close");
  if (viewClose) viewClose.addEventListener("click", closeView);
  const viewCloseBtn = document.getElementById("isp-view-close-btn");
  if (viewCloseBtn) viewCloseBtn.addEventListener("click", closeView);
  const viewOverlay = document.getElementById("isp-view-overlay");
  if (viewOverlay) viewOverlay.addEventListener("click", (e) => { if (e.target === viewOverlay) closeView(); });

  // Escape
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeView(); closeForm(); } });

  init();
})();
