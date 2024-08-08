(async () => {
  const { languages } = await import(chrome.runtime.getURL('languages.js'));
  const { createContainer, createButton, createSelect } = await import(chrome.runtime.getURL('ui.js'));
  const { initializeState, getState, setState, subscribe } = await import(chrome.runtime.getURL('state.js'));
  const { initializeSpeechRecognition } = await import(chrome.runtime.getURL('speech.js'));
  const { createModal, createModalOverlay, setupModal } = await import(chrome.runtime.getURL('modal.js'));
  const { setupMicPosition } = await import(chrome.runtime.getURL('micPosition.js'));
  const { setupAutoGeneration } = await import(chrome.runtime.getURL('autoGeneration.js'));
  const { setupWidthAdjustment } = await import(chrome.runtime.getURL('widthAdjustment.js'));
  const { setupClearButton } = await import(chrome.runtime.getURL('clearButton.js'));

  await initializeState();
  let state = getState();
  //   console.log('Initial state:', state);
  const container = createContainer();
  const micButton = createButton(`chrome-extension://${chrome.runtime.id}/img/mic_OFF.png`);
  const settingsButton = createButton(`chrome-extension://${chrome.runtime.id}/img/options.png`);
  const languageOptions = languages.map(lang => ({ value: lang.code, text: lang.name }));
  const languageSelector = createSelect(languageOptions);

const updateLanguageSelector = (currentState) => {
  languageSelector.innerHTML = '';
  //   console.log('Updating language selector with favoriteLanguages:', currentState.favoriteLanguages);
  currentState.favoriteLanguages.forEach(langCode => {
    const lang = languages.find(l => l.code === langCode);
    if (lang) {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      languageSelector.appendChild(option);
    }
  });
  languageSelector.value = currentState.recognitionLanguage;
  //   console.log('Language selector updated to:', languageSelector.value);
};

updateLanguageSelector(state);

const ensureMicButtonVisible = () => {
  const inputField = document.querySelector('#prompt-textarea');
  const sendButton = document.querySelector('[data-testid="send-button"]');
  const clearButton = document.querySelector('#clearButton');

  if (state.micPosition === 'input') {
    if (inputField && sendButton && clearButton) {
      if (!sendButton.parentNode.contains(micButton)) {
        sendButton.parentNode.insertBefore(micButton, clearButton);
      }
    }
  } else {
    if (!container.contains(micButton)) {
      container.appendChild(micButton);
    }
  }
};

subscribe(() => {
  state = getState();
  //   console.log('State updated:', state);
  updateLanguageSelector(state);
  if (recognition && state.recognitionLanguage) {
    recognition.lang = state.recognitionLanguage;
    //   console.log('Recognition language set to:', state.recognitionLanguage);
  }
  ensureMicButtonVisible();
});

container.appendChild(micButton);
container.appendChild(languageSelector);
container.appendChild(settingsButton);
document.body.appendChild(container);

const modal = createModal();
const modalOverlay = createModalOverlay();
modalOverlay.classList.add('modal-overlay');
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

await setupModal(modal, state.favoriteLanguages, (newFavoriteLanguages) => {
  setState({ favoriteLanguages: newFavoriteLanguages });
  //   console.log('Favorite languages set to:', newFavoriteLanguages);
  updateLanguageSelector(state);
}, container, micButton);

await setupMicPosition(container, micButton, state.micPosition);

await setupAutoGeneration(modal);
await setupWidthAdjustment(modal);
await setupClearButton(modal);

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

let recognition = initializeSpeechRecognition(state.recognitionLanguage);
let isRecognitionRunning = false;

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
  state.isListening = false;
  isRecognitionRunning = false;
  setState({ isListening: false });
  micButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ERR.png)`;
};

recognition.onend = () => {
  //   console.log('Recognition ended');
  isRecognitionRunning = false;
  if (state.isListening) {
    recognition.start();
    isRecognitionRunning = true;
    micButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)`;
    //   console.log('Recognition restarted');
  } else {
    micButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
  }
};

micButton.addEventListener('click', (event) => {
  event.preventDefault();
  const inputField = document.querySelector('#prompt-textarea');
  if (isRecognitionRunning) {
    recognition.stop();
    //   console.log('Recognition stopped');
    isRecognitionRunning = false;
    setState({ isListening: false });
  } else {
    finalTranscript = inputField.value;
    interimTranscript = '';
    recognition.start();
    //   console.log('Recognition started');
    isRecognitionRunning = true;
    setState({ isListening: true });
    micButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)`;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'm') {
    event.stopPropagation();
    micButton.click();
  }
});

chrome.storage.local.get(['micPosition'], (result) => {
  if (result.micPosition) {
    state.micPosition = result.micPosition;
  } else {
    state.micPosition = 'default';
  }
  setState({ micPosition: state.micPosition });
  setupMicPosition(container, micButton, state.micPosition);
  ensureMicButtonVisible();
});

languageSelector.addEventListener('change', async (event) => {
  const selectedLanguage = event.target.value;
  //   console.log('Language selected:', selectedLanguage);
  setState({ recognitionLanguage: selectedLanguage });

  languageSelector.value = selectedLanguage;
  //   console.log('Language selector manually updated to:', languageSelector.value);

  if (recognition) {
    recognition.lang = selectedLanguage;

    if (isRecognitionRunning) {
      recognition.stop();
      recognition.onend = () => {
        recognition.lang = selectedLanguage;
        recognition.start();
        isRecognitionRunning = true;
        //   console.log('Recognition restarted with new language:', selectedLanguage);
      };
    } else {
      recognition.lang = selectedLanguage;
    }
  }
});

const clearButton = document.querySelector('#clearButton');
if (clearButton) {
  clearButton.addEventListener('click', (e) => {
    e.preventDefault();
    finalTranscript = '';
    interimTranscript = '';
    const inputField = document.querySelector('#prompt-textarea');
    if (inputField) {
      inputField.value = '';
      resizeTextarea(inputField);
      triggerInputEvent(inputField);
    }
    //   console.log('Transcript cleared');
  });
}

ensureMicButtonVisible();
})();