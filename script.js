(function () {
  const isSplash = document.body.classList.contains("splash-page");
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const initialAuthCallbackType = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  ).get("type");

  if (currentPage === "verify.html" && initialAuthCallbackType === "recovery") {
    sessionStorage.setItem("forensa_recovery_flow", "true");
  }
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
  const saveHistoryPdfBtn = document.getElementById("btn-save-history-pdf");
  const printHistoryBtn = document.getElementById("btn-print-riwayat");
  const saveDetailPdfBtn = document.getElementById("btn-save-detail-pdf");
  const dashboardHistoryBody = document.getElementById(
    "dashboard-history-body",
  );
  const historyTableBody = document.getElementById("history-table-body");
  const historySearchInput = document.getElementById("history-search-input");
  const historyPageSizeSelect = document.getElementById(
    "history-page-size-select",
  );
  const historyPagination = document.getElementById("history-pagination");
  const historyPaginationInfo = document.getElementById(
    "history-pagination-info",
  );
  const historyPrintDate = document.getElementById("history-print-date");
  let historyRowsCache = [];
  let historyCurrentPage = 1;
  let historyPageSize = 10;
  let historyActiveSession = null;

  function updateHistoryPrintDate() {
    if (!historyPrintDate) {
      return;
    }

    historyPrintDate.textContent = new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  updateHistoryPrintDate();
  window.addEventListener("beforeprint", function () {
    updateHistoryPrintDate();

    if (historyTableBody) {
      renderHistoryRows(historyTableBody, getFilteredHistoryRows(), {
        showOnlyDate: true,
        allowDelete: false,
        showRowNumber: true,
        rowNumberStart: 0,
      });
    }
  });
  window.addEventListener("afterprint", function () {
    if (historyTableBody) {
      renderHistoryPagination();
    }
  });
  const nav = document.getElementById("sidebar-nav");
  const logoutBtn = document.getElementById("logout-btn");
  const supabaseClient =
    typeof window.getSupabaseClient === "function"
      ? window.getSupabaseClient()
      : null;

  function initPasswordToggles() {
    const eyeIcon = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">',
      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"></path>',
      '<circle cx="12" cy="12" r="3"></circle>',
      "</svg>",
    ].join("");
    const eyeOffIcon = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">',
      '<path d="M3 3l18 18"></path>',
      '<path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"></path>',
      '<path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.1 3.2"></path>',
      '<path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a9.8 9.8 0 0 0 4.1-.9"></path>',
      "</svg>",
    ].join("");

    document.querySelectorAll('input[type="password"]').forEach(function (input) {
      const wrapper = input.closest(".input-group");
      if (!wrapper || wrapper.querySelector(".password-toggle")) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "password-toggle";
      button.setAttribute("aria-label", "Tampilkan password");
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = eyeIcon;
      wrapper.classList.add("has-password-toggle");

      button.addEventListener("click", function () {
        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.setAttribute(
          "aria-label",
          shouldShow ? "Sembunyikan password" : "Tampilkan password",
        );
        button.setAttribute("aria-pressed", String(shouldShow));
        button.innerHTML = shouldShow ? eyeOffIcon : eyeIcon;
      });

      wrapper.appendChild(button);
    });
  }

  initPasswordToggles();

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

  function sanitizePdfFileName(value) {
    return String(value || "laporan")
      .replace(/\.pdf$/i, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "laporan";
  }

  async function saveElementAsPdf(element, fileName, orientation) {
    if (!element || !window.html2canvas || !window.jspdf) {
      throw new Error("Library pembuat PDF belum berhasil dimuat.");
    }

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    await new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });

    const canvas = await window.html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const margin = 8;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const imageHeight = (canvas.height * printableWidth) / canvas.width;
    const imageData = canvas.toDataURL("image/jpeg", 0.94);
    let renderedHeight = 0;

    do {
      pdf.addImage(
        imageData,
        "JPEG",
        margin,
        margin - renderedHeight,
        printableWidth,
        imageHeight,
        undefined,
        "FAST",
      );
      renderedHeight += printableHeight;

      if (renderedHeight < imageHeight) {
        pdf.addPage();
      }
    } while (renderedHeight < imageHeight);

    pdf.save(fileName);
  }

  window.saveForensaElementAsPdf = saveElementAsPdf;

  function getFilteredHistoryRows() {
    const query = historySearchInput
      ? historySearchInput.value.trim().toLowerCase()
      : "";

    return historyRowsCache.filter(function (row) {
      return [
        row.file_name,
        row.ai_classification,
        row.scan_or_digital,
        row.scan_detail,
        getHistoryDateSearchText(row.created_at),
      ].some(function (value) {
        return String(value || "").toLowerCase().includes(query);
      });
    });
  }

  async function loadImageDataUrl(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("Logo laporan tidak dapat dimuat.");
    }

    const blob = await response.blob();
    return await new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function saveHistoryAsPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("Library pembuat PDF belum berhasil dimuat.");
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    if (typeof pdf.autoTable !== "function") {
      throw new Error("Library tabel PDF belum berhasil dimuat.");
    }

    const rows = getFilteredHistoryRows();
    const printedAt = new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    let logoData = null;
    try {
      logoData = await loadImageDataUrl("assets/logo.png");
    } catch (error) {
      console.warn(error.message);
    }

    pdf.autoTable({
      startY: 38,
      margin: { top: 38, right: 11, bottom: 15, left: 11 },
      head: [["NO", "DOKUMEN", "TANGGAL", "KEYAKINAN", "DIGITAL/SCAN", "STATUS"]],
      body: rows.map(function (row, index) {
        const scanStatus = (row.scan_or_digital || "UNKNOWN").toUpperCase();
        return [
          index + 1,
          row.file_name || "-",
          formatDateOnly(row.created_at),
          row.persentase === null || row.persentase === undefined
            ? "-"
            : row.persentase + "%",
          scanStatus + (row.scan_confidence ? "\n" + row.scan_confidence : ""),
          (row.ai_classification || "PERLU REVIEW") +
            (row.scan_detail ? "\n" + row.scan_detail : ""),
        ];
      }),
      theme: "grid",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 2.2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        textColor: [30, 41, 59],
        valign: "middle",
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [100, 116, 139],
        fontStyle: "bold",
        lineColor: [219, 226, 234],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 70 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 44 },
        5: { cellWidth: "auto" },
      },
      didParseCell: function (data) {
        if (
          data.section === "body" &&
          data.row.index === rows.length - 1
        ) {
          data.cell.styles.lineWidth = {
            top: 0.2,
            right: 0.2,
            bottom: 0,
            left: 0.2,
          };
        }
      },
      didDrawPage: function (data) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(7, 7, pageWidth - 14, pageHeight - 14, 3, 3);

        if (logoData) {
          pdf.addImage(logoData, "PNG", 11, 11, 12, 12);
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(17, 24, 39);
        pdf.text("Forensa", 26, 15.5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text("LAYANAN VERIFIKASI DOKUMEN AKADEMIK", 26, 20);
        pdf.setDrawColor(79, 70, 229);
        pdf.setLineWidth(0.6);
        pdf.line(11, 27, pageWidth - 11, 27);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(17, 24, 39);
        pdf.text("Laporan Riwayat Verifikasi", 11, 33);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 116, 139);
        pdf.text("Tanggal cetak", pageWidth - 11, 14, { align: "right" });
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(17, 24, 39);
        pdf.text(printedAt, pageWidth - 11, 19, { align: "right" });
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          "Halaman " + data.pageNumber,
          pageWidth - 11,
          pageHeight - 9.5,
          { align: "right" },
        );
      },
    });

    pdf.save("laporan-riwayat-forensa.pdf");
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
    const isRecoveryPage =
      currentPage === "verify.html" &&
      sessionStorage.getItem("forensa_recovery_flow") === "true";

    if (protectedPages.includes(currentPage) && !session) {
      window.location.href = "login.html";
      return null;
    }

    if (authPages.includes(currentPage) && session && !isRecoveryPage) {
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

  function getHistoryDateSearchText(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return [
      String(value),
      date.toISOString().slice(0, 10),
      date.toLocaleDateString("id-ID"),
      date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      date.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    ]
      .join(" ")
      .toLowerCase();
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value === null || value === undefined ? "" : String(value);
    return element.innerHTML;
  }

  function renderHistoryRows(target, rows, options) {
    if (!target) {
      return;
    }

    const showRowNumber = options && options.showRowNumber;
    const columnCount = showRowNumber ? 7 : 6;

    if (!rows || rows.length === 0) {
      target.innerHTML =
        '<tr><td colspan="' +
        columnCount +
        '" class="table-empty">Belum ada riwayat yang sesuai.</td></tr>';
      return;
    }

    const showOnlyDate = options && options.showOnlyDate;
    const allowDelete = options && options.allowDelete;
    const rowNumberStart = (options && options.rowNumberStart) || 0;

    target.innerHTML = rows
      .map(function (row, rowIndex) {
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
          showRowNumber ? "<td>" + (rowNumberStart + rowIndex + 1) + "</td>" : "",
          "<td>" + escapeHtml(row.file_name) + "</td>",
          "<td>" + createdAt + "</td>",
          "<td>" + confidence + "</td>",
          '<td><div style="font-weight:700; color:#111827;">' +
            scanText +
            '</div><div style="font-size:11px; color:#64748b; margin-top:2px;">' +
            escapeHtml(row.scan_confidence ? row.scan_confidence.toUpperCase() : "-") +
            "</div></td>",
          '<td><span class="badge ' +
            classification.badgeClass +
            '">' +
            classification.label +
            '</span><div style="font-size:11px; color:#64748b; margin-top:6px;">' +
            escapeHtml(row.scan_detail ? row.scan_detail : "Tidak ada info scan") +
            "</div></td>",
          '<td><div class="history-actions"><a class="table-action" href="' +
            detailUrl +
            '">Detail</a>' +
            (allowDelete
              ? '<button type="button" class="table-action table-delete-action" data-history-id="' +
                escapeHtml(row.id) +
                '" data-file-name="' +
                escapeHtml(row.file_name) +
                '">Hapus</button>'
              : "") +
            "</div></td>",
          "</tr>",
        ].join("");
      })
      .join("");
  }

  function renderHistoryPagination() {
    if (!historyTableBody) {
      return;
    }

    const filteredRows = getFilteredHistoryRows();
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / historyPageSize));
    historyCurrentPage = Math.min(historyCurrentPage, totalPages);
    const startIndex = (historyCurrentPage - 1) * historyPageSize;
    const pageRows = filteredRows.slice(startIndex, startIndex + historyPageSize);

    renderHistoryRows(historyTableBody, pageRows, {
      showOnlyDate: true,
      allowDelete: true,
      showRowNumber: true,
      rowNumberStart: startIndex,
    });

    if (historyPaginationInfo) {
      const firstRow = filteredRows.length ? startIndex + 1 : 0;
      const lastRow = Math.min(startIndex + historyPageSize, filteredRows.length);
      historyPaginationInfo.textContent =
        "Menampilkan " + firstRow + "-" + lastRow + " dari " + filteredRows.length + " riwayat";
    }

    if (!historyPagination) {
      return;
    }

    const buttons = [];
    buttons.push(
      '<button type="button" class="history-page-btn" data-page="' +
        (historyCurrentPage - 1) +
        '"' +
        (historyCurrentPage === 1 ? " disabled" : "") +
        ">Sebelumnya</button>",
    );

    for (let page = 1; page <= totalPages; page += 1) {
      buttons.push(
        '<button type="button" class="history-page-btn' +
          (page === historyCurrentPage ? " active" : "") +
          '" data-page="' +
          page +
          '" aria-label="Halaman ' +
          page +
          '"' +
          (page === historyCurrentPage ? ' aria-current="page"' : "") +
          ">" +
          page +
          "</button>",
      );
    }

    buttons.push(
      '<button type="button" class="history-page-btn" data-page="' +
        (historyCurrentPage + 1) +
        '"' +
        (historyCurrentPage === totalPages ? " disabled" : "") +
        ">Berikutnya</button>",
    );
    historyPagination.innerHTML = buttons.join("");
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

    historyActiveSession = session;

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
      historyRowsCache = enrichedRows;
      renderHistoryPagination();
    }
  }

  async function deleteHistoryItem(historyId, fileName) {
    if (!supabaseClient || !historyActiveSession) {
      await showMessage("error", "Sesi tidak tersedia", "Silakan login kembali.");
      return;
    }

    let confirmed = false;

    if (window.Swal) {
      const result = await Swal.fire({
        icon: "warning",
        title: "Hapus riwayat?",
        text: 'Riwayat "' + fileName + '" akan dihapus permanen.',
        showCancelButton: true,
        confirmButtonText: "Ya, hapus",
        cancelButtonText: "Batal",
        confirmButtonColor: "#dc2626",
      });
      confirmed = result.isConfirmed;
    } else {
      confirmed = window.confirm(
        'Hapus riwayat "' + fileName + '"? Tindakan ini tidak dapat dibatalkan.',
      );
    }

    if (!confirmed) {
      return;
    }

    const { error } = await supabaseClient
      .from("history")
      .delete()
      .eq("id", historyId)
      .eq("user_id", historyActiveSession.user.id);

    if (error) {
      await showMessage("error", "Riwayat gagal dihapus", error.message);
      return;
    }

    historyRowsCache = historyRowsCache.filter(function (row) {
      return row.id !== historyId;
    });
    renderHistoryPagination();
    await showMessage(
      "success",
      "Riwayat dihapus",
      "Data riwayat berhasil dihapus.",
    );
  }

  if (historySearchInput) {
    historySearchInput.addEventListener("input", function () {
      historyCurrentPage = 1;
      renderHistoryPagination();
    });
  }

  if (historyPageSizeSelect) {
    historyPageSize = Number(historyPageSizeSelect.value) || 10;
    historyPageSizeSelect.addEventListener("change", function () {
      historyPageSize = Number(historyPageSizeSelect.value) || 10;
      historyCurrentPage = 1;
      renderHistoryPagination();
    });
  }

  if (historyPagination) {
    historyPagination.addEventListener("click", function (event) {
      const button = event.target.closest("[data-page]");
      if (!button || button.disabled) {
        return;
      }

      historyCurrentPage = Number(button.dataset.page) || 1;
      renderHistoryPagination();
    });
  }

  if (historyTableBody) {
    historyTableBody.addEventListener("click", function (event) {
      const deleteButton = event.target.closest("[data-history-id]");
      if (!deleteButton) {
        return;
      }

      deleteHistoryItem(
        deleteButton.dataset.historyId,
        deleteButton.dataset.fileName || "dokumen ini",
      );
    });
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
          emailRedirectTo: buildAbsolutePath("login.html"),
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
    const isRecoveryFlow =
      sessionStorage.getItem("forensa_recovery_flow") === "true";

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
      sessionStorage.removeItem("forensa_recovery_flow");
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
    });
  }

  if (saveHistoryPdfBtn) {
    saveHistoryPdfBtn.addEventListener("click", async function () {
      const originalText = saveHistoryPdfBtn.textContent;
      saveHistoryPdfBtn.disabled = true;
      saveHistoryPdfBtn.textContent = "Membuat PDF...";
      updateHistoryPrintDate();

      try {
        await saveHistoryAsPdf();
      } catch (error) {
        await showMessage("error", "PDF gagal dibuat", error.message);
      } finally {
        saveHistoryPdfBtn.disabled = false;
        saveHistoryPdfBtn.textContent = originalText;
      }
    });
  }

  if (printHistoryBtn) {
    printHistoryBtn.addEventListener("click", function () {
      window.print();
    });
  }

  if (saveDetailPdfBtn) {
    saveDetailPdfBtn.addEventListener("click", async function () {
      const originalText = saveDetailPdfBtn.textContent;
      const detailFileName = document.getElementById("detail-file-name");
      const safeName = sanitizePdfFileName(
        detailFileName ? detailFileName.textContent : "detail",
      );
      saveDetailPdfBtn.disabled = true;
      saveDetailPdfBtn.textContent = "Membuat PDF...";

      try {
        await saveElementAsPdf(
          document.getElementById("reportRoot"),
          "laporan-detail-" + safeName + ".pdf",
          "portrait",
        );
      } catch (error) {
        await showMessage("error", "PDF gagal dibuat", error.message);
      } finally {
        saveDetailPdfBtn.disabled = false;
        saveDetailPdfBtn.textContent = originalText;
      }
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
