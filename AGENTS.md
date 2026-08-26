# AGENTS.md

## Rack Elevation — Checkpoint (SAAT INI, JANGAN DIUBAH TANPA PERSETUJUAN)

Baseline rack diagram yang sudah disetujui user. Perubahan visual rack harus sesuai poin ini kecuali user meminta.

- **Tinggi U = 25px tetap** (`--u-h`), dikunci di `js/rack-elevation.js` via `const uHeightPx = 25`.
- **Tinggi perangkat = kelipatan 1U**: 1U = 25px, 2U = 50px, 3U = 75px, dst. (span × 25px). **Lebar tidak berubah**, selalu tetap mengikuti lebar rack (device full-width = selebar rack minus gutter angka; tower L/R = separuh).
- **Lebar rack proporsional** = `calc(var(--u-h) * 10.857)` di `.rack-units-wrap` (css/rack-elevation.css) → ±271px untuk 42U, rasio 1:3.87 seperti rack fisik.
- **Device dirender sebagai 1 elemen overlay `.u-dev-bg` per device** (absolut, height = span×25px, dibangun di `renderRackUnits` dari `devAtStart`):
  - Gradient pastel ceria + inset shadow `--u-metal` digambar utuh di elemen ini → **tanpa seam antar-U**.
  - Sel device di tiap baris **transparan**; label & LED hanya di U pertama (z-index di atas overlay).
  - Overlay `pointer-events: none` (klik/selection tetap di sel).
  - Kelas `u-dev-bg full | l | r` sesuai posisi (full-width / tower kiri / tower kanan).
- **Tanpa bezel, tanpa garis drive bay, tanpa pembatas antar-U.**
- **Tint pastel per tipe** (JS `TYPE_TINTS`): server `#8fbfea` (biru), switch `#85d8cf` (teal), pdu `#b7a3e3` (ungu), firewall `#f5c78c` (peach), patch `#a5aebd` (abu-biru), tower `#a8d5a5` (hijau). `rackColor` custom (via `deviceCustomColor`) menimpa tint.
- **LED indicator** di U pertama: hijau (default), kuning berdenyut (`warn`, untuk PDU), glow via box-shadow.
- **Gambar perangkat**: SVG placeholder TIDAK auto-mount (tidak ada di `DEVICE_IMG_EXT`). Foto asli (png/jpg/jpeg/webp) di `img/devices/` otomatis dipasang di tinggi U 25px (`uHeightPx >= 25`), ukuran tinggi = span×25px dan lebar proporsional via `object-fit: cover` (crop overflow). Contoh: `svr1U-front/back.jpeg` → device bernama `SVR1U` (slug `svr1u`). Foto menutupi overlay `.u-dev-bg` dan menyembunyikan LED.
- **Upload gambar via UI**: tombol "Upload Depan/Belakang" di `server-form.html`, modal edit `server-list.html`, dan modal `asset-list.html` (logika `DEVIMG` di `js/server-form.js`). Upload langsung `POST /api/device-image/:slug/:view` (raw body, png/jpg/webp, ≤20MB) → disimpan `data/uploads/devices/<slug>-<view>.<ext>` (gitignored), file lama dengan prefix sama dihapus. `DELETE /api/device-image/:slug/:view` menghapus file. **Sync ke SQLite**: bila `slug` cocok dengan `hostname` record server (`findServerByDeviceKey`), referensi `image[view] = url` ikut disimpan ke tabel `servers` (lewat `saveServerRecord`) + `devices` (lewat `upsertDevice`); delete menghapus referensinya. Frontend `collectServerForm` + `mergeDevImg` memastikan URL gambar ikut tersimpan saat save. `deviceImageCandidates()` memprioritaskan `d.image[view]` → `SERVER_MAP` record `image[view]` → `data/uploads/devices/` → `img/devices/`. Audit log: `attachment.upload` → `device-image/<slug>`. Server harus aktif (file:// tanpa backend → preview saja, tanpa upload).
- Legend di `rack-elevation.html` menggunakan gradient pastel sesuai tint.
- Label perangkat: teks gelap `#1c2632` di atas pastel.

### File terkait
- `js/rack-elevation.js` — render, overlay `.u-dev-bg`, `uHeightPx`, `TYPE_TINTS`, `deviceTint`, `renderRackUnits`.
- `css/rack-elevation.css` — `.u-dev-bg`, `--u-metal`, `.rack-units-wrap` width, `.u-led`.
- `rack-elevation.html` — legend.

## Modul Operasional (OPS) — Arsitektur

Tiga halaman operasional berbagi **satu mesin render** yang digerakkan konfigurasi:
`kunjungan-site.html` (visits), `incident-report.html` (incidents), `maintenance.html` (maintenance).

### Arsitektur
- **Engine bersama**: `js/ops.js` (render tabs/summary/tabel/filter/form modal, data layer, upload). **CSS bersama**: `css/ops.css`.
- **Konfigurasi per halaman**: `window.OPS_CONFIG` di `<script>` inline tiap halaman — tabs, columns, status, formFields, dll. Baca satu halaman sebelum menambah modul baru (pola lengkap di sana).
- **Data layer**: API `/api/<kind>` (Express + SQLite, `server.js`) dengan **fallback localStorage** (`ops-<kind>`) bila backend tidak aktif. Rute CRUD: `GET/POST /api/<kind>`, `DELETE /api/<kind>/:id`.
- **Perbarui label topbar**: tiap halaman punya `.topbar-sub` yang harus sinkron dengan `cfg.formSub`.

### Konvensi status
- `statusFlow` menentukan workflow tombol "→ Lanjut": kunjungan `planned → in_progress → completed → closed`, incident `open → in_progress → resolved → closed`, maintenance `scheduled → in_progress → completed → closed`.
- **Branching transitions** (maintenance): `statusTransitions` bisa punya cabang — misal `scheduled → cancelled` dan `in_progress → cancelled`. Tombol `>` menampilkan dropdown bila ada multiple next options. `OPS.nextStatuses(cfg, status)` mengembalikan semua kemungkinan next status.
- `statusLabels` dipakai `statusBadge`. `sevBadge` untuk severity, `sev-chip` (`sev-critical/high/medium/low`) untuk badge inline.
- **`deriveStatus` (opsional)**: turunkan status tampilan tanpa mengubah data — dipakai maintenance (`scheduled` yang lewat tanggal → `overdue`). Engine memanggilnya via `effStatus()`/`view()`; **status asli di DB tidak diubah** (hanya status derived yang masuk filter tab). Contoh: `deriveStatus: r => (r.status === "scheduled" && r.scheduled_at < TODAY_STR) ? "overdue" : null`.

### Form & field
- `formFields` bertipe: `text | select | textarea | date | time | file`. `full: true` = selebar grid; `required` divalidasi.
- **Field `file`** (lampiran PDF): `accept` default `.pdf,application/pdf`, `multiple` kecuali `multiple: false`, `hint` ditampilkan via `.form-hint`. Hasil disimpan ke `out[k]` sebagai array `[{ name, size, url }]`.
- Semua modul punya field **`no_tiket`** = nomor tiket dari **sistem tiketing eksternal** (relabel "No. Tiket (sistem tiketing eksternal)"), dirender sebagai kolom mono `No. Tiket` (nilai kosong → "—").

### Upload lampiran PDF (backend, `server.js`)
- **Route**: `POST /api/uploads/:kind/:ref?name=<nama>` — raw body PDF (`express.raw`, tanpa multer), `Content-Type: application/pdf`, limit **20MB**.
- Validasi: body harus diawali `%PDF-` (magic), `:ref` disanitasi (`[^A-Za-z0-9_-]` dibuang), `:kind` harus salah satu dari `visits|incidents|maintenance` (selain itu → 404).
- Disimpan sebagai `data/uploads/<kind>/<ref>-<seq>.pdf` (seq inkremental). Record hanya menyimpan referensi `{name,size,url}` — file tetap di filesystem agar DB kecil.
- **`app.db` diblokir dari static** (403) via middleware sebelum `express.static`.
- **Fallback offline (frontend)**: `OPS.upload` gagal → file ≤1.5MB disimpan sebagai base64 data-URL via `fileToDataUrl`; file lebih besar dilewati dengan alert.
- Kolom `Dokumen` memakai `.att-link` (link + icon PDF); kosong → "—".

### Helper & rendering
- `OPS.fmtDate` menormalkan ISO (`T` → spasi, drop detik) → `2026-08-12 07:45`.
- `OPS.sevBadge`, `OPS.statusBadge`, `OPS.esc` (escape HTML), `OPS.siteName` (site.id → nama), `OPS.deviceList` (registri device) tersedia global.
- Pencarian lintas kolom via `cfg.columns.map(c => r[c.key])`. MTTR (incident) dihitung dari `created_at`/`resolved_at`.
- Demo seed: `OPS._seed()` di `js/ops.js` (data contoh per kind, termasuk `no_tiket`, `sumber`, `dampak` untuk incident; `mulai/selesai/downtime/ref_inc/ref_visit/type` untuk maintenance).

### Integrasi antar-modul & deep-link
- **Deep-link `?q=`**: semua halaman OPS membaca `location.search` `q` dan langsung mengisi kotak pencarian (diparser manual, bukan `URLSearchParams`, agar aman di semua lingkungan). Contoh: `maintenance.html?q=INC-2026-0002`.
- **Kolom `Referensi` (maintenance)**: `ref_inc`/`ref_visit` dirender sebagai link `.ref-link` → `incident-report.html?q=<no>` dan `kunjungan-site.html?q=<no>`.

### Dashboard & data produksi
- **Dashboard KPI**: section "Operasional — KPI" di `dashboard.html` dirender oleh `js/dashboard-ops.js` memakai `OPS.load(kind)` (4 stat: insiden aktif, MTTR rata-rata, maintenance terlambat, kunjungan hari ini; 4 tabel). Hanya `js/ops.js` + `js/dashboard-ops.js` yang di-load; section disembunyikan bila OPS tidak tersedia.
- **Seed produksi**: `seed-ops.cjs` mengisi DB via API `/api/<kind>` (visits/incidents/maintenance). Idempoten — hanya mengisi kind yang masih kosong; `--force` untuk menimpa. Server harus berjalan (`npm start`).

### File terkait
- `js/ops.js` — engine OPS (render, data layer, upload, seed, deep-link `?q=`).
- `css/ops.css` — tabs, summary, tabel, form modal, `sev-chip`, `.att-link`, `.form-hint`, `.ref-link`.
- `kunjungan-site.html`, `incident-report.html`, `maintenance.html` — `OPS_CONFIG` masing-masing.
- `dashboard.html` + `js/dashboard-ops.js` — KPI operasional di dashboard.
- `seed-ops.cjs` — seed data produksi modul OPS.
- `server.js` — CRUD + route upload + blokir `app.db`.

## Konvensi Key & Indexing

Taksonomi key tunggal untuk data sekarang & yang akan datang. Semua data baru
WAJIB mengikuti; data lama dinormalisasi di titik baca (migrasi read-time).

### Taksonomi key
- **`masterKey`** — kunci data master, dinormalisasi via `canonKey()` (uppercase, trim, spasi rangkap→1):
  - `deviceKey` (tabel `devices`, registri master perangkat) — PK.
  - `rackId` (tabel `racks`, format `R1-A12`) — PK.
  - `site.id` (`DC1`…`DC4`, tabel `sites` di SQLite) — PK. Didefinisikan di `SEED_SITES` (`server.js`, seed idempoten `INSERT OR IGNORE`) selaras `RACK_SITES` (`js/rack-data.js`). **Site baru (mis. "DC Pugeran") ditambah via `POST /api/sites`, bukan hardcode** — otomatis muncul di picklist OPS.
  - **Record operasional (OPS) harus menyimpan masterKey, bukan nama tampilan**: `site` → `site.id`; `asset` → `deviceKey` canonical. Nama tampilan hanya untuk rendering via `OPS.siteName()`.
- **`primaryKey` / `id`** — identitas internal immutable: `id` OPS (`visits/incidents/maintenance`), `id` `servers`. Opak, **tidak pernah dipakai ulang** (ada komponen random). Dibuat via `genId(kind)` (crypto.randomUUID; fallback timestamp+random) di `js/ops.js` & `server.js`.
- **`magicKey`** — kunci bisnis stabil, human-readable, unik, dipakai referensi lintas-modul / eksternal / deep-link:
  - `no` (`INC-2026-0001`, `VS-…`, `MT-…`) — **dibuat via `nextNo(cfg, rows)` = max nomor existing + 1**, bukan `rows.length+1` (menghindari duplikat setelah delete). `?q=` deep-link & `ref_inc`/`ref_visit` memakai `no`.
  - `no_tiket` (nomor tiket sistem eksternal), `no_izin`.
- **`slug`** — turunan lowercase nama perangkat (`svr1u`) untuk foto `img/devices/<slug>-<view>.*` (rack-elevation).
- **Storage key** (localStorage): master `rv_*` (`js/keys.js`), OPS fallback `ops-<kind>`. **Upload key**: `data/uploads/<kind>/<primaryKey>-<seq>.pdf`.

### Index (SQLite, `server.js`)
- `devices`: PK `deviceKey`, index `type`. `racks`: PK `rackId`, index `site`, `createdAt`.
- `sites`: PK `siteId` (master sites, seed `SEED_SITES`).
- `maps`: PK gabungan `(kind, deviceKey)`, FK → devices, index `deviceKey`, `(kind, createdAt)`.
- `servers`: PK `id`, index `createdAt`.
- OPS: PK `id` per tabel + index `createdAt` (`idx_visits_created`, `idx_incidents_created`, `idx_maintenance_created`) untuk sort/muatan tab.

### Aturan
- Semua perbandingan/join key memakai bentuk canonical (`canonKey`) — jangan match case-sensitive mentah.
- **`racks.site` wajib site.id** (masterKey), bukan nama tampilan. `POST /api/racks` otomatis resolve nama → id (`SELECT ... WHERE siteId = ? OR lower(name) = lower(?)`), dan bila id tak dikenal akan didaftarkan ke tabel `sites` supaya tidak ada desinkronisasi. `sites.js` mendaftarkan site baru ke master (`apiSaveSite`) saat menambah rack.
- Migrasi nilai lama di titik baca (idempoten): `site` label → id di `OPS.load` via `siteId()`; asset → `canonKey` saat simpan (field `source:"devices"`).
- Field form OPS: `site` pakai `source: "sites"` (options dari `OPS.siteList()` = `GET /api/sites`, fallback `RACK_SITES`/`FALLBACK_SITES`), `asset` pakai `source: "devices"` (datalist dari `OPS.deviceList()` = `/api/devices`, fallback localStorage).

## Lokasi Device (device → site)

Setiap perangkat di registri master (`devices`) harus tahu lokasinya. Lokasi disimpan sebagai **kolom proper** (bukan cuma JSON) agar bisa di-query & di-join.

### Kolom & rantai ID
- Tabel `devices`: tambah `site` (site.id, masterKey) + `rackId` (rackId, masterKey), index `idx_devices_site`.
- Rantai sinkron: `deviceKey → rackId → site.id` — semua canonical.
- OPS: `asset` → `deviceKey`; `rack` → `rackId`; `site` → `site.id` (satu rantai yang sama).

### Sinkronisasi berkelanjutan
- `POST /api/servers`, `POST /api/maps`, `POST /api/devices` → `upsertDevice` ekstrak `site`/`rackId` dari `data` dan simpan ke kolom. Bila `rackId`已知 tapi `site` kosong, resolve dari `racks.site`.
- `POST /api/racks` → setelah upsert rack, jalankan `syncDeviceSiteFromRack()` untuk update semua device di rack tersebut ke site baru (zero-drift).
- `POST /api/devices/locations` (bulk) → frontend mengirim penempatan layout rack dalam satu request (dipanggil `syncDeviceLocations()` di `rack-data.js`, guarded oleh localStorage `rv_devloc_synced_v2`).
- `PUT /api/devices/:deviceKey/rename` → `deviceKey` diubah, `site`/`rackId` ikut bergeser (baris devices di-update).
- `pruneOrphanDevices()` — device yang punya `site` atau `rackId` **tidak dihapus** (dianggap terpasang).

### Backfill
- Saat startup: `backfillDeviceLocation()` mengisi `site`/`rackId` dari `devices.data` (server-form sudah menyimpan `site`/`rack` di data JSON).
- Rack layouts statis (`RACK_LAYOUTS`) → disinkronkan via frontend `syncDeviceLocations()` (sekali per browser).

### UI
- `server-list.js`: `fmtRack()` menampilkan `siteName` + `rack` + `posisiU`.
- `ops.js`: picklist asset (`source:"devices"`) menampilkan `siteName · rackId` pada opsi.

## Auth & User Management — Roadmap (SAAT INI SUDAH DASAR, BISA DILANJUTKAN)

Sistem auth dasar sudah terpasang di `server.js` + `login.html` + `user-management.html`. 
Default login: **superadmin** / **admin123** (id: `usr-superadmin-001`).

### Sudah jalan
- Backend: `users` table + `audit_logs`, endpoint `/api/auth/login|logout|me`, `/api/users` (CRUD), `/api/audit`.
- RBAC: `requireRole` helper — superadmin/admin bisa akses user management; superadmin/admin/**auditor** bisa akses audit.
- Frontend: `login.js` terhubung backend, `user-management.js` (CRUD user + audit trail).
- Password: base64 encoding (bukan hash) — **jangan dipakai di production**.

### Audit Log (halaman `audit-log.html`)
Halaman **Audit Log** (`audit-log.html` + `js/audit-log.js` + `css/audit-log.css`) menampilkan jejak aktivitas sistem. Menu "Audit Log" di semua halaman menunjuk ke sini.
- **KPI summary** (dari `GET /api/audit/summary`): total aktivitas, aktivitas hari ini, total login, CRUD user, aktivitas operasional.
- **Filter**: pencarian (user/target/detail/aksi), kategori (auth/user/ops/asset/brand), dropdown aksi, rentang tanggal (dari/sampai), reset. Query server-side di `GET /api/audit` (`q`, `action`, `user`, `from`, `to`, `limit`).
- **Tabel**: waktu, user (mapping `user_id` → nama via `/api/users`), badge aksi berwarna per kategori (login → biru, create → hijau, update → kuning, delete → merah, transisi → biru), target, detail, IP. Pagination 50/halaman.
- **Export CSV** seluruh hasil filter.
- **Mapping aksi** di `classify()`: `auth.login` → "Login", `ops.transition` → "Transisi Status", dst.

### Audit logging (backend, `server.js`)
`auditLog(req, userId, action, target, detail)` mencatat ke tabel `audit_logs` (id, user_id, action, target, detail, ip, created_at). Konvensi aksi: `<domain>.<verb>` — `auth.login/logout`, `user.create/update/delete`, `site.create/update/delete`, `rack.create/update/delete`, `server.create/update/delete`, `device.create/update/delete/rename/locations`, `map.save/delete`, `brand.update/logo`, `attachment.upload`, `ops.create/update/delete/transition`. **`ops.transition`** terdeteksi otomatis saat `status` berubah antar record (detail: `from → to · note`). `ops.js` mengirim `Authorization: Bearer` agar user tercatat; non-auth → `anon`.
- `GET /api/audit` → `{ rows, total }`, filter `q|action|user|from|to|limit` (limit max 2000).
- `GET /api/audit/summary` → agregat (total, today, login, user, ops, asset).

### Template user (tombol "Template user" di user-management.html)
Tombol "Template user" memuat **4 user contoh** via `POST /api/users` langsung ke SQLite (bukan hardcode — data harus masuk DB; AGENTS.md ini hanya dokumentasi template). Membuat user baru setiap klik, tapi **tidak** menimpa username yang sudah ada (duplikat username diperbolehkan di skema saat ini — jangan menambah user dengan username sama berulang kali). Kredensial contoh:

| Username   | Password      | Role     | Scope Site      | Scope Rack              | Privileges |
|------------|---------------|----------|-----------------|--------------------------|------------|
| `admin1`   | `admin123`    | admin    | DC1,DC2         | —                        | crud       |
| `engineer1`| `engineer123` | engineer | DC1             | R1-A01,R1-A02            | rw         |
| `operator1`| `operator123` | operator | DC1,DC2,DC3     | —                        | read       |
| `viewer1`  | `viewer123`   | viewer   | —               | —                        | read       |

Didefinisikan di `js/user-management.js` → `seedTemplateUsers()` (array `templates`). Password di-encode base64 via `toB64()` (browser-safe `btoa`, setara `Buffer.from(s).toString("base64")` di Node/server). Gunakan `toB64()`, **jangan** `Buffer` di frontend (tidak tersedia di browser → error silent).

### Yang bisa dilanjutkan ke depannya (prioritas)
1. **Auth guard ke semua halaman** — saat ini halaman lain (dashboard, rack, dll.) masih bisa diakses tanpa login. Tambah middleware/auth guard di setiap page yang butuh proteksi.
2. **Password hashing yang aman** — ganti base64 dengan bcrypt/argon2. Update `auth.js` login flow + seed default password.
3. **Session/Token expiration** — token sekarang permanent. Tambah `expires_at` di users + validasi di `currentUserId()`.
4. **SSO/LDAP integration** — kolom `auth_method` sudah ada (`local|sso|ldap`), tinggal implementasi provider.
5. **Scope enforcement** — field `scope_site`, `scope_rack`, `scope_zone` sudah ada di users table, tapi belum difilter di API. Tambah filter di endpoint ops (visits/incidents/maintenance) berdasarkan scope user yang login.
6. **Scope enforcement** — field `scope_site`, `scope_rack`, `scope_zone` sudah ada di users table, tapi belum difilter di API. Tambah filter di endpoint ops (visits/incidents/maintenance) berdasarkan scope user yang login.
7. **UI/UX improvement** — forgot password flow, password strength meter, session timeout warning, role-based nav visibility.
8. **Multi-factor auth (MFA)** — tambah kolom `mfa_secret` + implementasi TOTP.
9. **Password policy** — enforce complexity + rotation + history.
10. **Test coverage** — tambah test untuk auth flow, RBAC, audit trail, edge cases.

### File terkait
- `server.js` — schema users/audit_logs, auth routes, `requireRole`, `auditLog`, audit logging lintas modul.
- `js/auth.js` — helper login/logout/me/role checks.
- `js/login.js` — login page flow.
- `user-management.html` + `js/user-management.js` — CRUD user + audit trail UI.
- `audit-log.html` + `js/audit-log.js` + `css/audit-log.css` — halaman Audit Log (KPI, filter, tabel, export CSV).

## Branding & Asset Perusahaan

Branding dikelola di `branding-admin.html` + `js/branding-admin.js` + `js/brand.js`.
Data branding disimpan di **SQLite** (`brand` table) + file di `data/uploads/brand/` untuk logo.

### Yang sudah jalan
- **Company Name / Tagline / Footer**: disimpan di tabel `brand` (key-value) via API `/api/brand`.
- **Logo upload**: `POST /api/brand/logo?key=logo` atau `?key=logo-small` — file disimpan ke `data/uploads/brand/logo.png` (atau `.svg`), path disimpan di tabel `brand`.
- **Brand config API**: `GET /api/brand` mengembalikan semua konfigurasi branding (companyName, tagline, logo, logoSmall, dll.).
- **Preview live**: branding-admin menampilkan preview real-time saat ubah setting.
- **Reset to Default**: mengembalikan ke nilai default + reset di server.
- **Logo image di semua halaman**: `brand.js` membaca logo dari API dan menampilkan `<img>` jika ada, fallback ke text "RV".

### File terkait
- `branding-admin.html` — UI setting branding (identity, colors, login bg, export).
- `js/branding-admin.js` — handler upload logo, color picker, preview, API sync.
- `js/brand.js` — `BRAND` object + `loadBrand()` (fetch dari API) + `applyBrand()` + `applyTheme()`.
- `server.js` — tabel `brand`, route `/api/brand` (GET/POST), `/api/brand/logo` (POST upload).

## Print & Export — Standard

Semua fitur **print / export PDF** harus menggunakan **kertas A4** secara default.

### Implementasi
- Gunakan `@page { size: A4; margin: 15mm; }` di CSS print.
- Gunakan font "IBM Plex Sans" (sudah di-load globally) untuk konsistensi.
- Header: logo perusahaan (jika ada) + nama perusahaan + judul dokumen.
- Footer: nama perusahaan + tanggal cetak.
- Body: data dalam tabel dengan border, zebra-striping, dan padding yang rapi.

### Fitur yang sudah menggunakan A4
- `js/ops.js` — `printHistory()` (history transisi) — sudah `@page A4`.
- `js/ops.js` — `btnPrint` (print tabel OPS) — sudah `@page A4`.

### Export CSV
- `js/ops.js` — export CSV data OPS per tab aktif.
- `js/reports.js` — export CSV laporan per tab aktif (Asset, Kapasitas, Jaringan, Operasional).

### Yang bisa dilanjutkan
1. **Export PDF dari Reports** — saat ini hanya CSV. Tambah opsi export PDF dengan library seperti `html2pdf.js` atau `jsPDF`.
2. **Export PDF dari Dashboard** — tambah tombol export PDF untuk KPI dan tabel.
3. **Batch export** — export multiple record ke satu PDF.
4. **Custom page size** — opsi pilih A4, Letter, Legal di setting branding.

## OPS — Workflow & Status Transisi

Setiap modul OPS (Kunjungan Site, Incident Report, Maintenance) sekarang memiliki **workflow validation** dan **status history tracking**.

### Status Flow
- **Kunjungan Site**: `planned → in_progress → completed → closed`
- **Incident Report**: `open → in_progress → resolved → closed`
- **Maintenance**: `scheduled → in_progress → completed → closed`

### Transition Validation
Setiap transisi status memerlukan field tertentu:
- `planned → in_progress`: wajib isi `jam_realisasi` (Kunjungan Site)
- `in_progress → completed`: wajib isi `hasil` + `temuan` (Kunjungan Site)
- `open → in_progress`: wajib isi `assignee` (Incident)
- `in_progress → resolved`: wajib isi `resolution` (Incident)
- `scheduled → in_progress`: wajib isi `mulai` (Maintenance)
- `in_progress → completed`: wajib isi `selesai` + `downtime` (Maintenance)

### Status History
Setiap transisi disimpan ke `status_history` array dalam record:
```json
"status_history": [
  {
    "from": "planned",
    "to": "in_progress",
    "at": "2026-08-13 08:30",
    "by": "superadmin",
    "note": "Teknisi masuk",
    "fields": { "jam_realisasi": "08:30" }
  }
]
```

### UI Features
- **Tombol `>`** di setiap row → buka modal transisi dengan field validation.
- **Tooltip** di badge status → menampilkan ringkasan history.
- **Icon `🕒`** di kolom aksi → klik untuk lihat full history di custom modal.
- **Filter transisi** di toolbar:
  - Dropdown "Semua Transisi" → filter by status/transisi.
  - Date range "Transisi Dari/Sampai" → filter by tanggal transisi.
  - Opsi "Transisi Hari Ini" → filter record dengan transisi hari ini.
- **Export History** → tombol `🕒` di toolbar untuk download CSV history transisi.
- **Print History** → tombol Print di modal history untuk cetak A4 dengan logo perusahaan.
- **Highlight row** → baris dengan transisi hari ini di-highlight dengan border accent.
- **Badge count** → card "Transisi Hari Ini" di summary section.

### File terkait
- `js/ops.js` — `showTransitionModal()`, `printHistory()`, `showToast()`, filter transisi, status_history tracking.
- `kunjungan-site.html`, `incident-report.html`, `maintenance.html` — `statusTransitions` config + modal history + tombol print.
- `css/ops.css` — `.ops-row-trans-today`, `.ops-stat-trans-today`, `.ops-history-item`, toast animation.

---

## Network Topology — Catatan Sementara (development, belum final)

### Fitur: "Atur Layer" (Logis / logical mode)
- Di-render oleh **`js/network-topology.js`**; CSS di **`css/network-topology.css`**; halaman **`network-topology.html`**.
- Tombol **`.topbar-sub`**: `#topo-layers-btn` (ikon `fa-layer-group`) → toggle mode edit; label berubah jadi "Selesai Atur" (`fa-check`) + `.active`.
- Editbar (`#topo-editbar`, muncul hanya di edit-mode, `display:none` by default) berisi:
  - **#topo-site-sel** dan **#topo-rack-sel** = dropdown Site / Rack (diisi `initTopoScope()` dari `RACKS` di `js/rack-data.js`).
  - Petunjuk + tombol **#topo-edit-auto** ("Saran Otomatis") / **#topo-edit-reset** ("Reset") di kanan.
- Scope (dipakai untuk filter daftar perangkat di picker): **`topoScope = { site, rack }`** — default site pertama + rack pertama site itu. Ganti site → `fillTopoRacks()` refresh rack; ganti rack → `topoScope.rack` update.
- Picker perangkat **hanya menampilkan aset di dalam rack terpilih** (bukan semua site/rack). Filter di `topoDeviceGroups(filterTypes)`: lewati node yang `n.rack !== topoScope.rack`. Jika site dipilih tapi rack belum → filter by `n.site`.
- Baris layer (9 baris: WAN, Router, Firewall, IDS/IPS, LB, Core, Distribution, Access, Management + grup VLAN 11/22/33) dirender sebagai **band strip selebar canvas** (tinggi 24px, tint aksen `color-mix` + border putus `stroke-dasharray`) via `drawRowPick(row,count)`. Klik di mana saja di band → `openRowPicker(rowKey, ev)`.
- Picker = elemen HTML `<div id="topo-row-picker" class="topo-picker">` (bukan modal), posisi `fixed`, di-append ke `document.body`. Di-list terfilter per kategori (`TOPO_LAYER_TYPES` / `TOPO_DEV_GROUPS`); checkbox assign langsung save ke `localStorage key "rv_topo_layers"` (`TOPO_LAYERS_KEY` di `js/keys.js`) + re-render, tanpa tombol simpan.
- Persistensi manual layer: **`topoLayers`** (localStorage) prioritas atas deteksi otomatis. `deviceLayer(n)` = manual → `detectAutoLayer(n)` (heuristik nama) → leaf (9).
- Smoke test: `C:\Users\anggo\AppData\Local\Temp\opencode\topo-smoke.cjs` (DOM stub + `vm.runInContext` concat keys/rack-data/port-data/pdu-data/network-topology.js). Terakhir PASS untuk 9 baris + scoping (`R1-A12` → 4/7 switch).

### PENDING — Auto-layer dari field `role` (JANGAN LUPA saat deploy)
- Field **Peran / Segmentasi** di form network device sekarang dropdown `Core | Distribution | Access | Management` (`data-nf="role"`, tersimpan di record + tabel `devices.data`) — nilainya SENGAJA disamakan dengan baris layer switch di Network Topology.
- **Belum dikerjakan**: `detectAutoLayer()` di `js/network-topology.js` masih menebak layer dari pola NAMA hostname (SW-CORE-/SW-DIST-/SW-ACC-/MGMT). Perlu ditambah: bila node punya `data.role`/record devices dengan role tersebut, pakai itu sebagai prioritas deteksi otomatis (lebih andal daripada nama), baru fallback heuristik nama.
- Manfaatnya: switch baru yang di-add via form dengan role terpilih otomatis masuk baris Core/Distribution/Access/Management yang benar di mode Logis tanpa assign manual.

---

## History & Notes per Entitas (device/rack) — Checkpoint

Timeline riwayat untuk device & rack di Rack Elevation. Prinsip: **record OPS TIDAK diduplikasi** — endpoint history adalah *read-model projection* yang menggabungkan sumber saat dibaca; hanya catatan manual yang disimpan.

### Backend (`server.js`)
- Tabel **`notes`**: `id · entityType('device'|'rack') · entityKey(canonKey/rackId) · source('manual') · title · detail · severity(info|low|medium|high|critical) · createdBy · createdAt` + INDEX `(entityType, entityKey, createdAt)`.
- **`GET /api/history/:entityType/:entityKey`** → proyeksi gabungan desc: notes(manual) + incidents(asset/rack=key) + maintenance(asset/rack=key, transisi terakhir) + visits(assets LIKE key / rack=key). Item: `{source, refNo, title, detail, severity, at, by, link(deep-link ?q=magicKey), deletable}`. Limit max 500.
- **`POST /api/notes`** (manual; audit `note.create`) · **`DELETE /api/notes/:id`** (hanya source='manual'; audit `note.delete`). Route spesifik DIDAHULUKAN dari route generik `/api/:kind`.
- **audit_log ≠ domain history**: audit = aktivitas sistem; history = konten domain. Terpisah.

### Frontend (`rack-elevation.js`)
- Tab **History pada panel device** = timeline PER PERANGKAT (bukan rack): ikon per sumber (incident 🔴/maintenance 🔧/visit 👁/manual 📝) + badge severity + deep-link; form inline "Tambah Catatan Manual"; hapus hanya untuk catatan manual. Offline fallback: gabungan lokal via RackOps dengan label "(mode offline)".
- **Panel "Riwayat Rak" terpisah** (tombol `#rack-history-btn` di header rack) → entity_type=rack, termasuk form Catatan Rack.
- **Dot merah `.dev-issue-dot`** di overlay device yang punya incident open/in_progress (via `RackOps.loadIncidents()`, key=canonKey asset); hilang saat resolved/closed; refresh tiap loadRack.

### Konvensi wajib
- Join/pencocokan memakai **canonKey** (asset → deviceKey).
- Timeline immutable: transisi status datang dari `status_history` record OPS, bukan tabel notes.


