# RackView — AssetMon: Dokumentasi Proyek

> Dokumen ini adalah **peta lengkap proyek** (hasil studi seluruh file di folder).
> Untuk aturan kerja/checkpoint yang mengikat agent, lihat `AGENTS.md`.
> Untuk panduan singkat menjalankan + API inti, lihat `README.md`.

---

## 1. Ringkasan

**AssetMon (RackView)** adalah aplikasi **Datacenter Asset Management**:

- UI statis (HTML/CSS/JS vanilla, tanpa framework build) + backend **Express + SQLite** (`node:sqlite`, file `data/app.db`).
- Bisa berjalan **tanpa backend** (dibuka via `file://`) memakai `localStorage`; otomatis menyambung ke API bila server hidup (**API-first + fallback**).
- Modul utama: Sites & Racks, Rack Elevation (diagram U), Network Topology (fisik & logis), Port/Power Map, inventori per tipe perangkat (server, storage, switch, firewall, router, PDU, UPS, aksesori), Kapasitas (matrix + plan), Laporan, modul Operasional (Kunjungan Site / Incident / Maintenance), Auth & User Management, Audit Log, Branding.

## 2. Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Vanilla JS (ES6), SVG untuk diagram, Font Awesome, IBM Plex Sans |
| Backend | Node.js + Express 4 (satu dependency) |
| Database | SQLite bawaan Node (`node:sqlite`) → `data/app.db` (+ `-shm`/`-wal`) |
| Storage offline | `localStorage` (key terpusat di `js/keys.js`, prefix `rv_*`) |
| Upload | File disimpan ke filesystem `data/uploads/**` (DB hanya simpan referensi) |

## 3. Menjalankan

```bash
npm install
npm start            # http://localhost:3000  (PORT via env)
npm run verify       # verifikasi canonKey + Port Map (verify-portmap.cjs)
npm run seed         # impor data JSON ke backend (data/seed.js)
npm run seed:example # buat contoh data/seed.example.json
```

Login default: **superadmin / admin123**. Tanpa login, sebagian besar halaman masih bisa dibuka (auth guard belum dipasang di semua halaman — see AGENTS.md roadmap).

## 4. Struktur Folder

```
AssetMon/
├── server.js               # Backend Express + SQLite (semua route & schema)
├── package.json            # script: start / verify / seed / seed:example
├── README.md               # panduan cepat + API inti + model data
├── AGENTS.md               # checkpoint & konvensi wajib (untuk agent)
├── PROJECT.md              # dokumen ini
│
├── *.html                  # 29 halaman UI (lihat §5)
├── js/                     # 37 modul JS (lihat §6)
├── css/                    # CSS per halaman + theme/components (lihat §7)
├── theme.css               # variabel tema global (root)
├── brand.js                # LEGACY: salinan lama brand config — TIDAK dipakai
│                           # (semua halaman memuat js/brand.js)
├── img/devices/            # foto/SVG perangkat (<slug>-front/back.*)
│
├── data/
│   ├── app.db (+wal/shm)   # database SQLite (GITIGNORED)
│   ├── seed.js             # util seed/impor JSON → API (upsert idempoten)
│   ├── seed.example.json   # contoh format seed
│   └── uploads/            # brand logo, lampiran PDF OPS, foto device (GITIGNORED kecuali seed.js)
│
├── seed-ops.cjs            # seed produksi modul OPS (visits/incidents/maintenance) via API
├── seed-storage-demo.cjs   # seed demo storage
├── verify-portmap.cjs      # test: canonKey, normalisasi, build/save map (44 PASS)
├── verify-asset-list.cjs   # verifikasi halaman asset list
├── check-db.js             # inspeksi cepat isi DB
└── server.out.log / server.err.log  # log runtime (gitignored)
```

## 5. Peta Halaman (HTML)

### Dashboard & Analitik
| Halaman | Fungsi | JS terkait |
| --- | --- | --- |
| `dashboard.html` | KPI aset (jumlah per tipe) + section KPI Operasional | `dashboard.js`, `dashboard-ops.js` |
| `capacity-matrix.html` | Heatmap kapasitas rack per site (U/power/port) | `capacity-matrix.js` |
| `capacity-plan.html` | Proyeksi kebutuhan kapasitas (free U, power/port headroom) | `capacity-plan.js` |
| `reports.html` | Laporan agregat + export CSV | `reports.js` |

### Infrastruktur & Visualisasi
| Halaman | Fungsi | JS terkait |
| --- | --- | --- |
| `sites.html` | Kartu site + form Tambah Rack | `sites.js` |
| `site-racks.html` | Daftar rack per site | `site-racks.js` |
| `rack-elevation.html` | Diagram rack per-U (25px/U), foto device, deep-link `?rack=&device=` | `rack-elevation.js`, `rack-ops.js` |
| `network-topology.html` | Topologi fisik (kotak rack + edge data/power) & logis (tree 9 layer + VLAN 11/22/33) + "Atur Layer" inline | `network-topology.js` |
| `port-map.html` | Direktori port per perangkat | `port-map-page.js`, `port-map.js` |
| `power-map.html` | Pemetaan daya (PDU ↔ konsumen) | `power-map-page.js`, `port-map.js` |
| `cable-registry.html` | Registri kabel (dari label CBL-* di port map) | `cable-registry.js` |

### Inventori Perangkat
| Halaman | Fungsi | JS terkait |
| --- | --- | --- |
| `server-form.html` / `server-list.html` | Form identitas server (conditional fields, upload foto depan/belakang) + list dengan panel ringkasan | `server-form.js`, `server-list.js`, `server-summary.js` |
| `storage-form.html` / `storage-list.html` | Form + list storage (form juga dipakai modal) | `storage-form.js`, `storage-list.js`, `storage-summary.js` |
| `asset-list.html` | Tabel asset gabungan + kolom Spesifikasi + hapus tersinkron | `asset-list.js` |
| `network-device-list.html` | Switch/firewall/router (record lengkap: interface, power, warranty) | `asset-list.js` |
| `firewall-list.html` / `router-list.html` / `accessories-list.html` / `ups-list.html` / `pdu-list.html` | List per tipe (mesin render sama) | `asset-list.js`, `pdu-data.js`, `pdu-list.js` |

### Operasional (OPS)
| Halaman | Fungsi | JS terkait |
| --- | --- | --- |
| `kunjungan-site.html` | Kunjungan site (planned→in_progress→completed→closed) | `ops.js` (config `window.OPS_CONFIG` inline) |
| `incident-report.html` | Insiden (open→in_progress→resolved→closed) + MTTR | `ops.js` |
| `maintenance.html` | Maintenance (scheduled→in_progress→completed/cancelled; overdue derived) | `ops.js` |

### Administrasi
| Halaman | Fungsi | JS terkait |
| --- | --- | --- |
| `login.html` | Login (backend auth) | `login.js`, `auth.js` |
| `user-management.html` | CRUD user + template user + audit trail | `user-management.js` |
| `audit-log.html` | Jejak aktivitas (filter, pagination, export CSV) | `audit-log.js` |
| `branding-admin.html` | Identitas perusahaan, logo upload, warna, preview live | `branding-admin.js`, `brand.js` |

## 6. Peta Modul JavaScript

### Fondasi
| File | Peran |
| --- | --- |
| `js/app.js` | Shared chrome: sidebar collapse, submenu, wiring theme toggle |
| `js/keys.js` | **Pusat definisi**: semua localStorage key (`rv_*`), versi skema, `canonKey()` (uppercase normalisasi), `rekeyDeviceMaps()` |
| `js/api.js` | Lapisan API ke backend; deteksi otomatis server; fallback localStorage |
| `js/auth.js` | Helper login/logout/me/role (token `rv_auth_token`) |
| `js/toast.js` | Notifikasi global `showToast()` + `confirmDoubleDelete()` (hapus 2 langkah) |
| `js/brand.js` | Objek BRAND default + `loadBrand()` dari `/api/brand` + apply logo/theme |

### Data sumber (client-side truth saat offline)
| File | Peran |
| --- | --- |
| `js/rack-data.js` | `RACK_SITES`, `RACKS`, `RACK_LAYOUTS` (fallback tabel sites/racks); sinkron lokasi device bulk |
| `js/server-data.js` | `DEFAULT_SERVERS` demo + helper getServers()/save |
| `js/port-data.js` | `PORT_DATA` + `POWER_DATA` (koneksi data & daya antar perangkat) |
| `js/pdu-data.js` | Sumber data PDU tunggal (butuh `port-data.js` duluan) |

### Fitur
| File | Peran |
| --- | --- |
| `js/rack-elevation.js` | Render rack U-by-U (overlay `.u-dev-bg`, tint pastel `TYPE_TINTS`, LED, foto device) |
| `js/network-topology.js` | Graf fisik + mode logis (tree 9 layer, VLAN, ikon vektor, trace BFS) + edit "Atur Layer" (scope Site/Rack, band picker, persist `rv_topo_layers`) |
| `js/ops.js` | Mesin bersama 3 modul OPS: tabs/tabel/form/status flow/status history/upload PDF/print A4/export CSV/deep-link `?q=` |
| `js/dashboard-ops.js` | KPI operasional di dashboard (4 stat + 4 tabel) |
| `js/rack-ops.js` | Jembatan data OPS → Rack Elevation & Sites (maintenance/insiden per rack) |
| `js/asset-list.js` | Mesin tabel asset multi-halaman: record network device, kolom spesifikasi, hapus kaskade, demo seed idempoten |
| `js/server-summary.js` / `js/storage-summary.js` | Panel ringkasan identitas perangkat (list + rack elevation tab Hardware) |
| `js/capacity-matrix.js` / `js/capacity-plan.js` / `js/reports.js` | Analitik kapasitas & laporan |
| `js/sites.js` / `js/site-racks.js` | Manajemen site & rack |
| `js/port-map-page.js` / `js/power-map-page.js` / `js/port-map.js` / `js/cable-registry.js` | Direktori port/daya/kabel + overlay detail |
| `js/login.js` / `js/user-management.js` / `js/audit-log.js` | Auth UI + RBAC + audit viewer |
| `js/branding-admin.js` | Pengaturan branding + upload logo |

## 7. CSS

- `theme.css` (root) — variabel global (`--accent`, `--bg-surface`, dst.); `css/theme.css` varian tema.
- `css/components.css` — komponen bersama (modal, tombol `.btn`, tabel, form, badge).
- Per halaman: `dashboard.css`, `login.css`, `sites.css`, `site-racks.css`, `rack-elevation.css`, `network-topology.css`, `map-pages.css`, `cable-registry.css`, `capacity-matrix.css`, `capacity-plan.css`, `reports.css`, `server-form.css`, `server-list.css`, `asset-list.css`, `pdu-list.css`, `ops.css`, `audit-log.css`, `branding-admin.css`.

## 8. Backend (`server.js`)

Satu file berisi semua: schema SQLite, helper (`canonKey`, `normalizeMapKeys`, `upsertDevice`, `pruneOrphanDevices`, `backfillDeviceLocation`, `syncDeviceSiteFromRack`, `requireRole`, `auditLog`), route API, static file serving.

### Tabel (13)
`sites`, `racks`, `devices` (registri master, PK `deviceKey` uppercase), `servers` (detail JSON di kolom `data`), `maps` (Port/Power Map, PK `(kind, deviceKey)`), `users`, `audit_logs`, `brand`, `attachments`, `refs` (master data dropdown), `visits`, `incidents`, `maintenance`. Index sesuai konvensi di AGENTS.md.

### Endpoint (ringkas)
| Domain | Endpoint |
| --- | --- |
| Utilitas | `GET /api/health`, `GET /api/export` |
| Sites/Racks | `GET/POST/DELETE /api/sites`, `GET/POST /api/racks`, `POST /api/racks/sync`, `DELETE /api/racks/:rackId` |
| Servers | `GET/POST /api/servers`, `DELETE /api/servers/:id` |
| Devices | `GET/POST /api/devices`, `POST /api/devices/locations`, `DELETE /api/devices/:deviceKey` (kaskade map), `PUT /api/devices/:deviceKey/rename` (re-key semua map) |
| Maps | `GET/POST/DELETE /api/maps/:kind[/:deviceKey]` (`port`/`power`) |
| Refs | `GET /api/refs[/:kind]`, `POST /api/refs/:kind` |
| Storage | `GET /api/devices/storage` |
| Auth/User | `POST /api/auth/login|logout`, `GET /api/auth/me`, `GET/POST/PUT/DELETE /api/users` |
| Audit | `GET /api/audit` (filter q/action/user/from/to/limit), `GET /api/audit/summary`, `POST /api/audit/log` |
| Brand | `GET/POST /api/brand`, `POST /api/brand/logo` |
| Lampiran | `GET/DELETE /api/attachments...`, `POST /api/uploads/:kind/:ref` (raw PDF ≤20MB, magic `%PDF-`) |
| Foto device | `POST/DELETE /api/device-image/:deviceKey/:view` (png/jpg/webp ≤20MB) |
| OPS generik | `GET/POST /api/:kind`, `DELETE /api/:kind/:id` untuk `visits|incidents|maintenance` |

Lain-lain: `app.db` **diblokir dari static** (403); `/` redirect ke `dashboard.html`.

## 9. Data & Konvensi Kunci

- **`canonKey()`** — semua key perangkat dinormalisasi UPPERCASE (client `js/keys.js`, server `server.js`). `"srv-web-01"` ≡ `"SRV-WEB-01"`.
- **Taksonomi key** (lengkap di AGENTS.md): `masterKey` (deviceKey/rackId/site.id), `primaryKey`/`id` (immutable), `magicKey` (`INC-2026-0001`, `no_tiket`, `no_izin`), `slug` (foto device), storage key `rv_*`.
- **localStorage keys** (`js/keys.js`): `rv_servers`, `rv_switches`, `rv_accessories`, `rv_storage`, `rv_refs_storage`, `rv_custom_racks`, `rv_port_maps`, `rv_power_maps`, `rv_page_size`, `rv_deleted_servers`, `rv_topo_layers`, `rv_auth_token`, `rv_auth_user`, `ops-<kind>` (fallback OPS), `rv_schema_version`.
- **Upload**: file di `data/uploads/{brand,devices,visits,incidents,maintenance}/…`; DB hanya simpan URL referensi.

## 10. Skrip Bantu (root)

| Skrip | Fungsi |
| --- | --- |
| `seed-ops.cjs` | Seed produksi OPS via API (idempoten; `--force` timpa) |
| `seed-storage-demo.cjs` | Demo data storage |
| `verify-portmap.cjs` | 44 test: canonKey, normalisasi runtime, build/save map |
| `verify-asset-list.cjs` | Verifikasi asset list |
| `check-db.js` | Inspeksi isi DB cepat |

## 11. Catatan Keamanan (status saat ini)

- Password user masih **base64** (bukan hash) — jangan dipakai production (roadmap: bcrypt/argon2, MFA, session expiry — lihat AGENTS.md).
- Token auth permanen; auth guard belum dipasang di semua halaman.
- RBAC (`requireRole`) baru ditegakkan di endpoint user management & audit.
