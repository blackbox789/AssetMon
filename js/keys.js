/* ============================================
   RackView — Pusat definisi KEY (storage & identitas).
   Semua localStorage key, versi skema, dan normalisasi
   master key perangkat (canonKey) didefinisikan di sini
   supaya konsisten antarhalaman, mudah di-backup,
   dimigrasi, dan di-deploy. Dimuat pertama di semua
   halaman (setelah app.js), sebelum file data lain.
   ============================================ */

// ---- Versi skema localStorage: naikkan saat format data berubah ----
const RV_SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = "rv_schema_version";

// ---- Storage keys (localStorage) ----
const SERVER_STORAGE_KEY  = "rv_servers";
const SWITCH_STORAGE_KEY  = "rv_switches";
const ACC_STORAGE_KEY     = "rv_accessories";
const STORAGE_STORAGE_KEY = "rv_storage";
const STORAGE_REFS_KEY    = "rv_refs_storage";
const RACK_STORAGE_KEY    = "rv_custom_racks";
const PORT_STORAGE_KEY    = "rv_port_maps";
const POWER_STORAGE_KEY   = "rv_power_maps";
const PAGE_SIZE_KEY       = "rv_page_size";
const DELETED_SERVERS_KEY = "rv_deleted_servers";
const TOPO_LAYERS_KEY     = "rv_topo_layers";

// ---- Normalisasi master key perangkat ----
// Semua key perangkat (hostname server, nama switch/PDU/aksesori, deviceKey
// Port Map & Power Map) dinormalisasi: huruf besar, tanpa spasi tepi,
// spasi ganda jadi satu. Ini menjamin indexing konsisten: "srv-web-01"
// dan "SRV-WEB-01" dianggap perangkat yang sama.
function canonKey(name) {
  return String(name == null ? "" : name).trim().toUpperCase().replace(/\s+/g, " ");
}

// ---- Baca/tulis versi skema storage (migrasi data lama) ----
function readStorageVersion() {
  try {
    return parseInt(localStorage.getItem(SCHEMA_VERSION_KEY), 10) || 0;
  } catch (e) {
    return 0;
  }
}

function writeStorageVersion(v) {
  try {
    localStorage.setItem(SCHEMA_VERSION_KEY, String(v));
  } catch (e) { /* abaikan */ }
}

// ---- Rekey map & registri saat perangkat diganti nama ----
// Memindahkan semua Port Map & Power Map (localStorage + DB via registri)
// dari key lama ke key baru supaya indexing tetap konsisten. Dipanggil
// saat hostname/nama perangkat berubah.
function rekeyDeviceMaps(oldKey, newKey) {
  const from = canonKey(oldKey);
  const to = canonKey(newKey);
  if (!from || !to || from === to) return;
  [PORT_STORAGE_KEY, POWER_STORAGE_KEY].forEach(storageKey => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const obj = JSON.parse(raw) || {};
      if (obj[from]) {
        obj[to] = obj[from];
        delete obj[from];
        localStorage.setItem(storageKey, JSON.stringify(obj));
      }
    } catch (e) { /* abaikan */ }
  });
  if (typeof apiRenameDevice === "function") apiRenameDevice(from, to);
}
