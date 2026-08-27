/* ============================================
   RackView — Server data
   DEFAULT_SERVERS (demo) + localStorage helpers.
   Data server yang disimpan lewat form (Simpan
   Server / Simpan Asset) masuk ke localStorage
   dan tampil paling atas di Daftar Server.
   ============================================ */

const DEFAULT_SERVERS = [
  {
    id: "demo-1", hostname: "SRV-DB-01", tipeServer: "rack", formFactor: "2U",
    vendor: "Dell", model: "PowerEdge R750", serial: "SVC-R750-0001",
    tahunPembelian: "2023", warranty: "ProSupport Plus s.d. 2027",
    os: "Linux", processorCount: "dual", processorType: "Intel Xeon Gold 6338",
    coreThread: "64C / 128T", dimmTotal: "32", dimmPerSlot: "64 GB", dimmInstalled: "1024 GB",
    dimmSlots: Array.from({ length: 16 }, (_, i) => ({
      slot: i + 1, type: "DDR4", cap: "64 GB",
      brand: i === 15 ? "SK hynix" : "Samsung",
      status: i === 14 ? "degradasi" : i === 15 ? "failed" : "online",
      notes: i === 14 ? "ECC error corrected" : i === 15 ? "Module failed POST" : "",
    })),
    storageBays: "16", storageCap: "12 TB", storageIface: "SAS",
    storageSlots: [
      { bay: 1, type: "HDD", cap: "2 TB", raid: "RAID 1", brand: "Seagate", status: "online", notes: "Exos 7E8" },
      { bay: 2, type: "HDD", cap: "2 TB", raid: "RAID 1", brand: "Seagate", status: "degradasi", notes: "Peringatan SMART: reallocated sectors" },
      { bay: 3, type: "HDD", cap: "2 TB", raid: "RAID 5", brand: "WD", status: "online", notes: "Gold" },
      { bay: 4, type: "HDD", cap: "2 TB", raid: "RAID 5", brand: "WD", status: "online", notes: "Gold" },
      { bay: 5, type: "HDD", cap: "2 TB", raid: "RAID 5", brand: "WD", status: "online", notes: "Gold" },
      { bay: 6, type: "HDD", cap: "2 TB", raid: "RAID 5", brand: "WD", status: "online", notes: "Gold" }
    ],
    raid: "Ya", raidTypes: ["RAID 1", "RAID 10"],
    lanRj45: "4", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "iDRAC",
    pcieCount: "3", pcieGen: "Gen4", psuCount: "2", psuWatt: "750 W", powerRedundancy: "Redundant",
    site: "DC1", siteName: "DC1 — Cilandak", rack: "R1-A12", posisiU: "U01–U02",
    vlan: "VLAN 100 — Database", cableManagement: "PP-01-A · P1–P4",
    hypervisor: "Linux", fungsi: ["Database"], monitoring: ["SNMP", "IPMI"],
    kondisi: "Active", assetTag: "ASET-RV-000101", tags: ["production", "database"]
  },
  {
    id: "demo-2", hostname: "SRV-WEB-01", tipeServer: "rack", formFactor: "1U",
    vendor: "HPE", model: "ProLiant DL360", serial: "SVC-DL360-0002",
    tahunPembelian: "2024", warranty: "Care Pack s.d. 2029",
    os: "Linux", processorCount: "dual", processorType: "AMD EPYC 7543",
    coreThread: "32C / 64T", dimmTotal: "24", dimmPerSlot: "64 GB", dimmInstalled: "768 GB",
    dimmSlots: Array.from({ length: 12 }, (_, i) => ({ slot: i + 1, type: "DDR5", cap: "64 GB", brand: "Samsung", status: "online", notes: "RDIMM ECC" })),
    storageBays: "8", storageCap: "960 GB", storageIface: "NVMe",
    raid: "Ya", raidTypes: ["RAID 1"],
    lanRj45: "4", lanSfp: "4", lanQsfp: "0", speed: "25G", mgmtPort: "iLO",
    pcieCount: "4", pcieGen: "Gen4", psuCount: "2", psuWatt: "800 W", powerRedundancy: "Redundant",
    site: "DC1", siteName: "DC1 — Cilandak", rack: "R1-A02", posisiU: "U01–U02",
    vlan: "VLAN 200 — Web", cableManagement: "PP-01-A · P5–P8",
    hypervisor: "Linux", fungsi: ["Web"], monitoring: ["SNMP", "IPMI"],
    kondisi: "Active", assetTag: "ASET-RV-000102", tags: ["production", "web"]
  },
  {
    id: "demo-3", tipeServer: "blade", formFactor: "8U",
    vendor: "Lenovo", model: "ThinkSystem BC2500", serial: "SVC-BC25-0003",
    tahunPembelian: "2022", warranty: "Foundation s.d. 2026",
    lanRj45: "2", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "IPMI",
    pcieCount: "0", pcieGen: "-", psuCount: "4", psuWatt: "2200 W", powerRedundancy: "Redundant",
    site: "DC2", siteName: "DC2 — Cikupa", rack: "R2-B05", posisiU: "U01–U08",
    vlan: "VLAN 300 — Aplikasi", cableManagement: "PP-02-B · P1–P8",
    nodeTotal: "4",
    nodes: [
      {
        slot: 1, hostname: "SRV-APP-01-01",
        vendor: "Lenovo", model: "ThinkSystem B4800", serial: "SVC-B4800-0003a",
        processorCount: "single", processorType: "Intel Xeon Silver 4314", coreThread: "16C / 32T",
        dimmTotal: "16", dimmPerSlot: "32 GB", dimmInstalled: "128 GB",
        dimmSlots: Array.from({ length: 4 }, (_, i) => ({ slot: i + 1, type: "DDR4", cap: "32 GB", brand: "Micron", status: "online", notes: "" })),
        storageBays: "2", storageCap: "480 GB", storageIface: "SATA",
        storageSlots: [{ bay: 1, type: "SSD", cap: "480 GB", brand: "Samsung", status: "online", notes: "PM893" }],
        raid: "Tidak", raidTypes: [],
        lanRj45: "2", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "IPMI",
        pcieCount: "0", pcieGen: "-", psuCount: "", psuWatt: "",
        hypervisor: "Windows Server", fungsi: ["Web"], monitoring: ["SNMP", "DCIM"],
        kondisi: "Active", assetTag: "ASET-RV-000203", tags: ["production", "application"]
      },
      {
        slot: 2, hostname: "SRV-APP-01-02",
        vendor: "Lenovo", model: "ThinkSystem B4800", serial: "SVC-B4800-0003b",
        processorCount: "single", processorType: "Intel Xeon Silver 4314", coreThread: "16C / 32T",
        dimmTotal: "16", dimmPerSlot: "32 GB", dimmInstalled: "128 GB",
        dimmSlots: Array.from({ length: 4 }, (_, i) => ({ slot: i + 1, type: "DDR4", cap: "32 GB", brand: "Micron", status: "online", notes: "" })),
        storageBays: "2", storageCap: "480 GB", storageIface: "SATA",
        raid: "Tidak", raidTypes: [],
        lanRj45: "2", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "IPMI",
        pcieCount: "0", pcieGen: "-", psuCount: "", psuWatt: "",
        hypervisor: "Windows Server", fungsi: ["Database"], monitoring: ["SNMP", "DCIM"],
        kondisi: "Active", assetTag: "ASET-RV-000204", tags: ["production", "application"]
      }
    ]
  },
  {
    id: "demo-4", hostname: "SRV-BK-01", tipeServer: "rack", formFactor: "3U",
    vendor: "Supermicro", model: "SYS-6029U-TR4", serial: "SVC-SM60-0004",
    tahunPembelian: "2021", warranty: "Kedaluwarsa (2024)",
    os: "Linux", processorCount: "dual", processorType: "Intel Xeon Gold 6230",
    coreThread: "40C / 80T", dimmTotal: "24", dimmPerSlot: "32 GB", dimmInstalled: "384 GB",
    storageBays: "12", storageCap: "4 TB", storageIface: "SAS",
    raid: "Ya", raidTypes: ["RAID 5", "RAID 6"],
    lanRj45: "2", lanSfp: "2", lanQsfp: "0", speed: "1G", mgmtPort: "IPMI",
    pcieCount: "7", pcieGen: "Gen3", psuCount: "2", psuWatt: "2000 W", powerRedundancy: "Redundant",
    site: "DC3", siteName: "DC3 — Surabaya", rack: "R3-A02", posisiU: "U12–U15",
    vlan: "VLAN 400 — Backup", cableManagement: "PP-03-C · P1–P4",
    hypervisor: "Linux", fungsi: ["Backup"], monitoring: ["SNMP"],
    kondisi: "Active", assetTag: "ASET-RV-000304", tags: ["production", "backup"]
  },
  {
    id: "demo-5", tipeServer: "cloud", formFactor: "2U",
    vendor: "Cisco", model: "UCS C220 M6", serial: "SVC-UCS-0005",
    tahunPembelian: "2023", warranty: "SMARTnet s.d. 2028",
    lanRj45: "4", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "iDRAC",
    pcieCount: "2", pcieGen: "Gen4", psuCount: "2", psuWatt: "500 W", powerRedundancy: "Non-redundant",
    site: "DC4", siteName: "DC4 — Bandung (Edge Site)", rack: "R4-A01", posisiU: "U10–U11",
    vlan: "VLAN 500 — Dev/Test", cableManagement: "PP-04-A · P1–P2",
    nodeTotal: "2",
    nodes: [
      {
        slot: 1, hostname: "SRV-TEST-01-01",
        vendor: "Cisco", model: "UCS C220 M6", serial: "SVC-UCS-0005a",
        processorCount: "single", processorType: "Intel Xeon 6330", coreThread: "28C / 56T",
        dimmTotal: "16", dimmPerSlot: "32 GB", dimmInstalled: "128 GB",
        dimmSlots: Array.from({ length: 4 }, (_, i) => ({ slot: i + 1, type: "DDR4", cap: "32 GB", brand: "Micron", status: "online", notes: "" })),
        storageBays: "6", storageCap: "1 TB", storageIface: "SATA",
        raid: "Ya", raidTypes: ["RAID 1"],
        lanRj45: "4", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "iDRAC",
        pcieCount: "2", pcieGen: "Gen4", psuCount: "", psuWatt: "",
        hypervisor: "VMware ESXi", fungsi: ["Virtualization"], monitoring: ["IPMI"],
        kondisi: "Standby", assetTag: "ASET-RV-000405", tags: ["development", "staging"]
      }
    ]
  },
  {
    id: "demo-6", hostname: "SRV-OUT-01", tipeServer: "tower", formFactor: "Tower / Desktop (non-U)",
    vendor: "Lenovo", model: "ThinkSystem ST50", serial: "SVC-ST50-0006",
    tahunPembelian: "2019", warranty: "Kedaluwarsa",
    os: "Windows", processorCount: "single", processorType: "Intel Xeon E-2234",
    coreThread: "8C / 8T", dimmTotal: "4", dimmPerSlot: "16 GB", dimmInstalled: "32 GB",
    storageBays: "4", storageCap: "2 TB", storageIface: "SATA",
    raid: "Tidak", raidTypes: [],
    lanRj45: "2", lanSfp: "0", lanQsfp: "0", speed: "1G", mgmtPort: "-",
    pcieCount: "2", pcieGen: "Gen3", psuCount: "1", psuWatt: "250 W", powerRedundancy: "Non-redundant",
    site: "DC3", siteName: "DC3 — Surabaya", rack: "-", posisiU: "-",
    vlan: "VLAN 600 — Utilitas", cableManagement: "-",
    hypervisor: "Windows Server", fungsi: ["Web"], monitoring: ["SNMP"],
    kondisi: "Decommissioned", assetTag: "ASET-RV-000306", tags: ["staging"]
  }
];

function readLocalServers() {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ID server yang dihapus user (tombstone) supaya tidak muncul lagi
// dari DEFAULT_SERVERS / SQLite setelah tombol Hapus dipakai.
function getDeletedServerIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(DELETED_SERVERS_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function getServers() {
  // Build tombstone sets from deleted IDs
  const deleted = new Set(getDeletedServerIds());
  const deletedHostnames = new Set();
  // Check both old format (ID only) and new format ({id, hostname})
  getDeletedServerIds().forEach(item => {
    if (typeof item === "string") {
      deleted.add(item);
    } else if (item && typeof item === "object" && item.hostname) {
      deleted.add(item.id);
      deletedHostnames.add(String(item.hostname).toLowerCase());
    }
  });
  const notDeleted = arr => (Array.isArray(arr) ? arr : []).filter(s =>
    !deleted.has(s.id) && !deletedHostnames.has(String(s.hostname || "").toLowerCase())
  );
  let list;
  if (typeof apiGetServers === "function") {
    const db = notDeleted(apiGetServers());
    if (db) {
      const ls = notDeleted(readLocalServers());
      const dbIds = new Set(db.map(s => s.id));
      if (!db.length && ls.length && typeof apiSaveServer === "function") {
        ls.forEach(s => apiSaveServer(s));
    list = [...ls, ...DEFAULT_SERVERS.filter(d => !deleted.has(d.id) && !deletedHostnames.has(String(d.hostname || "").toLowerCase()) && !ls.some(s => s.id === d.id))];
      } else {
        list = [
          ...db,
          ...ls.filter(s => !dbIds.has(s.id)),
          ...DEFAULT_SERVERS.filter(d => !deleted.has(d.id) && !deletedHostnames.has(String(d.hostname || "").toLowerCase()) && !dbIds.has(d.id) && !ls.some(s => s.id === d.id))
        ];
      }
    }
  }
  if (!list) {
    const ls = notDeleted(readLocalServers());
    list = [...ls, ...DEFAULT_SERVERS.filter(d => !deleted.has(d.id) && !ls.some(s => s.id === d.id))];
  }
  if (typeof buildRackServers === "function") {
    const seen = new Set(list.map(s => String(s.hostname || "").toLowerCase()));
    buildRackServers().forEach(r => {
      const k = String(r.hostname || "").toLowerCase();
      if (k && !seen.has(k) && !deleted.has(r.id) && !deletedHostnames.has(k)) {
        seen.add(k);
        list.push(r);
      }
    });
  }
  return list.map(s => {
    const norm = x => ({
      ...x,
      psuCount: x.psuCount == null || String(x.psuCount).trim() === "" ? "2" : x.psuCount,
    });
    const base = norm(s);
    if (Array.isArray(base.nodes)) base.nodes = base.nodes.map(norm);
    return base;
  });
}

function saveServer(server) {
  const entry = { ...server, id: "srv-" + Date.now().toString(36) };
  if (entry.hostname) entry.hostname = canonKey(entry.hostname);
  if (typeof apiSaveServer === "function" && apiSaveServer(entry)) {
    return true;
  }
  try {
    const saved = readLocalServers();
    saved.unshift(entry);
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

function updateServer(id, server) {
  if (!id) return false;
  const entry = { ...server, id };
  if (entry.hostname) entry.hostname = canonKey(entry.hostname);
  try {
    const prev = getServers().find(s => s.id === id);
    const oldHost = prev && prev.hostname ? canonKey(prev.hostname) : "";
    if (oldHost && entry.hostname && oldHost !== entry.hostname) {
      rekeyDeviceMaps(oldHost, entry.hostname);
    }
  } catch (e) { /* abaikan */ }
  const isDemo = String(id).startsWith("demo-");
  if (!isDemo && typeof apiSaveServer === "function" && apiSaveServer(entry)) {
    return true;
  }
  try {
    const saved = readLocalServers();
    const idx = saved.findIndex(s => s.id === id);
    if (idx >= 0) {
      saved[idx] = entry;
    } else {
      saved.unshift(entry);
    }
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}
