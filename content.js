const micButton = document.createElement('button');
micButton.innerHTML = '🎤';
micButton.style.position = 'absolute';
micButton.style.right = '10px';
micButton.style.bottom = '10px';
micButton.style.zIndex = '1000';
micButton.style.backgroundColor = '#fff';
micButton.style.border = '1px solid #ccc';
micButton.style.borderRadius = '50%';
micButton.style.width = '40px';
micButton.style.height = '40px';
micButton.style.cursor = 'pointer';

const languageSelector = document.createElement('select');
languageSelector.style.position = 'absolute';
languageSelector.style.right = '60px';
languageSelector.style.bottom = '10px';
languageSelector.style.zIndex = '1000';

const languages = [
  { code: 'ru-RU', name: 'Русский' },
  { code: 'en-US', name: 'English' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'es-ES', name: 'Español' },
  { code: 'pt-PT', name: 'Português' },
  { code: 'uk-UA', name: 'Українська' },
];

languages.forEach(lang => {
  const option = document.createElement('option');
  option.value = lang.code;
  option.textContent = lang.name;
  languageSelector.appendChild(option);
});

document.body.appendChild(micButton);
document.body.appendChild(languageSelector);

let isListening = false;
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
  console.error('Recognition error', event);
  isListening = false;
  micButton.style.backgroundColor = '#fff';
};

recognition.onend = () => {
  if (isListening) {
    recognition.start();
  } else {
    micButton.style.backgroundColor = '#fff';
    const inputField = document.querySelector('#prompt-textarea');
    if (inputField) {
      inputField.value += ' ';
      resizeTextarea(inputField);
      triggerInputEvent(inputField);
    }
  }
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
  micButton.style.backgroundColor = isListening ? 'red' : '#fff';
});

// Add event listener for the send button
const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
if (sendButton) {
  sendButton.addEventListener('click', () => {
    finalTranscript = '';
    interimTranscript = '';
  });
}
