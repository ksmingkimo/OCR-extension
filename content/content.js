// content/content.js
// 選取 overlay：進入選取模式、拖曳畫矩形、回傳座標給 background，並顯示結果 tooltip。
// 以經典 content script 執行（非 module），只透過 chrome.runtime 訊息與 background 溝通。

(() => {
  const PREFIX = "ocrwl";
  let overlay = null;
  let selBox = null;
  let startX = 0;
  let startY = 0;
  let selecting = false;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ENTER_SELECTION") {
      enterSelectionMode();
    }
  });

  function enterSelectionMode() {
    if (overlay) return; // 已在選取中
    overlay = document.createElement("div");
    overlay.className = `${PREFIX}-overlay`;

    const hint = document.createElement("div");
    hint.className = `${PREFIX}-hint`;
    hint.textContent = "拖曳框選英文單字，Esc 取消";
    overlay.appendChild(hint);

    selBox = document.createElement("div");
    selBox.className = `${PREFIX}-selbox`;
    selBox.style.display = "none";
    overlay.appendChild(selBox);

    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function exitSelectionMode() {
    if (!overlay) return;
    overlay.removeEventListener("mousedown", onMouseDown);
    overlay.removeEventListener("mousemove", onMouseMove);
    overlay.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    overlay = null;
    selBox = null;
    selecting = false;
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      exitSelectionMode();
    }
  }

  function onMouseDown(e) {
    selecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selBox.style.display = "block";
    updateBox(startX, startY, 0, 0);
  }

  function onMouseMove(e) {
    if (!selecting) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    updateBox(x, y, w, h);
  }

  function onMouseUp(e) {
    if (!selecting) return;
    selecting = false;
    const rect = {
      x: Math.min(startX, e.clientX),
      y: Math.min(startY, e.clientY),
      width: Math.abs(e.clientX - startX),
      height: Math.abs(e.clientY - startY),
    };
    const dpr = window.devicePixelRatio || 1;
    exitSelectionMode();

    if (rect.width < 3 || rect.height < 3) return;

    const loading = showTooltip(rect, { loading: true });
    chrome.runtime.sendMessage(
      { type: "SELECTION_DONE", rect, dpr },
      (resp) => {
        loading.remove();
        if (chrome.runtime.lastError) {
          showTooltip(rect, { error: chrome.runtime.lastError.message });
          return;
        }
        if (!resp?.ok) {
          showTooltip(rect, { error: resp?.error || "處理失敗。" });
          return;
        }
        showTooltip(rect, { data: resp.result });
      }
    );
  }

  function updateBox(x, y, w, h) {
    selBox.style.left = `${x}px`;
    selBox.style.top = `${y}px`;
    selBox.style.width = `${w}px`;
    selBox.style.height = `${h}px`;
  }

  // ---- 結果 tooltip ----
  function showTooltip(rect, { loading, error, data } = {}) {
    const tip = document.createElement("div");
    tip.className = `${PREFIX}-tooltip`;

    if (loading) {
      tip.innerHTML = `<div class="${PREFIX}-tip-loading">辨識與翻譯中…</div>`;
    } else if (error) {
      tip.innerHTML = `<div class="${PREFIX}-tip-error"></div>`;
      tip.querySelector(`.${PREFIX}-tip-error`).textContent = error;
    } else if (data) {
      tip.appendChild(buildCard(data));
    }

    positionTooltip(tip, rect);
    document.body.appendChild(tip);

    if (!loading) {
      // 點擊他處或數秒後自動關閉
      const close = (ev) => {
        if (!tip.contains(ev.target)) {
          tip.remove();
          document.removeEventListener("mousedown", close, true);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", close, true), 0);
      setTimeout(() => tip.remove(), 12000);
    }
    return tip;
  }

  function buildCard(d) {
    const wrap = document.createElement("div");
    wrap.className = `${PREFIX}-card`;

    const head = document.createElement("div");
    head.className = `${PREFIX}-card-head`;
    const word = document.createElement("span");
    word.className = `${PREFIX}-word`;
    word.textContent = d.word || "";
    const pos = document.createElement("span");
    pos.className = `${PREFIX}-pos`;
    pos.textContent = d.pos || "";
    head.append(word, pos);

    const tr = document.createElement("div");
    tr.className = `${PREFIX}-translation`;
    tr.textContent = d.translation || "";

    const ex = document.createElement("div");
    ex.className = `${PREFIX}-example`;
    ex.textContent = d.example || "";

    const exTr = document.createElement("div");
    exTr.className = `${PREFIX}-example-tr`;
    exTr.textContent = d.exampleTranslation || "";

    wrap.append(head, tr, ex, exTr);
    return wrap;
  }

  function positionTooltip(tip, rect) {
    // rect 為視窗座標；tooltip 用 fixed 定位。
    tip.style.position = "fixed";
    const top = rect.y + rect.height + 8;
    tip.style.left = `${Math.max(8, Math.min(rect.x, window.innerWidth - 340))}px`;
    // 若下方空間不足則往上顯示
    if (top + 160 > window.innerHeight) {
      tip.style.top = `${Math.max(8, rect.y - 168)}px`;
    } else {
      tip.style.top = `${top}px`;
    }
  }
})();
