(async () => {
  const { languages } = await import(chrome.runtime.getURL('languages.js'));
  const { createContainer, createButton, createSelect } = await import(chrome.runtime.getURL('ui.js'));
  const { initializeState, getState, setState } = await import(chrome.runtime.getURL('state.js'));
  const { initializeSpeechRecognition } = await import(chrome.runtime.getURL('speech.js'));
  const { createModal, createModalOverlay, setupModal } = await import(chrome.runtime.getURL('modal.js'));
  const { setupMicPosition } = await import(chrome.runtime.getURL('micPosition.js'));
  const { setupAutoGeneration } = await import(chrome.runtime.getURL('autoGeneration.js'));
  const { setupWidthAdjustment } = await import(chrome.runtime.getURL('widthAdjustment.js'));
  const { setupClearButton } = await import(chrome.runtime.getURL('clearButton.js'));

  await initializeState();
  const state = getState();

  const container = createContainer();
  const micButton = createButton(`chrome-extension://${chrome.runtime.id}/img/mic_OFF.png`);
  const settingsButton = createButton(`chrome-extension://${chrome.runtime.id}/img/options.png`);
  const languageOptions = languages.map(lang => ({ value: lang.code, text: lang.name }));
  const languageSelector = createSelect(languageOptions);

  const updateLanguageSelector = () => {
    languageSelector.innerHTML = '';
    state.favoriteLanguages.forEach(langCode => {
      const lang = languages.find(l => l.code === langCode);
      if (lang) {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        languageSelector.appendChild(option);
      }
    });
  };

  updateLanguageSelector();

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
    updateLanguageSelector();
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
    setState({ isListening: false });
    micButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ERR.png)`;
  };

  recognition.onend = () => {
    if (state.isListening) {
      recognition.start();
    } else {
      const inputField = document.querySelector('#prompt-textarea');
      if (inputField) {
        inputField.value += ' ';
        resizeTextarea(inputField);
        triggerInputEvent(inputField);
      }
    }
    micButton.style.backgroundImage = state.isListening ? `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)` : `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
  };

  micButton.addEventListener('click', (event) => {
    event.preventDefault();
    const inputField = document.querySelector('#prompt-textarea');
    if (state.isListening) {
      recognition.stop();
      state.isListening = false;
      setState({ isListening: false });
    } else {
      finalTranscript = inputField.value;
      interimTranscript = '';
      recognition.start();
      state.isListening = true;
      setState({ isListening: true });
    }
    micButton.style.backgroundImage = state.isListening ? `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)` : `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'm') {
      event.stopPropagation();
      micButton.click();
    }
  });

  languageSelector.addEventListener('change', (event) => {
    const selectedLanguage = event.target.value;
    setState({ recognitionLanguage: selectedLanguage });
    recognition.lang = selectedLanguage;
    if (state.isListening) {
      recognition.stop();
      recognition = initializeSpeechRecognition(selectedLanguage);
      recognition.start();
    }
  });

  chrome.storage.local.get(['micPosition'], (result) => {
    if (result.micPosition) {
      setupMicPosition(container, micButton, result.micPosition);
    } else {
      container.appendChild(micButton);
    }
  });
})();
