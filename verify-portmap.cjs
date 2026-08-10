// Verifikasi fix Port Map QSFP di js/port-data.js (tanpa browser):
// 1) portLayoutFromServer — sinkronisasi & tanpa double-count SFP
// 2) psuOptionsFor / psuColor (regresi dari fitur PSU >4)
// 3) render openPortMap — kotak QSFP muncul, grid RJ45 tidak dobel SFP,
//    layout tersinkron dari record server (lanRj45/lanSfp/lanQsfp)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? " — " + extra : ""}`); }
}
function eq(name, got, want) {
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

// ---- Shim DOM minimal untuk memuat port-data.js di Node ----
const elements = {};
function makeEl(id) {
  const handlers = {};
  return {
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    querySelectorAll() { return []; },
    addEventListener(type, fn) { handlers[type] = fn; },
    click() { if (handlers.click) handlers.click({ target: this }); },
  };
}
global.document = {
  getElementById(id) { return (elements[id] = elements[id] || makeEl(id)); },
  querySelectorAll() { return []; },
  addEventListener() {},
  body: { insertAdjacentHTML() {}, querySelectorAll() { return []; } },
};
global.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};
global._alerts = 0;
global.alert = () => { global._alerts++; };
global.window = global;

const src = fs.readFileSync(path.join(__dirname, "js", "port-data.js"), "utf8");
vm.runInThisContext(src, { filename: "port-data.js" });

const E = (expr) => vm.runInThisContext(expr);

// ---- 1) portLayoutFromServer ----
console.log("[1] portLayoutFromServer (sync layout & hilangkan double-count SFP)");
eq("record lanRj45=4 lanSfp=2 lanQsfp=0 -> {ports:4,sfp:2,qsfp:0} (bukan 6)", E(`portLayoutFromServer({lanRj45:"4",lanSfp:"2",lanQsfp:"0"}, 8, 0, 0)`), { ports: 4, sfp: 2, qsfp: 0 });
eq("record lanRj45=2 lanSfp=4 lanQsfp=1 -> {ports:2,sfp:4,qsfp:1}", E(`portLayoutFromServer({lanRj45:"2",lanSfp:"4",lanQsfp:"1"}, 8, 0, 0)`), { ports: 2, sfp: 4, qsfp: 1 });
eq("record all-fiber lanRj45=0 lanSfp=0 lanQsfp=4 -> {ports:0,sfp:0,qsfp:4}", E(`portLayoutFromServer({lanRj45:"0",lanSfp:"0",lanQsfp:"4"}, 8, 0, 0)`), { ports: 0, sfp: 0, qsfp: 4 });
eq("record kosong {} -> pakai fallback {ports:8,sfp:1,qsfp:2}", E(`portLayoutFromServer({}, 8, 1, 2)`), { ports: 8, sfp: 1, qsfp: 2 });
eq("record null -> fallback", E(`portLayoutFromServer(null, 8, 1, 2)`), { ports: 8, sfp: 1, qsfp: 2 });

// ---- 2) psuOptionsFor / psuColor (regresi) ----
console.log("[2] psuOptionsFor & psuColor");
eq("psuOptionsFor(1)", E(`psuOptionsFor(1)`), ["Single PSU", "PSU-A"]);
eq("psuOptionsFor(4)", E(`psuOptionsFor(4)`), ["PSU-A", "PSU-B", "PSU-C", "PSU-D", "Single PSU"]);
eq("psuOptionsFor(10)", E(`psuOptionsFor(10)`), ["PSU-A", "PSU-B", "PSU-C", "PSU-D", "PSU-E", "PSU-F", "PSU-G", "PSU-H", "PSU-I", "PSU-J", "Single PSU"]);
check("psuColor PSU-C warning", E(`psuColor("PSU-C")`) === "var(--warning)");
check("psuColor PSU-D danger", E(`psuColor("PSU-D")`) === "var(--danger)");
check("psuColor PSU-J palet", E(`psuColor("PSU-J")`) === "#14B8A6");
check("psuColor Single PSU violet", E(`psuColor("Single PSU")`) === "var(--violet)");

// ---- 3) render openPortMap (fallback dari record server) ----
console.log("[3] render openPortMap — QSFP + sinkron + tanpa double-count");
E(`_servers = [
  { hostname: "SRV-QSFP-01", id: "SRV-QSFP-01", lanRj45: "4", lanSfp: "2", lanQsfp: "2", speed: "10G" },
  { hostname: "SRV-QSFP-02", id: "SRV-QSFP-02", lanRj45: "4", lanSfp: "2", lanQsfp: "1", speed: "10G" },
]`);
E(`getServers = () => _servers`);
E(`updateServer = (id, s) => { const i = _servers.findIndex(x => x.id === id); if (i >= 0) _servers[i] = s; return true; }`);

// 3a. fallback: tidak ada PORT_DATA untuk SRV-QSFP-01
E(`delete PORT_DATA["SRV-QSFP-01"]`);
E(`openPortMap("SRV-QSFP-01", false, 0, { type: "server", formFactor: "1U" })`);
const html1 = elements["portmap-body"].innerHTML;
check("grid RJ45 = 4 (data-port-edit=4 ada)", html1.includes(`data-port-edit="4"`));
check("tidak ada port 5 (bukan double-count)", !html1.includes(`data-port-edit="5"`));
check("kotak SFP1 & SFP2 ada", html1.includes("SFP1") && html1.includes("SFP2"));
check("kotak QSFP1 & QSFP2 ada", html1.includes("QSFP1") && html1.includes("QSFP2"));
check("sub teks sesuai", elements["portmap-sub"].textContent === "0 port terpakai dari 4 port + 2 SFP + 2 QSFP");
check("tombol Ubah Jumlah Port ada", html1.includes(`id="portmap-count-btn"`));
check("panel edit port ada", html1.includes(`id="portmap-count-rj45"`));
check("lastPortMeta menyimpan qsfp (dipakai editor saat buat data baru)", E(`lastPortMeta.qsfp`) === 2 && E(`lastPortMeta.ports`) === 4);
check("fallback belum dipersist (baru tersimpan saat ada edit)", E(`PORT_DATA["SRV-QSFP-01"]`) === undefined);
// Simulasi jalur editor (port-map.js:429): buat data baru dari lastPortMeta → qsfp harus dipertahankan
E(`PORT_DATA["SRV-QSFP-01"] = { type: lastPortMeta.type, ports: lastPortMeta.ports, sfp: lastPortMeta.sfp, qsfp: lastPortMeta.qsfp || 0, rows: [] }`);
check("data baru dari editor mempertahankan qsfp", E(`PORT_DATA["SRV-QSFP-01"].qsfp`) === 2 && E(`PORT_DATA["SRV-QSFP-01"].ports`) === 4);

// 3b. sync: PORT_DATA tersimpan lama (ports:2, sfp:0) harus ditimpa record server
E(`PORT_DATA["SRV-QSFP-02"] = { type: "server", ports: 2, sfp: 0, qsfp: 0, rows: [], specials: [] }`);
E(`openPortMap("SRV-QSFP-02", false, 0, { type: "server", formFactor: "1U" })`);
const html2 = elements["portmap-body"].innerHTML;
check("layout tersinkron dari record: ports=4", E(`PORT_DATA["SRV-QSFP-02"].ports`) === 4);
check("sfp tersinkron = 2", E(`PORT_DATA["SRV-QSFP-02"].sfp`) === 2);
check("qsfp tersinkron = 1", E(`PORT_DATA["SRV-QSFP-02"].qsfp`) === 1);
check("render QSFP1 ada", html2.includes("QSFP1"));
check("sub teks SRV-QSFP-02 sinkron", elements["portmap-sub"].textContent === "0 port terpakai dari 4 port + 2 SFP + 1 QSFP");

// 3c. toolbar Simpan: ubah jumlah port → update PORT_DATA + server record + re-render
console.log("[3c] toolbar Ubah Jumlah Port — simpan & tulis balik ke server record");
global.document.getElementById("portmap-count-rj45").value = "6";
global.document.getElementById("portmap-count-sfp").value = "4";
global.document.getElementById("portmap-count-qsfp").value = "2";
global.document.getElementById("portmap-count-save").click();
check("PORT_DATA diperbarui (ports=6 sfp=4 qsfp=2)", E(`PORT_DATA["SRV-QSFP-02"].ports`) === 6 && E(`PORT_DATA["SRV-QSFP-02"].sfp`) === 4 && E(`PORT_DATA["SRV-QSFP-02"].qsfp`) === 2);
check("server record ditulis ulang lanRj45=6 lanSfp=4 lanQsfp=2", E(`_servers[1].lanRj45`) === "6" && E(`_servers[1].lanSfp`) === "4" && E(`_servers[1].lanQsfp`) === "2");
const html3 = elements["portmap-body"].innerHTML;
check("re-render: grid RJ45 jadi 6", html3.includes(`data-port-edit="6"`) && !html3.includes(`data-port-edit="7"`));
check("re-render: kotak QSFP1 & QSFP2 ada, QSFP3 tidak", html3.includes("QSFP1") && html3.includes("QSFP2") && !html3.includes("QSFP3"));

// 3d. guard: jangan biarkan koneksi aktif disembunyikan
E(`PORT_DATA["SRV-QSFP-02"].rows.push({ port: "QSFP4", vlan: "v10", dest: "SW-X", destPort: "1", ip: "1.1.1.1", label: "CBL-9" })`);
E(`openPortMap("SRV-QSFP-02", false, 0, { type: "server", formFactor: "1U" })`);
const before = global._alerts;
global.document.getElementById("portmap-count-rj45").value = "6";
global.document.getElementById("portmap-count-sfp").value = "4";
global.document.getElementById("portmap-count-qsfp").value = "1";
global.document.getElementById("portmap-count-save").click();
check("peringatan muncul saat koneksi QSFP4 akan disembunyikan", global._alerts === before + 1);
check("qsfp tidak diubah (tetap 2)", E(`PORT_DATA["SRV-QSFP-02"].qsfp`) === 2);

// ---- 4) Power Map: psuCount dari record server walau dipanggil tanpa argumen ----
console.log("[4] Power Map — psuCount tersinkron dari record server");
E(`_servers.push({ hostname: "SRV-PSU-04", id: "SRV-PSU-04", psuCount: "4", psuWatt: "2200 W" })`);
E(`openPowerMap("SRV-PSU-04", false, 0)`);
const pmBody = elements["powermap-body"].innerHTML;
check("dropdown Jumlah PSU = 4 (dari record, bukan default 2)", elements["powermap-devpsu-count"].value === "4");
check("render 4 slot PSU (Slot PSU 4 ada)", pmBody.includes("Slot PSU 4") && !pmBody.includes("Slot PSU 5"));
E(`openPowerMap("SRV-PSU-04", false, 8)`);
check("count eksplisit tidak menimpa record server (tetap 4)", elements["powermap-devpsu-count"].value === "4");
// non-server (tanpa record) tetap pakai argumen/default
E(`openPowerMap("PDU-B", false, 0)`);
check("PDU tetap pakai cabang PDU (judul PDU-B)", elements["powermap-title"].textContent === "PDU-B — Power Map");

// ---- 5) Direktori Port Map: layout tersinkron dari record server ----
console.log("[5] direktori port-map-page — sync dari record server");
E(`PDU_DATA = []`);
global.location = { search: "" };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "js", "port-map-page.js"), "utf8"), { filename: "port-map-page.js" });
const d1 = E(`pmCollectDevices().find(x => x.name === "SRV-QSFP-01")`);
const d2 = E(`pmCollectDevices().find(x => x.name === "SRV-QSFP-02")`);
check("SRV-QSFP-01 di direktori = record 4/2/2", d1.ports === 4 && d1.sfp === 2 && d1.qsfp === 2);
check("SRV-QSFP-02 di direktori ikut record 6/4/2", d2.ports === 6 && d2.sfp === 4 && d2.qsfp === 2);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
