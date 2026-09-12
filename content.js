let finalTranscript = '';
let interimTranscript = '';
let baseTranscript = '';
let lastFinalResultIndex = -1;
let isRecognitionRunning = false;
let recognition;
let shouldAutoRestart = false;
let pendingLanguageChange = null;
let currentTabId = null;

// Check if extension context is valid, reload page if not
const isExtensionContextValid = () => {
  try {
    return !!chrome.runtime?.id;
  } catch {
  }
};

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

// Pre-built CSS url() strings for hot paths — avoids calling getExtensionUrl()
// (which checks chrome.runtime.id) on every recognition start/stop/error.
const MIC_IMG_OFF_URL = `url(${micButtonImgOff})`;
const MIC_IMG_ON_URL = `url(${getExtensionUrl('/img/mic_ON.png')})`;
const MIC_IMG_ERR_URL = `url(${getExtensionUrl('/img/mic_ERR.png')})`;

const INPUT_SELECTOR = '#prompt-textarea';
const SEND_BUTTON_SELECTOR = '[data-testid="send-button"]';
const INPUT_BOUND_ATTR = 'data-voice-input-bound';
const SEND_BOUND_ATTR = 'data-voice-send-bound';
const AUTO_SEND_SILENCE_MIN_SEC = 2;
const AUTO_SEND_SILENCE_MAX_SEC = 30;
const AUTO_SEND_SILENCE_DEFAULT_SEC = 10;

// Cached input field — querySelector is expensive in hot paths (onresult fires
// several times per second). Invalidated when ChatGPT re-renders the textarea.
let cachedInputField = null;
let cachedInputFieldValid = false;

const getInputField = () => {
  if (cachedInputFieldValid && cachedInputField && document.contains(cachedInputField)) {
    return cachedInputField;
  }
  cachedInputField = document.querySelector(INPUT_SELECTOR);
  cachedInputFieldValid = true;
  return cachedInputField;
};

const invalidateInputFieldCache = () => {
  cachedInputFieldValid = false;
};

const readInputValue = () => {
  const input = getInputField();
  if (!input) {
    return '';
  }
  if ('value' in input) {
    return input.value;
  }
  if (input.isContentEditable) {
    return (input.innerText || '').replace(/\n\n+/g, '\n');
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
    input.setSelectionRange(value.length, value.length);
    const event = new Event('input', {bubbles: true});
    input.dispatchEvent(event);
  } else if (input.isContentEditable) {
    // Avoid deprecated execCommand (selectAll/delete/insertText) which forces
    // a layout reflow on every speech result. Instead, set the text content
    // directly and dispatch an input event that ChatGPT's editor listens to.
    input.focus();
    input.textContent = value;
    // Place caret at the end so subsequent typing appends correctly.
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    input.dispatchEvent(new InputEvent('input', {bubbles: true, data: value, inputType: 'insertText'}));
  } else {
    input.textContent = value;
    const event = new Event('input', {bubbles: true});
    input.dispatchEvent(event);
  }
};

const applyTranscriptsToInput = () => {
  const text = [baseTranscript, finalTranscript, interimTranscript].filter(Boolean).join(' ');
  writeInputValue(text);
};

const clearRecognizedText = () => {
  baseTranscript = '';
  finalTranscript = '';
  interimTranscript = '';
  lastFinalResultIndex = -1;
  applyTranscriptsToInput();
};

const resetTranscriptState = () => {
  baseTranscript = '';
  finalTranscript = '';
  interimTranscript = '';
  lastFinalResultIndex = -1;
};

const rebaseTranscriptsFromCurrentInput = () => {
  baseTranscript = readInputValue();
  finalTranscript = '';
  interimTranscript = '';
};

const resolveCurrentTabId = async () => {
  if (typeof currentTabId === 'number') {
    return currentTabId;
  }
  try {
    const response = await chrome.runtime.sendMessage({action: 'voice-get-tab-id'});
    if (typeof response?.tabId === 'number') {
      currentTabId = response.tabId;
    }
  } catch (error) {
    console.warn('Failed to resolve current tab id:', error);
  }
  return currentTabId;
};

(async () => {
  if (!isExtensionContextValid()) {
    location.reload();
    return;
  }

  let t;
  let languages;
  let createContainer, createButton, createSelect;
  let initializeState, getState, setState, subscribe;
  let initializeSpeechRecognition;
  let createModal, createModalOverlay, setupModal;
  let setupWidthAdjustment;

  try {
    // Load all modules in parallel to minimize startup latency.
    const [
      i18nModule,
      languagesModule,
      uiModule,
      stateModule,
      speechModule,
      modalModule,
      widthModule,
    ] = await Promise.all([
      import(chrome.runtime.getURL('i18n.js')),
      import(chrome.runtime.getURL('languages.js')),
      import(chrome.runtime.getURL('ui.js')),
      import(chrome.runtime.getURL('state.js')),
      import(chrome.runtime.getURL('speech.js')),
      import(chrome.runtime.getURL('modal.js')),
      import(chrome.runtime.getURL('widthAdjustment.js')),
    ]);

    ({t} = i18nModule);
    ({languages} = languagesModule);
    ({createContainer, createButton, createSelect} = uiModule);
    ({initializeState, getState, setState, subscribe} = stateModule);
    ({initializeSpeechRecognition} = speechModule);
    ({createModal, createModalOverlay, setupModal} = modalModule);
    ({setupWidthAdjustment} = widthModule);
  } catch {
    location.reload();
    return;
  }

  await initializeState();
  await resolveCurrentTabId();
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
      silenceTimerIndicator.title = t('timerTitle');
      // Base position at origin — actual offset is applied via transform.
      silenceTimerIndicator.style.left = '0px';
      silenceTimerIndicator.style.top = '0px';
      silenceTimerIndicator.style.zIndex = '10000';

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

  // Cached send button reference — avoids querySelector on every second tick.
  // Invalidated when ChatGPT re-renders the form (detected via scheduleRebind).
  let cachedSendButton = null;

  const getSendButton = () => {
    if (cachedSendButton && document.contains(cachedSendButton)) {
      return cachedSendButton;
    }
    cachedSendButton = document.querySelector(SEND_BUTTON_SELECTOR);
    return cachedSendButton;
  };

  const invalidateSendButtonCache = () => {
    cachedSendButton = null;
  };

  const renderSilenceTimer = () => {
    if (!isAutoSendOnSilenceEnabled()) {
      removeSilenceTimerIndicator();
      return;
    }

    const sendButton = getSendButton();
    if (!sendButton) {
      removeSilenceTimerIndicator();
      return;
    }

    ensureSilenceTimerIndicator();

    // Position the timer next to the send button. We use a single
    // getBoundingClientRect call and apply via transform (GPU-friendly) so
    // the countdown does not trigger layout reflow every second.
    const rect = sendButton.getBoundingClientRect();
    const targetX = Math.round(rect.left - 78);
    const targetY = Math.round(rect.top + (rect.height - 30) / 2);
    silenceTimerIndicator.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;

    if (isTimerPaused) {
      silenceTimerIndicator.classList.add('paused');
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

  const stopRecognitionLocally = () => {
    if (!isRecognitionRunning || !recognition) {
      return;
    }
    shouldAutoRestart = false;
    recognition.stop();
    isRecognitionRunning = false;
    stopSilenceCountdown();
    setState({isListening: false});
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

    const sendButton = getSendButton();
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
    silenceDeadlineTimestamp = null;
    stopSilenceCountdown();

    // Play a short beep if the sound option is enabled.
    if (Boolean(getState().soundOnAutoSend)) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch (e) {
        // AudioContext may not be available — silently ignore.
      }
    }

    sendButton.click();

    // Reset transcript state after React processes the send.
    // If keepMicOnAfterAutoSend is enabled, restart the silence countdown
    // so the user can continue dictating without re-clicking the mic.
    setTimeout(() => {
      clearRecognizedText();
      isAutoSending = false;
      if (isRecognitionRunning && Boolean(getState().keepMicOnAfterAutoSend)) {
        startSilenceCountdown();
      }
    }, 80);
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
  floatingMicButton.setAttribute('aria-label', t('micButtonLabel'));
  floatingMicButton.setAttribute('role', 'button');
  const floatingClearButton = createButton(floatingClearButtonImg);
  floatingClearButton.setAttribute('aria-label', t('clearButtonLabel'));
  floatingClearButton.setAttribute('role', 'button');
  const settingsButton = createButton(settingsButtonImg);
  settingsButton.setAttribute('aria-label', t('settingsButtonLabel'));
  settingsButton.setAttribute('role', 'button');
  const languageOptions = languages.map(lang => ({value: lang.code, text: lang.name}));
  const languageSelector = createSelect(languageOptions);
  languageSelector.setAttribute('aria-label', t('languageSelectorLabel'));

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
    collapseToggle.title = isMinimized ? t('expandPanel') : t('collapsePanel');
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
  let panelDragDeltaX = 0;
  let panelDragDeltaY = 0;

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
    panelDragDeltaX = 0;
    panelDragDeltaY = 0;
    container.classList.add('dragging');
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanelDragging) return;

    panelDragDeltaX = e.clientX - panelDragStartX;
    panelDragDeltaY = e.clientY - panelDragStartY;

    // Use transform for GPU-accelerated movement (no layout reflow per frame).
    // Final left/top is committed only once on mouseup.
    container.style.transform = `translate3d(${panelDragDeltaX}px, ${panelDragDeltaY}px, 0)`;
  });

  document.addEventListener('mouseup', () => {
    if (isPanelDragging) {
      isPanelDragging = false;

      // Commit final position: base + delta, clamped to viewport.
      const finalX = panelInitialX + panelDragDeltaX;
      const finalY = panelInitialY + panelDragDeltaY;
      const { x: constrainedX, y: constrainedY } = constrainPanelPosition(finalX, finalY);

      // Reset transform BEFORE removing .dragging class so the reset
      // happens with transition disabled (no "snap-back" animation).
      container.style.transform = '';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = `${constrainedX}px`;
      container.style.top = `${constrainedY}px`;
      // Force reflow so the transform reset is committed without transition
      void container.offsetHeight;
      container.classList.remove('dragging');
      container.style.cursor = 'move';
      container.style.userSelect = '';

      // Save position only once at drag end
      setState({ panelX: constrainedX, panelY: constrainedY });

      panelDragDeltaX = 0;
      panelDragDeltaY = 0;
    }
  });

  // Message listener for position changes from modal
  try {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      // console.log('[VoiceToText] Received message:', request.action, request);

      switch (request.action) {
        case 'centerPanel':
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
          return true;
        case 'centerMic': {
          const micCenterX = window.innerWidth / 2 - floatingButtonContainer.offsetWidth / 2;
          const micCenterY = window.innerHeight / 2 - floatingButtonContainer.offsetHeight / 2;
          updateFloatingButtonPosition(micCenterX, micCenterY);
          sendResponse({ success: true });
          return true;
        }
        case 'stopRecognitionIfActive':
          stopRecognitionLocally();
          floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
          sendResponse({ success: true });
          return true;
        default:
          return false;
      }
    });
  } catch (e) {
    console.warn('[VoiceToText] Extension context invalidated, reloading page');
    location.reload();
  }

  let isDragging = false;
  let startX, startY;
  let dragInitialLeft, dragInitialTop;
  let dragDeltaX = 0;
  let dragDeltaY = 0;

  floatingButtonContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    dragInitialLeft = floatingButtonContainer.offsetLeft;
    dragInitialTop = floatingButtonContainer.offsetTop;
    dragDeltaX = 0;
    dragDeltaY = 0;
    floatingButtonContainer.classList.add('dragging');
    floatingButtonContainer.style.willChange = 'transform';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    dragDeltaX = e.clientX - startX;
    dragDeltaY = e.clientY - startY;
    // GPU-accelerated movement via transform (no layout reflow per frame).
    floatingButtonContainer.style.transform = `translate3d(${dragDeltaX}px, ${dragDeltaY}px, 0)`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;

      // Commit final position: base + delta, clamped to viewport.
      const finalX = dragInitialLeft + dragDeltaX;
      const finalY = dragInitialTop + dragDeltaY;
      const maxX = window.innerWidth - floatingButtonContainer.offsetWidth;
      const maxY = window.innerHeight - floatingButtonContainer.offsetHeight;
      const clampedX = Math.max(0, Math.min(finalX, maxX));
      const clampedY = Math.max(0, Math.min(finalY, maxY));

      // Reset transform BEFORE removing .dragging class so the reset
      // happens with transition disabled (no "snap-back" animation).
      floatingButtonContainer.style.transform = '';
      floatingButtonContainer.style.left = `${clampedX}px`;
      floatingButtonContainer.style.top = `${clampedY}px`;
      // Force reflow so the transform reset is committed without transition
      void floatingButtonContainer.offsetHeight;
      floatingButtonContainer.classList.remove('dragging');
      floatingButtonContainer.style.willChange = 'auto';

      // Save position only once at drag end
      setState({ floatingButtonX: clampedX, floatingButtonY: clampedY });

      dragDeltaX = 0;
      dragDeltaY = 0;
    }
  });

  const bindSendButtonClearIfNeeded = () => {
    const sendButton = getSendButton();
    if (!sendButton || sendButton.hasAttribute(SEND_BOUND_ATTR)) {
      return;
    }

    sendButton.setAttribute(SEND_BOUND_ATTR, 'true');
    sendButton.addEventListener('click', () => {
      // Keep microphone on after auto-send if the option is enabled.
      if (isRecognitionRunning) {
        const keepMicOn = isAutoSending && Boolean(getState().keepMicOnAfterAutoSend);
        if (!keepMicOn) {
          stopRecognitionLocally();
          floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
        }
      }
      stopSilenceCountdown();
      resetTranscriptState();
    });
  };

  const bindInputEnterIfNeeded = () => {
    const input = getInputField();
    if (!input || input.hasAttribute(INPUT_BOUND_ATTR)) {
      return;
    }

    input.setAttribute(INPUT_BOUND_ATTR, 'true');
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        if (isRecognitionRunning) {
          stopRecognitionLocally();
          floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
        }
        stopSilenceCountdown();
        resetTranscriptState();
      }
      if (event.key === 'Enter' && event.shiftKey && !event.isComposing && isRecognitionRunning) {
        setTimeout(() => rebaseTranscriptsFromCurrentInput(), 0);
      }
    });
  };

  // Debounced rebinding of send button and input listeners.
  // ChatGPT is a heavy SPA — DOM mutates constantly, so we batch checks
  // instead of running querySelector on every mutation event.
  let rebindScheduled = false;
  const scheduleRebind = () => {
    if (rebindScheduled) return;
    rebindScheduled = true;
    requestAnimationFrame(() => {
      rebindScheduled = false;
      // Invalidate cached elements — ChatGPT may have replaced the textarea/form.
      invalidateInputFieldCache();
      invalidateSendButtonCache();
      bindSendButtonClearIfNeeded();
      bindInputEnterIfNeeded();
    });
  };

  // Observe the main content area (not the entire body) for re-renders of the
  // textarea and send button. ChatGPT streams responses and mutates body
  // constantly — observing only <main> avoids firing on unrelated DOM changes
  // (modals, overlays, streaming tokens, etc.).
  const mutationObserver = new MutationObserver(scheduleRebind);
  const observeTarget = document.querySelector('main') || document.body;
  mutationObserver.observe(observeTarget, {childList: true, subtree: true});

  bindSendButtonClearIfNeeded();
  bindInputEnterIfNeeded();

  floatingClearButton.addEventListener('click', () => {
    clearRecognizedText();
    const input = getInputField();
    if (!input) {
      return;
    }
    input.focus();
    if ('value' in input) {
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });

  let lastFavoriteLanguages = null;
  let lastRecognitionLanguage = null;

  const updateLanguageSelector = (currentState) => {
    // Only rebuild the <option> list when the favorite languages actually
    // changed — avoids recreating DOM nodes on every unrelated setState call.
    const favoritesChanged = lastFavoriteLanguages !== currentState.favoriteLanguages;
    if (favoritesChanged) {
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
      lastFavoriteLanguages = currentState.favoriteLanguages;
    }

    // Only update the selected value when it actually changed.
    if (lastRecognitionLanguage !== currentState.recognitionLanguage) {
      languageSelector.value = currentState.recognitionLanguage;
      lastRecognitionLanguage = currentState.recognitionLanguage;
    }
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

  // Focus-trap helpers for the settings modal (a11y).
  const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let lastFocusedBeforeModal = null;

  const openModal = () => {
    lastFocusedBeforeModal = document.activeElement;
    // Apply theme before showing so there's no flash of wrong theme.
    const theme = getState().theme || 'system';
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    modal.setAttribute('data-theme', isDark ? 'dark' : 'light');
    modal.style.display = 'block';
    modalOverlay.style.display = 'block';
    // Trigger entrance animation on the next frame so display:block applies first.
    requestAnimationFrame(() => modal.classList.add('modal-open'));
    // Move focus into the modal for screen-reader users.
    const firstFocusable = modal.querySelector(FOCUSABLE_SELECTOR);
    if (firstFocusable) firstFocusable.focus();
  };

  const closeModalFn = () => {
    modal.classList.remove('modal-open');
    const overlay = modalOverlay;
    // Wait for the fade-out transition before hiding completely.
    const finish = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      modal.removeEventListener('transitionend', finish);
    };
    modal.addEventListener('transitionend', finish);
    // Fallback in case transitionend does not fire (e.g. reduced motion).
    setTimeout(finish, 220);
    if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
      lastFocusedBeforeModal.focus();
    }
  };

  settingsButton.addEventListener('click', openModal);
  modalOverlay.addEventListener('click', closeModalFn);

  // Trap Tab/Shift+Tab inside the modal while it is open.
  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || modal.style.display !== 'block') return;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  await setupModal(modal, state.favoriteLanguages, (newFavoriteLanguages) => {
    setState({favoriteLanguages: newFavoriteLanguages});
    updateLanguageSelector(state);
  }, container, updateFloatingButtonPosition, floatingButtonContainer);

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
      stopRecognitionLocally();
      floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
    } else {
      baseTranscript = inputField ? readInputValue() : '';
      finalTranscript = '';
      interimTranscript = '';
      shouldAutoRestart = true;
      isTimerPaused = false;
      if (typeof currentTabId === 'number') {
        try {
          chrome.runtime.sendMessage({action: 'voice-stop-other-tabs', currentTabId}, () => {
            void chrome.runtime.lastError;
          });
        } catch (error) {
          console.warn('Failed to send voice-stop-other-tabs:', error);
        }
      }
      try {
        recognition.start();
        isRecognitionRunning = true;
        setState({isListening: true});
        floatingMicButton.style.backgroundImage = MIC_IMG_ON_URL;
        startSilenceCountdown();
      } catch (error) {
        console.warn('Failed to start recognition:', error);
        isRecognitionRunning = false;
        shouldAutoRestart = false;
        setState({isListening: false});
      }
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
    baseTranscript = inputField ? readInputValue() : '';
    finalTranscript = '';
    interimTranscript = '';
    shouldAutoRestart = false; // Don't auto-restart in PTT mode
    isTimerPaused = false;
    try {
      recognition.start();
      isRecognitionRunning = true;
      setState({isListening: true});
      floatingMicButton.style.backgroundImage = MIC_IMG_ON_URL;
      floatingMicButton.classList.add('ptt-active');
      startSilenceCountdown();
    } catch (error) {
      console.warn('Failed to start PTT recognition:', error);
      isPushToTalkActive = false;
      isRecognitionRunning = false;
      setState({isListening: false});
    }
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
    floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
    floatingMicButton.classList.remove('ptt-active');
  };

  // Voice punctuation command mappings per locale.
  const PUNCTUATION_MAP = {
    en: {
      'comma': ',', 'period': '.', 'full stop': '.',
      'question mark': '?', 'exclamation mark': '!', 'exclamation point': '!',
      'new line': '\n', 'newline': '\n',
      'semicolon': ';', 'colon': ':', 'dash': '—', 'hyphen': '-',
      'open parenthesis': '(', 'close parenthesis': ')',
      'open quote': '"', 'close quote': '"',
    },
    ru: {
      'запятая': ',', 'точка': '.', 'вопрос': '?', 'вопросительный знак': '?',
      'восклицание': '!', 'восклицательный знак': '!',
      'новая строка': '\n', 'новая строка': '\n', 'абзац': '\n',
      'точка с запятой': ';', 'двоеточие': ':', 'тире': '—', 'дефис': '-',
      'открывающая скобка': '(', 'закрывающая скобка': ')',
      'кавычка': '"',
    },
    uk: {
      'кома': ',', 'крапка': '.', 'питання': '?', 'знак оклику': '!',
      'новий рядок': '\n', 'крапка з комою': ';', 'двокрапка': ':',
      'тире': '—', 'дефіс': '-',
    },
    es: {
      'coma': ',', 'punto': '.', 'signo de interrogación': '?',
      'signo de exclamación': '!', 'nueva línea': '\n',
      'punto y coma': ';', 'dos puntos': ':', 'guión': '—',
    },
    fr: {
      'virgule': ',', 'point': '.', "point d'interrogation": '?',
      "point d'exclamation": '!', 'nouvelle ligne': '\n',
      'point-virgule': ';', 'deux points': ':', 'tiret': '—',
    },
    pt: {
      'vírgula': ',', 'ponto': '.', 'ponto de interrogação': '?',
      'ponto de exclamação': '!', 'nova linha': '\n',
      'ponto e vírgula': ';', 'dois pontos': ':', 'traço': '—',
    },
    de: {
      'komma': ',', 'punkt': '.', 'fragezeichen': '?',
      'ausrufezeichen': '!', 'neue zeile': '\n',
      'semikolon': ';', 'doppelpunkt': ':', 'strich': '—',
    },
  };

  // Apply voice punctuation commands and word replacements to a transcript fragment.
  const processTranscript = (text) => {
    let result = text;

    // Voice punctuation: replace spoken commands with punctuation marks.
    if (Boolean(getState().isVoicePunctuationEnabled)) {
      const lang = (getState().recognitionLanguage || 'en-US').split('-')[0];
      const map = PUNCTUATION_MAP[lang] || PUNCTUATION_MAP.en;
      const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
      for (const [command, punct] of entries) {
        const regex = new RegExp(`\\b${command}\\b`, 'gi');
        result = result.replace(regex, punct);
      }
    }

    // Word replacements: replace recognized words with user-defined text.
    const replacements = getState().wordReplacements || [];
    for (const rep of replacements) {
      if (rep.from && rep.to) {
        const regex = new RegExp(`\\b${rep.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        result = result.replace(regex, rep.to);
      }
    }

    return result;
  };

  recognition.onresult = (event) => {
    // Pick up manual edits made between speech results
    const currentValue = readInputValue();
    const expectedValue = [baseTranscript, finalTranscript, interimTranscript].filter(Boolean).join(' ');
    if (currentValue !== expectedValue && isRecognitionRunning) {
      rebaseTranscriptsFromCurrentInput();
    }

    const appendWithSpace = (existing, fragment) => {
      if (!existing) {
        return fragment;
      }
      if (!fragment) {
        return existing;
      }
      return `${existing} ${fragment}`;
    };

    let finalTranscriptFragment = '';
    let newInterimTranscript = '';
    const startIndex = Math.max(event.resultIndex, lastFinalResultIndex + 1);
    for (let i = startIndex; i < event.results.length; ++i) {
      const transcript = processTranscript(event.results[i][0].transcript.trim());
      if (event.results[i].isFinal) {
        finalTranscriptFragment = appendWithSpace(finalTranscriptFragment, transcript);
        lastFinalResultIndex = Math.max(lastFinalResultIndex, i);
      } else {
        newInterimTranscript = appendWithSpace(newInterimTranscript, transcript);
      }
    }
    finalTranscript = appendWithSpace(finalTranscript, finalTranscriptFragment);
    interimTranscript = newInterimTranscript;
    applyTranscriptsToInput();
    startSilenceCountdown();
  };

  recognition.onerror = (event) => {
    const nonCriticalErrors = ['no-speech', 'aborted'];
    const permissionErrors = ['audio-capture', 'not-allowed', 'service-not-allowed'];

    if (nonCriticalErrors.includes(event.error)) {
      // Expected when user is silent or manually stops — no visual error state
      // console.log('[VoiceToText] Speech recognition:', event.error);
      isRecognitionRunning = false;
      stopSilenceCountdown();
      return;
    }

    if (permissionErrors.includes(event.error)) {
      console.warn('Microphone permission/device error:', event.error);
      isRecognitionRunning = false;
      shouldAutoRestart = false;
      stopSilenceCountdown();
      setState({isListening: false});
      floatingMicButton.style.backgroundImage = MIC_IMG_ERR_URL;
      setTimeout(() => {
        floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
      }, 1200);
      return;
    }

    console.error('Speech recognition error', event);
    isRecognitionRunning = false;
    shouldAutoRestart = false;
    stopSilenceCountdown();
    setState({isListening: false});
    floatingMicButton.style.backgroundImage = MIC_IMG_ERR_URL;

    setTimeout(() => {
      if (!getState().isListening) {
        floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
      }
    }, 1000);
  };

  recognition.onend = () => {
    isRecognitionRunning = false;
    stopSilenceCountdown();
    if (shouldAutoRestart) {
      try {
        recognition.start();
        isRecognitionRunning = true;
        floatingMicButton.style.backgroundImage = MIC_IMG_ON_URL;
      } catch (error) {
        console.warn('Failed to restart recognition:', error);
        isRecognitionRunning = false;
        shouldAutoRestart = false;
        floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
        setState({isListening: false});
      }
    } else {
      floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
      setState({isListening: false});
    }
  };

  floatingMicButton.addEventListener('click', (event) => {
    event.preventDefault();
    toggleRecognition();
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
    const inputField = getInputField();
    baseTranscript = inputField ? readInputValue() : '';
    finalTranscript = '';
    interimTranscript = '';
    lastFinalResultIndex = -1;
    startSilenceCountdown();
    if (pendingLanguageChange) {
      recognition.lang = pendingLanguageChange;
      pendingLanguageChange = null;
    }
  };

  // Throttle: runs `func` at most once per `limit` ms, with a trailing call
  // so the final state is always applied. Uses rAF for smooth, frame-aligned
  // execution instead of nested setTimeout chains.
  const throttleWithFinalCall = (func, limit) => {
    let lastRun = 0;
    let trailingTimer = null;

    return function (...args) {
      const context = this;
      const now = Date.now();
      const remaining = limit - (now - lastRun);

      if (remaining <= 0) {
        if (trailingTimer) {
          clearTimeout(trailingTimer);
          trailingTimer = null;
        }
        func.apply(context, args);
        lastRun = now;
      } else if (!trailingTimer) {
        trailingTimer = setTimeout(() => {
          func.apply(context, args);
          lastRun = Date.now();
          trailingTimer = null;
        }, remaining);
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

    // Reset conflicting CSS properties
    container.style.right = 'auto';
    container.style.bottom = 'auto';

    if (panelRect.right > w) {
      container.style.left = `${w - panelRect.width}px`;
    }
    if (panelRect.bottom > h) {
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

  // Resize handling — keep panel and floating button within the viewport.
  // We deliberately avoid ResizeObserver on documentElement: ChatGPT mutates
  // the DOM constantly (streaming, lazy content) which would fire reflow-heavy
  // position checks on every frame. window resize + visualViewport cover the
  // real layout-changing events (rotation, address bar, window resize).
  const onViewportResize = () => {
    checkPanelPosition();
    throttledCheckButtonPosition();
  };

  window.addEventListener('resize', onViewportResize);

  // visualViewport resize - catches browser UI changes (address bar, etc.)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
  }

  // Push-to-Talk: hold configured combo to record, release to stop.
  // Parsed combo is cached so we don't split/map strings on every keydown.
  const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  const parseCombo = (comboStr) => comboStr.split('+').map(s => s.trim());

  let cachedPttParts = null;
  let cachedPttComboStr = null;

  const getPttParts = () => {
    const comboStr = getState().pushToTalkCombo || 'Control+Shift';
    if (cachedPttComboStr !== comboStr) {
      cachedPttComboStr = comboStr;
      cachedPttParts = parseCombo(comboStr);
    }
    return cachedPttParts;
  };

  const isComboSatisfied = (e, parts) => {
    const needsCtrl = parts.includes('Control');
    const needsShift = parts.includes('Shift');
    const needsAlt = parts.includes('Alt');
    const needsMeta = parts.includes('Meta');
    if (needsCtrl !== e.ctrlKey) return false;
    if (needsShift !== e.shiftKey) return false;
    if (needsAlt !== e.altKey) return false;
    if (needsMeta !== e.metaKey) return false;
    const nonModifiers = parts.filter(p => !MODIFIER_KEYS.has(p));
    if (nonModifiers.length > 0) {
      return nonModifiers.some(nm => nm.toLowerCase() === e.key.toLowerCase());
    }
    return parts.some(p => p === e.key);
  };
  const isComboReleased = (e, parts) => {
    const key = e.key;
    const nonModifiers = parts.filter(p => !MODIFIER_KEYS.has(p));
    if (nonModifiers.length > 0) {
      return nonModifiers.some(nm => nm.toLowerCase() === key.toLowerCase()) ||
             parts.some(p => MODIFIER_KEYS.has(key) && p === key);
    }
    return parts.some(p => p === key);
  };

  // Single keydown listener handles both Ctrl+M toggle and PTT combo.
  document.addEventListener('keydown', (e) => {
    // Ctrl+M — toggle recognition (always active, cheap boolean check)
    if (e.ctrlKey && !e.repeat && (e.key === 'm' || e.code === 'KeyM')) {
      e.stopPropagation();
      toggleRecognition();
      return;
    }
    // Push-to-Talk combo
    if (!getState().isPushToTalkEnabled) return;
    const parts = getPttParts();
    if (isComboSatisfied(e, parts) && !e.repeat) {
      e.preventDefault();
      startPushToTalk();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (!getState().isPushToTalkEnabled) return;
    const parts = getPttParts();
    if (isComboReleased(e, parts)) {
      e.preventDefault();
      stopPushToTalk();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !silenceDeadlineTimestamp) {
      return;
    }

    if (isAutoSending) {
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

  // First-run onboarding tooltip — shows once, then never again.
  if (!getState().hasSeenOnboarding) {
    const onboarding = document.createElement('div');
    onboarding.classList.add('onboarding-tooltip');

    const onboardingTitle = document.createElement('div');
    onboardingTitle.classList.add('onboarding-title');
    onboardingTitle.textContent = t('onboardingTitle');

    const onboardingText = document.createElement('div');
    onboardingText.classList.add('onboarding-text');
    onboardingText.textContent = t('onboardingText');

    const gotItBtn = document.createElement('button');
    gotItBtn.classList.add('onboarding-button');
    gotItBtn.textContent = t('onboardingGotIt');
    gotItBtn.addEventListener('click', () => {
      onboarding.remove();
      setState({hasSeenOnboarding: true});
    });

    onboarding.appendChild(onboardingTitle);
    onboarding.appendChild(onboardingText);
    onboarding.appendChild(gotItBtn);
    document.body.appendChild(onboarding);

    // Auto-dismiss after 15 seconds.
    setTimeout(() => {
      if (onboarding.parentNode) {
        onboarding.remove();
        setState({hasSeenOnboarding: true});
      }
    }, 15000);
  }
})();
