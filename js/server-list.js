/* ============================================
   RackView — Server List
   Render tabel server + ringkasan identitas
   perangkat dari getServers() (server-data.js).
   ============================================ */

const tbody = document.getElementById("srv-tbody");
const srvSearch = document.getElementById("srv-search");
const fSite = document.getElementById("f-site");
const fType = document.getElementById("f-type");
const fCond = document.getElementById("f-cond");
const countText = document.getElementById("srv-count-text");
const detailBody = document.getElementById("detail-body");

let servers = [];
let selectedId = null;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const PAGE_SIZE_KEY = "rv_page_size";
function getPageSize() {
  const v = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || "", 10);
  return PAGE_SIZE_OPTIONS.includes(v) ? v : 50;
}
let currentPage = 1;

const COND_CLASS = { "Active": "online", "Standby": "maintenance", "Decommissioned": "offline" };
const COND_MAP = { active: "Active", standby: "Standby", decom: "Decommissioned" };
const TYPE_LABEL = { rack: "Rack Server", blade: "Blade Server", cloud: "Cloud Server", tower: "Tower Server" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function condClass(kondisi) {
  return COND_CLASS[kondisi] || "disabled";
}

function typeLabel(t) {
  return TYPE_LABEL[t] || t;
}

function srvWarnBadge(s) {
  const n = srvSummaryProblemCount(s);
  if (!n) return "";
  return `<span class="srv-warn-badge" title="${n} komponen bermasalah (drive/modul di Ringkasan Identitas Perangkat)"><i class="fa-solid fa-triangle-exclamation"></i> ${n}</span> `;
}

function fmtHost(s) {
  const host = s.hostname || (s.nodes && s.nodes.length ? `Chassis · ${s.nodes.length} node` : "—");
  const sub = s.serial || (s.nodes ? `${s.nodeTotal || "—"} slot` : "");
  return `<div class="strong">${srvWarnBadge(s)}${esc(host)}</div><div class="mono" style="font-size:11px;">${esc(sub)}</div>`;
}

function fmtRack(s) {
  const r = s.rack && s.rack !== "-" ? s.rack : "—";
  const u = s.posisiU && s.posisiU !== "-" ? s.posisiU : "—";
  return `<div>${esc(r)}</div><div class="mono" style="font-size:11px;">${esc(u)}</div>`;
}

function matchFilters(s) {
  const q = (srvSearch.value || "").trim().toLowerCase();
  const site = fSite.value, type = fType.value, cond = fCond.value;
  if (site !== "all" && s.site !== site) return false;
  if (type !== "all" && s.tipeServer !== type) return false;
  if (cond !== "all" && COND_MAP[s.kondisi] !== undefined && s.kondisi !== cond) return false;
  if (cond !== "all" && COND_MAP[s.kondisi] === undefined && s.kondisi !== cond) return false;
  if (q) {
    const nodeHosts = (s.nodes || []).map(n => n.hostname).join(" ");
    const hay = [s.hostname, s.serial, s.model, s.vendor, s.siteName, s.rack, s.assetTag, nodeHosts, ...(s.tags || [])].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderStats() {
  const all = servers;
  document.getElementById("st-total").textContent = all.length.toLocaleString("id-ID");
  document.getElementById("st-active").textContent = all.filter(s => s.kondisi === "Active").length;
  document.getElementById("st-standby").textContent = all.filter(s => s.kondisi === "Standby").length;
  document.getElementById("st-decom").textContent = all.filter(s => s.kondisi === "Decommissioned").length;
  const sites = new Set(all.map(s => s.siteName || s.site).filter(Boolean)).size;
  document.getElementById("st-total-sub").textContent = `${sites} site · ${new Set(all.map(s => s.vendor)).size} vendor`;
}

function renderPagination(total) {
  const wrap = document.getElementById("srv-pagination");
  if (!wrap) return;
  const size = getPageSize();
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, currentPage), pages);
  currentPage = page;
  const sizeSel = `<select id="pg-size" class="pg-size-select" title="Jumlah server per halaman">${
    PAGE_SIZE_OPTIONS.map(n => `<option value="${n}"${n === size ? " selected" : ""}>${n}/hlm</option>`).join("")
  }</select>`;
  const btns = [];
  btns.push(sizeSel);
  btns.push(`<button type="button" data-pg="prev" ${page === 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`);
  const shown = new Set([1, pages, page, page - 1, page + 1].filter(p => p >= 1 && p <= pages));
  let last = 0;
  [...shown].sort((a, b) => a - b).forEach(p => {
    if (p - last > 1) btns.push(`<span class="pg-info">…</span>`);
    btns.push(`<button type="button" data-pg="${p}" class="${p === page ? "active" : ""}">${p}</button>`);
    last = p;
  });
  btns.push(`<button type="button" data-pg="next" ${page === pages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`);
  btns.push(`<span class="pg-info">${total} server</span>`);
  wrap.innerHTML = btns.join("");
  const sizeSelEl = document.getElementById("pg-size");
  if (sizeSelEl) {
    sizeSelEl.addEventListener("change", () => {
      const n = parseInt(sizeSelEl.value, 10);
      localStorage.setItem(PAGE_SIZE_KEY, String(n));
      currentPage = 1;
      render();
    });
  }
  wrap.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      const v = b.dataset.pg;
      const next = v === "prev" ? currentPage - 1 : v === "next" ? currentPage + 1 : parseInt(v, 10);
      goToPage(next);
    });
  });
}

function goToPage(page) {
  const total = servers.filter(matchFilters).length;
  const pages = Math.max(1, Math.ceil(total / getPageSize()));
  currentPage = Math.min(Math.max(1, page), pages);
  renderRows();
}

function renderRows() {
  const list = servers.filter(matchFilters);
  const size = getPageSize();
  const pages = Math.max(1, Math.ceil(list.length / size));
  currentPage = Math.min(Math.max(1, currentPage), pages);
  const start = (currentPage - 1) * size;
  const pageList = list.slice(start, start + size);
  const from = list.length ? start + 1 : 0;
  const to = Math.min(start + size, list.length);
  countText.textContent = list.length
    ? `Menampilkan ${from}–${to} dari ${list.length} server`
    : "Menampilkan 0 server";
  renderPagination(list.length);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:28px;">Tidak ada server yang cocok dengan filter.</td></tr>`;
    return;
  }
  tbody.innerHTML = pageList.map(s => {
    const active = s.id === selectedId;
    return `<tr data-id="${esc(s.id)}" class="${active ? "row-selected" : ""}">
      <td>${fmtHost(s)}</td>
      <td><span class="type-chip server"><span class="dot"></span>${esc(typeLabel(s.tipeServer))}</span></td>
      <td>${esc(s.formFactor || "—")}</td>
      <td>${esc(s.vendor || "—")}</td>
      <td>${esc(s.model || "—")}</td>
      <td>${esc(s.dimmInstalled || "—")}</td>
      <td>${fmtRack(s)}</td>
      <td>${esc(s.hypervisor || s.os || "—")}</td>
      <td><span class="badge ${condClass(s.kondisi)}"><span class="bdot"></span>${esc(s.kondisi)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="row-action" title="Buka Power Map" data-srv-power><i class="fa-solid fa-plug"></i></button>
          <button type="button" class="row-action" title="Lihat ringkasan" data-srv-view><i class="fa-solid fa-eye"></i></button>
          <button type="button" class="row-action" title="Edit server" data-srv-edit><i class="fa-solid fa-pen"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("[data-srv-view]") || e.target.closest("[data-srv-edit]") || e.target.closest("[data-srv-power]")) return;
      selectedId = tr.dataset.id;
      tbody.querySelectorAll("tr").forEach(r => r.classList.toggle("row-selected", r === tr));
      renderDetail(servers.find(s => s.id === selectedId));
    });
  });
  tbody.querySelectorAll("[data-srv-power]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const s = servers.find(x => x.id === btn.closest("tr").dataset.id);
      if (!s) return;
      const key = encodeURIComponent(s.hostname || s.id || "");
      if (key) window.open("power-map.html?device=" + key, "_blank", "noopener");
    });
  });
  tbody.querySelectorAll("[data-srv-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = servers.find(x => x.id === btn.closest("tr").dataset.id);
      if (s) openSrvView(s);
    });
  });
  tbody.querySelectorAll("[data-srv-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (typeof window.openServerEdit === "function") window.openServerEdit(btn.closest("tr").dataset.id);
      else window.location.href = "server-form.html?edit=" + encodeURIComponent(btn.closest("tr").dataset.id);
    });
  });
}

function openSrvView(s) {
  const body = document.getElementById("srv-view-body");
  const overlay = document.getElementById("srv-view-overlay");
  const editBtn = document.getElementById("srv-view-edit-btn");
  if (!body || !overlay) return;
  body.innerHTML = buildServerSummaryHTML(s);
  if (editBtn) {
    editBtn.href = "#";
    editBtn.onclick = (e) => {
      e.preventDefault();
      closeSrvView();
      if (typeof window.openServerEdit === "function") window.openServerEdit(s.id);
    };
  }
  overlay.classList.add("open");
}

window.reloadServerList = function () {
  servers = getServers();
  if (selectedId && !servers.some(x => x.id === selectedId)) {
    selectedId = null;
    renderDetail(null);
  }
  render();
};

function closeSrvView() {
  const overlay = document.getElementById("srv-view-overlay");
  if (overlay) overlay.classList.remove("open");
}

if (document.getElementById("srv-view-close")) {
  document.getElementById("srv-view-close").addEventListener("click", closeSrvView);
  document.getElementById("srv-view-close-btn").addEventListener("click", closeSrvView);
  document.getElementById("srv-view-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSrvView();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSrvView();
});

function renderDetail(s) {
  if (!s) {
    detailBody.innerHTML = `<div class="form-hint">Pilih server pada tabel untuk melihat ringkasan.</div>`;
    return;
  }
  detailBody.innerHTML = buildServerSummaryHTML(s);
}

function render() {
  renderStats();
  renderRows();
}

function init() {
  servers = getServers();
  const siteSet = [...new Map(servers.map(s => [s.site, s.siteName || s.site])).entries()];
  fSite.innerHTML = `<option value="all">Semua Site</option>` + siteSet
    .filter(([id]) => id)
    .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
  render();
}

if (srvSearch) srvSearch.addEventListener("input", () => { currentPage = 1; render(); });
if (fSite) fSite.addEventListener("change", () => { currentPage = 1; render(); });
if (fType) fType.addEventListener("change", () => { currentPage = 1; render(); });
if (fCond) fCond.addEventListener("change", () => { currentPage = 1; render(); });

const btnAddServer = document.getElementById("btn-add-server");
if (btnAddServer) {
  btnAddServer.addEventListener("click", () => {
    if (typeof window.openServerAdd === "function") window.openServerAdd();
    else window.location.href = "server-form.html";
  });
}

if (tbody) init();
