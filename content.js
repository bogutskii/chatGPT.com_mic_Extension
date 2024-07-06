(async () => {
  const { languages } = await import(chrome.runtime.getURL('languages.js'));
  const { createContainer, createButton, createSelect } = await import(chrome.runtime.getURL('ui.js'));
  const { loadFavoriteLanguages, saveFavoriteLanguages } = await import(chrome.runtime.getURL('settings.js'));
  const { initializeSpeechRecognition } = await import(chrome.runtime.getURL('speech.js'));
  const { createModal, createModalOverlay, setupModal } = await import(chrome.runtime.getURL('modal.js'));
  const { setupMicPosition } = await import(chrome.runtime.getURL('micPosition.js'));
  const { setupAutoGeneration } = await import(chrome.runtime.getURL('autoGeneration.js'));
  const { setupWidthAdjustment } = await import(chrome.runtime.getURL('widthAdjustment.js'));
  const { setupClearButton } = await import(chrome.runtime.getURL('clearButton.js'));

  const container = createContainer();
  const micButton = createButton(`chrome-extension://${chrome.runtime.id}/img/mic_OFF.png`);
  const settingsButton = createButton(`chrome-extension://${chrome.runtime.id}/img/options.png`);
  const languageOptions = languages.map(lang => ({ value: lang.code, text: lang.name }));
  const languageSelector = createSelect(languageOptions);

  let favoriteLanguages = ['en-US', 'uk-UA', 'ru-RU'];
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

  loadFavoriteLanguages((loadedFavoriteLanguages) => {
    favoriteLanguages = loadedFavoriteLanguages;
    updateLanguageSelector();
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

  await setupModal(modal, favoriteLanguages, updateLanguageSelector);
  await setupMicPosition(container, micButton, languageSelector);
  await setupAutoGeneration(modal);
  await setupWidthAdjustment(modal);
  await setupClearButton(modal);

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

  let recognition = initializeSpeechRecognition(languageSelector.value);

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
    micButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/mic_ERR.png)`;
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
    micButton.style.backgroundImage = isListening ? `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)` : `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
  };

  micButton.addEventListener('click', (event) => {
    event.preventDefault();
    const inputField = document.querySelector('#prompt-textarea');
    if (isListening) {
      recognition.stop();
      isListening = false;
      chrome.storage.local.set({ recognitionLanguage: languageSelector.value });
    } else {
      finalTranscript = inputField.value;
      interimTranscript = '';
      recognition.start();
      isListening = true;
      chrome.storage.local.set({ recognitionLanguage: languageSelector.value });
    }
    micButton.style.backgroundImage = isListening ? `url(chrome-extension://${chrome.runtime.id}/img/mic_ON.png)` : `url(chrome-extension://${chrome.runtime.id}/img/mic_OFF.png)`;
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'm') {
      event.stopPropagation();
      micButton.click();
    }
  });

  chrome.storage.local.get(['micPosition'], (result) => {
    if (result.micPosition) {
      setupMicPosition(container, micButton, languageSelector, result.micPosition);
    } else {
      container.appendChild(micButton);
    }
  });

  languageSelector.addEventListener('change', (event) => {
    const selectedLanguage = event.target.value;
    chrome.storage.local.set({ recognitionLanguage: selectedLanguage });
    recognition.lang = selectedLanguage;
    if (isListening) {
      recognition.stop();
      recognition.start();
    }
  });
})();
