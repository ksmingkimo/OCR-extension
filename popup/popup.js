// popup/popup.js
import { getWords, getSettings } from "../lib/storage.js";

const statusEl = document.getElementById("status");

document.getElementById("open-list").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wordlist/wordlist.html") });
  window.close();
});

document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

(async function init() {
  const [words, settings] = await Promise.all([getWords(), getSettings()]);
  const count = words.length;
  const hasKey = Boolean((settings.apiKey || "").trim());
  statusEl.innerHTML = `已收藏 <b>${count}</b> 個單字 · ${
    hasKey ? "API Key 已設定" : "<span class='warn'>尚未設定 API Key</span>"
  }`;
})();
