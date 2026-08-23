# Memperbarui Deployment Forensa ke `forensa.tech`

Panduan ini digunakan untuk memperbarui proyek Forensa yang **sudah berjalan**
di Hostinger Docker Manager. Website akan tersedia melalui:

```text
https://forensa.tech
https://www.forensa.tech
```

Konfigurasi frontend tetap menggunakan `/api/verify/`. Tidak perlu menuliskan
domain atau IP ke dalam `landing.js` maupun `upload.html`.

## 1. Push perubahan terbaru ke GitHub

Pastikan branch `main` repository berisi seluruh perubahan, termasuk:

```text
docker-compose.hostinger.yml
Dockerfile.api
Dockerfile.frontend
nginx.conf
assets/logo.png
```

Docker Manager membangun image dari branch `main`, sehingga perubahan lokal
yang belum di-push tidak akan masuk ke VPS.

## 2. Buat DNS record

Di hPanel buka **Domains > forensa.tech > DNS / Nameservers**. Hapus record A,
AAAA, atau CNAME lama untuk `@` dan `www` yang mengarah ke layanan lain, lalu
buat:

| Type | Name | Target | TTL |
|---|---|---|---|
| A | `@` | `187.52.122.64` | Default |
| A | `www` | `187.52.122.64` | Default |

Jangan menghapus record MX/TXT jika domain juga digunakan untuk email. Propagasi
DNS dapat membutuhkan waktu hingga 24 jam.

Periksa hasil DNS:

```bash
nslookup forensa.tech
nslookup www.forensa.tech
```

Keduanya harus menghasilkan `187.52.122.64`.

## 3. Buat snapshot VPS

Di hPanel buka **VPS > Manage > Snapshots & Backups**, lalu buat snapshot sebelum
mengubah jaringan Docker.

## 4. Pastikan Traefik tersedia

Di **Docker Manager > Catalog**, deploy template Traefik resmi Hostinger jika
belum ada. Setelah Traefik berjalan, buka Browser Terminal dan periksa jaringan:

```bash
docker network ls
```

Konfigurasi aplikasi mengharapkan external network bernama:

```text
traefik-proxy
```

Jika template Hostinger membuat nama lain, samakan nilai `traefik-proxy` pada
bagian `networks` dan label `traefik.docker.network` di
`docker-compose.hostinger.yml` dengan nama jaringan tersebut.

## 5. Perbarui proyek yang sudah berjalan

Di hPanel buka **VPS > Docker Manager > Projects**, lalu:

1. Pilih proyek Forensa yang sudah berjalan.
2. Klik **Manage** dan buka **YAML editor**.
3. Ganti konfigurasi proyek dengan isi terbaru `docker-compose.hostinger.yml`.
4. Pastikan environment variables lama tidak hilang:

   ```env
   SUPABASE_URL=https://PROJECT_ID.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_SUPABASE
   ```

5. Klik **Deploy/Redeploy**.

Jika Docker Manager mendukung pembaruan sumber Compose URL, gunakan:

```text
https://raw.githubusercontent.com/dapakyuu/DigitalForensik/refs/heads/main/docker-compose.hostinger.yml
```

Jangan membuat proyek kedua dengan port 8080 selama proyek lama masih aktif,
karena akan menimbulkan konflik port. Perbarui proyek yang sama atau hentikan
proyek lama terlebih dahulu.

Build backend dapat berlangsung beberapa menit karena TensorFlow dan model AI.
Container frontend baru dijalankan setelah health check API berhasil.

## 6. Buka firewall HTTP dan HTTPS

Tambahkan inbound TCP port `80` dan `443` pada Firewall VPS Hostinger. Jika UFW
aktif di Ubuntu:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

Jangan menutup port SSH `22`.

## 7. Verifikasi container dan SSL

Periksa status dan log melalui Docker Manager. Dari Browser Terminal, pemeriksaan
tambahan dapat dilakukan dengan:

```bash
docker ps
docker logs NAMA_CONTAINER_FRONTEND --tail 100
docker logs NAMA_CONTAINER_API --tail 100
```

Setelah DNS telah mengarah ke VPS, tunggu beberapa menit agar Traefik meminta
sertifikat Let’s Encrypt. Uji melalui jendela incognito:

```text
https://forensa.tech
https://www.forensa.tech
```

Pastikan `http://forensa.tech` dialihkan ke HTTPS dan browser menampilkan
sertifikat yang valid.

Port `8080` masih dipertahankan sementara sehingga versi baru dapat diperiksa
melalui `http://187.52.122.64:8080` jika routing domain bermasalah.

## 8. Perbarui Supabase Authentication

Di Supabase Dashboard buka **Authentication > URL Configuration**.

Atur Site URL:

```text
https://forensa.tech
```

Tambahkan Redirect URLs:

```text
https://forensa.tech/**
https://www.forensa.tech/**
http://127.0.0.1:5500/**
http://localhost:5500/**
```

URL lokal dapat dipertahankan untuk development. Setelah domain stabil, URL
redirect berbasis IP lama dapat dihapus.

## 9. Pengujian aplikasi

Uji seluruh alur berikut:

- Landing page, logo, CSS, dan JavaScript termuat.
- Upload publik dapat menghasilkan analisis.
- Signup, login, logout, dan reset password bekerja.
- Link email autentikasi kembali ke `forensa.tech`.
- Upload pengguna login tersimpan ke riwayat.
- Dashboard, detail, profil, dan laporan dapat dibuka.
- `https://forensa.tech/api/verify/` dapat menerima request POST dari web.
- HTTP dialihkan ke HTTPS.

## 10. Tutup akses IP setelah domain stabil

Setelah semua pengujian berhasil, hapus bagian berikut dari service `frontend`
pada `docker-compose.hostinger.yml`:

```yaml
ports:
  - "8080:80"
```

Push perubahan, lalu redeploy proyek yang sama. Hapus juga aturan inbound 8080
dari Firewall Hostinger. Jika sebelumnya dibuka melalui UFW:

```bash
sudo ufw delete allow 8080/tcp
```

Setelah langkah ini, akses publik hanya melalui HTTPS dan Traefik.

## Pemulihan jika pembaruan gagal

Selama port 8080 masih dipertahankan, periksa versi aplikasi melalui
`http://187.52.122.64:8080`. Jika container gagal dibangun, buka build log di
Docker Manager, pastikan model `.keras` tersedia di GitHub, periksa environment
variables, dan pastikan external network Traefik menggunakan nama yang benar.
