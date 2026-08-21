// Verify: js/asset-list.js — Ringkasan Identitas Perangkat (summary panel helpers)
// Jalankan: node verify-asset-list.cjs
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? " - " + extra : ""}`); }
}
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} - got ${g} want ${w}`); }
}

const src = fs.readFileSync(path.join(__dirname, "js", "asset-list.js"), "utf8");

function slice(from, to, includeTo) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error("marker not found: " + from);
  const j = to ? src.indexOf(to, i) : src.length;
  if (j < 0) throw new Error("marker not found: " + to);
  return src.slice(i, includeTo ? j + to.length : j);
}

const NF_LABELS = slice("const NF_LABELS = {", "};", true);
const summaryBlock = slice("// ---- Ringkasan Identitas Perangkat", "\nlet editingAsset = null;");

const code = [
  `const TYPE_LABELS = { switch: "Network Switch", firewall: "Firewall", router: "Router", pdu: "PDU", ups: "UPS", patch: "Patch Panel", storage: "Storage", server: "Server" };`,
  `const ASSET_PORT_MAP_TYPES = ["switch", "server", "firewall", "router", "patch", "ups", "storage"];`,
  NF_LABELS,
  `function readAssetRow(tr) { return tr; }`,
  `const openPortMap = (name, ...a) => "PORT:" + name + ":" + JSON.stringify(a);`,
  `const openPowerMap = (name, ...a) => "POWER:" + name + ":" + JSON.stringify(a);`,
  `function escA(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }`,
  summaryBlock,
].join("\n");

global.window = global;

vm.runInThisContext(code, { filename: "asset-list-summary.js" });

console.log("Ringkasan Identitas Perangkat — buildAssetSummaryHTML");
{
  const rec = {
    name: "SW-CORE-01", type: "switch", brand: "Cisco", model: "Catalyst 9300",
    rack: "R1-A12", posisiU: "U4", ip: "10.10.0.1", serial: "SW-1",
    site: "DC1", tags: ["production", "network-core"],
    lanRj45: "48", lanSfp: "4", speed: "10G", os: "IOS-XE", vlan: "1,10-99",
    psuCount: "2", psuWatt: "715", powerRedundancy: "Redundant",
    tahunPembelian: "2021", warranty: "2026", monitoring: "SNMP v3",
  };
  const html = buildAssetSummaryHTML(rec, { name: rec.name, type: rec.type });
  t("header nama asset", html.includes("SW-CORE-01"));  t("chip tipe switch", html.includes("Network Switch"));
  t("chip brand/model", html.includes("Cisco") && html.includes("Catalyst 9300"));
  t("group Identitas", html.includes("Identitas"));
  t("group Network & Daya", html.includes("Network &amp; Daya"));
  t("group Pembelian", html.includes("Pembelian"));
  t("nilai IP", html.includes("10.10.0.1"));
  t("nilai VLAN label", html.includes("VLAN / Segment"));
  t("nilai PSU", html.includes("2"));
  t("nilai tahun pembelian", html.includes("2021"));
  t("link Port Map (switch)", html.includes("Buka Port Map"));
}

{
  const rec = { name: "PDU-R1-A", type: "pdu", brand: "APC", model: "PDU2", rack: "R1", psuCount: "2" };
  const html = buildAssetSummaryHTML(rec, { name: rec.name, type: rec.type });
  t("link Power Map (pdu)", html.includes("Buka Power Map") && html.includes("PDU"));
  t("pdu tidak punya Port Map", !html.includes("Buka Port Map"));
}

{
  const html = buildAssetSummaryHTML(null, { name: "SRV-DB-01", type: "server", rack: "R1", posisiU: "U12", ip: "10.0.0.5", serial: "SRV-X" });
  t("fallback dari baris (server)", html.includes("SRV-DB-01") && html.includes("SRV-X") && html.includes("10.0.0.5"));
  t("fallback server dapat Port Map", html.includes("Buka Port Map"));
}

{
  const html = buildAssetSummaryHTML({ name: "FW-1", type: "firewall", brand: "A&B", tags: [] }, { name: "FW-1", type: "firewall" });
  t("escaping brand &", html.includes("A&amp;B") && !html.includes("A&B"));
  t("tidak render baris kosong", html.includes("Identitas") && !html.includes("Brand / Model</span><span class=\"kv-value\"></span>"));
}

console.log("Ringkasan Identitas Perangkat — helper atomic");
eq("assetSummaryKvRow kosong", assetSummaryKvRow("X", ""), "");
eq("assetSummaryKvRow null", assetSummaryKvRow("X", null), "");
t("assetSummaryKvRow terisi", assetSummaryKvRow("A", "B").includes('class="kv-label">A</span><span class="kv-value">B</span>'));
eq("assetSummaryGroup kosong", assetSummaryGroup("T", ""), "");
t("assetSummaryGroup terisi", assetSummaryGroup("T", "<div>x</div>").includes('class="kv-group-title">T</div><div>x</div>'));
eq("assetSummaryMapLink tanpa nama", assetSummaryMapLink({}, "switch"), "");
t("assetSummaryMapLink openPowerMap", assetSummaryMapLink({ name: "PDU1", psuCount: "3" }, "pdu").includes("openPowerMap('PDU1', false, 3)"));
t("assetSummaryMapLink openPortMap", assetSummaryMapLink({ name: "SW1" }, "switch").includes("openPortMap('SW1', false, 0"));

console.log("Pagination — assetPaging & getAssetPageSize");
{
  const paginationBlock = slice("const ASSET_PAGE_SIZES = [10, 20, 30, 40, 50];", "\n[filterSite, filterType, filterStatus, filterTag].forEach");
  const __store = {};
  global.localStorage = {
    getItem: k => (k in __store ? __store[k] : null),
    setItem: (k, v) => { __store[k] = String(v); },
  };
  vm.runInThisContext(`const PAGE_SIZE_KEY = "rv_page_size";\n` + paginationBlock, { filename: "asset-list-paging.js" });
  eq("halaman 1/3 (25 item, size 10)", assetPaging(25, 1, 10), { pages: 3, page: 1, from: 0, to: 10 });
  eq("halaman 2/3", assetPaging(25, 2, 10), { pages: 3, page: 2, from: 10, to: 20 });
  eq("halaman 3/3 sisa 5", assetPaging(25, 3, 10), { pages: 3, page: 3, from: 20, to: 25 });
  eq("page melebihi total di-clamp", assetPaging(25, 9, 10), { pages: 3, page: 3, from: 20, to: 25 });
  eq("0 item tetap 1 halaman", assetPaging(0, 1, 10), { pages: 1, page: 1, from: 0, to: 0 });
  eq("total kurang dari size", assetPaging(7, 1, 10), { pages: 1, page: 1, from: 0, to: 7 });
  t("default ukuran halaman 50", getAssetPageSize() === 50);
  __store["rv_page_size"] = "20";
  t("ukuran halaman dari localStorage 20", getAssetPageSize() === 20);
  __store["rv_page_size"] = "7";
  t("ukuran halaman tidak valid kembali ke 50", getAssetPageSize() === 50);
}

console.log("Pagination PDU — pduPaging & getPduPageSize");
{
  const src2 = fs.readFileSync(path.join(__dirname, "js", "pdu-list.js"), "utf8");
  const block = src2.slice(src2.indexOf("const PDU_PAGE_SIZES = [10, 20, 30, 40, 50];"), src2.indexOf("\nconst STATUS_BADGE"));
  vm.runInThisContext(block, { filename: "pdu-list-paging.js" });
  eq("pdu halaman 1/4", pduPaging(35, 1, 10), { pages: 4, page: 1, from: 0, to: 10 });
  eq("pdu halaman 4/4 sisa 5", pduPaging(35, 4, 10), { pages: 4, page: 4, from: 30, to: 35 });
  eq("pdu page berlebih di-clamp", pduPaging(35, 99, 10), { pages: 4, page: 4, from: 30, to: 35 });
  global.localStorage.setItem("rv_page_size", "7");
  t("pdu default ukuran halaman 50", getPduPageSize() === 50);
  global.localStorage.setItem("rv_page_size", "30");
  t("pdu ukuran halaman dari localStorage 30", getPduPageSize() === 30);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
