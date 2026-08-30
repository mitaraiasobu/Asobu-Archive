/* app.js (FULL / working) */

/* ─────────────────────────────────────────────────────────────
   ゲーム風イントロ演出
   ───────────────────────────────────────────────────────────── */
(function () {
  // アニメOFFの場合はイントロを完全にスキップ
  if (localStorage.getItem("noAnim") === "1") {
    window.__introFinishPromise = Promise.resolve();
    window.__introFinishResolve = () => {};
    return;
  }

  // 1日1回イントロを表示（日付が変わったらまた表示）
  var _today = new Date().toDateString();
  var _introDate = localStorage.getItem("introPlayedDate");
  if (_introDate === _today) {
    window.__introFinishPromise = Promise.resolve();
    window.__introFinishResolve = () => {};
    return;
  }
  // 本日分を記録
  window.__freshVisit = true;
  localStorage.setItem("introPlayedDate", _today);
  // 後方互換のためintroPlayedも設定
  localStorage.setItem("introPlayed", "1");

  const savedLang = (localStorage.getItem("lang") || "ja");
  const DOT_FONT  = savedLang === "ko"
    ? "'DotGothic16', 'NeoDunggeunmoPro', monospace"
    : "'DotGothic16', monospace";

  // i18n JSONのsplash.*を非同期取得（スクランブルと並行実行）
  // JSONロード前なのでfetchで直接読む。失敗時はフォールバック
  const splashPromise = fetch(`./i18n/${savedLang}.json`, { cache: "no-store" })
    .then(r => r.json())
    .then(json => json.splash || {})
    .catch(() => ({}));

  const SCRAMBLE_CHARS  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&⋈★◆▲░▒▓";
  const SCRAMBLE_FRAMES = 10;
  const FRAME_MS        = 38;
  // バートランジション時間（文字が全部出た後バーが走る時間）
  const BAR_TRANSITION_MS = 1800;
  // バー到達後の待機時間
  const BAR_WAIT_MS = 1000;
  // フェードアウト時間
  const FADEOUT_DURATION_MS = 650;

  const style = document.createElement("style");
  style.textContent = `
    #asobu-intro {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 20px;
      background: #080408; overflow: hidden;
      contain: layout paint;
      cursor: default; user-select: none;
    }
    /* スキャンライン */
    #asobu-intro::before {
      content: ""; position: absolute; inset: 0;
      background-image: repeating-linear-gradient(
        0deg, transparent, transparent 2px,
        rgba(255,255,255,0.025) 2px, rgba(255,255,255,0.025) 4px);
      pointer-events: none;
      animation: intro-scanline 10s linear infinite;
    }
    @keyframes intro-scanline {
      from { background-position: 0 0; } to { background-position: 0 240px; }
    }
    /* ピンクグロー */
    #asobu-intro::after {
      content: ""; position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 60% 40% at 50% 52%, rgba(255,80,160,0.22) 0%, transparent 70%),
        radial-gradient(ellipse 100% 100% at 50% 50%, rgba(20,0,30,0.7) 0%, transparent 100%);
      pointer-events: none;
      animation: intro-glow-pulse 2s ease-in-out infinite alternate;
    }
    @keyframes intro-glow-pulse { from { opacity: 0.8; } to { opacity: 1; } }

    /* コーナー装飾 */
    .intro-corner { position: absolute; width: 36px; height: 36px; opacity: 0.6; }
    .intro-corner--tl { top: 18px; left: 18px; border-top: 2px solid #ff6eb4; border-left: 2px solid #ff6eb4; }
    .intro-corner--tr { top: 18px; right: 18px; border-top: 2px solid #ff6eb4; border-right: 2px solid #ff6eb4; }
    .intro-corner--bl { bottom: 18px; left: 18px; border-bottom: 2px solid #ff6eb4; border-left: 2px solid #ff6eb4; }
    .intro-corner--br { bottom: 18px; right: 18px; border-bottom: 2px solid #ff6eb4; border-right: 2px solid #ff6eb4; }

    /* タイトル */
    #intro-title {
      position: relative; z-index: 2;
      font-family: ${DOT_FONT};
      font-size: clamp(22px, 5.5vw, 58px); font-weight: 400;
      color: #fff; letter-spacing: 0.14em;
      text-shadow: 0 0 6px #ff6eb4, 0 0 18px #ff3d9a,
                   0 0 40px #ff3d9a, 0 0 80px rgba(255,60,154,0.35);
      white-space: nowrap; min-height: 1.3em;
      width: 100%; max-width: min(90vw, 720px);
      text-align: center;
      overflow: hidden;
      font-variant-ligatures: none;
    }
    /* サブテキスト */
    #intro-sub {
      position: relative; z-index: 2;
      font-family: ${DOT_FONT};
      font-size: clamp(10px, 1.8vw, 16px); font-weight: 400;
      color: rgba(255,200,230,0.85); letter-spacing: 0.07em;
      text-shadow: 0 0 10px rgba(255,100,180,0.5);
      white-space: nowrap; min-height: 1.5em;
      width: 100%; max-width: min(90vw, 720px);
      text-align: center;
      overflow: hidden;
    }
    /* バー */
    #intro-bar-wrap {
      position: relative; z-index: 2;
      width: min(500px, 82vw); height: 6px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,110,180,0.25);
      overflow: hidden;
    }
    #intro-bar {
      height: 100%; width: 100%;
      transform: scaleX(0);
      transform-origin: left center;
      background: linear-gradient(90deg, #c0006a, #ff3d9a, #ffaadd, #ff3d9a, #c0006a);
      background-size: 300% 100%;
      box-shadow: 0 0 12px #ff3d9a, 0 0 24px rgba(255,60,154,0.4);
      animation: intro-bar-shine 8s linear infinite;
      /* transition はJSで動的に設定 */
    }
    @keyframes intro-bar-shine {
      from { background-position: 0% 0%; } to { background-position: 300% 0%; }
    }

    #intro-loading-label {
      position: relative; z-index: 2;
      font-family: ${DOT_FONT};
      font-size: clamp(9px, 1.4vw, 12px);
      color: rgba(255,150,200,0.6); letter-spacing: 0.25em; text-transform: uppercase;
      animation: intro-blink 1.1s step-end infinite;
    }
    @keyframes intro-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    /* スクランブル文字 */
    .scr-char { display: inline-block; color: #ff6eb4; }
    .scr-char.settled { color: inherit; transition: color 0.08s; }
  `;
  document.head.appendChild(style);

  // DOM構築
  const overlay = document.createElement("div");
  overlay.id = "asobu-intro";
  ["tl","tr","bl","br"].forEach(pos => {
    const c = document.createElement("div");
    c.className = `intro-corner intro-corner--${pos}`;
    overlay.appendChild(c);
  });
  const titleEl   = document.createElement("div"); titleEl.id = "intro-title";
  const subEl     = document.createElement("div"); subEl.id   = "intro-sub";
  const barWrap   = document.createElement("div"); barWrap.id  = "intro-bar-wrap";
  const bar       = document.createElement("div"); bar.id      = "intro-bar";
  barWrap.appendChild(bar);
  const loadLabel = document.createElement("div"); loadLabel.id = "intro-loading-label";
  loadLabel.textContent = "NOW LOADING...";
  overlay.append(titleEl, subEl, barWrap, loadLabel);
  document.body.prepend(overlay);

  function randomChar() {
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
  }

  function scrambleTo(el, targetText, startDelay) {
    return new Promise(resolve => {
      el.innerHTML = "";
      const spans = [];
      for (let i = 0; i < targetText.length; i++) {
        if (targetText[i] === " " || targetText[i] === "　" || targetText[i] === "/") {
          el.appendChild(document.createTextNode(targetText[i]));
          spans.push(null);
        } else {
          const s = document.createElement("span");
          s.className = "scr-char";
          s.textContent = randomChar();
          el.appendChild(s);
          spans.push(s);
        }
      }
      let settled = 0;
      const nonNull = spans.filter(Boolean);
      if (nonNull.length === 0) { resolve(); return; }
      nonNull.forEach((s, ni) => {
        const idx = spans.indexOf(s);
        const charDelay = startDelay + ni * (FRAME_MS * 0.75);
        let frame = 0;
        const tick = () => {
          if (frame < SCRAMBLE_FRAMES) {
            s.textContent = randomChar(); frame++;
            setTimeout(tick, FRAME_MS);
          } else {
            s.textContent = targetText[idx];
            s.classList.add("settled");
            if (++settled === nonNull.length) resolve();
          }
        };
        setTimeout(tick, charDelay);
      });
    });
  }

  // ── JS駆動のグリッチ消滅演出 ──────────────────────────────────
  // canvasにイントロ画面をスナップショットして横スライスで崩す
  function runGlitchExit(onDone) {
    // ── 星＆ハート爆散 → overlay フェードアウト ──
    var W = window.innerWidth;
    var H = window.innerHeight;
    var CX = W / 2;
    var CY = H / 2;

    // パーティクル設定
    var SYMBOLS = ["★","✦","♥","✿","◆","·","*","✦","★","♥"];
    var COLORS  = [
      "#ff6eb4","#ff3d9a","#ffaadd","#fff","#ff6eb4",
      "#ffccee","#ff3d9a","#fff","#ffaadd","#ff6eb4"
    ];
    var COUNT = 80;

    // コンテナ（overlayの上）
    var container = document.createElement("div");
    container.style.cssText = "position:fixed;inset:0;z-index:100000;pointer-events:none;overflow:hidden;";
    document.body.appendChild(container);

    // パーティクル生成
    for (var i = 0; i < COUNT; i++) {
      (function(idx) {
        var sym   = SYMBOLS[idx % SYMBOLS.length];
        var color = COLORS[idx % COLORS.length];
        var size  = 10 + Math.random() * 22;

        var el = document.createElement("div");
        el.textContent = sym;
        el.style.cssText = [
          "position:absolute",
          "left:" + CX + "px",
          "top:"  + CY + "px",
          "font-size:" + size + "px",
          "color:" + color,
          "text-shadow:0 0 6px " + color + ",0 0 14px " + color,
          "line-height:1",
          "transform:translate(-50%,-50%)",
          "opacity:1",
          "will-change:transform,opacity",
          "pointer-events:none"
        ].join(";");
        container.appendChild(el);

        // 飛散パラメータ
        var angle = (idx / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        var dist  = 120 + Math.random() * (Math.min(W, H) * 0.48);
        var tx    = Math.cos(angle) * dist;
        var ty    = Math.sin(angle) * dist;
        var rot   = (Math.random() - 0.5) * 540;
        var delay = Math.random() * 180;
        var dur   = 500 + Math.random() * 300;

        // 少し待ってからアニメ開始
        setTimeout(function() {
          el.style.transition = [
            "transform " + dur + "ms cubic-bezier(0.15,0.5,0.3,1) 0ms",
            "opacity "   + (dur * 0.55) + "ms ease-in " + (dur * 0.45) + "ms"
          ].join(",");
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              el.style.transform = "translate(calc(-50% + " + tx + "px), calc(-50% + " + ty + "px)) rotate(" + rot + "deg) scale(0.4)";
              el.style.opacity   = "0";
            });
          });
        }, delay);
      })(i);
    }

    // overlayを少し遅らせてフェードアウト
    setTimeout(function() {
      overlay.style.transition = "opacity 600ms ease-out";
      overlay.style.opacity    = "0";
    }, 200);

    // 全部終わったらDOM削除
    setTimeout(function() {
      container.remove();
      overlay.remove();
      style.remove();
      if (onDone) onDone();
    }, 1100);
  }

  async function runIntro() {
    const texts = await splashPromise;

    // バーをDOMに追加した直後（ページ表示と同時）に走らせる
    // transition時間 = タイトル + サブのスクランブル推定時間 + 1秒のバッファ
    const titleLen = (texts.title || '').replace(/\s/g, '').length;
    const subLen   = (texts.sub   || '').replace(/\s/g, '').length;
    const estimatedScrambleMs = (titleLen + subLen) * FRAME_MS * 0.75 + SCRAMBLE_FRAMES * FRAME_MS + 500;
    // バーは「サブテキスト表示完了の直前」に100%に達するよう transition を設定
    bar.style.transition = `transform ${estimatedScrambleMs}ms cubic-bezier(0.15, 1, 0.3, 1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(1)'; }));

    // 文字スクランブル（バーと並行して走る）
    await scrambleTo(titleEl, texts.title, 60);
    await scrambleTo(subEl,   texts.sub,   10);

    // サブテキスト（有意義に使っていこ～！）が出た1秒後にグリッチ消滅
    setTimeout(() => {
      runGlitchExit(() => {
        if (window.__introFinishResolve) window.__introFinishResolve();
      });
    }, 1000);
  }

  window.__introFinishPromise = new Promise(resolve => {
    window.__introFinishResolve = resolve;
  });

  runIntro();
})();
/* ─────────────────────────────────────────────────────────────
   イントロ演出ここまで
   ───────────────────────────────────────────────────────────── */

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

  // パーティクルレイン起動
  triggerTabRain(tabKey);

  // 自己紹介タブ：画像スライダー自動再生を起動
  if (tabKey === "about" && typeof window._aboutSliderStartAuto === "function") {
    window._aboutSliderStartAuto();
  }

  // タブを開いたときにアニメーション発火
  if (!document.body.classList.contains("no-anim")) {
    if (tabKey === "support") {
      // supportタブ：毎回HTMLを再注入してアニメをリセット・再実行
      const supportBody = document.getElementById("supportBody");
      if (supportBody) {
        supportBody.innerHTML = t("support.bodyHtml");
        animateTimeline(supportBody);
        animatePriorityList(supportBody);
        runSupportHeaderAnim(supportBody);
        runSupportAccentAnim(supportBody);
      }
    } else if (tabKey === "crowdfunding") {
      const cfBody = document.getElementById("crowdfundingBody");
      if (cfBody && !cfBody.dataset.missionDone) {
        cfBody.dataset.missionDone = "1";
        const missionTitle = t("crowdfunding.missionTitle") || "防音室を導入して絶叫を防げ！";
        // キャッシュ済み（再訪問）ならMISSIONアニメをスキップ
        var _todayCf = new Date().toDateString();
        var _cfMissionDate = localStorage.getItem("cfMissionDate");
        if (_cfMissionDate === _todayCf && !window.__freshVisit) {
          initCfPhysicsTank();
          // PayPalボタンをレンダリング（MISSION演出スキップ時）
          setTimeout(renderPayPalButtons, 300);
        } else {
          localStorage.setItem("cfMissionDate", _todayCf);
          // まず即座にコンテンツを隠す
          cfBody.querySelectorAll(".cf-split > div, .support-header").forEach(el => {
            el.style.opacity = "0"; el.style.transition = "none"; el.style.transform = "translateY(16px)";
          });
          const doMission = () => {
            triggerMissionAnim(cfBody, missionTitle, ".cf-split > div, .support-header");
            // ミッション演出終了後にタンク初期化とPayPalボタンをレンダリング
            setTimeout(() => {
              initCfPhysicsTank();
              renderPayPalButtons();
            }, 3400);
          };
          if (window.__introFinishPromise) {
            window.__introFinishPromise.then(doMission);
          } else {
            doMission();
          }
        }
      } else if (cfBody) {
        // 既にmissionDone済みの場合（タブ再訪問時）
        setTimeout(renderPayPalButtons, 300);
      }
    } else if (tabKey === "contact") {
      const contactBody = document.getElementById("contactBody");
      if (contactBody) {
        contactBody.innerHTML = t("contact.bodyHtml");
        animateSupportHeader(contactBody);
        animateTimeline(contactBody);
      }
    } else if (tabKey === "inquiry") {
      const inquiryBody = document.getElementById("inquiryBody");
      if (inquiryBody) {
        inquiryBody.innerHTML = t("inquiry.bodyHtml");
        animateSupportHeader(inquiryBody);
        animateTimeline(inquiryBody);
      }
    } else if (tabKey === "contest") {
      const contestBody = document.getElementById("contestBody");
      if (contestBody && !contestBody.dataset.missionDone) {
        contestBody.dataset.missionDone = "1";
        const missionTitle = t("contest.missionTitle") || "学園衣装をコーディネートしよう！";
        // キャッシュ済み（再訪問）ならMISSIONアニメをスキップ
        var _todayCt = new Date().toDateString();
        var _ctMissionDate = localStorage.getItem("ctMissionDate");
        if (_ctMissionDate === _todayCt && !window.__freshVisit) {
          // スキップ（コンテンツをそのまま表示）
        } else {
          localStorage.setItem("ctMissionDate", _todayCt);
          // まず即座にコンテンツを隠す
          const contestRoot = contestBody.querySelector("#contest-root");
          if (contestRoot) {
            contestRoot.style.opacity = "0"; contestRoot.style.transition = "none"; contestRoot.style.transform = "translateY(16px)";
          }
          const doMission = () => triggerMissionAnim(contestBody, missionTitle, "#contest-root");
          if (window.__introFinishPromise) {
            window.__introFinishPromise.then(doMission);
          } else {
            doMission();
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PARTICLE RAIN SYSTEM  ─  固定レイヤーで降らせる
// ═══════════════════════════════════════════════════════════════════
(function() {
  if (document.getElementById('__rain_styles')) return;
  const s = document.createElement('style');
  s.id = '__rain_styles';
  s.textContent = `
    /* ── 全タブ共通：固定レインキャンバス ── */
    /* bodyにisolation:isolateを付与することでrainを確実にbody内の最背面に */
    body {
      isolation: isolate;
    }
    #__rain_root {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: -1;
      overflow: hidden;
    }
    /* ── SVGハート ── */
    .rain-heart {
      position: absolute;
      top: -60px;
      opacity: 0;
      animation: rainHeartFall linear infinite;
      will-change: transform, opacity;
    }
    @keyframes rainHeartFall {
      0%   { transform: translateY(0px) rotate(var(--r,0deg)); opacity: var(--op,.15); }
      10%  { opacity: var(--op,.15); }
      90%  { opacity: var(--op,.15); }
      100% { transform: translateY(110vh) rotate(var(--r,0deg)); opacity: 0; }
    }
    /* ── メンバー画像 ── */
    .rain-member {
      position: absolute;
      top: -120px;
      opacity: 0;
      animation: rainImgFall linear infinite;
      will-change: transform, opacity;
      border-radius: 10px;
    }
    @keyframes rainImgFall {
      0%   { transform: translateY(0px) rotate(var(--r,0deg)); opacity: 0; }
      5%   { opacity: var(--op,.15); }
      90%  { opacity: var(--op,.15); }
      100% { transform: translateY(110vh) rotate(var(--r,0deg)); opacity: 0; }
    }
    /* ── お金 ── */
    .rain-money {
      position: absolute;
      top: -50px;
      opacity: 0;
      font-size: var(--sz, 20px);
      animation: rainMoneyFall linear infinite;
      will-change: transform, opacity;
    }
    @keyframes rainMoneyFall {
      0%   { transform: translateY(0px) rotate(var(--r,0deg)); opacity: 0; }
      5%   { opacity: var(--op,.12); }
      90%  { opacity: var(--op,.12); }
      100% { transform: translateY(110vh) rotate(var(--r,0deg)); opacity: 0; }
    }
  `;
  document.head.appendChild(s);

  // ルートdivをbody直下に追加
  const root = document.createElement('div');
  root.id = '__rain_root';
  document.body.appendChild(root);
})();

// ── 管理オブジェクト ──
const _rain = {
  activeTab: null,
  memberImgs: null,
  memberChecked: false,
  goodsImgs: null,
  goodsChecked: false,
};

function _rainRoot() { return document.getElementById('__rain_root'); }

function _rainClear() {
  const r = _rainRoot();
  if (r) r.innerHTML = '';
}

// ── SVGハート生成（塗りつぶし or 縁線のみ）──
function _makeSvgHeart(size, color, outline) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('viewBox', '0 0 100 100');
  s.style.display = 'block';
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M50 85 C10 60 5 30 20 15 C30 5 42 8 50 20 C58 8 70 5 80 15 C95 30 90 60 50 85Z');
  if (outline) {
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', '5');
  } else {
    p.setAttribute('fill', color);
  }
  s.appendChild(p);
  return s;
}

// ── ハート雨 ──
function startHeartRain() {
  _rainClear();
  const root = _rainRoot();
  if (!root) return;

  const COLORS = ['#ff79b0','#ff3d9a','#ffaadd','#ff6eb4','rgba(255,121,176,.8)'];
  const COUNT = 32;
  const tab = _rain.activeTab;
  const isHomeOrAbout = (tab === 'home' || tab === 'about');
  const isMobile = window.innerWidth <= 768;

  for (let i = 0; i < COUNT; i++) {
    const size    = 12 + Math.random() * 22;
    const left    = Math.random() * 99;
    const dur     = 7 + Math.random() * 10;
    const del     = -(Math.random() * dur);
    const op      = 0.10 + Math.random() * 0.20;
    const rot     = (Math.random() - 0.5) * 50;
    const col     = COLORS[Math.floor(Math.random() * COLORS.length)];
    const outline = Math.random() < 0.45; // 約45%を縁線のみ

    // home/about: PC版は中央エリア(left 18%〜82%)のハートを50%間引き
    //             スマホ版は全ハートを50%間引き
    if (isHomeOrAbout) {
      const inCenter = left >= 18 && left <= 82;
      if (isMobile) {
        if (i % 2 === 1) continue; // 全体を半分に
      } else if (inCenter) {
        if (i % 2 === 1) continue; // 中央のみ半分に
      }
    }

    const div = document.createElement('div');
    div.className = 'rain-heart';
    div.style.left = left + '%';
    div.style.setProperty('--r', rot + 'deg');
    div.style.setProperty('--op', op);
    div.style.animationDuration = dur + 's';
    div.style.animationDelay = del + 's';

    div.appendChild(_makeSvgHeart(size, col, outline));
    root.appendChild(div);
  }
}

// ── お金雨 ──
function startMoneyRain() {
  _rainClear();
  const root = _rainRoot();
  if (!root) return;

  const MONEY = ['💵','💰','💸','💴','💶','💷','🪙'];
  const COUNT = 32;

  for (let i = 0; i < COUNT; i++) {
    const size = 14 + Math.random() * 20;
    const left = Math.random() * 98;
    const dur  = 5 + Math.random() * 7;
    const del  = -(Math.random() * dur);
    const op   = 0.10 + Math.random() * 0.18;
    const rot  = (Math.random() - 0.5) * 30;

    const div = document.createElement('div');
    div.className = 'rain-money';
    div.textContent = MONEY[Math.floor(Math.random() * MONEY.length)];
    div.style.left = left + '%';
    div.style.setProperty('--sz', size + 'px');
    div.style.setProperty('--r', rot + 'deg');
    div.style.setProperty('--op', op);
    div.style.animationDuration = dur + 's';
    div.style.animationDelay = del + 's';

    root.appendChild(div);
  }
}

// ── メンバー画像雨 ──
const MEMBER_IMG_PATHS = Array.from({length: 20}, (_, i) => `./assets/member/${i+1}.png`);

function startMemberRain() {
  _rainClear();
  const root = _rainRoot();
  if (!root) return;

  function doRain(pool) {
    if (!pool || !pool.length) return;
    const COUNT = 16;
    // シャッフルして連続同画像を防ぐ
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    // COUNT個になるまでシャッフル済みリストを繰り返す（連続しないよう結合時に隣接チェック）
    const seq = [];
    while (seq.length < COUNT) {
      for (const s of shuffled) {
        if (seq.length === 0 || seq[seq.length - 1] !== s) {
          seq.push(s);
          if (seq.length >= COUNT) break;
        }
      }
    }
    for (let i = 0; i < COUNT; i++) {
      const src  = seq[i];
      const size = 48 + Math.random() * 70;
      const left = Math.random() * 94;
      const dur  = 10 + Math.random() * 14;
      const del  = -(Math.random() * dur);
      const op   = 0.10 + Math.random() * 0.22;
      const rot  = (Math.random() - 0.5) * 55;

      const img = document.createElement('img');
      img.className = 'rain-member';
      img.src = src;
      img.style.width = size + 'px';
      img.style.left = left + '%';
      img.style.setProperty('--r', rot + 'deg');
      img.style.setProperty('--op', op);
      img.style.animationDuration = dur + 's';
      img.style.animationDelay = del + 's';
      root.appendChild(img);
    }
  }

  if (_rain.memberImgs !== null) { doRain(_rain.memberImgs); return; }
  if (_rain.memberChecked) { setTimeout(startMemberRain, 700); return; }
  _rain.memberChecked = true;
  const valid = [];
  let pending = MEMBER_IMG_PATHS.length;
  MEMBER_IMG_PATHS.forEach(src => {
    const img = new Image();
    img.onload  = () => { valid.push(src); if(--pending===0){_rain.memberImgs=valid; doRain(valid);} };
    img.onerror = () => {                   if(--pending===0){_rain.memberImgs=valid; doRain(valid);} };
    img.src = src;
  });
}

// ── グッズ画像雨 ──
const GOODS_IMG_PATHS = Array.from({length: 30}, (_, i) => `./assets/goods/${i+1}.png`);

function startGoodsRain() {
  _rainClear();
  const root = _rainRoot();
  if (!root) return;

  function doGoodsRain(pool) {
    if (!pool || !pool.length) { startHeartRain(); return; } // 画像なしはハート雨

    const COUNT = 16;
    // シャッフルして連続同画像を防ぐ
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const seq = [];
    while (seq.length < COUNT) {
      for (const s of shuffled) {
        if (seq.length === 0 || seq[seq.length - 1] !== s) {
          seq.push(s);
          if (seq.length >= COUNT) break;
        }
      }
    }
    for (let i = 0; i < COUNT; i++) {
      const src  = seq[i];
      const size = 48 + Math.random() * 70;
      const left = Math.random() * 94;
      const dur  = 10 + Math.random() * 14;
      const del  = -(Math.random() * dur);
      const op   = 0.10 + Math.random() * 0.22;
      const rot  = (Math.random() - 0.5) * 55;

      const img = document.createElement('img');
      img.className = 'rain-member'; // 同じCSSクラスを流用
      img.src = src;
      img.style.width = size + 'px';
      img.style.left = left + '%';
      img.style.setProperty('--r', rot + 'deg');
      img.style.setProperty('--op', op);
      img.style.animationDuration = dur + 's';
      img.style.animationDelay = del + 's';
      root.appendChild(img);
    }
  }

  if (_rain.goodsImgs !== null) { doGoodsRain(_rain.goodsImgs); return; }
  if (_rain.goodsChecked) { setTimeout(startGoodsRain, 700); return; }
  _rain.goodsChecked = true;
  const valid = [];
  let pending = GOODS_IMG_PATHS.length;
  GOODS_IMG_PATHS.forEach(src => {
    const img = new Image();
    img.onload  = () => { valid.push(src); if(--pending===0){_rain.goodsImgs=valid; doGoodsRain(valid);} };
    img.onerror = () => {                   if(--pending===0){_rain.goodsImgs=valid; doGoodsRain(valid);} };
    img.src = src;
  });
}

// ── タブ切り替えでレイン起動 ──
function triggerTabRain(tabKey) {
  _rain.activeTab = tabKey;
  if (document.body.classList.contains('no-anim')) { _rainClear(); return; }
  if (tabKey === 'membership') {
    startMemberRain();
  } else if (tabKey === 'goods') {
    startGoodsRain();
  } else if (tabKey === 'crowdfunding' || tabKey === 'support') {
    startMoneyRain();
  } else if (tabKey === 'contest') {
    startHeartRain();
  } else {
    // home を含む残りタブ全てにハート雨
    startHeartRain();
  }
}

// アニメOFF切り替え監視
document.addEventListener('click', e => {
  if (!e.target || !e.target.closest) return;
  const btn = e.target.closest('.anim-toggle-btn');
  if (!btn) return;
  setTimeout(() => {
    const off = document.body.classList.contains('no-anim');
    if (off) { _rainClear(); }
    else if (_rain.activeTab) { triggerTabRain(_rain.activeTab); }
  }, 50);
}, true);


// ═══════════════════════════════════════════════════════════════════
//  CROWDFUNDING HORIZONTAL PHYSICS TANK  (Matter.js)
// ═══════════════════════════════════════════════════════════════════
function initCfPhysicsTank() {
  const cfBody = document.getElementById('crowdfundingBody');
  if (!cfBody || cfBody.dataset.physicsDone) return;
  cfBody.dataset.physicsDone = '1';

  // 横棒メーターを探す
  const hBar = cfBody.querySelector('[style*="height:16px"][style*="border-radius:999px"]');
  if (!hBar) return;

  // 進捗 % を読み取る
  let pct = 46.8;
  cfBody.querySelectorAll('span,div').forEach(el => {
    const m = el.textContent.match(/(?:進捗|Progress|진행)[：:\s]*([\d.]+)%/);
    if (m) pct = parseFloat(m[1]);
  });

  // 残り金額・目標金額を読み取る
  let remainingAmt = 106400, goalAmt = 200000;
  cfBody.querySelectorAll('span,div').forEach(el => {
    const mR = el.textContent.match(/残り[：:\s]*¥([\d,]+)/);
    if (mR) remainingAmt = parseInt(mR[1].replace(/,/g, ''));
    const mG = el.textContent.match(/目標[：:\s]*¥([\d,]+)/);
    if (mG) goalAmt = parseInt(mG[1].replace(/,/g, ''));
  });
  const collectedAmt = goalAmt - remainingAmt;
  const fmtYen = n => '¥\u00a0' + n.toLocaleString('ja-JP');

  // ── タンク UI 生成 ──
  // タンクサイズ：横20個 × 縦7段 = MAX140個収容
  const COIN_R  = 14;                    // コイン半径
  const COLS    = 20;                    // 横に並ぶMAX個数
  const ROWS    = 7;                     // 縦のMAX段数
  const TANK_W  = COLS * COIN_R * 2;    // = 560px
  const TANK_H  = ROWS * COIN_R * 2;    // = 196px
  const MAX_COINS = COLS * ROWS;         // = 140個
  // pct%分のコイン数（端数切り上げ、最低3個）
  const COIN_COUNT = Math.max(3, Math.ceil(MAX_COINS * pct / 100));

  const tankWrap = document.createElement('div');
  tankWrap.style.cssText = `
    margin: 16px auto 8px;
    width: 100%;
    max-width: ${TANK_W}px;
    position: relative;
    user-select: none;
  `;

  // 進捗ラベル表示
  const pctLabel = document.createElement('div');
  pctLabel.style.cssText = `
    text-align:center; font-size:.85em; color:rgba(255,255,255,.65);
    letter-spacing:.04em; margin-bottom:6px; font-variant-numeric:tabular-nums;
  `;
  pctLabel.textContent = `${fmtYen(collectedAmt)}/${goalAmt.toLocaleString('ja-JP')}\u3000${pct.toFixed(1)}%`;
  tankWrap.appendChild(pctLabel);

  // Canvasタンク
  const canvas = document.createElement('canvas');
  canvas.width  = TANK_W;
  canvas.height = TANK_H;
  canvas.style.cssText = `
    display:block;
    width: 100%;
    border: 1.5px solid rgba(255,121,176,.4);
    border-radius: 12px;
    background: rgba(255,255,255,.04);
    box-shadow: 0 0 18px rgba(255,121,176,.08) inset;
  `;
  tankWrap.appendChild(canvas);

  // 目標ラベル
  const goalLabel = document.createElement('div');
  goalLabel.style.cssText = `display:none;`;
  goalLabel.textContent = '目標: ¥200,000';
  tankWrap.appendChild(goalLabel);

  hBar.replaceWith(tankWrap);

  // ── Matter.js 動的ロード → 物理演算 ──
  function runPhysics() {
    const { Engine, Bodies, Body, Composite } = window.Matter;

    const engine = Engine.create({ gravity: { y: 1.8 } });
    const world  = engine.world;

    // 壁・底：厚み20pxで絶対貫通しない
    const ground = Bodies.rectangle(TANK_W/2,  TANK_H + 10, TANK_W + 60, 20, { isStatic:true, label:'wall' });
    const wallL  = Bodies.rectangle(-10,        TANK_H/2,    20, TANK_H * 10, { isStatic:true, label:'wall' });
    const wallR  = Bodies.rectangle(TANK_W+10,  TANK_H/2,    20, TANK_H * 10, { isStatic:true, label:'wall' });
    Composite.add(world, [ground, wallL, wallR]);

    const SYMBOLS = ['💵','💰','💸','🪙','💴'];
    const coins = [];
    const coinSymbols = [];

    const noAnim = document.body.classList.contains('no-anim');

    // コインをスポーンする関数（中央上からバラバラに）
    function spawnCoin(i) {
      // X: タンク中央±タンク幅の半分にランダム散布（ガウス風にするため2回乱数を足す）
      const spread = (TANK_W * 0.45);
      const cx = TANK_W / 2;
      const x = cx + (Math.random() - 0.5) * spread * 2;
      const y = -COIN_R - Math.random() * COIN_R * 3; // 上端からランダムな高さでスポーン
      const sym = SYMBOLS[i % SYMBOLS.length];

      const coin = Bodies.circle(
        Math.max(COIN_R + 1, Math.min(TANK_W - COIN_R - 1, x)),
        y,
        COIN_R,
        {
          restitution: 0.2,
          friction: 0.55,
          frictionAir: 0.012,
          density: 0.003,
          label: 'coin',
        }
      );
      Body.setVelocity(coin, { x: (Math.random() - 0.5) * 2.5, y: 0.5 + Math.random() });
      Body.setAngularVelocity(coin, (Math.random() - 0.5) * 0.2);
      Composite.add(world, coin);
      coins.push(coin);
      coinSymbols.push(sym);
    }

    if (noAnim) {
      // アニメOFF：全コインを一気にスポーンして十分なステップ数シミュレートし静止状態に
      for (let i = 0; i < COIN_COUNT; i++) spawnCoin(i);
      // 物理演算を前もって大量に回して静止状態を作る
      for (let step = 0; step < 600; step++) {
        Engine.update(engine, 1000 / 60);
      }
    } else {
      // アニメON：4〜5個ずつランダム間隔で降らせる
      const GROUP = 5;
      for (let i = 0; i < COIN_COUNT; i += GROUP) {
        const delay = Math.floor(i / GROUP) * 200 + Math.random() * 80;
        setTimeout(() => {
          const end = Math.min(i + GROUP, COIN_COUNT);
          for (let j = i; j < end; j++) spawnCoin(j);
        }, delay);
      }
    }

    // Canvas 描画ループ
    const ctx = canvas.getContext('2d');

    function drawFrame() {
      Engine.update(engine, 1000/60);
      ctx.clearRect(0, 0, TANK_W, TANK_H);

      // 水位グラデーション（pct%分の高さ）
      const fillH = (pct / 100) * TANK_H;
      const grad = ctx.createLinearGradient(0, TANK_H - fillH, 0, TANK_H);
      grad.addColorStop(0, 'rgba(255,200,50,.04)');
      grad.addColorStop(1, 'rgba(255,150,30,.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, TANK_H - fillH, TANK_W, fillH);

      // コイン描画（Canvas内に収まるものだけ）
      coins.forEach((coin, i) => {
        const { x, y } = coin.position;
        if (y < -COIN_R*4 || y > TANK_H + COIN_R*2) return;
        if (x < -COIN_R*2 || x > TANK_W + COIN_R*2) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(coin.angle);
        ctx.font = `${COIN_R * 1.7}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.92;
        ctx.fillText(coinSymbols[i], 0, 0);
        ctx.restore();
      });

      // 底部グロー
      const btmGrad = ctx.createLinearGradient(0, TANK_H - 40, 0, TANK_H);
      btmGrad.addColorStop(0, 'transparent');
      btmGrad.addColorStop(1, 'rgba(255,180,30,.22)');
      ctx.fillStyle = btmGrad;
      ctx.fillRect(0, TANK_H - 40, TANK_W, 40);
    }

    // rAFループ（静止後は低頻度に）
    let settled = 0;
    function loop() {
      drawFrame();
      const moving = coins.some(c => Math.abs(c.velocity.x) > .1 || Math.abs(c.velocity.y) > .1);
      if (!moving) settled++;
      else settled = 0;
      if (settled < 300) {
        requestAnimationFrame(loop);
      } else {
        setInterval(drawFrame, 1000);
      }
    }
    requestAnimationFrame(loop);
  }

  // Matter.js を CDN からロード
  if (window.Matter) {
    runPhysics();
    return;
  }
  const matterScript = document.createElement('script');
  matterScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
  matterScript.onload = runPhysics;
  matterScript.onerror = () => {
    // フォールバック: 静的表示
    console.warn('Matter.js load failed, falling back to static display');
    const ctx = canvas.getContext('2d');
    const fillH = (pct / 100) * canvas.height;
    const g = ctx.createLinearGradient(0, canvas.height - fillH, 0, canvas.height);
    g.addColorStop(0, 'rgba(255,200,50,.08)');
    g.addColorStop(1, 'rgba(255,150,30,.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, canvas.height - fillH, canvas.width, fillH);
    ctx.font = '18px serif'; ctx.textAlign = 'center';
    const symbols = ['💵','💴','🪙','💰','💸'];
    const cnt = Math.max(2, Math.round(pct/7));
    for (let i=0; i<cnt; i++) {
      ctx.fillText(symbols[i%symbols.length],
        20 + (canvas.width-40)/(cnt-1||1)*i,
        canvas.height - 14);
    }
  };
  document.head.appendChild(matterScript);
}


// supportタブのheader文字アニメを強制実行（タブ表示後に呼ぶ）
function runSupportHeaderAnim(root) {
  if (!root || document.body.classList.contains("no-anim")) return;
  const header = root.querySelector(".support-header");
  if (!header || header.dataset.shFired) return;
  header.dataset.shFired = "1";

  let globalDelay = 0;
  const CHAR_INTERVAL = 0.065;
  const LINE_GAP = 0.22;
  const rows = [
    { sel: ".support-main-title", cls: "sh-char" },
    { sel: ".support-sub-title",  cls: "sh-char" },
    { sel: ".support-deco-line",  cls: "sh-char--heart" },
  ];
  rows.forEach(({ sel, cls }) => {
    const el = header.querySelector(sel);
    if (!el || el.dataset.shWrapped) return;
    el.dataset.shWrapped = "1";
    function wrapNodes(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        [...node.textContent].forEach((ch) => {
          if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); globalDelay += CHAR_INTERVAL * 0.25; }
          else {
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = ch;
            span.style.animationDelay = globalDelay.toFixed(3) + "s";
            frag.appendChild(span);
            globalDelay += CHAR_INTERVAL;
          }
        });
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        [...node.childNodes].forEach(wrapNodes);
      }
    }
    const tmp = document.createElement("div");
    tmp.innerHTML = el.innerHTML;
    [...tmp.childNodes].forEach(wrapNodes);
    el.innerHTML = tmp.innerHTML;
    globalDelay += LINE_GAP;
  });
}

// support-accent（寿命なら当然...だよね？）を3秒後にめちゃゆっくりフェードイン
function runSupportAccentAnim(root) {
  if (!root || document.body.classList.contains("no-anim")) return;
  const header = root.querySelector(".support-header");
  if (!header) return;
  const accentEl = header.querySelector(".support-accent");
  if (!accentEl || accentEl.dataset.accentFired) return;
  accentEl.dataset.accentFired = "1";
  accentEl.style.opacity = "0";
  accentEl.style.transition = "opacity 6s ease 3s";
  requestAnimationFrame(() => requestAnimationFrame(() => { accentEl.style.opacity = "1"; }));
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


// events.jsonのi18n.periodを優先し、なければformatPeriod(start, end)にフォールバック
function getEventPeriod(ev) {
  const detail = ev.i18n?.[state.lang] || ev.i18n?.ja || {};
  if (detail.period) return detail.period;
  return formatPeriod(ev.start, ev.end);
}

function renderStaticTexts() {
  // ヘッダーのブランドタイトル・サブ
  const siteTitle = $("#siteTitle");
  const siteSub   = $("#siteSub");
  if (siteTitle) siteTitle.textContent = t("site.title") || "遊アーカイブ⋈🦝";
  if (siteSub)   siteSub.textContent   = t("site.sub")   || "御手洗 遊の公式サイト/寿命を有意義につかっていこ～！";

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

  const thumbGalleryTitle = $("#thumbGalleryTitle");
  if (thumbGalleryTitle) thumbGalleryTitle.textContent = t("home.thumbGalleryTitle");

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
  if (aboutBody) { aboutBody.innerHTML = t("about.bodyHtml"); animateSupportHeader(aboutBody); animateTimeline(aboutBody); initDreamGoals(); }

  // ホームのサムネイルギャラリー初期化（ホームタブに移動したため）
  initThumbGallery();

  const supportTitle = $("#supportTitle");
  const supportBody = $("#supportBody");
  if (supportTitle) supportTitle.textContent = t("support.title");
  if (supportBody) {
    supportBody.innerHTML = t("support.bodyHtml");
    // アニメはsetActiveTab("support")呼び出し時に発火させる
    animateTimeline(supportBody);
    animatePriorityList(supportBody);
    // 言語切り替え後はフラグをリセット（再演出できるように）
    const hdr = supportBody.querySelector(".support-header");
    if (hdr) { delete hdr.dataset.shDone; delete hdr.dataset.shFired; }
    const acc = supportBody.querySelector(".support-accent");
    if (acc) { delete acc.dataset.accentFired; delete acc.dataset.shWrapped; acc.style.opacity = ""; acc.style.transition = ""; }
  }

  const goodsTitle = $("#goodsTitle");
  const goodsBody = $("#goodsBody");
  if (goodsTitle) goodsTitle.textContent = t("goods.title");
  if (goodsBody) { 
    goodsBody.innerHTML = t("goods.bodyHtml"); 
    animateSupportHeader(goodsBody); 
    animateTimeline(goodsBody);
    // グッズソート機能を初期化
    initGoodsSort();
  }

  // ホームの「お知らせ」コーナー（goods-containerが存在してから呼ぶ）
  renderHomeNotice();

  const logTitle = $("#logTitle");
  const logBody = $("#logBody");
  if (logTitle) logTitle.textContent = t("log.title");
  if (logBody) { logBody.innerHTML = t("log.bodyHtml"); animateSupportHeader(logBody); animateTimeline(logBody); }

  const fcTitle = document.getElementById("membershipTitle");
  const fcBody = document.getElementById("membershipBody");
  if (fcTitle) fcTitle.textContent = t("membership.title");
  if (fcBody) { fcBody.innerHTML = t("membership.bodyHtml"); animateSupportHeader(fcBody); animateTimeline(fcBody); }

  const noticeTitle = document.getElementById("noticeTitle");
  const noticeBody = document.getElementById("noticeBody");
  if (noticeTitle) noticeTitle.textContent = t("notice.title");
  if (noticeBody) { noticeBody.innerHTML = t("notice.bodyHtml"); animateSupportHeader(noticeBody); animateTimeline(noticeBody); }

  const cfBody = document.getElementById("crowdfundingBody");
  if (cfBody) {
    cfBody.innerHTML = t("crowdfunding.bodyHtml");
    delete cfBody.dataset.physicsDone;
    animateSupportHeader(cfBody);
    animateTimeline(cfBody);
    // PayPalボタンをレンダリング
    setTimeout(renderPayPalButtons, 300);
    // タンク初期化は翻訳処理が全部終わった後にまとめて行う（後述）
    if (_rain.activeTab === "crowdfunding") {
      cfBody.dataset.missionDone = "1";
    } else if (!document.body.classList.contains("no-anim")) {
      delete cfBody.dataset.missionDone;
    }
  }

  const contestBody = document.getElementById("contestBody");
  if (contestBody) {
    const contestHtml = t("contest.bodyHtml").replace(
      "__PROMO_TITLE__",
      escapeHtml(t("contest.promoTitle") || "コンテスト一覧")
    );
    contestBody.innerHTML = contestHtml;
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
    animateSupportHeader(contestBody);
    animateTimeline(contestBody);
  }

  const contactTitle = $("#contactTitle");
  const contactBody = $("#contactBody");
  if (contactTitle) contactTitle.textContent = t("contact.title");
  if (contactBody) { contactBody.innerHTML = t("contact.bodyHtml"); animateSupportHeader(contactBody); animateTimeline(contactBody); }

  const inquiryBody = $("#inquiryBody");
  if (inquiryBody) { inquiryBody.innerHTML = t("inquiry.bodyHtml"); animateSupportHeader(inquiryBody); animateTimeline(inquiryBody); }

  const footerNote = $("#footerNote");
  if (footerNote) footerNote.textContent = t("footer.note");

  // BGMプレイリストの「曲リスト」ラベル・「MVを見る」リンクの言語を更新
  if (typeof window.__refreshBgmI18n === "function") window.__refreshBgmI18n();

  updateAnimToggleLabel();

  // 翻訳処理が全部終わってからタンクを生成（ラグ防止）
  if (_rain.activeTab === "crowdfunding" || document.body.classList.contains("no-anim")) {
    const cfBodyCheck = document.getElementById("crowdfundingBody");
    if (cfBodyCheck && !cfBodyCheck.dataset.physicsDone) {
      setTimeout(initCfPhysicsTank, 300);
    }
  }

  // ★ 言語切り替え後、コンテスト・クラファン内の全要素の
  //   横スクロール位置を強制リセット（スクロールバー再表示防止）
  requestAnimationFrame(function() {
    ["contestBody", "crowdfundingBody"].forEach(function(id) {
      const body = document.getElementById(id);
      if (!body) return;
      body.querySelectorAll("*").forEach(function(el) {
        if (el.scrollLeft > 0) el.scrollLeft = 0;
      });
    });
  });
}

function renderEvents() {
  const grid = $("#eventsGrid");
  if (!grid) return;

  grid.innerHTML = "";
  eventVideoElements = []; // リセット

  state.events.forEach((ev) => {
    // i18n はevents.jsonに直接書かれている。言語ごとに ev.i18n.ja / .en / .ko を参照する
    const detail = ev.i18n?.[state.lang] || ev.i18n?.ja || {};
    const title = detail.title || ev.id;

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
        <span>${escapeHtml(t(`eventStatus.${ev.status}`) || ev.status || "")}</span>
        <span>${escapeHtml(getEventPeriod(ev))}</span>
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

    // 左上から小さく→大きく登場
    if (!document.body.classList.contains("no-anim")) {
      card.style.opacity = "0";
      card.style.transform = "scale(0.4) translate(-30%, -30%)";
      card.style.transformOrigin = "top left";
      const delay = state.events.indexOf(ev) * 0.08;
      card.style.transition = `opacity 0.45s cubic-bezier(.22,.68,0,1.2) ${delay}s, transform 0.45s cubic-bezier(.22,.68,0,1.4) ${delay}s`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        card.style.opacity = "1";
        card.style.transform = "scale(1) translate(0,0)";
      }));
    }
  });
}

async function openModal(ev) {
  const modal = $("#modal");
  if (!modal) return;

  const mediaWrapMain = $("#modalMediaMain");
  const mediaWrapDetail = $("#modalMediaDetail");

  // i18n はevents.jsonに直接書かれている。言語ごとに ev.i18n.ja / .en / .ko を参照する
  const detail = ev.i18n?.[state.lang] || ev.i18n?.ja || {};
  const title = detail.title || ev.id;
  const descHtml = detail.descHtml || "";

  const mediaType = ev.mediaType || "image";
  const src = ev.src || ev.image || "";
  const poster = ev.poster || "";

  const modalTitle = $("#modalTitle");
  const modalPeriod = $("#modalPeriod");
  const modalDesc = $("#modalDesc");
  if (modalTitle) modalTitle.textContent = title;
  if (modalPeriod) modalPeriod.textContent = getEventPeriod(ev);
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

    // 通常の外部リンク / 内部アンカー
    (ev.links || []).forEach((l) => {
      const a = document.createElement("a");
      a.className = "btn primary";
      a.textContent = t(l.labelKey) || "Open";

      if (l.url && l.url.startsWith("#")) {
        // 内部アンカー：hashchange を一切発火させず直接スクロール
        a.href = "javascript:void(0)";
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
          const anchorId = l.url.slice(1);
          const targetTab = l.linkTab || null;
          const scrollToAnchor = () => {
            const el = document.getElementById(anchorId);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          };
          if (targetTab) {
            // すでに対象タブがアクティブなら即スクロール、そうでなければ切り替えてから待機
            const alreadyActive = document.querySelector(`#page-${targetTab}`)?.classList.contains("active");
            if (alreadyActive) {
              scrollToAnchor();
            } else {
              setActiveTab(targetTab);
              setTimeout(scrollToAnchor, 300);
            }
          } else {
            scrollToAnchor();
          }
        });
      } else {
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener";
      }

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

  // レイアウトはCSSグリッド(grid-areas)で処理するためDOM操作不要
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

/* ── Lightbox: ズーム（スライダー）＆ドラッグ移動 ────────────────── */
let lbScale = 1;
let lbTx = 0;
let lbTy = 0;
let lbDragging = false;
let lbDragStartX = 0;
let lbDragStartY = 0;
let lbPointerId = null;

function applyLightboxTransform() {
  const img = $("#lightboxImg");
  if (!img) return;
  img.style.transform = `translate(${lbTx}px, ${lbTy}px) scale(${lbScale})`;
  img.classList.toggle("lightbox__img--dragging", lbDragging);
  img.style.cursor = lbScale > 1 ? (lbDragging ? "grabbing" : "grab") : "zoom-out";

  const valueEl = $("#lightboxZoomValue");
  if (valueEl) valueEl.textContent = `${Math.round(lbScale * 100)}%`;
}

function resetLightboxZoom() {
  lbScale = 1;
  lbTx = 0;
  lbTy = 0;
  lbDragging = false;
  lbPointerId = null;
  const slider = $("#lightboxZoomSlider");
  if (slider) slider.value = 100;
  applyLightboxTransform();
}

function openLightbox(imgUrl) {
  const lb = $("#lightbox");
  const img = $("#lightboxImg");
  if (!lb || !img) return;

  img.src = imgUrl;
  resetLightboxZoom();
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
  resetLightboxZoom();
}

function downloadLightboxImage() {
  const img = $("#lightboxImg");
  if (!img || !img.src) return;

  let filename = "image";
  try {
    const url = new URL(img.src, window.location.href);
    filename = url.pathname.split("/").pop() || "image";
  } catch {}

  const a = document.createElement("a");
  a.href = img.src;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

async function setLang(lang) {
  const isFirstLoad = !state.lang;
  state.lang = lang;
  localStorage.setItem("lang", lang);

  document.querySelectorAll(".chip[data-lang]").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  // スマホ用プルダウンも同期
  const mobileDropdown = document.getElementById("mobileLangDropdown");
  if (mobileDropdown) mobileDropdown.value = lang;

  // lang.json（軽量テキスト系）と分割ファイル群をマージして読み込む
  const _keys2 = ['support','membership','goods','log','notice','contact','crowdfunding','contest','inquiry'];
  const [part1, ...parts2] = await Promise.all([
    loadJSON(`./i18n/${lang}.json`),
    ..._keys2.map(k => loadJSON(`./i18n/${k}-${lang.toUpperCase()}.json`).catch(() => ({}))),
  ]);
  const part2 = Object.assign({}, ...parts2);
  state.i18n = Object.assign({}, part1, part2);
  document.documentElement.lang = lang === "ja" ? "ja" : (lang === "ko" ? "ko" : "en");
  // 韓国語フォント切り替え用クラス
  document.body.classList.toggle("lang-ko", lang === "ko");

  // 初回ロード以外はスクランブルエフェクト
  if (!isFirstLoad) {
    renderStaticTexts();
    renderEvents();
    scramblePageText();
  } else {
    renderStaticTexts();
    renderEvents();
  }

  // goals再描画（言語切り替え時にDOMが存在すれば即更新）
  const goalsWrap = document.getElementById("dreamGoals");
  if (goalsWrap && _goalsData) {
    renderDreamGoals(goalsWrap, _goalsData);
  }
}

function handleRoute() {
  const hash = location.hash.replace("#", "") || "home";
  const known = ["home", "about", "support", "goods", "log", "membership", "notice", "contact", "crowdfunding", "contest", "inquiry", "temporary"];

  // 完全一致ならそのままタブ切り替え
  if (known.includes(hash)) {
    setActiveTab(hash);
    return;
  }

  // ハッシュがタブ内アンカー（例: "contest-results"）の場合はタブ切り替えしない
  // → hashchange はブラウザのスクロールに任せる
  // ただし現在アクティブなタブがなければ home を表示
  const activeTab = document.querySelector(".page.active");
  if (!activeTab) {
    setActiveTab("home");
  }
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

// ハンバーガーメニューのスクロール制御（常時表示）
function setupHamburgerScrollBehavior() {
  // スマホでは常時表示のため、スクロールによる非表示は行わない
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
    if (e.key === "Escape") {
      closeModal();
      closeLightbox();
    }
  });

  // Carousel buttons: 不要なので非表示
  const prev = $("#carPrev");
  const next = $("#carNext");
  if (prev) prev.style.display = "none";
  if (next) next.style.display = "none";

  // Lightbox close
  const lbBackdrop = $("#lightboxBackdrop");
  const lbImg = $("#lightboxImg");
  const lbStage = $("#lightboxStage");
  const lbCloseBtn = $("#lightboxClose");
  const lbDownloadBtn = $("#lightboxDownload");
  const lbZoomSlider = $("#lightboxZoomSlider");

  if (lbBackdrop) lbBackdrop.addEventListener("click", closeLightbox);
  if (lbCloseBtn) lbCloseBtn.addEventListener("click", closeLightbox);
  if (lbDownloadBtn) lbDownloadBtn.addEventListener("click", downloadLightboxImage);

  // 画像クリック：等倍時はクリックで閉じる／拡大時はドラッグ移動を優先
  if (lbImg) {
    lbImg.addEventListener("click", () => {
      if (lbScale <= 1 && !lbDragging) closeLightbox();
    });
  }

  // ズームスライダー
  if (lbZoomSlider) {
    lbZoomSlider.addEventListener("input", () => {
      lbScale = Number(lbZoomSlider.value) / 100;
      if (lbScale <= 1) {
        lbScale = 1;
        lbTx = 0;
        lbTy = 0;
      }
      applyLightboxTransform();
    });
  }

  // ドラッグで移動（拡大時のみ）
  if (lbStage) {
    lbStage.addEventListener("pointerdown", (e) => {
      if (lbScale <= 1) return;
      lbDragging = true;
      lbPointerId = e.pointerId;
      lbDragStartX = e.clientX - lbTx;
      lbDragStartY = e.clientY - lbTy;
      try { lbStage.setPointerCapture(e.pointerId); } catch {}
      applyLightboxTransform();
    });
    lbStage.addEventListener("pointermove", (e) => {
      if (!lbDragging || e.pointerId !== lbPointerId) return;
      lbTx = e.clientX - lbDragStartX;
      lbTy = e.clientY - lbDragStartY;
      applyLightboxTransform();
    });
    const endLbDrag = (e) => {
      if (!lbDragging) return;
      if (lbPointerId !== null) {
        try { lbStage.releasePointerCapture(lbPointerId); } catch {}
      }
      lbDragging = false;
      lbPointerId = null;
      applyLightboxTransform();
    };
    lbStage.addEventListener("pointerup", endLbDrag);
    lbStage.addEventListener("pointercancel", endLbDrag);
    lbStage.addEventListener("pointerleave", endLbDrag);

    // マウスホイールでもズームできるように
    lbStage.addEventListener(
      "wheel",
      (e) => {
        const lb = $("#lightbox");
        if (!lb || !lb.classList.contains("open")) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        const newValue = Math.max(100, Math.min(400, Number(lbZoomSlider?.value || 100) + delta));
        if (lbZoomSlider) lbZoomSlider.value = newValue;
        lbScale = newValue / 100;
        if (lbScale <= 1) {
          lbScale = 1;
          lbTx = 0;
          lbTy = 0;
        }
        applyLightboxTransform();
      },
      { passive: false }
    );
  }

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

  setupAnimToggle();
  setupScrollAnimations();
}

function setupAnimToggle() {
  const noAnim = localStorage.getItem("noAnim") === "1";
  if (noAnim) document.body.classList.add("no-anim");

  function getAnimLabel(off) {
    return off ? (t("animToggle.off") || "アニメOFF") : (t("animToggle.on") || "アニメON");
  }

  function makeAnimBtn(id, cls) {
    const b = document.createElement("button");
    b.id = id;
    b.className = cls;
    b.setAttribute("aria-label", "アニメーション切り替え");
    b.innerHTML = '<span class="anim-toggle-btn__dot"></span><span class="anim-toggle-btn__label">' + getAnimLabel(noAnim) + '</span>';
    b.addEventListener("click", () => {
      const off = document.body.classList.toggle("no-anim");
      document.querySelectorAll(".anim-toggle-btn__label").forEach(s => s.textContent = getAnimLabel(off));
      localStorage.setItem("noAnim", off ? "1" : "0");
    });
    return b;
  }

  // PC用: 左下フロート（スマホでは非表示）
  const btnPC = makeAnimBtn("animToggleBtnPC", "anim-toggle-btn anim-toggle-btn--pc");
  document.body.appendChild(btnPC);

  // スマホ用: ヘッダー内、☰の左隣（PCでは非表示）
  const btnMobile = makeAnimBtn("animToggleBtnMobile", "anim-toggle-btn anim-toggle-btn--mobile");
  const navToggle = document.getElementById("navToggle");
  if (navToggle && navToggle.parentElement) {
    navToggle.parentElement.insertBefore(btnMobile, navToggle);
  }

  // スマホ用言語ボタン: 🌐マーク、アニメボタンと☰の間に配置
  const langWrap = document.createElement("div");
  langWrap.id = "mobileLangSelect";
  langWrap.className = "mobile-lang-select";

  const langBtn = document.createElement("button");
  langBtn.className = "mobile-lang-globe-btn";
  langBtn.setAttribute("aria-label", "言語選択");
  langBtn.textContent = "🌐";

  const langDropdown = document.createElement("div");
  langDropdown.className = "mobile-lang-dropdown";
  langDropdown.id = "mobileLangDropdown";
  langDropdown.hidden = true;
  ["ja|日本語", "en|English", "ko|한국어"].forEach(item => {
    const [val, label] = item.split("|");
    const btn = document.createElement("button");
    btn.className = "mobile-lang-option";
    btn.dataset.lang = val;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setLang(val);
      langDropdown.hidden = true;
    });
    langDropdown.appendChild(btn);
  });

  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    langDropdown.hidden = !langDropdown.hidden;
  });
  document.addEventListener("click", () => { langDropdown.hidden = true; });

  langWrap.appendChild(langBtn);
  langWrap.appendChild(langDropdown);

  // ☰の直前（アニメボタンの右隣）に挿入
  if (navToggle && navToggle.parentElement) {
    navToggle.parentElement.insertBefore(langWrap, navToggle);
  }
}

function updateAnimToggleLabel() {
  const off = document.body.classList.contains("no-anim");
  const label = off ? (t("animToggle.off") || "アニメOFF") : (t("animToggle.on") || "アニメON");
  document.querySelectorAll(".anim-toggle-btn__label").forEach(s => s.textContent = label);
}

function setupScrollAnimations() {
  const SELECTORS = [".card", ".event", ".asobu-note", ".btn.primary"];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("anim-visible"); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });
  function observeAll() {
    document.querySelectorAll(SELECTORS.join(",")).forEach((el) => {
      if (!el.classList.contains("anim-ready")) { el.classList.add("anim-ready"); observer.observe(el); }
    });
  }
  observeAll();
  const container = document.querySelector(".container");
  if (container) new MutationObserver(() => observeAll()).observe(container, { childList: true, subtree: true });
}

function animateSupportHeader(root) {
  if (!root || document.body.classList.contains("no-anim")) return;
  const header = root.querySelector(".support-header");
  if (!header || header.dataset.shDone) return;
  header.dataset.shDone = "1";

  function runAnim() {
    let globalDelay = 0;
    const CHAR_INTERVAL = 0.065;
    const LINE_GAP = 0.22;
    // HTMLの実際の順番に合わせる: main-title → sub-title → deco-line → accent
    // accentは最後に独立して遅延フェードイン（globalDelayとは無関係）
    const rows = [
      { sel: ".support-main-title", cls: "sh-char",       charMode: true },
      { sel: ".support-sub-title",  cls: "sh-char",       charMode: true },
      { sel: ".support-deco-line",  cls: "sh-char--heart", charMode: true },
    ];
    rows.forEach(({ sel, cls, charMode }) => {
      const el = header.querySelector(sel);
      if (!el || el.dataset.shWrapped) return;
      el.dataset.shWrapped = "1";
      if (!charMode) {
        el.style.opacity = "0";
        const delay = (globalDelay + 0.5).toFixed(2);
        el.style.transition = `opacity 1.1s ease ${delay}s`;
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; }));
        globalDelay += 1.2;
        return;
      }
      function wrapNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          [...node.textContent].forEach((ch) => {
            if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); globalDelay += CHAR_INTERVAL * 0.25; }
            else {
              const span = document.createElement("span");
              span.className = cls;
              span.textContent = ch;
              span.style.animationDelay = globalDelay.toFixed(3) + "s";
              frag.appendChild(span);
              globalDelay += CHAR_INTERVAL;
            }
          });
          node.replaceWith(frag);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          [...node.childNodes].forEach(wrapNodes);
        }
      }
      const tmp = document.createElement("div");
      tmp.innerHTML = el.innerHTML;
      [...tmp.childNodes].forEach(wrapNodes);
      el.innerHTML = tmp.innerHTML;
      globalDelay += LINE_GAP;
    });

    // .support-accent は他の文字アニメと完全に独立して、3秒後にめちゃゆっくりフェードイン
    const accentEl = header.querySelector(".support-accent");
    if (accentEl && !accentEl.dataset.shWrapped) {
      accentEl.dataset.shWrapped = "1";
      accentEl.style.opacity = "0";
      accentEl.style.transition = "opacity 6s ease 3s";
      requestAnimationFrame(() => requestAnimationFrame(() => { accentEl.style.opacity = "1"; }));
    }
  }
  const obs = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { runAnim(); obs.disconnect(); } });
  }, { threshold: 0.1 });
  obs.observe(header);
}

// 遊の嬉しさランキング：アイテムを1から順にスライドイン
function animatePriorityList(root) {
  if (!root || document.body.classList.contains("no-anim")) return;

  root.querySelectorAll(".support-list").forEach((list) => {
    if (list.dataset.listDone) return;
    list.dataset.listDone = "1";
    const rows = [...list.querySelectorAll(".support-item-row")];
    const obs = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        rows.forEach((row, i) => {
          row.style.opacity = "0";
          row.style.transform = "translateX(-24px)";
          const delay = (i * 0.13).toFixed(2) + "s";
          row.style.transition = `opacity .5s cubic-bezier(.22,.68,0,1.2) ${delay}, transform .5s cubic-bezier(.22,.68,0,1.4) ${delay}`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            row.style.opacity = "1";
            row.style.transform = "translateX(0)";
          }));
        });
      });
    }, { threshold: 0.1 });
    obs.observe(list);
  });
}

function animateTimeline(root) {
  if (!root || document.body.classList.contains("no-anim")) return;
  const timeline = root.querySelector(".support-timeline");
  if (!timeline || timeline.dataset.tlDone) return;
  timeline.dataset.tlDone = "1";
  const cards = [...timeline.querySelectorAll(".support-tl-card")];
  const obs = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      cards.forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateX(-18px)";
        const delay = (i * 0.18).toFixed(2) + "s";
        card.style.transition = "opacity .55s cubic-bezier(.22,.68,0,1.2) " + delay + ", transform .55s cubic-bezier(.22,.68,0,1.4) " + delay;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          card.style.opacity = "1";
          card.style.transform = "translateX(0)";
        }));
      });
    });
  }, { threshold: 0.15 });
  obs.observe(timeline);
}

function scramblePageText() {
  if (document.body.classList.contains("no-anim")) return;
  const CHARS_JP = "あいうえおかきくけこさしすせそたちつてとなにぬねの遊命愛夢花光星";
  const CHARS_EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&";
  const CHARS_KR = "가나다라마바사아자차카타파하개내대래배새애재채케테페해";
  const GLITCH   = "█▓▒░╔╗╚╝║═╬▲▼◆◇●○★☆♡♥⋈∞";
  const ALL = CHARS_JP + CHARS_EN + CHARS_KR + GLITCH;
  const rand = (str) => str[Math.floor(Math.random() * str.length)];

  // 言語ボタン以外の全テキスト要素を収集
  const leafTextEls = [];
  function collectLeafText(root) {
    root.querySelectorAll("*").forEach((el) => {
      // 言語ボタン・アニメトグル・スクリプト・スタイル・input系を除外
      if (el.closest(".chip[data-lang]") || el.closest(".anim-toggle-btn") ||
          el.tagName === "SCRIPT" || el.tagName === "STYLE" ||
          el.tagName === "INPUT" || el.tagName === "TEXTAREA" ||
          el.tagName === "BUTTON" && el.closest(".chip[data-lang]")) return;
      // 子要素にテキストノードのみを持つ葉要素
      const hasOnlyTextNodes = [...el.childNodes].every(n => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === "BR"));
      if (hasOnlyTextNodes && el.textContent.trim().length > 0) {
        leafTextEls.push(el);
      }
    });
  }

  // ヘッダー・フッター・タブ・現在アクティブなページ
  const header = document.querySelector(".topbar");
  if (header) collectLeafText(header);
  const footer = document.querySelector(".footer");
  if (footer) collectLeafText(footer);
  const tabs = document.querySelectorAll(".tab, .tab--mobile");
  tabs.forEach(el => { if (!leafTextEls.includes(el)) leafTextEls.push(el); });
  const activePage = document.querySelector(".page.active");
  if (activePage) collectLeafText(activePage);

  const targets = leafTextEls.filter(el =>
    !el.closest(".chip[data-lang]") && !el.closest(".anim-toggle-btn") && el.textContent.trim().length > 0
  );

  // 各要素のテキストノードだけを収集（BRは触らない）
  const targetTextNodes = targets.map((el) => {
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3);
    return { el, nodes, origTexts: nodes.map(n => n.nodeValue) };
  });
  const originals = targets.map((el) => el.textContent);
  const DURATION = 750;
  const FPS = 55;
  let elapsed = 0;
  const tick = setInterval(() => {
    elapsed += FPS;
    const progress = Math.min(elapsed / DURATION, 1);
    targetTextNodes.forEach(({ nodes, origTexts }) => {
      nodes.forEach((node, ni) => {
        const orig = origTexts[ni];
        const revealed = Math.floor(orig.length * progress);
        let out = "";
        for (let i = 0; i < orig.length; i++) {
          if (/\s/.test(orig[i])) { out += orig[i]; continue; }
          out += i < revealed ? orig[i] : rand(ALL);
        }
        node.nodeValue = out;
      });
    });
    if (progress >= 1) {
      clearInterval(tick);
      targetTextNodes.forEach(({ nodes, origTexts }) => {
        nodes.forEach((node, ni) => { node.nodeValue = origTexts[ni]; });
      });
    }
  }, FPS);
}

// タブを開いたときに発火するミッション演出
// コンテンツを一旦隠してオーバーレイ後に登場させる
function triggerMissionAnim(bodyEl, titleText, contentSelector) {
  if (!bodyEl || document.body.classList.contains("no-anim")) return;

  // コンテンツを一旦非表示
  const contents = contentSelector
    ? [...bodyEl.querySelectorAll(contentSelector)]
    : [bodyEl];

  // 要素が見つからない場合はそのまま演出だけ
  contents.forEach(el => {
    el.style.opacity = "0";
    el.style.transition = "none";
    el.style.transform = "translateY(16px)";
  });

  // ミッション演出後にコンテンツを順番に登場
  animateMissionTitle(titleText, () => {
    contents.forEach((el, i) => {
      const delay = i * 0.15;
      el.style.transition = `opacity 0.65s ease ${delay}s, transform 0.65s cubic-bezier(.22,.68,0,1.2) ${delay}s`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }));
    });
  });
}

// ===== Mission Title アニメーション =====
// ゲームのミッション名が中央に出て通常位置に戻る演出
function animateMissionTitle(titleText, onComplete) {
  if (document.body.classList.contains("no-anim")) {
    if (onComplete) onComplete();
    return;
  }

  // 既存オーバーレイがあれば除去
  const old = document.getElementById("mission-overlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "mission-overlay";
  overlay.innerHTML = `
    <div class="mission-overlay__bg"></div>
    <div class="mission-overlay__content">
      <div class="mission-overlay__label">MISSION</div>
      <div class="mission-overlay__title">${titleText}</div>
      <div class="mission-overlay__bar"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // フェードイン
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add("mission-overlay--in");
  }));

  // 少し待ってからフェードアウト
  setTimeout(() => {
    overlay.classList.add("mission-overlay--out");
    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, 800);
  }, 2200);
}

function initMissionAnim(bodyEl, titleText, contentSelector) {
  if (!bodyEl || document.body.classList.contains("no-anim")) return;
  if (bodyEl.dataset.missionDone) return;
  bodyEl.dataset.missionDone = "1";

  // コンテンツを一旦非表示
  const contents = contentSelector
    ? bodyEl.querySelectorAll(contentSelector)
    : [bodyEl];
  contents.forEach(el => {
    el.style.opacity = "0";
    el.style.transition = "none";
  });

  // ミッション演出後にコンテンツを順番に登場
  animateMissionTitle(titleText, () => {
    contents.forEach((el, i) => {
      const delay = i * 0.12;
      el.style.transition = `opacity 0.6s ease ${delay}s, transform 0.6s cubic-bezier(.22,.68,0,1.2) ${delay}s`;
      el.style.transform = "translateY(14px)";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }));
    });
  });
}
function toggleAcc(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

async function init() {
  // ── ヘッダーを上部固定 ──────────────────────────────────────────
  if (!document.getElementById("header-fixed-style")) {
    const s = document.createElement("style");
    s.id = "header-fixed-style";
    s.textContent = `
      .topbar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 1000 !important;
      }
      body { padding-top: var(--topbar-height, 56px); }
    `;
    document.head.appendChild(s);
  }
  // ────────────────────────────────────────────────────────────────

  wireOnce();

/* ── クラファン内タブ切り替え ── */
window.cfTabSwitch = function(name, btn) {
  document.querySelectorAll('.cf-inner-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.cf-inner-tab').forEach(function(b) { b.classList.remove('active'); });
  var panel = document.getElementById('cf-panel-' + name);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
};

  // ── ヘッダー＆タブ: スクロールで隠す ＋ フロートボタン ──
  (function() {
    var topbar = document.querySelector('.topbar');
    var tabs = document.getElementById('tabs');
    var lastY = 0;
    var threshold = 80;

    // フロートボタンをbodyに追加
    var floatBtn = document.createElement('button');
    floatBtn.className = 'scroll-top-float';
    floatBtn.setAttribute('aria-label', 'ページトップへ');
    floatBtn.innerHTML = '↑';
    floatBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(floatBtn);

    window.addEventListener('scroll', function() {
      var y = window.scrollY;

      // ヘッダー＆タブの表示制御
      if (y > threshold && y > lastY) {
        // 下にスクロール → 隠す
        if (topbar) topbar.classList.add('topbar--hidden');
        if (tabs) tabs.classList.add('tabs--hidden');
      } else {
        // 上にスクロール or トップ付近 → 表示
        if (topbar) topbar.classList.remove('topbar--hidden');
        if (tabs) tabs.classList.remove('tabs--hidden');
      }

      // フロートボタンの表示制御
      if (y > 300) {
        floatBtn.classList.add('visible');
      } else {
        floatBtn.classList.remove('visible');
      }

      lastY = y;
    }, { passive: true });
  })();

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

/* ─────────────────────────────────────────────────────────────
   叶えたい夢ゴール描画
   ───────────────────────────────────────────────────────────── */
/* goals.jsonキャッシュ */
let _goalsData = null;

async function initDreamGoals() {
  const wrap = document.getElementById("dreamGoals");
  if (!wrap) return;

  // i18nのgoalsが存在すればそちらを優先（言語切替対応）
  if (state.i18n && state.i18n.goals) {
    renderDreamGoals(wrap, state.i18n.goals);
    return;
  }

  // fallback: goals.jsonを直接fetch
  if (!_goalsData) {
    try {
      const res = await fetch("./goals.json", { cache: "no-store" });
      if (!res.ok) throw new Error();
      _goalsData = await res.json();
    } catch(e) { return; }
  }

  renderDreamGoals(wrap, _goalsData);
}

function renderDreamGoals(wrap, data) {
  /* 各言語JSONはその言語のフィールドのみ持つため sfx 不要 */
  function gl(g, key) {
    return g[key] || "";
  }

  /* 達成済み(done)を末尾に移動 */
  const goals = (data.goals || []).slice().sort(function(a, b) {
    return (a.type === 'done' ? 1 : 0) - (b.type === 'done' ? 1 : 0);
  });
  wrap.innerHTML = "";

  goals.forEach(function(g) {
    const card = document.createElement("div");
    card.className = "dg-card";

    if (g.type === "done") {
      /* ── 達成済み ── */
      card.className = "dg-card dg-card--done";
      card.innerHTML =
        '<div class="dg-head">' +
          '<span class="dg-icon">' + g.icon + '</span>' +
          '<div class="dg-titles">' +
            '<div class="dg-title">' + gl(g, "title") + '</div>' +
            '<div class="dg-sub">' + gl(g, "subtitle") + '</div>' +
          '</div>' +
          '<span class="dg-badge dg-badge--done dg-badge--lg">' + (gl(g, "note") || '達成！') + '</span>' +
        '</div>' +
        '<div class="dg-bar-wrap"><div class="dg-bar dg-bar--done" style="width:100%"></div></div>';

    } else if (g.type === "progress") {
      /* ── プログレスバー ── */
      var pct = Math.min(100, Math.round((g.current / g.target) * 100));
      card.innerHTML =
        '<div class="dg-head">' +
          '<span class="dg-icon">' + g.icon + '</span>' +
          '<div class="dg-titles">' +
            '<div class="dg-title">' + gl(g, "title") + '</div>' +
            '<div class="dg-sub">' + gl(g, "subtitle") + '</div>' +
          '</div>' +
          '<span class="dg-pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="dg-bar-wrap"><div class="dg-bar dg-bar--prog" style="width:' + pct + '%"></div></div>';

    } else if (g.type === "monthly") {
      /* ── 月別カード ── */
      // グループ別にwrapperで囲んでHTMLを生成
      var monthsHtml = '';
      var months = g.months || [];
      var i = 0;
      while (i < months.length) {
        var m = months[i];
        var cls = "dg-month";
        if      (m.status === "none")    cls += " dg-month--none";
        else if (m.status === "done")    cls += " dg-month--done";
        else if (m.status === "current") cls += " dg-month--current";
        else if (m.status === "failed")  cls += " dg-month--failed";
        else                             cls += " dg-month--empty";
        var value = m.status !== "none" ? (m.value || "") : "";
        var inner = m.status === "none"
          ? '<span class="dg-month-x">✕</span>'
          : '<span class="dg-month-val">' + value + '</span>';
        var cell = '<div class="' + cls + '"><div class="dg-month-label">' + m.label + '</div>' + inner + '</div>';

        // グループの先頭ならまとめてwrapperに入れる
        if (m.group) {
          var groupName = m.group;
          var groupCells = cell;
          i++;
          while (i < months.length && months[i].group === groupName) {
            var gm = months[i];
            var gcls = "dg-month";
            if      (gm.status === "none")    gcls += " dg-month--none";
            else if (gm.status === "done")    gcls += " dg-month--done";
            else if (gm.status === "current") gcls += " dg-month--current";
            else if (gm.status === "failed")  gcls += " dg-month--failed";
            else                              gcls += " dg-month--empty";
            var gvalue = gm.status !== "none" ? (gm.value || "") : "";
            var ginner = gm.status === "none"
              ? '<span class="dg-month-x">✕</span>'
              : '<span class="dg-month-val">' + gvalue + '</span>';
            groupCells += '<div class="' + gcls + '"><div class="dg-month-label">' + gm.label + '</div>' + ginner + '</div>';
            i++;
          }
          monthsHtml += '<div class="dg-month-group-wrap">' + groupCells + '</div>';
        } else {
          monthsHtml += cell;
          i++;
        }
      }

      card.innerHTML =
        '<div class="dg-head">' +
          '<span class="dg-icon">' + g.icon + '</span>' +
          '<div class="dg-titles">' +
            '<div class="dg-title">' + gl(g, "title") + '</div>' +
            '<div class="dg-sub">' + gl(g, "subtitle") + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dg-months">' + monthsHtml + '</div>' +
        (g.buttonText ? '<div style="margin-top: 16px; text-align: center;">' +
          '<a href="#crowdfunding" class="chip" style="display: inline-block; padding: 10px 20px; text-decoration: none; background: rgba(255,121,176,.25); border-color: rgba(255,121,176,.6); box-shadow: 0 0 0 2px rgba(255,121,176,.1); font-weight: 500;">' + gl(g, "buttonText") + '</a>' +
        '</div>' : '');
    }

    wrap.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────────────
   サムネイルギャラリー
   ・URLが動画への直リンク（youtu.be / watch / live / shorts）の場合、
     そのスライドがアクティブになったら動画を直接埋め込んで自動再生する。
   ・プレイリストや#contestのような通常リンクは今まで通りサムネイル画像＋
     クリックで外部/内部リンクを開く。
   ・「自動再生」ON/OFFはボタンで切り替え可能で、localStorageに保存され
     次回サイトを開いた時も設定が引き継がれる。
   ───────────────────────────────────────────────────────────── */
(function () {

  let _thumbs   = null; // null=未ロード / [] 以上=ロード済み
  let _current  = 0;
  let _timer    = null;
  let _paused   = false;
  const INTERVAL = 8000;
  const INITIAL_DELAY = 8000;
  const AUTOPLAY_KEY = "tgAutoplay";

  function isAutoplayOn() {
    return localStorage.getItem(AUTOPLAY_KEY) !== "0"; // デフォルトON
  }
  function setAutoplayOn(on) {
    localStorage.setItem(AUTOPLAY_KEY, on ? "1" : "0");
  }

  // YouTubeへの直リンク（動画）ならvideoIdを返す。プレイリスト等はnull。
  function extractYouTubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
      if (host === "youtu.be") {
        return u.pathname.slice(1).split("/")[0] || null;
      }
      if (host === "youtube.com") {
        if (u.pathname === "/watch") return u.searchParams.get("v");
        if (u.pathname.startsWith("/live/"))   return u.pathname.split("/")[2] || null;
        if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
        if (u.pathname.startsWith("/embed/"))  return u.pathname.split("/")[2] || null;
      }
    } catch (e) {}
    return null; // playlist等はここでnullになる
  }

  function autoplayLabel(on) {
    const key = on ? "home.autoplayOn" : "home.autoplayOff";
    const fallback = on ? "自動再生：ON" : "自動再生：OFF";
    return (typeof t === "function" ? (t(key) || fallback) : fallback);
  }

  function updateAutoplayBtn() {
    const btn = document.getElementById("tgAutoplayBtn");
    if (!btn) return;
    const on = isAutoplayOn();
    btn.classList.toggle("is-off", !on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const label = btn.querySelector(".tg-autoplay-btn__label");
    if (label) label.textContent = autoplayLabel(on);
  }

  function bindAutoplayBtn() {
    const btn = document.getElementById("tgAutoplayBtn");
    if (!btn) return;
    btn.onclick = function () {
      setAutoplayOn(!isAutoplayOn());
      updateAutoplayBtn();
      applyActiveMedia();
    };
    updateAutoplayBtn();
  }

  // 現在表示中(アクティブ)のスライドだけ動画を埋め込み、他は画像に戻す
  function applyActiveMedia() {
    const track = document.getElementById("thumbGalleryTrack");
    if (!track) return;
    const items = track.querySelectorAll(".tg-item");
    const on = isAutoplayOn();
    items.forEach(function (item, i) {
      const videoId = item.dataset.videoId || "";
      const videoUrl = item.dataset.videoUrl || ("https://youtu.be/" + videoId);
      const existingFrame = item.querySelector(".tg-video-frame");
      if (i === _current && on && videoId) {
        if (!existingFrame) {
          const frame = document.createElement("div");
          frame.className = "tg-video-frame";
          frame.innerHTML =
            '<iframe class="tg-video-frame__iframe" ' +
              'src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=1&rel=0&playsinline=1&controls=0&modestbranding=1&showinfo=0&iv_load_policy=3&disablekb=1&loop=1&playlist=' + videoId + '" ' +
              'title="YouTube video player" frameborder="0" ' +
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
              'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' +
            '<a class="tg-video-frame__link-overlay" href="' + videoUrl + '" target="_blank" rel="noopener" aria-label="Watch on YouTube"></a>';
          item.appendChild(frame);
        }
      } else if (existingFrame) {
        existingFrame.remove();
      }
    });
  }

  async function loadThumbs() {
    if (_thumbs !== null) return _thumbs;
    try {
      const res = await fetch("./thumbnails.json", { cache: "no-store" });
      if (!res.ok) throw new Error("not found");
      _thumbs = await res.json();
    } catch (e) {
      _thumbs = [];
    }
    return _thumbs;
  }

  function updateDots(total, idx) {
    const dots = document.getElementById("thumbGalleryDots");
    if (!dots) return;
    dots.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const d = document.createElement("button");
      d.className = "tg-dot" + (i === idx ? " active" : "");
      d.setAttribute("aria-label", (i + 1) + "枚目");
      d.addEventListener("click", (function(n){ return function(){ goTo(n); }; })(i));
      dots.appendChild(d);
    }
  }

  function goTo(idx) {
    const track = document.getElementById("thumbGalleryTrack");
    if (!track) return;
    const items = track.querySelectorAll(".tg-item");
    if (!items.length) return;
    _current = ((idx % items.length) + items.length) % items.length;
    /* PC(>=768px)は2枚並び(50%幅)、スマホは1枚(100%幅) */
    const pct = window.innerWidth >= 768 ? 50 : 100;
    track.style.transform = "translateX(-" + (_current * pct) + "%)";
    updateDots(items.length, _current);
    applyActiveMedia();
  }

  function startSlider(isFirst) {
    clearInterval(_timer);
    const delay = isFirst ? INITIAL_DELAY : INTERVAL;
    _timer = setTimeout(function() {
      if (!_paused) goTo(_current + 1);
      _timer = setInterval(function() {
        if (!_paused) goTo(_current + 1);
      }, INTERVAL);
    }, delay);
  }

  async function render(thumbs) {
    const track = document.getElementById("thumbGalleryTrack");
    if (!track) return;
    const section = track.closest(".thumb-gallery-section");
    if (!thumbs.length) {
      if (section) section.style.display = "none";
      return;
    }
    if (section) section.style.display = "";

    /* 左右ボタン */
    const btnPrev = section && section.querySelector(".tg-btn--prev");
    const btnNext = section && section.querySelector(".tg-btn--next");
    if (btnPrev) btnPrev.onclick = function() { goTo(_current - 1); };
    if (btnNext) btnNext.onclick = function() { goTo(_current + 1); };

    track.innerHTML = "";
    thumbs.forEach(function(thumb) {
      const file = thumb.file;
      const url  = thumb.url || "";
      const videoId = extractYouTubeId(url);
      const item = document.createElement("div");
      item.className = "tg-item";
      if (videoId) {
        item.dataset.videoId = videoId;
        item.dataset.videoUrl = url;
      }

      const img = document.createElement("img");
      img.src     = "./thumbnails/" + file;
      img.alt     = file;
      img.loading = "eager"; /* lazyをやめて確実にロード */
      img.style.cursor = url ? "pointer" : "default";

      if (url) {
        img.addEventListener("click", (function(u){ return function(){ window.open(u, "_blank", "noopener"); }; })(url));
      }

      item.appendChild(img);
      track.appendChild(item);
    });

    _current = 0;
    track.style.transform = "translateX(0)";
    updateDots(thumbs.length, 0);
    applyActiveMedia();
    startSlider(true);
  }

  window.initThumbGallery = async function() {
    clearInterval(_timer);
    clearTimeout(_timer);
    _paused  = false;
    _current = 0;
    _thumbs  = null; /* 毎回フレッシュにフェッチ */

    bindAutoplayBtn();

    const track = document.getElementById("thumbGalleryTrack");
    if (!track) return;

    const thumbs = await loadThumbs();
    await render(thumbs);
  };

})();


init().catch((err) => {
  console.error(err);
  alert("初期化に失敗しました。コンソールを確認してください。");
});
/* ─────────────────────────────────────────────────────────────
   自己紹介タブ - スライド式立ち絵（フェード・自動再生・ボタンハイライト）
   ───────────────────────────────────────────────────────────── */
(function () {
  let _idx = 0;
  let _autoTimer = null;
  let _autoStarted = false;
  const FADE_MS = 400;
  const INTERVAL_MS = 2000;

  function updateButtons(n) {
    document.querySelectorAll('.about-stand-icon-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === n);
    });
    // .about-stand-dot があれば更新
    document.querySelectorAll('.about-stand-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === n);
    });
  }

  function goTo(n, fromAuto) {
    const slides = document.querySelectorAll('.about-stand-slide');
    if (!slides.length) return;
    const total = slides.length;
    const next = ((n % total) + total) % total;
    if (next === _idx && !fromAuto) return;

    const current = slides[_idx];
    const target  = slides[next];

    // フェードアウト → フェードイン
    current.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    current.style.opacity = '0';

    setTimeout(() => {
      current.style.display = 'none';
      current.style.transition = '';
      current.style.opacity = '1';

      target.style.opacity = '0';
      target.style.display = 'block';
      // 強制リフロー
      void target.offsetWidth;
      target.style.transition = 'opacity ' + FADE_MS + 'ms ease';
      target.style.opacity = '1';

      setTimeout(() => {
        target.style.transition = '';
      }, FADE_MS);

      _idx = next;
      updateButtons(_idx);
    }, FADE_MS);
  }

  // 自動再生：全画像を1周したら停止（0→1→…→last→0で停止）
  function startAuto() {
    if (_autoStarted) return;
    _autoStarted = true;
    const slides = document.querySelectorAll('.about-stand-slide');
    if (!slides.length || slides.length < 2) return;
    const total = slides.length;
    let steps = 0; // 進んだ枚数

    _autoTimer = setInterval(() => {
      steps++;
      if (steps >= total) {
        // 最後のステップ：最初（index 0）に戻って停止
        clearInterval(_autoTimer);
        _autoTimer = null;
        goTo(0, true);
      } else {
        goTo(_idx + 1, true);
      }
    }, INTERVAL_MS);
  }

  window.aboutSliderGo = function(n) {
    // 手動操作で自動を止める
    if (_autoTimer) {
      clearInterval(_autoTimer);
      _autoTimer = null;
    }
    goTo(n, false);
  };

  // 自己紹介タブが表示されたタイミングで自動再生を開始
  // MutationObserver で page-about の表示を監視
  const aboutPage = document.getElementById('page-about');
  if (aboutPage) {
    const obs = new MutationObserver(() => {
      if (aboutPage.classList.contains('active') || aboutPage.style.display !== 'none') {
        startAuto();
      }
    });
    obs.observe(aboutPage, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // タブクリックでも起動できるように、グローバルフックを追加
  window._aboutSliderStartAuto = startAuto;
})();

/* ─────────────────────────────────────────────────────────────
   オニギリスライダー
   ───────────────────────────────────────────────────────────── */
let _onigiriIndex = 0;
window.onigiriGo = function(n) {
  _onigiriIndex = n;
  const track = document.getElementById('onigiriTrack');
  const dots = document.querySelectorAll('.onigiri-dot');
  
  if (track) {
    track.style.transform = 'translateX(' + (-n * 100) + '%)';
  }
  
  dots.forEach((dot, i) => {
    if (i === n) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
};

/* ─────────────────────────────────────────────────────────────
   コンテスト - 塗り絵ツールトグル
   ───────────────────────────────────────────────────────────── */
window.toggleColoringTool = function() {
  const tool = document.getElementById('contestColoringTool');
  if (tool) {
    tool.style.display = tool.style.display === 'none' ? 'block' : 'none';
  }
};

/* ─────────────────────────────────────────────────────────────
   グッズソート機能
   ───────────────────────────────────────────────────────────── */
function initGoodsSort() {
  const container = document.getElementById('goods-container');
  const sortButtons = document.querySelectorAll('.goods-sort-btn');
  
  if (!container || sortButtons.length === 0) return;
  
  // 現在のソート状態を保持（デフォルトは新しい順）
  let currentSort = 'new';
  
  // 初期表示時に新しい順にソート
  sortGoods('new');
  
  sortButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const sortType = this.dataset.sort;
      
      // ボタンのアクティブ状態を更新（インラインスタイルもリセット）
      sortButtons.forEach(b => {
        b.classList.remove('goods-sort-btn--active');
        b.style.background = 'rgba(255,255,255,.1)';
        b.style.border = '1px solid rgba(255,255,255,.2)';
      });
      this.classList.add('goods-sort-btn--active');
      this.style.background = 'rgba(255,110,180,.3)';
      this.style.border = '1px solid rgba(255,110,180,.5)';
      
      // ソートを実行
      sortGoods(sortType);
      currentSort = sortType;
    });
  });
  
  function sortGoods(sortType) {
    const goodsBoxes = Array.from(container.querySelectorAll('.goods-box'));
    
    // order=0のアイテム（寿命同盟限定グッズ）を固定
    const fixedBox = goodsBoxes.find(box => box.dataset.goodsOrder === '0');
    // order=1以上のアイテムをソート対象とする
    const sortableBoxes = goodsBoxes.filter(box => {
      const order = box.dataset.goodsOrder;
      return order !== undefined && order !== '0';
    });
    
    // ソート
    sortableBoxes.sort((a, b) => {
      const orderA = parseInt(a.dataset.goodsOrder);
      const orderB = parseInt(b.dataset.goodsOrder);
      
      if (sortType === 'new') {
        // 新しい順（order番号の降順）
        return orderB - orderA;
      } else {
        // 古い順（order番号の昇順）
        return orderA - orderB;
      }
    });
    
    // コンテナをクリアして再配置
    // 固定アイテム（寿命同盟限定グッズ）は常に最初
    if (fixedBox) {
      container.appendChild(fixedBox);
    }
    sortableBoxes.forEach(box => container.appendChild(box));
  }
}

/* ─────────────────────────────────────────────────────────────
   PayPalボタンレンダリング
   ───────────────────────────────────────────────────────────── */
function renderPayPalButtons() {
  // 言語別ボタンID
  const PAYPAL_BUTTON_IDS = {
    ja: "RK2RCL2TGJWVU",
    en: "JV7MAH6NJSJ78",
    ko: "LJRWNXZZMM3Z2",
  };
  const lang = (localStorage.getItem("lang") || "ja").toLowerCase();
  const hostedButtonId = PAYPAL_BUTTON_IDS[lang] || PAYPAL_BUTTON_IDS.ja;

  // PayPal SDKが読み込まれるまで待機
  function attemptRender() {
    if (typeof paypal !== 'undefined' && paypal.HostedButtons) {
      // ページ内の全PayPalコンテナを対象（クラファン・supportタブ両対応）
      const containers = document.querySelectorAll('[id^="paypal-container-"]');
      containers.forEach(function(container) {
        // 中身が空の場合のみレンダリング（再注入後も確実に描画）
        if (!container.hasChildNodes()) {
          paypal.HostedButtons({
            hostedButtonId: hostedButtonId,
            styles: {
              shape: "pill",
              color: "gold",
              label: "paypal",
            },
          }).render("#" + container.id);
        }
      });
    } else {
      // PayPal SDKがまだ読み込まれていない場合は100ms後に再試行
      setTimeout(attemptRender, 100);
    }
  }
  attemptRender();
}

/* ─────────────────────────────────────────────────────────────
   クラウドファンディングタブ切り替え
   ───────────────────────────────────────────────────────────── */
window.cfTabSwitch = function(panelId, btn) {
  // すべてのタブとパネルから active を削除
  document.querySelectorAll('.cf-inner-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.cf-inner-panel').forEach(p => p.classList.remove('active'));
  
  // クリックされたタブとパネルに active を追加
  btn.classList.add('active');
  const panel = document.getElementById('cf-panel-' + panelId);
  if (panel) {
    panel.classList.add('active');
  }
};
/* ─────────────────────────────────────────────────────────────
   お知らせデータ（画面ジャック共通ソース）
   期間ごとに動画/画像・メッセージ・ボタンを切り替える。
   ASOBU_PHASES を上から順にチェックし、現在時刻が最初に一致した
   フェーズ（end が null、または現在時刻が end 以前）を採用する。
   ★ここが唯一のデータソース★
   起動時ポップアップ（画面ジャック）とホームの「お知らせ」コーナーは
   両方ともこのASOBU_PHASESを参照するだけで、内容を二重に書かない。
   message / button.text は
     ・文字列を渡す　→　日本語固定で全言語共通表示（従来通り）
     ・{ ja, en, ko } オブジェクトを渡す　→　現在の表示言語に連動
   のどちらでも指定できる。
   ───────────────────────────────────────────────────────────── */
var ASOBU_PHASES = [
  {
    id: "20260829-summer",
    end: new Date("2026-08-29T23:59:59+09:00").getTime(),
    type: "video",
    videoId: "jm-2KiEF-Zs",
    message: "御手洗THEサマー☀夏祭り配信！\n金魚すくい、スイカ割り、歌のステージ、花火大会、マイクラ企画など盛りだくさん！\n8月29日15:00からゼッタイ来てね～🤍"
  },
  {
    id: "20260911-gigo",
    end: new Date("2026-09-10T23:59:59+09:00").getTime(),
    type: "image",
    // TODO: GiGOコラボ用の画像を ./assets/gigo.png として配置してください
    image: "./assets/gigo.png",
    message: {
      ja: "GiGO ゲームセンターに御手洗遊が登場！？\n一緒にツーショット、撮ろ？🤍",
      en: "Mitarai Asobu is coming to GiGO amusement arcade!?\nWant to take a photo together? 🤍",
      ko: "GiGO 오락실 미타라이 아소부가 등장!?\n같이 투샷 찍을래? 🤍"
    },
    button: {
      text: { ja: "詳細を見る", en: "View Details", ko: "자세히 보기" },
      url: "https://www.gigo.co.jp/shops/dotonbori",
      eventId: "gigo_appearance"
    }
  },
  {
    id: "20260911-jinsengo",
    end: null,
    type: "video",
    videoId: "cFpn8p2eaM0",
    message: "第五人格、夜の番人杯を主催するぞ！選手としても参加するよ！大会を勝ち進めるように応援しに来てね🤍"
  }
];

function asobuCurrentPhase() {
  var now = Date.now();
  for (var i = 0; i < ASOBU_PHASES.length; i++) {
    if (ASOBU_PHASES[i].end === null || now <= ASOBU_PHASES[i].end) return ASOBU_PHASES[i];
  }
  return null;
}

// 文字列 または {ja,en,ko} を、現在の表示言語に合わせて解決する
function asobuLocalize(val) {
  if (val && typeof val === "object") {
    var lang = (typeof state !== "undefined" && state.lang) || localStorage.getItem("lang") || "ja";
    return val[lang] || val.ja || "";
  }
  return val || "";
}

// 画面ジャック／ホームお知らせカードの両方から呼べる共通ビルダー
function asobuBuildMediaHtml(phase, opts) {
  opts = opts || {};
  var frameClass = opts.frameClass || "screen-jack__frame-wrap";
  var imgClass = opts.imgClass || "screen-jack__image";
  var iframeClass = opts.iframeClass || "screen-jack__iframe";
  var linkClass = opts.linkClass || "screen-jack__link-overlay";
  var autoplay = opts.autoplay === false ? "0" : "1";

  if (phase.type === "video") {
    var videoUrl = "https://youtu.be/" + phase.videoId;
    return (
      '<div class="' + frameClass + '">' +
        '<iframe class="' + iframeClass + '" ' +
          'src="https://www.youtube.com/embed/' + phase.videoId + '?autoplay=' + autoplay + '&mute=1&rel=0" ' +
          'title="YouTube video player" frameborder="0" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
          'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' +
        (opts.linkOverlay === false ? "" :
          '<a class="' + linkClass + '" href="' + videoUrl + '" target="_blank" rel="noopener" aria-label="Watch on YouTube"></a>') +
      "</div>"
    );
  }
  return (
    '<div class="' + frameClass + ' ' + frameClass + '--image">' +
      '<img class="' + imgClass + '" src="' + phase.image + '" alt="">' +
    "</div>"
  );
}

function asobuBuildButtonHtml(phase, btnClass) {
  if (!phase.button) return "";

  // eventId が指定されている場合は、URLへ直接遷移せず
  // events.json内の該当イベントの詳細モーダル（タイトル・日程・説明文）を開く
  if (phase.button.eventId) {
    return (
      '<button type="button" class="' + (btnClass || "screen-jack__cta-btn") + '" onclick="openAsobuEventModal(\'' + phase.button.eventId + '\')">' +
        asobuLocalize(phase.button.text) +
      "</button>"
    );
  }

  return (
    '<a class="' + (btnClass || "screen-jack__cta-btn") + '" href="' + phase.button.url + '" target="_blank" rel="noopener">' +
      asobuLocalize(phase.button.text) +
    "</a>"
  );
}

// お知らせ／画面ジャックのボタンから、events.json内の該当イベントの
// 詳細モーダル（タイトル・日程・説明文）を開くためのグローバル関数
window.openAsobuEventModal = function (eventId) {
  var ev = (state.events || []).find(function (e) { return e.id === eventId; });
  if (!ev) return;
  var mediaType = ev.mediaType || "image";
  var src = ev.src || ev.image || "";
  var poster = ev.poster || "";
  openModal(Object.assign({}, ev, {
    image: mediaType === "video" ? (poster || src) : src
  }));
};

/* ─────────────────────────────────────────────────────────────
   画面ジャック（告知オーバーレイ）
   ロードアニメーション終了後に発動。閉じたら同一セッション中は
   同じフェーズを再表示しない（フェーズが切り替わった場合や、
   次回サイトを開いたとき＝新しいセッションでは再度表示する）。
   ───────────────────────────────────────────────────────────── */
(function () {
  var SESSION_KEY = "asobuScreenJack_phase";

  var PHASE = asobuCurrentPhase();
  if (!PHASE) return;
  // 同一セッションで同じフェーズを表示済みなら何もしない
  if (sessionStorage.getItem(SESSION_KEY) === PHASE.id) return;

  var overlayEl = null;

  function closeOverlay() {
    if (!overlayEl) return;
    var el = overlayEl;
    overlayEl = null;
    el.classList.remove("screen-jack--open");
    setTimeout(function () { el.remove(); }, 350);
  }

  function showOverlay() {
    // 表示した時点でフラグを立てる（遷移しても再表示させないため）
    sessionStorage.setItem(SESSION_KEY, PHASE.id);

    overlayEl = document.createElement("div");
    overlayEl.className = "screen-jack";
    overlayEl.innerHTML =
      '<div class="screen-jack__backdrop"></div>' +
      '<button class="screen-jack__close" aria-label="Close">×</button>' +
      '<div class="screen-jack__inner">' +
        '<div class="screen-jack__message">' + asobuLocalize(PHASE.message).replace(/\n/g, "<br>") + "</div>" +
        asobuBuildMediaHtml(PHASE) +
        asobuBuildButtonHtml(PHASE) +
      "</div>";

    document.body.appendChild(overlayEl);
    overlayEl.querySelector(".screen-jack__close").addEventListener("click", closeOverlay);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (overlayEl) overlayEl.classList.add("screen-jack--open");
      });
    });
  }

  function boot() {
    var p = window.__introFinishPromise || Promise.resolve();
    p.then(showOverlay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

/* ─────────────────────────────────────────────────────────────
   ホーム「お知らせ」コーナー
   ・上段: 画面ジャック(ASOBU_PHASES)と同じ内容を埋め込み表示
     （データは共通、二重管理なし）
   ・下段: グッズタブの最新グッズ（新グッズ公開予定=999は除外）上位2件
   renderStaticTexts() から、goods-containerが存在した後に呼ばれる。
   ───────────────────────────────────────────────────────────── */
function renderHomeNotice() {
  var titleEl = document.getElementById("homeNoticeTitle");
  if (titleEl) titleEl.textContent = t("home.noticeTitle") || "📢 お知らせ";

  // お知らせカード（画面ジャックと同じデータを使い回す）
  var cardEl = document.getElementById("homeNoticeCard");
  if (cardEl) {
    var phase = asobuCurrentPhase();
    if (phase) {
      cardEl.innerHTML =
        '<div class="notice-card__message">' + asobuLocalize(phase.message).replace(/\n/g, "<br>") + "</div>" +
        asobuBuildMediaHtml(phase, {
          frameClass: "notice-card__frame-wrap",
          imgClass: "notice-card__image",
          iframeClass: "notice-card__iframe",
          linkClass: "notice-card__link-overlay",
          autoplay: false
        }) +
        asobuBuildButtonHtml(phase, "notice-card__cta-btn");
      cardEl.style.display = "";
    } else {
      cardEl.innerHTML = "";
      cardEl.style.display = "none";
    }
  }

  // 最新グッズ2件（新グッズ公開予定＝order 999 は除外）
  var goodsSection = document.getElementById("homeNoticeGoods");
  var goodsListEl = document.getElementById("homeNoticeGoodsList");
  var goodsTitleEl = document.getElementById("homeNoticeGoodsTitle");
  if (goodsTitleEl) goodsTitleEl.textContent = t("home.noticeGoodsTitle") || "🛍️ 最新グッズ";

  if (goodsSection && goodsListEl) {
    var container = document.getElementById("goods-container");
    var boxes = container
      ? Array.from(container.querySelectorAll(".goods-box[data-goods-order]")).filter(function (b) {
          return b.dataset.goodsOrder !== "999";
        })
      : [];

    boxes.sort(function (a, b) {
      return parseInt(b.dataset.goodsOrder, 10) - parseInt(a.dataset.goodsOrder, 10);
    });
    boxes = boxes.slice(0, 2);

    goodsListEl.innerHTML = "";
    boxes.forEach(function (box) {
      var imgEl = box.querySelector(".goods-summary .goods-thumb");
      var titleNode = box.querySelector(".goods-summary .title");
      var linkEl = box.querySelector(".goods-summary a.buy-now");

      var item = document.createElement(linkEl ? "a" : "div");
      item.className = "notice-goods-item";
      if (linkEl) {
        item.href = linkEl.getAttribute("href");
        item.target = "_blank";
        item.rel = "noopener";
      } else {
        // リンクが無いグッズはグッズタブへ遷移させる
        item.addEventListener("click", function () {
          var goodsTab = document.querySelector('[data-tab="goods"]');
          if (goodsTab) goodsTab.click();
        });
        item.style.cursor = "pointer";
      }
      item.innerHTML =
        (imgEl ? '<img class="notice-goods-thumb" src="' + imgEl.getAttribute("src") + '" alt="">' : "") +
        '<div class="notice-goods-title">' + (titleNode ? titleNode.textContent : "") + "</div>";
      goodsListEl.appendChild(item);
    });

    goodsSection.style.display = boxes.length ? "" : "none";
  }
}

/* ─────────────────────────────────────────────────────────────
   BGM（背景音楽・プレイリスト対応）※YouTube再生方式
   ・music/music.json から曲リスト（曲名・MVのYouTube URL）を読み込み、
     各曲のYouTube動画を非表示プレイヤーで音声のみ再生する
     （ローカル音源ファイルは使用しない。GitHubのファイルサイズ制限対策）
   ・起動するたびにランダムな曲から再生を開始し、以降はリストの並び順で
     ループ再生する（最後まで行ったら先頭へ戻る）
   ・music/music.json が読み込めない、または曲にurl（YouTubeリンク）が
     無い場合はその曲をスキップする
   ・三本線ボタン（🔈の左）を押すとプルダウンで曲リストが開き、曲を選んで
     直接再生できる
   ・音量バーの横の「この曲のMVを見る」リンクから、再生中の曲のMVを
     YouTubeで開ける（曲にurlが無い場合はリンク自体を非表示にする）
   ・音量はlocalStorageに保存し、次回訪問時も復元
   ・タブ（ページ内セクション）を切り替えても再生を継続
   ・他の動画/音声（ミュートされていないもの）が再生中は自動でダッキング（無音化）
   ・スライダーを一番左にすると無音
   ・ブラウザの自動再生ポリシー対策：最初は「ミュートで自動再生」を保証し、
     　最初のユーザー操作（クリック等）で実際の音量に切り替える
   ───────────────────────────────────────────────────────────── */
(function initBgm() {
  var VOLUME_KEY = "bgmVolume"; // 0-100 で保存
  var DEFAULT_VOLUME = 12;

  var slider = document.getElementById("bgmVolumeSlider");
  var muteBtn = document.getElementById("bgmMuteBtn");
  var playlistToggle = document.getElementById("bgmPlaylistToggle");
  var playlistMenu = document.getElementById("bgmPlaylistMenu");
  var mvLink = document.getElementById("bgmMvLink");
  var mvLinkText = document.getElementById("bgmMvLinkText");
  if (!slider) return;

  var playlist = [];
  var currentIndex = 0;
  var unlocked = false; // 実際の音量での再生が解禁されたか
  var errorSkipCount = 0;

  // 保存済み音量の読み込み（無ければデフォルト）
  var savedVolume = parseInt(localStorage.getItem(VOLUME_KEY), 10);
  if (isNaN(savedVolume) || savedVolume < 0 || savedVolume > 100) {
    savedVolume = DEFAULT_VOLUME;
  }
  slider.value = String(savedVolume);

  function updateIcon() {
    if (!muteBtn) return;
    muteBtn.textContent = Number(slider.value) <= 0 ? "🔇" : "🔈";
  }
  updateIcon();

  // ダッキング用
  var duckActive = false;
  var duckCount = 0;

  function targetVolume() {
    return Number(slider.value);
  }

  // 実際の音量を反映（ダッキング中・未解禁中は反映しない）
  function applyVolume() {
    if (!ytPlayer || !playerReady) return;
    if (duckActive || !unlocked) return;
    var v = targetVolume();
    if (v <= 0) {
      ytPlayer.mute();
    } else {
      ytPlayer.unMute();
      ytPlayer.setVolume(v);
    }
  }

  slider.addEventListener("input", function () {
    localStorage.setItem(VOLUME_KEY, slider.value);
    updateIcon();
    applyVolume();
  });

  var lastVolumeBeforeMute = DEFAULT_VOLUME;
  if (muteBtn) {
    muteBtn.addEventListener("click", function () {
      if (Number(slider.value) > 0) {
        lastVolumeBeforeMute = Number(slider.value);
        slider.value = "0";
      } else {
        slider.value = String(lastVolumeBeforeMute || DEFAULT_VOLUME);
      }
      localStorage.setItem(VOLUME_KEY, slider.value);
      updateIcon();
      applyVolume();
    });
  }

  // 他の動画/音声（ミュートされていないもの）が再生されたら一時的に無音化
  document.addEventListener("play", function (e) {
    var el = e.target;
    if (!el || typeof el.muted === "undefined") return; // audio/video要素以外は無視
    if (el.muted) return; // 常時ミュートの背景動画などは無視

    duckCount++;
    if (!duckActive) {
      duckActive = true;
      if (ytPlayer && playerReady) ytPlayer.setVolume(0);
    }
  }, true);

  function maybeRestore(e) {
    var el = e.target;
    if (!el || typeof el.muted === "undefined") return;
    if (el.muted) return;

    if (duckCount > 0) duckCount--;
    if (duckCount <= 0) {
      duckCount = 0;
      duckActive = false;
      applyVolume();
    }
  }
  document.addEventListener("pause", maybeRestore, true);
  document.addEventListener("ended", maybeRestore, true);

  // ── 多言語テキスト（i18n本体の読み込みタイミングに関わらず安全に取得） ──
  function musicText(key, fallback) {
    if (typeof t === "function") {
      var v = t("music." + key);
      if (v && v !== "music." + key) return v;
    }
    return fallback;
  }

  // 言語切り替え時に renderStaticTexts() から呼んでもらうためのフック
  window.__refreshBgmI18n = function () {
    if (playlistToggle) {
      var label = musicText("playlist", "曲リスト");
      playlistToggle.setAttribute("aria-label", label);
      playlistToggle.title = label;
    }
    updateMvLink();
  };

  // ── 「この曲のMVを見る」リンクの更新 ──
  function updateMvLink() {
    if (!mvLink) return;
    var track = playlist[currentIndex];
    var label = musicText("watchMv", "この曲のMVを見る");
    if (mvLinkText) { mvLinkText.textContent = label; } else { mvLink.textContent = label; }
    mvLink.title = label;
    mvLink.setAttribute("aria-label", label);
    if (track && track.url) {
      mvLink.href = track.url;
      mvLink.style.display = "";
    } else {
      mvLink.removeAttribute("href");
      mvLink.style.display = "none";
    }
  }

  // ── 曲リスト（プルダウンメニュー）の描画 ──
  function renderPlaylistMenu() {
    if (!playlistMenu) return;
    playlistMenu.innerHTML = "";
    playlist.forEach(function (track, i) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "bgm-playlist__item" + (i === currentIndex ? " active" : "");
      item.setAttribute("role", "menuitem");
      item.textContent = track.title || ("music" + (i + 1));
      item.addEventListener("click", function () {
        closePlaylistMenu();
        if (i === currentIndex) return;
        currentIndex = i;
        loadTrack(currentIndex);
      });
      playlistMenu.appendChild(item);
    });
  }

  function markActiveInMenu() {
    if (!playlistMenu) return;
    var items = playlistMenu.querySelectorAll(".bgm-playlist__item");
    items.forEach(function (el, i) {
      el.classList.toggle("active", i === currentIndex);
    });
  }

  function openPlaylistMenu() {
    if (!playlistMenu || !playlistToggle) return;
    playlistMenu.classList.add("open");
    playlistMenu.setAttribute("aria-hidden", "false");
    playlistToggle.setAttribute("aria-expanded", "true");
  }
  function closePlaylistMenu() {
    if (!playlistMenu || !playlistToggle) return;
    playlistMenu.classList.remove("open");
    playlistMenu.setAttribute("aria-hidden", "true");
    playlistToggle.setAttribute("aria-expanded", "false");
  }
  if (playlistToggle) {
    playlistToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (playlistMenu && playlistMenu.classList.contains("open")) {
        closePlaylistMenu();
      } else {
        openPlaylistMenu();
      }
    });
    document.addEventListener("click", function (e) {
      if (!playlistMenu || !playlistMenu.classList.contains("open")) return;
      if (playlistMenu.contains(e.target) || playlistToggle.contains(e.target)) return;
      closePlaylistMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePlaylistMenu();
    });
  }

  // ── YouTube動画IDの抽出 ──
  function extractYouTubeId(url) {
    if (!url) return null;
    var m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // ── YouTube IFrame Player（非表示・音声のみ再生用） ──
  var ytPlayer = null;
  var playerReady = false;
  var pendingVideoId = null;

  function loadYouTubeAPI() {
    return new Promise(function (resolve) {
      if (window.YT && window.YT.Player) { resolve(window.YT); return; }
      var prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prevReady === "function") prevReady();
        resolve(window.YT);
      };
      if (!document.getElementById("bgmYtApiScript")) {
        var tag = document.createElement("script");
        tag.id = "bgmYtApiScript";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    });
  }

  function ensurePlayerHost() {
    var host = document.getElementById("bgmYtPlayerHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "bgmYtPlayerHost";
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
      var inner = document.createElement("div");
      inner.id = "bgmYtPlayerInner";
      host.appendChild(inner);
      document.body.appendChild(host);
    }
  }

  function createPlayer(videoId) {
    ensurePlayerHost();
    ytPlayer = new YT.Player("bgmYtPlayerInner", {
      height: "1",
      width: "1",
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0
      },
      events: {
        onReady: function () {
          playerReady = true;
          ytPlayer.mute();
          ytPlayer.playVideo();
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) {
            errorSkipCount = 0;
            playNext();
          }
        },
        onError: function () {
          if (errorSkipCount < playlist.length) playNext();
        }
      }
    });
  }

  // ── 再生まわり ──
  function loadTrack(i) {
    var track = playlist[i];
    if (!track) return;
    var videoId = track.videoId;
    if (!videoId) {
      // urlが無い/YouTube動画IDが取れない曲はスキップ
      errorSkipCount++;
      playNext();
      return;
    }
    updateMvLink();
    markActiveInMenu();

    if (!playerReady) {
      pendingVideoId = videoId;
      return;
    }
    ytPlayer.loadVideoById(videoId);
    if (unlocked) {
      applyVolume();
    } else {
      ytPlayer.mute();
    }
  }

  // 次の曲へ（リストの最後まで行ったら先頭に戻ってループ）
  function playNext() {
    if (!playlist.length) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    loadTrack(currentIndex);
  }

  // ステップ2：最初のユーザー操作でミュート解除→保存済み音量を適用
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    applyVolume();
    if (ytPlayer && playerReady) ytPlayer.playVideo();
    ["click", "touchstart", "keydown"].forEach(function (ev) {
      document.removeEventListener(ev, unlockAudio, true);
    });
  }
  ["click", "touchstart", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
  });

  // ── music/music.json を読み込んでプレイリストを組み立てる ──
  fetch("./music/music.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("music.json not found");
      return res.json();
    })
    .then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error("music.json empty");
      var list = data
        .filter(function (item) { return item && item.url; })
        .map(function (item) {
          return { title: item.title || "", url: item.url, videoId: extractYouTubeId(item.url) };
        })
        .filter(function (item) { return !!item.videoId; });
      if (!list.length) throw new Error("music.json: no valid YouTube url found");
      playlist = list;
    })
    .catch(function (err) {
      console.warn("[BGM] playlist load failed:", err);
      playlist = [];
    })
    .then(function () {
      if (!playlist.length) return;
      // 起動のたびにランダムな曲から再生開始 → 以降はリスト順にループ
      currentIndex = Math.floor(Math.random() * playlist.length);
      renderPlaylistMenu();
      window.__refreshBgmI18n();
      updateMvLink();
      markActiveInMenu();

      loadYouTubeAPI().then(function () {
        createPlayer(playlist[currentIndex].videoId);
      });
    });
})();