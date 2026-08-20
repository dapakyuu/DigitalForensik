# Sahih — Verifikasi Dokumen Pendidikan Berbasis Byte Stream

Sahih adalah prototipe aplikasi web untuk membantu memeriksa keaslian dokumen
pendidikan dalam format PDF. Sistem menggunakan model **Bidirectional Long
Short-Term Memory (BiLSTM)** untuk mempelajari pola sekuensial pada byte
stream dokumen dan mengklasifikasikannya sebagai dokumen asli atau dokumen yang
terindikasi telah dimodifikasi.

Selain prediksi model, Sahih menyajikan informasi forensik pendukung seperti
hash SHA-256, metadata PDF, riwayat revisi, status enkripsi, tanda tangan
digital, permission, serta indikasi apakah dokumen merupakan PDF digital, hasil
scan, atau campuran.

> Sahih merupakan alat pemeriksaan awal. Hasil prediksi AI bukan keputusan
> forensik final dan tetap perlu dikonfirmasi melalui pemeriksaan lanjutan.

## Latar Belakang

Perubahan pada dokumen PDF tidak selalu dapat dikenali melalui tampilan visual.
Proses penyuntingan metadata, kompresi, pencetakan ulang, maupun perubahan isi
dapat menghasilkan pola berbeda pada struktur biner dokumen. Penelitian ini
memanfaatkan urutan byte PDF agar model dapat mempelajari pola tersebut tanpa
bergantung pada ekstraksi teks, OCR, atau tata letak visual.

Pendekatan byte stream juga memungkinkan sistem menganalisis dokumen dari sisi
struktur data digitalnya. Informasi tersebut kemudian dilengkapi dengan
pemeriksaan metadata agar hasil yang diberikan kepada pengguna lebih mudah
ditelusuri dan diinterpretasikan.

## Representasi Byte Stream

Dokumen dibaca dalam mode biner dan dikonversi menjadi urutan bilangan bulat
menggunakan pendekatan berikut:

```python
with open(file_path, "rb") as file:
    byte_values = list(file.read(10000))
```

Setiap elemen pada `byte_values` merepresentasikan satu byte asli dengan nilai
antara `0` dan `255`. Pendekatan ini mempertahankan urutan serta distribusi byte
asli dokumen.

Representasi tersebut dipilih dibandingkan konversi berikut:

```python
character_values = [ord(character) for character in str(file.read())]
```

Konversi melalui `str()` tidak lagi memproses byte asli secara langsung.
Representasi tersebut menambahkan karakter seperti `b`, tanda petik,
backslash, `x`, dan digit heksadesimal. Satu byte non-printable juga dapat
berubah menjadi beberapa karakter sehingga panjang dan hubungan sekuensial
data ikut berubah.

Pengujian pada sampel dokumen menghasilkan rentang Shannon entropy sebagai
berikut:

| Representasi | Rentang entropy |
|---|---:|
| Byte list | 6,9945–7,9712 bit |
| Character token dari `str()` dan `ord()` | 4,0342–4,6348 bit |

Nilai entropy byte list yang lebih tinggi menunjukkan bahwa keragaman informasi
biner lebih banyak dipertahankan. Meskipun entropy tinggi tidak secara otomatis
menjamin akurasi model yang lebih baik, hasil tersebut mendukung penggunaan
byte list karena representasinya tetap setia terhadap data asli.

## Dataset dan Pembagian Data

Penelitian menggunakan **2.286 dokumen PDF** yang terdiri dari dokumen original
dan dokumen hasil modifikasi. Dataset dibagi menjadi:

| Bagian | Jumlah dokumen | Proporsi |
|---|---:|---:|
| Training | 1.828 | ±80% |
| Validation | 228 | ±10% |
| Testing | 230 | ±10% |

Pembagian dilakukan menggunakan `GroupShuffleSplit` berdasarkan `group_id`.
Dokumen asli dan versi modifikasinya dijaga agar tidak tersebar pada subset yang
berbeda. Pemeriksaan menunjukkan tidak terdapat overlap kelompok antara data
training, validation, dan testing.

## Model BiLSTM

Model menerima sekuens dengan panjang maksimum 10.000 byte. Arsitektur yang
digunakan terdiri dari:

1. Input sekuens byte.
2. Embedding dengan vocabulary 257 dan dimensi 128.
3. Bidirectional LSTM 128 unit dengan keluaran sekuens.
4. Dropout 0,3.
5. Bidirectional LSTM 64 unit.
6. Batch normalization.
7. Dropout 0,4.
8. Dense 64 unit dengan aktivasi ReLU.
9. Dropout 0,3.
10. Dense satu unit dengan aktivasi sigmoid.

Model dilatih sebagai klasifikasi biner menggunakan binary cross-entropy dan
optimizer Adam. Nilai keluaran sigmoid diperlakukan sebagai probabilitas kelas
dokumen termodifikasi.

## Hasil Evaluasi

BiLSTM memperoleh akurasi **85,22%** pada 230 dokumen pengujian yang
seimbang antara kelas original dan modified.

| Kelas | Precision | Recall | F1-score | Support |
|---|---:|---:|---:|---:|
| Original | 0,78 | 0,99 | 0,87 | 115 |
| Modified | 0,99 | 0,71 | 0,83 | 115 |
| Macro average | 0,88 | 0,85 | 0,85 | 230 |
| Weighted average | 0,88 | 0,85 | 0,85 | 230 |

Precision kelas modified sebesar 0,99 menunjukkan bahwa hampir seluruh dokumen
yang ditandai sebagai modified memang berasal dari kelas tersebut. Namun,
recall sebesar 0,71 menunjukkan bahwa sebagian dokumen termodifikasi masih
diklasifikasikan sebagai original. Kondisi ini menjadi fokus pengembangan model
selanjutnya.

## Fitur Aplikasi

- Landing page yang menjelaskan tujuan dan cara kerja sistem.
- Verifikasi PDF tanpa login untuk pengguna publik.
- Registrasi, login, reset kata sandi, dan pengelolaan profil.
- Dashboard ringkasan hasil verifikasi pengguna.
- Upload PDF melalui pemilih file atau drag-and-drop.
- Klasifikasi dokumen menjadi `ASLI`, `PALSU`, atau `PERLU REVIEW`.
- Penyajian nilai keyakinan prediksi.
- Perhitungan hash SHA-256 dokumen.
- Ekstraksi metadata utama PDF.
- Pemeriksaan enkripsi dan permission dokumen.
- Deteksi tanda tangan digital, JavaScript, embedded file, serta anotasi.
- Identifikasi PDF digital, hasil scan, atau campuran.
- Penyimpanan riwayat untuk pengguna yang telah login.
- Halaman detail dan laporan hasil pemeriksaan.
- Dukungan container melalui Docker dan reverse proxy Nginx.

## Alur Verifikasi

```text
Dokumen PDF
    │
    ├── Validasi format
    ├── Pembacaan byte stream
    ├── Normalisasi panjang sekuens
    ├── Inferensi BiLSTM
    ├── Ekstraksi metadata PDF
    ├── Pemeriksaan karakteristik scan/digital
    ├── Perhitungan SHA-256
    │
    └── Hasil klasifikasi dan informasi forensik
```

Pengguna tanpa akun dapat menjalankan pemeriksaan tanpa menyimpan hasil ke
riwayat. Untuk pengguna yang telah login, hasil analisis dan metadata dokumen
disimpan agar dapat ditampilkan kembali melalui dashboard.

## Arsitektur Sistem

```text
Browser
   │
   ▼
Nginx / Frontend Statis
   │
   ▼
FastAPI
   ├── Model BiLSTM (TensorFlow/Keras)
   ├── Analisis byte stream
   ├── Ekstraksi metadata PDF
   └── Deteksi scan atau PDF digital
   │
   ▼
Supabase
   ├── Authentication
   ├── Profil pengguna
   ├── Riwayat verifikasi
   └── Metadata dokumen
```

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Model AI | TensorFlow, Keras, BiLSTM |
| Backend | Python, FastAPI, Uvicorn |
| Analisis PDF | PyPDF, PyMuPDF |
| Frontend | HTML, CSS, JavaScript |
| Autentikasi dan data | Supabase |
| Web server | Nginx |
| Container | Docker, Docker Compose |

## Struktur Repositori

```text
.
├── LSTM_Digital_Forensik.ipynb    # Eksperimen dan evaluasi model
├── best_model_pure_bilstm.keras   # Model BiLSTM
├── main.py                        # API dan proses verifikasi
├── requirements.txt               # Dependensi backend
├── index.html                     # Landing page publik
├── landing.js                     # Verifikasi publik
├── dashboard.html                 # Dashboard pengguna
├── upload.html                    # Upload pengguna terautentikasi
├── riwayat.html                   # Riwayat pemeriksaan
├── detail.html                    # Detail hasil
├── profil.html                    # Profil pengguna
├── script.js                      # Autentikasi dan data dashboard
├── styles.css                     # Tampilan aplikasi
├── supabase-config.js             # Konfigurasi client Supabase
├── nginx.conf                     # Reverse proxy frontend dan API
├── Dockerfile.api                 # Container backend
├── Dockerfile.frontend            # Container frontend
└── docker-compose.yml             # Orkestrasi layanan
```

## Status

Proyek ini merupakan prototipe penelitian dan masih berada dalam tahap
pengembangan serta evaluasi. Sistem tidak dimaksudkan untuk menggantikan
verifikasi resmi oleh institusi penerbit atau pemeriksa forensik digital.
