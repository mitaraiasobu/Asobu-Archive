/* app.js (FULL / working) */

const state = {
  lang: "ja",
  i18n: {},
  events: []
};

let modalPage = 0; // 0: media, 1: details
let modalMode = "video"; // 'video' or 'image'
let modalMinPage = 0;
let modalMaxPage = 1;

const $ = (sel) => document.querySelector(sel);

let _wired = false; // avoid duplicate event listeners

// イベントグリッドの動画要素を保持
let eventVideoElements = [];

function setActiveTab(tabKey) {
  document.querySelectorAll(".tab").forEach((a) => {
    a.classList.toggle("active", a.dataset.tab === tabKey);
  });
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));

  const page = $(`#page-${tabKey}`);
  if (page) page.classList.add("active");
}

function t(path) {
  const parts = path.split(".");
  let cur = state.i18n;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return path;
  }
  return cur;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatDateISO(iso) {
  // state.lang: "ja" | "en" | "ko"
  const locale =
    state.lang === "ja" ? "ja-JP" :
    state.lang === "ko" ? "ko-KR" :
    "en-US";

  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(d);
}

function formatPeriod(start, end) {
  if (!start && !end) return "";

  const s = isISODate(start) ? formatDateISO(start) : (start || "");
  let e = "";

  if (isISODate(end)) {
    e = formatDateISO(end);
  } else if (end) {
    // 🔥 ここでキー翻訳する
    e = t(`eventPeriod.${end}`);
    if (!e || e === `eventPeriod.${end}`) e = end; // fallback
  }

  if (s && e) return `${s} 〜 ${e}`;
  if (s && !e) return `${s} 〜`;
  return "";
}


function renderStaticTexts() {
  // Tabs label
  document.querySelectorAll(".tab").forEach((a) => {
    a.textContent = t(`tabs.${a.dataset.tab}`);
  });

  // Static texts
  const scheduleNoteLabel = $("#scheduleNoteLabel");
  const scheduleNoteText = $("#scheduleNoteText");
  if (scheduleNoteLabel) scheduleNoteLabel.textContent = t("schedule.noteLabel");
  if (scheduleNoteText) scheduleNoteText.innerHTML = t("schedule.noteHtml");

  const homeHeadline = $("#homeHeadline");
  const homeLead = $("#homeLead");
  if (homeHeadline) homeHeadline.textContent = t("home.headline");
  if (homeLead) homeLead.textContent = t("home.lead");

  const scheduleTitle = $("#scheduleTitle");
  const scheduleHint = $("#scheduleHint");
  if (scheduleTitle) scheduleTitle.textContent = t("schedule.title");
  if (scheduleHint) scheduleHint.textContent = t("schedule.hint");

  const eventsTitle = $("#eventsTitle");
  const eventsHint = $("#eventsHint");
  if (eventsTitle) eventsTitle.textContent = t("events.title");
  if (eventsHint) eventsHint.textContent = t("events.hint");

  const aboutTitle = $("#aboutTitle");
  const aboutBody = $("#aboutBody");
  if (aboutTitle) aboutTitle.textContent = t("about.title");
  if (aboutBody) aboutBody.innerHTML = t("about.bodyHtml");

  const supportTitle = $("#supportTitle");
  const supportBody = $("#supportBody");
  if (supportTitle) supportTitle.textContent = t("support.title");
  if (supportBody) supportBody.innerHTML = t("support.bodyHtml");

  const goodsTitle = $("#goodsTitle");
  const goodsBody = $("#goodsBody");
  if (goodsTitle) goodsTitle.textContent = t("goods.title");
  if (goodsBody) goodsBody.innerHTML = t("goods.bodyHtml");

  const logTitle = $("#logTitle");
  const logBody = $("#logBody");
  if (logTitle) logTitle.textContent = t("log.title");
  if (logBody) logBody.innerHTML = t("log.bodyHtml");

  // fanclub (exists only if you add it in index.html)
  const fcTitle = document.getElementById("fanclubTitle");
  const fcBody = document.getElementById("fanclubBody");
  if (fcTitle) fcTitle.textContent = t("fanclub.title");
  if (fcBody) fcBody.innerHTML = t("fanclub.bodyHtml");

  const noticeTitle = document.getElementById("noticeTitle");
  const noticeBody = document.getElementById("noticeBody");
  if (noticeTitle) noticeTitle.textContent = t("notice.title");
  if (noticeBody) noticeBody.innerHTML = t("notice.bodyHtml");


  const contactTitle = $("#contactTitle");
  const contactBody = $("#contactBody");
  if (contactTitle) contactTitle.textContent = t("contact.title");
  if (contactBody) contactBody.innerHTML = t("contact.bodyHtml");

  const footerNote = $("#footerNote");
  if (footerNote) footerNote.textContent = t("footer.note");
}

function renderEvents() {
  const grid = $("#eventsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  eventVideoElements = []; // リセット

  state.events.forEach((ev) => {
    const detail = t(`eventDetails.${ev.id}`);
    const title = detail?.title || ev.id;

    // compat (old events.json)
    const mediaType = ev.mediaType || "image";
    const src = ev.src || ev.image || "";
    const poster = ev.poster || "";

    const card = document.createElement("div");
    card.className = "event";

    const media = document.createElement("div");
    media.className = "event__media";

    if (mediaType === "video") {
      media.innerHTML = `
        <video
          src="${src}"
          poster="${poster}"
          muted
          loop
          autoplay
          playsinline
          preload="metadata"
        ></video>
      `;
      // 動画要素を保持
      setTimeout(() => {
        const videoEl = media.querySelector("video");
        if (videoEl) eventVideoElements.push(videoEl);
      }, 0);
    } else {
      media.innerHTML = `<img src="${src}" alt="">`;
    }

    const body = document.createElement("div");
    body.className = "event__body";
    body.innerHTML = `
      <h3 class="event__title">${escapeHtml(title)}</h3>
      <div class="event__meta">
        <span>${escapeHtml(ev.status || "")}</span>
        <span>${escapeHtml(formatPeriod(ev.start, ev.end))}</span>
      </div>
    `;

    card.appendChild(media);
    card.appendChild(body);

    card.addEventListener("click", () =>
      openModal({
        ...ev,
        // modal uses image; for video events prefer poster
        image: mediaType === "video" ? (poster || src) : src
      })
    );

    grid.appendChild(card);
  });
}

async function openModal(ev) {
  const modal = $("#modal");
  if (!modal) return;

  const mediaWrapMain = $("#modalMediaMain");
  const mediaWrapDetail = $("#modalMediaDetail");

  const detail = t(`eventDetails.${ev.id}`);
  const title = detail?.title || ev.id;
  const descHtml = detail?.descHtml || "";

  const mediaType = ev.mediaType || "image";
  const src = ev.src || ev.image || "";
  const poster = ev.poster || "";

  const modalTitle = $("#modalTitle");
  const modalPeriod = $("#modalPeriod");
  const modalDesc = $("#modalDesc");
  if (modalTitle) modalTitle.textContent = title;
  if (modalPeriod) modalPeriod.textContent = formatPeriod(ev.start, ev.end);
  if (modalDesc) modalDesc.innerHTML = descHtml;

  const linksWrap = $("#modalLinks");
  if (linksWrap) {
    linksWrap.innerHTML = "";
    (ev.links || []).forEach((l) => {
      const a = document.createElement("a");
      a.className = "btn primary";
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = t(l.labelKey) || "Open";
      linksWrap.appendChild(a);
    });
  }

  const hint = $("#modalHint");
  if (hint) {
    hint.textContent =
      mediaType === "video"
        ? "‹ › でページ切替(1:動画 / 2:画像+詳細)・画像タップで拡大"
        : "画像+詳細(画像タップで拡大)";
  }

  // draw media
  if (mediaWrapMain) mediaWrapMain.innerHTML = "";
  if (mediaWrapDetail) mediaWrapDetail.innerHTML = "";

  if (mediaType === "video") {
    // Page 1: video only
    const v = document.createElement("video");
    v.src = src;
    v.poster = poster || "";
    v.controls = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.loop = true;
    v.muted = false;
    if (mediaWrapMain) mediaWrapMain.appendChild(v);

    // Page 2: poster image + details
    const img = document.createElement("img");
    img.src = poster || src;
    img.alt = title;
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => openLightbox(img.src));
    if (mediaWrapDetail) mediaWrapDetail.appendChild(img);

    try {
      await v.play();
    } catch {}

    modalMode = "video";
    modalMinPage = 0;
    modalMaxPage = 1;
  } else {
    // Image: only page 2 (details)
    const img = document.createElement("img");
    img.src = src;
    img.alt = title;
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => openLightbox(src));
    if (mediaWrapDetail) mediaWrapDetail.appendChild(img);

    modalMode = "image";
    modalMinPage = 1;
    modalMaxPage = 1;
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setModalPage(modalMinPage);
}

function closeModal() {
  const v = $("#modalMediaMain")?.querySelector("video");
  if (v) {
    try {
      v.pause();
    } catch {}
    v.removeAttribute("src");
    v.load();
  }

  const modal = $("#modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function setModalPage(p) {
  modalPage = Math.max(modalMinPage, Math.min(modalMaxPage, p));
  document.querySelectorAll(".carpage").forEach((sec) => {
    sec.classList.toggle("active", Number(sec.dataset.page) === modalPage);
  });

  // 動画ページから離れる場合は動画を停止
  const videoEl = $("#modalMediaMain")?.querySelector("video");
  if (videoEl && modalPage !== 0) {
    try {
      videoEl.pause();
    } catch {}
  }

  const prev = $("#carPrev");
  const next = $("#carNext");
  if (prev) prev.disabled = modalPage === modalMinPage;
  if (next) next.disabled = modalPage === modalMaxPage;

  const onePage = modalMinPage === modalMaxPage;
  if (prev) prev.style.display = onePage ? "none" : "";
  if (next) next.style.display = onePage ? "none" : "";
}

function openLightbox(imgUrl) {
  const lb = $("#lightbox");
  const img = $("#lightboxImg");
  if (!lb || !img) return;

  img.src = imgUrl;
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  const lb = $("#lightbox");
  const img = $("#lightboxImg");
  if (!lb || !img) return;

  lb.classList.remove("open");
  lb.setAttribute("aria-hidden", "true");
  img.src = "";
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

async function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("lang", lang);

  // ★重要:data-lang を持つ chip だけを対象にする(SNSリンクが chip でも安全)
  document.querySelectorAll(".chip[data-lang]").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });

  state.i18n = await loadJSON(`./i18n/${lang}.json`);
  document.documentElement.lang = lang === "ja" ? "ja" : (lang === "ko" ? "ko" : "en");

  renderStaticTexts();
  renderEvents();
}

function handleRoute() {
  const hash = location.hash.replace("#", "") || "home";
  const known = ["home", "about", "support", "goods", "log", "fanclub", "notice", "contact"];
  const tab = known.includes(hash) ? hash : "home";
  setActiveTab(tab);
}

// ページの表示/非表示を監視して動画を停止
function setupVisibilityHandler() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // ページが非表示になったら全ての動画を停止
      eventVideoElements.forEach(video => {
        try {
          video.pause();
        } catch {}
      });

      // モーダル内の動画も停止
      const modalVideo = $("#modalMediaMain")?.querySelector("video");
      if (modalVideo) {
        try {
          modalVideo.pause();
        } catch {}
      }
    }
  });
}

// ハンバーガーメニューのスクロール制御
function setupHamburgerScrollBehavior() {
  const navToggle = document.getElementById("navToggle");
  if (!navToggle) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        
        // 下にスクロールしている場合は非表示
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          navToggle.classList.add("hidden");
        } 
        // 上にスクロールしている場合は表示
        else if (currentScrollY < lastScrollY) {
          navToggle.classList.remove("hidden");
        }
        
        // 最上部にいる場合は常に表示
        if (currentScrollY < 50) {
          navToggle.classList.remove("hidden");
        }
        
        lastScrollY = currentScrollY;
        ticking = false;
      });
      
      ticking = true;
    }
  });
}

function wireOnce() {
  if (_wired) return;
  _wired = true;

  // Modal close
  const modalClose = $("#modalClose");
  const modalBackdrop = $("#modalBackdrop");
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Carousel buttons
  const prev = $("#carPrev");
  const next = $("#carNext");
  if (prev) {
    prev.addEventListener("click", (e) => {
      e.stopPropagation();
      setModalPage(modalPage - 1);
    });
  }
  if (next) {
    next.addEventListener("click", (e) => {
      e.stopPropagation();
      setModalPage(modalPage + 1);
    });
  }

  // Keyboard paging
  window.addEventListener("keydown", (e) => {
    const modal = $("#modal");
    if (!modal || !modal.classList.contains("open")) return;
    if (e.key === "ArrowLeft") setModalPage(modalPage - 1);
    if (e.key === "ArrowRight") setModalPage(modalPage + 1);
  });

  // Lightbox close
  const lbBackdrop = $("#lightboxBackdrop");
  const lbImg = $("#lightboxImg");
  if (lbBackdrop) lbBackdrop.addEventListener("click", closeLightbox);
  if (lbImg) lbImg.addEventListener("click", closeLightbox);

  // Route
  window.addEventListener("hashchange", handleRoute);

  // Support tab: reveal PayPay QR / 99999 image
  document.addEventListener("click", (e) => {
    const el = e.target;

    if (el && el.id === "paypayLink") {
      const area = document.getElementById("paypayArea");
      if (area) area.style.display = "block";
    }
    if (el && el.id === "pushBtn") {
      const area = document.getElementById("pushImage");
      if (area) area.style.display = "block";
    }
  });
    // ===== Mobile tabs (hamburger) =====
  const navToggle = document.getElementById("navToggle");
  const navPanel = document.getElementById("navPanel");
  const navBackdrop = document.getElementById("navBackdrop");

  const closeNav = () => {
    if (!navPanel) return;
    navPanel.classList.remove("open");
    navPanel.setAttribute("aria-hidden", "true");
    navToggle?.setAttribute("aria-expanded", "false");
  };

  const openNav = () => {
    if (!navPanel) return;
    navPanel.classList.add("open");
    navPanel.setAttribute("aria-hidden", "false");
    navToggle?.setAttribute("aria-expanded", "true");
  };

  navToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!navPanel) return;
    navPanel.classList.contains("open") ? closeNav() : openNav();
  });

  navBackdrop?.addEventListener("click", closeNav);

  // メニュー内のリンクを押したら閉じる(hashchange前に閉じる)
  navPanel?.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a");
    if (a) closeNav();
  });

  // 画面サイズがPCに戻ったら閉じる(バグり防止)
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 769px)").matches) closeNav();
  });

  // ページ表示/非表示の監視を設定
  setupVisibilityHandler();
  
  // ハンバーガーメニューのスクロール制御を設定
  setupHamburgerScrollBehavior();
}

async function init() {
  wireOnce();

  // Events (optional)
  try {
    state.events = await loadJSON("./data/events.json");
  } catch {
    state.events = [];
  }

  // ★重要:言語切替は data-lang 付きだけ
  document.querySelectorAll(".chip[data-lang]").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });

  const saved = localStorage.getItem("lang");
  await setLang(saved || "ja");

  handleRoute();
}

init().catch((err) => {
  console.error(err);
  alert("初期化に失敗しました。コンソールを確認してください。");
});
