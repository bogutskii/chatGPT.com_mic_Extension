let finalTranscript = '';
let interimTranscript = '';
let isRecognitionRunning = false;
let recognition;
let shouldAutoRestart = false;
let pendingLanguageChange = null;

const micButtonImgOff = `chrome-extension://${chrome.runtime.id}/img/mic_OFF.png`;
const floatingClearButtonImg = `chrome-extension://${chrome.runtime.id}/img/clear.png`;
const settingsButtonImg = `chrome-extension://${chrome.runtime.id}/img/options.png`;

const INPUT_SELECTOR = '#prompt-textarea';
const SEND_BUTTON_SELECTOR = '[data-testid="send-button"]';
const INPUT_BOUND_ATTR = 'data-voice-input-bound';
const SEND_BOUND_ATTR = 'data-voice-send-bound';

const getInputField = () => document.querySelector(INPUT_SELECTOR);

const readInputValue = () => {
  const input = getInputField();
  if (!input) {
    return '';
  }
  if ('value' in input) {
    return input.value;
  }
  return input.textContent || '';
};

const writeInputValue = (value) => {
  const input = getInputField();
  if (!input) {
    return;
  }
  if ('value' in input) {
    input.value = value;
  } else {
    input.textContent = value;
  }
  const event = new Event('input', {bubbles: true});
  input.dispatchEvent(event);
};

const applyTranscriptsToInput = () => {
  writeInputValue(`${finalTranscript}${interimTranscript}`);
};

const clearRecognizedText = () => {
  finalTranscript = '';
  interimTranscript = '';
  applyTranscriptsToInput();
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

  const bindInputListenersIfNeeded = () => {
    const inputField = getInputField();
    if (!inputField || inputField.hasAttribute(INPUT_BOUND_ATTR)) {
      return;
    }

    inputField.setAttribute(INPUT_BOUND_ATTR, 'true');
    inputField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);
        sendButton?.click();
      }
    });
  };

  const bindSendButtonClearIfNeeded = () => {
    const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);
    if (!sendButton || sendButton.hasAttribute(SEND_BOUND_ATTR)) {
      return;
    }

    sendButton.setAttribute(SEND_BOUND_ATTR, 'true');
    sendButton.addEventListener('click', () => {
      setTimeout(() => {
        clearRecognizedText();
      }, 50);
    });
  };

  const mutationObserver = new MutationObserver(() => {
    bindInputListenersIfNeeded();
    bindSendButtonClearIfNeeded();
  });

  mutationObserver.observe(document.body, {childList: true, subtree: true});

  bindInputListenersIfNeeded();
  bindSendButtonClearIfNeeded();

  floatingClearButton.addEventListener('click', () => {
    clearRecognizedText();
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

  recognition = initializeSpeechRecognition(state.recognitionLanguage);
  if (!recognition) {
    console.error('Speech recognition init failed');
    return;
  }

  recognition.continuous = true;
  recognition.interimResults = true;

  const toggleRecognition = () => {
    const inputField = getInputField();
    if (isRecognitionRunning) {
      shouldAutoRestart = false;
      recognition.stop();
      isRecognitionRunning = false;
      setState({isListening: false});
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
    } else {
      finalTranscript = inputField ? readInputValue() : '';
      interimTranscript = '';
      shouldAutoRestart = true;
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
    applyTranscriptsToInput();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event);
    isRecognitionRunning = false;
    shouldAutoRestart = false;
    setState({isListening: false});
    floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ERR.png)`;

    setTimeout(() => {
      if (!getState().isListening) {
        floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
      }
    }, 1000);
  };

  recognition.onend = () => {
    isRecognitionRunning = false;
    if (shouldAutoRestart) {
      recognition.start();
      isRecognitionRunning = true;
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)`;
    } else {
      floatingMicButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
      setState({isListening: false});
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
      if (isRecognitionRunning) {
        pendingLanguageChange = selectedLanguage;
        shouldAutoRestart = true;
        recognition.stop();
      } else {
        recognition.lang = selectedLanguage;
      }
    }
  });

  recognition.onstart = () => {
    shouldAutoRestart = true;
    if (pendingLanguageChange) {
      recognition.lang = pendingLanguageChange;
      pendingLanguageChange = null;
    }
  };

  const throttleWithFinalCall = (func, limit) => {
    let inThrottle;
    let lastFunc;
    let lastRan;

    return function() {
      const args = arguments;
      const context = this;

      if (!inThrottle) {
        func.apply(context, args);
        lastRan = Date.now();
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          if (lastFunc) {
            lastFunc.apply(context, args);
            lastFunc = null;
          }
        }, limit);
      } else {
        lastFunc = function() {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        };
      }
    };
  };

  const checkButtonPosition = () => {
    const floatingButtonContainer = document.getElementById('floatingMicButtonContainer');
    const containerRect = floatingButtonContainer.getBoundingClientRect();

    if (containerRect.left < 0) {
      floatingButtonContainer.style.left = '0px';
    }
    if (containerRect.top < 0) {
      floatingButtonContainer.style.top = '0px';
    }
    if (containerRect.right > window.innerWidth) {
      floatingButtonContainer.style.left = `${window.innerWidth - containerRect.width}px`;
    }
    if (containerRect.bottom > window.innerHeight) {
      floatingButtonContainer.style.top = `${window.innerHeight - containerRect.height}px`;
    }
  };

  const throttledCheckButtonPosition = throttleWithFinalCall(checkButtonPosition, 1000);
  window.addEventListener('resize', throttledCheckButtonPosition);
  checkButtonPosition();
})();
