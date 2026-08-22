(function () {
  const isSplash = document.body.classList.contains("splash-page");
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const authPages = [
    "login.html",
    "signup.html",
    "verify.html",
    "reset-password.html",
  ];
  const protectedPages = [
    "dashboard.html",
    "upload.html",
    "riwayat.html",
    "profil.html",
    "detail.html",
  ];
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const resetRequestForm = document.getElementById("reset-request-form");
  const verifyForm = document.getElementById("verify-form");
  const resetPasswordFields = document.getElementById("reset-password-fields");
  const profileForm = document.getElementById("profile-form");
  const downloadReportBtn = document.getElementById("download-report-btn");
  const dashboardHistoryBody = document.getElementById(
    "dashboard-history-body",
  );
  const historyTableBody = document.getElementById("history-table-body");
  const nav = document.getElementById("sidebar-nav");
  const logoutBtn = document.getElementById("logout-btn");
  const supabaseClient =
    typeof window.getSupabaseClient === "function"
      ? window.getSupabaseClient()
      : null;

  // ---------- Sidebar mobile (hamburger) ----------
  (function initMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const closeBtn = document.getElementById("sidebar-close-btn");
    const overlay = document.getElementById("sidebar-overlay");

    if (!sidebar || !hamburgerBtn || !overlay) return;

    function openSidebar() {
      sidebar.classList.add("is-open");
      overlay.classList.add("is-visible");
      document.body.classList.add("sidebar-locked");
      hamburgerBtn.setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
      sidebar.classList.remove("is-open");
      overlay.classList.remove("is-visible");
      document.body.classList.remove("sidebar-locked");
      hamburgerBtn.setAttribute("aria-expanded", "false");
    }

    hamburgerBtn.addEventListener("click", function () {
      if (sidebar.classList.contains("is-open")) closeSidebar();
      else openSidebar();
    });

    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSidebar();
    });

    sidebar.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeSidebar);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) closeSidebar();
    });
  })();

  async function showMessage(icon, title, text) {
    if (window.Swal) {
      await Swal.fire({
        icon: icon,
        title: title,
        text: text,
        confirmButtonColor: "#4f46e5",
      });
      return;
    }

    console.error("SweetAlert2 tidak termuat:", title, text);
  }

  function buildAbsolutePath(path) {
    return new URL(path, window.location.href).toString();
  }

  if (isSplash) {
    setTimeout(function () {
      window.location.href = "login.html";
    }, 1800);
    return;
  }

  async function getSession() {
    if (!supabaseClient) {
      return null;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      return null;
    }

    return data.session;
  }

  async function requireAuthIfNeeded() {
    if (!supabaseClient) {
      return null;
    }

    const session = await getSession();

    if (protectedPages.includes(currentPage) && !session) {
      window.location.href = "login.html";
      return null;
    }

    if (authPages.includes(currentPage) && session) {
      window.location.href = "dashboard.html";
      return null;
    }

    return session;
  }

  async function hydrateUserUi(session) {
    if (!supabaseClient || !session) {
      return;
    }

    const user = session.user;
    const { data: profile } = await supabaseClient
      .from("users")
      .select("username,email,created_at")
      .eq("id", user.id)
      .maybeSingle();

    const displayName =
      profile && profile.username
        ? profile.username
        : user.user_metadata && user.user_metadata.full_name
          ? user.user_metadata.full_name
          : user.email;

    const greetingName = document.getElementById("greeting-name");
    if (greetingName) {
      greetingName.textContent = displayName;
    }

    const profileName = document.getElementById("profile-name");
    if (profileName) {
      profileName.textContent = displayName;
    }

    const profileEmail = document.getElementById("profile-email");
    if (profileEmail) {
      profileEmail.textContent =
        profile && profile.email ? profile.email : user.email || "-";
    }

    const profileCreatedAt = document.getElementById("profile-created-at");
    if (profileCreatedAt) {
      profileCreatedAt.textContent =
        profile && profile.created_at
          ? formatLongDate(profile.created_at)
          : "-";
    }

    const profileUsernameInput = document.getElementById(
      "profile-username-input",
    );
    if (profileUsernameInput) {
      profileUsernameInput.value = displayName;
    }
  }

  function formatLongDate(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatDateOnly(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTimeOnly(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getClassificationLabel(classification) {
    const value = (classification || "").toString().toUpperCase();

    if (value === "ASLI") {
      return { label: "ASLI", badgeClass: "success" };
    }

    if (value === "PALSU") {
      return { label: "PALSU", badgeClass: "danger" };
    }

    return { label: value || "PERLU REVIEW", badgeClass: "neutral" };
  }

  function renderHistoryRows(target, rows, options) {
    if (!target) {
      return;
    }

    if (!rows || rows.length === 0) {
      target.innerHTML =
        '<tr><td colspan="5" class="table-empty">Belum ada riwayat untuk akun ini.</td></tr>';
      return;
    }

    const showOnlyDate = options && options.showOnlyDate;

    target.innerHTML = rows
      .map(function (row) {
        const classification = getClassificationLabel(row.ai_classification);
        const confidence =
          row.persentase === null || row.persentase === undefined
            ? "-"
            : row.persentase + "%";
        const createdAt = showOnlyDate
          ? formatDateOnly(row.created_at)
          : formatTimeOnly(row.created_at);
        const detailUrl = "detail.html?id=" + encodeURIComponent(row.id);
        const scanStatus = row.scan_or_digital || "UNKNOWN";
        const scanText =
          scanStatus === "DIGITAL"
            ? "Digital"
            : scanStatus === "SCAN"
              ? "Scan"
              : scanStatus === "MIXED"
                ? "Campuran"
                : "Unknown";

        return [
          "<tr class='history-row-multiple-lines'>",
          "<td>" + row.file_name + "</td>",
          "<td>" + createdAt + "</td>",
          "<td>" + confidence + "</td>",
          '<td><div style="font-weight:700; color:#111827;">' +
            scanText +
            '</div><div style="font-size:11px; color:#64748b; margin-top:2px;">' +
            (row.scan_confidence ? row.scan_confidence.toUpperCase() : "-") +
            "</div></td>",
          '<td><span class="badge ' +
            classification.badgeClass +
            '">' +
            classification.label +
            '</span><div style="font-size:11px; color:#64748b; margin-top:6px;">' +
            (row.scan_detail ? row.scan_detail : "Tidak ada info scan") +
            "</div></td>",
          '<td><a class="table-action" href="' +
            detailUrl +
            '">Detail</a></td>',
          "</tr>",
        ].join("");
      })
      .join("");
  }

  function formatPdfDate(value) {
    if (!value) {
      return "-";
    }

    const raw = String(value).trim();
    if (!raw || raw === "-") {
      return "-";
    }

    try {
      let normalized = raw;
      if (normalized.startsWith("D:")) normalized = normalized.slice(2);
      normalized = normalized.replace(/'/g, "");

      const parsed = new Date(
        normalized.replace(
          /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-]\d{2})(\d{2})?$/,
          "$1-$2-$3T$4:$5:$6$7:$8",
        ),
      );

      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
      }

      const isoDate = new Date(raw);
      if (!Number.isNaN(isoDate.getTime())) {
        return isoDate.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
      }
    } catch (error) {
      // fallback below
    }

    return raw;
  }

  function renderMetadataRows(metadata) {
    const container = document.getElementById("detail-metadata");
    if (!container) {
      return;
    }

    const rows = metadata && Object.keys(metadata).length
      ? [
          { key: "Judul", value: metadata.title || "-", desc: "Judul dokumen yang tertanam di properti metadata PDF." },
          { key: "Author", value: metadata.author || metadata.creator || "-", desc: "Nama penulis atau pemilik dokumen yang tercatat di metadata PDF." },
          { key: "Creator", value: metadata.creator || "-", desc: "Aplikasi asal yang membuat dokumen sebelum diekspor ke PDF." },
          { key: "Producer", value: metadata.producer || "-", desc: "Engine atau library yang menghasilkan file PDF final." },
          { key: "Tanggal dibuat", value: formatPdfDate(metadata.creation_date), desc: "Waktu pembuatan awal dokumen berdasarkan metadata internal." },
          { key: "Tanggal diubah", value: formatPdfDate(metadata.modification_date), desc: "Waktu modifikasi terakhir dokumen menurut metadata PDF." },
          { key: "Jumlah halaman", value: metadata.page_count ?? "-", desc: "Jumlah halaman PDF yang terbaca saat analisis." },
          { key: "Terenkripsi", value: metadata.is_encrypted === true ? "Ya" : metadata.is_encrypted === false ? "Tidak" : "-", desc: "Menunjukkan apakah file diproteksi enkripsi/password." },
          { key: "Ada tanda tangan", value: metadata.signature_present === true ? "Ya" : metadata.signature_present === false ? "Tidak" : "-", desc: "Indikator keberadaan field tanda tangan digital pada dokumen." },
          { key: "XMP", value: metadata.xmp_present === true ? "Ya" : metadata.xmp_present === false ? "Tidak" : "-", desc: "Menunjukkan apakah metadata lanjutan XMP tersedia di PDF." },
          { key: "Linearized", value: metadata.is_linearized === true ? "Ya" : metadata.is_linearized === false ? "Tidak" : "-", desc: "Status optimasi Fast Web View agar PDF lebih cepat dibuka via web." },
          { key: "Revisi", value: metadata.revision_count ?? "-", desc: "Perkiraan jumlah revisi incremental dari penanda startxref." },
          { key: "JavaScript", value: metadata.has_javascript === true ? "Ya" : metadata.has_javascript === false ? "Tidak" : "-", desc: "Indikator adanya JavaScript/action aktif yang bisa berjalan saat PDF dibuka." },
          { key: "Embedded files", value: metadata.embedded_files_count ?? "-", desc: "Jumlah file lampiran yang disisipkan di dalam dokumen PDF." },
          { key: "Annotations", value: metadata.annotations_count ?? "-", desc: "Jumlah anotasi, komentar, atau markup yang ditemukan pada halaman." },
          { key: "Izin", value: metadata.permissions ? JSON.stringify(metadata.permissions) : "-", desc: "Daftar izin dokumen yang diaktifkan seperti print, copy, atau modify." },
          { key: "Scan / Digital", value: metadata.scan_or_digital || "-", desc: "Status PDF scan atau digital berdasarkan ekstraksi teks halaman." },
          { key: "Scan Confidence", value: metadata.scan_confidence || "-", desc: "Tingkat keyakinan dari klasifikasi scan/digital." },
          { key: "Scan Detail", value: metadata.scan_detail || "-", desc: "Informasi tambahan yang menjelaskan apakah dokumen kemungkinan hasil scan, digital, atau campuran." },
        ]
      : [{ key: "Metadata", value: "Tidak tersedia", desc: "Data metadata tidak ditemukan di database." }];

      const grid = document.getElementById("detail-metadata");
      grid.innerHTML = rows
        .map(
          (row) =>
            `<div class="report-meta-card">
              <div class="meta-card-key">${row.key}</div>
              <div class="meta-card-value">${row.value}</div>
              <div class="meta-card-desc">${row.desc || '-'}</div>
            </div>`
        )
        .join("");
  }

  async function loadHistoryForSession(session) {
    if (!supabaseClient || !session || !session.user) {
      return;
    }

    const limit = currentPage === "dashboard.html" ? 3 : 1000;

    const { data, error } = await supabaseClient
      .from("history")
      .select("id,file_name,persentase,ai_classification,created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    const { data: allRows, error: summaryError } = await supabaseClient
      .from("history")
      .select("id,file_name,persentase,ai_classification,created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    const historyIds = (data || []).map(function (row) {
      return row.id;
    });
    const metadataMap = {};

    if (historyIds.length > 0) {
      const { data: metadataRows, error: metadataError } = await supabaseClient
        .from("document_metadata")
        .select("verification_id, scan_or_digital, scan_confidence, scan_detail")
        .in("verification_id", historyIds);

      if (!metadataError && metadataRows) {
        metadataRows.forEach(function (meta) {
          metadataMap[meta.verification_id] = meta;
        });
      }
    }

    const enrichedRows = (data || []).map(function (row) {
      const meta = metadataMap[row.id] || {};
      return {
        ...row,
        scan_or_digital: meta.scan_or_digital || null,
        scan_confidence: meta.scan_confidence || null,
        scan_detail: meta.scan_detail || null,
      };
    });

    if (error) {
      if (dashboardHistoryBody) {
        dashboardHistoryBody.innerHTML =
          '<tr><td colspan="4" class="table-empty">Gagal memuat riwayat.</td></tr>';
      }

      if (historyTableBody) {
        historyTableBody.innerHTML =
          '<tr><td colspan="4" class="table-empty">Gagal memuat riwayat.</td></tr>';
      }

      return;
    }

    const rows = data || [];
    const allRowsData = allRows || [];
    const asliCount = allRowsData.filter(function (row) {
      return (row.ai_classification || "").toString().toUpperCase() === "ASLI";
    }).length;
    const palsuCount = allRowsData.filter(function (row) {
      return (row.ai_classification || "").toString().toUpperCase() === "PALSU";
    }).length;

    const totalStat = document.getElementById("stat-total");
    const asliStat = document.getElementById("stat-asli");
    const palsuStat = document.getElementById("stat-palsu");
    const latestStat = document.getElementById("stat-latest");

    if (totalStat) {
      totalStat.textContent = String(allRowsData.length);
    }

    if (asliStat) {
      asliStat.textContent = String(asliCount);
    }

    if (palsuStat) {
      palsuStat.textContent = String(palsuCount);
    }

    if (latestStat) {
      latestStat.textContent = allRowsData.length
        ? formatDateOnly(allRowsData[0].created_at)
        : "-";
    }

    if (dashboardHistoryBody) {
      renderHistoryRows(dashboardHistoryBody, enrichedRows, {
        showOnlyDate: false,
      });
    }

    if (historyTableBody) {
      renderHistoryRows(historyTableBody, enrichedRows, {
        showOnlyDate: true,
      });
    }
  }

  async function loadProfileForm(session) {
    if (!supabaseClient || !session || !profileForm) {
      return;
    }

    const user = session.user;
    const { data: profile } = await supabaseClient
      .from("users")
      .select("username,email,created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return;
    }

    const profileUsernameInput = document.getElementById(
      "profile-username-input",
    );
    if (profileUsernameInput) {
      profileUsernameInput.value = profile.username || "";
    }
  }

  async function ensureUserProfile(session, fullNameFallback) {
    if (!supabaseClient || !session || !session.user) {
      return;
    }

    const user = session.user;
    const preferredName =
      fullNameFallback ||
      (user.user_metadata && user.user_metadata.full_name) ||
      (user.email ? user.email.split("@")[0] : "Pengguna");

    const { data: existingProfile, error: selectError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) {
      return;
    }

    if (existingProfile) {
      return;
    }

    await supabaseClient
      .from("users")
      .upsert(
        {
          id: user.id,
          username: preferredName,
          email: user.email,
        },
        { onConflict: "id" },
      );
  }

  async function loadDetailPage(session) {
    if (currentPage !== "detail.html") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const historyId = params.get("id");
    if (!historyId) {
      window.location.href = "riwayat.html";
      return;
    }

    const { data, error } = await supabaseClient
      .from("history")
      .select(
        "id,file_name,file_type,persentase,ai_classification,created_at",
      )
      .eq("id", historyId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || !data) {
      const statusBadge = document.getElementById("detail-status-badge");
      if (statusBadge) {
        statusBadge.textContent = "ERROR";
      }
      const summaryEl = document.getElementById("detail-summary");
      if (summaryEl) {
        summaryEl.textContent = "Riwayat tidak ditemukan atau tidak tersedia.";
      }
      return;
    }

    const { data: metadataRows, error: metadataError } = await supabaseClient
      .from("document_metadata")
      .select("*")
      .eq("verification_id", historyId)
      .limit(1);

    const meta = metadataError || !metadataRows || metadataRows.length === 0
      ? {}
      : metadataRows[0];
    const classification = getClassificationLabel(data.ai_classification);
    const percentage =
      data.persentase === null || data.persentase === undefined
        ? "-"
        : data.persentase + "%";
    const sha256Hash = meta.sha256_hash || "-+";

    const titleEl = document.getElementById("detail-file-name");
    if (titleEl) titleEl.textContent = data.file_name || "Dokumen";

    const metaEl = document.getElementById("detail-file-meta");
    if (metaEl) {
      metaEl.textContent =
        (data.file_type || "PDF") + " • " + formatLongDate(data.created_at);
    }

    const badgeEl = document.getElementById("detail-status-badge");
    if (badgeEl) {
      badgeEl.textContent = classification.label;
      badgeEl.className = "detail-badge " + classification.badgeClass;
    }

    const percentEl = document.getElementById("detail-percent");
    if (percentEl) percentEl.textContent = percentage;

    const shaEl = document.getElementById("detail-hash");
    if (shaEl) shaEl.textContent = sha256Hash;

    const statusEl = document.getElementById("detail-classification");
    if (statusEl) statusEl.textContent = classification.label;

    const dateEl = document.getElementById("detail-date");
    if (dateEl) dateEl.textContent = formatLongDate(data.created_at);

    const summaryEl = document.getElementById("detail-summary");
    if (summaryEl) {
      summaryEl.textContent =
        "Dokumen ini telah dianalisis dengan model LSTM berdasarkan pola byte PDF. Hasil " +
        classification.label.toLowerCase() +
        " menunjukkan bahwa dokumen ini memiliki indikator " +
        (classification.label === "ASLI" ? "kebersihan pola digital yang lebih tinggi" : "kemungkinan manipulasi atau pola tidak umum") +
        ".";
    }

    // const hashEl = document.getElementById("detail-hash");
    // if (hashEl) {
    //   hashEl.textContent = "-";
    // }

    renderMetadataRows(meta);
  }

  requireAuthIfNeeded().then(async function (session) {
    if (!session) {
      return;
    }

    if (currentPage === "detail.html") {
      await loadDetailPage(session);
      return;
    }

    await ensureUserProfile(session);
    await hydrateUserUi(session);
    await loadHistoryForSession(session);
    await loadProfileForm(session);
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email || !password) {
        await showMessage(
          "warning",
          "Input belum lengkap",
          "Email dan kata sandi wajib diisi.",
        );
        return;
      }

      if (!supabaseClient) {
        await showMessage(
          "error",
          "Konfigurasi belum siap",
          "Supabase belum dikonfigurasi. Isi ANON KEY terlebih dahulu.",
        );
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        await showMessage("error", "Login gagal", error.message);
        return;
      }

      window.location.href = "dashboard.html";
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const fullName = signupForm.fullName.value.trim();
      const email = signupForm.email.value.trim();
      const password = signupForm.password.value;
      const confirmPassword = signupForm.confirmPassword.value;
      const terms = signupForm.terms.checked;

      if (!fullName || !email || !password || !confirmPassword) {
        await showMessage(
          "warning",
          "Input belum lengkap",
          "Semua field wajib diisi.",
        );
        return;
      }

      if (password.length < 8) {
        await showMessage(
          "warning",
          "Password terlalu pendek",
          "Kata sandi minimal 8 karakter.",
        );
        return;
      }

      if (password !== confirmPassword) {
        await showMessage(
          "warning",
          "Konfirmasi tidak cocok",
          "Konfirmasi kata sandi tidak cocok.",
        );
        return;
      }

      if (!terms) {
        await showMessage(
          "warning",
          "Persetujuan diperlukan",
          "Anda harus menyetujui syarat layanan.",
        );
        return;
      }

      if (!supabaseClient) {
        await showMessage(
          "error",
          "Konfigurasi belum siap",
          "Supabase belum dikonfigurasi. Isi ANON KEY terlebih dahulu.",
        );
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        await showMessage("error", "Pendaftaran gagal", error.message);
        return;
      }

      if (data && data.session) {
        await ensureUserProfile(data.session, fullName);
        await showMessage(
          "success",
          "Pendaftaran berhasil",
          "Akun berhasil dibuat. Anda akan diarahkan ke dashboard.",
        );
        window.location.href = "dashboard.html";
        return;
      }

      await showMessage(
        "success",
        "Pendaftaran berhasil",
        "Akun berhasil dibuat. Silakan cek email untuk konfirmasi lalu login.",
      );
      window.location.href = "login.html";
    });
  }

  if (resetRequestForm) {
    resetRequestForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email = resetRequestForm.email.value.trim();

      if (!email) {
        await showMessage(
          "warning",
          "Input belum lengkap",
          "Email wajib diisi.",
        );
        return;
      }

      if (!supabaseClient) {
        await showMessage(
          "error",
          "Konfigurasi belum siap",
          "Supabase belum dikonfigurasi. Isi ANON KEY terlebih dahulu.",
        );
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: buildAbsolutePath("verify.html"),
      });

      if (error) {
        await showMessage("error", "Gagal mengirim email reset", error.message);
        return;
      }

      await showMessage(
        "success",
        "Email reset terkirim",
        "Silakan cek email Anda untuk link reset password.",
      );
      window.location.href = "login.html";
    });
  }

  if (verifyForm) {
    const recoveryDescription = document.getElementById("recovery-description");
    const submitButton = verifyForm.querySelector("button[type='submit']");
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const isRecoveryFlow = hashParams.get("type") === "recovery";

    if (!isRecoveryFlow) {
      window.location.href = "login.html";
      return;
    }

    if (resetPasswordFields) {
      resetPasswordFields.classList.remove("hidden");
    }

    if (recoveryDescription) {
      recoveryDescription.textContent =
        "Atur password baru untuk menyelesaikan reset akun Anda.";
    }

    if (submitButton) {
      submitButton.textContent = "Simpan Password Baru";
    }

    verifyForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const newPassword = verifyForm.newPassword
        ? verifyForm.newPassword.value
        : "";
      const confirmNewPassword = verifyForm.confirmNewPassword
        ? verifyForm.confirmNewPassword.value
        : "";

      if (!supabaseClient) {
        await showMessage(
          "error",
          "Konfigurasi belum siap",
          "Supabase belum dikonfigurasi. Isi ANON KEY terlebih dahulu.",
        );
        return;
      }

      if (!newPassword || !confirmNewPassword) {
        await showMessage(
          "warning",
          "Input belum lengkap",
          "Password baru wajib diisi.",
        );
        return;
      }

      if (newPassword.length < 8) {
        await showMessage(
          "warning",
          "Password terlalu pendek",
          "Password baru minimal 8 karakter.",
        );
        return;
      }

      if (newPassword !== confirmNewPassword) {
        await showMessage(
          "warning",
          "Konfirmasi tidak cocok",
          "Konfirmasi password baru tidak cocok.",
        );
        return;
      }

      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        await showMessage("error", "Reset password gagal", error.message);
        return;
      }

      await showMessage(
        "success",
        "Password diperbarui",
        "Password baru berhasil disimpan. Silakan login kembali.",
      );
      window.location.href = "login.html";
    });
  }

  if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", async function () {
      const session = await getSession();

      if (!session) {
        await showMessage(
          "warning",
          "Sesi habis",
          "Silakan login kembali untuk mengunduh laporan.",
        );
        window.location.href = "login.html";
        return;
      }

      await exportHistoryPdf(session);
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const newUsername = profileForm.username.value.trim();
      const newPassword = profileForm.password.value;
      const confirmPassword = profileForm.confirmPassword.value;

      if (!supabaseClient) {
        await showMessage(
          "error",
          "Konfigurasi belum siap",
          "Supabase belum dikonfigurasi. Isi ANON KEY terlebih dahulu.",
        );
        return;
      }

      const session = await getSession();
      if (!session) {
        window.location.href = "login.html";
        return;
      }

      if (!newUsername && !newPassword) {
        await showMessage(
          "warning",
          "Tidak ada perubahan",
          "Isi username baru atau password baru untuk menyimpan perubahan.",
        );
        return;
      }

      if (newPassword && newPassword.length < 8) {
        await showMessage(
          "warning",
          "Password terlalu pendek",
          "Password baru minimal 8 karakter.",
        );
        return;
      }

      if (newPassword && newPassword !== confirmPassword) {
        await showMessage(
          "warning",
          "Konfirmasi tidak cocok",
          "Konfirmasi password baru tidak cocok.",
        );
        return;
      }

      if (newUsername) {
        const { error: profileUpdateError } = await supabaseClient
          .from("users")
          .update({ username: newUsername })
          .eq("id", session.user.id);

        if (profileUpdateError) {
          await showMessage(
            "error",
            "Gagal memperbarui username",
            profileUpdateError.message,
          );
          return;
        }

        const { error: authMetadataError } =
          await supabaseClient.auth.updateUser({
            data: { full_name: newUsername },
          });

        if (authMetadataError) {
          await showMessage(
            "warning",
            "Username tersimpan sebagian",
            "Username tersimpan, tetapi metadata auth gagal diperbarui: " +
              authMetadataError.message,
          );
          return;
        }
      }

      if (newPassword) {
        const { error: passwordUpdateError } =
          await supabaseClient.auth.updateUser({ password: newPassword });

        if (passwordUpdateError) {
          await showMessage(
            "error",
            "Gagal memperbarui password",
            passwordUpdateError.message,
          );
          return;
        }
      }

      profileForm.password.value = "";
      profileForm.confirmPassword.value = "";

      await hydrateUserUi(session);
      await loadProfileForm(session);

      await showMessage(
        "success",
        "Profil diperbarui",
        "Perubahan profil berhasil disimpan.",
      );
    });
  }

  if (nav) {
    nav.querySelectorAll("a").forEach(function (link) {
      const href = link.getAttribute("href");
      if (href === currentPage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      let shouldLogout = false;

      if (window.Swal) {
        const result = await Swal.fire({
          title: "Keluar dari akun?",
          text: "Anda akan diarahkan ke halaman login.",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ya, keluar",
          cancelButtonText: "Batal",
          confirmButtonColor: "#4f46e5",
          cancelButtonColor: "#64748b",
        });
        shouldLogout = result.isConfirmed;
      } else {
        shouldLogout = window.confirm(
          "Apakah Anda yakin ingin keluar dari akun ini?",
        );
      }

      if (!shouldLogout) {
        return;
      }

      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }

      if (window.Swal) {
        await Swal.fire({
          icon: "success",
          title: "Berhasil keluar",
          text: "Anda akan diarahkan ke login.",
          timer: 1200,
          showConfirmButton: false,
        });
      }

      window.location.href = "login.html";
    });
  }
})();