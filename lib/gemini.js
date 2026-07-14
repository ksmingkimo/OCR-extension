// lib/gemini.js
// Google Gemini API 封裝：給定英文單字，回傳結構化的單字資料。
// 使用 responseMimeType: application/json + responseSchema 取得穩定 JSON。

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    word: { type: "STRING", description: "單字原型（lemma），小寫" },
    translation: { type: "STRING", description: "最常見的繁體中文翻譯" },
    pos: { type: "STRING", description: "詞性，如 n. / v. / adj. / adv." },
    example: { type: "STRING", description: "一句自然的英文例句" },
    exampleTranslation: { type: "STRING", description: "例句的繁體中文翻譯" },
  },
  required: ["word", "translation", "pos", "example", "exampleTranslation"],
};

function buildPrompt(word) {
  return (
    `你是一位英文教學助理。請針對英文單字 "${word}" 產生學習卡片資料。\n` +
    `要求：\n` +
    `1. word：該單字的原型（lemma），全小寫。\n` +
    `2. translation：最常見的繁體中文翻譯（可含多個常見義項，用、分隔）。\n` +
    `3. pos：主要詞性，使用縮寫（n., v., adj., adv., prep., conj. 等）。\n` +
    `4. example：一句自然、難度適中的英文例句，需包含該單字。\n` +
    `5. exampleTranslation：上述例句的繁體中文翻譯。\n` +
    `只輸出 JSON，不要額外說明。`
  );
}

/**
 * 呼叫 Gemini 產生單字資料。
 * @param {string} word 清洗後的英文單字
 * @param {{apiKey:string, model:string}} settings
 * @returns {Promise<{word,translation,pos,example,exampleTranslation}>}
 */
export async function generateWordInfo(word, settings) {
  const apiKey = (settings?.apiKey || "").trim();
  const model = settings?.model || "gemini-flash-latest";

  if (!apiKey) {
    throw new Error("尚未設定 Gemini API Key，請先到設定頁填入。");
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: buildPrompt(word) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  };

  let resp;
  try {
    resp = await fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`網路錯誤，無法連線 Gemini：${e.message}`);
  }

  if (!resp.ok) {
    let detail = "";
    try {
      const err = await resp.json();
      detail = err?.error?.message || "";
    } catch {
      /* 忽略解析錯誤 */
    }
    if (resp.status === 400 && /API key/i.test(detail)) {
      throw new Error("API Key 無效，請至設定頁確認。");
    }
    if (resp.status === 429) {
      throw new Error("已達 Gemini 使用額度上限，請稍後再試。");
    }
    throw new Error(`Gemini 回應錯誤（${resp.status}）：${detail || resp.statusText}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini 未回傳內容，請稍後再試。");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini 回傳格式無法解析。");
  }

  return {
    word: parsed.word || word,
    translation: parsed.translation || "",
    pos: parsed.pos || "",
    example: parsed.example || "",
    exampleTranslation: parsed.exampleTranslation || "",
  };
}
