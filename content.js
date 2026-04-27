let finalTranscript = '';
let interimTranscript = '';
let isRecognitionRunning = false;
let recognition;
let shouldAutoRestart = false;
let pendingLanguageChange = null;

// Check if extension context is valid, reload page if not
const isExtensionContextValid = () => {
  try {
    return !!chrome.runtime?.id;
  } catch {
  }
};

if (!window.location.href.includes('chatgpt.com')) {
  location.reload();
  throw new Error('Extension context invalidated - reloading page');
}

// Safe wrapper for chrome.runtime.id
const getExtensionUrl = (path) => {
  if (!isExtensionContextValid()) {
    location.reload();
    return '';
  }
  return `chrome-extension://${chrome.runtime.id}${path}`;
};

const micButtonImgOff = getExtensionUrl('/img/mic_OFF.png');
const floatingClearButtonImg = getExtensionUrl('/img/clear.png');
const settingsButtonImg = getExtensionUrl('/img/options.png');

const INPUT_SELECTOR = '#prompt-textarea';
const SEND_BUTTON_SELECTOR = '[data-testid="send-button"]';
const INPUT_BOUND_ATTR = 'data-voice-input-bound';
const SEND_BOUND_ATTR = 'data-voice-send-bound';
const AUTO_SEND_SILENCE_MIN_SEC = 2;
const AUTO_SEND_SILENCE_MAX_SEC = 30;
const AUTO_SEND_SILENCE_DEFAULT_SEC = 10;

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
  let silenceCountdownIntervalId = null;
  let silenceDeadlineTimestamp = null;
  let silenceTimerIndicator = null;
  let silenceTimerProgress = null;
  let silenceTimerValue = null;
  let isTimerPaused = false;

  const isAutoSendOnSilenceEnabled = () => Boolean(state.isAutoSendOnSilenceEnabled);

  const getNormalizedAutoSendSilenceDelaySec = () => {
    const parsedDelay = Number(state.autoSendSilenceDelaySec);
    if (!Number.isFinite(parsedDelay)) {
      return AUTO_SEND_SILENCE_DEFAULT_SEC;
    }
    return Math.min(AUTO_SEND_SILENCE_MAX_SEC, Math.max(AUTO_SEND_SILENCE_MIN_SEC, Math.round(parsedDelay)));
  };

  const hideSilenceTimerIndicator = () => {
    if (silenceTimerIndicator) {
      silenceTimerIndicator.classList.remove('show');
    }
  };

  const removeSilenceTimerIndicator = () => {
    if (silenceTimerIndicator?.isConnected) {
      silenceTimerIndicator.remove();
    }
    silenceTimerIndicator = null;
    silenceTimerProgress = null;
    silenceTimerValue = null;
  };

  const ensureSilenceTimerIndicator = () => {
    if (!silenceTimerIndicator) {
      silenceTimerIndicator = document.createElement('div');
      silenceTimerIndicator.classList.add('silence-send-timer');
      silenceTimerIndicator.title = 'Click to pause/resume auto-send countdown';

      silenceTimerProgress = document.createElement('div');
      silenceTimerProgress.classList.add('silence-send-timer-progress');

      silenceTimerValue = document.createElement('div');
      silenceTimerValue.classList.add('silence-send-timer-value');
      silenceTimerValue.textContent = '0';

      silenceTimerIndicator.appendChild(silenceTimerProgress);
      silenceTimerIndicator.appendChild(silenceTimerValue);
      document.body.appendChild(silenceTimerIndicator);

      silenceTimerIndicator.addEventListener('click', () => {
        if (isTimerPaused) {
          resumeSilenceCountdown();
        } else {
          pauseSilenceCountdown();
        }
      });
    }

    if (!silenceTimerIndicator.isConnected) {
      document.body.appendChild(silenceTimerIndicator);
    }
  };

  const renderSilenceTimer = () => {
    if (!isAutoSendOnSilenceEnabled()) {
      removeSilenceTimerIndicator();
      return;
    }

    const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);
    if (!sendButton) {
      removeSilenceTimerIndicator();
      return;
    }

    ensureSilenceTimerIndicator();

    if (isTimerPaused) {
      silenceTimerIndicator.classList.add('paused');
      const rect = sendButton.getBoundingClientRect();
      silenceTimerIndicator.style.left = `${Math.round(rect.left - 78)}px`;
      silenceTimerIndicator.style.top = `${Math.round(rect.top + (rect.height - 30) / 2)}px`;
      silenceTimerIndicator.style.zIndex = '10000';
      silenceTimerIndicator.classList.add('show');
      return;
    }

    if (!silenceDeadlineTimestamp) {
      removeSilenceTimerIndicator();
      return;
    }

    silenceTimerIndicator.classList.remove('paused');

    const delaySec = getNormalizedAutoSendSilenceDelaySec();
    const remainingMs = Math.max(0, silenceDeadlineTimestamp - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    const progress = Math.max(0, Math.min(1, remainingMs / (delaySec * 1000)));

    silenceTimerValue.textContent = String(remainingSec);
    silenceTimerProgress.style.setProperty('--silence-progress', String(progress));

    const rect = sendButton.getBoundingClientRect();
    silenceTimerIndicator.style.left = `${Math.round(rect.left - 78)}px`;
    silenceTimerIndicator.style.top = `${Math.round(rect.top + (rect.height - 30) / 2)}px`;
    silenceTimerIndicator.style.zIndex = '10000';
    silenceTimerIndicator.classList.add('show');
  };

  const stopSilenceCountdown = () => {
    if (silenceCountdownIntervalId) {
      clearInterval(silenceCountdownIntervalId);
      silenceCountdownIntervalId = null;
    }
    silenceDeadlineTimestamp = null;
    isTimerPaused = false;
    hideSilenceTimerIndicator();
  };

  const pauseSilenceCountdown = () => {
    isTimerPaused = true;
    silenceDeadlineTimestamp = null;
    renderSilenceTimer();
  };

  const resumeSilenceCountdown = () => {
    if (!isRecognitionRunning || !isAutoSendOnSilenceEnabled()) {
      return;
    }
    isTimerPaused = false;
    const delaySec = getNormalizedAutoSendSilenceDelaySec();
    silenceDeadlineTimestamp = Date.now() + delaySec * 1000;
    renderSilenceTimer();
  };

  let isAutoSending = false;

  const attemptAutoSendOnSilence = () => {
    if (isAutoSending) {
      return;
    }
    if (!isAutoSendOnSilenceEnabled()) {
      stopSilenceCountdown();
      return;
    }

    const input = getInputField();
    const inputValue = readInputValue().trim();

    if (!input || !inputValue) {
      stopSilenceCountdown();
      return;
    }

    const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);
    if (!sendButton) {
      stopSilenceCountdown();
      return;
    }

    const isSendDisabled = sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true';
    if (isSendDisabled) {
      stopSilenceCountdown();
      return;
    }

    isAutoSending = true;
    stopSilenceCountdown();
    input.focus();
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    input.dispatchEvent(enterEvent);

    // Reset transcript state so next speech starts from a clean input
    clearRecognizedText();

    setTimeout(() => {
      isAutoSending = false;
    }, 500);
  };

  let lastSilenceCountdownRender = 0;

  const startSilenceCountdown = () => {
    if (!isRecognitionRunning || !isAutoSendOnSilenceEnabled()) {
      stopSilenceCountdown();
      return;
    }

    if (isTimerPaused) {
      renderSilenceTimer();
      return;
    }

    const delaySec = getNormalizedAutoSendSilenceDelaySec();
    silenceDeadlineTimestamp = Date.now() + delaySec * 1000;

    if (!silenceCountdownIntervalId) {
      silenceCountdownIntervalId = setInterval(() => {
        renderSilenceTimer();
        if (silenceDeadlineTimestamp && Date.now() >= silenceDeadlineTimestamp) {
          attemptAutoSendOnSilence();
        }
      }, 1000);
    }

    const now = Date.now();
    if (now - lastSilenceCountdownRender > 300) {
      lastSilenceCountdownRender = now;
      renderSilenceTimer();
    }
  };

  const syncSilenceCountdownWithState = () => {
    if (!isAutoSendOnSilenceEnabled()) {
      stopSilenceCountdown();
      return;
    }

    if (silenceDeadlineTimestamp) {
      const delaySec = getNormalizedAutoSendSilenceDelaySec();
      silenceDeadlineTimestamp = Math.min(silenceDeadlineTimestamp, Date.now() + delaySec * 1000);
    }

    renderSilenceTimer();
  };

  const container = createContainer();
  const floatingMicButton = createButton(micButtonImgOff);
  const floatingClearButton = createButton(floatingClearButtonImg);
  const settingsButton = createButton(settingsButtonImg);
  const languageOptions = languages.map(lang => ({value: lang.code, text: lang.name}));
  const languageSelector = createSelect(languageOptions);

  // Add drag handle to container
  const dragHandle = document.createElement('div');
  dragHandle.classList.add('drag-handle');
  container.appendChild(dragHandle);

  // Add collapse/expand toggle strip
  const collapseToggle = document.createElement('button');
  collapseToggle.classList.add('collapse-toggle');

  const updateToggleArrow = () => {
    const isMinimized = container.classList.contains('minimized');
    collapseToggle.textContent = isMinimized ? '<' : '>';
    collapseToggle.title = isMinimized ? 'Expand panel' : 'Collapse panel';
  };

  const toggleMinimize = () => {
    const wasMinimized = container.classList.contains('minimized');
    const isMinimized = container.classList.toggle('minimized');
    setState({ isPanelMinimized: isMinimized });
    updateToggleArrow();

    // If expanding and panel is near edge, push it back into view
    if (wasMinimized && !isMinimized) {
      requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        let newLeft = container.offsetLeft;
        let newTop = container.offsetTop;
        let moved = false;

        if (rect.right > window.innerWidth) {
          newLeft = Math.max(0, window.innerWidth - rect.width);
          moved = true;
        }
        if (rect.bottom > window.innerHeight) {
          newTop = Math.max(0, window.innerHeight - rect.height);
          moved = true;
        }
        if (rect.left < 0) {
          newLeft = 0;
          moved = true;
        }
        if (rect.top < 0) {
          newTop = 0;
          moved = true;
        }

        if (moved) {
          container.style.left = `${newLeft}px`;
          container.style.top = `${newTop}px`;
          setState({ panelX: newLeft, panelY: newTop });
        }
      });
    }
  };

  collapseToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMinimize();
  });

  container.appendChild(collapseToggle);

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

  // Panel positioning and drag functionality
  const applyPanelPosition = (mode) => {
    // Remove all position classes
    container.classList.remove(
      'position-bottom-right',
      'position-bottom-left',
      'position-top-right',
      'position-top-left',
      'position-top',
      'position-bottom',
      'position-left',
      'position-right',
      'position-center',
      'position-custom',
      'draggable'
    );

    // Reset all positioning styles
    container.style.left = '';
    container.style.top = '';
    container.style.right = '';
    container.style.bottom = '';
    container.style.transform = '';

    if (mode === 'custom') {
      container.classList.add('position-custom', 'draggable');
      const { panelX, panelY } = getState();

      if (panelX !== undefined && panelY !== undefined) {
        container.style.left = `${panelX}px`;
        container.style.top = `${panelY}px`;
      } else {
        // Default to bottom-right corner
        const defaultX = window.innerWidth - container.offsetWidth - 16;
        const defaultY = window.innerHeight - container.offsetHeight - 16;
        container.style.left = `${defaultX}px`;
        container.style.top = `${defaultY}px`;
        setState({ panelX: defaultX, panelY: defaultY });
      }
    } else {
      container.classList.add(`position-${mode}`);
    }

    // Force reflow to ensure styles are applied immediately
    void container.offsetHeight;

    console.log('[VoiceToText] Position applied:', mode, container.className);
  };

  // Always use custom mode - allow dragging to any position
  const initPanel = () => {
    container.classList.add('position-custom', 'draggable');
    // Reset conflicting CSS properties
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    const { panelX, panelY, isPanelMinimized } = getState();

    if (panelX !== undefined && panelY !== undefined) {
      container.style.left = `${panelX}px`;
      container.style.top = `${panelY}px`;
    } else {
      // Default to bottom-right corner
      const defaultX = window.innerWidth - container.offsetWidth - 16;
      const defaultY = window.innerHeight - container.offsetHeight - 16;
      container.style.left = `${defaultX}px`;
      container.style.top = `${defaultY}px`;
      setState({ panelX: defaultX, panelY: defaultY });
    }

    // Restore minimized state
    if (isPanelMinimized) {
      container.classList.add('minimized');
    }
    updateToggleArrow();
  };

  // Panel drag functionality
  let isPanelDragging = false;
  let panelDragStartX, panelDragStartY;
  let panelInitialX, panelInitialY;

  const constrainPanelPosition = (x, y) => {
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };
  };

  const updatePanelPosition = (x, y) => {
    const { x: constrainedX, y: constrainedY } = constrainPanelPosition(x, y);

    // Reset conflicting CSS properties
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    container.style.left = `${constrainedX}px`;
    container.style.top = `${constrainedY}px`;
  };

  container.addEventListener('mousedown', (e) => {
    // Only allow dragging in custom mode
    if (!container.classList.contains('draggable')) return;

    // Don't start drag if clicking on interactive elements
    const isInteractive = e.target.closest('select, button, option, input, a, .select, .button');
    if (isInteractive) return;

    // Prevent text selection while dragging
    e.preventDefault();

    isPanelDragging = true;
    panelDragStartX = e.clientX;
    panelDragStartY = e.clientY;
    panelInitialX = container.offsetLeft;
    panelInitialY = container.offsetTop;
    container.classList.add('dragging');
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanelDragging) return;

    const deltaX = e.clientX - panelDragStartX;
    const deltaY = e.clientY - panelDragStartY;

    const newX = panelInitialX + deltaX;
    const newY = panelInitialY + deltaY;
    const { x: constrainedX, y: constrainedY } = constrainPanelPosition(newX, newY);

    // Update DOM directly — no setState during drag for responsiveness
    container.style.left = `${constrainedX}px`;
    container.style.top = `${constrainedY}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isPanelDragging) {
      isPanelDragging = false;
      container.classList.remove('dragging');
      container.style.cursor = 'move';
      container.style.userSelect = '';
      // Save position only once at drag end
      const finalX = parseInt(container.style.left, 10);
      const finalY = parseInt(container.style.top, 10);
      setState({ panelX: finalX, panelY: finalY });
    }
  });

  // Message listener for position changes from modal
  try {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // console.log('[VoiceToText] Received message:', request.action, request);

    if (request.action === 'applyPanelPosition') {
      console.log('[VoiceToText] Applying panel position:', request.position);
      applyPanelPosition(request.position);
      sendResponse({ success: true });
    } else if (request.action === 'centerPanel') {
      container.classList.add('position-custom', 'draggable');
      // Reset conflicting CSS properties
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      // Center the panel
      const centerX = window.innerWidth / 2 - container.offsetWidth / 2;
      const centerY = window.innerHeight / 2 - container.offsetHeight / 2;
      container.style.left = `${centerX}px`;
      container.style.top = `${centerY}px`;
      setState({ panelX: centerX, panelY: centerY });
      sendResponse({ success: true });
    } else if (request.action === 'centerMic') {
      const centerX = window.innerWidth / 2 - floatingButtonContainer.offsetWidth / 2;
      const centerY = window.innerHeight / 2 - floatingButtonContainer.offsetHeight / 2;
      updateFloatingButtonPosition(centerX, centerY);
      sendResponse({ success: true });
    }
    return true;
  });
  } catch (e) {
    console.warn('[VoiceToText] Extension context invalidated, reloading page');
    location.reload();
  }

  let isDragging = false;
  let startX, startY;

  floatingButtonContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - floatingButtonContainer.offsetLeft;
    startY = e.clientY - floatingButtonContainer.offsetTop;
    floatingButtonContainer.style.willChange = 'transform';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      let x = e.clientX - startX;
      let y = e.clientY - startY;
      const maxX = window.innerWidth - floatingButtonContainer.offsetWidth;
      const maxY = window.innerHeight - floatingButtonContainer.offsetHeight;
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));
      // Update DOM directly — no setState during drag for responsiveness
      floatingButtonContainer.style.left = `${x}px`;
      floatingButtonContainer.style.top = `${y}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      floatingButtonContainer.style.willChange = 'auto';
      // Save position only once at drag end
      const finalX = parseInt(floatingButtonContainer.style.left, 10);
      const finalY = parseInt(floatingButtonContainer.style.top, 10);
      setState({ floatingButtonX: finalX, floatingButtonY: finalY });
    }
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
      stopSilenceCountdown();
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
    syncSilenceCountdownWithState();
    if (recognition && state.recognitionLanguage) {
      recognition.lang = state.recognitionLanguage;
    }

    // Sync minimized state
    const shouldBeMinimized = state.isPanelMinimized;
    const isCurrentlyMinimized = container.classList.contains('minimized');
    if (shouldBeMinimized && !isCurrentlyMinimized) {
      container.classList.add('minimized');
      updateToggleArrow();
    } else if (!shouldBeMinimized && isCurrentlyMinimized) {
      container.classList.remove('minimized');
      updateToggleArrow();
    }
  });

  container.appendChild(languageSelector);
  container.appendChild(settingsButton);
  document.body.appendChild(container);

  // Initialize panel position after it's in DOM
  initPanel();

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
      stopSilenceCountdown();
      setState({isListening: false});
      floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_OFF.png')})`;
    } else {
      finalTranscript = inputField ? readInputValue() : '';
      interimTranscript = '';
      shouldAutoRestart = true;
      isTimerPaused = false;
      recognition.start();
      isRecognitionRunning = true;
      setState({isListening: true});
      floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_ON.png')})`;
      startSilenceCountdown();
    }
  };

  // Push-to-Talk mode (walkie-talkie) — hold Insert to record, release to stop
  let isPushToTalkActive = false;
  let wasAlreadyListeningBeforePTT = false;

  const startPushToTalk = () => {
    if (isPushToTalkActive) return;
    if (isRecognitionRunning) {
      wasAlreadyListeningBeforePTT = true;
      return;
    }
    wasAlreadyListeningBeforePTT = false;
    isPushToTalkActive = true;
    const inputField = getInputField();
    finalTranscript = inputField ? readInputValue() : '';
    interimTranscript = '';
    shouldAutoRestart = false; // Don't auto-restart in PTT mode
    isTimerPaused = false;
    recognition.start();
    isRecognitionRunning = true;
    setState({isListening: true});
    floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_ON.png')})`;
    floatingMicButton.style.filter = 'brightness(1.3) sepia(1) hue-rotate(-30deg) saturate(2)';
    startSilenceCountdown();
  };

  const stopPushToTalk = () => {
    if (!isPushToTalkActive) {
      wasAlreadyListeningBeforePTT = false;
      return;
    }
    isPushToTalkActive = false;
    if (wasAlreadyListeningBeforePTT) {
      wasAlreadyListeningBeforePTT = false;
      return; // Don't stop if mic was already on before PTT
    }
    shouldAutoRestart = false;
    recognition.stop();
    isRecognitionRunning = false;
    stopSilenceCountdown();
    setState({isListening: false});
    floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_OFF.png')})`;
    floatingMicButton.style.filter = '';
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
    startSilenceCountdown();
  };

  recognition.onerror = (event) => {
    const nonCriticalErrors = ['no-speech', 'aborted'];

    if (nonCriticalErrors.includes(event.error)) {
      // Expected when user is silent or manually stops — no visual error state
      // console.log('[VoiceToText] Speech recognition:', event.error);
      isRecognitionRunning = false;
      stopSilenceCountdown();
      return;
    }

    console.error('Speech recognition error', event);
    isRecognitionRunning = false;
    shouldAutoRestart = false;
    stopSilenceCountdown();
    setState({isListening: false});
    floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_ERR.png')})`;

    setTimeout(() => {
      if (!getState().isListening) {
        floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_OFF.png')})`;
      }
    }, 1000);
  };

  recognition.onend = () => {
    isRecognitionRunning = false;
    stopSilenceCountdown();
    if (shouldAutoRestart) {
      recognition.start();
      isRecognitionRunning = true;
      floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_ON.png')})`;
    } else {
      floatingMicButton.style.backgroundImage = `url(${getExtensionUrl('/img/mic_OFF.png')})`;
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
    isTimerPaused = false;
    startSilenceCountdown();
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

  const checkPanelPosition = () => {
    const panelRect = container.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;

    // console.log('[VoiceToText] checkPanelPosition:', { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom, w, h });

    // Reset conflicting CSS properties
    container.style.right = 'auto';
    container.style.bottom = 'auto';

    if (panelRect.right > w) {
      console.log('[VoiceToText] Panel off-screen right, moving to', w - panelRect.width);
      container.style.left = `${w - panelRect.width}px`;
    }
    if (panelRect.bottom > h) {
      console.log('[VoiceToText] Panel off-screen bottom, moving to', h - panelRect.height);
      container.style.top = `${h - panelRect.height}px`;
    }
    if (panelRect.left < 0) {
      container.style.left = '0px';
    }
    if (panelRect.top < 0) {
      container.style.top = '0px';
    }
  };

  const throttledCheckButtonPosition = throttleWithFinalCall(checkButtonPosition, 100);

  window.addEventListener('resize', () => {
    checkPanelPosition();
    throttledCheckButtonPosition();
  });

  // ResizeObserver on documentElement - catches all size changes
  const resizeObserver = new ResizeObserver(() => {
    checkPanelPosition();
    throttledCheckButtonPosition();
  });
  resizeObserver.observe(document.documentElement);

  // visualViewport resize - catches browser UI changes (address bar, etc.)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      checkPanelPosition();
      throttledCheckButtonPosition();
    });
  }

  // Push-to-Talk: hold Insert to record, release to stop
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Insert' && !e.repeat) {
      e.preventDefault();
      startPushToTalk();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Insert') {
      e.preventDefault();
      stopPushToTalk();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !silenceDeadlineTimestamp) {
      return;
    }

    if (Date.now() >= silenceDeadlineTimestamp) {
      attemptAutoSendOnSilence();
      return;
    }

    renderSilenceTimer();
  });

  checkButtonPosition();
  checkPanelPosition();
})();
