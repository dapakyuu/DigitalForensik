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

        return [
          "<tr class='history-row-multiple-lines'>",
          "<td>" + row.file_name + "</td>",
          "<td>" + createdAt + "</td>",
          "<td>" + confidence + "</td>",
          '<td><span class="badge ' +
            classification.badgeClass +
            '">' +
            classification.label +
            "</span></td>",
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
          { key: "Judul", value: metadata.title || "-" },
          { key: "Author", value: metadata.author || metadata.creator || "-" },
          { key: "Creator", value: metadata.creator || "-" },
          { key: "Producer", value: metadata.producer || "-" },
          { key: "Tanggal dibuat", value: formatPdfDate(metadata.creation_date) },
          { key: "Tanggal diubah", value: formatPdfDate(metadata.modification_date) },
          { key: "Jumlah halaman", value: metadata.page_count ?? "-" },
          { key: "Terenkripsi", value: metadata.is_encrypted === true ? "Ya" : metadata.is_encrypted === false ? "Tidak" : "-" },
          { key: "Ada tanda tangan", value: metadata.signature_present === true ? "Ya" : metadata.signature_present === false ? "Tidak" : "-" },
          { key: "XMP", value: metadata.xmp_present === true ? "Ya" : metadata.xmp_present === false ? "Tidak" : "-" },
          { key: "Linearized", value: metadata.is_linearized === true ? "Ya" : metadata.is_linearized === false ? "Tidak" : "-" },
          { key: "Revisi", value: metadata.revision_count ?? "-" },
          { key: "JavaScript", value: metadata.has_javascript === true ? "Ya" : metadata.has_javascript === false ? "Tidak" : "-" },
          { key: "Embedded files", value: metadata.embedded_files_count ?? "-" },
          { key: "Annotations", value: metadata.annotations_count ?? "-" },
          { key: "Izin", value: metadata.permissions ? JSON.stringify(metadata.permissions) : "-" },
        ]
      : [{ key: "Metadata", value: "Tidak tersedia" }];

    container.innerHTML = rows
      .map(
        (row) =>
          '<div class="detail-meta-row"><span class="key">' +
          row.key +
          '</span><span class="value">' +
          row.value +
          "</span></div>",
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
      renderHistoryRows(dashboardHistoryBody, rows, {
        showOnlyDate: false,
      });
    }

    if (historyTableBody) {
      renderHistoryRows(historyTableBody, rows, {
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

    const hashEl = document.getElementById("detail-hash");
    if (hashEl) {
      hashEl.textContent = "-";
    }

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
