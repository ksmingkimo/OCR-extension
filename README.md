# OCR 單字學習 · Chrome Extension

在網頁上**拖曳框選英文單字**,即時取得中文翻譯,並由 AI 自動生成詞性與例句,收藏成卡片式單字本。適合閱讀英文網頁、看圖片內文字時快速累積單字。

> Manifest V3 · 純原生 JS · 本機 OCR(離線可用) · Google Gemini 生成

---

## ✨ 功能特色

- 🖱️ **快捷鍵 / 右鍵選單**啟用,拖曳矩形選取畫面上的英文單字(連圖片裡的文字也能辨識)
- 🔤 **本機 OCR**:使用 [Tesseract.js](https://tesseract.projectnaptha.com/),不需上傳圖片、離線可用
- 🤖 **AI 生成單字卡**:透過 Google Gemini 產生「中文翻譯、詞性、英文例句、例句翻譯」
- 💬 選取後就地顯示翻譯浮動卡片
- 📚 **卡片式單字本**:支援搜尋、**置頂**、**刪除**,資料存於瀏覽器本機
- 🔒 API Key 僅儲存在本機 `chrome.storage.local`,不寫入任何程式檔

---

## 🧩 安裝方式(載入未封裝擴充)

1. 下載或 `git clone` 本專案到本機
   ```bash
   git clone https://github.com/ksmingkimo/OCR-extension.git
   ```
2. 開啟 Chrome,前往 `chrome://extensions`
3. 開啟右上角的 **開發人員模式**
4. 點 **載入未封裝項目**,選擇本專案資料夾
5. 安裝完成,工具列會出現擴充圖示 🅾️

> 本專案已把 Tesseract 的 OCR 資產一併納入版控,clone 後**無需額外下載**即可直接使用。

---

## 🔑 設定 Gemini API Key(首次使用必做)

1. 到 [Google AI Studio](https://aistudio.google.com/app/apikey) 免費取得 API Key
2. 點擊擴充圖示 → **開啟設定**
3. 貼上 API Key,選擇模型(預設 `gemini-flash-latest`,會自動指向最新 Flash 模型)
4. 按 **儲存**,再按 **測試連線** 確認可用

---

## 🚀 使用方式

1. 在任一英文網頁,按快捷鍵 **`Ctrl+Shift+O`**(Mac:`Command+Shift+O`),或按滑鼠右鍵選 **「OCR 選取英文單字」**
2. 拖曳一個矩形框住想查的英文單字後放開
3. 稍候片刻(首次辨識需初始化 Tesseract,會略慢),就地浮現翻譯卡片,單字同時存入單字本
4. 點擊圖示 → **開啟單字列表** 檢視、搜尋、置頂或刪除單字

> 快捷鍵可於 `chrome://extensions/shortcuts` 自訂。

---

## 🏗️ 技術架構

一次選取的資料流橫跨四個執行環境,以 `chrome.runtime` / `chrome.tabs` 訊息串接:

```
快捷鍵/右鍵 ──▶ service-worker ──▶ content(拖曳選取)
                    │                    │ 回傳 rect + dpr
                    ▼                    ▼
            captureVisibleTab ──▶ offscreen(裁切 + Tesseract OCR)
                    │
                    ▼
              lib/gemini(Gemini 生成)──▶ lib/storage(存檔)──▶ content(顯示卡片)
```

| 路徑 | 職責 |
|------|------|
| `service-worker.js` | 協調者:觸發、擷圖、offscreen 生命週期、Gemini 呼叫、存檔、訊息路由 |
| `content/` | 選取 overlay 與結果 tooltip(樣式加 `ocrwl-` 前綴避免污染頁面) |
| `offscreen/` | 在 Offscreen Document 中裁切影像並執行 Tesseract(MV3 中 service worker 無法跑 OCR) |
| `lib/gemini.js` | Gemini API 封裝,以 `responseSchema` 取得穩定 JSON |
| `lib/storage.js` | 單字 CRUD 與設定讀寫(`chrome.storage.local`) |
| `lib/tesseract/` | 本機打包的 Tesseract.js v5 與英文語言檔 |
| `popup/` `options/` `wordlist/` | 彈出面板、設定頁、單字本頁 |

更多開發細節見 [CLAUDE.md](CLAUDE.md) 與 [設計方案](OCR單字學習設計方案v1.md)。

---

## 📝 備註

- 目前僅辨識**英文**(`eng` 語言檔);翻譯與例句輸出為**繁體中文**。
- Gemini 模型名稱可能隨時間調整,預設使用 `gemini-flash-latest` 別名以避免模型下架造成的錯誤。
- 本專案無建置流程,修改原始碼後於 `chrome://extensions` 對擴充按「🔄 重新載入」即可生效。
