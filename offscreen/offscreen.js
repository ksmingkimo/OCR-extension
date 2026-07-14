// offscreen/offscreen.js
// 在 offscreen document 中執行：裁切影像 + Tesseract.js OCR。
// 透過 chrome.runtime 訊息接收 background 的 OCR_REQUEST。

let workerPromise = null;

/** 建立（並重用）Tesseract worker。資產全部從本機 lib/tesseract 載入。 */
function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("lib/tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("lib/tesseract/"),
      langPath: chrome.runtime.getURL("lib/tesseract/"),
      // 擴充頁面 CSP 不允許 blob: worker，改用擴充 URL 直接載入
      workerBlobURL: false,
      // langPath 下放的是 eng.traineddata.gz（gzip 預設 true）
    });
  }
  return workerPromise;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== "offscreen" || msg?.type !== "OCR_REQUEST") return;

  doOcr(msg.dataUrl, msg.rect, msg.dpr)
    .then((text) => sendResponse({ ok: true, text }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // async
});

/** 依 rect × dpr 裁切影像後跑 OCR。 */
async function doOcr(dataUrl, rect, dpr) {
  const bitmap = await loadBitmap(dataUrl);

  const sx = Math.round(rect.x * dpr);
  const sy = Math.round(rect.y * dpr);
  const sw = Math.max(1, Math.round(rect.width * dpr));
  const sh = Math.max(1, Math.round(rect.height * dpr));

  // 放大裁切區可提升小字辨識率
  const scale = 2;
  const canvas = new OffscreenCanvas(sw * scale, sh * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);

  const blob = await canvas.convertToBlob({ type: "image/png" });

  const worker = await getWorker();
  const { data } = await worker.recognize(blob);
  return (data?.text || "").trim();
}

async function loadBitmap(dataUrl) {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  return createImageBitmap(blob);
}
