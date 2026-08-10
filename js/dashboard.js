
/* ============================================
   RackView — Dashboard: Device Registry
   Ringkasan jumlah perangkat per tipe dari
   registri master (GET /api/devices). Jika
   backend tidak tersedia, panel disembunyikan.
   ============================================ */

(function () {
  const TYPE_LABELS = {
    server: "Server",
    switch: "Switch",
    firewall: "Firewall",
    router: "Router",
    pdu: "PDU",
    ups: "UPS",
    storage: "Storage",
    patch: "Patch Panel",
    accessories: "Aksesori",
  };

  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function render(devices) {
    const counts = {};
    devices.forEach(d => {
      const t = String(d.type || "device").toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    const total = devices.length;

    const totalEl = document.getElementById("stat-total-assets");
    if (totalEl) totalEl.textContent = total.toLocaleString("id-ID");

    const body = document.getElementById("device-registry-body");
    if (!body) return;
    if (!total) {
      body.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);padding:16px;">Belum ada perangkat terdaftar di registri.</td></tr>';
      return;
    }
    const types = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    body.innerHTML = types.map(t =>
      `<tr><td class="strong">${esc(TYPE_LABELS[t] || t)}</td><td class="mono">${counts[t]}</td></tr>`
    ).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      if (typeof apiGetDevices !== "function") throw new Error("api.js tidak dimuat");
      const devs = apiGetDevices();
      if (!Array.isArray(devs)) throw new Error("backend tidak merespons");
      render(devs);
    } catch (e) {
      const card = document.getElementById("device-registry-card");
      if (card) card.style.display = "none";
    }
  });
})();
