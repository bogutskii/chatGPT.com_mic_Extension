const container = document.createElement('div');
container.style.position = 'absolute';
container.style.right = '10px';
container.style.bottom = '10px';
container.style.zIndex = '1000';
container.style.display = 'flex';
container.style.alignItems = 'center';
container.style.gap = '10px';

const micButton = document.createElement('button');
micButton.style.backgroundColor = 'transparent';
micButton.style.border = 'none';
micButton.style.width = '40px';
micButton.style.height = '40px';
micButton.style.cursor = 'pointer';
micButton.style.transition = 'background-color 0.5s ease';
micButton.style.position = 'relative';
micButton.style.backgroundImage = "url(chrome-extension://" + chrome.runtime.id + "/img/mic_OFF.png)";
micButton.style.backgroundSize = 'cover';
micButton.style.backgroundRepeat = 'no-repeat';

const settingsButton = document.createElement('button');
settingsButton.style.backgroundColor = 'transparent';
settingsButton.style.border = 'none';
settingsButton.style.width = '40px';
settingsButton.style.height = '40px';
settingsButton.style.cursor = 'pointer';
settingsButton.style.backgroundImage = "url(chrome-extension://" + chrome.runtime.id + "/img/options.png)";
settingsButton.style.backgroundSize = 'cover';
settingsButton.style.backgroundRepeat = 'no-repeat';

const languageSelector = document.createElement('select');
const languages = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'af-ZA', name: 'Afrikaans' },
  { code: 'sq-AL', name: 'Shqip (Albanian)' },
  { code: 'am-ET', name: 'አማርኛ (Amharic)' },
  { code: 'ar-SA', name: 'العربية (Arabic)' },
  { code: 'hy-AM', name: 'Հայերեն (Armenian)' },
  { code: 'az-AZ', name: 'Azərbaycan dili' },
  { code: 'eu-ES', name: 'Euskara (Basque)' },
  { code: 'bn-BD', name: 'বাংলা (Bengali)' },
  { code: 'bg-BG', name: 'Български' },
  { code: 'ca-ES', name: 'Català (Catalan)' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'hr-HR', name: 'Hrvatski' },
  { code: 'cs-CZ', name: 'Čeština' },
  { code: 'da-DK', name: 'Dansk' },
  { code: 'uk-UA', name: 'Українська' },
  { code: 'nl-NL', name: 'Nederlands' },
  { code: 'et-EE', name: 'Estonian' },
  { code: 'fil-PH', name: 'Filipino' },
  { code: 'fi-FI', name: 'Suomi (Finnish)' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'gl-ES', name: 'Galego' },
  { code: 'ka-GE', name: 'ქართული (Georgian)' },
  { code: 'de-DE', name: 'Deutsch (German)' },
  { code: 'el-GR', name: 'Ελληνικά' },
  { code: 'gu-IN', name: 'ગુજરાતી (Gujarati)' },
  { code: 'he-IL', name: 'עברית (Hebrew)' },
  { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
  { code: 'hu-HU', name: 'Magyar (Hungarian)' },
  { code: 'is-IS', name: 'Íslenska (Icelandic)' },
  { code: 'id-ID', name: 'Bahasa Indonesia' },
  { code: 'it-IT', name: 'Italiano' },
  { code: 'ja-JP', name: '日本語 (Japanese)' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'kk-KZ', name: 'Қазақ тілі' },
  { code: 'km-KH', name: 'ខ្មែរ (Khmer)' },
  { code: 'ko-KR', name: '한국어 (Korean)' },
  { code: 'lo-LA', name: 'ລາວ (Lao)' },
  { code: 'lv-LV', name: 'Latviešu' },
  { code: 'lt-LT', name: 'Lietuvių' },
  { code: 'mk-MK', name: 'Македонски' },
  { code: 'ms-MY', name: 'Bahasa Melayu' },
  { code: 'ml-IN', name: 'മലയാളം (Malayalam)' },
  { code: 'mr-IN', name: 'मराठी (Marathi)' },
  { code: 'mn-MN', name: 'Монгол (Mongolian)' },
  { code: 'ne-NP', name: 'नेपाली (Nepali)' },
  { code: 'no-NO', name: 'Norsk (Norwegian)' },
  { code: 'fa-IR', name: 'فارسی (Persian)' },
  { code: 'pl-PL', name: 'Polski (Polish)' },
  { code: 'pt-BR', name: 'Português (Brazilian)' },
  { code: 'pt-PT', name: 'Português (European)' },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'ro-RO', name: 'Română (Romanian)' },
  { code: 'ru-RU', name: 'Русский' },
  { code: 'sr-RS', name: 'Српски (Serbian)' },
  { code: 'si-LK', name: 'සිංහල (Sinhala)' },
  { code: 'sk-SK', name: 'Slovenčina' },
  { code: 'sl-SI', name: 'Slovenščina' },
  { code: 'es-ES', name: 'Español (Spanish)' },
  { code: 'sw-KE', name: 'Kiswahili (Swahili)' },
  { code: 'sv-SE', name: 'Svenska (Swedish)' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)' },
  { code: 'te-IN', name: 'తెలుగు (Telugu)' },
  { code: 'th-TH', name: 'ไทย (Thai)' },
  { code: 'tr-TR', name: 'Türkçe (Turkish)' },
  { code: 'ur-PK', name: 'اردو (Urdu)' },
  { code: 'uz-UZ', name: 'Oʻzbekcha (Uzbek)' },
  { code: 'vi-VN', name: 'Tiếng Việt (Vietnamese)' },
  { code: 'cy-GB', name: 'Cymraeg (Welsh)' },
  { code: 'xh-ZA', name: 'isiXhosa (Xhosa)' },
  { code: 'zu-ZA', name: 'isiZulu (Zulu)' },
];

languageSelector.style.color = '#000';
languageSelector.style.backgroundColor = '#f6f6f6';

// Load favorite languages from local storage
let favoriteLanguages = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'uk-UA', name: 'Українська' },
  { code: 'ru-RU', name: 'Русский' }];

const loadFavoriteLanguages = () => {
  chrome.storage.local.get(['favoriteLanguages'], (result) => {
    if (result.favoriteLanguages) {
      favoriteLanguages = result.favoriteLanguages;
      updateLanguageSelector();
    }
  });
};

const updateLanguageSelector = () => {
  languageSelector.innerHTML = '';
  favoriteLanguages.forEach(langCode => {
    const lang = languages.find(l => l.code === langCode);
    if (lang) {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      languageSelector.appendChild(option);
    }
  });
};

loadFavoriteLanguages();

container.appendChild(micButton);
container.appendChild(languageSelector);
container.appendChild(settingsButton);
document.body.appendChild(container);

const modal = document.createElement('div');
modal.style.color = '#000';
modal.style.display = 'none';
modal.style.position = 'fixed';
modal.style.top = '50%';
modal.style.left = '50%';
modal.style.transform = 'translate(-50%, -50%)';
modal.style.zIndex = '1001';
modal.style.backgroundColor = '#fff';
modal.style.padding = '20px';
modal.style.border = '1px solid #ccc';
modal.style.borderRadius = '10px';
modal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';

const modalOverlay = document.createElement('div');
modalOverlay.style.display = 'none';
modalOverlay.style.position = 'fixed';
modalOverlay.style.top = '0';
modalOverlay.style.left = '0';
modalOverlay.style.width = '100%';
modalOverlay.style.height = '100%';
modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
modalOverlay.style.zIndex = '1000';

const modalTitle = document.createElement('h2');
modalTitle.textContent = 'Settings';
modalTitle.style.textAlign = 'center';

const donationLink = document.createElement('a');
donationLink.href = 'https://buymeacoffee.com/bogutskii';
donationLink.textContent = 'Donate';
donationLink.style.display = 'block';
donationLink.style.marginTop = '10px';
donationLink.style.textDecoration = 'underline';
donationLink.style.color = 'blue';

const LinkedInLink = document.createElement('a');
LinkedInLink.href = 'https://www.linkedin.com/in/petr-bogutskii/';
LinkedInLink.textContent = 'LinkedIn';
LinkedInLink.style.display = 'block';
LinkedInLink.style.marginTop = '10px';
LinkedInLink.style.textDecoration = 'underline';
LinkedInLink.style.color = 'blue';

const githubLink = document.createElement('a');
githubLink.href = 'https://github.com/bogutskii';
githubLink.textContent = 'GitHub';
githubLink.style.display = 'block';
githubLink.style.marginTop = '10px';
githubLink.style.textDecoration = 'underline';
githubLink.style.color = 'blue';

const author = document.createElement('div');
author.textContent = 'Author: Petr Bogutskii';
author.style.marginTop = '10px';

const okButton = document.createElement('button');
okButton.textContent = 'Ok';
okButton.style.marginTop = '10px';
okButton.style.backgroundColor = '#4CAF50';
okButton.style.color = '#fff';
okButton.style.border = 'none';
okButton.style.padding = '10px 20px';
okButton.style.borderRadius = '5px';
okButton.style.cursor = 'pointer';
okButton.style.display = 'block';
okButton.style.margin = '20px auto';

const hotkeysInfo = document.createElement('div');
hotkeysInfo.innerHTML = 'Hotkeys: <b>Control + M</b>';
hotkeysInfo.style.marginTop = '10px';

// Option to choose microphone position
const micPositionInfo = document.createElement('div');
micPositionInfo.textContent = 'Microphone Position:';

const micPositionSelector = document.createElement('select');
const positions = [
  { value: 'default', name: 'Default' },
  { value: 'input', name: 'In Input' }
];
positions.forEach(pos => {
  const option = document.createElement('option');
  option.value = pos.value;
  option.textContent = pos.name;
  micPositionSelector.appendChild(option);
});

micPositionInfo.appendChild(micPositionSelector);
modal.appendChild(micPositionInfo);

const languageListInfo = document.createElement('div');
languageListInfo.textContent = 'Select Favorite Languages:';

const languageList = document.createElement('div');
languageList.style.width = '100%';
languageList.style.height = '200px';
languageList.style.overflowY = 'scroll';

languages.forEach(lang => {
  const label = document.createElement('label');
  label.style.display = 'block';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = lang.code;
  checkbox.checked = favoriteLanguages.includes(lang.code);
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(lang.name));
  languageList.appendChild(label);
});

languageListInfo.appendChild(languageList);
modal.appendChild(languageListInfo);

modal.appendChild(modalTitle);
modal.appendChild(donationLink);
modal.appendChild(LinkedInLink);
modal.appendChild(githubLink);
modal.appendChild(author);
modal.appendChild(hotkeysInfo);
modal.appendChild(okButton);

document.body.appendChild(modal);
document.body.appendChild(modalOverlay);

settingsButton.addEventListener('click', () => {
  modal.style.display = 'block';
  modalOverlay.style.display = 'block';
});

modalOverlay.addEventListener('click', () => {
  modal.style.display = 'none';
  modalOverlay.style.display = 'none';
});

okButton.addEventListener('click', () => {
  modal.style.display = 'none';
  modalOverlay.style.display = 'none';
  // Save microphone position
  const micPosition = micPositionSelector.value;
  chrome.storage.local.set({ micPosition });
  positionMicButton(micPosition);
  // Save favorite languages
  favoriteLanguages = Array.from(languageList.querySelectorAll('input:checked')).map(input => input.value);
  chrome.storage.local.set({ favoriteLanguages });
  updateLanguageSelector();
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = true;
recognition.interimResults = true;

const changeLanguage = (language) => {
  recognition.stop();
  recognition.lang = language;
  if (isListening) {
    recognition.start();
  }
};

chrome.storage.local.get(['recognitionLanguage', 'micPosition'], (result) => {
  if (result.recognitionLanguage) {
    recognition.lang = result.recognitionLanguage;
    languageSelector.value = result.recognitionLanguage;
  } else {
    recognition.lang = 'ru-RU';
  }
  if (result.micPosition) {
    micPositionSelector.value = result.micPosition;
    positionMicButton(result.micPosition);
  }
});

languageSelector.addEventListener('change', (event) => {
  const selectedLanguage = event.target.value;
  chrome.storage.local.set({ recognitionLanguage: selectedLanguage });
  changeLanguage(selectedLanguage);
});

let isListening = false;
let finalTranscript = '';
let interimTranscript = '';

const resizeTextarea = (textarea) => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
};

const triggerInputEvent = (inputField) => {
  const event = new Event('input', { bubbles: true });
  inputField.dispatchEvent(event);
};

recognition.onresult = (event) => {
  interimTranscript = '';
  let finalTranscriptFragment = '';

  for (let i = event.resultIndex; i < event.results.length; ++i) {
    const transcript = event.results[i][0].transcript;

    if (event.results[i].isFinal) {
      finalTranscriptFragment += transcript + ' ';
    } else {
      interimTranscript += transcript;
    }
  }

  finalTranscript += finalTranscriptFragment;

  const inputField = document.querySelector('#prompt-textarea');
  if (inputField) {
    inputField.value = finalTranscript + interimTranscript;
    resizeTextarea(inputField);
    triggerInputEvent(inputField);
  }
};

recognition.onerror = () => {
  isListening = false;
  micButton.style.backgroundImage = "url(chrome-extension://" + chrome.runtime.id + "/img/mic_ERR.png)";
};

recognition.onend = () => {
  if (isListening) {
    recognition.start();
  } else {
    const inputField = document.querySelector('#prompt-textarea');
    if (inputField) {
      inputField.value += ' ';
      resizeTextarea(inputField);
      triggerInputEvent(inputField);
    }
  }
  micButton.style.backgroundImage = isListening ? "url(chrome-extension://" + chrome.runtime.id + "/img/mic_ON.png)" : "url(chrome-extension://" + chrome.runtime.id + "/img/mic_OFF.png)";
};

micButton.addEventListener('click', () => {
  const inputField = document.querySelector('#prompt-textarea');
  if (isListening) {
    recognition.stop();
    isListening = false;
  } else {
    finalTranscript = inputField.value;
    interimTranscript = '';
    recognition.start();
    isListening = true;
  }
  micButton.style.backgroundImage = isListening ? "url(chrome-extension://" + chrome.runtime.id + "/img/mic_ON.png)" : "url(chrome-extension://" + chrome.runtime.id + "/img/mic_OFF.png)";
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'm') {
    micButton.click();
  }
});

const ensureClearButton = () => {
  const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
  if (sendButton && !document.querySelector('#clearButton')) {
    const clearButton = document.createElement('button');
    clearButton.id = 'clearButton';
    clearButton.style.backgroundColor = 'transparent';
    clearButton.style.border = 'none';
    clearButton.style.width = '40px';
    clearButton.style.height = '41px';
    clearButton.style.cursor = 'pointer';
    clearButton.style.backgroundImage = "url(chrome-extension://" + chrome.runtime.id + "/img/clear.png)";
    clearButton.style.backgroundSize = 'cover';
    clearButton.style.backgroundRepeat = 'no-repeat';

    sendButton.parentNode.insertBefore(clearButton, sendButton);

    clearButton.addEventListener('click', (e) => {
      e.preventDefault();
      finalTranscript = '';
      interimTranscript = '';
      const inputField = document.querySelector('#prompt-textarea');
      if (inputField) {
        inputField.value = '';
      }
    });

    sendButton.addEventListener('click', () => {
      const inputField = document.querySelector('#prompt-textarea');
      if (inputField) {
        setTimeout(() => {
          finalTranscript = '';
          interimTranscript = '';
          inputField.value = '';
        }, 10);
      }
    });
  }
};

ensureClearButton();
new MutationObserver(ensureClearButton).observe(document.body, { childList: true, subtree: true });

const positionMicButton = (position) => {
  const inputField = document.querySelector('#prompt-textarea');
  const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
  const clearButton = document.querySelector('#clearButton');
  if (position === 'input') {
    if (inputField && sendButton && clearButton) {
      sendButton.parentNode.insertBefore(micButton, clearButton);
    }
  } else {
    container.insertBefore(micButton, languageSelector);
  }
};

chrome.storage.local.get(['micPosition'], (result) => {
  if (result.micPosition) {
    positionMicButton(result.micPosition);
  } else {
    container.insertBefore(micButton, languageSelector);
  }
});

micButton.style.backgroundImage = isListening ? "url(chrome-extension://" + chrome.runtime.id + "/img/mic_ON.png)" : "url(chrome-extension://" + chrome.runtime.id + "/img/mic_OFF.png)";
