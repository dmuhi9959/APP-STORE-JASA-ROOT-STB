# Agung AI — aplikasi chat AI (web)

Aplikasi chat bergaya ChatGPT yang **100% statis** (HTML/CSS/JS, tanpa build, tanpa server).
Bisa langsung dibuka di browser, dipasang sebagai PWA, atau di-hosting gratis di GitHub Pages.

Fitur:

- Sidebar riwayat percakapan (tersimpan di browser, ada pencarian, ganti nama, hapus)
- Streaming jawaban kata per kata + tombol **Hentikan**
- Render Markdown: tebal/miring, daftar, tabel, kutipan, dan blok kode dengan tombol **Salin**
- Salin pesan, **Ulangi** jawaban, ekspor chat ke Markdown
- Tema gelap/terang, responsif di HP, PWA (bisa dibuka offline)
- Pengaturan penyedia: OpenAI, OpenRouter, Groq, DeepSeek, Gemini, Mistral, Ollama, LM Studio, atau kustom
- **Mode demo**: tanpa API key aplikasi tetap jalan dan menjelaskan cara mengaktifkan AI

---

## 1. Cara membuka

Buka `index.html` langsung di browser sudah bisa (mode demo).
Untuk PWA / service worker, jalankan server lokal:

```powershell
cd "C:\Users\USER\Documents\Default Project\aichat"
npx serve . -l 8099
# atau
python -m http.server 8099
```

Lalu buka <http://localhost:8099>.

## 2. Mengaktifkan AI sungguhan

1. Klik ikon **gerigi** (Pengaturan) di kanan atas.
2. Pilih penyedia, misalnya:
   - **OpenRouter** — banyak model gratis (nama model berakhiran `:free`), daftar di <https://openrouter.ai/keys>
   - **Groq** — cepat & ada kuota gratis, <https://console.groq.com/keys>
   - **Gemini** — <https://aistudio.google.com/apikey>
   - **Ollama** — jalankan `ollama serve` di komputer, tanpa API key
3. Tempel **API key**, klik **Tes koneksi**, lalu **Simpan**.
4. Kirim pesan — jawaban sekarang datang dari model AI.

> Catatan: aplikasi memanggil API langsung dari browser. Penyedia harus mengizinkan CORS.
> OpenAI, OpenRouter, Groq, DeepSeek, Gemini, Mistral, Ollama, dan LM Studio umumnya bisa.

## 3. Hosting di GitHub Pages

Pilihan A — subfolder di repo yang sudah ada:

1. Salin seluruh isi folder `aichat/` ke `docs/ai/` di repo.
2. Buka `https://<user>.github.io/<repo>/ai/`.

Pilihan B — repo terpisah:

1. Buat repo baru, upload isi folder ini (langsung di root).
2. Settings → Pages → **Deploy from a branch** → `main` → `/ (root)`.

## 4. Keamanan API key

- Key disimpan di `localStorage` browser dan hanya dikirim ke **Base URL** yang diisi.
- Jangan pakai aplikasi ini untuk membagikan key ke publik. Untuk pemakaian publik,
  buat proxy kecil (Cloudflare Worker / Vercel) yang menyimpan key di server,
  lalu isi Base URL ke proxy tersebut tanpa key.

## 5. Struktur file

```
aichat/
├── index.html            # kerangka UI
├── styles.css            # tema gelap/terang + responsif
├── app.js                # logika chat, penyimpanan, API, pengaturan
├── markdown.js           # renderer Markdown mini (aman, tanpa dependensi)
├── sw.js                 # service worker (cache offline)
├── manifest.webmanifest  # metadata PWA
├── icon.svg / icon-*.png # ikon
└── README.md
```

## 6. Pintasan

| Tombol | Fungsi |
| --- | --- |
| `Enter` | Kirim pesan |
| `Shift` + `Enter` | Baris baru |
| `Ctrl`/`Cmd` + `K` | Cari chat |
| `Ctrl`/`Cmd` + `Shift` + `O` | Chat baru |
| `Esc` | Tutup pengaturan / sidebar |

---

Dibuat untuk dipakai bebas. Tidak ada data yang dikirim ke pihak ketiga selain penyedia API yang Anda pilih sendiri.
