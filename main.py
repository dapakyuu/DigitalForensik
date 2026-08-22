from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from io import BytesIO
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from datetime import datetime
import hashlib
import os
import fitz

load_dotenv()
app = FastAPI(title="Gateway Verifikasi Dokumen Akademik AI")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_API_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
)
supabase: Client | None = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        supabase = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "best_model_pure_bilstm.keras"
MAX_LEN = 10000

if not os.path.exists(MODEL_PATH):
    model = None
    raise FileNotFoundError(f"Model tidak ditemukan di path: {MODEL_PATH}")
else:
    model = load_model(MODEL_PATH)


def _safe_meta_value(value):
    if value is None:
        return None
    return str(value).strip()


def _decode_permission_flags(raw_permissions):
    if raw_permissions is None:
        return None

    # Bitmask berdasarkan PDF standard (nilai /P). True berarti izin tersedia.
    return {
        "print": bool(raw_permissions & 4),
        "modify": bool(raw_permissions & 8),
        "copy": bool(raw_permissions & 16),
        "annotate": bool(raw_permissions & 32),
        "fill_forms": bool(raw_permissions & 256),
        "extract_for_accessibility": bool(raw_permissions & 512),
        "assemble": bool(raw_permissions & 1024),
        "high_quality_print": bool(raw_permissions & 2048),
    }


def _extract_raw_permissions(reader):
    try:
        encrypt_obj = reader.trailer.get("/Encrypt")
        if not encrypt_obj:
            return None

        encrypt_dict = encrypt_obj.get_object()
        raw_permissions = encrypt_dict.get("/P")
        if raw_permissions is None:
            return None

        return int(raw_permissions)
    except Exception:
        return None


def _is_linearized_pdf(file_bytes: bytes):
    # Linearized marker normalnya berada di awal file PDF.
    header_window = file_bytes[:2048]
    return b"/Linearized" in header_window


def _count_revisions(file_bytes: bytes):
    # Incremental update biasanya menambah blok startxref baru.
    count = file_bytes.count(b"startxref")
    return count if count > 0 else None


def _extract_embedded_files_count(root_obj):
    try:
        names_obj = root_obj.get("/Names") if root_obj else None
        if not names_obj:
            return 0

        names_dict = names_obj.get_object()
        embedded = names_dict.get("/EmbeddedFiles")
        if not embedded:
            return 0

        embedded_obj = embedded.get_object()
        names_array = embedded_obj.get("/Names", [])
        if names_array:
            return len(names_array) // 2

        # Fallback jika struktur Names menggunakan Kids tree.
        stack = list(embedded_obj.get("/Kids", []))
        total = 0
        while stack:
            kid_ref = stack.pop()
            kid = kid_ref.get_object()
            kid_names = kid.get("/Names", [])
            if kid_names:
                total += len(kid_names) // 2
            else:
                stack.extend(kid.get("/Kids", []))
        return total
    except Exception:
        return 0


def _has_javascript(root_obj):
    try:
        if not root_obj:
            return False

        open_action = root_obj.get("/OpenAction")
        if open_action:
            action = open_action.get_object() if hasattr(open_action, "get_object") else open_action
            if action.get("/S") == "/JavaScript":
                return True

        names_obj = root_obj.get("/Names")
        if names_obj:
            names_dict = names_obj.get_object()
            js_entry = names_dict.get("/JavaScript")
            if js_entry:
                return True
    except Exception:
        return False

    return False


def _count_annotations(reader):
    total = 0
    try:
        for page in reader.pages:
            annots = page.get("/Annots", [])
            total += len(annots)
    except Exception:
        return None
    return total


def _detect_scan_or_digital(file_bytes: bytes):
    result = {
        "scan_or_digital": "UNKNOWN",
        "scan_confidence": "low",
        "scan_detail": "Tidak dapat menentukan apakah dokumen merupakan PDF murni atau hasil scan.",
        "scan_impact_note": "Status scan/digital tidak dapat ditentukan secara pasti.",
    }

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = doc.page_count
        if total_pages == 0:
            return result

        blank_pages = 0
        text_pages = 0

        for page in doc:
            page_text = page.get_text("text") or ""
            if page_text.strip():
                text_pages += 1
            else:
                blank_pages += 1

        if blank_pages == total_pages:
            result["scan_or_digital"] = "SCAN"
            result["scan_confidence"] = "medium"
            result["scan_detail"] = "Semua halaman tidak memiliki teks yang bisa diekstraksi, kemungkinan besar dokumen merupakan hasil scan."
            result["scan_impact_note"] = "Dokumen kemungkinan hasil scan. Kondisi ini dapat memengaruhi analisis karena teks mungkin berasal dari pemindaian atau OCR."
            return result

        if text_pages == total_pages:
            result["scan_or_digital"] = "DIGITAL"
            result["scan_confidence"] = "high"
            result["scan_detail"] = "Semua halaman memiliki teks yang bisa diekstraksi, kemungkinan besar dokumen merupakan PDF digital murni."
            result["scan_impact_note"] = "Dokumen kemungkinan PDF digital murni. Kondisi ini lebih ideal untuk analisis tekstual."
            return result

        if blank_pages > 0 and text_pages > 0:
            result["scan_or_digital"] = "MIXED"
            result["scan_confidence"] = "low"
            result["scan_detail"] = "Ada campuran halaman berisi teks dan halaman kosong, kemungkinan kombinasi scan dan PDF digital."
            result["scan_impact_note"] = "Dokumen campuran scan dan digital. Hasil analisis perlu ditafsirkan lebih hati-hati."
            return result

        return result
    except Exception:
        return result
    finally:
        try:
            doc.close()
        except Exception:
            pass


def extract_priority_metadata(file_bytes: bytes):
    metadata = {
        "title": None,
        "author": None,
        "creator": None,
        "producer": None,
        "creation_date": None,
        "modification_date": None,
        "page_count": None,
        "is_encrypted": None,
        "signature_present": False,
        "xmp_present": False,
        "permissions": None,
        "permissions_raw": None,
        "is_linearized": None,
        "revision_count": None,
        "has_javascript": False,
        "embedded_files_count": None,
        "annotations_count": None,
        "scan_or_digital": None,
        "scan_confidence": None,
        "scan_detail": None,
        "scan_impact_note": None,
    }

    try:
        reader = PdfReader(BytesIO(file_bytes))
        doc_info = reader.metadata or {}

        metadata["title"] = _safe_meta_value(doc_info.get("/Title"))
        metadata["author"] = _safe_meta_value(doc_info.get("/Author"))
        metadata["creator"] = _safe_meta_value(doc_info.get("/Creator"))
        metadata["producer"] = _safe_meta_value(doc_info.get("/Producer"))
        metadata["creation_date"] = _safe_meta_value(doc_info.get("/CreationDate"))
        metadata["modification_date"] = _safe_meta_value(doc_info.get("/ModDate"))
        metadata["is_encrypted"] = bool(reader.is_encrypted)
        metadata["is_linearized"] = _is_linearized_pdf(file_bytes)
        metadata["revision_count"] = _count_revisions(file_bytes)

        raw_permissions = _extract_raw_permissions(reader)
        metadata["permissions_raw"] = raw_permissions
        metadata["permissions"] = _decode_permission_flags(raw_permissions)

        if not reader.is_encrypted:
            metadata["page_count"] = len(reader.pages)
            metadata["annotations_count"] = _count_annotations(reader)
        metadata["xmp_present"] = reader.xmp_metadata is not None

        root_obj = reader.trailer.get("/Root", {})
        metadata["embedded_files_count"] = _extract_embedded_files_count(root_obj)
        metadata["has_javascript"] = _has_javascript(root_obj)

        acro_form = root_obj.get("/AcroForm") if root_obj else None
        if acro_form:
            acro_form_obj = acro_form.get_object()
            sig_flags = acro_form_obj.get("/SigFlags")
            fields = acro_form_obj.get("/Fields", [])

            has_signature_field = any(
                field_ref.get_object().get("/FT") == "/Sig" for field_ref in fields
            )
            metadata["signature_present"] = bool(sig_flags) or has_signature_field

        scan_metadata = _detect_scan_or_digital(file_bytes)
        metadata["scan_or_digital"] = scan_metadata["scan_or_digital"]
        metadata["scan_confidence"] = scan_metadata["scan_confidence"]
        metadata["scan_detail"] = scan_metadata["scan_detail"]
        metadata["scan_impact_note"] = scan_metadata["scan_impact_note"]
    except PdfReadError:
        # Metadata dibiarkan default jika PDF rusak atau tidak dapat dibaca penuh.
        return metadata
    except Exception:
        return metadata

    return metadata


def _normalize_pdf_datetime(value):
    if value is None:
        return None

    value = str(value).strip()
    if not value:
        return None

    try:
        if value.startswith("D:"):
            value = value[2:]

        value = value.replace("'", "")
        value = value.replace("Z", "+0000")

        if len(value) >= 15 and value[-5] in "+-":
            value = value[:-2] + value[-2:]

        dt = datetime.strptime(value, "%Y%m%d%H%M%S%z")
        return dt.isoformat()
    except ValueError:
        try:
            dt = datetime.fromisoformat(value)
            return dt.isoformat()
        except ValueError:
            return None


def _save_to_supabase(user_id: str, file_name: str, file_type: str, classification: str, confidence_score: float, raw_probability: float, pdf_metadata: dict):
    if supabase is None:
        return None

    try:
        # percentage = round(float(probability_score) * 100, 2)
        history_payload = {
            "user_id": user_id,
            "file_name": file_name,
            "file_type": file_type,
            "persentase": round(confidence_score * 100, 2),
            "ai_classification": classification,
            "raw_probability": float(raw_probability),
        }

        history_result = supabase.table("history").insert(history_payload).execute()
        inserted_history = history_result.data or []

        if not inserted_history:
            return None

        history_id = inserted_history[0].get("id")
        metadata_payload = {
            "verification_id": history_id,
            "title": pdf_metadata.get("title"),
            "author": pdf_metadata.get("author"),
            "creator": pdf_metadata.get("creator"),
            "producer": pdf_metadata.get("producer"),
            "creation_date": _normalize_pdf_datetime(pdf_metadata.get("creation_date")),
            "modification_date": _normalize_pdf_datetime(pdf_metadata.get("modification_date")),
            "page_count": pdf_metadata.get("page_count"),
            "is_encrypted": pdf_metadata.get("is_encrypted"),
            "signature_present": pdf_metadata.get("signature_present"),
            "xmp_present": pdf_metadata.get("xmp_present"),
            "is_linearized": pdf_metadata.get("is_linearized"),
            "revision_count": pdf_metadata.get("revision_count"),
            "has_javascript": pdf_metadata.get("has_javascript"),
            "embedded_files_count": pdf_metadata.get("embedded_files_count"),
            "annotations_count": pdf_metadata.get("annotations_count"),
            "permissions": pdf_metadata.get("permissions"),
            "permissions_raw": pdf_metadata.get("permissions_raw"),
            "scan_or_digital": pdf_metadata.get("scan_or_digital"),
            "scan_confidence": pdf_metadata.get("scan_confidence"),
            "scan_detail": pdf_metadata.get("scan_detail"),
            "sha256_hash": hashlib.sha256(file_name.encode()).hexdigest(),
        }

        metadata_result = supabase.table("document_metadata").insert(metadata_payload).execute()
        metadata_row = metadata_result.data or []

        return {
            "history_id": history_id,
            "metadata_id": metadata_row[0].get("id") if metadata_row else None,
        }
    except Exception:
        return None


@app.post("/api/verify/")
async def verify_document(file: UploadFile = File(...), user_id: str | None = Form(None)):
    file_name = (file.filename or "").strip()
    content_type = (file.content_type or "").lower()

    if not file_name.lower().endswith(".pdf") and content_type not in ["application/pdf", "application/octet-stream"]:
        raise HTTPException(status_code=400, detail="File harus berupa PDF.")

    if not file_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Kesalahan Ekstensi: Format file harus .pdf")

    if model is None:
        raise HTTPException(status_code=500, detail="Model verifikasi belum dimuat. Silakan periksa konfigurasi server.")

    try:
        file_bytes = await file.read()
        file_hash = hashlib.sha256(file_bytes).hexdigest()

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
            confidence_score = probability_score
        elif probability_score < 0.5:
            status = "ASLI"
            confidence_score = 1.0 - probability_score
        else:
            status = "PERLU_REVIEW"
            confidence_score = 0.5

        pdf_metadata = extract_priority_metadata(file_bytes)
        scan_impact_note = pdf_metadata.get("scan_impact_note") or (
            "Status scan/digital belum tersedia."
        )
        normalized_user_id = user_id.strip() if user_id else None
        db_record = None
        if normalized_user_id:
            db_record = _save_to_supabase(
                user_id=normalized_user_id,
                file_name=file.filename,
                file_type=file.content_type or "application/pdf",
                classification=status,
                confidence_score=confidence_score,
                raw_probability=probability_score,
                pdf_metadata=pdf_metadata,
            )

        response_payload = {
            "nama_file": file.filename,
            "hash_sha256": file_hash,
            "status_verifikasi": status,
            "akurasi_prediksi": confidence_score,
            "metadata": pdf_metadata,
            "scan_or_digital": pdf_metadata.get("scan_or_digital"),
            "scan_confidence": pdf_metadata.get("scan_confidence"),
            "scan_detail": pdf_metadata.get("scan_detail"),
            "scan_impact_note": scan_impact_note,
            "metadata_visibility": "account" if normalized_user_id else "public_session",
            "disimpan_ke_supabase": db_record is not None,
        }

        if db_record is not None:
            response_payload["supabase_record"] = db_record

        return JSONResponse(content=response_payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan saat memproses file: {str(e)}")
    
@app.get("/")
async def root():
    return {"message": "Selamat datang di Gateway Verifikasi Dokumen Akademik AI. Gunakan endpoint /api/verify/ untuk memverifikasi dokumen PDF."}
