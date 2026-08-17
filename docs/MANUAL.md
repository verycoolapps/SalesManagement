# 📘 Panduan Pengguna — SalesDesk Pro v1.0

**© 2026 VeryCoolApps (PT. Agra Karya Digital)** · WA +62 815-1925-0845 · t.me/VeryCoolApps

---

## 1. Memulai

1. Install `SalesDeskPro-Setup-1.0.0.exe` dan jalankan.
2. Login pertama: **admin** / **admin123** → sistem WAJIB meminta ganti password.
3. Aplikasi akan menampilkan **Fingerprint Mesin** untuk aktivasi lisensi. Kirim ke WA 0815-1925-0845 → terima License Key → masukkan → selesai.

> Data aplikasi tersimpan di `%APPDATA%\SalesDeskPro\salesdesk.data` (terenkripsi).

## 2. Dashboard — 19 Widget

| Widget | Fungsi |
|---|---|
| 🎯 Today's Priorities | 3–5 tugas teratas (bobot due date + prioritas + nilai deal) |
| 🗓️ Today's Meetings | Jadwal meeting hari ini |
| ⏰ Follow-ups Due Today | Follow-up jatuh tempo hari ini — tombol selesai langsung |
| 🔴 Overdue Follow-ups | Follow-up terlambat (merah) |
| ✨ New Prospects | Jumlah prospek baru + delta vs periode sebelumnya |
| 📊 Open Opportunities | Total nilai deal aktif di pipeline |
| 🔥 Deals Closing Soon | Deal estimasi closing ≤ 7 hari |
| 💰 Monthly Revenue | Total deal Won bulan berjalan |
| 🎯 Monthly Target | Target bulan berjalan |
| 📈 Target Achievement | Progress bar pencapaian target |
| 💵 Commission Earned | Komisi bulan berjalan |
| ⚡ Commission Forecast | Proyeksi komisi pipeline aktif |
| 📞 Activity Counter | Aktivitas tercatat hari ini |
| 📊 Weekly Performance | Grafik revenue 7 hari |
| 📈 Monthly Performance | Grafik revenue 12 bulan |
| ⚡ Quick Actions | + Prospek, + Follow-up, + Meeting, + Deal |
| 🕒 Recent Activity | 10 aktivitas terakhir |
| ⏳ Upcoming Deadlines | Deadline 7 hari ke depan |
| 🏅 Personal Scorecard | Skor gabungan 20% aktivitas + 20% follow-up + 30% deal + 30% revenue |

**Filter periode** (Hari/Minggu/Bulan) di toolbar dashboard.

## 3. CRM Pipeline

- **Prospek**: tambah, edit, hapus (soft delete → Recycle Bin 30 hari), import CSV, deteksi duplikat otomatis.
- **Kontak**: database kontak dengan telepon, email, jabatan.
- **Pipeline Kanban**: drag & drop deal antar tahapan (Prospek → Kualifikasi → Penawaran → Deal).
- **Deal Won**: butuh konfirmasi TL/Manager → deal terkunci + **komisi dihitung otomatis**.
- **Deal Lost**: wajib alasan.

## 4. Follow-up & Meeting

- Follow-up: judul, prospek terkait, due date, prioritas. Status otomatis jadi **Overdue** jika lewat.
- Meeting: jadwal + pengingat desktop (default 15 menit sebelum).
- Notifikasi desktop muncul otomatis (sesuai pengaturan).

## 5. Target & KPI

- Manager/Admin: set target bulanan per sales (revenue, aktivitas, follow-up, deal).
- Pencapaian % real-time; scorecard per sales.

## 6. Komisi

- **Skema Persentase**: mis. 5% dari nilai deal.
- **Skema Tier (marginal)**: mis. 0–50jt 5%, >50jt 7% → deal 60jt = 2,5jt + 0,7jt = **3,2jt**.
- **Skema Target-based**: base % → bonus % jika target ≥100% (true-up otomatis akhir bulan).
- **Override**: hanya Admin, WAJIB alasan (tercatat di audit log).
- Snapshot skema disimpan saat deal won — perubahan skema tidak mengubah komisi deal lama.

## 7. Laporan & Export

Export Excel 1 klik (header navy, formula total, filter): Prospek, Pipeline/Deal, Komisi, Performa Tim, Follow-up, Audit Log. Tersimpan di folder Documents.

## 8. Admin

- **User & Tim**: buat user, atur role (Sales/TL/Manager/Admin), reset password, team.
- **Data Master**: produk, sumber prospek, tahapan pipeline, template follow-up.
- **Backup & Restore**: backup manual/otomatis (22:00, rolling 7), restore dengan konfirmasi ganda + integrity check.
- **Audit Log**: semua aksi kritis (login, komisi, hapus, restore, ubah role).
- **Keamanan**: min password, auto-lock, lockout, notifikasi.
- **Recycle Bin**: pulihkan / hapus permanen (wajib alasan).

## 9. Pintasan Keyboard

| Shortcut | Aksi |
|---|---|
| `Ctrl+N` | + Prospek |
| `Ctrl+F` | + Follow-up |
| `Ctrl+M` | + Meeting |
| `Ctrl+L` | Kunci aplikasi |

## 10. FAQ

**Lupa password?** Admin → Pengaturan → User → Reset PW. User wajib ganti saat login berikutnya.

**Gagal login 5×?** Terkunci 30 detik (anti brute-force).

**Data hilang / aplikasi tidak mau buka?** Sistem mendeteksi DB korup → tawarkan restore dari backup terakhir otomatis.

**Bisa dipindah ke komputer lain?** Ya, tapi WAJIB aktivasi ulang dengan License Key baru (hubungi VeryCoolApps).

**Data dikirim ke server?** TIDAK. 100% lokal & terenkripsi.

---

© 2026 VeryCoolApps (PT. Agra Karya Digital) — PROPRIETARY. Dilarang menyalin/mendistribusikan tanpa izin. UU No. 28/2014.
