const express = require("express");
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`CREATE TABLE IF NOT EXISTS devices (
  deviceKey  TEXT PRIMARY KEY,
  type       TEXT NOT NULL DEFAULT 'device',
  name       TEXT NOT NULL DEFAULT '',
  site       TEXT NOT NULL DEFAULT '',
  rackId     TEXT NOT NULL DEFAULT '',
  data       TEXT NOT NULL DEFAULT '{}',
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS racks (
  rackId       TEXT PRIMARY KEY,
  site         TEXT NOT NULL DEFAULT '',
  siteName     TEXT NOT NULL DEFAULT '',
  loc          TEXT NOT NULL DEFAULT '',
  zone         TEXT NOT NULL DEFAULT '',
  size         INTEGER NOT NULL DEFAULT 42,
  server       INTEGER NOT NULL DEFAULT 0,
  sw           INTEGER NOT NULL DEFAULT 0,
  pdu          INTEGER NOT NULL DEFAULT 0,
  firewall     INTEGER NOT NULL DEFAULT 0,
  patch        INTEGER NOT NULL DEFAULT 0,
  totalDevices INTEGER NOT NULL DEFAULT 0,
  util         INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'online',
  createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sites (
  siteId     TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  loc        TEXT NOT NULL DEFAULT '',
  zone       TEXT NOT NULL DEFAULT '',
  prefix     TEXT NOT NULL DEFAULT '',
  rackCount  INTEGER NOT NULL DEFAULT 0,
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  username          TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL DEFAULT '',
  role              TEXT NOT NULL DEFAULT 'viewer',
  name              TEXT NOT NULL DEFAULT '',
  title             TEXT NOT NULL DEFAULT '',
  dept              TEXT NOT NULL DEFAULT '',
  contact           TEXT NOT NULL DEFAULT '',
  scope_site        TEXT NOT NULL DEFAULT '',
  scope_rack        TEXT NOT NULL DEFAULT '',
  scope_zone        TEXT NOT NULL DEFAULT '',
  privileges        TEXT NOT NULL DEFAULT 'read',
  auth_method       TEXT NOT NULL DEFAULT 'local',
  notification_pref TEXT NOT NULL DEFAULT 'dashboard',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE TABLE IF NOT EXISTS brand (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  ref_id      TEXT NOT NULL,
  field_key   TEXT NOT NULL DEFAULT '',
  filename    TEXT NOT NULL DEFAULT '',
  orig_name   TEXT NOT NULL DEFAULT '',
  size        INTEGER NOT NULL DEFAULT 0,
  mime_type   TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_att_ref ON attachments(kind, ref_id);
CREATE INDEX IF NOT EXISTS idx_att_kind ON attachments(kind);
CREATE TABLE IF NOT EXISTS servers (
  id        TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS maps (
  kind      TEXT NOT NULL,
  deviceKey TEXT NOT NULL,
  data      TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, deviceKey),
  FOREIGN KEY (deviceKey) REFERENCES devices(deviceKey),
  CHECK (kind IN ('port', 'power'))
);
CREATE TABLE IF NOT EXISTS visits (
  id        TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS incidents (
  id        TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS maintenance (
  id        TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_maps_device_key ON maps(deviceKey);
CREATE INDEX IF NOT EXISTS idx_maps_kind_created ON maps(kind, createdAt);
CREATE INDEX IF NOT EXISTS idx_racks_site ON racks(site);
CREATE INDEX IF NOT EXISTS idx_racks_created ON racks(createdAt);
CREATE INDEX IF NOT EXISTS idx_servers_created ON servers(createdAt);
CREATE INDEX IF NOT EXISTS idx_maintenance_created ON maintenance(createdAt);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(createdAt);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(createdAt);
DROP INDEX IF EXISTS idx_ops_created;`);

const mapCols = db.prepare("PRAGMA table_info(maps)").all();
if (!mapCols.some(c => c.name === "updatedAt")) {
  db.exec("ALTER TABLE maps ADD COLUMN updatedAt TEXT NOT NULL DEFAULT (datetime('now'))");
}
const devCols = db.prepare("PRAGMA table_info(devices)").all().map(c => c.name);
if (!devCols.includes("site")) db.exec("ALTER TABLE devices ADD COLUMN site TEXT NOT NULL DEFAULT ''");
if (!devCols.includes("rackId")) db.exec("ALTER TABLE devices ADD COLUMN rackId TEXT NOT NULL DEFAULT ''");
db.exec("CREATE INDEX IF NOT EXISTS idx_devices_site ON devices(site)");

// ---- Referensi data (lookups) ----
// Tidak ada hardcode di frontend: pilihan form (tipe storage, form factor,
// interface, vendor, model) diambil dari SQLite via GET /api/refs.
db.exec(`CREATE TABLE IF NOT EXISTS refs (
  kind  TEXT NOT NULL,
  key   TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  sort  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key)
)`);
const STORAGE_REFS = {
  storage_types: [
    { key: "san", value: "SAN (Storage Area Network)" },
    { key: "nas", value: "NAS (Network Attached Storage)" },
    { key: "das", value: "DAS (Direct Attached Storage)" },
    { key: "jbod", value: "JBOD (Disk Shelf)" },
    { key: "hci", value: "HCI (Hyperconverged)" },
    { key: "tape", value: "Tape Library" },
  ],
  storage_form_factors: [
    { key: "san", value: JSON.stringify(["2U", "4U", "5U", "6U", "8U", "10U", "12U", "15U", "16U"]) },
    { key: "nas", value: JSON.stringify(["1U", "2U", "3U", "4U", "8U", "12U"]) },
    { key: "das", value: JSON.stringify(["2U", "4U", "5U", "8U", "12U"]) },
    { key: "jbod", value: JSON.stringify(["2U", "4U", "5U", "8U", "12U"]) },
    { key: "hci", value: JSON.stringify(["1U", "2U", "3U", "4U"]) },
    { key: "tape", value: JSON.stringify(["4U", "5U", "8U", "14U", "42U"]) },
  ],
  storage_ifaces: [
    { key: "sata", value: "Interface SATA" },
    { key: "sas", value: "Interface SAS" },
    { key: "nvme", value: "Interface NVMe" },
    { key: "mixed", value: "Interface Mixed" },
  ],
  storage_vendors: [
    "Dell EMC", "NetApp", "HPE", "Synology", "QNAP",
    "Lenovo", "Pure Storage", "IBM", "Huawei", "Western Digital",
  ].map((name, i) => ({ key: String(i), value: name })),
  storage_models: [
    "PowerVault ME5084", "PowerStore 1200T", "Unity XT 380F", "NetApp AFF A250", "NetApp FAS2750",
    "StoreEasy 1860", "Primera 630", "DiskStation DS1621+", "RackStation RS3617xs+", "TS-1886XU-RP",
    "ThinkSystem DE4000H", "FlashArray //X20", "FlashSystem 5200", "V7000 Gen2", "OceanStor 5310",
    "Ultrium Tape Library", "DXP4800 Plus", "SNV3000 Series",
  ].map((name, i) => ({ key: String(i), value: name })),
};
const seedRef = db.prepare("INSERT OR IGNORE INTO refs (kind, key, value, sort) VALUES (?, ?, ?, ?)");
Object.entries(STORAGE_REFS).forEach(([kind, items]) => {
  items.forEach((it, i) => seedRef.run(kind, String(it.key ?? i), it.value, i));
});

const SEED_SITES = [
  { id: "DC1", name: "DC1 - Cilandak", loc: "Jakarta Selatan, DKI Jakarta", zone: "Zona A", prefix: "R1", rackCount: 13 },
  { id: "DC2", name: "DC2 - Cikupa", loc: "Tangerang, Banten", zone: "Zona B", prefix: "R2", rackCount: 20 },
  { id: "DC3", name: "DC3 - Surabaya", loc: "Surabaya, Jawa Timur", zone: "Zona C", prefix: "R3", rackCount: 9 },
  { id: "DC4", name: "DC4 - Bandung (Edge Site)", loc: "Bandung, Jawa Barat", zone: "Zona D", prefix: "R4", rackCount: 6 },
  { id: "DC7", name: "DC7 - Pugeran Yogyakarta", loc: "", zone: "", prefix: "R7", rackCount: 0 },
];
const seedSite = db.prepare("INSERT OR IGNORE INTO sites (siteId, name, loc, zone, prefix, rackCount) VALUES (?, ?, ?, ?, ?, ?)");
SEED_SITES.forEach(s => seedSite.run(s.id, s.name, s.loc, s.zone, s.prefix, s.rackCount));
const seedUser = db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, role, name, title, dept, contact, privileges, auth_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
seedUser.run("usr-superadmin-001", "superadmin", String(Buffer.from("admin123").toString("base64")), "superadmin", "System Owner", "System Owner", "IT", "", "crud", "local");

// ---- OPS Seed: gabungan semua data simulasi/produksi ke SQLite ----
// Idempotent: hanya dijalankan saat tabel kosong.
const SEED_OPS = {
  visits: [
    { id: "vs-001", no: "VS-2026-0001", no_tiket: "TKT-2026-00123", tanggal: "2026-08-13", jam_rencana: "09:00", jam_realisasi: "", site: "DC1", rack: "R1-A12", tim: "Andi P. & Tim Infra", tujuan: "audit", assets: "SVR1U (U19), SW-ACC-03 (U21), SRV-WEB-02 (U15–U18)", hasil: "", temuan: "", no_izin: "IZN-2026-0088", status: "planned", created_at: "2026-08-12 08:30", created_by: "Andi P.", catatan: "Audit fisik Q3: cocokkan posisi & serial dengan database.",
      status_history: [{ from: null, to: "planned", at: "2026-08-12 08:30", by: "Andi P.", note: "Record dibuat" }] },
    { id: "vs-002", no: "VS-2026-0002", no_tiket: "TKT-2026-00127", tanggal: "2026-08-14", jam_rencana: "13:00", jam_realisasi: "13:20", site: "DC2", rack: "R2-B14", tim: "Budi S. (NOC)", tujuan: "troubleshooting", assets: "SW-CORE-02 (U3)", hasil: "mismatch", temuan: "Uplink terpasang di port 15, database menyebut port 16 — perlu update port map.", no_izin: "IZN-2026-0089", status: "in_progress", created_at: "2026-08-12 09:10", created_by: "Budi S.", catatan: "",
      status_history: [
        { from: null, to: "planned", at: "2026-08-12 09:10", by: "Budi S.", note: "Record dibuat" },
        { from: "planned", to: "in_progress", at: "2026-08-14 13:20", by: "Budi S.", note: "Teknisi masuk site" },
      ] },
    { id: "vs-003", no: "VS-2026-0003", no_tiket: "TKT-2026-00119", tanggal: "2026-08-11", jam_rencana: "10:00", jam_realisasi: "10:45", site: "DC3", rack: "R3-C05", tim: "Citra D. (Facility)", tujuan: "preventive", assets: "R3-C05 (full rack), PDU R3A", hasil: "normal", temuan: "Semua perangkat sesuai database; PDU berdebu ringan.", no_izin: "", status: "completed", created_at: "2026-08-10 14:20", created_by: "Citra D.", catatan: "Selesai tanpa kendala",
      status_history: [
        { from: null, to: "planned", at: "2026-08-10 14:20", by: "Citra D.", note: "Record dibuat" },
        { from: "planned", to: "in_progress", at: "2026-08-11 10:45", by: "Citra D.", note: "Teknisi masuk site" },
        { from: "in_progress", to: "completed", at: "2026-08-11 12:00", by: "Citra D.", note: "Verifikasi selesai, semua normal" },
      ] },
    { id: "vs-004", no: "VS-2026-0004", no_tiket: "TKT-2026-00520", tanggal: "2026-08-09", jam_rencana: "08:00", jam_realisasi: "08:15", site: "DC1", rack: "R1-A08", tim: "Facility Team", tujuan: "patroli", assets: "R1-A08 (visual check)", hasil: "normal", temuan: "Semua normal, tidak ada anomali.", no_izin: "IZN-2026-0090", status: "closed", created_at: "2026-08-08 10:00", created_by: "System Owner", catatan: "Patroli rutin Q3.",
      status_history: [
        { from: null, to: "planned", at: "2026-08-08 10:00", by: "System Owner", note: "Record dibuat" },
        { from: "planned", to: "in_progress", at: "2026-08-09 08:15", by: "Facility Team", note: "Patroli dimulai" },
        { from: "in_progress", to: "completed", at: "2026-08-09 09:00", by: "Facility Team", note: "Patroli selesai, semua normal" },
        { from: "completed", to: "closed", at: "2026-08-09 14:00", by: "System Owner", note: "Ditutup" },
      ] },
    { id: "vs-005", no: "VS-2026-0005", no_tiket: "TKT-2026-00521", tanggal: "2026-08-12", jam_rencana: "14:00", jam_realisasi: "", site: "DC4", rack: "R4-A01", tim: "Dedi K.", tujuan: "instalasi", assets: "", hasil: "", temuan: "", no_izin: "IZN-2026-0091", status: "planned", created_at: "2026-08-11 09:00", created_by: "Dedi K.", catatan: "Instalasi patch panel baru.",
      status_history: [{ from: null, to: "planned", at: "2026-08-11 09:00", by: "Dedi K.", note: "Record dibuat" }] },
    { id: "vs-006", no: "VS-2026-0006", no_tiket: "TKT-2026-00522", tanggal: "2026-08-10", jam_rencana: "09:00", jam_realisasi: "09:30", site: "DC2", rack: "R2-B05", tim: "Joko S.", tujuan: "audit", assets: "SRV-CLOUD-02 (U7-U8)", hasil: "normal", temuan: "Serial & posisi cocok.", no_izin: "IZN-2026-0092", status: "completed", created_at: "2026-08-09 11:00", created_by: "Joko S.", catatan: "",
      status_history: [
        { from: null, to: "planned", at: "2026-08-09 11:00", by: "Joko S.", note: "Record dibuat" },
        { from: "planned", to: "in_progress", at: "2026-08-10 09:30", by: "Joko S.", note: "Teknisi masuk site" },
        { from: "in_progress", to: "completed", at: "2026-08-10 11:00", by: "Joko S.", note: "Audit selesai, serial & posisi cocok" },
      ] },
    { id: "vs-007", no: "VS-2026-0007", no_tiket: "TKT-2026-00523", tanggal: "2026-08-15", jam_rencana: "10:00", jam_realisasi: "", site: "DC3", rack: "R3-C05", tim: "Slamet", tujuan: "preventive", assets: "", hasil: "", temuan: "", no_izin: "", status: "planned", created_at: "2026-08-13 08:00", created_by: "System Owner", catatan: "",
      status_history: [{ from: null, to: "planned", at: "2026-08-13 08:00", by: "System Owner", note: "Record dibuat" }] },
    { id: "vs-008", no: "VS-2026-0008", no_tiket: "TKT-2026-00524", tanggal: "2026-08-08", jam_rencana: "11:00", jam_realisasi: "11:20", site: "DC1", rack: "R1-A12", tim: "Andi P. & Tim Infra", tujuan: "troubleshooting", assets: "SW-ACC-03 (U21)", hasil: "mismatch", temuan: "Kabel CBL-1062 rusak, diganti.", no_izin: "IZN-2026-0093", status: "closed", created_at: "2026-08-07 15:00", created_by: "Andi P.", catatan: "",
      status_history: [
        { from: null, to: "planned", at: "2026-08-07 15:00", by: "Andi P.", note: "Record dibuat" },
        { from: "planned", to: "in_progress", at: "2026-08-08 11:20", by: "Andi P.", note: "Teknisi masuk site" },
        { from: "in_progress", to: "completed", at: "2026-08-08 13:00", by: "Andi P.", note: "Kabel CBL-1062 diganti" },
        { from: "completed", to: "closed", at: "2026-08-08 15:00", by: "System Owner", note: "Ditutup" },
      ] },
    { id: "vs-009", no: "VS-2026-0009", no_tiket: "TKT-2026-00525", tanggal: "2026-08-14", jam_rencana: "08:00", jam_realisasi: "", site: "DC4", rack: "R4-A01", tim: "Dedi K.", tujuan: "preventive", assets: "", hasil: "", temuan: "", no_izin: "", status: "planned", created_at: "2026-08-13 07:00", created_by: "Dedi K.", catatan: "",
      status_history: [{ from: null, to: "planned", at: "2026-08-13 07:00", by: "Dedi K.", note: "Record dibuat" }] },
    { id: "vs-010", no: "VS-2026-0010", no_tiket: "", tanggal: "2026-08-07", jam_rencana: "15:00", jam_realisasi: "15:10", site: "DC2", rack: "R2-B14", tim: "Budi S. (NOC)", tujuan: "troubleshooting", assets: "SW-CORE-02 (U3)", hasil: "normal", temuan: "Tidak ditemukan anomali setelah reboot.", no_izin: "", status: "completed", created_at: "2026-08-06 16:30", created_by: "Budi S.", catatan: "Follow-up INC-2026-0002.",
      status_history: [
        { from: null, to: "planned", at: "2026-08-06 16:30", by: "Budi S.", note: "Record dibuat" },
        { from: "planned", to: "in_progress", at: "2026-08-07 15:10", by: "Budi S.", note: "Teknisi masuk site" },
        { from: "in_progress", to: "completed", at: "2026-08-07 16:00", by: "Budi S.", note: "Reboot selesai, tidak ada anomali" },
      ] },
  ],
  incidents: [
    { id: "inc-001", no: "INC-2026-0001", title: "PDU-DC4-E01 tidak merespons SNMP", sumber: "monitoring", site: "DC4", rack: "R4-A01", asset: "PDU-DC4-E01", dampak: "Monitoring daya edge site terputus", no_tiket: "TKT-2026-00442", severity: "high", status: "open", assignee: "NOC Shift 1", created_at: "2026-08-12T07:45:00", occurred_at: "2026-08-12T07:20:00", resolved_at: "", description: "PDU offline dari monitoring sejak pukul 07:20.", resolution: "",
      status_history: [
        { from: null, to: "open", at: "2026-08-12T07:45", by: "NOC Shift 1", note: "Record dibuat" },
      ] },
    { id: "inc-002", no: "INC-2026-0002", title: "Port 12 SW-ACC-03 flapping", sumber: "monitoring", site: "DC1", rack: "R1-A12", asset: "SW-ACC-03", dampak: "Layanan backup network DC1 terganggu", no_tiket: "TKT-2026-00438", severity: "medium", status: "in_progress", assignee: "Joko S.", created_at: "2026-08-11T22:10:00", occurred_at: "2026-08-11T21:55:00", resolved_at: "", description: "Link flap berulang pada port 12 menuju SW-BACKUP-02.", resolution: "Menunggu penggantian kabel CBL-1062.",
      status_history: [
        { from: null, to: "open", at: "2026-08-11T22:10", by: "NOC Shift 1", note: "Record dibuat" },
        { from: "open", to: "in_progress", at: "2026-08-11T22:30", by: "Joko S.", note: "Ditangani oleh Joko S." },
      ] },
    { id: "inc-003", no: "INC-2026-0003", title: "Firmware FW-EDGE-02 perlu update", sumber: "vendor", site: "DC1", rack: "R1-A12", asset: "FW-EDGE-02", dampak: "Risiko keamanan perimeter", no_tiket: "TKT-2026-00401", severity: "low", status: "resolved", assignee: "Security Team", created_at: "2026-08-10T15:00:00", occurred_at: "2026-08-10T14:30:00", resolved_at: "2026-08-11T09:30:00", description: "CVE-2026-xxxx di FortiOS 7.2.", resolution: "Firmware diperbarui ke 7.2.11.",
      status_history: [
        { from: null, to: "open", at: "2026-08-10T15:00", by: "Security Team", note: "Record dibuat" },
        { from: "open", to: "in_progress", at: "2026-08-10T15:30", by: "Security Team", note: "Vendor konfirmasi CVE, mulai persiapan update" },
        { from: "in_progress", to: "resolved", at: "2026-08-11T09:30", by: "Security Team", note: "Firmware diperbarui ke 7.2.11" },
      ] },
    { id: "inc-004", no: "INC-2026-0004", title: "UPS R2B kehilangan input phase", sumber: "manual", site: "DC2", rack: "R2-B14", asset: "UPS R2B", dampak: "Rack R2-B14 tanpa redundansi power", no_tiket: "TKT-2026-00450", severity: "critical", status: "open", assignee: "Elektrikal & Vendor", created_at: "2026-08-12T09:30:00", occurred_at: "2026-08-12T09:15:00", resolved_at: "", description: "Buzzer UPS berbunyi, bypas battery aktif.", resolution: "",
      status_history: [
        { from: null, to: "open", at: "2026-08-12T09:30", by: "Elektrikal", note: "Record dibuat" },
      ] },
    { id: "inc-005", no: "INC-2026-0005", title: "Suhu rack R3-C05 tidak akurat", sumber: "kunjungan", site: "DC3", rack: "R3-C05", asset: "Suhu R3-C05", dampak: "Pembacaan suhu menyimpang", no_tiket: "TKT-2026-00451", severity: "medium", status: "resolved", assignee: "Slamet", created_at: "2026-08-08T10:00:00", occurred_at: "2026-08-08T09:30:00", resolved_at: "2026-08-08T14:30:00", description: "Sensor termometer menyimpang dari thermogun.", resolution: "Sensor dikalibrasi ulang via kunjungan site.",
      status_history: [
        { from: null, to: "open", at: "2026-08-08T10:00", by: "Slamet", note: "Record dibuat" },
        { from: "open", to: "in_progress", at: "2026-08-08T10:15", by: "Slamet", note: "Mulai kalibrasi sensor" },
        { from: "in_progress", to: "resolved", at: "2026-08-08T14:30", by: "Slamet", note: "Sensor dikalibrasi ulang, akurat ±0.3°C" },
      ] },
    { id: "inc-006", no: "INC-2026-0006", title: "Fan exhaust R1-A08 noise", sumber: "preventive", site: "DC1", rack: "R1-A08", asset: "Fan R1-A08", dampak: "Gangguan kebisingan; pendinginan tetap normal", no_tiket: "TKT-2026-00452", severity: "low", status: "closed", assignee: "Facility Team", created_at: "2026-08-05T11:00:00", occurred_at: "2026-08-05T10:40:00", resolved_at: "2026-08-05T12:40:00", description: "Bearing fan berdengung.", resolution: "Fan diganti; ditutup setelah pemantauan 24 jam.",
      status_history: [
        { from: null, to: "open", at: "2026-08-05T11:00", by: "Facility Team", note: "Record dibuat" },
        { from: "open", to: "in_progress", at: "2026-08-05T11:15", by: "Facility Team", note: "Persiapan penggantian fan" },
        { from: "in_progress", to: "resolved", at: "2026-08-05T12:40", by: "Facility Team", note: "Fan diganti, pendinginan normal" },
        { from: "resolved", to: "closed", at: "2026-08-06T11:00", by: "Facility Team", note: "Pemantauan 24 jam OK, ditutup" },
      ] },
    { id: "inc-007", no: "INC-2026-0007", title: "Firmware SW-CORE-02 crash loop", sumber: "vendor", site: "DC2", rack: "R2-B14", asset: "SW-CORE-02", dampak: "Core DC2 terpengaruh saat reload", no_tiket: "TKT-2026-00453", severity: "high", status: "in_progress", assignee: "NOC Shift 2", created_at: "2026-08-12T06:20:00", occurred_at: "2026-08-12T06:05:00", resolved_at: "", description: "Setelah upgrade parsial, device reload-loop.", resolution: "Rollback ke versi sebelumnya, koordinasi vendor.",
      status_history: [
        { from: null, to: "open", at: "2026-08-12T06:20", by: "NOC Shift 2", note: "Record dibuat" },
        { from: "open", to: "in_progress", at: "2026-08-12T06:35", by: "NOC Shift 2", note: "Rollback firmware dimulai" },
      ] },
    { id: "inc-008", no: "INC-2026-0008", title: "FW-EDGE-02 CPU 92%", sumber: "monitoring", site: "DC4", rack: "R4-A01", asset: "FW-EDGE-02", dampak: "Throughput edge menurun", no_tiket: "TKT-2026-00454", severity: "medium", status: "resolved", assignee: "Security Team", created_at: "2026-08-09T03:15:00", occurred_at: "2026-08-09T02:50:00", resolved_at: "2026-08-09T08:45:00", description: "Proses audit log membebani CPU.", resolution: "Log forwarding dialihkan, OS diperbarui.",
      status_history: [
        { from: null, to: "open", at: "2026-08-09T03:15", by: "Security Team", note: "Record dibuat" },
        { from: "open", to: "in_progress", at: "2026-08-09T03:30", by: "Security Team", note: "Investigasi proses audit log" },
        { from: "in_progress", to: "resolved", at: "2026-08-09T08:45", by: "Security Team", note: "Log forwarding dialihkan, OS diperbarui" },
      ] },
    { id: "inc-009", no: "INC-2026-0009", title: "SRV-DB-17 storage warning", sumber: "monitoring", site: "DC1", rack: "R1-A12", asset: "SRV-DB-17", dampak: "Risiko kehabisan ruang penyimpanan database", no_tiket: "TKT-2026-00455", severity: "medium", status: "open", assignee: "DBA Team", created_at: "2026-08-13T01:00:00", occurred_at: "2026-08-13T00:45:00", resolved_at: "", description: "Volume /data mencapai 88% usage.", resolution: "",
      status_history: [
        { from: null, to: "open", at: "2026-08-13T01:00", by: "DBA Team", note: "Record dibuat" },
      ] },
  ],
  maintenance: [
    { id: "mt-001", no: "MT-2026-0001", title: "Pembersihan filter rack DC1", type: "preventive", site: "DC1", rack: "R1-A12", asset: "Rack Cooling", scheduled_at: "2026-08-15", mulai: "09:00", selesai: "11:00", downtime: "0", assignee: "Facility Team", ref_inc: "", ref_visit: "VS-2026-0001", no_tiket: "TKT-2026-00310", status: "scheduled", notes: "", completed_at: "", created_at: "2026-08-10 08:00", created_by: "System Owner",
      status_history: [{ from: null, to: "scheduled", at: "2026-08-10 08:00", by: "System Owner", note: "Record dibuat" }] },
    { id: "mt-002", no: "MT-2026-0002", title: "Battery UPS DC2 replacement", type: "corrective", site: "DC2", rack: "R2-B14", asset: "UPS R2B", scheduled_at: "2026-08-13", mulai: "22:00", selesai: "01:00", downtime: "3 jam", assignee: "Elektrikal", ref_inc: "INC-2026-0004", ref_visit: "", no_tiket: "TKT-2026-00311", status: "in_progress", notes: "Mengganti 2 bank baterai, koordinasi dengan vendor.", completed_at: "", created_at: "2026-08-10 10:00", created_by: "System Owner",
      status_history: [
        { from: null, to: "scheduled", at: "2026-08-10 10:00", by: "System Owner", note: "Record dibuat" },
        { from: "scheduled", to: "in_progress", at: "2026-08-13 22:00", by: "Elektrikal", note: "Maintenance dimulai" },
      ] },
    { id: "mt-003", no: "MT-2026-0003", title: "Kalibrasi termometer R3-C05", type: "preventive", site: "DC3", rack: "R3-C05", asset: "Suhu R3-C05", scheduled_at: "2026-08-10", mulai: "10:00", selesai: "10:40", downtime: "0", assignee: "Slamet", ref_inc: "", ref_visit: "", no_tiket: "TKT-2026-00312", status: "completed", notes: "Akurat ±0.3°C.", completed_at: "2026-08-10 11:40", created_at: "2026-08-08 09:00", created_by: "Slamet",
      status_history: [
        { from: null, to: "scheduled", at: "2026-08-08 09:00", by: "Slamet", note: "Record dibuat" },
        { from: "scheduled", to: "in_progress", at: "2026-08-10 10:00", by: "Slamet", note: "Mulai kalibrasi" },
        { from: "in_progress", to: "completed", at: "2026-08-10 10:40", by: "Slamet", note: "Kalibrasi selesai, akurat ±0.3°C" },
      ] },
    { id: "mt-004", no: "MT-2026-0004", title: "Upgrade firmware SW-CORE-02", type: "upgrade", site: "DC2", rack: "R2-B14", asset: "SW-CORE-02", scheduled_at: "2026-08-12", mulai: "", selesai: "", downtime: "", assignee: "", ref_inc: "INC-2026-0007", ref_visit: "", no_tiket: "TKT-2026-00313", status: "cancelled", notes: "Ditunda karena ada perubahan jadwal vendor.", completed_at: "", created_at: "2026-08-09 14:00", created_by: "System Owner",
      status_history: [
        { from: null, to: "scheduled", at: "2026-08-09 14:00", by: "System Owner", note: "Record dibuat" },
        { from: "scheduled", to: "cancelled", at: "2026-08-11 09:00", by: "System Owner", note: "Ditunda karena ada perubahan jadwal vendor" },
      ] },
    { id: "mt-005", no: "MT-2026-0005", title: "Penggantian fan exhaust R1-A08", type: "corrective", site: "DC1", rack: "R1-A08", asset: "Fan R1-A08", scheduled_at: "2026-08-10", mulai: "08:00", selesai: "09:15", downtime: "0", assignee: "Facility Team", ref_inc: "INC-2026-0006", ref_visit: "", no_tiket: "TKT-2026-00314", status: "completed", notes: "Fan model sama dengan vendor.", completed_at: "2026-08-10 09:15", created_at: "2026-08-09 11:00", created_by: "Facility Team",
      status_history: [
        { from: null, to: "scheduled", at: "2026-08-09 11:00", by: "Facility Team", note: "Record dibuat" },
        { from: "scheduled", to: "in_progress", at: "2026-08-10 08:00", by: "Facility Team", note: "Mulai penggantian fan" },
        { from: "in_progress", to: "completed", at: "2026-08-10 09:15", by: "Facility Team", note: "Fan diganti, pendinginan normal" },
      ] },
    { id: "mt-006", no: "MT-2026-0006", title: "Rekabelisasi patch R4-A01", type: "preventive", site: "DC4", rack: "R4-A01", asset: "Patch R4-A01", scheduled_at: "2026-08-07", mulai: "14:00", selesai: "14:50", downtime: "0", assignee: "Dedi K.", ref_inc: "", ref_visit: "VS-2026-0004", no_tiket: "TKT-2026-00315", status: "closed", notes: "Label baru, port map diperbarui.", completed_at: "2026-08-07 14:50", created_at: "2026-08-05 08:00", created_by: "Dedi K.",
      status_history: [
        { from: null, to: "scheduled", at: "2026-08-05 08:00", by: "Dedi K.", note: "Record dibuat" },
        { from: "scheduled", to: "in_progress", at: "2026-08-07 14:00", by: "Dedi K.", note: "Mulai rekabelisasi" },
        { from: "in_progress", to: "completed", at: "2026-08-07 14:50", by: "Dedi K.", note: "Label baru, port map diperbarui" },
        { from: "completed", to: "closed", at: "2026-08-07 16:00", by: "Dedi K.", note: "Ditutup" },
      ] },
    { id: "mt-007", no: "MT-2026-0007", title: "Pembersihan filter rack DC2", type: "preventive", site: "DC2", rack: "R2-B05", asset: "Rack Cooling", scheduled_at: "2026-08-16", mulai: "09:00", selesai: "10:00", downtime: "0", assignee: "Facility Team", ref_inc: "", ref_visit: "", no_tiket: "", status: "scheduled", notes: "", completed_at: "", created_at: "2026-08-11 07:00", created_by: "System Owner",
      status_history: [{ from: null, to: "scheduled", at: "2026-08-11 07:00", by: "System Owner", note: "Record dibuat" }] },
    { id: "mt-008", no: "MT-2026-0008", title: "Cek UPS R3-C05 input phase", type: "preventive", site: "DC3", rack: "R3-C05", asset: "UPS R3C", scheduled_at: "2026-08-11", mulai: "08:00", selesai: "08:30", downtime: "0", assignee: "Slamet", ref_inc: "", ref_visit: "", no_tiket: "TKT-2026-00316", status: "completed", notes: "Input phase normal setelah perbaikan.", completed_at: "2026-08-11 08:30", created_at: "2026-08-09 15:00", created_by: "Slamet",
      status_history: [
        { from: null, to: "scheduled", at: "2026-08-09 15:00", by: "Slamet", note: "Record dibuat" },
        { from: "scheduled", to: "in_progress", at: "2026-08-11 08:00", by: "Slamet", note: "Mulai pengecekan" },
        { from: "in_progress", to: "completed", at: "2026-08-11 08:30", by: "Slamet", note: "Input phase normal" },
      ] },
    { id: "mt-009", no: "MT-2026-0009", title: "Update firmware FW-EDGE-02", type: "upgrade", site: "DC4", rack: "R4-A01", asset: "FW-EDGE-02", scheduled_at: "2026-08-14", mulai: "22:00", selesai: "23:00", downtime: "0", assignee: "Security Team", ref_inc: "INC-2026-0003", ref_visit: "", no_tiket: "TKT-2026-00317", status: "scheduled", notes: "", completed_at: "", created_at: "2026-08-10 16:00", created_by: "Security Team",
      status_history: [{ from: null, to: "scheduled", at: "2026-08-10 16:00", by: "Security Team", note: "Record dibuat" }] },
  ],
};

// Seed OPS data: hanya isi tabel yang masih kosong
(function seedOpsData() {
  const kinds = [["visits", SEED_OPS.visits], ["incidents", SEED_OPS.incidents], ["maintenance", SEED_OPS.maintenance]];
  for (const [kind, records] of kinds) {
    const count = db.prepare("SELECT COUNT(*) c FROM " + kind).get().c;
    if (count > 0) { console.log("[seed] " + kind + ": " + count + " data sudah ada — skip"); continue; }
    const ins = db.prepare("INSERT INTO " + kind + " (id, data) VALUES (?, ?)");
    for (const rec of records) {
      if (!Array.isArray(rec.status_history)) {
        rec.status_history = [{ from: null, to: rec.status, at: rec.created_at, by: rec.created_by || "System Owner", note: "Record dibuat" }];
      }
      ins.run(rec.id, JSON.stringify(rec));
    }
    console.log("[seed] " + kind + ": " + records.length + " records seeded");
  }
})();

// Migration: tambah status_history, created_by, created_at ke record yang belum punya
(function migrateOpsHistory() {
  const kinds = ["visits", "incidents", "maintenance"];
  for (const kind of kinds) {
    const rows = db.prepare("SELECT id, data FROM " + kind).all();
    const upd = db.prepare("UPDATE " + kind + " SET data = ? WHERE id = ?");
    let n = 0;
    for (const row of rows) {
      try {
        const rec = JSON.parse(row.data);
        let changed = false;
        if (!Array.isArray(rec.status_history)) {
          rec.status_history = [{ from: null, to: rec.status || "unknown", at: rec.created_at || new Date().toISOString().slice(0, 16).replace("T", " "), by: rec.created_by || "System Owner", note: "Record dibuat" }];
          changed = true;
        }
        if (!rec.created_by) { rec.created_by = "System Owner"; changed = true; }
        if (!rec.created_at) { rec.created_at = rec.scheduled_at || rec.tanggal || new Date().toISOString().slice(0, 16).replace("T", " "); changed = true; }
        if (changed) { upd.run(JSON.stringify(rec), row.id); n++; }
      } catch (e) { /* skip broken records */ }
    }
    if (n > 0) console.log("[migration] " + n + " " + kind + " records dilengkapi field");
  }
})();

function canonKey(name) {
  return String(name == null ? "" : name).trim().toUpperCase().replace(/\s+/g, " ");
}

function genId(prefix) {
  const base = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  return prefix + "-" + base;
}

function upsertDevice(deviceKey, type, name, data) {
  const key = canonKey(deviceKey);
  if (!key) return;
  const d = (data && typeof data === "object") ? data : {};
  let rackId = canonKey(d.rackId || d.rack || "");
  let site = canonKey(d.site || "");
  if (rackId && !site) {
    const r = db.prepare("SELECT site FROM racks WHERE rackId = ?").get(rackId);
    if (r && r.site) site = r.site;
  }
  if (site && !db.prepare("SELECT siteId FROM sites WHERE siteId = ?").get(site)) {
    const byName = db.prepare("SELECT siteId FROM sites WHERE lower(name) = lower(?)").get(site);
    if (byName) site = byName.siteId;
  }
  db.prepare(`
    INSERT INTO devices (deviceKey, type, name, site, rackId, data) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(deviceKey) DO UPDATE SET
      type=excluded.type, name=excluded.name,
      site=CASE WHEN excluded.site != '' THEN excluded.site ELSE devices.site END,
      rackId=CASE WHEN excluded.rackId != '' THEN excluded.rackId ELSE devices.rackId END,
      data=CASE WHEN excluded.data != '{}' THEN excluded.data ELSE devices.data END,
      updatedAt=datetime('now')
  `).run(key, String(type || "device"), String(name || key), site, rackId, data ? JSON.stringify(d) : "{}");
}

function normalizeMapKeys() {
  const rows = db.prepare("SELECT kind, deviceKey, data, updatedAt FROM maps ORDER BY updatedAt").all();
  const byKind = {};
  const drop = [];
  rows.forEach(r => {
    const key = canonKey(r.deviceKey);
    if (key === r.deviceKey) { (byKind[r.kind] = byKind[r.kind] || {})[key] = 1; return; }
    const seen = (byKind[r.kind] = byKind[r.kind] || {});
    if (seen[key]) {
      drop.push([r.kind, r.deviceKey]);
    } else {
      seen[key] = 1;
      db.prepare("UPDATE maps SET deviceKey = ? WHERE kind = ? AND deviceKey = ?").run(key, r.kind, r.deviceKey);
    }
  });
  const del = db.prepare("DELETE FROM maps WHERE kind = ? AND deviceKey = ?");
  drop.forEach(([kind, key]) => del.run(kind, key));
  return { renamed: rows.length - drop.length, dropped: drop.length };
}

function backfillDevices() {
  db.prepare("SELECT id, data FROM servers").all().forEach(r => {
    try {
      const s = JSON.parse(r.data);
      upsertDevice(s.hostname || s.id || r.id, "server", s.hostname || s.id || r.id, s);
    } catch (e) { /* abaikan baris rusak */ }
  });
  db.prepare("SELECT kind, deviceKey, data FROM maps").all().forEach(r => {
    try {
      const d = JSON.parse(r.data);
      upsertDevice(r.deviceKey, (d && d.type) || "device", r.deviceKey, d);
    } catch (e) { /* abaikan baris rusak */ }
  });
}

function pruneOrphanDevices() {
  const withMap = new Set(db.prepare("SELECT DISTINCT deviceKey FROM maps").all().map(r => r.deviceKey));
  const withServer = new Set();
  db.prepare("SELECT id, data FROM servers").all().forEach(r => {
    try {
      const s = JSON.parse(r.data);
      if (s && s.hostname) withServer.add(canonKey(s.hostname));
      if (s && s.id) withServer.add(canonKey(s.id));
      withServer.add(canonKey(r.id));
    } catch (e) { /* abaikan baris rusak */ }
  });
  const rows = db.prepare("SELECT deviceKey, site, rackId FROM devices").all();
  const del = db.prepare("DELETE FROM devices WHERE deviceKey = ?");
  let removed = 0;
  rows.forEach(r => {
    if (r.site || r.rackId) return;
    if (!withMap.has(r.deviceKey) && !withServer.has(canonKey(r.deviceKey))) {
      del.run(r.deviceKey);
      removed++;
    }
  });
  return removed;
}

function backfillDeviceLocation() {
  const rows = db.prepare("SELECT deviceKey, data, site, rackId FROM devices").all();
  const upd = db.prepare("UPDATE devices SET site = ?, rackId = ? WHERE deviceKey = ?");
  let n = 0;
  rows.forEach(r => {
    if (r.site && r.rackId) return;
    let d = {};
    try { d = JSON.parse(r.data); } catch (e) { return; }
    let site = r.site || canonKey(d.site || "");
    let rackId = r.rackId || canonKey(d.rackId || d.rack || "");
    if (rackId && !site) {
      const rack = db.prepare("SELECT site FROM racks WHERE rackId = ?").get(rackId);
      if (rack && rack.site) site = rack.site;
    }
    if (site !== r.site || rackId !== r.rackId) {
      upd.run(site, rackId, r.deviceKey);
      n++;
    }
  });
  return n;
}

function syncDeviceSiteFromRack(rackId, newSite) {
  if (!rackId || !newSite) return 0;
  const res = db.prepare("UPDATE devices SET site = ? WHERE rackId = ? AND site != ?").run(newSite, rackId, newSite);
  return res.changes;
}

function currentUserId(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
function requireRole(req, res, next, allowed) {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(uid);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  if (!allowed.includes(user.role)) return res.status(403).json({ error: "forbidden" });
  req.user = user;
  next();
}

normalizeMapKeys();
backfillDevices();
const backfilledLocations = backfillDeviceLocation();
const prunedDevices = pruneOrphanDevices();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    sites: db.prepare("SELECT COUNT(*) c FROM sites").get().c,
    racks: db.prepare("SELECT COUNT(*) c FROM racks").get().c,
    servers: db.prepare("SELECT COUNT(*) c FROM servers").get().c,
    maps: db.prepare("SELECT COUNT(*) c FROM maps").get().c,
    devices: db.prepare("SELECT COUNT(*) c FROM devices").get().c,
    visits: db.prepare("SELECT COUNT(*) c FROM visits").get().c,
    incidents: db.prepare("SELECT COUNT(*) c FROM incidents").get().c,
    maintenance: db.prepare("SELECT COUNT(*) c FROM maintenance").get().c,
    users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
  });
});

app.get("/api/export", (req, res) => {
  const sites = db.prepare("SELECT * FROM sites").all();
  const racks = db.prepare("SELECT * FROM racks").all();
  const servers = db.prepare("SELECT data FROM servers").all().map(r => JSON.parse(r.data));
  const maps = db.prepare("SELECT kind, deviceKey, data FROM maps").all().map(r => ({ kind: r.kind, deviceKey: r.deviceKey, data: JSON.parse(r.data) }));
  const devices = db.prepare("SELECT deviceKey, type, name FROM devices").all();
  const visits = db.prepare("SELECT data FROM visits").all().map(r => JSON.parse(r.data));
  const incidents = db.prepare("SELECT data FROM incidents").all().map(r => JSON.parse(r.data));
  const maintenance = db.prepare("SELECT data FROM maintenance").all().map(r => JSON.parse(r.data));
  res.json({ exportedAt: new Date().toISOString(), sites, racks, servers, maps, devices, visits, incidents, maintenance });
});

app.get("/api/sites", (req, res) => {
  const rows = db.prepare("SELECT * FROM sites ORDER BY siteId").all();
  res.json(rows.map(r => ({ id: r.siteId, name: r.name, loc: r.loc, zone: r.zone, prefix: r.prefix, rackCount: Number(r.rackCount) })));
});

app.post("/api/sites", (req, res) => {
  const s = req.body || {};
  const siteId = canonKey(s.id || s.siteId || "");
  if (!siteId) return res.status(400).json({ error: "siteId wajib diisi" });
  const exists = db.prepare("SELECT siteId FROM sites WHERE siteId = ?").get(siteId);
  db.prepare(`
    INSERT INTO sites (siteId, name, loc, zone, prefix, rackCount) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(siteId) DO UPDATE SET
      name=excluded.name, loc=excluded.loc, zone=excluded.zone,
      prefix=excluded.prefix, rackCount=excluded.rackCount, updatedAt=datetime('now')
  `).run(siteId, String(s.name || siteId).trim(), String(s.loc || ""), String(s.zone || ""), String(s.prefix || ""), Number(s.rackCount) || 0);
  auditLog(req, currentUserId(req), exists ? "site.update" : "site.create", siteId, String(s.name || siteId));
  res.json({ ok: true, id: siteId });
});

app.delete("/api/sites/:siteId", (req, res) => {
  const siteId = canonKey(req.params.siteId || "");
  db.prepare("DELETE FROM sites WHERE siteId = ?").run(siteId);
  auditLog(req, currentUserId(req), "site.delete", siteId, "");
  res.json({ ok: true, id: siteId });
});

// ---- Referensi data (lookups) ----
app.get("/api/refs", (req, res) => {
  const rows = db.prepare("SELECT kind, key, value, sort FROM refs ORDER BY kind, sort").all();
  const byKind = {};
  rows.forEach(r => {
    (byKind[r.kind] = byKind[r.kind] || []).push({ key: r.key, value: r.value, sort: Number(r.sort) });
  });
  res.json(byKind);
});

app.get("/api/refs/:kind", (req, res) => {
  const kind = String(req.params.kind || "");
  const rows = db.prepare("SELECT key, value, sort FROM refs WHERE kind = ? ORDER BY sort").all(kind);
  res.json({ kind, items: rows });
});

app.post("/api/refs/:kind", (req, res) => {
  const kind = String(req.params.kind || "").trim();
  if (!kind) return res.status(400).json({ error: "kind wajib diisi" });
  const items = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.items) ? req.body.items : null);
  if (!items || !items.length) return res.status(400).json({ error: "body harus array [{key, value, sort}, ...]" });
  const up = db.prepare(`INSERT INTO refs (kind, key, value, sort) VALUES (?, ?, ?, ?)
    ON CONFLICT(kind, key) DO UPDATE SET value=excluded.value, sort=excluded.sort`);
  items.forEach((it, i) => {
    const key = String(it.key ?? i);
    up.run(kind, key, String(it.value ?? ""), Number(it.sort ?? i));
  });
  auditLog(req, currentUserId(req), "ref.update", kind, items.length + " item");
  res.json({ ok: true, kind, updated: items.length });
});

app.get("/api/devices/storage", (req, res) => {
  const rows = db.prepare("SELECT deviceKey, data FROM devices WHERE type = ?").all("storage");
  const devices = rows.map(r => {
    try {
      const d = JSON.parse(r.data);
      return { deviceKey: r.deviceKey, ...d };
    } catch { return { deviceKey: r.deviceKey }; }
  }).filter(d => d.deviceKey);
  res.json({ ok: true, devices });
});

app.get("/api/racks", (req, res) => {
  const rows = db.prepare("SELECT * FROM racks ORDER BY createdAt").all();
  res.json(rows.map(r => ({ ...r, size: Number(r.size), server: Number(r.server), sw: Number(r.sw), pdu: Number(r.pdu), firewall: Number(r.firewall), patch: Number(r.patch), totalDevices: Number(r.totalDevices), util: Number(r.util) })));
});

app.post("/api/racks", (req, res) => {
  const r = req.body || {};
  const rackId = String(r.rackId || "").trim().toUpperCase();
  if (!rackId) return res.status(400).json({ error: "rackId wajib diisi" });
  const rackExists = db.prepare("SELECT rackId FROM racks WHERE rackId = ?").get(rackId);
  const siteGiven = String(r.site || "").trim();
  const siteRow = siteGiven ? db.prepare("SELECT siteId, name FROM sites WHERE siteId = ? OR lower(name) = lower(?)").get(siteGiven, siteGiven) : null;
  const site = siteRow ? siteRow.siteId : siteGiven;
  let siteName = String(r.siteName || "").trim();
  if (!siteName && siteRow) siteName = siteRow.name;
  if (site && !siteRow) {
    db.prepare("INSERT OR IGNORE INTO sites (siteId, name) VALUES (?, ?)").run(site, siteName || site);
  }
  const entry = {
    rackId,
    site, siteName, loc: String(r.loc || ""), zone: String(r.zone || ""),
    size: Number(r.size) || 42,
    server: Number(r.server) || 0, sw: Number(r.sw) || 0, pdu: Number(r.pdu) || 0,
    firewall: Number(r.firewall) || 0, patch: Number(r.patch) || 0,
    totalDevices: (Number(r.server) || 0) + (Number(r.sw) || 0) + (Number(r.pdu) || 0) + (Number(r.firewall) || 0) + (Number(r.patch) || 0),
    util: Math.min(100, Math.max(0, Number(r.util) || 0)),
    status: r.status || "online",
  };
  db.prepare(`
    INSERT INTO racks (rackId, site, siteName, loc, zone, size, server, sw, pdu, firewall, patch, totalDevices, util, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(rackId) DO UPDATE SET
      site=excluded.site, siteName=excluded.siteName, loc=excluded.loc, zone=excluded.zone,
      size=excluded.size, server=excluded.server, sw=excluded.sw, pdu=excluded.pdu,
      firewall=excluded.firewall, patch=excluded.patch, totalDevices=excluded.totalDevices,
      util=excluded.util, status=excluded.status
  `).run(entry.rackId, entry.site, entry.siteName, entry.loc, entry.zone, entry.size, entry.server, entry.sw, entry.pdu, entry.firewall, entry.patch, entry.totalDevices, entry.util, entry.status);
  if (entry.site) syncDeviceSiteFromRack(entry.rackId, entry.site);
  auditLog(req, currentUserId(req), rackExists ? "rack.update" : "rack.create", entry.rackId, entry.site ? entry.site + " · " + entry.siteName : entry.siteName);
  res.json(entry);
});

// Bulk sync registri rack (dipakai syncRacksToDb frontend): masukkan rack yang belum ada.
app.post("/api/racks/sync", (req, res) => {
  const list = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.racks) ? req.body.racks : null);
  if (!list) return res.status(400).json({ error: "body harus array [{rackId, site, ...}, ...]" });
  let added = 0, skipped = 0;
  list.forEach(r => {
    if (!r || !r.rackId) return;
    const rackId = String(r.rackId).trim().toUpperCase();
    if (db.prepare("SELECT rackId FROM racks WHERE rackId = ?").get(rackId)) { skipped++; return; }
    const entry = {
      rackId,
      site: String(r.site || "").trim(),
      siteName: String(r.siteName || "").trim(),
      loc: String(r.loc || ""), zone: String(r.zone || ""),
      size: Number(r.size) || 42,
      server: Number(r.server) || 0, sw: Number(r.sw) || 0, pdu: Number(r.pdu) || 0,
      firewall: Number(r.firewall) || 0, patch: Number(r.patch) || 0,
      totalDevices: (Number(r.server) || 0) + (Number(r.sw) || 0) + (Number(r.pdu) || 0) + (Number(r.firewall) || 0) + (Number(r.patch) || 0),
      util: Math.min(100, Math.max(0, Number(r.util) || 0)),
      status: r.status || "online",
    };
    db.prepare(`
      INSERT INTO racks (rackId, site, siteName, loc, zone, size, server, sw, pdu, firewall, patch, totalDevices, util, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(rackId) DO UPDATE SET
        site=excluded.site, siteName=excluded.siteName, loc=excluded.loc, zone=excluded.zone,
        size=excluded.size, server=excluded.server, sw=excluded.sw, pdu=excluded.pdu,
        firewall=excluded.firewall, patch=excluded.patch, totalDevices=excluded.totalDevices,
        util=excluded.util, status=excluded.status
    `).run(entry.rackId, entry.site, entry.siteName, entry.loc, entry.zone, entry.size, entry.server, entry.sw, entry.pdu, entry.firewall, entry.patch, entry.totalDevices, entry.util, entry.status);
    if (entry.site) syncDeviceSiteFromRack(entry.rackId, entry.site);
    added++;
  });
  if (added) auditLog(req, currentUserId(req), "rack.sync", added + " rack", "bulk sync registri rack dari frontend");
  res.json({ ok: true, added, skipped });
});

app.delete("/api/racks/:rackId", (req, res) => {
  const rackId = String(req.params.rackId || "").toUpperCase();
  db.prepare("DELETE FROM racks WHERE rackId = ?").run(rackId);
  auditLog(req, currentUserId(req), "rack.delete", rackId, "");
  res.json({ ok: true });
});

app.get("/api/servers", (req, res) => {
  const rows = db.prepare("SELECT data FROM servers ORDER BY createdAt").all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

app.post("/api/servers", (req, res) => {
  const s = req.body || {};
  const id = s.id || genId("srv");
  const exists = db.prepare("SELECT id FROM servers WHERE id = ?").get(id);
  const record = { ...s, id };
  if (record.hostname) record.hostname = canonKey(record.hostname);
  db.prepare("INSERT INTO servers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(id, JSON.stringify(record));
  upsertDevice(record.hostname || id, "server", record.hostname || id, record);
  auditLog(req, currentUserId(req), exists ? "server.update" : "server.create", id, record.hostname || record.name || "");
  res.json({ ok: true, id });
});

app.delete("/api/servers/:id", (req, res) => {
  const id = String(req.params.id || "");
  db.prepare("DELETE FROM servers WHERE id = ?").run(id);
  auditLog(req, currentUserId(req), "server.delete", id, "");
  res.json({ ok: true });
});

app.get("/api/devices", (req, res) => {
  const rows = db.prepare(`
    SELECT d.deviceKey, d.type, d.name, d.site, d.rackId, s.name AS siteName
    FROM devices d LEFT JOIN sites s ON s.siteId = d.site
    ORDER BY d.deviceKey
  `).all();
  res.json(rows);
});

app.post("/api/devices", (req, res) => {
  const d = req.body || {};
  const deviceKey = canonKey(d.deviceKey || d.name || "");
  if (!deviceKey) return res.status(400).json({ error: "deviceKey wajib diisi" });
  const exists = db.prepare("SELECT deviceKey FROM devices WHERE deviceKey = ?").get(deviceKey);
  upsertDevice(deviceKey, d.type, d.name || deviceKey, d.data);
  auditLog(req, currentUserId(req), exists ? "device.update" : "device.create", deviceKey, d.type || "");
  res.json({ ok: true, deviceKey });
});

app.post("/api/devices/locations", (req, res) => {
  const list = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.devices) ? req.body.devices : null);
  if (!list) return res.status(400).json({ error: "body harus array [{deviceKey, name, type, site, rackId}, ...]" });
  const upd = db.prepare(`
    INSERT INTO devices (deviceKey, type, name, site, rackId, data) VALUES (?, ?, ?, ?, ?, '{}')
    ON CONFLICT(deviceKey) DO UPDATE SET
      type=excluded.type, name=excluded.name,
      site=CASE WHEN excluded.site != '' THEN excluded.site ELSE devices.site END,
      rackId=CASE WHEN excluded.rackId != '' THEN excluded.rackId ELSE devices.rackId END,
      updatedAt=datetime('now')
  `);
  let n = 0;
  list.forEach(d => {
    const deviceKey = canonKey(d.deviceKey || d.name || "");
    if (!deviceKey) return;
    const rackId = canonKey(d.rackId || "");
    let site = canonKey(d.site || "");
    if (rackId && !site) {
      const r = db.prepare("SELECT site FROM racks WHERE rackId = ?").get(rackId);
      if (r && r.site) site = r.site;
    }
    upd.run(deviceKey, d.type || "device", d.name || deviceKey, site, rackId);
    n++;
  });
  if (n) auditLog(req, currentUserId(req), "device.locations", n + " device", "penempatan rack/site (bulk)");
  res.json({ ok: true, updated: n });
});

app.delete("/api/devices/:deviceKey", (req, res) => {
  const deviceKey = canonKey(req.params.deviceKey || "");
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM maps WHERE deviceKey = ?").run(deviceKey);
    db.prepare("DELETE FROM devices WHERE deviceKey = ?").run(deviceKey);
    db.exec("COMMIT");
    auditLog(req, currentUserId(req), "device.delete", deviceKey, "");
    res.json({ ok: true, deviceKey });
  } catch (e) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.put("/api/devices/:deviceKey/rename", (req, res) => {
  const from = canonKey(req.params.deviceKey || "");
  const to = canonKey((req.body && (req.body.to || req.body.deviceKey)) || "");
  if (!from || !to) return res.status(400).json({ error: "deviceKey asal & tujuan wajib diisi" });
  if (from === to) return res.json({ ok: true, deviceKey: to });
  const exists = db.prepare("SELECT deviceKey FROM devices WHERE deviceKey = ?").get(to);
  db.exec("BEGIN");
  try {
    if (exists) {
      const rows = db.prepare("SELECT kind, data, updatedAt FROM maps WHERE deviceKey = ?").all(from);
      const upd = db.prepare("UPDATE maps SET data = excluded.data, updatedAt = excluded.updatedAt WHERE kind = ? AND deviceKey = ?");
      const ins = db.prepare("INSERT INTO maps (kind, deviceKey, data, updatedAt) VALUES (?, ?, ?, ?)");
      rows.forEach(r => {
        const cur = db.prepare("SELECT updatedAt FROM maps WHERE kind = ? AND deviceKey = ?").get(r.kind, to);
        if (!cur || cur.updatedAt <= r.updatedAt) {
          upd.run(r.data, r.kind, to);
          if (!cur) ins.run(r.kind, to, r.data, r.updatedAt);
        }
      });
      db.prepare("DELETE FROM maps WHERE deviceKey = ?").run(from);
      db.prepare("DELETE FROM devices WHERE deviceKey = ?").run(from);
    } else {
      db.prepare("UPDATE maps SET deviceKey = ? WHERE deviceKey = ?").run(to, from);
      db.prepare("UPDATE devices SET deviceKey = ?, updatedAt = datetime('now') WHERE deviceKey = ?").run(to, from);
    }
    db.exec("COMMIT");
    auditLog(req, currentUserId(req), "device.rename", from, "→ " + to);
    res.json({ ok: true, deviceKey: to });
  } catch (e) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/maps/:kind", (req, res) => {
  const kind = String(req.params.kind || "");
  const rows = db.prepare("SELECT deviceKey, data FROM maps WHERE kind = ? ORDER BY createdAt").all(kind);
  res.json(rows.map(r => ({ deviceKey: r.deviceKey, data: JSON.parse(r.data) })));
});

app.get("/api/maps/:kind/:deviceKey", (req, res) => {
  const kind = String(req.params.kind || "");
  const deviceKey = canonKey(req.params.deviceKey || "");
  const row = db.prepare("SELECT deviceKey, data FROM maps WHERE kind = ? AND deviceKey = ?").get(kind, deviceKey);
  if (!row) return res.status(404).json({ error: "tidak ditemukan" });
  res.json({ deviceKey: row.deviceKey, data: JSON.parse(row.data) });
});

app.post("/api/maps/:kind/:deviceKey", (req, res) => {
  const kind = String(req.params.kind || "");
  const deviceKey = canonKey(req.params.deviceKey || "");
  if (!["port", "power"].includes(kind)) return res.status(400).json({ error: "kind harus 'port' atau 'power'" });
  if (!deviceKey) return res.status(400).json({ error: "deviceKey wajib diisi" });
  const data = (req.body && req.body.data !== undefined) ? req.body.data : req.body;
  upsertDevice(deviceKey, (data && data.type) || "device", deviceKey, data);
  db.prepare(`
    INSERT INTO maps (kind, deviceKey, data) VALUES (?, ?, ?)
    ON CONFLICT(kind, deviceKey) DO UPDATE SET data=excluded.data, updatedAt=datetime('now')
  `).run(kind, deviceKey, JSON.stringify(data));
  auditLog(req, currentUserId(req), "map.save", kind + "/" + deviceKey, "");
  res.json({ ok: true, kind, deviceKey });
});

app.delete("/api/maps/:kind/:deviceKey", (req, res) => {
  const kind = String(req.params.kind || "");
  const deviceKey = canonKey(req.params.deviceKey || "");
  db.prepare("DELETE FROM maps WHERE kind = ? AND deviceKey = ?").run(kind, deviceKey);
  auditLog(req, currentUserId(req), "map.delete", kind + "/" + deviceKey, "");
  res.json({ ok: true });
});

const UPLOAD_ROOT = path.join(DATA_DIR, "uploads");
const UPLOAD_MAX = 20 * 1024 * 1024;

function isPdf(buf) { return buf.length >= 5 && buf.slice(0, 5).toString("latin1") === "%PDF-"; }
function isImage(buf) {
  if (buf.length < 4) return false;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true; // WEBP (RIFF)
  return false;
}
function imageExt(buf) {
  if (buf.length < 4) return "";
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return ".jpg"; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return ".png"; // PNG
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return ".webp"; // WEBP
  return "";
}

// ---- Auth + Users + Audit ----
function currentUserId(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
function requireRole(req, res, allowed, next) {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(uid);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  if (!allowed.includes(user.role)) return res.status(403).json({ error: "forbidden" });
  req.user = user;
  next();
}
function auditLog(req, userId, action, target, detail) {
  try {
    const id = "log-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    const ip = String((req && req.ip) || (req && req.connection && req.connection.remoteAddress) || "");
    db.prepare("INSERT INTO audit_logs (id, user_id, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, String(userId || "anon"), String(action), String(target), String(detail || ""), ip);
  } catch (e) { /* abaikan */ }
}

app.get("/api/users", (req, res) => {
  requireRole(req, res, ["superadmin", "admin"], () => {
    const roleFilter = String(req.query.role || "").trim().toLowerCase();
    let rows = db.prepare("SELECT id, username, role, name, title, dept, contact, scope_site, scope_rack, scope_zone, privileges, auth_method, notification_pref, created_at FROM users ORDER BY created_at").all();
    if (roleFilter) rows = rows.filter(r => r.role === roleFilter);
    res.json(rows);
  });
});

app.post("/api/users", (req, res) => {
  requireRole(req, res, ["superadmin", "admin"], () => {
    const u = req.body || {};
    const id = u.id || genId("usr");
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, name, title, dept, contact, scope_site, scope_rack, scope_zone, privileges, auth_method, notification_pref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username=excluded.username, role=excluded.role, name=excluded.name, title=excluded.title,
        dept=excluded.dept, contact=excluded.contact, scope_site=excluded.scope_site, scope_rack=excluded.scope_rack,
        scope_zone=excluded.scope_zone, privileges=excluded.privileges, auth_method=excluded.auth_method,
        notification_pref=excluded.notification_pref, updatedAt=datetime('now')
    `).run(id, String(u.username || ""), String(u.password_hash || ""), String(u.role || "viewer"), String(u.name || ""), String(u.title || ""), String(u.dept || ""), String(u.contact || ""), String(u.scope_site || ""), String(u.scope_rack || ""), String(u.scope_zone || ""), String(u.privileges || "read"), String(u.auth_method || "local"), String(u.notification_pref || "dashboard"));
    auditLog(req, currentUserId(req), "user." + (u.id ? "update" : "create"), id, u.username || u.name);
    res.json({ ok: true, id });
  });
});

app.put("/api/users/:id", (req, res) => {
  requireRole(req, res, ["superadmin", "admin"], () => {
    const id = String(req.params.id || "");
    const u = req.body || {};
    db.prepare(`
      UPDATE users SET username=?, role=?, name=?, title=?, dept=?, contact=?, scope_site=?, scope_rack=?, scope_zone=?, privileges=?, auth_method=?, notification_pref=?, updatedAt=datetime('now')
      WHERE id=?
    `).run(String(u.username || ""), String(u.role || "viewer"), String(u.name || ""), String(u.title || ""), String(u.dept || ""), String(u.contact || ""), String(u.scope_site || ""), String(u.scope_rack || ""), String(u.scope_zone || ""), String(u.privileges || "read"), String(u.auth_method || "local"), String(u.notification_pref || "dashboard"), id);
    auditLog(req, currentUserId(req), "user.update", id, u.username || u.name);
    res.json({ ok: true, id });
  });
});

app.delete("/api/users/:id", (req, res) => {
  requireRole(req, res, ["superadmin", "admin"], () => {
    const id = String(req.params.id || "");
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    auditLog(req, currentUserId(req), "user.delete", id, "");
    res.json({ ok: true, id });
  });
});

app.post("/api/auth/login", (req, res) => {
  const u = req.body || {};
  const username = String(u.username || "").trim();
  const password = String(u.password || "").trim();
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  const expected = Buffer.from(user.password_hash, "base64").toString("utf8");
  if (password !== expected) return res.status(401).json({ error: "invalid credentials" });
  auditLog(req, user.id, "auth.login", user.id, user.username);
  res.json({ token: user.id, role: user.role, name: user.name, username: user.username });
});

app.post("/api/auth/logout", (req, res) => {
  const uid = currentUserId(req);
  auditLog(req, uid, "auth.logout", uid || "", "");
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });
  const user = db.prepare("SELECT id, username, role, name, title, dept, contact, scope_site, scope_rack, scope_zone, privileges, auth_method, notification_pref, created_at FROM users WHERE id = ?").get(uid);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  res.json(user);
});

app.get("/api/audit", (req, res) => {
  requireRole(req, res, ["superadmin", "admin", "auditor"], () => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const action = String(req.query.action || "").trim().toLowerCase();
    const user = String(req.query.user || "").trim().toLowerCase();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500));

    const conds = [];
    const params = [];
    if (q) { conds.push("(lower(target) LIKE ? OR lower(detail) LIKE ? OR lower(action) LIKE ?)"); params.push("%" + q + "%", "%" + q + "%", "%" + q + "%"); }
    if (action) { conds.push("lower(action) LIKE ?"); params.push("%" + action + "%"); }
    if (user) { conds.push("lower(user_id) LIKE ?"); params.push("%" + user + "%"); }
    if (from) { conds.push("created_at >= ?"); params.push(from); }
    if (to) { conds.push("created_at <= ?"); params.push(to); }
    const where = conds.length ? " WHERE " + conds.join(" AND ") : "";
    const rows = db.prepare("SELECT * FROM audit_logs" + where + " ORDER BY created_at DESC LIMIT ?").all(...params, limit);
    const total = db.prepare("SELECT COUNT(*) c FROM audit_logs" + where).get(...params).c;
    res.json({ rows, total });
  });
});

app.get("/api/audit/summary", (req, res) => {
  requireRole(req, res, ["superadmin", "admin", "auditor"], () => {
    const today = String(new Date().toISOString().slice(0, 10));
    const summary = {
      total: db.prepare("SELECT COUNT(*) c FROM audit_logs").get().c,
      today: db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE substr(created_at,1,10) = ?").get(today).c,
      login: db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action LIKE 'auth.login%'").get().c,
      user: db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action LIKE 'user.%'").get().c,
      ops: db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action LIKE 'ops.%'").get().c,
      asset: db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action LIKE 'asset.%' OR action LIKE 'rack.%' OR action LIKE 'site.%'").get().c,
    };
    res.json(summary);
  });
});

app.post("/api/audit/log", (req, res) => {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: "unauthorized" });
  const { action, target, detail } = req.body || {};
  if (!action || !target) return res.status(400).json({ error: "action & target required" });
  auditLog(req, uid, action, target, detail || "");
  res.json({ ok: true });
});

const BRAND_UPLOAD_DIR = path.join(DATA_DIR, "uploads", "brand");
if (!fs.existsSync(BRAND_UPLOAD_DIR)) fs.mkdirSync(BRAND_UPLOAD_DIR, { recursive: true });

app.get("/api/brand", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM brand").all();
  const out = {};
  rows.forEach(r => { out[r.key] = r.value; });
  res.json(out);
});

app.post("/api/brand", (req, res) => {
  const body = req.body || {};
  const allowed = ["companyName", "tagline", "logoSmallText", "footerText", "supportUrl", "privacyUrl", "termsUrl", "showPoweredBy"];
  const upd = db.prepare("INSERT INTO brand (key, value, updatedAt) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt");
  let n = 0;
  allowed.forEach(k => {
    if (body[k] !== undefined) { upd.run(k, String(body[k])); n++; }
  });
  if (n) auditLog(req, currentUserId(req), "brand.update", n + " key", Object.keys(body).filter(k => allowed.includes(k)).join(","));
  res.json({ ok: true, updated: n });
});

app.post("/api/brand/logo", (req, res) => {
  const key = String(req.query.key || "");
  if (!["logo", "logo-small"].includes(key)) return res.status(400).json({ error: "key harus 'logo' atau 'logo-small'" });
  const body = req.body || {};
  const dataUrl = String(body.data || "");
  if (!dataUrl) return res.status(400).json({ error: "data kosong" });
  const m = String(dataUrl).match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: "format data URL invalid" });
  const ext = m[1].split("/")[1].replace("+xml", "").replace("jpeg", "jpg");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 1 * 1024 * 1024) return res.status(413).json({ error: "file melebihi 1MB" });
  const fname = key + "." + ext;
  fs.writeFileSync(path.join(BRAND_UPLOAD_DIR, fname), buf);
  const url = "/data/uploads/brand/" + fname;
  db.prepare("INSERT INTO brand (key, value, updatedAt) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt").run(key, url);
  auditLog(req, currentUserId(req), "brand.logo", key, fname);
  res.json({ ok: true, url, key });
});

const OPS_KINDS = ["visits", "incidents", "maintenance"];
function opsKind(kind) {
  const k = String(kind || "");
  return OPS_KINDS.includes(k) ? k : null;
}

app.get("/api/attachments/:kind/:ref_id", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const refId = String(req.params.ref_id || "");
  if (!refId) return res.status(400).json({ error: "ref_id required" });
  const rows = db.prepare("SELECT * FROM attachments WHERE kind = ? AND ref_id = ? ORDER BY created_at").all(kind, refId);
  res.json(rows);
});

app.get("/api/attachments/:kind", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const rows = db.prepare("SELECT * FROM attachments WHERE kind = ? ORDER BY created_at DESC LIMIT 200").all(kind);
  res.json(rows);
});

app.delete("/api/attachments/:id", (req, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "id required" });
  db.prepare("DELETE FROM attachments WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.get("/api/:kind", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const rows = db.prepare("SELECT data FROM " + kind + " ORDER BY createdAt").all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

app.get("/api/:kind/:id", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const id = String(req.params.id || "");
  const row = db.prepare("SELECT data FROM " + kind + " WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "tidak ditemukan" });
  res.json(JSON.parse(row.data));
});

app.post("/api/:kind", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const rec = (req.body && typeof req.body === "object") ? req.body : {};
  const id = rec.id || genId(kind);
  const exists = db.prepare("SELECT data FROM " + kind + " WHERE id = ?").get(id);
  let prev = null;
  if (exists) { try { prev = JSON.parse(exists.data); } catch (e) {} }
  db.prepare("INSERT INTO " + kind + " (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
    .run(id, JSON.stringify(rec));
  const uid = currentUserId(req);
  const no = rec.no || rec.title || rec.tanggal || id;
  if (prev && prev.status && rec.status && prev.status !== rec.status) {
    const last = (Array.isArray(rec.status_history) && rec.status_history.length) ? rec.status_history[rec.status_history.length - 1] : null;
    auditLog(req, uid, "ops.transition", kind + "/" + id, (prev.status || "") + " → " + (rec.status || "") + (last && last.note ? " · " + last.note : ""));
  } else if (prev) {
    auditLog(req, uid, "ops.update", kind + "/" + id, no + (rec.status ? " · status " + rec.status : ""));
  } else {
    auditLog(req, uid, "ops.create", kind + "/" + id, no + (rec.status ? " · status " + rec.status : ""));
  }
  res.json({ ok: true, id });
});

app.patch("/api/:kind/:id", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const id = String(req.params.id || "");
  const cur = db.prepare("SELECT data FROM " + kind + " WHERE id = ?").get(id);
  const merged = Object.assign(cur ? JSON.parse(cur.data) : { id }, (req.body && typeof req.body === "object") ? req.body : {});
  db.prepare("INSERT INTO " + kind + " (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
    .run(id, JSON.stringify(merged));
  auditLog(req, currentUserId(req), "ops.update", kind + "/" + id, merged.no || merged.title || id);
  res.json({ ok: true, id });
});

app.delete("/api/:kind/:id", (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const id = String(req.params.id || "");
  const cur = db.prepare("SELECT data FROM " + kind + " WHERE id = ?").get(id);
  let label = "";
  if (cur) { try { const p = JSON.parse(cur.data); label = p.no || p.title || p.tanggal || id; } catch (e) { label = id; } }
  db.prepare("DELETE FROM " + kind + " WHERE id = ?").run(id);
  auditLog(req, currentUserId(req), "ops.delete", kind + "/" + id, label);
  res.json({ ok: true });
});

app.post("/api/uploads/:kind/:ref", express.raw({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], limit: "20mb" }), (req, res) => {
  const kind = opsKind(req.params.kind);
  if (!kind) return res.status(404).json({ error: "unknown resource" });
  const ref = String(req.params.ref || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!ref) return res.status(400).json({ error: "referensi lampiran invalid" });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: "body kosong" });
  if (buf.length > UPLOAD_MAX) return res.status(413).json({ error: "file melebihi 20MB" });
  let ext = ".pdf";
  if (isPdf(buf)) ext = ".pdf";
  else if (isImage(buf)) ext = ".jpg";
  else return res.status(400).json({ error: "format file tidak didukung (hanya PDF/JPG/PNG/WEBP)" });
  const dir = path.join(UPLOAD_ROOT, kind, ref);
  fs.mkdirSync(dir, { recursive: true });
  const existingFiles = fs.readdirSync(dir).filter(f => f.startsWith("file-"));
  const seq = existingFiles.length + 1;
  const fname = "file-" + seq + ext;
  fs.writeFileSync(path.join(dir, fname), buf);
  const orig = String(req.query.name || "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120) || fname;
  const url = "/data/uploads/" + kind + "/" + ref + "/" + fname;
  const attId = "att-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const uid = currentUserId(req);
  try {
    db.prepare("INSERT INTO attachments (id, kind, ref_id, field_key, filename, orig_name, size, mime_type, url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(attId, kind, ref, String(req.query.field || ""), fname, orig, buf.length, req.headers["content-type"] || "", url, uid || "anon");
  } catch (e) { /* abaikan */ }
  auditLog(req, uid, "attachment.upload", kind + "/" + ref, orig);
  res.json({ ok: true, id: attId, url: url, name: orig, size: buf.length });
});

// ---- Upload gambar depan/belakang perangkat (Rack Elevation) ----
// Simpan ke data/uploads/devices/<slug>-<view>.<ext>. Slug turunan lowercase
// nama device (sama seperti konvensi img/devices/<nama>-<view>). View: front|back.
// Referensi gambar (image[view] = url) ikut disimpan ke record server di SQLite
// (tabel servers + devices via upsertDevice) bila deviceKey cocok dengan hostname.
function findServerByDeviceKey(deviceKey) {
  const key = canonKey(deviceKey);
  if (!key) return null;
  const rows = db.prepare("SELECT id, data FROM servers").all();
  for (const r of rows) {
    try {
      const s = JSON.parse(r.data);
      if (s && s.hostname && canonKey(s.hostname) === key) return { id: r.id, data: s };
    } catch (e) { /* abaikan baris rusak */ }
  }
  return null;
}

function saveServerRecord(id, s) {
  db.prepare("INSERT INTO servers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
    .run(id, JSON.stringify(s));
  upsertDevice(s.hostname || id, "server", s.hostname || id, s);
}

app.post("/api/device-image/:deviceKey/:view", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "20mb" }), (req, res) => {
  const view = String(req.params.view || "").toLowerCase();
  if (view !== "front" && view !== "back") return res.status(400).json({ error: "view harus front|back" });
  const slug = String(req.params.deviceKey || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return res.status(400).json({ error: "deviceKey invalid" });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: "body kosong" });
  if (buf.length > UPLOAD_MAX) return res.status(413).json({ error: "file melebihi 20MB" });
  const ext = imageExt(buf);
  if (!ext) return res.status(400).json({ error: "format tidak didukung (hanya JPEG/PNG/WEBP)" });
  const dir = path.join(UPLOAD_ROOT, "devices");
  fs.mkdirSync(dir, { recursive: true });
  const base = slug + "-" + view;
  fs.readdirSync(dir).forEach(f => {
    if (f.startsWith(base + ".")) {
      try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* abaikan */ }
    }
  });
  const fname = base + ext;
  fs.writeFileSync(path.join(dir, fname), buf);
  const url = "/data/uploads/devices/" + fname;
  const rec = findServerByDeviceKey(slug);
  if (rec) {
    rec.data.image = rec.data.image || {};
    rec.data.image[view] = url;
    saveServerRecord(rec.id, rec.data);
  }
  const uid = currentUserId(req);
  auditLog(req, uid, "attachment.upload", "device-image/" + slug, view + " → " + fname + (rec ? " · server " + rec.data.hostname : ""));
  res.json({ ok: true, view, url, name: fname, size: buf.length, synced: !!rec });
});

// ---- Hapus gambar depan/belakang perangkat ----
app.delete("/api/device-image/:deviceKey/:view", (req, res) => {
  const view = String(req.params.view || "").toLowerCase();
  if (view !== "front" && view !== "back") return res.status(400).json({ error: "view harus front|back" });
  const slug = String(req.params.deviceKey || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return res.status(400).json({ error: "deviceKey invalid" });
  const dir = path.join(UPLOAD_ROOT, "devices");
  const base = slug + "-" + view;
  let removed = 0;
  try {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => {
        if (f.startsWith(base + ".")) {
          try { fs.unlinkSync(path.join(dir, f)); removed++; } catch (e) { /* abaikan */ }
        }
      });
    }
  } catch (e) { /* abaikan */ }
  const rec = findServerByDeviceKey(slug);
  if (rec && rec.data.image) {
    delete rec.data.image[view];
    if (!Object.keys(rec.data.image).length) delete rec.data.image;
    saveServerRecord(rec.id, rec.data);
  }
  auditLog(req, currentUserId(req), "attachment.upload", "device-image/" + slug, "hapus " + view + (rec ? " · server " + rec.data.hostname : ""));
  res.json({ ok: true, removed, synced: !!rec });
});

app.use((req, res, next) => {
  const p = decodeURIComponent(req.path || "");
  if (/^\/data\/.+\.(db|db-wal|db-shm)$/i.test(p)) return res.status(403).json({ error: "forbidden" });
  next();
});

app.use(express.static(__dirname));

app.get("/", (req, res) => res.redirect("/dashboard.html"));

app.listen(PORT, () => {
  console.log("RackView server jalan di http://localhost:" + PORT);
  if (backfilledLocations > 0) console.log("[migration] " + backfilledLocations + " device dilengkapi lokasi (site/rackId) dari data");
  if (prunedDevices > 0) console.log("[maintenance] " + prunedDevices + " device yatim dibersihkan dari registri");
});
