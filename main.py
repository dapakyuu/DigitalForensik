from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from supabase import create_client, Client
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import numpy as np
import hashlib
import os

load_dotenv()
app = FastAPI(title="Gateway Verifikasi Dokumen Akademik AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "model_verifikasi_lstm.keras"
MAX_LEN = 10000

if not os.path.exists(MODEL_PATH):
    model = None
    raise FileNotFoundError(f"Model tidak ditemukan di path: {MODEL_PATH}")
else:
    model = load_model(MODEL_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY")

if not SUPABASE_URL or not SUPABASE_API_KEY:
    raise EnvironmentError("SUPABASE_URL dan SUPABASE_API_KEY harus diset sebagai environment variable.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

@app.post("/api/verify/")
async def verify_document(file: UploadFile = File(...), user_id: str = Form(...)):
    if file.content_type not in ["application/pdf"]:
        raise HTTPException(status_code=400, detail="File harus berupa PDF.")
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Kesalahan Ekstensi: Format file harus .pdf")
    
    if model is None:
        raise HTTPException(status_code=500, detail="Model verifikasi belum dimuat. Silakan periksa konfigurasi server.")
    
    try:
        file_bytes = await file.read()
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        # mock_probability = 0.85
        # status = "Indikasi Palsu" if mock_probability < 0.5 else "Indikasi Asli"

        byte_array = list(file_bytes)
        if len(byte_array) > MAX_LEN:
            half_len = MAX_LEN // 2
            head_bytes = byte_array[:half_len]
            tail_bytes = byte_array[-half_len:]
            processed_bytes = head_bytes + tail_bytes
        else:
            processed_bytes = byte_array

        input_data = pad_sequences([processed_bytes], maxlen=MAX_LEN, padding='pre', truncating='pre')
        prediction = model.predict(input_data)

        probability_score = float(prediction[0][0])

        if probability_score > 0.5:
            status = "PALSU"
        elif probability_score < 0.5:
            status = "ASLI"
        else:
            status = "PERLU_REVIEW"
        
        prediction_data = {
            "user_id": user_id,
            "file_name": file.filename,
            "file_type": file.content_type,
            # "hash_sha256": file_hash,
            "persentase": probability_score,
            "ai_classification": status
        }

        supabase.table("history").insert(prediction_data).execute()

        return JSONResponse(content={
            "nama_file": file.filename,
            "hash_sha256": file_hash,
            "status_verifikasi": status,
            "akurasi_prediksi": probability_score
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan saat memproses file: {str(e)}")
    
@app.get("/")
async def root():
    return {"message": "Selamat datang di Gateway Verifikasi Dokumen Akademik AI. Gunakan endpoint /api/verify/ untuk memverifikasi dokumen PDF."}