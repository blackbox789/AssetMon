

// ---- Sites: render kartu site + form Tambah Rack ----
// Rack baru disimpan ke localStorage/DB via saveRack() (rack-data.js)
// dan otomatis muncul di Rack Elevation.
// Site/lokasi: pilih site yang sudah ada (rack menambah hitungan kartu)
// atau pilih "Tambah site baru" untuk lokasi baru (membuat kartu baru).

(function () {
  const modal = document.getElementById("rack-modal");
  const addBtn = document.getElementById("add-rack-btn");
  const siteSel = document.getElementById("rack-site");
  const newSiteInput = document.getElementById("rack-site-new");
  const sizeSel = document.getElementById("rack-size");
  const idInput = document.getElementById("rack-id");
  const zoneInput = document.getElementById("rack-zone");
  const saveBtn = document.getElementById("rack-save-btn");
  const saveMsg = document.getElementById("rack-save-msg");
  const closeBtn = document.getElementById("rack-modal-close");
  const cancelBtn = document.getElementById("rack-modal-cancel");
  if (!modal || !addBtn || !siteSel || !newSiteInput || !sizeSel) return;

  const SITE_META = {
    DC1: { badge: "completed", badgeText: "Operational", power: "Normal", powerColor: "var(--accent-text)", uptime: "99.98", util: 84, fillClass: "", alert: "" },
    DC2: { badge: "completed", badgeText: "Operational", power: "Normal", powerColor: "var(--accent-text)", uptime: "99.99", util: 71, fillClass: "", alert: "" },
    DC3: { badge: "maintenance", badgeText: "Maintenance", power: "Terjadwal", powerColor: "var(--warning)", uptime: "99.91", util: 45, fillClass: "", alert: '<i class="fa-solid fa-screwdriver-wrench"></i>1 rack sedang maintenance terjadwal hingga 06 Agu', alertStyle: "" },
    DC4: { badge: "error", badgeText: "Degraded", power: "Warning", powerColor: "var(--danger)", uptime: "99.62", util: 92, fillClass: "crit", alert: '<i class="fa-solid fa-bolt"></i>Beban power mendekati kapasitas maksimum — perlu penambahan PDU', alertStyle: "color:var(--danger);background:var(--danger-dim);" },
  };

  function getSiteList() {
    const list = RACK_SITES.map(s => ({ id: s.id, name: s.name, loc: s.loc, zone: s.zone, custom: false }));
    const ids = new Set(list.map(s => s.id));
    const names = new Set(list.map(s => s.name.toLowerCase()));
    RACKS.forEach(r => {
      const siteName = String(r.siteName || r.site || "");
      if (!r.site || ids.has(r.site) || names.has(siteName.toLowerCase())) return;
      list.push({ id: r.site, name: siteName, loc: (r.loc && r.loc !== r.site) ? r.loc : siteName, zone: r.zone || "Zona A", custom: true });
      ids.add(r.site);
      names.add(siteName.toLowerCase());
    });
    return list;
  }

  function updateTotalStat() {
    const totalEl = document.getElementById("total-racks");
    if (totalEl) totalEl.textContent = RACKS.length;
  }

  function renderSiteCards() {
    const grid = document.getElementById("site-grid");
    if (!grid) return;
    updateTotalStat();
    grid.innerHTML = getSiteList().map(site => {
      const meta = SITE_META[site.id];
      const count = RACKS.filter(r => r.site === site.id || String(r.siteName || "").toLowerCase() === String(site.name).toLowerCase()).length;
      const racksUrl = "site-racks.html?site=" + encodeURIComponent(site.id);
      const assetUrl = site.custom ? "asset-list.html" : "asset-list.html?site=" + encodeURIComponent(site.id);
      const badge = meta ? meta.badge : "completed";
      const badgeText = meta ? meta.badgeText : "Operational";
      const power = meta ? meta.power : "Normal";
      const powerColor = meta ? meta.powerColor : "var(--accent-text)";
      const uptime = meta ? meta.uptime : "—";
      const util = meta ? meta.util : 0;
      const fillClass = meta ? meta.fillClass : "";
      const alert = meta && meta.alert ? `<div class="site-alert"${meta.alertStyle ? ' style="' + meta.alertStyle + '"' : ""}>${meta.alert}</div>` : "";
      return `
      <div class="card site-card" data-site="${site.id}">
        <div class="site-card-head">
          <div>
            <div class="site-name">${site.name}</div>
            <div class="site-loc"><i class="fa-solid fa-location-dot"></i>${site.loc}</div>
          </div>
          <div class="site-head-right">
            <span class="badge ${badge}"><span class="bdot"></span>${badgeText}</span>
            <button class="site-delete-btn" data-site="${site.id}" title="Hapus site (hanya bila 1 rack & tidak ada perangkat/kabel tersambung)"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="site-stats">
          <div class="site-stat" style="cursor:pointer;" onclick="location.href='${racksUrl}'" title="Lihat rack"><div class="k">Racks</div><div class="v" data-site-count="${site.id}">${count}</div></div>
          <div class="site-stat"><div class="k">Power</div><div class="v" style="font-size:13.5px;color:${powerColor};">${power}</div></div>
          <div class="site-stat"><div class="k">Uptime</div><div class="v" style="font-size:13.5px;">${uptime}</div></div>
        </div>
        <div class="util-row"><span style="font-size:11.5px;color:var(--text-muted);width:64px;">Utilisasi</span><div class="util-bar"><div class="util-fill ${fillClass}" style="width:${util}%"></div></div><span class="util-pct">${util}%</span></div>
        ${alert}
        <div class="site-card-foot"><button class="btn ghost" onclick="location.href='${assetUrl}'"><i class="fa-solid fa-list-ul"></i>Lihat Asset</button><button class="btn ghost" onclick="location.href='${racksUrl}'"><i class="fa-solid fa-server"></i>Lihat Rack</button></div>
      </div>`;
    }).join("");
  }
  renderSiteCards();

  RACK_HEIGHTS.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u + "U";
    if (u === 42) opt.selected = true;
    sizeSel.appendChild(opt);
  });

  function suggestRackId() {
    const used = RACKS.map(r => r.rackId);
    let n = used.length + 1;
    while (used.includes("RK-" + String(n).padStart(2, "0"))) n++;
    return "RK-" + String(n).padStart(2, "0");
  }

  function nextRackIdFor(siteId) {
    const site = RACK_SITES.find(s => s.id === siteId);
    if (!site) return suggestRackId();
    const taken = RACKS.filter(r => r.site === siteId).map(r => r.rackId);
    let i = 1;
    for (;;) {
      const row = String.fromCharCode(65 + Math.floor((i - 1) / 6));
      const id = site.prefix + "-" + row + String(i).padStart(2, "0");
      if (!taken.includes(id)) return id;
      i++;
    }
  }

  function populateSiteSelect() {
    siteSel.innerHTML = "";
    getSiteList().forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      siteSel.appendChild(opt);
    });
    const opt = document.createElement("option");
    opt.value = "__new__";
    opt.textContent = "＋ Tambah site baru…";
    siteSel.appendChild(opt);
  }
  populateSiteSelect();

  function onSiteChange() {
    const val = siteSel.value;
    const isNew = val === "__new__";
    newSiteInput.style.display = isNew ? "" : "none";
    if (isNew) {
      idInput.value = suggestRackId();
      zoneInput.value = "";
      if (newSiteInput) newSiteInput.focus();
      return;
    }
    const known = RACK_SITES.find(s => s.id === val);
    if (known) zoneInput.value = known.zone;
    else {
      const custom = getSiteList().find(s => s.id === val);
      if (custom) zoneInput.value = custom.zone;
    }
    idInput.value = nextRackIdFor(val);
  }

  function flash(msg, error) {
    saveMsg.innerHTML = msg;
    saveMsg.classList.toggle("error", !!error);
    saveMsg.classList.add("show");
  }

  let toastTimer = null;
  function toast(msg, isError) {
    const t = document.getElementById("site-toast");
    if (!t) { alert(String(msg).replace(/<[^>]*>/g, "")); return; }
    t.innerHTML = msg;
    t.classList.toggle("error", !!isError);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
  }

  // ---- Hapus site (hanya jika 1 rack & tidak ada perangkat/server/kabel) ----
  function siteRacksOf(site) {
    return RACKS.filter(r => r.site === site.id || String(r.siteName || "").toLowerCase() === String(site.name).toLowerCase());
  }

  function canDeleteSite(site) {
    const racks = siteRacksOf(site);
    if (!racks.length) return { ok: false, reason: '<i class="fa-solid fa-triangle-exclamation"></i> Site "' + site.name + '" tidak memiliki rack.' };
    if (racks.length > 1) return { ok: false, reason: '<i class="fa-solid fa-triangle-exclamation"></i> Site "' + site.name + '" memiliki ' + racks.length + ' rack — hanya bisa dihapus bila hanya ada 1 rack.' };
    const r = racks[0];
    if (r.totalDevices > 0) return { ok: false, reason: '<i class="fa-solid fa-triangle-exclamation"></i> Rack ' + r.rackId + ' masih berisi ' + r.totalDevices + ' perangkat (server/switch/PDU/firewall/patch) yang tersambung.' };
    if (typeof getServers === "function") {
      const n = getServers().filter(s => s.rack === r.rackId || s.site === r.site).length;
      if (n) return { ok: false, reason: '<i class="fa-solid fa-triangle-exclamation"></i> Rack ' + r.rackId + ' masih memiliki ' + n + ' server / kabel yang tersambung.' };
    }
    if (typeof POWER_DATA !== "undefined") {
      const pdus = ["PDU-" + r.rackId + "-A", "PDU-" + r.rackId + "-B", r.rackId + "-PDU-L", r.rackId + "-PDU-R"];
      const hasPower = pdus.some(k => POWER_DATA[k] && (POWER_DATA[k].rows || []).length);
      if (hasPower) return { ok: false, reason: '<i class="fa-solid fa-triangle-exclamation"></i> Rack ' + r.rackId + ' masih memiliki outlet PDU / kabel power yang terisi.' };
    }
    return { ok: true, reason: "" };
  }

  function deleteSite(site) {
    const chk = canDeleteSite(site);
    if (!chk.ok) { toast(chk.reason, true); return; }
    const rack = siteRacksOf(site)[0];
    if (!confirm('Hapus site "' + site.name + '" beserta rack ' + rack.rackId + '?\n\nSite hanya dapat dihapus bila hanya ada 1 rack dan tidak ada perangkat/kabel tersambung.')) return;
    if (deleteRack(rack.rackId)) {
      populateSiteSelect();
      renderSiteCards();
      toast('<i class="fa-solid fa-circle-check"></i> Site ' + site.name + ' beserta rack ' + rack.rackId + ' berhasil dihapus.');
    } else {
      toast('<i class="fa-solid fa-triangle-exclamation"></i> Gagal menghapus — coba lagi.', true);
    }
  }

  document.getElementById("site-grid").addEventListener("click", e => {
    const btn = e.target.closest(".site-delete-btn");
    if (!btn) return;
    const site = getSiteList().find(s => s.id === btn.dataset.site);
    if (site) deleteSite(site);
  });

  function openModal() {
    populateSiteSelect();
    onSiteChange();
    saveMsg.classList.remove("show", "error");
    modal.classList.add("open");
  }

  function closeModal() {
    modal.classList.remove("open");
  }

  addBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  siteSel.addEventListener("change", onSiteChange);

  saveBtn.addEventListener("click", () => {
    const val = siteSel.value;
    const isNew = val === "__new__";
    let siteId, siteName, siteLoc, siteZone;
    if (isNew) {
      const text = (newSiteInput.value || "").trim();
      if (!text) {
        flash('<i class="fa-solid fa-triangle-exclamation"></i> Nama site baru wajib diisi.', true);
        return;
      }
      siteId = text;
      siteName = text;
      siteLoc = text;
      siteZone = (zoneInput.value || "Zona A").trim();
    } else {
      const known = RACK_SITES.find(s => s.id === val);
      if (known) {
        siteId = known.id;
        siteName = known.name;
        siteLoc = known.loc;
        siteZone = (zoneInput.value || known.zone).trim();
      } else {
        const custom = getSiteList().find(s => s.id === val);
        if (!custom) {
          flash('<i class="fa-solid fa-triangle-exclamation"></i> Pilih site atau tambah site baru.', true);
          return;
        }
        siteId = custom.id;
        siteName = custom.name;
        siteLoc = custom.loc;
        siteZone = (zoneInput.value || custom.zone).trim();
      }
    }

    const rackId = (idInput.value || "").trim().toUpperCase();
    if (!rackId) {
      flash('<i class="fa-solid fa-triangle-exclamation"></i> Rack ID wajib diisi.', true);
      return;
    }
    if (RACKS.some(r => r.rackId === rackId)) {
      flash('<i class="fa-solid fa-triangle-exclamation"></i> Rack ID "' + rackId + '" sudah terdaftar. Gunakan ID lain.', true);
      return;
    }

    const entry = saveRack({
      rackId,
      site: siteId,
      siteName,
      loc: siteLoc,
      zone: siteZone,
      size: sizeSel.value,
      status: document.getElementById("rack-status").value,
    });
    if (!entry) {
      flash('<i class="fa-solid fa-triangle-exclamation"></i> Gagal menyimpan — penyimpanan browser/server tidak tersedia.', true);
      return;
    }

    populateSiteSelect();
    siteSel.value = entry.site;
    renderSiteCards();
    flash('<i class="fa-solid fa-circle-check"></i> Rack ' + entry.rackId + ' (' + entry.size + 'U) berhasil ditambahkan di ' + entry.siteName + ' — buka menu Rack Elevation untuk melihatnya.');
    setTimeout(() => { closeModal(); }, 1800);
  });
})();
