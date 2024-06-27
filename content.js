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
settingsButton.innerHTML = '⚙️';
settingsButton.style.backgroundColor = 'transparent';
settingsButton.style.border = 'none';
settingsButton.style.width = '40px';
settingsButton.style.height = '40px';
settingsButton.style.cursor = 'pointer';

const languageSelector = document.createElement('select');
const languages = [
  { code: 'ru-RU', name: 'Русский' },
  { code: 'en-US', name: 'English' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'es-ES', name: 'Español' },
  { code: 'pt-PT', name: 'Português' },
  { code: 'uk-UA', name: 'Українська' },
];
languageSelector.style.color = '#000';
languageSelector.style.backgroundColor = '#f6f6f6';
languages.forEach(lang => {
  const option = document.createElement('option');
  option.value = lang.code;
  option.textContent = lang.name;
  languageSelector.appendChild(option);
});

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

const donationLink = document.createElement('a');
donationLink.href = 'https://buymeacoffee.com/bogutskii';
donationLink.textContent = 'Donate';
donationLink.style.display = 'block';
donationLink.style.marginTop = '10px';
donationLink.style.textDecoration = 'underline';
donationLink.style.color = 'blue';

const feedbackLink = document.createElement('a');
feedbackLink.href = '#';
feedbackLink.textContent = 'EmailMe';
feedbackLink.style.display = 'block';
feedbackLink.style.marginTop = '10px';
feedbackLink.style.textDecoration = 'underline';
feedbackLink.style.color = 'blue';

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

const saveButton = document.createElement('button');
saveButton.textContent = 'Save';
saveButton.style.marginTop = '10px';
saveButton.style.backgroundColor = '#4CAF50';
saveButton.style.color = '#fff';
saveButton.style.border = 'none';
saveButton.style.padding = '10px 20px';
saveButton.style.borderRadius = '5px';
saveButton.style.cursor = 'pointer';

const cancelButton = document.createElement('button');
cancelButton.textContent = 'Cancel';
cancelButton.style.marginTop = '10px';
cancelButton.style.marginLeft = '10px';
cancelButton.style.backgroundColor = '#f44336';
cancelButton.style.color = '#fff';
cancelButton.style.border = 'none';
cancelButton.style.padding = '10px 20px';
cancelButton.style.borderRadius = '5px';
cancelButton.style.cursor = 'pointer';

modal.appendChild(modalTitle);
modal.appendChild(donationLink);
modal.appendChild(feedbackLink);
modal.appendChild(githubLink);
modal.appendChild(author);
modal.appendChild(saveButton);
modal.appendChild(cancelButton);
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

cancelButton.addEventListener('click', () => {
  modal.style.display = 'none';
  modalOverlay.style.display = 'none';
});

saveButton.addEventListener('click', () => {
  modal.style.display = 'none';
  modalOverlay.style.display = 'none';
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

chrome.storage.local.get(['recognitionLanguage'], (result) => {
  if (result.recognitionLanguage) {
    recognition.lang = result.recognitionLanguage;
    languageSelector.value = result.recognitionLanguage;
  } else {
    recognition.lang = 'ru-RU';
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

recognition.onerror = (event) => {
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

const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
if (sendButton) {
  const clearButton = document.createElement('button');
  clearButton.innerHTML = '🗑️';
  clearButton.style.marginRight = '10px';
  clearButton.style.backgroundColor = 'transparent';
  clearButton.style.border = 'none';
  clearButton.style.width = '40px';
  clearButton.style.height = '40px';
  clearButton.style.cursor = 'pointer';
  clearButton.style.transition = 'background-color 0.5s ease';

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

micButton.style.backgroundImage = isListening ? "url(chrome-extension://" + chrome.runtime.id + "/img/mic_ON.png)" : "url(chrome-extension://" + chrome.runtime.id + "/img/mic_OFF.png)";
