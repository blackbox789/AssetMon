/* seed-ops.cjs — Isi data OPS (visits/incidents/maintenance) ke SQLite via API.
   Single source of truth — data yang sama juga ada di server.js (auto-seed saat startup).
   Cara pakai:
     node seed-ops.cjs          # isi hanya kind yang masih kosong
     node seed-ops.cjs --force  # timpa semua data yang ada

   Server harus berjalan: npm start */

const BASE = "http://127.0.0.1:3000/api";
const FORCE = process.argv.includes("--force");

const VISITS = [
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
];

const INCIDENTS = [
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
];

const MAINTENANCE = [
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
];

async function get(kind) {
  try {
    const r = await fetch(BASE + "/" + kind);
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}
async function post(kind, rec) {
  try {
    const r = await fetch(BASE + "/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    });
    return r.ok;
  } catch (e) { return false; }
}
async function del(kind, id) {
  try {
    await fetch(BASE + "/" + kind + "/" + encodeURIComponent(id), { method: "DELETE" });
  } catch (e) {}
}

(async () => {
  const kinds = [["visits", VISITS], ["incidents", INCIDENTS], ["maintenance", MAINTENANCE]];
  for (const [kind, list] of kinds) {
    if (FORCE) {
      const cur = await get(kind);
      if (Array.isArray(cur)) {
        for (const r of cur) await del(kind, r.id);
        console.log("CLEARED " + kind + ": " + cur.length + " records dihapus");
      }
    } else {
      const cur = await get(kind);
      if (Array.isArray(cur) && cur.length) {
        console.log("SKIP " + kind + ": sudah ada " + cur.length + " data (pakai --force untuk menimpa).");
        continue;
      }
    }
    let ok = 0;
    for (const rec of list) {
      if (!Array.isArray(rec.status_history)) {
        rec.status_history = [{ from: null, to: rec.status, at: rec.created_at, by: rec.created_by || "System Owner", note: "Record dibuat" }];
      }
      if (await post(kind, rec)) ok++; else break;
    }
    console.log((ok === list.length ? "SEED   " : "PARTIAL ") + kind + ": " + ok + "/" + list.length);
    if (ok !== list.length) console.log("  Server tidak merespons? Jalankan dulu: npm start");
  }
  for (const kind of ["visits", "incidents", "maintenance"]) {
    const cur = await get(kind);
    console.log("VERIFY " + kind + ": " + (Array.isArray(cur) ? cur.length : "?"));
  }
})();
