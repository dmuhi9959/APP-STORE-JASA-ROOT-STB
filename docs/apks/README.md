# Folder APK lokal

Taruh file `.apk` di sini **hanya kalau kamu meng-host sendiri** (misalnya lewat
`node tools/serve.mjs` atau menyalin folder `docs/` ke hosting).

Kalau memakai GitHub Releases, file APK disimpan di sana dan `catalog.json`
akan menunjuk ke URL `https://github.com/<user>/<repo>/releases/download/apks/...`
— jadi folder ini tidak perlu diisi.

Contoh entri katalog untuk APK lokal:

```json
{
  "id": "com.contoh.app",
  "name": "Contoh App",
  "packageName": "com.contoh.app",
  "version": "1.0",
  "category": "Tools",
  "description": "Deskripsi aplikasi.",
  "apk": "apks/contoh.apk",
  "icon": "icons/com.contoh.app.png",
  "sizeBytes": 1234567,
  "updated": "2026-10-30",
  "minSdk": 21,
  "arch": "universal"
}
```

Path `apk` boleh relatif (terhadap `catalog.json`) atau URL penuh.
