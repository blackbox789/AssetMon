
/* ============================================
   RackView — Capacity Matrix
   Grid heatmap kapasitas rack per site.
   Metrik: Utilisasi U · Perangkat · Daya (W)
   Klik sel -> buka rack-elevation?rack=ID
   ============================================ */

(function () {
  const cmSite = document.getElementById("cm-site");
  const cmMetrics = document.getElementById("cm-metrics");
  const matrixEl = document.getElementById("cm-matrix");
  let metric = "util";

  const fmt = n => (n || 0).toLocaleString("id-ID");

  // Daya per rack dari POWER_DATA (via PDU_DATA -> rack)
  const PDU_RACK = {};
  PDU_DATA.forEach(p => { PDU_RACK[p.name] = p.rack; });
  const rackPower = {};
  Object.entries(POWER_DATA).forEach(([pdu, d]) => {
    const rack = PDU_RACK[pdu];
    if (!rack) return;
    const w = d.rows.reduce((a, r) => a + r.watt, 0);
    rackPower[rack] = (rackPower[rack] || 0) + w;
  });

  function heatStyle(pct, na) {
    if (na) return "";
    const color = pct >= 0.9 ? "var(--danger)" : pct >= 0.75 ? "var(--warning)" : pct >= 0.5 ? "#F97316" : "var(--accent)";
    const alpha = 16 + Math.round(Math.min(1, Math.max(0, pct)) * 52);
    return `background:color-mix(in srgb, ${color} ${alpha}%, var(--bg-surface-2));border-color:color-mix(in srgb, ${color} 55%, transparent);`;
  }

  function cell(rack, pct, val, sub, na) {
    const dot = rack.status === "degraded" ? "warn" : rack.status === "maintenance" ? "maint" : "ok";
    const title = `${rack.rackId} · ${rack.zone} · ${rack.util}% U · ${rack.totalDevices} perangkat · ${rack.status}`;
    return `<a class="cm-cell ${na ? "na" : ""}" href="rack-elevation.html?rack=${rack.rackId}" title="${title}" style="${heatStyle(pct, na)}">
      <div class="cm-cell-top"><span class="cm-cell-id">${rack.rackId}</span><span class="cm-cell-dot ${dot}"></span></div>
      <div class="cm-cell-val">${val}</div>
      <div class="cm-cell-sub">${sub}</div>
    </a>`;
  }

  function render() {
    const sites = RACK_SITES.filter(s => cmSite.value === "all" || s.id === cmSite.value);
    const racks = RACKS.filter(r => cmSite.value === "all" || r.site === cmSite.value);
    const maxDevices = Math.max(1, ...racks.map(r => r.totalDevices));
    const maxPower = Math.max(1, ...racks.map(r => rackPower[r.rackId] || 0));

    matrixEl.innerHTML = sites.map(site => {
      const sracks = racks.filter(r => r.site === site.id);
      const utilList = sracks.map(r => r.util);
      const avg = utilList.length ? Math.round(utilList.reduce((a, b) => a + b, 0) / utilList.length) : 0;
      const crit = utilList.filter(u => u >= 90).length;
      const devices = sracks.reduce((a, r) => a + r.totalDevices, 0);

      const cells = sracks.map(r => {
        if (metric === "util") {
          return cell(r, r.util / 100, r.util + "%", `${r.totalDevices} perangkat`);
        }
        if (metric === "devices") {
          return cell(r, r.totalDevices / maxDevices, fmt(r.totalDevices), `${r.util}% U`);
        }
        const w = rackPower[r.rackId] || 0;
        const na = w === 0;
        return cell(r, w / maxPower, na ? "—" : fmt(w) + " W", na ? "tanpa data PDU" : "beban terukur", na);
      }).join("");

      return `<div class="cm-site card">
        <div class="cm-site-head">
          <div>
            <div class="card-title" style="font-size:14px;">${site.name}</div>
            <div class="card-title-sub">${site.loc} · ${sracks.length} rack · rata-rata ${avg}% U · ${fmt(crit)} kritis (≥90%)</div>
          </div>
          <div class="cm-site-stats">
            <span><b>${sracks.length}</b> Rack</span>
            <span><b>${fmt(devices)}</b> Perangkat</span>
            <span><b>${avg}%</b> Rata-rata U</span>
          </div>
        </div>
        <div class="cm-grid">${cells}</div>
      </div>`;
    }).join("");
  }

  cmSite.addEventListener("change", render);
  cmMetrics.querySelectorAll(".cm-metric").forEach(btn => {
    btn.addEventListener("click", () => {
      cmMetrics.querySelectorAll(".cm-metric").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      metric = btn.dataset.metric;
      render();
    });
  });

  render();
})();
