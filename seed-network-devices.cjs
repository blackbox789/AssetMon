/* seed-network-devices.cjs - Isi record spesifikasi network device ke SQLite via API.
   Tujuan: data spesifikasi hidup di database (tabel `devices`), bukan hardcode di HTML/JS.

   Cara pakai:
     node seed-network-devices.cjs          # isi hanya record yang belum ada (idempoten)
     node seed-network-devices.cjs --force  # timpa record yang sudah ada

   Server harus berjalan: npm start */

const BASE = "http://127.0.0.1:3000/api";
const FORCE = process.argv.includes("--force");

// Spesifikasi switch yang sebelumnya hanya baris statis tanpa data.
// Sumber: posisi/IP/serial sesuai RACK_LAYOUTS & label rack elevation.
const DEVICES = [
  {
    deviceKey: "SW-CORE-01", type: "switch", site: "DC1",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 9300",
      rack: "R1-A12", posisiU: "U4", ip: "10.10.0.1", serial: "SW-CAT-9300-118",
      tags: ["production", "network-core"], site: "DC1",
      lanRj45: "48", lanSfp: "4", speed: "10G", os: "IOS-XE 17.9", role: "Core",
      vlan: "1,10-99", stacking: "Ya", stackRole: "Master",
      psuCount: "2", psuWatt: "715", powerRedundancy: "Redundant",
      tahunPembelian: "2021", warranty: "s/d 2026", monitoring: "SNMP v3" },
  },
  {
    deviceKey: "SW-ACC-03", type: "switch", site: "DC2",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 2960-X",
      rack: "R2-B14", posisiU: "U21", ip: "10.10.0.23", serial: "SW-CAT-2960-077",
      tags: ["production", "network-access"], site: "DC2",
      lanRj45: "24", lanSfp: "2", speed: "1G", os: "IOS 15.2", role: "Access",
      vlan: "10-40", stacking: "Tidak",
      psuCount: "1", psuWatt: "300", powerRedundancy: "Single",
      tahunPembelian: "2019", warranty: "s/d 2024", monitoring: "SNMP v2c" },
  },
  {
    deviceKey: "FW-EDGE-02", type: "firewall", site: "DC1",
    data: { type: "firewall", brand: "Fortinet", model: "FortiGate 200F",
      rack: "R1-A12", posisiU: "U14", ip: "10.10.0.254", serial: "FGT-200F-9931",
      tags: ["production", "security"], site: "DC1",
      lanRj45: "18", lanSfp: "4", speed: "10G", os: "FortiOS 7.4", role: "Edge",
      throughput: "20 Gbps", maxConnections: "2M", vpnTunnels: "500",
      haMode: "Active-Passive", haPeer: "FW-EDGE-04",
      license: "FortiGuard UTM Bundle", licenseExpiry: "2027-06",
      psuCount: "2", psuWatt: "150", powerRedundancy: "Redundant",
      tahunPembelian: "2022", warranty: "s/d 2027", monitoring: "SNMP v3" },
  },
  {
    deviceKey: "RT-EDGE-01", type: "router", site: "DC2",
    data: { type: "router", brand: "Cisco", model: "ISR 4451",
      rack: "R2-B14", posisiU: "U8", ip: "10.10.0.2", serial: "CSCO-ASR-2210",
      tags: ["production", "network-core"], site: "DC2",
      lanRj45: "6", lanSfp: "4", speed: "10G", os: "IOS-XE 17.6", role: "WAN",
      routingProtocol: "BGP", wanPorts: "2",
      psuCount: "2", psuWatt: "250", powerRedundancy: "Redundant",
      tahunPembelian: "2020", warranty: "s/d 2025", monitoring: "SNMP v3" },
  },
  {
    deviceKey: "SW-MGMT-02", type: "switch", site: "DC1",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 2960-X",
      rack: "R1-A12", posisiU: "U37", ip: "10.10.99.1", serial: "SW-CAT-2960-310",
      tags: ["production", "network-mgmt"], site: "DC1",
      lanRj45: "24", lanSfp: "2", speed: "1G", os: "IOS 15.2(7)E3", role: "Management",
      vlan: "99 — MGMT", stacking: "Tidak", psuCount: "1", psuWatt: "300",
      powerRedundancy: "Single", tahunPembelian: "2019", warranty: "s/d 2026",
      monitoring: "SNMP v2c, syslog" },
  },
  {
    deviceKey: "SW-BACKUP-02", type: "switch", site: "DC1",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 2960-X",
      rack: "R1-A12", posisiU: "U38", ip: "10.10.0.25", serial: "SW-CAT-2960-410",
      tags: ["production", "backup-network"], site: "DC1",
      lanRj45: "24", lanSfp: "2", speed: "1G", os: "IOS 15.2(7)E3", role: "Backup / DR",
      vlan: "20 — Backup", stacking: "Tidak", psuCount: "1", psuWatt: "300",
      powerRedundancy: "Single", tahunPembelian: "2020", warranty: "s/d 2025",
      monitoring: "SNMP v2c" },
  },
  {
    deviceKey: "SW-CORE-02", type: "switch", site: "DC2",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 9300-24P",
      rack: "R2-B14", posisiU: "U3", ip: "10.10.0.2", serial: "SW-CAT-9300-219",
      tags: ["production", "network-core"], site: "DC2",
      lanRj45: "24", lanSfp: "4", speed: "10G", os: "IOS-XE 17.9.4a", role: "Core",
      vlan: "1,10-99", stacking: "Ya", stackRole: "Master",
      psuCount: "2", psuWatt: "715", powerRedundancy: "Redundant",
      tahunPembelian: "2021", warranty: "Smart Net s/d 2027", monitoring: "SNMP v3, NetFlow" },
  },
  {
    deviceKey: "SW-DIST-02", type: "switch", site: "DC3",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 9300-24P",
      rack: "R3-C05", posisiU: "U1", ip: "10.10.0.30", serial: "SW-CAT-9300-330",
      tags: ["production", "network-dist"], site: "DC3",
      lanRj45: "24", lanSfp: "4", speed: "10G", os: "IOS-XE 17.6.5", role: "Distribution",
      vlan: "10-40", stacking: "Tidak", psuCount: "2", psuWatt: "715",
      powerRedundancy: "Redundant", tahunPembelian: "2020", warranty: "s/d 2026",
      monitoring: "SNMP v3" },
  },
  {
    deviceKey: "SW-LAB-05", type: "switch", site: "DC4",
    data: { type: "switch", subType: "ethernet", brand: "Cisco", model: "Catalyst 2960-X",
      rack: "R4-A01", posisiU: "U1", ip: "10.10.0.105", serial: "SW-CAT-2960-440",
      tags: ["lab"], site: "DC4",
      lanRj45: "24", lanSfp: "2", speed: "1G", os: "IOS 15.2(7)E3", role: "Lab / Testing",
      vlan: "1 (default)", stacking: "Tidak", psuCount: "1", psuWatt: "300",
      powerRedundancy: "Single", tahunPembelian: "2018", warranty: "Out of warranty",
      monitoring: "-" },
  },
];

async function main() {
  let existing = new Set();
  try {
    const r = await fetch(BASE + "/devices");
    if (r.ok) existing = new Set((await r.json()).map(d => d.deviceKey));
  } catch (e) {
    console.error("Server tidak aktif. Jalankan dulu: npm start");
    process.exit(1);
  }
  let created = 0, skipped = 0, updated = 0;
  for (const dev of DEVICES) {
    const exists = existing.has(dev.deviceKey);
    if (exists && !FORCE) { skipped++; continue; }
    const res = await fetch(BASE + "/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dev),
    });
    if (!res.ok) {
      console.error("Gagal:", dev.deviceKey, res.status, await res.text());
      continue;
    }
    exists ? updated++ : created++;
    console.log((exists ? "timpa " : "buat  ") + dev.deviceKey);
  }
  console.log(`\nSelesai. dibuat=${created} ditimpa=${updated} dilewati(sudah ada)=${skipped}`);
}

main();
