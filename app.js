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

  // 過去に訪問済みの場合はイントロをスキップ
  if (localStorage.getItem("introPlayed") === "1") {
    window.__introFinishPromise = Promise.resolve();
    window.__introFinishResolve = () => {};
    return;
  }
  // 初回訪問フラグ（MISSIONアニメ判定に使用）
  window.__freshVisit = true;
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
        if (localStorage.getItem("introPlayed") === "1" && !window.__freshVisit) {
          initCfPhysicsTank();
        } else {
          // まず即座にコンテンツを隠す
          cfBody.querySelectorAll(".cf-split > div, .support-header").forEach(el => {
            el.style.opacity = "0"; el.style.transition = "none"; el.style.transform = "translateY(16px)";
          });
          const doMission = () => {
            triggerMissionAnim(cfBody, missionTitle, ".cf-split > div, .support-header");
            // ミッション演出終了後にタンク初期化
            setTimeout(initCfPhysicsTank, 3400);
          };
          if (window.__introFinishPromise) {
            window.__introFinishPromise.then(doMission);
          } else {
            doMission();
          }
        }
      }
    } else if (tabKey === "contest") {
      const contestBody = document.getElementById("contestBody");
      if (contestBody && !contestBody.dataset.missionDone) {
        contestBody.dataset.missionDone = "1";
        const missionTitle = t("contest.missionTitle") || "学園衣装をコーディネートしよう！";
        // キャッシュ済み（再訪問）ならMISSIONアニメをスキップ
        if (localStorage.getItem("introPlayed") === "1" && !window.__freshVisit) {
          // スキップ（コンテンツをそのまま表示）
        } else {
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
    _rainClear();
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
  if (goodsBody) { goodsBody.innerHTML = t("goods.bodyHtml"); animateSupportHeader(goodsBody); animateTimeline(goodsBody); }

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

  const footerNote = $("#footerNote");
  if (footerNote) footerNote.textContent = t("footer.note");

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
  const isFirstLoad = !state.lang;
  state.lang = lang;
  localStorage.setItem("lang", lang);

  document.querySelectorAll(".chip[data-lang]").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  // スマホ用プルダウンも同期
  const mobileDropdown = document.getElementById("mobileLangDropdown");
  if (mobileDropdown) mobileDropdown.value = lang;

  state.i18n = await loadJSON(`./i18n/${lang}.json`);
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
  const known = ["home", "about", "support", "goods", "log", "membership", "notice", "contact", "crowdfunding", "contest"];

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
  /* 現在の言語を取得 */
  var lang = (state && state.lang) ? state.lang : (localStorage.getItem("lang") || "ja");
  var sfx = lang === "ja" ? "" : ("_" + lang);

  function gl(g, key) {
    return g[key + sfx] || g[key] || "";
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
      var monthsHtml = (g.months || []).map(function(m) {
        var cls = "dg-month";
        if      (m.status === "none")    cls += " dg-month--none";
        else if (m.status === "done")    cls += " dg-month--done";
        else if (m.status === "current") cls += " dg-month--current";
        else                             cls += " dg-month--empty";
        var label = m["label" + sfx] || m.label;
        var value = (m.status !== "none" && m["value" + sfx] !== undefined)
          ? m["value" + sfx]
          : (m.value || "");
        var inner = m.status === "none"
          ? '<span class="dg-month-x">✕</span>'
          : '<span class="dg-month-val">' + value + '</span>';
        return '<div class="' + cls + '"><div class="dg-month-label">' + label + '</div>' + inner + '</div>';
      }).join('');

      card.innerHTML =
        '<div class="dg-head">' +
          '<span class="dg-icon">' + g.icon + '</span>' +
          '<div class="dg-titles">' +
            '<div class="dg-title">' + gl(g, "title") + '</div>' +
            '<div class="dg-sub">' + gl(g, "subtitle") + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dg-months">' + monthsHtml + '</div>';
    }

    wrap.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────────────
   サムネイルギャラリー
   ───────────────────────────────────────────────────────────── */
(function () {

  let _thumbs   = null; // null=未ロード / [] 以上=ロード済み
  let _current  = 0;
  let _timer    = null;
  let _paused   = false;
  const INTERVAL = 3200;

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
  }

  function startSlider() {
    clearInterval(_timer);
    _timer = setInterval(function() {
      if (!_paused) goTo(_current + 1);
    }, INTERVAL);
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
      const item = document.createElement("div");
      item.className = "tg-item";

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
    startSlider();
  }

  window.initThumbGallery = async function() {
    clearInterval(_timer);
    _paused  = false;
    _current = 0;
    _thumbs  = null; /* 毎回フレッシュにフェッチ */

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
