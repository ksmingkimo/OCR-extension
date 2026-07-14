// wordlist/wordlist.js
import { getWords, deleteWord, togglePin } from "../lib/storage.js";

const gridEl = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");

let allWords = [];

function sortWords(words) {
  return [...words].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const filtered = allWords.filter(
    (w) =>
      !q ||
      (w.word || "").toLowerCase().includes(q) ||
      (w.translation || "").toLowerCase().includes(q)
  );
  const sorted = sortWords(filtered);

  countEl.textContent = `共 ${allWords.length} 個`;
  gridEl.innerHTML = "";

  if (sorted.length === 0) {
    emptyEl.hidden = allWords.length !== 0; // 有資料但搜尋無結果時不顯示空狀態
    if (allWords.length !== 0) {
      gridEl.innerHTML = `<p class="noresult">找不到符合的單字。</p>`;
    }
    return;
  }
  emptyEl.hidden = true;

  for (const w of sorted) {
    gridEl.appendChild(buildCard(w));
  }
}

function buildCard(w) {
  const card = document.createElement("article");
  card.className = "card" + (w.pinned ? " pinned" : "");

  const head = document.createElement("div");
  head.className = "card-head";
  const word = document.createElement("h2");
  word.className = "word";
  word.textContent = w.word;
  const pos = document.createElement("span");
  pos.className = "pos";
  pos.textContent = w.pos || "";
  head.append(word, pos);

  const tr = document.createElement("p");
  tr.className = "translation";
  tr.textContent = w.translation || "";

  const ex = document.createElement("p");
  ex.className = "example";
  ex.textContent = w.example || "";

  const exTr = document.createElement("p");
  exTr.className = "example-tr";
  exTr.textContent = w.exampleTranslation || "";

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const pinBtn = document.createElement("button");
  pinBtn.className = "chip";
  pinBtn.textContent = w.pinned ? "取消置頂" : "置頂";
  pinBtn.addEventListener("click", async () => {
    await togglePin(w.id);
    await reload();
  });

  const delBtn = document.createElement("button");
  delBtn.className = "chip danger";
  delBtn.textContent = "刪除";
  delBtn.addEventListener("click", async () => {
    await deleteWord(w.id);
    await reload();
  });

  footer.append(pinBtn, delBtn);
  card.append(head, tr, ex, exTr, footer);
  return card;
}

async function reload() {
  allWords = await getWords();
  render();
}

searchEl.addEventListener("input", render);

reload();
