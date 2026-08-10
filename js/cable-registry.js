
document.getElementById("powermap-close").addEventListener("click", () => document.getElementById("powermap-overlay").classList.remove("open"));
document.getElementById("powermap-overlay").addEventListener("click", e => { if (e.target.id === "powermap-overlay") e.currentTarget.classList.remove("open"); });

function openPowerMapEditPanel() {
  if (!currentPduKey) return;
  const data = POWER_DATA[currentPduKey];
  const panel = document.getElementById("powermap-edit-panel");
  const picker = document.getElementById("powermap-outlet-picker");
  const customInput = document.getElementById("powermap-outlet-custom");
  const warning = document.getElementById("powermap-edit-warning");
  warning.style.display = "none";
  picker.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  const presetMatch = picker.querySelector(`.chip[data-outlet="${data.ports}"]`);
  if (presetMatch) {
    presetMatch.classList.add("active");
    customInput.style.display = "none";
  } else {
    picker.querySelector('.chip[data-outlet="custom"]').classList.add("active");
    customInput.style.display = "";
    customInput.value = data.ports;
  }
  panel.style.display = "";
}

document.getElementById("powermap-edit-btn").addEventListener("click", () => {
  const panel = document.getElementById("powermap-edit-panel");
  if (panel.style.display === "none") openPowerMapEditPanel();
  else panel.style.display = "none";
});

document.querySelectorAll("#powermap-outlet-picker .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#powermap-outlet-picker .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const isCustom = chip.dataset.outlet === "custom";
    document.getElementById("powermap-outlet-custom").style.display = isCustom ? "" : "none";
    if (isCustom) document.getElementById("powermap-outlet-custom").focus();
  });
});

document.getElementById("powermap-outlet-custom").addEventListener("input", function () {
  if (parseInt(this.value, 10) > 36) this.value = 36;
});

document.getElementById("powermap-edit-cancel").addEventListener("click", () => {
  document.getElementById("powermap-edit-panel").style.display = "none";
});

document.getElementById("powermap-edit-save").addEventListener("click", () => {
  if (!currentPduKey) return;
  const data = POWER_DATA[currentPduKey];
  const activeChip = document.querySelector("#powermap-outlet-picker .chip.active");
  let newPorts = data.ports;
  if (activeChip) {
    if (activeChip.dataset.outlet === "custom") {
      const v = parseInt(document.getElementById("powermap-outlet-custom").value, 10);
      if (v) newPorts = Math.min(36, Math.max(1, v));
    } else {
      newPorts = parseInt(activeChip.dataset.outlet, 10);
    }
  }
  const warning = document.getElementById("powermap-edit-warning");
  if (newPorts < data.rows.length) {
    warning.style.display = "block";
    warning.textContent = `Tidak bisa: ${data.rows.length} outlet sedang terpakai, minimal harus ${data.rows.length}.`;
    return;
  }
  data.ports = newPorts;
  document.getElementById("powermap-edit-panel").style.display = "none";
  openPowerMap(currentPduKey);
  renderRegistry();
});

// ---- build the master cable registry from PORT_DATA + POWER_DATA ----
const registryRows = [];
Object.entries(PORT_DATA).forEach(([deviceName, data]) => {
  data.rows.forEach(r => {
    registryRows.push({
      label: r.label, type: "data", from: deviceName, fromPort: r.port,
      to: r.dest, toPort: r.destPort, tag: r.vlan, detail: r.ip, tagColorFn: () => vlanColor(r.vlan),
    });
  });
});
Object.entries(POWER_DATA).forEach(([deviceName, data]) => {
  data.rows.forEach(r => {
    registryRows.push({
      label: r.label, type: "power", from: deviceName, fromPort: r.outlet,
      to: r.device, toPort: r.psu, tag: r.psu, detail: r.watt + " W", tagColorFn: () => psuColor(r.psu),
    });
  });
});
registryRows.sort((a, b) => (a.label || "").localeCompare(b.label || ""));

document.getElementById("stat-total").textContent = registryRows.length;
document.getElementById("stat-data").textContent = registryRows.filter(r => r.type === "data").length;
document.getElementById("stat-power").textContent = registryRows.filter(r => r.type === "power").length;

const tbody = document.getElementById("registry-tbody");
const registryCount = document.getElementById("registry-count");
const searchInput = document.getElementById("registry-search");
const typeFilter = document.getElementById("registry-type-filter");

function renderRegistry() {
  const q = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  let visibleRows = registryRows.filter(r => {
    const matchType = type === "all" || r.type === type;
    const matchQuery = !q || [r.label, r.from, r.to, r.detail, r.tag].join(" ").toLowerCase().includes(q);
    return matchType && matchQuery;
  });
  tbody.innerHTML = visibleRows.map(r => `
    <tr>
      <td class="strong mono">${r.label}</td>
      <td><span class="cable-type-chip ${r.type}"><span class="dot"></span>${r.type === "data" ? "Data" : "Power"}</span></td>
      <td class="strong">${r.from}</td>
      <td class="mono">${r.fromPort}</td>
      <td class="strong">${r.to}</td>
      <td class="mono">${r.toPort}</td>
      <td><span class="vlan-tag" style="background:${r.tagColorFn()}">${r.tag}</span></td>
      <td class="mono">${r.detail}</td>
      <td><button class="btn ghost" style="padding:6px 10px;font-size:11.5px;" onclick="${r.type === 'data' ? `openPortMap('${r.from}')` : `openPowerMap('${r.from}')`}"><i class="fa-solid fa-eye"></i></button></td>
    </tr>`).join("");
  registryCount.textContent = `Menampilkan ${visibleRows.length} dari ${registryRows.length} kabel`;
}

searchInput.addEventListener("input", renderRegistry);
typeFilter.addEventListener("change", renderRegistry);
renderRegistry();
    

