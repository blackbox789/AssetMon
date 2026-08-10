# RackView — AssetMon

Datacenter Asset Management: UI statis + backend Express + SQLite (`node:sqlite`).
Storage key perangkat dinormalisasi **uppercase** (`canonKey`) agar indexing konsisten
("srv-web-01" dan "SRV-WEB-01" dianggap perangkat yang sama).

## Menjalankan

```bash
npm install
npm start            # server di http://localhost:3000 (PORT bisa di-override via env)
```

Tanpa backend (dibuka langsung via `file://`), aplikasi tetap berjalan memakai
`localStorage` dan otomatis menyambung ke `http://localhost:3000/api` bila ada.

## Scripts

| Perintah            | Fungsi                                                        |
| ------------------- | ------------------------------------------------------------- |
| `npm start`         | Jalankan server (Express + SQLite di `data/app.db`)           |
| `npm run verify`    | Verifikasi normalisasi key & pembuatan Port Map (44 test)     |
| `npm run seed`      | Impor `data/seed.json` ke backend (idempoten/upsert)          |
| `npm run seed:example` | Buat contoh file `data/seed.example.json`                  |

## Backup & restore (deployment)

```bash
# Backup seluruh data (racks, servers, maps, devices) ke file JSON
Invoke-RestMethod http://localhost:3000/api/export | ConvertTo-Json -Depth 8 | Set-Content data/backup.json

# Restore di server lain (backend harus hidup dulu)
npm run seed -- data/backup.json
# atau target API lain
node data/seed.js --api http://10.0.0.5:3000/api data/backup.json
```

## Model data

- **`devices`** — registri master semua perangkat (`deviceKey` PK, uppercase).
  Semua tipe (server, switch, firewall, pdu, patch, router, ups, dll) terdaftar di
  sini; terisi otomatis dari save server/PDU/map, plus backfill data lama saat startup.
  Device yang tidak punya map dan tidak merujuk server mana pun dibersihkan saat startup.
- **`racks`** — rack fisik (rackId PK, uppercase) + ringkasan.
- **`servers`** — detail server sebagai JSON di kolom `data`.
- **`maps`** — Port Map (`kind='port'`, deviceKey = hostname) & Power Map
  (`kind='power'`, deviceKey = nama PDU). PK `(kind, deviceKey)`,
  FK `deviceKey → devices.deviceKey`, `CHECK(kind IN ('port','power'))`.
- Normalisasi master key: `js/keys.js` (`canonKey`) di sisi klien,
  `server.js` (`canonKey`, `normalizeMapKeys`) di sisi server.

### Record Network Device (Switch / Firewall / Router)

Di `rv_switches` (switch) dan `rv_accessories` (firewall/router), nama perangkat
selalu `canonKey` (uppercase). Field record:

| Grup | Field |
| ---- | ----- |
| Identitas | `name`, `brand`, `model`, `serial`, `rack`, `posisiU`, `ip`, `tags`, `site` |
| Interface | `lanRj45`, `lanSfp`, `lanQsfp` → Port Map dibuat otomatis (`ports = RJ-45 + SFP + QSFP×4`, `sfp = SFP + QSFP×4`) |
| Umum | `speed` (1G–400G), `os` (firmware), `role`, `vlan`, `monitoring` |
| Power | `psuCount`, `psuWatt`, `powerRedundancy` |
| Pembelian | `tahunPembelian`, `warranty` |
| Switch | `switchType` (ethernet/san/fc/iscsi/infiniband/nvmeof), `stacking`, `stackRole` |
| Firewall | `throughput`, `maxConnections`, `vpnTunnels`, `haMode` |
| Router | `routingProtocol`, `wanPorts` |

Sinkronisasi: simpan/edit selalu menulis record + mendaftarkan `devices` (registri
DB) + menyimpan Port Map. Rename otomatis me-rekey map & registri
(`rekeyDeviceMaps`).

## API

| Method | Endpoint                         | Keterangan                                  |
| ------ | -------------------------------- | ------------------------------------------- |
| GET    | `/api/health`                    | Status + hitungan racks/servers/maps/devices |
| GET    | `/api/export`                    | Ekspor seluruh data (backup)                |
| GET    | `/api/racks` / POST / DELETE     | Kelola rack                                  |
| GET    | `/api/servers` / POST / DELETE   | Kelola server (`id`)                        |
| GET    | `/api/devices`                   | Daftar registri perangkat                    |
| POST   | `/api/devices`                   | Daftarkan/update perangkat                  |
| DELETE | `/api/devices/:deviceKey`        | Hapus perangkat + semua map terkait (kaskade) |
| PUT    | `/api/devices/:deviceKey/rename` | Ganti nama perangkat + re-key semua map      |
| GET    | `/api/maps/:kind`                | Daftar map (`port`/`power`)                 |
| GET    | `/api/maps/:kind/:deviceKey`     | Detail satu map                             |
| POST   | `/api/maps/:kind/:deviceKey`     | Simpan map (auto-registrasi device)          |
| DELETE | `/api/maps/:kind/:deviceKey`     | Hapus map                                   |

Semua `deviceKey` pada endpoint dinormalisasi `canonKey` sebelum diproses.

## Verifikasi

```bash
npm run verify   # 44 PASS: canonKey, normalisasi runtime, build map, saveMap
```
