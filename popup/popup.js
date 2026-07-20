const LANGUAGES = [
  ["ar", "Arabic"], ["bn", "Bengali"], ["bg", "Bulgarian"], ["ca", "Catalan"],
  ["zh", "Chinese"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"],
  ["nl", "Dutch"], ["en", "English"], ["et", "Estonian"], ["fi", "Finnish"],
  ["fr", "French"], ["de", "German"], ["el", "Greek"], ["gu", "Gujarati"],
  ["he", "Hebrew"], ["hi", "Hindi"], ["hu", "Hungarian"], ["id", "Indonesian"],
  ["it", "Italian"], ["ja", "Japanese"], ["kn", "Kannada"], ["ko", "Korean"],
  ["lv", "Latvian"], ["lt", "Lithuanian"], ["ms", "Malay"], ["ml", "Malayalam"],
  ["mr", "Marathi"], ["no", "Norwegian"], ["fa", "Persian"], ["pl", "Polish"],
  ["pt", "Portuguese"], ["pa", "Punjabi"], ["ro", "Romanian"], ["ru", "Russian"],
  ["sr", "Serbian"], ["sk", "Slovak"], ["sl", "Slovenian"], ["es", "Spanish"],
  ["sw", "Swahili"], ["sv", "Swedish"], ["ta", "Tamil"], ["te", "Telugu"],
  ["th", "Thai"], ["tr", "Turkish"], ["uk", "Ukrainian"], ["ur", "Urdu"],
  ["vi", "Vietnamese"]
];

const DEFAULT_SETTINGS = {
  enabled: true,
  targetLanguage: "en",
  provider: "auto",
  showOriginal: true
};

const enabled = document.querySelector("#enabled");
const targetLanguage = document.querySelector("#target-language");
const provider = document.querySelector("#provider");
const showOriginal = document.querySelector("#show-original");
const status = document.querySelector(".status");
const statusText = document.querySelector("#status-text");

for (const [code, name] of LANGUAGES) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = name;
  targetLanguage.append(option);
}

initialize();

async function initialize() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  enabled.checked = settings.enabled;
  targetLanguage.value = settings.targetLanguage;
  provider.value = settings.provider;
  showOriginal.checked = settings.showOriginal;
  updateStatus();

  enabled.addEventListener("change", save);
  targetLanguage.addEventListener("change", save);
  provider.addEventListener("change", save);
  showOriginal.addEventListener("change", save);
}

async function save() {
  await chrome.storage.sync.set({
    enabled: enabled.checked,
    targetLanguage: targetLanguage.value,
    provider: provider.value,
    showOriginal: showOriginal.checked
  });
  updateStatus();
}

function updateStatus() {
  status.classList.toggle("off", !enabled.checked);
  statusText.textContent = enabled.checked ? "Translating on X" : "Translation paused";
}
