# 📈 SalesDesk Pro v1.0.0

**Personal Sales Desk untuk Tim — 100% OFFLINE · 100% GRATIS · Windows 10/11**

> © 2026 **VeryCoolApps (PT. Agra Karya Digital)** — All Rights Reserved
> 📱 WA: [+62 815-1925-0845](https://wa.me/6281519250845) · ✈️ Telegram: [@VeryCoolApps](https://t.me/VeryCoolApps)

---

## 🚀 Tentang Aplikasi

SalesDesk Pro menggabungkan **CRM Pipeline**, **manajemen tim penjualan**, **mesin komisi otomatis**, dan **dashboard performa individu** dalam satu aplikasi desktop yang berjalan **100% offline** di komputer Windows.

> *"Lihat dashboard, langsung tahu kondisi tim."*

- 🔒 **100% OFFLINE** — semua data tersimpan lokal & terenkripsi (AES-256-GCM)
- 💸 **100% GRATIS** — tanpa langganan, tanpa iklan, tanpa fitur terkunci
- 👥 **UNTUK TIM** — peran Admin / Manager / Team Leader / Sales
- 📊 **19 WIDGET DASHBOARD** — prioritas, meeting, follow-up, revenue, target, komisi, scorecard
- 💰 **MESIN KOMISI** — skema persentase, tier, dan target-based (transparan & auditable)
- 📥 **LAPORAN EXCEL 1 KLIK** — prospek, deal, komisi, performa tim (format profesional)
- 🛡️ **KEAMANAN ENTERPRISE** — PBKDF2, enkripsi DB, audit log append-only, role-based access

## 📦 Instalasi

1. Download **`SalesDeskPro-Setup-1.0.0.exe`** (folder `release/` atau halaman rilis).
2. Jalankan installer → ikuti wizard → selesai.
3. Login pertama: username `admin` / password `admin123` → **wajib ganti password**.
4. Kirim fingerprint mesin (dari layar Aktivasi) ke WA **0815-1925-0845** untuk mendapat License Key gratis → aktivasi → selesai.

> ⚠️ **SmartScreen**: installer belum ditandatangani digital (belum punya sertifikat EV). Klik *"More info → Run anyway"* jika muncul peringatan.

## 🔑 Aktivasi Lisensi

SalesDesk Pro **terikat ke fingerprint mesin** (anti-copy). Menyalin folder instalasi ke komputer lain akan gagal tanpa aktivasi ulang — hubungi VeryCoolApps untuk License Key gratis:
- **WA:** +62 815-1925-0845
- **Telegram:** https://t.me/VeryCoolApps

## 🛡️ Proteksi Anti-Modifikasi & Anti-Copy

| Lapisan | Mekanisme |
|---|---|
| 🔐 Machine-binding license | Lisensi valid hanya di mesin terdaftar (Windows MachineGuid + hardware) |
| 🧬 Integrity self-check | Hash file inti (manifest.sig) + app.asar diverifikasi saat startup |
| 🌫️ Obfuscation | Main process di-obfuscate (javascript-obfuscator) — anti reverse-engineering |
| 🔒 Enkripsi database | AES-256-GCM at-rest, kunci turunan dari fingerprint mesin |
| 🗝️ Password PBKDF2 | 100.000 iterasi SHA-256, salt acak per user, lockout 5× gagal |
| 📜 Audit log | Append-only — aksi kritis wajib alasan, tidak bisa diedit via UI |
| 🖥️ Lock screen | Auto-lock setelah idle (default 10 menit) |
| ⛔ DevTools disabled | contextIsolation + sandbox + CSP ketat |

## 📁 Struktur Proyek

```
SalesDeskPro/
├── main.js                # Electron main process (proteksi, scheduler, IPC)
├── preload.js             # Context bridge (contextIsolation)
├── core/                  # Business logic (source asli, TIDAK ikut di distribusi)
│   ├── db.js              #   SQLite (sql.js) + enkripsi AES-256-GCM + backup/restore
│   ├── services.js        #   Auth, CRM, mesin komisi, target, laporan, audit
│   ├── crypto.js          #   PBKDF2, AES-GCM, HMAC, license
│   ├── license.js         #   Machine fingerprint + aktivasi
│   └── integrity.js       #   Self-check anti-modifikasi
├── renderer/              # UI (index.html, css, js)
├── dist/                  # Output obfuscation (dipakai saat build)
├── scripts/
│   ├── obfuscate.js       # Build: obfuscate + generate manifest.sig
│   ├── after-pack.js      # Sign app.asar (anti-modifikasi)
│   ├── license-gen.js     # Generator License Key OFFLINE (pemilik brand)
│   ├── make-icons.js      # Generator icon (pure Node)
│   └── smoke.js           # 17 smoke test bisnis logic
├── docs/EULA.txt          # End-User License Agreement
├── LICENSE.md             # Lisensi proprietary
└── release/               # Hasil build installer
```

## 🛠️ Build dari Source

```bash
npm install
npm run build:win          # obfuscate + electron-builder → release/SalesDeskPro-Setup-1.0.0.exe
npm run gen:license        # generate license key (perlu fingerprint customer)
node scripts/smoke.js      # jalankan 17 smoke test
```

## 📄 Lisensi

**PROPRIETARY** — © 2026 VeryCoolApps (PT. Agra Karya Digital). Dilarang menyalin, mendistribusikan, memodifikasi, atau reverse engineering tanpa izin tertulis. Lihat [LICENSE.md](LICENSE.md) dan [EULA](docs/EULA.txt). Pelanggaran dituntut sesuai UU No. 28/2014 tentang Hak Cipta.

---

*SalesDesk Pro — Personal Sales Desk untuk Tim · Built with ❤️ in Indonesia*
*© 2026 VeryCoolApps (PT. Agra Karya Digital) · WA +62 815-1925-0845 · t.me/VeryCoolApps*
