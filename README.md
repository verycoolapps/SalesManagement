<div align="center">

# SalesDesk Pro

**CRM Pipeline · Komisi · Dashboard Performa**

*100% OFFLINE · 100% GRATIS · MIT License*

[![Release](https://img.shields.io/github/v/release/verycoolapps/SalesManagement?style=flat-square&color=0EA5E9&label=Download)](https://github.com/verycoolapps/SalesManagement/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue.svg?style=flat-square)](https://github.com/verycoolapps/SalesManagement/releases)
[![Electron](https://img.shields.io/badge/Built%20with-Electron-47848F?style=flat-square)](https://electronjs.org)
[![No Cloud](https://img.shields.io/badge/Cloud-Zero-brightgreen?style=flat-square)](https://github.com/verycoolapps/SalesManagement)

---

</div>

## ❱ Apa itu SalesDesk Pro? / What is SalesDesk Pro?

**SalesDesk Pro** adalah aplikasi desktop CRM (Customer Relationship Management) untuk **macOS** dan **Windows** yang dirancang untuk tim penjualan kecil hingga menengah.

Semua data tersimpan **di perangkatmu sendiri** — tidak ada server, tidak ada berlangganan, tidak ada akun online yang dibutuhkan.

**SalesDesk Pro** is a desktop CRM application for **macOS** and **Windows** designed for small-to-medium sales teams.

All data is stored **on your own device** — no servers, no subscriptions, no online accounts required.

---

## ❱ Download / Unduh

| Platform | File | Keterangan |
|----------|------|------------|
| 🍎 macOS 12+ | `SalesDeskPro-2.0.0-mac.dmg` | Universal (Apple Silicon + Intel) |
| 🪟 Windows 10/11 | `SalesDeskPro-Setup-2.0.0.exe` | NSIS Installer (x64) |
| 🪟 Windows Portable | `SalesDeskPro-2.0.0-win.zip` | Zip portable, no install needed |

👉 **[Download di sini / Download here →](https://github.com/verycoolapps/SalesManagement/releases/latest)**

### Install macOS
```bash
# Download DMG
curl -L https://github.com/verycoolapps/SalesManagement/releases/latest/download/SalesDeskPro-2.0.0-mac.dmg -o SalesDeskPro.dmg
open SalesDeskPro.dmg
# Seret ke Applications / Drag to Applications

# Jika ada peringatan Gatekeeper / If Gatekeeper warning appears:
sudo xattr -rd com.apple.quarantine /Applications/SalesDesk\ Pro.app
```

### Install Windows
```powershell
# Download via PowerShell
Invoke-WebRequest -Uri "https://github.com/verycoolapps/SalesManagement/releases/latest/download/SalesDeskPro-Setup-2.0.0.exe" -OutFile "SalesDeskPro-Setup.exe"
Start-Process "SalesDeskPro-Setup.exe"

# Atau download ZIP portable (tanpa installer)
# Or download ZIP portable (no installer)
Invoke-WebRequest -Uri "https://github.com/verycoolapps/SalesManagement/releases/latest/download/SalesDeskPro-2.0.0-win.zip" -OutFile "SalesDeskPro.zip"
Expand-Archive "SalesDeskPro.zip" -DestinationPath "SalesDeskPro"
.\SalesDeskPro\SalesDesk Pro.exe
```

---

## ❱ Fitur Lengkap / Feature List

### 🎯 Dashboard — 19 Widget Real-time
- Ringkasan revenue hari ini / minggu / bulan / kuartal
- Pipeline value vs target
- Prioritas hari ini (follow-up + deal overdue)
- Meeting hari ini dengan pengingat
- Prospect baru + delta vs periode sebelumnya
- Win rate, revenue by source, aktivitas terbaru
- Skor pencapaian target per sales

### 👥 CRM — Prospect & Kontak
- Manajemen prospect (nama, perusahaan, nilai estimasi, sumber, stage)
- Manajemen kontak perusahaan
- Import prospect via CSV
- Recycle bin (30 hari sebelum permanen)
- Filter, search, sort, export Excel/CSV

### 💼 Pipeline — Sales Pipeline Kanban
- Stage kustom (default: Prospek → Kualifikasi → Penawaran → Negosiasi → Menang/Kalah)
- Drag-and-drop deal antar stage
- Detail deal: produk, qty, nilai, tanggal close estimasi
- Won/lost tracking dengan reason
- Pipeline value real-time

### 💰 Komisi — Mesin Komisi Otomatis
- Scheme komisi fleksibel (persentase, flat, tier)
- Snapshot scheme saat deal closed
- Override komisi per deal (manajer)
- True-up bulanan otomatis
- Forecast komisi

### ⏰ Follow-up & Meeting
- Follow-up scheduler dengan notifikasi overdue
- Meeting management (lokasi, peserta, agenda)
- Pengingat meeting X menit sebelumnya (configurable)
- Quick-add dari dashboard

### 📊 Laporan & Analitik
- Revenue bulanan / kuartalan
- Performance per sales
- Win rate by source / product
- Target vs achievement
- Export Excel & CSV

### 👤 Admin & Tim
- Multi-user dengan role (Admin, Manager, Sales)
- Manajemen tim & hierarki
- Audit log seluruh aktivitas
- Reset password
- Backup & restore otomatis

### ⚙️ Pengaturan
- Dark mode / Light mode
- Auto-lock (idle timeout)
- Backup otomatis (jadwal jam)
- Pengingat meeting (menit sebelum)
- Stage pipeline kustom
- Lead source kustom
- Template catatan

---

## ❱ Memulai / Getting Started

### Login Pertama Kali / First Login

Saat pertama kali menjalankan, buat akun admin:
*When running for the first time, create an admin account:*

```
Username : admin
Password : (buat password baru di prompt / create at prompt)
Role     : Admin
```

Atau gunakan akun demo default jika database belum ada:
*Or use default demo account if no database exists yet:*

```
Username : admin
Password : admin123
```

### Alur Kerja / Workflow

```
1. TAMBAH PROSPECT → Pipeline → Buat Deal → Follow-up → Close
   Add Prospect → Pipeline → Create Deal → Follow-up → Close

2. Dashboard menampilkan semua secara real-time
   Dashboard shows everything in real-time

3. Laporan ekspor ke Excel/CSV kapan saja
   Reports exportable to Excel/CSV anytime
```

---

## ❱ Build dari Source / Build from Source

### Prasyarat / Prerequisites

| Tool | Versi | Cek / Check |
|------|-------|-------------|
| Node.js | 18 LTS+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.x | `git --version` |

### macOS

```bash
git clone https://github.com/verycoolapps/SalesManagement.git
cd SalesManagement
npm install

# Jalankan development / Run development
npm start

# Build DMG (Universal: Apple Silicon + Intel)
npm run build:mac

# Hasil di / Output in:
# release/SalesDeskPro-2.0.0-mac.dmg
```

### Windows

```powershell
git clone https://github.com/verycoolapps/SalesManagement.git
cd SalesManagement
npm install

# Jalankan development / Run development
npm start

# Build NSIS Installer (x64)
npm run build:win

# Build portable ZIP (x64, tanpa installer / without installer)
npm run build:win-zip

# Hasil di / Output in:
# release/SalesDeskPro-Setup-2.0.0.exe
# release/SalesDeskPro-2.0.0-win.zip
```

### Cross-platform (build Windows dari macOS)
```bash
# Membutuhkan Wine / Requires Wine
brew install --cask wine-stable
npm run build:win

# Alternatif tanpa Wine / Alternative without Wine:
npm run build:win-zip  # portable ZIP, tidak butuh Wine
```

---

## ❱ Arsitektur / Architecture

```
SalesManagement/
├── main.js              # Electron main process
├── preload.js           # Context bridge (IPC security layer)
├── core/
│   ├── db.js            # SQLite via sql.js (encrypted AES-256-GCM at rest)
│   ├── services.js      # Business logic (semua operasi data)
│   ├── crypto.js        # AES-256-GCM + bcrypt utilities
│   ├── license.js       # MIT — always licensed
│   └── integrity.js     # MIT — always valid
├── renderer/
│   ├── index.html       # App shell
│   ├── css/app.css      # Premium design system
│   └── js/
│       ├── app.js       # Bootstrap, router, auth flow
│       ├── pages.js     # Semua halaman (Dashboard, CRM, Pipeline, etc.)
│       └── lib.js       # Shared utilities
├── build/               # Icons (ICNS, ICO, PNG)
└── scripts/
    └── after-pack.js    # Post-build hook
```

### Keamanan Data / Data Security

```
┌─────────────────────────────────────────────────────────┐
│             DATA SECURITY MODEL                         │
│                                                         │
│  SQLite Database ──→ AES-256-GCM Encryption             │
│                  ──→ Stored locally in AppData/         │
│                  ──→ Never leaves your device            │
│                                                         │
│  IPC Bridge ──→ contextIsolation: true                  │
│             ──→ nodeIntegration: false                  │
│             ──→ sandbox: true                           │
│             ──→ Whitelist-only service calls            │
│                                                         │
│  No telemetry · No cloud · No account required         │
└─────────────────────────────────────────────────────────┘
```

---

## ❱ Tangkapan Layar / Screenshots

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏢 SalesDesk Pro v2.0        [—][□][×]                              │
├────────────┬─────────────────────────────────────────────────────────┤
│ 📊 Dashboard│   Revenue Hari ini        Pipeline Value               │
│ 👥 Prospects│   ┌──────────────┐        ┌──────────────┐             │
│ 💼 Pipeline │   │  Rp 45.2 jt  │        │  Rp 312 jt   │            │
│ 💰 Komisi   │   │  ▲ 12.4%     │        │  18 deals    │            │
│ ⏰ Follow-up│   └──────────────┘        └──────────────┘             │
│ 🗓 Meeting  │                                                          │
│ 📊 Laporan  │   Today's Priorities      Follow-ups Due               │
│ 👤 Admin    │   • 🎯 Deal ABC — $12k   • ⏰ Call Budi — overdue      │
│ ⚙ Settings  │   • 💼 Proposal XYZ      • ⏰ Email Siti — today       │
└────────────┴─────────────────────────────────────────────────────────┘
```

---

## ❱ Stack Teknologi / Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Electron 31 |
| Database | sql.js (SQLite) + AES-256-GCM encryption |
| UI | Vanilla JS + CSS Custom Properties |
| Charts | Canvas API (built-in) |
| Export | ExcelJS |
| Build | electron-builder |
| Platform | macOS 12+ · Windows 10/11 |

---

## ❱ FAQ

**Q: Apakah data saya aman? / Is my data safe?**
Database dienkripsi AES-256-GCM di disk. Tidak ada data yang keluar dari perangkat Anda.
*Database is AES-256-GCM encrypted on disk. No data leaves your device.*

**Q: Berapa batas jumlah user/data? / What is the user/data limit?**
Tidak ada batas — SQLite mendukung jutaan baris. Performa optimal sampai ~100 users aktif.
*No hard limit — SQLite supports millions of rows. Optimal performance up to ~100 active users.*

**Q: Apakah bisa pakai di multiple komputer? / Can I use it on multiple computers?**
Ya — backup dan restore database ke komputer lain lewat fitur Backup built-in.
*Yes — backup and restore the database to another computer using the built-in Backup feature.*

**Q: Apakah perlu internet? / Does it need internet?**
Tidak sama sekali, kecuali download awal.
*Not at all, except for the initial download.*

**Q: Bagaimana cara migrasi data dari versi lama? / How to migrate from old version?**
Backup dari versi lama → Restore di versi baru. Format database kompatibel.
*Backup from old version → Restore in new version. Database format is compatible.*

---

## ❱ Kontribusi / Contributing

Pull request disambut baik! / Pull requests are welcome!

```bash
git fork https://github.com/verycoolapps/SalesManagement
git checkout -b feature/nama-fitur
# ... buat perubahan
git commit -m "feat: tambah fitur X"
git push origin feature/nama-fitur
# Buka Pull Request di GitHub
```

---

## ❱ Lisensi / License

MIT License — **Gratis untuk semua orang. / Free for everyone.**

```
Copyright (c) 2026 VeryCoolApps (PT. Agra Karya Digital)

Bebas digunakan, disalin, dimodifikasi, digabung, diterbitkan,
didistribusikan, disublisensikan, dan/atau dijual oleh siapa pun.

Free to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell by anyone.
```

---

## ❱ Tentang / About

```
SalesDesk Pro v2.0.0
Dibuat oleh / Made by: VeryCoolApps
Perusahaan / Company : PT. Agra Karya Digital, Indonesia
Kontak / Contact     : t.me/VeryCoolApps | WA: +62 815-1925-0845
GitHub               : github.com/verycoolapps
Lisensi / License    : MIT (Free & Open Source)
```

---

<div align="center">

**SalesDesk Pro v2.0 — CRM for Humans, Not Enterprises**

Made with ❤️ by VeryCoolApps — Free Forever (MIT)

</div>
