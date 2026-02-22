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


  const cfBody = document.getElementById("crowdfundingBody");
  if (cfBody) cfBody.innerHTML = t("crowdfunding.bodyHtml");

  const contestBody = document.getElementById("contestBody");
  if (contestBody) {
    // __PROMO_TITLE__ を翻訳テキストに置換してから注入
    const contestHtml = t("contest.bodyHtml").replace(
      "__PROMO_TITLE__",
      escapeHtml(t("contest.promoTitle") || "コンテスト一覧")
    );
    contestBody.innerHTML = contestHtml;

    // モバイル向け注意バナーを先頭に挿入（スマホのみ表示）
    const bannerMsg = t("contest.mobileBanner");
    const existingBanner = document.getElementById("ct-mobile-banner");
    if (!existingBanner) {
      const banner = document.createElement("div");
      banner.id = "ct-mobile-banner";
      banner.className = "ct-mobile-banner";
      banner.innerHTML = `
        <span class="ct-mobile-banner__text">${escapeHtml(bannerMsg)}</span>
        <button class="ct-mobile-banner__close" aria-label="Close">✕</button>
      `;
      banner.querySelector(".ct-mobile-banner__close").addEventListener("click", () => {
        banner.style.display = "none";
      });
      contestBody.insertBefore(banner, contestBody.firstChild);
    }
    initContest();
  }

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

    // linkTab: タブ移動ボタン
    if (ev.linkTab) {
      const btn = document.createElement("button");
      btn.className = "btn primary";
      btn.textContent = t("event.detailsBtn") || "詳細 →";
      btn.addEventListener("click", () => {
        closeModal();
        location.hash = ev.linkTab;
      });
      linksWrap.appendChild(btn);
    }

    // 通常の外部リンク
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
  document.body.classList.add("modal-open");

  // 左カラム（動画）: image型は非表示、かつimage-onlyクラスで中央寄せ
  const page0 = document.querySelector('.carpage[data-page="0"]');
  const page1 = document.querySelector('.carpage[data-page="1"]');
  const carousel = document.querySelector('.modal__carousel');
  if (page0) page0.style.display = mediaType === "video" ? "" : "none";
  if (page1) page1.style.display = "";
  if (carousel) carousel.classList.toggle("modal__carousel--image-only", mediaType !== "video");
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
  document.body.classList.remove("modal-open");
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
  const known = ["home", "about", "support", "goods", "log", "fanclub", "notice", "contact", "crowdfunding", "contest"];
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

  // Carousel buttons: 不要なので非表示
  const prev = $("#carPrev");
  const next = $("#carNext");
  if (prev) prev.style.display = "none";
  if (next) next.style.display = "none";

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

  // スケジュール画像タップで全画面（ライトボックス）
  const scheduleImg = document.getElementById("scheduleImg");
  if (scheduleImg) {
    scheduleImg.style.cursor = "zoom-in";
    scheduleImg.addEventListener("click", () => openLightbox(scheduleImg.src));
  }
}

// ===== Support tab accordion =====
function toggleAcc(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
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



// ===================================================================
// CONTEST TAB LOGIC
// Called from renderStaticTexts() after contestBody.innerHTML is set
// ===================================================================
// Persistent state: survives language switches (innerHTML rebuild)
let _ct = null;

function initContest() {
  const canvas = document.getElementById('ct-canvas');
  if (!canvas) return;  // HTML not yet injected

  const ctx        = canvas.getContext('2d', { willReadFrequently: true });
  const hsvPicker  = document.getElementById('ct-hsv-picker');
  const hsvPickerM = document.getElementById('ct-hsv-picker-m');

  // Restore from previous state, or start fresh
  let hue          = _ct ? _ct.hue          : 0;
  let sat          = _ct ? _ct.sat          : 100;
  let bri          = _ct ? _ct.bri          : 100;
  let ctColor      = _ct ? _ct.ctColor      : '#ff0000';
  let ctPalette    = _ct ? _ct.ctPalette    : [];
  let selectedLayer= _ct ? _ct.selectedLayer: null;
  let fixedVisible = _ct ? _ct.fixedVisible : true;
  let loadedImgs   = _ct ? _ct.loadedImgs   : {};
  let loadCnt      = _ct ? _ct.loadCnt      : 0;
  let ctZoom       = _ct ? _ct.ctZoom       : 100;

  const layerImageUrls = {
    1:'./images/1.png',  2:'./images/2.png',  3:'./images/3.png',
    4:'./images/4.png',  5:'./images/5.png',  6:'./images/6.png',
    7:'./images/7.png',  8:'./images/8.png',  9:'./images/9.png',
    10:'./images/10.png',11:'./images/11.png',12:'./images/12.png',
    13:'./images/13.png'
  };

  const ctLayers = [
    { id:'background', name:'背景',       color:'#ffffff', visible:true, isBackground:true },
    { id:2,  name:'帽子',       color:null, visible:true },
    { id:3,  name:'フリル',     color:null, visible:true },
    { id:4,  name:'ライン',     color:null, visible:true },
    { id:5,  name:'胸リボン',   color:null, visible:true },
    { id:6,  name:'上着',       color:null, visible:true },
    { id:7,  name:'靴下リボン', color:null, visible:true },
    { id:8,  name:'靴下',       color:null, visible:true },
    { id:9,  name:'スカート',   color:null, visible:true },
    { id:10, name:'靴',         color:null, visible:true },
    { id:11, name:'髪リボン',   color:null, visible:true },
    { id:12, name:'イヤリング', color:null, visible:true },
    { id:13, name:'襟',         color:null, visible:true },
  ];

  // Restore layer colors & visibility from previous state
  if (_ct && _ct.layers) {
    _ct.layers.forEach(function(s) {
      const l = ctLayers.find(function(x) { return x.id === s.id; });
      if (l) { l.color = s.color; l.visible = s.visible; }
    });
  }

  // --- Color math ---
  function hsbToHex(h, s, b) {
    s /= 100; b /= 100;
    const c = b * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = b - c;
    let r = 0, g = 0, bl = 0;
    if      (h <  60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; bl = x; }
    else if (h < 240) { g = x; bl = c; }
    else if (h < 300) { r = x; bl = c; }
    else              { r = c; bl = x; }
    r = Math.round((r + m) * 255); g = Math.round((g + m) * 255); bl = Math.round((bl + m) * 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : {r:255,g:255,b:255};
  }

  // --- Color picker update ---
  function updateCtColor() {
    ctColor = hsbToHex(hue, sat, bri);
    const pureHue = 'hsl(' + hue + ',100%,50%)';
    if (hsvPicker)  hsvPicker.style.background  = pureHue;
    if (hsvPickerM) hsvPickerM.style.background = pureHue;
    const xPct = (sat / 100 * 100) + '%';
    const yPct = ((100 - bri) / 100 * 100) + '%';
    ['ct-hsv-cursor','ct-hsv-cursor-m'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) { el.style.left = xPct; el.style.top = yPct; }
    });
    const huePct = (hue / 360 * 100) + '%';
    ['ct-cursor','ct-cursor-m'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.style.left = huePct;
    });
    ['ct-preview','ct-preview-m'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.style.backgroundColor = ctColor;
    });
    ['ct-hex','ct-hex-m'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.value = ctColor;
    });
  }

  function hsvPickerInteract(e, picker) {
    const rect = picker.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    sat = Math.round(Math.max(0, Math.min(100, (clientX - rect.left) / rect.width  * 100)));
    bri = Math.round(Math.max(0, Math.min(100, 100 - (clientY - rect.top) / rect.height * 100)));
    updateCtColor();
  }

  function hueBarInteract(e, wrap) {
    const rect = wrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    hue = Math.round(Math.max(0, Math.min(360, (clientX - rect.left) / rect.width * 360)));
    updateCtColor();
  }

  // --- Palette ---
  function loadCtPalette() {
    try { const s = localStorage.getItem('ctPalette'); if (s) ctPalette = JSON.parse(s); } catch(e) {}
  }
  function saveCtPalette() {
    try { localStorage.setItem('ctPalette', JSON.stringify(ctPalette)); } catch(e) {}
  }
  function addToCtPalette() {
    if (ctPalette.length >= 24) { alert('マイパレットは最大24色です。'); return; }
    if (!ctPalette.includes(ctColor)) { ctPalette.push(ctColor); saveCtPalette(); renderCtPalettes(); }
  }
  function renderCtPalettes() {
    ['ct-custom-palette','ct-custom-palette-m'].forEach(function(id) {
      const el = document.getElementById(id); if (!el) return; el.innerHTML = '';
      ctPalette.forEach(function(c, i) {
        const sw = document.createElement('div');
        sw.className = 'ct-palette-swatch'; sw.style.backgroundColor = c; sw.title = c;
        const del = document.createElement('button');
        del.style.cssText = 'position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:9px;cursor:pointer;display:none;align-items:center;justify-content:center;';
        del.textContent = 'x';
        sw.addEventListener('mouseenter', function() { del.style.display = 'flex'; });
        sw.addEventListener('mouseleave', function() { del.style.display = 'none'; });
        del.onclick = function(e) { e.stopPropagation(); ctPalette.splice(i,1); saveCtPalette(); renderCtPalettes(); };
        sw.appendChild(del);
        sw.onclick = function() {
          ctColor = c;
          ['ct-preview','ct-preview-m'].forEach(function(pid) { const pe=document.getElementById(pid); if(pe) pe.style.backgroundColor=c; });
          ['ct-hex','ct-hex-m'].forEach(function(hid) { const he=document.getElementById(hid); if(he) he.value=c; });
        };
        el.appendChild(sw);
      });
    });
  }
  function resetCtPalette() {
    if (!ctPalette.length) { alert('マイパレットは空です。'); return; }
    if (confirm('マイパレットをリセットしますか？')) { ctPalette = []; saveCtPalette(); renderCtPalettes(); }
  }

  // --- Image loading ---
  function loadCtImages() {
    const total = Object.keys(layerImageUrls).length;
    const loadingEl = document.getElementById('ct-loading');
    if (loadingEl) loadingEl.style.display = 'block';
    Object.entries(layerImageUrls).forEach(function([id, url]) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function() {
        loadedImgs[id] = img; loadCnt++;
        if (loadCnt === total) { if(loadingEl) loadingEl.style.display='none'; drawCtCanvas(); }
      };
      img.onerror = function() {
        loadCnt++;
        if (loadCnt === total) {
          if(loadingEl) loadingEl.style.display='none';
          const errEl = document.getElementById('ct-error'); if(errEl) errEl.style.display='block';
          drawCtCanvas();
        }
      };
      img.src = url;
    });
  }

  // --- Layer list ---
  function renderCtLayerList(listId, isMobile) {
    const list = document.getElementById(listId); if (!list) return; list.innerHTML = '';
    const eyeCls = 'ct-eye-btn' + (isMobile ? ' ct-eye-btn-m' : '');
    const fi = document.createElement('div'); fi.className = 'ct-layer-item fixed';
    fi.innerHTML = '<div class="ct-layer-left"><span class="ct-layer-name">レイヤー1 (固定)</span></div>'
      + '<button class="' + eyeCls + '" data-layer="fixed">' + (fixedVisible ? '👁️' : '👁️‍🗨️') + '</button>';
    list.appendChild(fi);
    ctLayers.forEach(function(layer) {
      if (layer.isBackground) return;
      const el = document.createElement('div');
      el.className = 'ct-layer-item' + (selectedLayer === layer.id ? ' selected' : '');
      el.innerHTML = '<div class="ct-layer-left"><div class="ct-layer-swatch" style="background:' + (layer.color||'#ffffff') + '"></div>'
        + '<span class="ct-layer-name">' + layer.name + '</span></div>'
        + '<button class="' + eyeCls + '" data-layer="' + layer.id + '">' + (layer.visible ? '👁️' : '👁️‍🗨️') + '</button>';
      el.onclick = function(e) {
        if (e.target.closest('.ct-eye-btn')) return;
        selectedLayer = layer.id;
        renderCtLayerList('ct-layer-list', false);
        renderCtLayerList('ct-layer-list-m', true);
      };
      list.appendChild(el);
    });
    list.querySelectorAll('.ct-eye-btn' + (isMobile ? '-m' : '')).forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        const lid = btn.getAttribute('data-layer');
        if (lid === 'fixed') { fixedVisible = !fixedVisible; }
        else { const l = ctLayers.find(function(x) { return x.id === parseInt(lid); }); if (l) l.visible = !l.visible; }
        renderCtLayerList('ct-layer-list', false);
        renderCtLayerList('ct-layer-list-m', true);
        drawCtCanvas();
      };
    });
  }

  // --- Canvas draw ---
  function drawCtCanvas() {
    if (!Object.keys(loadedImgs).length) return;
    const fi = loadedImgs[1]; if (!fi) return;
    canvas.width = fi.width / 2; canvas.height = fi.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctLayers.forEach(function(layer) {
      if (!layer.visible) return;
      if (layer.isBackground) { ctx.fillStyle = layer.color||'#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); return; }
      const img = loadedImgs[layer.id]; if (!img) return;
      if (layer.color) {
        const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
        const tc2 = tc.getContext('2d'); tc2.drawImage(img,0,0,tc.width,tc.height);
        const id2 = tc2.getImageData(0,0,tc.width,tc.height); const dd = id2.data;
        const rgb = hexToRgb(layer.color);
        for (let i = 0; i < dd.length; i += 4) { if (dd[i+3] > 0) { dd[i]=rgb.r; dd[i+1]=rgb.g; dd[i+2]=rgb.b; } }
        tc2.putImageData(id2,0,0); ctx.drawImage(tc,0,0);
      } else { ctx.drawImage(img,0,0,canvas.width,canvas.height); }
    });
    if (fixedVisible) { const fi2 = loadedImgs[1]; if(fi2) ctx.drawImage(fi2,0,0,canvas.width,canvas.height); }
  }

  // --- Apply/Reset ---
  function ctApplyColor() {
    if (!selectedLayer) { alert('レイヤーを選択してください'); return; }
    const l = ctLayers.find(function(x) { return x.id === selectedLayer; });
    if (l) { l.color = ctColor; renderCtLayerList('ct-layer-list',false); renderCtLayerList('ct-layer-list-m',true); drawCtCanvas(); }
  }
  function ctResetAll() {
    if (confirm('すべてのレイヤーの色をリセットしますか？')) {
      ctLayers.forEach(function(l) { l.color = l.isBackground ? '#ffffff' : null; });
      renderCtLayerList('ct-layer-list',false); renderCtLayerList('ct-layer-list-m',true); drawCtCanvas();
    }
  }

  // --- Download / Tweet ---
  function ctDownload() { const a=document.createElement('a'); a.download='coloring_contest.png'; a.href=canvas.toDataURL(); a.click(); }
  function ctTweet() {
    ctDownload();
    const txt = encodeURIComponent('#御手洗みたら 御手洗遊 新衣装 塗り絵コンテストに参加しました!\n(画像が自動ダウンロードされました。画像を添付して投稿してください!)');
    window.open('https://twitter.com/intent/tweet?text=' + txt, '_blank');
  }

  // --- Slide panel ---
  function ctTogglePanel() {
    ['ct-slide-panel','ct-overlay','ct-panel-close-btn'].forEach(function(id) {
      const el = document.getElementById(id); if(el) el.classList.toggle('active');
    });
  }
  function ctClosePanel() {
    ['ct-slide-panel','ct-overlay','ct-panel-close-btn'].forEach(function(id) {
      const el = document.getElementById(id); if(el) el.classList.remove('active');
    });
  }

  // --- Promo image modal ---
  function ctOpenModal(src, alt) {
    const m = document.getElementById('ct-img-modal'); if(!m) return;
    const img = document.getElementById('ct-modal-img'); if(img){ img.src=src; img.alt=alt||''; }
    m.classList.add('active'); ctZoom=100; ctUpdateZoom();
  }
  function ctCloseModal() {
    const m = document.getElementById('ct-img-modal'); if(!m) return;
    m.classList.remove('active');
    const img = document.getElementById('ct-modal-img'); if(img) img.src='';
  }
  function ctUpdateZoom() {
    const img    = document.getElementById('ct-modal-img');
    const slider = document.getElementById('ct-zoom-slider');
    const pct    = document.getElementById('ct-zoom-pct');
    if(img)    img.style.transform = 'scale(' + (ctZoom/100) + ')';
    if(slider) slider.value = ctZoom;
    if(pct)    pct.textContent = ctZoom + '%';
  }


  // --- Eyedropper (スポイト) ---
  let eyedropMode = false;

  function toggleEyedrop() {
    eyedropMode = !eyedropMode;
    const btn  = document.getElementById('ct-eyedrop');
    const btnM = document.getElementById('ct-eyedrop-m');
    const hint = document.getElementById('ct-eyedrop-hint');
    const wrap = document.querySelector('.ct-canvas-wrap');
    [btn, btnM].forEach(function(b) {
      if (b) b.classList.toggle('active', eyedropMode);
    });
    if (hint) hint.classList.toggle('active', eyedropMode);
    if (wrap) wrap.classList.toggle('eyedrop-mode', eyedropMode);
  }

  function pickColorFromCanvas(e) {
    if (!eyedropMode) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Scale from display size to actual canvas pixel coords
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = Math.round((clientX - rect.left) * scaleX);
    const py = Math.round((clientY - rect.top)  * scaleY);

    // Clamp to canvas bounds
    const cx = Math.max(0, Math.min(canvas.width  - 1, px));
    const cy = Math.max(0, Math.min(canvas.height - 1, py));

    const pixel = ctx.getImageData(cx, cy, 1, 1).data;
    const r = pixel[0], g = pixel[1], b = pixel[2];
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

    // Set as current color
    ctColor = hex;
    ['ct-preview','ct-preview-m'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.style.backgroundColor = hex;
    });
    ['ct-hex','ct-hex-m'].forEach(function(id) {
      const el = document.getElementById(id); if (el) el.value = hex;
    });

    // Turn off eyedrop mode after picking
    eyedropMode = false;
    const btn  = document.getElementById('ct-eyedrop');
    const btnM = document.getElementById('ct-eyedrop-m');
    const hint = document.getElementById('ct-eyedrop-hint');
    const wrap = document.querySelector('.ct-canvas-wrap');
    [btn, btnM].forEach(function(b) { if (b) b.classList.remove('active'); });
    if (hint) hint.classList.remove('active');
    if (wrap) wrap.classList.remove('eyedrop-mode');
  }

  // === Wire all events ===

  // DL bar close button
  const dlClose = document.getElementById('ct-dlbar-close');
  if (dlClose) dlClose.onclick = function() { const b=document.getElementById('ct-dlbar'); if(b) b.style.display='none'; };

  // Eyedropper button
  const eyeBtn  = document.getElementById('ct-eyedrop');
  const eyeBtnM = document.getElementById('ct-eyedrop-m');
  if (eyeBtn)  eyeBtn.onclick  = toggleEyedrop;
  if (eyeBtnM) eyeBtnM.onclick = toggleEyedrop;

  // Canvas click/touch for eyedropper
  canvas.addEventListener('click',      pickColorFromCanvas);
  canvas.addEventListener('touchstart', pickColorFromCanvas, {passive:false});

  // Hue bar - all .ct-colorbar-wrap elements
  document.querySelectorAll('.ct-colorbar-wrap').forEach(function(wrap) {
    let dragging = false;
    wrap.addEventListener('mousedown', function(e) { dragging=true; hueBarInteract(e,wrap); });
    wrap.addEventListener('mousemove', function(e) { if(dragging) hueBarInteract(e,wrap); });
    window.addEventListener('mouseup', function() { dragging=false; });
    wrap.addEventListener('touchstart', function(e) { e.preventDefault(); hueBarInteract(e,wrap); }, {passive:false});
    wrap.addEventListener('touchmove',  function(e) { e.preventDefault(); hueBarInteract(e,wrap); }, {passive:false});
  });

  // HSV picker drag
  [hsvPicker, hsvPickerM].forEach(function(picker) {
    if (!picker) return;
    let dragging = false;
    picker.addEventListener('mousedown', function(e) { dragging=true; hsvPickerInteract(e,picker); });
    picker.addEventListener('mousemove', function(e) { if(dragging) hsvPickerInteract(e,picker); });
    window.addEventListener('mouseup', function() { dragging=false; });
    picker.addEventListener('touchstart', function(e) { e.preventDefault(); hsvPickerInteract(e,picker); }, {passive:false});
    picker.addEventListener('touchmove',  function(e) { e.preventDefault(); hsvPickerInteract(e,picker); }, {passive:false});
  });

  // Hex input
  ['ct-hex','ct-hex-m'].forEach(function(id) {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('change', function(e) {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        ctColor = e.target.value;
        ['ct-preview','ct-preview-m'].forEach(function(pid){ const pe=document.getElementById(pid); if(pe) pe.style.backgroundColor=ctColor; });
        ['ct-hex','ct-hex-m'].forEach(function(hid){ const he=document.getElementById(hid); if(he) he.value=ctColor; });
      }
    });
  });

  // Palette
  const _ab  = document.getElementById('ct-add-palette');    if(_ab)  _ab.onclick  = addToCtPalette;
  const _abm = document.getElementById('ct-add-palette-m');  if(_abm) _abm.onclick = addToCtPalette;
  const _rb  = document.getElementById('ct-reset-palette');  if(_rb)  _rb.onclick  = resetCtPalette;
  const _rbm = document.getElementById('ct-reset-palette-m');if(_rbm) _rbm.onclick = resetCtPalette;

  // Apply / Reset all
  // Wrap apply/reset to also persist state (must be before button wiring)
  const _origApply = ctApplyColor;
  const _origReset = ctResetAll;
  ctApplyColor = function() { _origApply(); saveCtState(); };
  ctResetAll   = function() { _origReset(); saveCtState(); };

  const _ap  = document.getElementById('ct-apply');     if(_ap)  _ap.onclick  = ctApplyColor;
  const _apm = document.getElementById('ct-apply-m');   if(_apm) _apm.onclick = ctApplyColor;
  const _ra  = document.getElementById('ct-reset-all');   if(_ra)  _ra.onclick  = ctResetAll;
  const _ram = document.getElementById('ct-reset-all-m'); if(_ram) _ram.onclick = ctResetAll;

  // Download / Tweet
  const _dl = document.getElementById('ct-download'); if(_dl) _dl.onclick = ctDownload;
  const _tw = document.getElementById('ct-tweet');    if(_tw) _tw.onclick = ctTweet;

  // Slide panel
  const _pt = document.getElementById('ct-panel-toggle');    if(_pt) _pt.onclick = ctTogglePanel;
  const _pc = document.getElementById('ct-panel-close-btn'); if(_pc) _pc.onclick = ctClosePanel;
  const _ov = document.getElementById('ct-overlay');         if(_ov) _ov.onclick = ctClosePanel;

  // Promo images
  document.querySelectorAll('.ct-promo-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const img = btn.querySelector('img');
      ctOpenModal(btn.getAttribute('data-full'), img ? img.alt : '');
    });
  });

  // Image modal controls
  const _mc = document.getElementById('ct-modal-close');
  const _mb = document.getElementById('ct-modal-backdrop');
  const _mi = document.getElementById('ct-modal-img');
  const _ms = document.getElementById('ct-zoom-slider');
  const _mr = document.getElementById('ct-zoom-reset');
  if(_mc) _mc.onclick = function(e){ e.stopPropagation(); ctCloseModal(); };
  if(_mi) _mi.onclick = function(e){ e.stopPropagation(); };
  if(_ms) _ms.addEventListener('input', function(e){ ctZoom=+e.target.value; ctUpdateZoom(); });
  if(_mr) _mr.onclick = function(){ ctZoom=100; ctUpdateZoom(); };

  // Persist current state so it survives the next language switch
  function saveCtState() {
    _ct = {
      hue: hue, sat: sat, bri: bri, ctColor: ctColor,
      ctPalette: ctPalette.slice(),
      selectedLayer: selectedLayer,
      fixedVisible: fixedVisible,
      loadedImgs: loadedImgs,
      loadCnt: loadCnt,
      ctZoom: ctZoom,
      layers: ctLayers.map(function(l) {
        return { id: l.id, color: l.color, visible: l.visible };
      })
    };
  }

  // Modal outer-click: clicking the modal backdrop (outside the image) closes it
  const _mOuter = document.getElementById('ct-img-modal');
  if (_mOuter) _mOuter.addEventListener('click', function(e) {
    if (e.target === _mOuter) ctCloseModal();
  });

  // Keydown: use AbortController to prevent stacking on re-init
  if (_ct && _ct._keyController) { try { _ct._keyController.abort(); } catch(e) {} }
  const _keyCtrl = new AbortController();
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { ctCloseModal(); ctClosePanel(); }
  }, { signal: _keyCtrl.signal });

  // Start
  loadCtPalette();
  updateCtColor();
  renderCtPalettes();
  // Images already loaded on lang switch — skip reload, just redraw
  if (Object.keys(loadedImgs).length > 0) {
    const loadingEl = document.getElementById('ct-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    drawCtCanvas();
  } else {
    loadCtImages();
  }
  renderCtLayerList('ct-layer-list', false);
  renderCtLayerList('ct-layer-list-m', true);
  saveCtState();
  _ct._keyController = _keyCtrl;
}

init().catch((err) => {
  console.error(err);
  alert("初期化に失敗しました。コンソールを確認してください。");
});
