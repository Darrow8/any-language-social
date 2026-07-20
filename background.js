const DEFAULT_SETTINGS = {
  enabled: true,
  targetLanguage: "en",
  provider: "auto",
  showOriginal: true
};

const cache = new Map();
const MAX_CACHE_ENTRIES = 500;

chrome.runtime.onInstalled.addListener(async () => {
  const saved = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set(saved);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TRANSLATE_REMOTE") return false;

  translateRemote(message.payload)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Translation failed"
    }));

  return true;
});

async function translateRemote(payload = {}) {
  const text = String(payload.text || "").trim();
  const sourceLanguage = normalizeLanguage(payload.sourceLanguage, "Autodetect");
  const targetLanguage = normalizeLanguage(payload.targetLanguage, "en");

  if (!text) throw new Error("There is no text to translate.");
  if (text.length > 1200) throw new Error("This post is too long to translate.");

  const key = `${sourceLanguage}|${targetLanguage}|${text}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const query = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage}|${targetLanguage}`,
    mt: "1"
  });
  const response = await fetch(`https://api.mymemory.translated.net/get?${query}`, {
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Translation service returned ${response.status}.`);
  }

  const data = await response.json();
  const translatedText = decodeEntities(data?.responseData?.translatedText || "").trim();
  const status = Number(data?.responseStatus || response.status);

  if (!translatedText || status >= 400) {
    throw new Error(data?.responseDetails || "No translation was returned.");
  }

  const result = {
    translatedText,
    detectedLanguage: data?.responseData?.detectedLanguage || null,
    provider: "remote"
  };

  cache.set(key, result);
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  return result;
}

function normalizeLanguage(value, fallback) {
  const language = String(value || "").trim();
  if (!language || language.toLowerCase() === "auto") return fallback;
  return language.split("-")[0].toLowerCase();
}

function decodeEntities(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}
