// lib/storage.js
// 統一封裝 chrome.storage.local 的讀寫：單字清單 CRUD 與設定讀寫。
// 以 ES module 匯出，供 service-worker、options、wordlist 頁面 import 使用。

const WORDS_KEY = "words";
const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "gemini-flash-latest",
};

/** 產生單字唯一 id（不使用 Date.now 以外的隨機來源，這裡以時間戳 + 亂數字串足夠）。 */
function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 讀取所有單字（陣列）。 */
export async function getWords() {
  const data = await chrome.storage.local.get(WORDS_KEY);
  return Array.isArray(data[WORDS_KEY]) ? data[WORDS_KEY] : [];
}

/** 覆寫整個單字陣列。 */
async function setWords(words) {
  await chrome.storage.local.set({ [WORDS_KEY]: words });
}

/**
 * 新增一個單字。若 word 已存在（不分大小寫）則更新其內容並回傳既有 id。
 * entry: { word, translation, pos, example, exampleTranslation }
 * 回傳完整的單字物件。
 */
export async function addWord(entry) {
  const words = await getWords();
  const key = (entry.word || "").trim().toLowerCase();
  const idx = words.findIndex((w) => (w.word || "").trim().toLowerCase() === key);

  if (idx >= 0) {
    const existing = words[idx];
    const updated = {
      ...existing,
      translation: entry.translation ?? existing.translation,
      pos: entry.pos ?? existing.pos,
      example: entry.example ?? existing.example,
      exampleTranslation: entry.exampleTranslation ?? existing.exampleTranslation,
    };
    words[idx] = updated;
    await setWords(words);
    return updated;
  }

  const created = {
    id: makeId(),
    word: entry.word,
    translation: entry.translation || "",
    pos: entry.pos || "",
    example: entry.example || "",
    exampleTranslation: entry.exampleTranslation || "",
    pinned: false,
    createdAt: Date.now(),
  };
  words.push(created);
  await setWords(words);
  return created;
}

/** 依 id 刪除單字。 */
export async function deleteWord(id) {
  const words = await getWords();
  await setWords(words.filter((w) => w.id !== id));
}

/** 切換置頂狀態。 */
export async function togglePin(id) {
  const words = await getWords();
  const idx = words.findIndex((w) => w.id === id);
  if (idx >= 0) {
    words[idx] = { ...words[idx], pinned: !words[idx].pinned };
    await setWords(words);
  }
  return words[idx];
}

/** 讀取設定（含預設值）。 */
export async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

/** 儲存設定（合併既有值）。 */
export async function setSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

export { DEFAULT_SETTINGS };
