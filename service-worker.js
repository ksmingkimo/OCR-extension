// service-worker.js（Manifest V3 background，type: module）
// 職責：建立右鍵選單與快捷鍵、擷取畫面、管理 offscreen document 做 OCR、
// 呼叫 Gemini、存單字，並把結果回傳給 content script 顯示。

import { generateWordInfo } from "./lib/gemini.js";
import { addWord, getSettings } from "./lib/storage.js";

const MENU_ID = "ocr-start";
const OFFSCREEN_PATH = "offscreen/offscreen.html";

// ---- 安裝時建立右鍵選單 ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "OCR 選取英文單字",
    contexts: ["all"],
  });
});

// ---- 觸發：快捷鍵 ----
chrome.commands.onCommand.addListener((command) => {
  if (command === "start-ocr") {
    triggerSelectionOnActiveTab();
  }
});

// ---- 觸發：右鍵選單 ----
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id != null) {
    enterSelection(tab.id);
  }
});

async function triggerSelectionOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) enterSelection(tab.id);
}

function enterSelection(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "ENTER_SELECTION" }).catch(() => {
    // content script 尚未注入（如 chrome:// 頁面）時忽略。
  });
}

// ---- 訊息路由 ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SELECTION_DONE") {
    handleSelection(msg.rect, msg.dpr, sender.tab)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true; // async
  }
});

/**
 * 完整處理一次選取：擷圖 → OCR → Gemini → 存檔。
 * @param {{x,y,width,height}} rect 視窗座標（CSS px）
 * @param {number} dpr devicePixelRatio
 * @param {chrome.tabs.Tab} tab
 */
async function handleSelection(rect, dpr, tab) {
  if (!rect || rect.width < 3 || rect.height < 3) {
    throw new Error("選取範圍太小，請重新框選。");
  }

  // 1) 擷取可見畫面
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  // 2) OCR（透過 offscreen document）
  const rawText = await runOcr(dataUrl, rect, dpr);
  const word = cleanWord(rawText);
  if (!word) {
    throw new Error("未能辨識出英文單字，請框選更清楚的單字。");
  }

  // 3) Gemini 產生單字資料
  const settings = await getSettings();
  const info = await generateWordInfo(word, settings);

  // 4) 存檔
  const saved = await addWord(info);
  return saved;
}

/** 從 OCR 原始文字取出第一個英文單字，去標點、轉小寫。 */
function cleanWord(text) {
  if (!text) return "";
  const match = text.match(/[A-Za-z][A-Za-z'-]*/);
  return match ? match[0].toLowerCase().replace(/^['-]+|['-]+$/g, "") : "";
}

// ---- Offscreen document 管理與 OCR 呼叫 ----
let creatingOffscreen = null;

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["WORKERS"],
    justification: "在背景執行 Tesseract.js 進行 OCR 影像文字辨識。",
  });
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function runOcr(dataUrl, rect, dpr) {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "OCR_REQUEST",
    dataUrl,
    rect,
    dpr,
  });
  if (!res?.ok) {
    throw new Error(res?.error || "OCR 失敗。");
  }
  return res.text;
}
