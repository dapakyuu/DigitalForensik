(function () {
  async function handleSignupCallback() {
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );

    if (hashParams.get("type") !== "signup") {
      return;
    }

    const supabaseClient = window.getSupabaseClient
      ? window.getSupabaseClient()
      : null;

    if (!supabaseClient) {
      console.error("Supabase belum siap untuk memproses konfirmasi akun.");
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
      console.error(
        "Session konfirmasi akun tidak dapat diproses.",
        error || "Session tidak ditemukan.",
      );
      return;
    }

    // Token autentikasi tidak boleh dibiarkan terlihat di address bar.
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.replace("dashboard.html");
  }

  handleSignupCallback();

  const API_URL = "/api/verify/";
  // Development lokal (frontend dan backend berjalan di port berbeda):
  // const API_URL = "http://127.0.0.1:8000/api/verify/";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const byId = function (id) {
    return document.getElementById(id);
  };
  const dropzone = byId("public-dropzone");
  const input = byId("public-file-input");
  const fileRow = byId("public-file-row");
  const analyzeButton = byId("public-analyze-btn");
  const errorBox = byId("public-upload-error");
  const processing = byId("public-processing");
  const uploadCard = byId("public-upload-card");
  const resultSection = byId("public-result");
  let selectedFile = null;

  function formatBytes(bytes) {
    return bytes < 1024 * 1024
      ? (bytes / 1024).toFixed(1) + " KB"
      : (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }
  function resetUpload(scroll) {
    selectedFile = null;
    input.value = "";
    fileRow.hidden = true;
    dropzone.hidden = false;
    analyzeButton.disabled = true;
    uploadCard.hidden = false;
    processing.hidden = true;
    resultSection.hidden = true;
    clearError();
    if (scroll) byId("coba").scrollIntoView({ behavior: "smooth" });
  }
  function selectFile(file) {
    clearError();
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      showError("Format file tidak didukung. Silakan pilih dokumen PDF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError("Ukuran file melebihi batas maksimum 10 MB.");
      return;
    }
    selectedFile = file;
    byId("public-file-name").textContent = file.name;
    byId("public-file-size").textContent =
      formatBytes(file.size) + " · siap dianalisis";
    dropzone.hidden = true;
    fileRow.hidden = false;
    analyzeButton.disabled = false;
  }
  function safeValue(value) {
    if (value === null || value === undefined || value === "")
      return "Tidak tersedia";
    if (typeof value === "boolean") return value ? "Ya" : "Tidak";
    return String(value);
  }
  function scanLabel(value) {
    return (
      { DIGITAL: "PDF Digital", SCAN: "Hasil Scan", MIXED: "Campuran" }[
        value
      ] || "Tidak diketahui"
    );
  }
  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value;
    return node.innerHTML;
  }
  function renderMetadata(metadata, hash) {
    const fields = [
      ["SHA-256", hash],
      ["Judul", metadata.title],
      ["Penulis", metadata.author],
      ["Aplikasi pembuat", metadata.creator],
      ["Produsen PDF", metadata.producer],
      ["Tanggal dibuat", metadata.creation_date],
      ["Tanggal diubah", metadata.modification_date],
      ["Terenkripsi", metadata.is_encrypted],
      ["Tanda tangan digital", metadata.signature_present],
      ["Jumlah revisi", metadata.revision_count],
    ];
    byId("public-metadata-grid").innerHTML = fields
      .map(function (field) {
        return (
          "<div><span>" +
          field[0] +
          "</span><strong>" +
          escapeHtml(safeValue(field[1])) +
          "</strong></div>"
        );
      })
      .join("");
  }
  function renderResult(data) {
    const metadata = data.metadata || {};
    const status = (data.status_verifikasi || "PERLU_REVIEW").replaceAll(
      "_",
      " ",
    );
    const fakeProbability = Number(data.akurasi_prediksi);
    const confidence = Number.isFinite(fakeProbability)
      ? (Math.max(fakeProbability, 1 - fakeProbability) * 100).toFixed(1) + "%"
      : "-";
    const badgeClass =
      status === "ASLI" ? "success" : status === "PALSU" ? "danger" : "neutral";
    const summary =
      status === "ASLI"
        ? "AI tidak menemukan indikasi kuat kepalsuan pada pola digital dokumen ini."
        : status === "PALSU"
          ? "AI menemukan pola yang mengindikasikan dokumen perlu dicurigai dan diperiksa lebih lanjut."
          : "Hasil berada di area abu-abu dan memerlukan pemeriksaan manual lebih lanjut.";
    byId("public-result-name").textContent =
      data.nama_file || selectedFile.name;
    byId("public-result-meta").textContent =
      formatBytes(selectedFile.size) + " · dianalisis tanpa akun";
    const badge = byId("public-result-badge");
    badge.textContent = status;
    badge.className = "detail-badge " + badgeClass;
    byId("public-result-status").textContent = status;
    byId("public-result-confidence").textContent = confidence;
    byId("public-result-scan").textContent = scanLabel(
      data.scan_or_digital || metadata.scan_or_digital,
    );
    byId("public-result-pages").textContent = safeValue(metadata.page_count);
    byId("public-result-summary").textContent =
      summary + " " + (data.scan_impact_note || "");
    renderMetadata(metadata, data.hash_sha256);
  }
  async function analyze() {
    if (!selectedFile) return;
    clearError();
    uploadCard.hidden = true;
    processing.hidden = false;
    resultSection.hidden = true;
    const body = new FormData();
    body.append("file", selectedFile);
    try {
      const response = await fetch(API_URL, { method: "POST", body: body });
      const data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok)
        throw new Error(data.detail || "Dokumen gagal dianalisis.");
      renderResult(data);
      processing.hidden = true;
      resultSection.hidden = false;
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      processing.hidden = true;
      uploadCard.hidden = false;
      showError(
        error.message === "Failed to fetch"
          ? "Server analisis tidak dapat dihubungi. Pastikan layanan backend sedang berjalan."
          : error.message,
      );
    }
  }
  byId("public-pick-btn").addEventListener("click", function (event) {
    event.stopPropagation();
    input.click();
  });
  dropzone.addEventListener("click", function () {
    input.click();
  });
  dropzone.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", function () {
    selectFile(input.files[0]);
  });
  ["dragenter", "dragover"].forEach(function (name) {
    dropzone.addEventListener(name, function (event) {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach(function (name) {
    dropzone.addEventListener(name, function (event) {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });
  dropzone.addEventListener("drop", function (event) {
    selectFile(event.dataTransfer.files[0]);
  });
  byId("public-remove-btn").addEventListener("click", function () {
    resetUpload(false);
  });
  analyzeButton.addEventListener("click", analyze);
  byId("public-reset-btn").addEventListener("click", function () {
    resetUpload(true);
  });
})();
