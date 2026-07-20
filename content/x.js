(() => {
  "use strict";

  const DEFAULT_SETTINGS = {
    enabled: true,
    targetLanguage: "en",
    provider: "auto",
    showOriginal: true
  };
  const TWEET_SELECTOR = '[data-testid="tweetText"]';
  const queue = [];
  const localTranslators = new Map();
  let activeJobs = 0;
  let settings = { ...DEFAULT_SETTINGS };
  let scanTimer;
  let settingsVersion = 0;

  initialize();

  async function initialize() {
    settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    observeTimeline();
    scan();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;

      let shouldRefresh = false;
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (changes[key]) {
          settings[key] = changes[key].newValue;
          shouldRefresh = true;
        }
      }

      if (shouldRefresh) resetAndScan();
    });
  }

  function observeTimeline() {
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 120);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scan() {
    if (!settings.enabled) return;

    document.querySelectorAll(TWEET_SELECTOR).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.dataset.alsState) return;

      const text = extractText(element);
      const sourceLanguage = getSourceLanguage(element);
      if (!text) return;
      if (sameLanguage(sourceLanguage, settings.targetLanguage)) {
        element.dataset.alsState = "same-language";
        return;
      }

      element.dataset.alsState = "queued";
      queue.push({
        element,
        text,
        sourceLanguage,
        targetLanguage: settings.targetLanguage,
        provider: settings.provider,
        showOriginal: settings.showOriginal,
        settingsVersion
      });
    });

    processQueue();
  }

  async function processQueue() {
    while (activeJobs < 2 && queue.length) {
      const job = queue.shift();
      if (!job?.element.isConnected || job.element.dataset.alsState !== "queued") continue;

      activeJobs += 1;
      translateTweet(job).finally(() => {
        activeJobs -= 1;
        processQueue();
      });
    }
  }

  async function translateTweet(job) {
    const { element, text, sourceLanguage, targetLanguage, provider, showOriginal } = job;
    element.dataset.alsState = "translating";
    const translation = createTranslationElement(targetLanguage);
    element.insertAdjacentElement("afterend", translation);

    try {
      const result = await translate(text, sourceLanguage, targetLanguage, provider);
      if (!element.isConnected || job.settingsVersion !== settingsVersion) {
        translation.remove();
        return;
      }

      translation.classList.remove("als-translation--loading");
      translation.querySelector(".als-translation__text").textContent = result.translatedText;
      translation.dataset.provider = result.provider;
      element.dataset.alsState = "translated";
      element.classList.toggle("als-original-hidden", !showOriginal);
    } catch (error) {
      translation.remove();
      if (job.settingsVersion !== settingsVersion) return;
      element.dataset.alsState = "error";
      element.title = error instanceof Error ? error.message : "Translation failed";
    }
  }

  async function translate(text, sourceLanguage, targetLanguage, provider) {
    if (provider !== "remote") {
      try {
        return await translateLocally(text, sourceLanguage, targetLanguage);
      } catch (error) {
        if (provider === "local") throw error;
      }
    }

    return translateRemotely(text, sourceLanguage, targetLanguage);
  }

  async function translateLocally(text, sourceLanguage, targetLanguage) {
    if (!("Translator" in globalThis)) {
      throw new Error("On-device translation is not available in this Chrome version.");
    }

    let source = normalizeLanguage(sourceLanguage);
    const target = normalizeLanguage(targetLanguage);
    if (!source) source = await detectLanguage(text);
    if (!source) throw new Error("The post language could not be detected on-device.");

    const key = `${source}|${target}`;
    let translator = localTranslators.get(key);

    if (!translator) {
      translator = await globalThis.Translator.create({
        sourceLanguage: source,
        targetLanguage: target
      });
      localTranslators.set(key, translator);
    }

    return { translatedText: await translator.translate(text), provider: "local" };
  }

  async function detectLanguage(text) {
    if (!("LanguageDetector" in globalThis)) return null;
    const detector = await globalThis.LanguageDetector.create();
    const results = await detector.detect(text);
    detector.destroy?.();
    return results?.[0]?.detectedLanguage || null;
  }

  async function translateRemotely(text, sourceLanguage, targetLanguage) {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_REMOTE",
      payload: { text, sourceLanguage, targetLanguage }
    });

    if (!response?.ok) throw new Error(response?.error || "Translation failed.");
    return response;
  }

  function createTranslationElement(targetLanguage) {
    const wrapper = document.createElement("div");
    wrapper.className = "als-translation als-translation--loading";
    wrapper.dataset.alsTranslation = "true";

    const header = document.createElement("div");
    header.className = "als-translation__header";

    const mark = document.createElement("span");
    mark.className = "als-translation__mark";
    mark.textContent = "A文";

    const label = document.createElement("span");
    label.textContent = `Translated to ${languageName(targetLanguage)}`;

    const translatedText = document.createElement("div");
    translatedText.className = "als-translation__text";
    translatedText.setAttribute("lang", targetLanguage);
    translatedText.setAttribute("dir", "auto");

    header.append(mark, label);
    wrapper.append(header, translatedText);
    return wrapper;
  }

  function extractText(element) {
    return element.innerText.replace(/\s+$/g, "").trim();
  }

  function getSourceLanguage(element) {
    return element.getAttribute("lang") || element.closest("[lang]")?.getAttribute("lang") || "auto";
  }

  function normalizeLanguage(language) {
    if (!language || language === "auto") return null;
    return language.toLowerCase().split("-")[0];
  }

  function sameLanguage(source, target) {
    const normalizedSource = normalizeLanguage(source);
    return normalizedSource && normalizedSource === normalizeLanguage(target);
  }

  function languageName(code) {
    try {
      return new Intl.DisplayNames([navigator.language], { type: "language" }).of(code) || code;
    } catch {
      return code;
    }
  }

  function resetAndScan() {
    settingsVersion += 1;
    queue.length = 0;
    document.querySelectorAll('[data-als-translation="true"]').forEach((element) => element.remove());
    document.querySelectorAll(`${TWEET_SELECTOR}[data-als-state]`).forEach((element) => {
      delete element.dataset.alsState;
      element.classList.remove("als-original-hidden");
      element.removeAttribute("title");
    });
    scan();
  }
})();
