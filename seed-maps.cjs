/* seed-maps.cjs - Seed Port Map & Power Map dasar ke SQLite via API.
   Sumber data: objek DEFAULT_PORT_DATA / DEFAULT_POWER_DATA di js/port-data.js
   (diekstrak via vm agar tidak diduplikasi/dihardcode ulang di sini),
   ditambah skeleton map untuk perangkat ber-spesifikasi yang belum punya map.

   Idempoten: entri yang sudah ada di DB dilewati; --force untuk menimpa.
   Server harus berjalan: npm start */

const fs = require("fs");
const vm = require("vm");
const path = require("path");
const BASE = "http://127.0.0.1:3000/api";
const FORCE = process.argv.includes("--force");

// ---- Ekstrak DEFAULT_* dari port-data.js tanpa duplikasi manual ----
function loadPortDataModule() {
  const root = path.join(__dirname, "js");
  const src = ["keys.js", "port-data.js"]
    .map(f => fs.readFileSync(path.join(root, f), "utf8"))
    .join("\n;\n") +
    "\n;globalThis.__EXTRACT__ = { DEFAULT_PORT_DATA, DEFAULT_POWER_DATA, SPECIAL_PORT_DEFS };";
  const elStub = () => ({ addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} }, value: "" });
  const sandbox = {
    document: {
      getElementById: () => elStub(),
      querySelector: () => elStub(),
      querySelectorAll: () => [],
      addEventListener() {},
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: () => Promise.reject(new Error("offline-stub")),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "port-data-seed.js" });
  return sandbox.__EXTRACT__;
}

async function getJson(pathname) {
  const r = await fetch(BASE + pathname);
  if (!r.ok) throw new Error(pathname + " -> " + r.status);
  return r.json();
}
async function postMap(kind, key, data) {
  const r = await fetch(`${BASE}/maps/${kind}/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error(`POST /api/maps/${kind}/${key} -> ${r.status}`);
}

async function main() {
  let EX;
  try { EX = loadPortDataModule(); } catch (e) { console.error("Gagal memuat port-data.js:", e.message); process.exit(1); }
  let devs, portExisting, powerExisting;
  try {
    [devs, portExisting, powerExisting] = await Promise.all([
      getJson("/devices"), getJson("/maps/port"), getJson("/maps/power"),
    ]);
  } catch (e) {
    console.error("Server tidak aktif. Jalankan dulu: npm start");
    process.exit(1);
  }
  const havePort = new Set(portExisting.map(x => x.deviceKey));
  const havePower = new Set(powerExisting.map(x => x.deviceKey));
  let created = 0, skipped = 0;

  // ---- 1) Port Map dari DEFAULT_PORT_DATA (data demo kaya: baris koneksi dll.) ----
  for (const [key, data] of Object.entries(EX.DEFAULT_PORT_DATA)) {
    if (havePort.has(key) && !FORCE) { skipped++; continue; }
    await postMap("port", key, data);
    havePort.add(key);
    console.log((havePort.has(key) && !FORCE ? "buat " : "timpa ") + "port  | " + key);
    created++;
  }

  // ---- 2) Power Map dari DEFAULT_POWER_DATA ----
  for (const [key, data] of Object.entries(EX.DEFAULT_POWER_DATA)) {
    if (havePower.has(key) && !FORCE) { skipped++; continue; }
    await postMap("power", key, data);
    havePower.add(key);
    console.log("seed  power | " + key);
    created++;
  }

  // ---- 3) Skeleton untuk perangkat ber-spesifikasi yang belum punya map ----
  const n = v => parseInt(v, 10) || 0;
  for (const d of devs) {
    let spec = {};
    try { spec = typeof d.data === "string" ? (JSON.parse(d.data) || {}) : (d.data || {}); } catch { continue; }
    const type = String(d.type || "").toLowerCase();
    if (!spec || !Object.keys(spec).length) continue;
    if (!havePort.has(d.deviceKey)) {
      const rj = n(spec.lanRj45), sfp = n(spec.lanSfp), q = n(spec.lanQsfp);
      const ports = rj + sfp + q * 4, sfpTotal = sfp + q * 4;
      if (!ports) { skipped++; continue; }
      await postMap("port", d.deviceKey, {
        type, ports, sfp: sfpTotal, rows: [],
        specials: JSON.parse(JSON.stringify(EX.SPECIAL_PORT_DEFS[type] || [])),
      });
      havePort.add(d.deviceKey);
      console.log("skel  port  | " + d.deviceKey + " (" + ports + " port)");
      created++;
    }
    if (type === "pdu" && !havePower.has(d.deviceKey)) {
      await postMap("power", d.deviceKey, { type: "pdu", ports: n(spec.pduOutlets) || 12, rows: [] });
      havePower.add(d.deviceKey);
      console.log("skel  power | " + d.deviceKey);
      created++;
    }
  }

  console.log(`\nSelesai. dibuat/ditimpa=${created} dilewati(sudah ada)=${skipped}`);
}

main();
