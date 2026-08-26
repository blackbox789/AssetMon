

// ---- Sites: render kartu site + form Tambah Rack ----
// Rack baru disimpan ke localStorage/DB via saveRack() (rack-data.js)
// dan otomatis muncul di Rack Elevation.
// Site/lokasi: pilih site yang sudah ada (rack menambah hitungan kartu)
// atau pilih "Tambah site baru" untuk lokasi baru (membuat kartu baru).

(function () {
  const modal = document.getElementById("rack-modal");

  function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
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
    DC3: { badge: "completed", badgeText: "Operational", power: "Normal", powerColor: "var(--accent-text)", uptime: "99.91", util: 45, fillClass: "" },
    DC4: { badge: "error", badgeText: "Degraded", power: "Warning", powerColor: "var(--danger)", uptime: "99.62", util: 92, fillClass: "crit", alert: '<i class="fa-solid fa-bolt"></i>Beban power mendekati kapasitas maksimum — perlu penambahan PDU', alertStyle: "color:var(--danger);background:var(--danger-dim);" },
  };

  // ---- Alert maintenance: RECORD modul Maintenance (OPS) + fallback status RACKS ----
  // Rendering pertama memakai status rack (sinkron). Setelah data OPS dimuat,
  // refreshMaintenanceAlerts() memperbarui alert dari record Maintenance sungguhan
  // (no MT, periode, rack) supaya selaras dengan jadwal di modul Maintenance.
  function maintenanceAlert(siteId) {
    const maintRacks = RACKS.filter(r => (r.site === siteId || String(r.siteName || "").toLowerCase().indexOf(String(siteId).toLowerCase()) >= 0) && r.status === "maintenance");
    if (!maintRacks.length) return "";
    const list = maintRacks.map(r => '<a class="site-alert-link" href="rack-elevation.html?rack=' + encodeURIComponent(r.rackId) + '">' + r.rackId + '</a>').join(", ");
    const n = maintRacks.length;
    return '<i class="fa-solid fa-screwdriver-wrench"></i>' + n + " rack sedang maintenance terjadwal — <b>" + list + "</b><div class=\"site-alert-sub\">Maintenance berlangsung; hindari penambahan perangkat hingga selesai.</div>";
  }

  async function refreshMaintenanceAlerts() {
    if (!window.RackOps) return;
    try {
      const activeRacks = await RackOps.activeRacks();
      const sites = getSiteList();
      for (const site of sites) {
        const el = document.querySelector('[data-site-alert="' + site.id + '"]');
        if (!el) continue;
        const racksHere = RACKS.filter(r => r.site === site.id || String(r.siteName || "").toLowerCase() === String(site.name).toLowerCase());
        const matches = racksHere.map(r => r.rackId).filter(id => activeRacks[id]);
        if (matches.length) {
          const n = matches.length;
          const links = matches.map(id => {
            const rec = activeRacks[id].first;
            const no = rec && rec.no ? ' · <a class="site-alert-link" href="maintenance.html?q=' + encodeURIComponent(rec.no) + '">' + rec.no + '</a>' : "";
            const when = rec && rec.scheduled_at ? ' · ' + (rec.scheduled_at || "").slice(0, 10) : "";
            return '<a class="site-alert-link" href="rack-elevation.html?rack=' + encodeURIComponent(id) + '">' + id + '</a>' + no + when;
          });
          const maintHtml = '<i class="fa-solid fa-screwdriver-wrench"></i>' + n + " maintenance aktif terjadwal — <b>" + links.join("</b> & <b>") + "</b><div class=\"site-alert-sub\">Lihat modul Maintenance untuk detail jadwal &amp; progress.</div>";
          const metaHtml = el.dataset.metaAlert ? '<div class="site-alert-sub" style="margin-top:6px;">' + el.dataset.metaAlert + '</div>' : "";
          el.className = "site-alert";
          el.style.cssText = el.dataset.metaStyle || "";
          el.innerHTML = maintHtml + metaHtml;
        } else if (el.dataset.rackFallback) {
          // Tidak ada record aktif dari modul — fallback ke status rack (RACKS).
          el.className = "site-alert";
          el.style.cssText = el.dataset.metaStyle || "";
          el.innerHTML = el.dataset.rackFallback + (el.dataset.metaAlert ? '<div class="site-alert-sub" style="margin-top:6px;">' + el.dataset.metaAlert + '</div>' : "");
        } else if (el.dataset.metaAlert) {
          // Alert tetap (mis. DC4 power warning) — tampilkan kembali bila terhidden.
          el.className = "site-alert";
          el.style.cssText = el.dataset.metaStyle || "";
          el.innerHTML = el.dataset.metaAlert;
        } else {
          el.style.display = "none";
        }
      }
    } catch (e) {}
  }

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
    // Statistik live dari devices registry (SQLite) — bukan snapshot statis
    let live = {};
    try {
      const devs = typeof apiGetDevices === "function" ? (apiGetDevices() || []) : [];
      devs.forEach(d => {
        const sid = String(d.site || "").toUpperCase();
        if (!sid) return;
        live[sid] = live[sid] || { devices: 0, racksUsed: new Set() };
        live[sid].devices++;
        if (d.rackId) live[sid].racksUsed.add(d.rackId);
      });
    } catch (e) { /* offline */ }
    grid.innerHTML = getSiteList().map(site => {
      const meta = SITE_META[site.id];
      const count = RACKS.filter(r => r.site === site.id || String(r.siteName || "").toLowerCase() === String(site.name).toLowerCase()).length;
      const lv = live[String(site.id).toUpperCase()] || { devices: 0, racksUsed: new Set() };
      const racksUsed = lv.racksUsed.size;
      const util = count ? Math.min(100, Math.round(racksUsed / count * 100)) : 0;
      const utilLabel = `${racksUsed}/${count} rack`;
      const racksUrl = "site-racks.html?site=" + encodeURIComponent(site.id);
      const assetUrl = site.custom ? "asset-list.html" : "asset-list.html?site=" + encodeURIComponent(site.id);
      const badge = meta ? meta.badge : "completed";
      const badgeText = meta ? meta.badgeText : "Operational";
      const power = meta ? meta.power : "Normal";
      const powerColor = meta ? meta.powerColor : "var(--accent-text)";
      const uptime = meta ? meta.uptime : "—";
      const maintAlert = maintenanceAlert(site.id);
      const metaAlert = meta && meta.alert ? meta.alert : "";
      const metaStyle = meta && meta.alert ? (meta.alertStyle || "") : "";
      let alertStyle = "";
      if (!maintAlert && !metaAlert) alertStyle = "display:none;";
      else if (!maintAlert && metaStyle) alertStyle = metaStyle;
      const fillClass = util >= 80 ? "danger" : util >= 50 ? "warning" : "";
      const alertHtml = `<div class="site-alert" data-site-alert="${site.id}" data-rack-fallback="${escapeAttr(maintAlert || "")}" data-meta-alert="${escapeAttr(metaAlert || "")}" data-meta-style="${escapeAttr(metaStyle || "")}"${alertStyle ? ' style="' + alertStyle + '"' : ""}>${maintAlert || metaAlert}</div>`;
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
          <div class="site-stat" style="cursor:pointer;" onclick="openRackQuickView('${site.id}')" title="Lihat ringkasan rack"><div class="k">Racks</div><div class="v" data-site-count="${site.id}">${count}</div></div>
          <div class="site-stat"><div class="k">Power</div><div class="v" style="font-size:13.5px;color:${powerColor};">${power}</div></div>
          <div class="site-stat"><div class="k">Device</div><div class="v" style="font-size:13.5px;">${lv.devices}</div></div>
          <div class="site-stat"><div class="k">Uptime</div><div class="v" style="font-size:13.5px;">${uptime}</div></div>
        </div>
        <div class="util-row"><span style="font-size:11.5px;color:var(--text-muted);width:64px;">Rak terpakai</span><div class="util-bar"><div class="util-fill ${fillClass}" style="width:${util}%"></div></div><span class="util-pct" title="${utilLabel}">${util}%</span></div>
        ${alertHtml}
        <div class="site-card-foot"><button class="btn ghost" onclick="location.href='${assetUrl}'"><i class="fa-solid fa-list-ul"></i>Lihat Asset</button><button class="btn ghost" onclick="location.href='${racksUrl}'"><i class="fa-solid fa-server"></i>Lihat Rack</button></div>
      </div>`;
    }).join("");
  }
  renderSiteCards();
  refreshMaintenanceAlerts();

  // ---- Quick view rack: modal mini rack elevation per site ----
  const RQ_TINTS = { server: "#8fbfea", switch: "#85d8cf", pdu: "#b7a3e3", firewall: "#f5c78c", patch: "#a5aebd", tower: "#a8d5a5", storage: "#f97316", ups: "#eab308" };
  function rqMiniRack(rack, devs, usedTotal) {
    const size = rack.size || 42;
    const px = Math.max(90, Math.min(150, size * 3));
    const hUnit = px / size;
    let blocks = "";
    const layout = (typeof RACK_LAYOUTS !== "undefined") ? RACK_LAYOUTS[rack.rackId] : null;
    if (layout && layout.length) {
      layout.forEach(d => {
        if (!d || d.type === "blank" || !d.start) return;
        const st = Math.min(d.start, d.end || d.start), en = Math.max(d.start, d.end || d.start);
        const top = (st - 1) * hUnit;
        const h = Math.max(2, (en - st + 1) * hUnit - 1);
        blocks += '<div class="mq-block" style="top:' + top.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;background:' + (RQ_TINTS[d.type] || "#8a8f98") + '" title="' + String(d.name || "").replace(/"/g, "") + '"></div>';
      });
    } else {
      // fallback generik: device terdaftar (berwarna tipe) + sisa snapshot totalDevices (netral)
      devs.slice(0, size).forEach((d, i) => {
        blocks += '<div class="mq-block" style="bottom:' + (i * hUnit).toFixed(1) + 'px;height:' + Math.max(2, hUnit - 1).toFixed(1) + 'px;background:' + (RQ_TINTS[d.type] || "#8a8f98") + '"></div>';
      });
      const extra = Math.max(0, Math.min(size, usedTotal|0) - devs.length);
      for (let i = devs.length; i < devs.length + extra; i++) {
        blocks += '<div class="mq-block" style="bottom:' + (i * hUnit).toFixed(1) + 'px;height:' + Math.max(2, hUnit - 1).toFixed(1) + 'px;background:#8a8f98"></div>';
      }
    }
    const emptyTag = usedTotal ? "" : '<span class="mq-empty">KOSONG</span>';
    return '<div class="mq-frame" style="height:' + px + 'px"><div class="mq-blocks">' + blocks + "</div>" + emptyTag + "</div>";
  }
  function openRackQuickView(siteId) {
    const site = getSiteList().find(s => s.id === siteId) || { id: siteId, name: siteId };
    const racks = RACKS.filter(r => r.site === siteId || String(r.siteName || "").toLowerCase() === String(site.name).toLowerCase())
      .sort((a, b) => a.rackId.localeCompare(b.rackId));
    let devByRack = {};
    try {
      const devs = typeof apiGetDevices === "function" ? (apiGetDevices() || []) : [];
      devs.forEach(d => {
        const rk = String(d.rackId || "").toUpperCase();
        if (!rk) return;
        (devByRack[rk] = devByRack[rk] || []).push({ type: String(d.type || "").toLowerCase(), name: d.deviceKey });
      });
    } catch (e) { /* offline */ }
    document.getElementById("rq-site-name").textContent = site.name;
    const grid = document.getElementById("rq-grid");
    grid.innerHTML = racks.map(r => {
      const devs = devByRack[String(r.rackId).toUpperCase()] || [];
      const used = Math.max(devs.length, (r.totalDevices | 0));
      const pct = r.size ? Math.min(100, Math.round(used / r.size * 100)) : 0;
      return '<div class="rq-tile" data-rack="' + r.rackId + '" title="Buka Rack Elevation ' + r.rackId + '">' +
        rqMiniRack(r, devs, used) +
        '<div class="rq-info">' +
          '<div class="rq-id">' + r.rackId + '</div>' +
          '<div class="rq-zone">' + (r.zone || "-") + '</div>' +
          '<div class="rq-dev">' + used + ' device</div>' +
          '<div class="rq-util"><div class="util-bar"><div class="util-fill ' + (pct >= 80 ? "danger" : pct >= 50 ? "warning" : "") + '" style="width:' + pct + '%"></div></div><span>' + pct + '%</span></div>' +
        '</div></div>';
    }).join("") || '<div class="form-hint">Belum ada rack di site ini.</div>';
    grid.querySelectorAll(".rq-tile").forEach(t => t.addEventListener("click", () => {
      location.href = "rack-elevation.html?rack=" + encodeURIComponent(t.dataset.rack);
    }));
    document.getElementById("rack-quick-modal").classList.add("open");
  }
  window.openRackQuickView = openRackQuickView;
  (function wireQuickModal() {
    const m = document.getElementById("rack-quick-modal");
    if (!m) return;
    document.getElementById("rack-quick-close").addEventListener("click", () => m.classList.remove("open"));
    document.getElementById("rack-quick-cancel").addEventListener("click", () => m.classList.remove("open"));
    m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); });
  })();

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

  // Hint konvensi penamaan di bawah input Rack ID
  function updateRackIdHint() {
    const hint = document.getElementById("rack-id-hint");
    if (!hint) return;
    hint.textContent = "Format: huruf besar / angka / tanda hubung, tanpa spasi. Saran untuk site ini: " + nextRackIdFor(siteSel.value === "__new__" ? "" : siteSel.value);
  }

  siteSel.addEventListener("change", updateRackIdHint);

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
      refreshMaintenanceAlerts();
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
    updateRackIdHint();
    const pc = document.getElementById("rack-power-cap");
    if (pc) pc.value = "";
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
      // Site baru didaftarkan ke master sites (site.id = masterKey) supaya
      // otomatis muncul di picklist OPS & referensi rack, bukan hanya hardcode
      // di halaman ini. Gagal (offline) tidak fatal — tetap lanjut.
      siteId = text;
      siteName = text;
      siteLoc = text;
      siteZone = (zoneInput.value || "Zona A").trim();
      if (typeof apiSaveSite === "function") apiSaveSite({ id: siteId, name: siteName, loc: siteLoc, zone: siteZone });
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
    if (!/^[A-Z0-9-]+$/.test(rackId)) {
      flash('<i class="fa-solid fa-triangle-exclamation"></i> Format Rack ID tidak valid — gunakan huruf besar, angka, dan tanda hubung tanpa spasi (mis. R1-A07).', true);
      return;
    }
    if (RACKS.some(r => r.rackId === rackId)) {
      flash('<i class="fa-solid fa-triangle-exclamation"></i> Rack ID "' + rackId + '" sudah terdaftar. Gunakan ID lain.', true);
      return;
    }

    const powerCapEl = document.getElementById("rack-power-cap");
    const entry = saveRack({
      rackId,
      site: siteId,
      siteName,
      loc: siteLoc,
      zone: siteZone,
      size: sizeSel.value,
      status: document.getElementById("rack-status").value,
      powerCapKw: powerCapEl && powerCapEl.value !== "" ? Number(powerCapEl.value) : 0,
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
