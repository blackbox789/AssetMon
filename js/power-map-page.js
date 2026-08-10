/* ============================================
   Power Map — halaman direktori pemetaan daya.
   Tab PDU: outlet terpakai + total beban per PDU.
   Tab Perangkat: konsumen daya + sumber PDU/outlet.
   Klik "Buka Power Map" / "Lihat Power" → openPowerMap.
   ============================================ */

function pwPduRows() {
  const seen = new Set();
  const out = [];
  PDU_DATA.forEach(p => {
    const pm = POWER_DATA[p.name] || { ports: p.ports, rows: [] };
    seen.add(p.name);
    out.push({
      name: p.name,
      rack: p.rack || "",
      pos: p.pos || "",
      type: p.type || "vertical",
      ports: pm.ports || p.ports,
      rows: Array.isArray(pm.rows) ? pm.rows : [],
      status: p.status || "online",
      brand: p.brand || "",
      model: p.model || "",
      ip: p.ip || "",
    });
  });
  Object.keys(POWER_DATA).forEach(k => {
    if (seen.has(k)) return;
    const d = POWER_DATA[k];
    out.push({
      name: k, rack: "", pos: "", type: "vertical",
      ports: d.ports, rows: Array.isArray(d.rows) ? d.rows : [], status: "online",
      brand: "", model: "", ip: "",
    });
  });
  return out;
}

function pwDeviceRows() {
  const map = new Map();
  Object.keys(POWER_DATA).forEach(pdu => {
    const d = POWER_DATA[pdu];
    (Array.isArray(d.rows) ? d.rows : []).forEach(r => {
      const dev = r.device || "";
      if (!dev || dev === "—") return;
      const cur = map.get(dev) || { name: dev, watt: 0, count: 0, sources: [] };
      cur.watt += r.watt || 0;
      cur.count += 1;
      cur.sources.push(`${pdu} · Out ${r.outlet}${r.label ? " [" + r.label + "]" : ""}`);
      map.set(dev, cur);
    });
  });
  return [...map.values()];
}

let PW_PDUS = [];
let PW_DEVICES = [];
let PW_TAB = "pdus";

function pwStatusBadge(status) {
  const map = {
    online: '<span class="badge online"><span class="bdot"></span>Online</span>',
    offline: '<span class="badge offline"><span class="bdot"></span>Offline</span>',
    maintenance: '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>',
  };
  return map[status] || map.online;
}

function pwRender() {
  const q = (document.getElementById("top-search").value || "").trim().toLowerCase();
  const type = document.getElementById("filter-type").value;

  if (PW_TAB === "pdus") {
    const rows = PW_PDUS.filter(p => {
      const mt = type === "all" || p.status === type;
      const mq = !q || [p.name, p.rack, p.ip, p.brand, p.model].join(" ").toLowerCase().includes(q);
      return mt && mq;
    });
    document.getElementById("pm-tbody").innerHTML = rows.map(p => {
      const watt = p.rows.reduce((s, r) => s + (r.watt || 0), 0);
      const pct = p.ports ? Math.round(p.rows.length / p.ports * 100) : 0;
      const cls = pct >= 90 ? "crit" : pct >= 75 ? "warn" : "";
      return `<tr data-pm-name="${escPM(p.name)}">
        <td><div class="strong">${escPM(p.name)}</div><div class="mono" style="font-size:11px;">${escPM([p.brand, p.model].filter(Boolean).join(" ")) || "&nbsp;"}</div></td>
        <td class="mono">${escPM([p.rack, p.pos].filter(Boolean).join(" · ")) || "—"}</td>
        <td><div class="outlet-cell"><span class="outlet-nums">${p.rows.length}/${p.ports} terpakai</span><div class="outlet-bar"><div class="outlet-fill ${cls}" style="width:${Math.min(100, pct)}%"></div></div></div></td>
        <td class="mono">${watt} W</td>
        <td>${pwStatusBadge(p.status)}</td>
        <td><button class="btn primary pw-open-btn" style="padding:7px 12px;font-size:12px;" data-name="${escPM(p.name)}"><i class="fa-solid fa-plug"></i> Buka Power Map</button></td>
      </tr>`;
    }).join("");
    document.getElementById("filter-count").textContent = `Menampilkan ${rows.length} dari ${PW_PDUS.length} PDU${rows.length === PW_PDUS.length ? "" : " (setelah filter)"}`;
  } else {
    const rows = PW_DEVICES.filter(d => !q || d.name.toLowerCase().includes(q));
    document.getElementById("dev-tbody").innerHTML = rows.map(d => `
      <tr data-pm-name="${escPM(d.name)}">
        <td><div class="strong">${escPM(d.name)}</div></td>
        <td class="mono">${d.count} PSU</td>
        <td class="mono">${d.watt} W</td>
        <td class="mono" style="color:var(--text-muted);font-size:11.5px;">${d.sources.map(escPM).join(" · ")}</td>
        <td><button class="btn primary pw-dev-btn" style="padding:7px 12px;font-size:12px;" data-name="${escPM(d.name)}"><i class="fa-solid fa-server"></i> Lihat Power</button></td>
      </tr>`).join("");
    document.getElementById("filter-count").textContent = `Menampilkan ${rows.length} dari ${PW_DEVICES.length} perangkat${rows.length === PW_DEVICES.length ? "" : " (setelah filter)"}`;
  }
  pwUpdateStats();
}

function pwUpdateStats() {
  document.getElementById("stat-total").textContent = PW_PDUS.length;
  document.getElementById("stat-used").textContent = PW_PDUS.reduce((s, p) => s + p.rows.length, 0);
  document.getElementById("stat-watt").textContent = PW_PDUS.reduce((s, p) => s + p.rows.reduce((x, r) => x + (r.watt || 0), 0), 0);
  document.getElementById("stat-devices").textContent = PW_DEVICES.length;
}

function pwRefresh() {
  PW_PDUS = pwPduRows();
  PW_DEVICES = pwDeviceRows();
  pwRender();
}

["top-search", "filter-type"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", pwRender);
});

document.querySelectorAll(".tab-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".tab-pill").forEach(p => p.classList.toggle("active", p === pill));
    PW_TAB = pill.dataset.tab;
    document.getElementById("tab-pdus").style.display = PW_TAB === "pdus" ? "" : "none";
    document.getElementById("tab-devices").style.display = PW_TAB === "devices" ? "" : "none";
    pwRender();
  });
});

document.getElementById("pm-tbody").addEventListener("click", e => {
  const btn = e.target.closest(".pw-open-btn");
  if (!btn) return;
  openPowerMap(btn.dataset.name);
});

document.getElementById("dev-tbody").addEventListener("click", e => {
  const btn = e.target.closest(".pw-dev-btn");
  if (!btn) return;
  openPowerMap(btn.dataset.name);
});

PW_PDUS = pwPduRows();
PW_DEVICES = pwDeviceRows();
pwRender();

// ---- Deep-link: power-map.html?device=KEY → buka Power Map perangkat/PDU itu ----
(function pwOpenFromQuery() {
  const dev = new URLSearchParams(location.search).get("device");
  if (!dev) return;
  const isPdu = PW_PDUS.some(p => (p.name || "").toLowerCase() === dev.toLowerCase());
  const tab = isPdu ? "pdus" : "devices";
  const pill = document.querySelector(`.tab-pill[data-tab="${tab}"]`);
  if (pill) pill.click();
  const searchEl = document.getElementById("top-search");
  if (searchEl) { searchEl.value = dev; pwRender(); }
  openPowerMap(dev, false, isPdu ? 0 : 2);
})();
