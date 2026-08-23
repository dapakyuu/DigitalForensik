# Auto-deploy Forensa dengan GitHub Actions

Workflow `.github/workflows/deploy-hostinger.yml` menjalankan deployment setiap
ada push ke branch `main`. Deployment juga dapat dijalankan manual melalui tab
Actions dengan tombol **Run workflow**.

Workflow menggunakan action resmi `hostinger/deploy-on-vps@v2` dan memperbarui
project Docker Manager bernama `digitalforensik`.

## 1. Buat Hostinger API key

Di hPanel Hostinger buka **Profile/Account > API**, lalu buat API key. Salin
nilainya ketika ditampilkan dan jangan menyimpannya di repository.

## 2. Tambahkan GitHub Actions secret

Di repository GitHub buka:

```text
Settings > Secrets and variables > Actions > Secrets
```

Tambahkan repository secrets berikut:

| Name | Value |
|---|---|
| `HOSTINGER_API_KEY` | API key dari hPanel Hostinger |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key Supabase |

Service-role key tidak boleh dimasukkan ke source code, workflow secara langsung,
atau file Compose.

## 3. Tambahkan GitHub Actions variable

Masih pada halaman **Secrets and variables > Actions**, buka tab **Variables**
dan tambahkan:

| Name | Value |
|---|---|
| `HOSTINGER_VM_ID` | `1918012` |

VM ID berasal dari hostname VPS `srv1918012.hstgr.cloud`.

## 4. Pastikan nama project sama

Workflow menggunakan:

```yaml
project-name: digitalforensik
```

Nama ini harus sama dengan project yang sudah ada di Docker Manager. Kecocokan
terlihat dari nama container saat ini, yaitu `digitalforensik-frontend-1` dan
`digitalforensik-api-1`. Jangan mengganti project name jika ingin memperbarui
project yang sama.

## 5. Aktifkan deployment pertama

Commit dan push workflow serta Compose terbaru ke `main`. Push tersebut akan
memicu workflow secara otomatis. Pantau melalui:

```text
Repository GitHub > Actions > Deploy Forensa to Hostinger VPS
```

Deployment pertama setelah workflow dibuat dapat membutuhkan waktu lebih lama
karena image TensorFlow dibangun ulang.

## Cara kerja versi commit

Workflow mengirimkan SHA commit sebagai:

```text
DEPLOY_COMMIT=${{ github.sha }}
```

Compose menggunakannya pada remote build context:

```yaml
context: https://github.com/dapakyuu/DigitalForensik.git#${DEPLOY_COMMIT:-main}
```

Dengan demikian, API dan frontend selalu dibangun dari commit yang memicu
workflow, bukan dari referensi `main` yang mungkin masih menggunakan cache. Jika
Compose dijalankan manual tanpa `DEPLOY_COMMIT`, nilai fallback-nya tetap
`main`.

## Memeriksa hasil deployment

Setelah workflow menyatakan deployment berhasil, Hostinger mungkin masih
melakukan build secara asynchronous. Periksa Docker Manager hingga container
API dan frontend kembali berstatus running. Log juga dapat diperiksa melalui
Browser Terminal:

```bash
docker ps
docker logs digitalforensik-api-1 --tail 100
docker logs digitalforensik-frontend-1 --tail 100
```

Uji versi terbaru melalui `https://forensa.tech`. Jika perubahan CSS atau
JavaScript belum terlihat, lakukan hard refresh atau buka incognito karena Nginx
memberikan cache tujuh hari untuk static assets.

## Menjalankan deployment manual

Buka workflow **Deploy Forensa to Hostinger VPS** pada tab Actions, pilih **Run
workflow**, pilih branch `main`, lalu jalankan. Cara ini berguna untuk mengulang
deployment tanpa membuat commit kosong.

## Jika workflow gagal

- `401` atau `403`: periksa `HOSTINGER_API_KEY` dan hak aksesnya.
- VM tidak ditemukan: periksa variable `HOSTINGER_VM_ID=1918012`.
- Environment kosong: pastikan ketiga repository secrets/variables telah dibuat
  dengan nama yang sama persis.
- Project baru muncul: pastikan `project-name` tetap `digitalforensik`.
- Build gagal mengambil repository: pastikan repository public atau deploy key
  untuk repository private sudah tersedia pada VPS.
- Domain gagal: periksa log Traefik dan pastikan container frontend berstatus
  healthy/running.
