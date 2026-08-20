# Deploy Sahih ke VPS Hostinger dengan IP

Deployment menjalankan `frontend` (Nginx) pada port publik 8080 dan `api`
(FastAPI serta TensorFlow) pada jaringan internal Docker. Website dapat dibuka
melalui `http://187.52.122.64:8080`.

## Deploy langsung dari Docker Manager

Setelah seluruh perubahan terbaru sudah di-push ke branch `main` GitHub, buka
Docker Manager > Compose > Compose from URL. Gunakan URL langsung berikut:

```text
https://raw.githubusercontent.com/dapakyuu/DigitalForensik/refs/heads/main/docker-compose.hostinger.yml
```

Compose khusus Hostinger menggunakan repository GitHub sebagai remote build
context, sehingga Docker dapat mengambil Dockerfile, source, dan model yang
dibutuhkan. Masukkan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` melalui
pengaturan environment proyek Docker Manager. Jangan menuliskan service-role
key di GitHub.

URL halaman GitHub yang mengandung `/blob/` ditujukan untuk browser. Untuk
Compose from URL, gunakan URL `raw.githubusercontent.com` di atas.

## 1. Siapkan source code di VPS

Gunakan Browser Terminal Hostinger atau SSH:

```bash
cd /opt
sudo git clone URL_REPOSITORY_ANDA sahih
cd /opt/sahih
```

Jika source tidak disimpan di Git, unggah seluruh folder ke `/opt/sahih`.

## 2. Buat environment backend

```bash
cd /opt/sahih
sudo cp .env.example .env
sudo nano .env
```

Isi dengan konfigurasi sebenarnya:

```env
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_SUPABASE
```

Service-role key hanya boleh berada di `.env` pada server. Jangan
memasukkannya ke JavaScript atau repository Git.

## 3. Build dan jalankan

```bash
cd /opt/sahih
sudo docker compose up -d --build
```

Build pertama dapat memerlukan waktu cukup lama karena TensorFlow berukuran
besar.

## 4. Periksa status

```bash
sudo docker compose ps
sudo docker compose logs -f api
```

Keluar dari tampilan log dengan `Ctrl+C`; container tetap berjalan.

## 5. Buka firewall

Tambahkan aturan inbound TCP port `8080` pada Firewall Hostinger. Jika UFW
aktif di Ubuntu, jalankan:

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

Kemudian buka:

```text
http://187.52.122.64:8080
```

## 6. Konfigurasi redirect Supabase

Di Supabase Dashboard, buka Authentication > URL Configuration, lalu tambahkan:

```text
http://187.52.122.64:8080/**
```

Login melalui HTTP berbasis IP hanya disarankan untuk pengujian sementara.
Gunakan domain dan HTTPS sebelum website dibuka untuk pengguna umum.

## Pemeliharaan

```bash
# Semua log
sudo docker compose logs -f

# Restart
sudo docker compose restart

# Update setelah git pull
sudo docker compose up -d --build

# Hentikan aplikasi
sudo docker compose down
```
