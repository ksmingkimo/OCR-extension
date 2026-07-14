# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言偏好

- 與使用者的所有互動文字一律使用**繁體中文**。

## 專案概述

這是一個 **Chrome Extension (Manifest V3)**「OCR 單字學習」工具:使用者在網頁上拖曳矩形框選英文單字 → 本機 Tesseract.js OCR 辨識 → Google Gemini 生成翻譯/詞性/例句 → 存成可複習的單字卡。

**沒有建置系統、無 npm、無測試框架**——全部是原生 JS/HTML/CSS,直接以「載入未封裝項目」在 Chrome 執行。

## 開發與測試流程

- **載入/重新載入**:`chrome://extensions` → 開啟開發人員模式 → 「載入未封裝項目」選本專案根目錄。改動任何檔案後,必須在該頁對擴充按 **🔄 重新載入** 才生效(改 manifest 或 service-worker 尤其必要)。
- **除錯**:
  - background(service-worker.js):擴充卡片上的「Service Worker」連結 → DevTools。
  - offscreen / OCR:在 background DevTools 或 `chrome://extensions` 檢視 offscreen 頁面。
  - content script:直接在目標網頁的 DevTools Console。
- **驗證需真實 API Key**:Gemini 呼叫需使用者於設定頁填入金鑰([Google AI Studio](https://aistudio.google.com/app/apikey))。金鑰只存在 `chrome.storage.local`。

### 重新下載 Tesseract 資產(PowerShell)

`lib/tesseract/` 內的檔案是從 CDN 下載打包的,**不要手動編輯**。若需更新版本,用 `Invoke-WebRequest` 從 `cdn.jsdelivr.net/npm/tesseract.js@5` 與 `tesseract.js-core@5` 下載。**核心檔必須包含全部 4 種變體**:`tesseract-core{,-simd}{,-lstm}.wasm.js` 及對應 `.wasm`——因為 `createWorker` 使用 `oem=1`(LSTM),v5 會依能力挑選 `-simd-lstm` 變體;缺檔會導致 `importScripts ... failed to load`。語言檔為 `eng.traineddata.gz`(gzip 版,來自 `tessdata.projectnaptha.com/4.0.0/`)。

## 架構:一次選取的完整資料流

跨越四個執行環境,靠 `chrome.runtime` / `chrome.tabs` 訊息串接。理解這條鏈是理解整個專案的關鍵:

1. **觸發** — `commands`(快捷鍵 `Ctrl+Shift+O`)或 `contextMenus` → `service-worker.js` 送 `ENTER_SELECTION` 給當前分頁的 content script。
2. **選取** — `content/content.js` 蓋 overlay,拖曳畫矩形,`mouseup` 後把 `{rect(CSS px), dpr}` 以 `SELECTION_DONE` 回傳 background,並就地顯示「辨識中」tooltip。
3. **擷圖** — background `chrome.tabs.captureVisibleTab`(裝置像素解析度)。
4. **OCR** — background 確保 **Offscreen Document** 存在(`chrome.offscreen`,reason `WORKERS`),把 `{dataUrl, rect, dpr}` 送給 `offscreen/offscreen.js`;offscreen 用 `OffscreenCanvas` 依 **`rect × dpr`** 裁切(座標務必乘 dpr,否則裁錯區),放大 2× 後跑 Tesseract。
5. **生成** — background `cleanWord()` 取第一個英文單字 → `lib/gemini.js` 呼叫 Gemini(`responseMimeType: application/json` + `responseSchema` 取穩定結構)。
6. **存檔 + 顯示** — `lib/storage.js` 寫入 → 結果經 `SELECTION_DONE` 的 `sendResponse` 回到 content script,tooltip 換成翻譯卡片。

### 關鍵設計約束(MV3 特有,改動時務必遵守)

- **Tesseract 只能在 offscreen document 跑**,不能在 service worker(無 DOM/Worker)。
- **worker 與 wasm 必須本機化**:`manifest.json` 的 `content_security_policy.extension_pages` 含 `'wasm-unsafe-eval'`;`createWorker` 設 `workerBlobURL: false`(擴充頁 CSP 禁止 blob: worker),資產路徑一律用 `chrome.runtime.getURL('lib/tesseract/...')`。
- **模型名稱會隨時間下架**:預設用別名 `gemini-flash-latest`(自動指向最新 Flash)以避免 404;固定版本(如 `gemini-2.0-flash`)可能失效。

### 模組職責

- `service-worker.js` — 唯一的協調者:觸發、擷圖、offscreen 生命週期、Gemini 呼叫、存檔、訊息路由。所有步驟包 try/catch,失敗訊息經 tooltip 呈現給使用者。
- `lib/storage.js`、`lib/gemini.js` — **ES module**,被 service-worker(`type:module`)與各頁面(`<script type=module>`)共用。單字資料模型:`{ id, word, translation, pos, example, exampleTranslation, pinned, createdAt }`;`addWord` 依 word 不分大小寫去重。
- `content/content.js` — **經典 script(非 module)**,只透過訊息與 background 溝通;所有注入樣式加 `ocrwl-` 前綴避免污染宿主頁。
- `popup/`、`options/`、`wordlist/` — 各自獨立頁面,直接 import `lib/`。wordlist 排序規則:pinned 優先,其次 `createdAt` 由新到舊。

### 訊息型別對照

- `ENTER_SELECTION`:background → content(進入選取模式)
- `SELECTION_DONE`:content → background(帶 rect/dpr,回傳最終單字卡或錯誤)
- `OCR_REQUEST`(帶 `target:"offscreen"`):background → offscreen(回傳 `{ok, text}`)
