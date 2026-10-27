# Momen TI — versi tanpa login (admin + tamu) · v12

Album foto acara dari kamera peserta. Peserta scan QR, mengisi nama, memotret dari HP dengan filter ala film, dan semua foto terkumpul dalam satu album.

| Bagian | Dipakai |
|---|---|
| Tampilan | GitHub Pages, gratis dan otomatis HTTPS |
| Backend | Google Apps Script milik akun Google Anda |
| Database | Google Sheets, dibuat otomatis |
| Penyimpanan foto | Folder di Google Drive akun tersebut |
| Akses | **Admin** dengan kata sandi; **semua peserta** cukup mengisi nama (+ kode akses bila diatur) |

Tidak perlu Google Cloud, OAuth, atau akun kampus.

## Yang baru di v12: Album per hari

Untuk acara lebih dari satu hari, album jadi lebih mudah dijelajahi:

- **Pilihan hari** di atas album: *Semua hari · Hari 3 · Sel 27 Okt · Hari 2 · …* lengkap dengan jumlah foto. Bawaannya membuka **hari terakhir**.
- **Semua hari**: foto dikelompokkan per hari dengan judul tanggal yang tetap terlihat saat digulir. Setiap hari hanya menampilkan **12 foto pertama**, lalu tombol **"Lihat semua 124 foto hari ini ›"** untuk membuka hari tersebut.
- **Terbaru dulu**: selama acara berlangsung, foto terbaru tampil paling atas (dan hari terbaru di urutan pertama). Setelah acara selesai, urutan kembali dari awal acara.
- Pilihan hari berlaku juga untuk tab *Foto saya* dan *Terfavorit*.

Acara satu hari tidak berubah: tidak ada pilihan hari, hanya urutan terbaru dulu selama acara berlangsung. Hari dihitung menurut waktu WIB.

## Yang baru di v11: Navigasi album lebih mudah

- Tombol **‹ Kembali ke kamera** yang jelas di kiri atas album.
- Tombol mengambang **📷 Potret lagi** di kanan bawah album, selama kamera acara masih terbuka.
- Saat melihat foto, tombol di kiri atas menjadi **‹ Kembali ke album**.
- **Tombol kembali di HP** (atau browser) kini menutup foto yang sedang dilihat dan kembali ke album, bukan langsung keluar dari album.
- **Geser kiri/kanan** pada foto untuk berpindah ke foto berikutnya atau sebelumnya.

## Yang baru di v10: Hapus foto sendiri & aktivitas

**Menghapus foto sendiri**
- Di album, buka foto milikmu → tombol **Hapus**. Di halaman kamera, ketuk foto terakhir di pojok kiri bawah → **Hapus foto ini** (aktif setelah foto selesai terkirim).
- Foto dipindah ke sampah Google Drive (admin masih bisa memulihkannya selama 30 hari). Komentar dan reaksi pada foto itu ikut hilang dari album.
- **Jatah foto tidak dikembalikan**, sesuai konsep kamera sekali pakai.
- Pemilik foto dikenali dari **HP yang dipakai memotret**. Jika peserta berganti HP atau menghapus data browser, minta admin untuk menghapus fotonya.

**Pemberitahuan aktivitas di foto kita**
- **Titik merah di tombol Album** (halaman kamera) jika ada komentar atau reaksi baru pada foto kita. Diperiksa saat kamera dibuka dan setiap 2 menit.
- **Tombol 🔔 Aktivitas** di album, dengan jumlah aktivitas baru. Isinya daftar seperti *"Budi berkomentar: 'Keren!'"* atau *"3 orang memberi reaksi ❤️"*. Ketuk untuk langsung membuka foto (dan komentarnya).
- **Titik merah di foto** yang mendapat aktivitas baru sejak terakhir dilihat.
- Yang dihitung hanya aktivitas orang lain pada foto yang diambil dari HP tersebut. Tanpa email, WA, atau notifikasi push.

## Yang baru di v9: Kata di bingkai

Peserta bisa menulis satu baris pendek di foto, seperti tulisan tangan di bawah polaroid.

**Mengaktifkan (admin):** *Pengaturan acara → Izinkan peserta menulis kata di bingkai foto*. Di bawahnya, isi **Contoh kata siap pakai** (satu per baris, maksimal 10). Jika dikosongkan, dipakai contoh bawaan seperti *"Ngoding bareng, sukses bareng"* dan *"Error itu biasa, menyerah jangan"*.

**Alur peserta:**
1. Setelah menekan tombol rana, muncul pratinjau foto dan kolom *"Tulis sesuatu di bingkai (opsional)"*.
2. Peserta mengetik sendiri (maksimal 40 karakter) atau mengetuk salah satu contoh kata. Pratinjau langsung berubah.
3. Tekan **Simpan foto**, atau **Lewati** jika tidak ingin menulis.

**Tampilan di foto:**
- Bingkai polaroid: kata peserta menjadi tulisan besar, dan baris kecil di bawahnya berisi *nama acara · tanggal · nama pemotret*. Tanpa kata, bingkai tetap seperti sebelumnya.
- Foto polos: kata ditulis di bagian bawah foto dengan bayangan lembut.

**Pengaman:**
- Kata kasar ditolak **di HP** (tombol Simpan tidak bisa ditekan) dan **diperiksa ulang di server**. Jika ditolak server, foto tidak disimpan dan jatah foto tidak berkurang.
- Contoh kata dari admin juga diperiksa dengan filter yang sama.
- Kata tersimpan juga di Google Sheet (kolom `caption` di tab `Photos`) dan tampil di halaman **Kelola → Moderasi foto**, sehingga mudah ditelusuri. Admin tetap bisa menyembunyikan atau menghapus foto.
- Daftar kata kasar bisa ditambah lewat Script Property `BAD_WORDS`. Untuk pemeriksaan di HP, tambahkan juga ke daftar `CAPTION_BAD` di `web/js/caption.js`.

Fitur ini hanya untuk kamera HP peserta, belum untuk booth layar sentuh.

## Yang baru di v8: Tampilan

**1. Sampul dan warna acara**
- Di **Pengaturan acara → Warna acara**, pilih satu dari 7 warna. Tombol, tombol rana kamera, penghitung, dan poster ikut warna ini, sehingga setiap acara punya identitas sendiri.
- Di halaman **Kelola → Sampul acara**, unggah foto lokasi, poster, atau logo. Gambar otomatis dipotong 16:9 dan diperkecil. Sampul tampil di atas halaman yang dibuka peserta setelah scan QR. Jika tidak ada sampul, tampil pola strip film berwarna acara.
- Halaman gabung menampilkan **"📸 23 orang sudah ikut memotret"** (atau ajakan "Jadilah yang pertama…").

**2. Kamera terasa seperti kamera sungguhan**
- **Pratinjau filter bergambar:** setiap filter tampil sebagai bulatan kecil berisi gambar kamera dengan filter tersebut, diperbarui tiap detik.
- **Foto terakhir di pojok kiri bawah:** setelah memotret, foto "terbang" ke pojok. Ketuk untuk melihat hasilnya.
- **Penghitung film di bagian atas**, dengan angka yang bergulir saat berkurang.

**3. Album: Semua · Foto saya · Terfavorit**
- **Foto saya**: hanya foto milik peserta. **Terfavorit**: foto dengan reaksi terbanyak di atas.
- **Efek "cuci film":** saat album yang sudah dibuka dilihat pertama kali di sebuah HP, foto muncul perlahan dari gelap seperti polaroid yang sedang tercetak.

**4. Poster QR siap cetak**
- Tombol **Unduh poster** di halaman Kelola menghasilkan gambar A4 (PNG) berisi nama acara, waktu, sampul, QR besar, 3 langkah singkat, kode akses (jika ada), dan warna acara. Cetak di ukuran A4 atau A5.

## Yang baru di v7: Lebih cepat

**Di server (Apps Script):**
- Pengaturan (Script Properties) dibaca **sekali** per permintaan, bukan belasan kali.
- Data acara disimpan sebentar di cache server, jadi tidak membaca Google Sheet setiap kali.
- Data peserta dan foto dicari **langsung ke barisnya**, tidak lagi membaca seluruh sheet. Membuka acara, bergabung, dan upload foto tetap cepat walau data sudah ribuan baris.
- Saat bergabung, server langsung mengirim data acara lengkap, sehingga kamera tampil tanpa menunggu permintaan kedua.

**Di HP peserta:**
- **Membuka ulang kamera hampir seketika:** data acara disimpan di HP, sehingga halaman dan kamera langsung tampil, lalu data terbaru diambil di belakang layar.
- **Kunjungan pertama:** formulir gabung langsung tampil, dan peserta bisa mengetik nama sambil data acara dimuat.
- Font tidak lagi menahan tampilan halaman.

**Catatan:** jika data acara diubah **langsung di Google Sheet** (bukan lewat halaman Kelola), perubahan baru terlihat di aplikasi paling lambat 2 menit kemudian. Perubahan lewat halaman Kelola langsung berlaku.

**Tetap disarankan:** nyalakan pemanas server (`setupKeepWarm`) agar server tidak "tidur" saat ada acara. Lihat bagian *Pemanas server*.

Juga diperbaiki: tombol "Beri masukan" di halaman kamera tidak lagi bisa terbuka ganda setelah peserta bergabung.

## Masukan pengguna (versi ringkas)

**Peserta** menekan **💬 Beri masukan**, menulis saran atau masalah, lalu menekan **Kirim**. Tombolnya ada di:
- album acara;
- halaman kamera (di bawah formulir bergabung, dan di layar "acara sudah selesai");
- halaman unduh foto dari QR booth.

Satu perangkat dibatasi 3 masukan per jam agar tidak dibanjiri. Aplikasi ikut mencatat acara, halaman asal, dan jenis perangkat (misalnya "Android · Chrome") untuk membantu menelusuri masalah.

**Admin** menekan **💬 Masukan pengguna** di dasbor. Halamannya berisi daftar masukan, terbaru di atas. Masukan yang belum pernah dilihat di perangkat admin tersebut ditandai garis oranye, dan jumlahnya tampil di tombol dasbor. Semua masukan juga tersimpan di Google Sheet, tab `Feedback`.

## Yang baru di v4: Jenis jatah foto

Di **Pengaturan acara → Jenis jatah foto**, admin bisa memilih:

| Jenis | Cara kerja | Cocok untuk |
|---|---|---|
| **Total selama acara** | Misalnya 15 foto per orang untuk seluruh acara (seperti sebelumnya). | Acara singkat: seminar, kuliah umum |
| **Per hari** | Misalnya 15 foto per orang per hari. Jatah terisi lagi setiap pukul 00.00 WIB. | Acara beberapa hari: pameran, open house, pelatihan |
| **Rol film baru tiap beberapa jam** | Misalnya rol berisi 10 foto, rol baru tiap 3 jam (dihitung dari jam mulai acara). | Acara panjang dalam sehari: workshop, lomba, makrab |
| **Tanpa batas** | Tidak ada batas jumlah foto. | Acara internal kecil |

Di layar kamera peserta:
- Penghitung menyesuaikan jenis jatah: *sisa foto*, *sisa hari ini*, *sisa di rol*, atau *∞ tanpa batas*.
- Saat jatah habis, muncul keterangan kapan jatah berikutnya tersedia (misalnya "Rol baru dalam 1 jam 20 menit lagi").
- Saat rol atau hari baru tiba, **atau saat admin menaikkan jatah**, kamera otomatis memperbarui jatah tanpa perlu memuat ulang halaman, dan muncul animasi **"🎞️ Rol baru!"**.

Admin tetap bisa menaikkan jumlah jatah kapan saja di tengah acara. Perubahan langsung berlaku untuk semua peserta.

Foto yang terkirim terlambat karena sinyal buruk tetap dihitung pada rol atau hari saat foto itu diambil.

## Yang baru di v3: Booth layar sentuh / Android TV

- **Mode booth** untuk layar sentuh atau TV berkamera di lab: pratinjau kamera besar, pilih filter dengan sentuhan, hitung mundur 3–2–1, dan **layar menyala putih sebagai lampu kilat**.
- **QR unduh per foto:** setelah memotret, layar menampilkan QR khusus foto itu. Pengunjung scan dengan HP dan langsung bisa menyimpan fotonya, tanpa perlu bergabung ke acara. Link berlaku 60 hari.
- **Live wall saat tidak dipakai:** layar menampilkan mosaik foto terbaru beserta QR untuk ikut memotret dari HP. Jika album belum dibuka, layar menampilkan pratinjau kamera dan jumlah foto yang sudah diambil, agar kejutan tidak bocor.
- **Pemasangan booth dengan kode 6 angka** dari halaman Kelola. Membuat kode baru otomatis mencabut semua booth lama.
- Booth tidak dibatasi jatah per orang (batas pengaman 600 foto per hari).
- Pustaka QR dan ZIP kini disimpan di dalam aplikasi (`js/vendor/`), tidak bergantung pada CDN yang bisa saja diblokir jaringan kampus.

## Yang baru di v2

- **Album jauh lebih cepat:** daftar foto tampil dulu, thumbnail menyusul bertahap sesuai yang terlihat di layar. Thumbnail langsung disimpan di cache server saat diunggah.
- **Tidak lagi tertahan di "Memuat…"** di iPhone: batas waktu tunggu, coba ulang otomatis, pesan "Server sedang bangun", dan muat ulang otomatis saat Safari memulihkan halaman.
- **Pesan error yang jelas:** jika server mengirim halaman error Google, aplikasi menjelaskan penyebabnya (misalnya "Apps Script perlu izin ulang").
- **Reaksi emoji** pada foto (❤️ 😂 🔥 👏 😮), satu reaksi per peserta per foto.
- **Komentar** antarpeserta, bisa dinyalakan per acara. Disaring dari kata kasar, dibatasi 5 komentar per menit, bisa dilaporkan, dan bisa disembunyikan atau dihapus admin.
- **Unduh foto saya:** peserta menyimpan semua foto miliknya sekaligus (menu bagikan di HP, file ZIP di laptop).
- **Folder Drive (unduh semua)** untuk admin, langsung dari album.
- **Pemanas server (opsional)** agar aplikasi tidak lambat saat pertama dibuka.

## Memperbarui dari versi sebelumnya

(Berlaku juga untuk pembaruan v2–v11 → v12. Kolom `captions`, `captionPresets`, dan `caption` dibuat otomatis. Kolom `accent` dan `coverId` dibuat otomatis; acara lama memakai warna Toska. Sheet `Feedback` dibuat otomatis. Kolom baru seperti `boothPin`, `boothName`, `quotaMode`, `rollHours`, `period`, dan `periodShots` dibuat otomatis. Acara lama otomatis memakai jenis jatah **Total selama acara**.)


1. Apps Script: ganti **seluruh** isi `Code.gs` dengan file baru → **Save**.
2. Jalankan fungsi **`setup`** sekali (tidak menghapus data; hanya memastikan sheet dan kolom baru tersedia, lalu setujui izin jika diminta).
3. **Deploy → Manage deployments** → ikon pensil → Version **New version** → **Deploy**. URL tetap sama.
4. GitHub: unggah ulang **seluruh isi** folder `web/` (timpa file lama). Jangan lupa isi kembali `API_URL` di `js/config.js`.
5. Buka aplikasi di HP. Jika masih tampil versi lama, tutup tab lalu buka lagi.

Sheet `Reactions` dan `Comments` serta kolom `comments` di sheet `Events` dibuat otomatis. Data acara dan foto lama tetap aman.

## Peran

| Peran | Cara masuk | Bisa |
|---|---|---|
| Admin | Buka alamat aplikasi → isi **kata sandi admin** | Membuat, mengubah, mengarsipkan semua acara; melihat album kapan saja; moderasi foto |
| Peserta (mahasiswa, dosen, tamu umum) | Scan QR acara → isi **nama** (+ kode akses jika ada) | Memotret sesuai jatah, melihat album setelah dibuka, memberi reaksi dan komentar, mengunduh foto, melaporkan foto/komentar |

Beberapa orang boleh menjadi admin dengan memakai kata sandi yang sama.

## Isi paket

```
apps-script/Code.gs   backend (ditempel ke Google Apps Script)
web/                  tampilan (diunggah ke GitHub Pages)
  index.html          halaman admin (login kata sandi + daftar acara)
  kelola.html         kelola acara: QR, pengaturan, arsip, moderasi
  acara.html          kamera peserta (tujuan QR)
  album.html          album bersama
  uji-beban.html      alat uji banyak upload serentak (opsional)
  js/config.js        ← satu-satunya file yang perlu diubah
```

**Perkiraan kapasitas:** satu foto sekitar 0,6–1 MB (termasuk thumbnail). 1.000 foto ≈ 1 GB. Gmail gratis memiliki 15 GB yang dipakai bersama Gmail dan Google Foto.

Disarankan memakai akun Google khusus (misalnya `momenti.prodi@gmail.com`) agar mudah diserahterimakan. Aktifkan verifikasi 2 langkah pada akun ini.

---

## Tahap 1 — Buat folder foto di Google Drive

1. Login ke https://drive.google.com dengan akun Google yang akan dipakai.
2. **Baru → Folder** → beri nama `Momen TI`.
3. Buka folder itu, salin **ID folder** dari alamat browser:
   `https://drive.google.com/drive/folders/`**`1AbCdEf...`** ← bagian ini.

Jangan bagikan folder ini ke publik. Aplikasi mengakses foto lewat Apps Script.

## Tahap 2 — Buat project Apps Script

1. Buka https://script.google.com dengan akun yang sama → **New project**.
2. Ganti nama project menjadi `Momen TI Backend`.
3. Hapus isi `Code.gs` bawaan, tempel seluruh isi `apps-script/Code.gs`, lalu **Save** (Ctrl+S).

## Tahap 3 — Isi Script Properties

**Project Settings** (ikon roda gigi) → **Script Properties** → **Add script property**:

| Property | Contoh | Keterangan |
|---|---|---|
| `ROOT_FOLDER_ID` | `1AbCdEf...` | ID folder dari Tahap 1 |
| `ADMIN_PASSWORD` | `Momen-TI-2026!kampus` | Kata sandi admin, **minimal 10 karakter**. Gunakan gabungan huruf, angka, dan simbol |

Klik **Save script properties**. Property `FRONTEND_URL` diisi di Tahap 6.

Kata sandi ini hanya tersimpan di Apps Script, tidak pernah ada di GitHub.

## Tahap 4 — Jalankan setup (sekali saja)

1. Kembali ke **Editor**, pilih fungsi **`setup`** di bagian atas, klik **Run**.
2. **Review permissions** → pilih akun → jika muncul "Google hasn't verified this app", klik **Advanced → Go to Momen TI Backend** → **Allow**. Ini wajar untuk script buatan sendiri.
3. Pada **Execution log** harus muncul alamat Google Sheet database, nama folder foto, dan `Setup selesai`.
   Jika muncul error tentang `ADMIN_PASSWORD`, perpanjang kata sandinya lalu jalankan `setup` lagi.

## Tahap 5 — Deploy (satu kali)

1. **Deploy → New deployment** → ikon roda gigi → **Web app**.
2. Isi: Description `API`, Execute as **Me**, Who has access **Anyone**.
3. **Deploy** → salin **Web app URL** (berakhiran `/exec`).
4. Cek: buka URL itu di browser. Harus tampil teks berisi `"ok":true` dan `API aktif`.

## Tahap 6 — Unggah tampilan ke GitHub Pages

1. Buka `web/js/config.js`, ganti `API_URL` dengan URL dari Tahap 5.
2. Di https://github.com → **New repository** → nama `momen-ti` → **Public** → **Create repository**.
   (Repo publik aman: tidak ada kata sandi atau data di folder `web/`.)
3. Klik **uploading an existing file**, seret **seluruh isi** folder `web/` (termasuk folder `css/` dan `js/`), lalu **Commit changes**.
4. **Settings → Pages** → Source **Deploy from a branch**, Branch **main**, folder **/ (root)** → **Save**.
5. Tunggu 1–2 menit, muat ulang. Alamat situs muncul, misalnya `https://namaakun.github.io/momen-ti/`.
6. Di Apps Script, tambahkan Script Property `FRONTEND_URL` = alamat itu **tanpa garis miring di akhir**: `https://namaakun.github.io/momen-ti`. Alamat ini dipakai untuk link dan QR acara.

Tanpa GitHub pun bisa: folder `web/` bisa ditaruh di hosting statis apa pun yang memakai HTTPS. Isi `FRONTEND_URL` dengan alamat hosting tersebut.

## Tahap 7 — Uji coba

1. Buka alamat GitHub Pages → isi kata sandi admin → **Masuk**.
2. **Buat acara** dengan jam mulai beberapa menit yang lalu, lalu buka halaman **Kelola**.
3. Scan QR dari HP (Android dan iPhone), isi nama, ambil beberapa foto.
4. Pastikan foto muncul di **Lihat album**, di **Folder Drive** acara, dan sebagai baris baru di Google Sheet.
5. Coba juga: kode akses salah, jatah foto habis, laporkan foto, sembunyikan foto dari halaman Kelola.
6. Matikan data seluler sebentar setelah memotret: muncul pesan menunggu, lalu foto terkirim otomatis saat sinyal kembali.

## Tahap 8 — Uji beban (disarankan sebelum acara besar)

1. Buat acara "Uji Beban" (sedang berlangsung, tanpa kode akses, jatah 5).
2. Buka `https://namaakun.github.io/momen-ti/uji-beban.html`, isi kode acara (bagian setelah `?e=` pada link acara) dan jumlah peserta, misalnya 30.
3. Lihat berapa yang berhasil langsung, yang berhasil setelah dicoba ulang, dan waktu tunggunya.
4. Arsipkan acara uji, lalu hapus foldernya di Drive.

Apps Script membatasi sekitar 30 eksekusi bersamaan per akun. Upload yang ditolak karena sibuk dicoba ulang otomatis.

---

## Booth layar sentuh / Android TV

### Menyiapkan layar

Layar interaktif dengan kamera bawaan (misalnya MAXHUB dan sejenisnya) biasanya punya dua kemungkinan sistem:

- **Ada modul Windows (OPS):** gunakan Chrome atau Edge. Ini pilihan paling mudah dan stabil.
  Untuk mode kios layar penuh, buat shortcut Chrome dengan tambahan `--kiosk https://namaakun.github.io/momen-ti/booth.html`.
- **Hanya Android:** gunakan **Chrome** (jika bisa dipasang dari Play Store) atau **Fully Kiosk Browser**. Di Fully Kiosk, nyalakan izin kamera/webcam untuk halaman web, atur Start URL ke alamat booth, dan nyalakan opsi agar layar tidak mati. Browser bawaan layar sering tidak mengizinkan kamera untuk halaman web.

Uji kamera dulu: buka alamat booth, lalu pastikan browser meminta izin kamera dan pratinjau muncul.

### Memasang booth (sekali per perangkat)

1. Admin membuka **Kelola** acara → bagian **Booth layar sentuh / Android TV** → **Aktifkan booth**. Muncul **kode booth** 6 angka.
2. (Opsional) Isi **Nama booth**, misalnya `Booth Lab UI/UX`. Nama ini tampil di bingkai foto dan sebagai nama pemotret di album.
3. Di layar booth, buka `https://namaakun.github.io/momen-ti/booth.html` → izinkan kamera → masukkan kode booth.
4. Booth langsung siap. Perangkat mengingat pemasangannya selama 180 hari.

**Mencabut booth:** di Kelola, tekan **Buat kode baru**. Semua booth yang terpasang otomatis keluar.
**Melepas booth dari satu perangkat:** di layar idle, tekan dan tahan **nama acara** di kiri atas selama 3 detik.

### Cara pakai bagi pengunjung

1. Sentuh layar (atau tekan OK di remote).
2. Pilih filter, tekan tombol bulat oranye.
3. Lihat ke **kamera di bagian atas layar**. Hitung mundur 3–2–1, layar berkedip putih, foto diambil.
4. Scan **QR** di layar dengan kamera HP untuk menyimpan foto. Tekan **Foto lagi** atau tunggu, layar kembali ke live wall otomatis.

Kontrol remote/keyboard: **OK/Enter** = mulai & ambil foto, **← →** = ganti filter, **Back/Esc** = kembali.

### Tips penempatan

- Kamera ada di atas layar. Tempelkan tanda kecil "Lihat ke sini ⬆" di dekat kamera.
- Tandai posisi berdiri di lantai (sekitar 1,5–2 meter dari layar) agar wajah pas di bingkai persegi.
- Hindari lampu terang atau jendela tepat di belakang pengunjung.
- Pasang tanda "Area foto Momen TI". Saat layar idle dan album belum dibuka, pratinjau kamera tampil di layar, tetapi **foto hanya diambil saat tombol ditekan**.

### Jadwal booth

Booth mengikuti jadwal acara: tombol berfoto hanya muncul saat acara sedang berlangsung. Untuk booth lab yang dipakai berminggu-minggu, buat acara dengan rentang waktu panjang (misalnya satu semester).

## Fitur album

**Unduh satu foto:** ketuk foto → **Unduh**. Di HP muncul menu bagikan (pilih *Simpan Gambar* / simpan ke galeri / WhatsApp). Di laptop, file langsung terunduh. Tombol aktif setelah foto resolusi penuh selesai dimuat.

**Unduh foto saya:** di atas album, tekan **Unduh foto saya (n)**. Aplikasi menyiapkan semua foto milik peserta, lalu tombol berubah menjadi **Simpan n foto**. Ketuk sekali lagi untuk menyimpan. (Browser HP mewajibkan ketukan kedua sebelum membuka menu bagikan.)

**Unduh semua (admin):** tombol **Folder Drive (unduh semua)** di album membuka folder acara di Google Drive. Pilih semua file lalu unduh, Google Drive akan mengemasnya menjadi ZIP. Jika ingin peserta bisa mengunduh semua foto setelah acara, admin bisa membagikan link folder ini (akses *Pelihat*).

**Reaksi:** ketuk emoji di bawah foto; ketuk emoji yang sama untuk membatalkan. Hanya peserta yang sudah bergabung ke acara yang bisa memberi reaksi.

**Komentar:** nyalakan lewat **Pengaturan acara → Izinkan peserta berkomentar di album**. Aturannya:
- maksimal 200 karakter dan 5 komentar per menit per peserta;
- komentar berisi kata kasar ditolak. Daftar kata bisa ditambah lewat Script Property `BAD_WORDS` (pisahkan koma);
- peserta bisa melaporkan komentar; setelah 3 laporan komentar disembunyikan otomatis;
- admin mengelola komentar di halaman **Kelola → Komentar**, atau langsung di album (Sembunyikan/Hapus).

Disarankan menyalakan komentar hanya untuk acara internal yang pesertanya saling kenal.

## Pemanas server (opsional)

Jika tidak dipakai beberapa menit, Apps Script perlu 1–3 detik untuk "bangun" saat dibuka lagi. Pemanas menjalankan pemeriksaan ringan setiap 5 menit, **hanya ketika ada acara yang sedang berlangsung** (mulai 1 jam sebelum hingga 3 jam setelah acara).

- Menyalakan: di editor Apps Script pilih fungsi **`setupKeepWarm`** → **Run** → setujui izin.
- Mematikan: jalankan **`removeKeepWarm`**.

Pemanas membantu mengurangi jeda, tetapi tidak menjamin server selalu siap. Pemakaian kuotanya sangat kecil.

## Pengelolaan sehari-hari

**Mengganti kata sandi admin:** ubah `ADMIN_PASSWORD` di Script Properties. Semua admin yang sedang login otomatis keluar dan harus masuk dengan kata sandi baru. Lakukan ini jika kata sandi bocor atau ada admin yang tidak lagi bertugas.

**Masa login admin:** 14 hari per perangkat. Setelah itu admin diminta memasukkan kata sandi lagi.

**Keamanan login:** setelah 20 kali salah kata sandi, login admin dikunci 15 menit.

**Kode akses acara:** gunakan untuk acara tertutup (misalnya hanya peserta kelas tertentu). Bagikan kodenya bersama QR. Tanpa kode akses, siapa pun yang memegang link atau QR bisa ikut memotret.

**Jatah foto peserta:** dihitung per perangkat. Peserta yang menghapus data browser lalu bergabung lagi akan mendapat jatah baru. Untuk acara internal ini umumnya bisa diterima.

## Cara memperbarui aplikasi

**Jika `Code.gs` diubah:** Save → **Deploy → Manage deployments** → pilih deployment → ikon pensil → Version **New version** → **Deploy**. URL tetap sama. Jangan memakai "New deployment" untuk pembaruan.

**Jika file di `web/` diubah:** unggah ulang ke GitHub, lalu naikkan nomor versi di HTML (`?v=1` menjadi `?v=2`) agar HP peserta tidak memakai file lama dari cache.

Hindari memperbarui aplikasi pada hari acara.

## Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| "Aplikasi belum dikonfigurasi" | `API_URL` di `js/config.js` belum diisi, atau file lama masih ter-cache (Ctrl+F5). |
| "Tidak bisa terhubung ke server" | `API_URL` salah, atau deployment bukan akses **Anyone**. |
| "ADMIN_PASSWORD belum diisi" | Isi Script Property `ADMIN_PASSWORD`. |
| "Terlalu banyak percobaan kata sandi salah" | Tunggu 15 menit. Jika sering terjadi padahal tidak ada yang salah memasukkan, ganti kata sandi. |
| Link/QR acara mengarah ke alamat yang salah | `FRONTEND_URL` belum diisi atau tidak sama dengan alamat GitHub Pages. |
| Kamera tidak terbuka | Izinkan kamera di pengaturan situs browser. Di iPhone gunakan Safari. |
| Upload sering menunggu | Apps Script sedang ramai. Foto tetap tersimpan di HP dan dikirim ulang otomatis. |
| "Apps Script perlu izin ulang" | Jalankan fungsi `setup` di editor dan setujui izin, lalu Deploy → Manage deployments → New version. |
| "Server mengirim balasan yang tidak dikenal (…)" | Teks di dalam tanda kutip adalah judul halaman error dari Google. Buka Apps Script → **Executions** untuk melihat rinciannya. |
| Album lama terbuka pertama kali | Server sedang "bangun". Tunggu beberapa detik, atau nyalakan pemanas server. |
| Tombol Unduh bertuliskan "Memuat foto…" | Foto resolusi penuh sedang diambil dari Drive. Tunggu beberapa detik. |
| Error lain | Apps Script → **Executions** menampilkan catatan error tiap permintaan. |

## Data & privasi

- Foto tersimpan di `Momen TI / 2026 / 2026-10-25_nama-acara-xxxxxx/`, thumbnail di subfolder `_thumbnail`.
- Folder dan file **tidak dibagikan publik**. Peserta hanya bisa melihat foto lewat aplikasi, setelah bergabung ke acara dan setelah album dibuka.
- Data peserta di Google Sheet hanya berisi nama yang mereka ketik. Tidak ada email atau data akun.
- Reaksi tersimpan di sheet `Reactions`, komentar di sheet `Comments` (termasuk yang dihapus, ditandai `deleted`), sehingga mudah ditelusuri bila ada masalah.
- Foto yang dihapus dari halaman Kelola masuk **sampah Drive** dan bisa dipulihkan selama 30 hari.
- Halaman kamera menampilkan pemberitahuan bahwa foto tersimpan di album dan Google Drive pengelola.
