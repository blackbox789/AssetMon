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
db.exec(`
  -- Skema & kunci utama:
  --  racks    : rackId (PK, unik per rack fisik) + kolom ringkasan; diindeks site & createdAt.
  --  servers  : id (PK) = id server; detail tersimpan sebagai JSON di kolom data.
  --  maps     : satu tabel untuk Port Map & Power Map, dibedakan lewat kind
  --             ('port' => deviceKey = hostname perangkat; 'power' => deviceKey = nama PDU).
  --             PK (kind, deviceKey) menjamin satu data per (jenis, perangkat);
  --             deviceKey diindeks agar pencarian lintas-kind (mis. semua kabel milik sebuah perangkat) cepat.
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
    PRIMARY KEY (kind, deviceKey)
  );
  CREATE INDEX IF NOT EXISTS idx_maps_device_key ON maps(deviceKey);
  CREATE INDEX IF NOT EXISTS idx_maps_kind_created ON maps(kind, createdAt);
  CREATE INDEX IF NOT EXISTS idx_racks_site ON racks(site);
  CREATE INDEX IF NOT EXISTS idx_racks_created ON racks(createdAt);
  CREATE INDEX IF NOT EXISTS idx_servers_created ON servers(createdAt);
`);
const mapCols = db.prepare("PRAGMA table_info(maps)").all();
if (!mapCols.some(c => c.name === "updatedAt")) {
  db.exec("ALTER TABLE maps ADD COLUMN updatedAt TEXT NOT NULL DEFAULT (datetime('now'))");
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, racks: db.prepare("SELECT COUNT(*) c FROM racks").get().c, servers: db.prepare("SELECT COUNT(*) c FROM servers").get().c, maps: db.prepare("SELECT COUNT(*) c FROM maps").get().c });
});

app.get("/api/racks", (req, res) => {
  const rows = db.prepare("SELECT * FROM racks ORDER BY createdAt").all();
  res.json(rows.map(r => ({ ...r, size: Number(r.size), server: Number(r.server), sw: Number(r.sw), pdu: Number(r.pdu), firewall: Number(r.firewall), patch: Number(r.patch), totalDevices: Number(r.totalDevices), util: Number(r.util) })));
});

app.post("/api/racks", (req, res) => {
  const r = req.body || {};
  const rackId = String(r.rackId || "").trim().toUpperCase();
  if (!rackId) return res.status(400).json({ error: "rackId wajib diisi" });
  const entry = {
    rackId,
    site: String(r.site || ""), siteName: String(r.siteName || ""), loc: String(r.loc || ""), zone: String(r.zone || ""),
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
  res.json(entry);
});

app.delete("/api/racks/:rackId", (req, res) => {
  const rackId = String(req.params.rackId || "").toUpperCase();
  db.prepare("DELETE FROM racks WHERE rackId = ?").run(rackId);
  res.json({ ok: true });
});

app.get("/api/servers", (req, res) => {
  const rows = db.prepare("SELECT data FROM servers ORDER BY createdAt").all();
  res.json(rows.map(r => JSON.parse(r.data)));
});

app.post("/api/servers", (req, res) => {
  const s = req.body || {};
  const id = s.id || "srv-" + Date.now().toString(36);
  const record = { ...s, id };
  db.prepare("INSERT INTO servers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(id, JSON.stringify(record));
  res.json({ ok: true, id });
});

app.delete("/api/servers/:id", (req, res) => {
  db.prepare("DELETE FROM servers WHERE id = ?").run(String(req.params.id || ""));
  res.json({ ok: true });
});

app.get("/api/maps/:kind", (req, res) => {
  const kind = String(req.params.kind || "");
  const rows = db.prepare("SELECT deviceKey, data FROM maps WHERE kind = ? ORDER BY createdAt").all(kind);
  res.json(rows.map(r => ({ deviceKey: r.deviceKey, data: JSON.parse(r.data) })));
});

app.get("/api/maps/:kind/:deviceKey", (req, res) => {
  const kind = String(req.params.kind || "");
  const deviceKey = String(req.params.deviceKey || "");
  const row = db.prepare("SELECT deviceKey, data FROM maps WHERE kind = ? AND deviceKey = ?").get(kind, deviceKey);
  if (!row) return res.status(404).json({ error: "tidak ditemukan" });
  res.json({ deviceKey: row.deviceKey, data: JSON.parse(row.data) });
});

app.post("/api/maps/:kind/:deviceKey", (req, res) => {
  const kind = String(req.params.kind || "");
  const deviceKey = String(req.params.deviceKey || "");
  if (!["port", "power"].includes(kind)) return res.status(400).json({ error: "kind harus 'port' atau 'power'" });
  if (!deviceKey) return res.status(400).json({ error: "deviceKey wajib diisi" });
  const data = (req.body && req.body.data !== undefined) ? req.body.data : req.body;
  db.prepare(`
    INSERT INTO maps (kind, deviceKey, data) VALUES (?, ?, ?)
    ON CONFLICT(kind, deviceKey) DO UPDATE SET data=excluded.data, updatedAt=datetime('now')
  `).run(kind, deviceKey, JSON.stringify(data));
  res.json({ ok: true, kind, deviceKey });
});

app.delete("/api/maps/:kind/:deviceKey", (req, res) => {
  const kind = String(req.params.kind || "");
  const deviceKey = String(req.params.deviceKey || "");
  db.prepare("DELETE FROM maps WHERE kind = ? AND deviceKey = ?").run(kind, deviceKey);
  res.json({ ok: true });
});

app.use(express.static(__dirname));

app.get("/", (req, res) => res.redirect("/dashboard.html"));

app.listen(PORT, () => {
  console.log("RackView server jalan di http://localhost:" + PORT);
});
