let finalTranscript = '';
let interimTranscript = '';
let isRecognitionRunning = false;
let recognition;
let isRecognitionComplete = false;

const micButtonImgOff = `chrome-extension://${chrome.runtime.id}/img/mic_OFF.png`;
const floatingClearButtonImg = `chrome-extension://${chrome.runtime.id}/img/clear.png`;
const settingsButtonImg = `chrome-extension://${chrome.runtime.id}/img/options.png`;

const sendMessage = () => {
  const inputField = document.querySelector('.ProseMirror');
  if (inputField && inputField.textContent.trim()) {
    console.log("Message sent: ", inputField.textContent);
    setTimeout(() => {
      clearInput();
    }, 500);
  }
};

const clearInput = () => {
  if (state.isListening) {
    recognition.stop();
  }

  const inputField = document.querySelector('.ProseMirror');
  if (inputField) {
    inputField.textContent = '';
    const event = new Event('input', {bubbles: true});
    inputField.dispatchEvent(event);
  }

  finalTranscript = '';
  interimTranscript = '';
};

(async () => {
  const {languages} = await import(chrome.runtime.getURL('languages.js'));
  const {createContainer, createButton, createSelect} = await import(chrome.runtime.getURL('ui.js'));
  const {initializeState, getState, setState, subscribe} = await import(chrome.runtime.getURL('state.js'));
  const {initializeSpeechRecognition} = await import(chrome.runtime.getURL('speech.js'));
  const {createModal, createModalOverlay, setupModal} = await import(chrome.runtime.getURL('modal.js'));
  const {setupAutoGeneration} = await import(chrome.runtime.getURL('autoGeneration.js'));
  const {setupWidthAdjustment} = await import(chrome.runtime.getURL('widthAdjustment.js'));

  await initializeState();
  let state = getState();
  const container = createContainer();
  const floatingMicButton = createButton(micButtonImgOff);
  const floatingClearButton = createButton(floatingClearButtonImg);
  const settingsButton = createButton(settingsButtonImg);
  const languageOptions = languages.map(lang => ({value: lang.code, text: lang.name}));
  const languageSelector = createSelect(languageOptions);

  const floatingButtonContainer = document.createElement('div');
  floatingButtonContainer.id = 'floatingMicButtonContainer';
  floatingButtonContainer.classList.add('floating-button-container');
  floatingButtonContainer.appendChild(floatingMicButton);
  floatingButtonContainer.appendChild(floatingClearButton);
  document.body.appendChild(floatingButtonContainer);

  const updateFloatingButtonPosition = (x, y) => {
    floatingButtonContainer.style.left = `${x}px`;
    floatingButtonContainer.style.top = `${y}px`;
    setState({floatingButtonX: x, floatingButtonY: y});
  };

  const initFloatingButtonPosition = () => {
    const {floatingButtonX, floatingButtonY} = getState();
    if (floatingButtonX !== undefined && floatingButtonY !== undefined) {
      updateFloatingButtonPosition(floatingButtonX, floatingButtonY);
    } else {
      const centerX = window.innerWidth / 2 - floatingButtonContainer.offsetWidth / 2;
      const centerY = window.innerHeight / 2 - floatingButtonContainer.offsetHeight / 2;
      updateFloatingButtonPosition(centerX, centerY);
    }
  };

  initFloatingButtonPosition();

  let isDragging = false;
  let startX, startY;

  floatingButtonContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - floatingButtonContainer.offsetLeft;
    startY = e.clientY - floatingButtonContainer.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const x = e.clientX - startX;
      const y = e.clientY - startY;
      updateFloatingButtonPosition(x, y);
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  const clearInput = () => {
    if (state.isListening) {
      recognition.stop();
    }

    const inputField = document.querySelector('.ProseMirror');
    if (inputField) {
      inputField.textContent = '';
      const event = new Event('input', {bubbles: true});
      inputField.dispatchEvent(event);
    }

    finalTranscript = '';
    interimTranscript = '';

    if (inputField) {
      inputField.textContent = finalTranscript + interimTranscript;
      resizeTextarea(inputField);
      triggerInputEvent(inputField);
    }
  }
  floatingClearButton.addEventListener('click', () => {
    if (isRecognitionComplete) {
      clearInput();
    } else {
      setTimeout(() => {
        clearInput();
      }, 500);
    }
  });

  const updateLanguageSelector = (currentState) => {
    languageSelector.innerHTML = '';
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
  };

  updateLanguageSelector(state);

  const inputField = document.querySelector('.ProseMirror');
  inputField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage();
      event.preventDefault();
    }
  });

  subscribe(() => {
    state = getState();
    updateLanguageSelector(state);
    if (recognition && state.recognitionLanguage) {
      recognition.lang = state.recognitionLanguage;
    }
  });

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
    setState({favoriteLanguages: newFavoriteLanguages});
    updateLanguageSelector(state);
  }, container, updateFloatingButtonPosition, floatingButtonContainer);

  await setupAutoGeneration(modal);
  await setupWidthAdjustment(modal);

  const resizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  const triggerInputEvent = (inputField) => {
    const event = new Event('input', {bubbles: true});
    inputField.dispatchEvent(event);
  };

  recognition = initializeSpeechRecognition(state.recognitionLanguage);

  const toggleRecognition = () => {
    const inputField = document.querySelector('.ProseMirror');
    if (isRecognitionRunning) {
      recognition.stop();
      isRecognitionRunning = false;
      setState({isListening: false});
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
    } else {
      finalTranscript = inputField ? inputField.textContent : '';
      interimTranscript = '';
      recognition.start();
      isRecognitionRunning = true;
      setState({isListening: true});
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)`;
    }
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
    const inputField = document.querySelector('.ProseMirror');
    if (inputField) {
      inputField.textContent = finalTranscript + interimTranscript;
      resizeTextarea(inputField);
      triggerInputEvent(inputField);
    }
  };

  recognition.onerror = () => {
    state.isListening = false;
    isRecognitionRunning = false;
    setState({isListening: false});
    floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ERR.png)`;

    setTimeout(() => {
      if (!state.isListening) {
        floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
      }
    }, 1000);
  };

  recognition.onend = () => {
    isRecognitionRunning = false;
    if (state.isListening) {
      recognition.start();
      isRecognitionRunning = true;
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)`;
    } else {
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
    }
  };

  floatingMicButton.addEventListener('click', (event) => {
    event.preventDefault();
    toggleRecognition();
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'm') {
      event.stopPropagation();
      toggleRecognition();
    }
  });

  languageSelector.addEventListener('change', async (event) => {
    const selectedLanguage = event.target.value;
    setState({recognitionLanguage: selectedLanguage});

    languageSelector.value = selectedLanguage;

    if (recognition) {
      recognition.lang = selectedLanguage;

      if (isRecognitionRunning) {
        recognition.stop();
        recognition.onend = () => {
          recognition.lang = selectedLanguage;
          recognition.start();
          isRecognitionRunning = true;
        };
      } else {
        recognition.lang = selectedLanguage;
      }
    }
  });

})();
