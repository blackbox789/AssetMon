
// ---- Sumber data PDU tunggal (konsisten untuk pdu-list & reports) ----
// Membutuhkan js/port-data.js terlebih dahulu (POWER_DATA).

const PDU_DATA = [
  { name: "PDU-A",       serial: "PDU-APC-8941-02", type: "vertical",   ports: 24, used: 9, site: "DC1", rack: "R1-A12", pos: "Sisi A", brand: "APC",      model: "AP8941",      ip: "10.10.9.1",  status: "online" },
  { name: "PDU-B",       serial: "PDU-APC-8941-07", type: "vertical",   ports: 24, used: 6, site: "DC1", rack: "R1-A12", pos: "Sisi B", brand: "APC",      model: "AP8941",      ip: "10.10.9.2",  status: "online" },
  { name: "PDU-C",       serial: "PDU-RAR-PX2-118", type: "horizontal", ports: 8,  used: 3, site: "DC3", rack: "R3-C05", pos: "U5",     brand: "Raritan",   model: "PX2-1000",     ip: "10.10.9.3",  status: "online" },
  { name: "PDU-R2B-S01", serial: "PDU-VRT-GC-2201", type: "vertical",   ports: 36, used: 6, site: "DC2", rack: "R2-B14", pos: "Sisi A", brand: "Vertiv",     model: "Geist",       ip: "10.10.9.21", status: "online" },
  { name: "PDU-R2B-U01", serial: "PDU-APC-BAS-440", type: "horizontal", ports: 8,  used: 2, site: "DC2", rack: "R2-B14", pos: "U4",     brand: "APC",       model: "Basic PDU",   ip: "10.10.9.22", status: "online" },
  { name: "PDU-DC4-E01", serial: "PDU-APC-8858-19", type: "vertical",   ports: 12, used: 4, site: "DC4", rack: "R4-A01", pos: "Sisi B", brand: "APC",      model: "AP8858",      ip: "10.10.9.41", status: "offline" },
  { name: "PDU-R1A-U42", serial: "PDU-RAR-DS-310",  type: "horizontal", ports: 8,  used: 8, site: "DC1", rack: "R1-A12", pos: "U42",    brand: "Raritan",   model: "Dominion SX", ip: "10.10.9.11", status: "online" },
];

POWER_DATA["PDU-C"] = { ports: 8, rows: [
  { outlet: 1, device: "SRV-EDGE-11", psu: "PSU-A", watt: 190, label: "CBL-3001" },
  { outlet: 2, device: "SRV-EDGE-12", psu: "PSU-B", watt: 190, label: "CBL-3002" },
  { outlet: 3, device: "SW-DIST-02", psu: "Single PSU", watt: 85, label: "CBL-3003" },
]};
POWER_DATA["PDU-R2B-S01"] = { ports: 36, rows: [
  { outlet: 1, device: "SRV-STOR-01", psu: "PSU-A", watt: 320, label: "CBL-4001" },
  { outlet: 2, device: "SRV-STOR-01", psu: "PSU-B", watt: 320, label: "CBL-4002" },
  { outlet: 3, device: "SRV-CLOUD-02", psu: "PSU-A", watt: 280, label: "CBL-4003" },
  { outlet: 4, device: "SRV-CLOUD-02", psu: "PSU-B", watt: 280, label: "CBL-4004" },
  { outlet: 5, device: "SW-CORE-02", psu: "Single PSU", watt: 150, label: "CBL-4005" },
  { outlet: 6, device: "SRV-COMP-03", psu: "PSU-A", watt: 410, label: "CBL-4006" },
]};
POWER_DATA["PDU-R2B-U01"] = { ports: 8, rows: [
  { outlet: 1, device: "SRV-COMP-03", psu: "PSU-B", watt: 410, label: "CBL-4010" },
  { outlet: 2, device: "FW-EDGE-04", psu: "Single PSU", watt: 70, label: "CBL-4011" },
]};
POWER_DATA["PDU-DC4-E01"] = { ports: 12, rows: [
  { outlet: 1, device: "SRV-TEST-01-01", psu: "PSU-A", watt: 180, label: "CBL-5001" },
  { outlet: 2, device: "SRV-TEST-01-01", psu: "PSU-B", watt: 180, label: "CBL-5002" },
  { outlet: 3, device: "SW-LAB-05", psu: "Single PSU", watt: 60, label: "CBL-5003" },
  { outlet: 4, device: "SRV-LAB-02", psu: "Single PSU", watt: 220, label: "CBL-5004" },
]};
POWER_DATA["PDU-R1A-U42"] = { ports: 8, rows: [
  { outlet: 1, device: "SRV-NAS-01", psu: "PSU-A", watt: 260, label: "CBL-2010" },
  { outlet: 2, device: "SRV-NAS-01", psu: "PSU-B", watt: 260, label: "CBL-2011" },
  { outlet: 3, device: "SRV-NAS-02", psu: "PSU-A", watt: 240, label: "CBL-2012" },
  { outlet: 4, device: "SRV-NAS-02", psu: "PSU-B", watt: 240, label: "CBL-2013" },
  { outlet: 5, device: "SW-BACKUP-02", psu: "Single PSU", watt: 90, label: "CBL-2014" },
  { outlet: 6, device: "SRV-BACKUP-01", psu: "PSU-A", watt: 300, label: "CBL-2015" },
  { outlet: 7, device: "SRV-BACKUP-01", psu: "PSU-B", watt: 300, label: "CBL-2016" },
  { outlet: 8, device: "SW-MGMT-02", psu: "Single PSU", watt: 45, label: "CBL-2017" },
]};

// ---- Sinkronisasi detail PDU ke tabel devices (sekali per browser) ----
// Push PDU_DATA (serial, ports, used, status, dst.) ke data JSON devices
// supaya SQLite menyimpan detail PDU & statusnya (tidak hanya hardcode JS).
function syncPduToDb() {
  const GUARD_KEY = "rv_pdu_synced_v1";
  try { if (localStorage.getItem(GUARD_KEY)) return; } catch (e) {}
  if (typeof apiSaveDevice !== "function") return;
  let ok = true;
  PDU_DATA.forEach(p => {
    if (!p || !p.name) return;
    const data = {
      serial: p.serial, ports: p.ports, used: p.used,
      site: p.site, rackId: p.rack, pos: p.pos,
      brand: p.brand, model: p.model, ip: p.ip, status: p.status,
    };
    if (!apiSaveDevice({ deviceKey: p.name, type: "pdu", name: p.name, data })) ok = false;
  });
  if (ok) try { localStorage.setItem(GUARD_KEY, "1"); } catch (e) {}
}
try { syncPduToDb(); } catch (e) { /* abaikan */ }
