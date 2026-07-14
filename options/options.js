// options/options.js
import { getSettings, setSettings } from "../lib/storage.js";
import { generateWordInfo } from "../lib/gemini.js";

const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const msgEl = document.getElementById("msg");

function showMsg(text, kind = "info") {
  msgEl.textContent = text;
  msgEl.className = `msg ${kind}`;
}

(async function init() {
  const s = await getSettings();
  apiKeyEl.value = s.apiKey || "";
  modelEl.value = s.model || "gemini-2.0-flash";
})();

document.getElementById("save").addEventListener("click", async () => {
  await setSettings({
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value,
  });
  showMsg("✅ 已儲存設定。", "ok");
});

document.getElementById("test").addEventListener("click", async () => {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) {
    showMsg("請先輸入 API Key。", "error");
    return;
  }
  showMsg("測試中…", "info");
  try {
    const info = await generateWordInfo("test", { apiKey, model: modelEl.value });
    showMsg(`✅ 連線成功！範例：test → ${info.translation}`, "ok");
  } catch (e) {
    showMsg(`❌ ${e.message}`, "error");
  }
});
