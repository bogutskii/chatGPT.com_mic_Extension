let finalTranscript = '';
let interimTranscript = '';
let baseTranscript = '';
let lastFinalResultIndex = -1;
let isRecognitionRunning = false;
let recognition;
let shouldAutoRestart = false;
let pendingLanguageChange = null;
let networkRetryCount = 0;
let networkRetryTimer = null;
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

const INPUT_SELECTOR = '#prompt-textarea, [data-composer-markdown], #mobile-composer-prompt, textarea[name="prompt"], form [contenteditable="true"]';
const SEND_BUTTON_SELECTOR = '[data-testid="send-button"], [data-composer-submit]';
const INPUT_BOUND_ATTR = 'data-voice-input-bound';
const SEND_BOUND_ATTR = 'data-voice-send-bound';
const AUTO_SEND_SILENCE_MIN_SEC = 2;
const AUTO_SEND_SILENCE_MAX_SEC = 30;
const AUTO_SEND_SILENCE_DEFAULT_SEC = 10;

// 'network' errors are usually transient (Chrome streams audio to a
// server-side speech service) — retry with exponential backoff, then give up.
const NETWORK_RETRY_BASE_DELAY_MS = 1000;
const NETWORK_RETRY_MAX_DELAY_MS = 15000;
const NETWORK_RETRY_MAX_ATTEMPTS = 5;

// Cached input field — querySelector is expensive in hot paths (onresult fires
// several times per second). Invalidated when ChatGPT re-renders the textarea.
let cachedInputField = null;
let cachedInputFieldValid = false;

// Prefer the first visible match — ChatGPT can render several composer
// candidates (e.g. hidden responsive variants); writing into a hidden
// duplicate would look like "dictation inserts nothing".
const pickVisible = (nodeList) => {
  for (const el of nodeList) {
    if (el.getClientRects().length > 0) {
      return el;
    }
  }
  return nodeList[0] || null;
};

const getInputField = () => {
  if (cachedInputFieldValid && cachedInputField && document.contains(cachedInputField)) {
    return cachedInputField;
  }
  cachedInputField = pickVisible(document.querySelectorAll(INPUT_SELECTOR));
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
    const raw = input.innerText || '';
    // An empty ProseMirror doc renders as <p><br></p> and innerText reads
    // '\n' — treat it as empty, otherwise dictation starts with a stray
    // line break.
    if (!raw.trim()) {
      return '';
    }
    return raw.replace(/\n\n+/g, '\n');
  }
  return input.textContent || '';
};

// ChatGPT's composer is a React-controlled field. React wraps the element's
// own `value` property to track changes, so `input.value = x` updates the
// tracker too and the following input event is treated as "no change" —
// the text shows but React state stays empty and may revert it. Calling the
// prototype setter bypasses the tracker, so the event registers as a real
// change and the send button enables.
const setNativeValue = (input, value) => {
  const proto = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : input instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : null;
  const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
};

const writeInputValue = (value) => {
  const input = getInputField();
  if (!input) {
    return;
  }
  if ('value' in input) {
    setNativeValue(input, value);
    input.setSelectionRange(value.length, value.length);
    const event = new Event('input', {bubbles: true});
    input.dispatchEvent(event);
  } else if (input.isContentEditable) {
    input.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    if (value) {
      document.execCommand('insertText', false, value);
    } else {
      // Empty string via insertText may not fire beforeinput — delete fires
      // a real deleteContentBackward that ProseMirror applies to its state.
      document.execCommand('delete', false);
    }
  } else {
    input.textContent = value;
    const event = new Event('input', {bubbles: true});
    input.dispatchEvent(event);
  }
};

// Characters that must not be preceded by a space when joining fragments.
const NO_LEADING_SPACE_RE = /^[\n,.!?;:)\]}»”…，。、！？；：؟؛،]/;

const joinTranscriptParts = (existing, fragment) => {
  if (!existing) {
    return fragment;
  }
  if (!fragment) {
    return existing;
  }
  if (existing.endsWith('\n') || NO_LEADING_SPACE_RE.test(fragment)) {
    return existing + fragment;
  }
  return `${existing} ${fragment}`;
};

const applyTranscriptsToInput = () => {
  const text = [baseTranscript, finalTranscript, interimTranscript].filter(Boolean).reduce(joinTranscriptParts, '');
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
    cachedSendButton = pickVisible(document.querySelectorAll(SEND_BUTTON_SELECTOR));
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
    if (!recognition) {
      return;
    }
    shouldAutoRestart = false;
    networkRetryCount = 0;
    if (networkRetryTimer) {
      clearTimeout(networkRetryTimer);
      networkRetryTimer = null;
    }
    // Call stop() unconditionally: after a 'network' error the flag is already
    // false while the object may still be stopping — skipping stop() would
    // make a later start() throw InvalidStateError.
    try {
      recognition.stop();
    } catch {
      // Already stopped — nothing to do. Without this the exception aborts
      // the caller's click handler and the mic looks stuck ON.
    }
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
  let autoSendAudioCtx = null;

  // Reuse one AudioContext — creating it per send leaks contexts and can
  // hit the browser's limit after repeated auto-sends.
  const playAutoSendBeep = () => {
    try {
      autoSendAudioCtx = autoSendAudioCtx ||
        new (window.AudioContext || window.webkitAudioContext)();
      const ctx = autoSendAudioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
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
  };

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
      playAutoSendBeep();
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
    // Clear CSS right/bottom fallback so left/top take effect.
    floatingButtonContainer.style.right = 'auto';
    floatingButtonContainer.style.bottom = 'auto';
    floatingButtonContainer.style.left = `${x}px`;
    floatingButtonContainer.style.top = `${y}px`;
    setState({floatingButtonX: x, floatingButtonY: y});
  };

  // True when the element at (x, y) is fully outside the current viewport.
  const isOffscreen = (x, y, width, height) =>
    x + width < 0 || y + height < 0 || x > window.innerWidth || y > window.innerHeight;

  // Clamp a position so the element stays fully inside the viewport.
  const clampToViewport = (x, y, width, height) => ({
    x: Math.max(0, Math.min(x, Math.max(0, window.innerWidth - width))),
    y: Math.max(0, Math.min(y, Math.max(0, window.innerHeight - height))),
  });

  // Old storage may hold non-numeric leftovers (e.g. "500px" strings or
  // null) — NaN makes style.left an invalid value and the element falls
  // back to its static position on the left edge. Normalize first.
  const parsePos = (v) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : undefined;
  };

  // Default placement for the very first run (no saved position): center
  // of the viewport. `shiftX` places an element to the left of its
  // neighbour so the controls sit side by side.
  const getDefaultAnchoredPosition = (width, height, shiftX = 0) => {
    const x = (window.innerWidth - width) / 2 - shiftX;
    const y = (window.innerHeight - height) / 2;
    return clampToViewport(x, y, width, height);
  };

  // Mic defaults to the left of the panel (panel width is unknown until
  // initPanel runs), so initFloatingButtonPosition is invoked after it.
  const initFloatingButtonPosition = () => {
    try {
      const {floatingButtonX, floatingButtonY} = getState();
      const savedX = parsePos(floatingButtonX);
      const savedY = parsePos(floatingButtonY);
      const w = floatingButtonContainer.offsetWidth;
      const h = floatingButtonContainer.offsetHeight;
      const shiftX = container.offsetWidth + 8;
      const target = (savedX === undefined || savedY === undefined ||
          isOffscreen(savedX, savedY, w, h))
        ? getDefaultAnchoredPosition(w, h, shiftX)
        : clampToViewport(savedX, savedY, w, h);
      // left/top are written together with clearing right/bottom inside
      // updateFloatingButtonPosition; if this throws, the CSS fallback
      // keeps the mic in the bottom-right corner.
      updateFloatingButtonPosition(target.x, target.y);
    } catch (e) {
      console.warn('[VoiceToText] Mic init failed, using CSS fallback:', e);
    }
  };

  // Always use custom mode - allow dragging to any position
  const initPanel = () => {
    try {
      const { panelX, panelY, isPanelMinimized } = getState();

      const w = container.offsetWidth;
      const h = container.offsetHeight;
      const savedX = parsePos(panelX);
      const savedY = parsePos(panelY);

      let target;
      let shouldSave = false;
      if (savedX === undefined || savedY === undefined ||
          isOffscreen(savedX, savedY, w, h)) {
        target = getDefaultAnchoredPosition(w, h);
        shouldSave = true;
      } else {
        target = clampToViewport(savedX, savedY, w, h);
        shouldSave = target.x !== panelX || target.y !== panelY;
      }

      // Write left/top together with clearing right/bottom. If anything
      // above throws, the CSS default keeps the panel in the bottom-right
      // corner instead of falling back to the static position (left edge).
      container.style.left = `${target.x}px`;
      container.style.top = `${target.y}px`;
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.classList.add('position-custom', 'draggable');

      // setState notifies subscribers — run it last and never let a
      // listener failure leave the panel unpositioned.
      try {
        if (shouldSave) setState({ panelX: target.x, panelY: target.y });
      } catch (e) {
        console.warn('[VoiceToText] Failed to persist panel position:', e);
      }

      // Restore minimized state
      if (isPanelMinimized) {
        container.classList.add('minimized');
      }
      updateToggleArrow();
    } catch (e) {
      console.warn('[VoiceToText] Panel init failed, using CSS fallback:', e);
    }
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
        case 'openSettings':
          openModal();
          sendResponse({ success: true });
          return true;
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
      floatingButtonContainer.style.right = 'auto';
      floatingButtonContainer.style.bottom = 'auto';
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
  // Mic sits left of the panel — needs the panel width measured first.
  initFloatingButtonPosition();

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
    // Keep in sync with applyTheme() in modal.js — same namespaced attribute.
    modal.setAttribute('data-vtt-theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-vtt-theme', isDark ? 'dark' : 'light');
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
    // shouldAutoRestart stays true while a network retry is pending — treat
    // the session as active so a click during the backoff still stops the mic.
    if (isRecognitionRunning || shouldAutoRestart) {
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
          // Extension was reloaded/updated — this content script is dead.
          // Reload so the user gets the fresh one instead of a broken mic.
          if (String(error).includes('Extension context invalidated')) {
            location.reload();
            return;
          }
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
        if (error && error.name === 'InvalidStateError') {
          // start() raced with a recognizer that is still stopping — force it
          // to end and let onend perform the restart instead of dropping the
          // click.
          shouldAutoRestart = true;
          setState({isListening: true});
          floatingMicButton.style.backgroundImage = MIC_IMG_ON_URL;
          try {
            recognition.stop();
          } catch {
            // Already stopped — onend either ran or won't; nothing to restart.
          }
          return;
        }
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
      if (error && error.name === 'InvalidStateError') {
        // Recognizer still stopping — force it to end; onend restarts it while
        // the key stays held (isPushToTalkActive remains true, so release still
        // stops the session via stopPushToTalk).
        shouldAutoRestart = true;
        setState({isListening: true});
        floatingMicButton.style.backgroundImage = MIC_IMG_ON_URL;
        floatingMicButton.classList.add('ptt-active');
        try {
          recognition.stop();
        } catch {
          // Already stopped — nothing to restart.
        }
        return;
      }
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
    try {
      recognition.stop();
    } catch {
      // Already stopped.
    }
    isRecognitionRunning = false;
    stopSilenceCountdown();
    setState({isListening: false});
    floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
    floatingMicButton.classList.remove('ptt-active');
  };

  // Voice punctuation command mappings per language.
  // English commands are merged into every language so they always work.
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
      'запятая': ',', 'точка': '.', 'вопросительный знак': '?',
      'восклицательный знак': '!',
      'новая строка': '\n', 'новый абзац': '\n', 'абзац': '\n',
      'точка с запятой': ';', 'двоеточие': ':', 'тире': '—', 'дефис': '-',
      'открывающая скобка': '(', 'закрывающая скобка': ')',
      'открыть скобку': '(', 'закрыть скобку': ')',
      'кавычки': '"', 'кавычка': '"',
    },
    uk: {
      'кома': ',', 'крапка': '.', 'знак питання': '?', 'знак оклику': '!',
      'новий рядок': '\n', 'крапка з комою': ';', 'двокрапка': ':',
      'тире': '—', 'дефіс': '-',
    },
    es: {
      'coma': ',', 'punto': '.', 'signo de interrogación': '?',
      'signo de exclamación': '!', 'nueva línea': '\n',
      'punto y coma': ';', 'dos puntos': ':', 'guión': '—',
      'abre paréntesis': '(', 'cierra paréntesis': ')',
    },
    fr: {
      'virgule': ',', 'point': '.', "point d'interrogation": '?',
      "point d'exclamation": '!', 'nouvelle ligne': '\n',
      'point-virgule': ';', 'deux points': ':', 'tiret': '—',
      'ouvrez parenthèse': '(', 'fermez parenthèse': ')',
    },
    pt: {
      'vírgula': ',', 'ponto': '.', 'ponto de interrogação': '?',
      'ponto de exclamação': '!', 'nova linha': '\n',
      'ponto e vírgula': ';', 'dois pontos': ':', 'traço': '—',
      'abre parêntese': '(', 'fecha parêntese': ')',
    },
    de: {
      'komma': ',', 'punkt': '.', 'fragezeichen': '?',
      'ausrufezeichen': '!', 'neue zeile': '\n',
      'semikolon': ';', 'doppelpunkt': ':', 'bindestrich': '-', 'gedankenstrich': '—',
      'klammer auf': '(', 'klammer zu': ')',
    },
    it: {
      'virgola': ',', 'punto': '.', 'punto interrogativo': '?',
      'punto esclamativo': '!', 'nuova riga': '\n', 'a capo': '\n',
      'punto e virgola': ';', 'due punti': ':', 'trattino': '—',
      'apri parentesi': '(', 'chiudi parentesi': ')',
    },
    nl: {
      'komma': ',', 'punt': '.', 'vraagteken': '?', 'uitroepteken': '!',
      'nieuwe regel': '\n', 'puntkomma': ';', 'dubbele punt': ':',
      'koppelteken': '-', 'gedachtestreep': '—',
      'haakje openen': '(', 'haakje sluiten': ')',
    },
    pl: {
      'przecinek': ',', 'kropka': '.', 'znak zapytania': '?', 'pytajnik': '?',
      'wykrzyknik': '!', 'nowa linia': '\n', 'nowy wiersz': '\n',
      'średnik': ';', 'dwukropek': ':', 'myślnik': '—',
      'otwórz nawias': '(', 'zamknij nawias': ')',
    },
    tr: {
      'virgül': ',', 'nokta': '.', 'soru işareti': '?', 'ünlem': '!', 'ünlem işareti': '!',
      'yeni satır': '\n', 'noktalı virgül': ';', 'iki nokta': ':', 'tire': '—',
      'parantez aç': '(', 'parantez kapat': ')',
    },
    sv: {
      'komma': ',', 'punkt': '.', 'frågetecken': '?', 'utropstecken': '!',
      'ny rad': '\n', 'semikolon': ';', 'kolon': ':', 'bindestreck': '-',
      'vänsterparentes': '(', 'högerparentes': ')',
    },
    no: {
      'komma': ',', 'punktum': '.', 'spørsmålstegn': '?', 'utropstegn': '!',
      'ny linje': '\n', 'semikolon': ';', 'kolon': ':', 'tankestrek': '—',
      'åpne parentes': '(', 'lukk parentes': ')',
    },
    da: {
      'komma': ',', 'punktum': '.', 'spørgsmålstegn': '?', 'udråbstegn': '!',
      'ny linje': '\n', 'semikolon': ';', 'kolon': ':', 'tankestreg': '—',
    },
    fi: {
      'pilkku': ',', 'piste': '.', 'kysymysmerkki': '?', 'huutomerkki': '!',
      'uusi rivi': '\n', 'puolipiste': ';', 'kaksoispiste': ':', 'ajatusviiva': '—',
    },
    cs: {
      'čárka': ',', 'tečka': '.', 'otazník': '?', 'vykřičník': '!',
      'nový řádek': '\n', 'středník': ';', 'dvojtečka': ':', 'pomlčka': '—',
      'otevřít závorku': '(', 'zavřít závorku': ')',
    },
    sk: {
      'čiarka': ',', 'bodka': '.', 'otáznik': '?', 'výkričník': '!',
      'nový riadok': '\n', 'bodkočiarka': ';', 'dvojbodka': ':', 'pomlčka': '—',
    },
    hr: {
      'zarez': ',', 'točka': '.', 'upitnik': '?', 'uskličnik': '!',
      'novi red': '\n', 'točka zarez': ';', 'dvotočje': ':', 'crtica': '—',
    },
    sl: {
      'vejica': ',', 'pika': '.', 'vprašaj': '?', 'klicaj': '!',
      'nova vrstica': '\n', 'podpičje': ';', 'dvopičje': ':', 'pomišljaj': '—',
    },
    ro: {
      'virgulă': ',', 'punct': '.', 'semnul întrebării': '?', 'semnul exclamării': '!',
      'linie nouă': '\n', 'rând nou': '\n', 'punct și virgulă': ';', 'două puncte': ':',
    },
    bg: {
      'запетая': ',', 'точка': '.', 'въпросителен знак': '?', 'въпросителна': '?',
      'удивителен знак': '!', 'удивителна': '!',
      'нов ред': '\n', 'точка и запетая': ';', 'двоеточие': ':', 'тире': '—',
    },
    el: {
      'κόμμα': ',', 'τελεία': '.', 'ερωτηματικό': ';', 'θαυμαστικό': '!',
      'νέα γραμμή': '\n', 'άνω κάτω τελεία': ':', 'παύλα': '—',
    },
    he: {
      'פסיק': ',', 'נקודה': '.', 'סימן שאלה': '?', 'סימן קריאה': '!',
      'שורה חדשה': '\n', 'נקודה פסיק': ';', 'נקודתיים': ':', 'מקף': '-',
    },
    ar: {
      'فاصلة': '،', 'نقطة': '.', 'علامة استفهام': '؟', 'علامة تعجب': '!',
      'سطر جديد': '\n', 'فاصلة منقوطة': '؛', 'نقطتان': ':', 'شرطة': '—',
    },
    hi: {
      'अल्पविराम': ',', 'कॉमा': ',', 'पूर्ण विराम': '.', 'बिंदु': '.',
      'प्रश्न चिह्न': '?', 'विस्मयादिबोधक चिह्न': '!',
      'नई पंक्ति': '\n', 'अर्धविराम': ';', 'दो बिंदु': ':', 'डैश': '—',
    },
    ja: {
      'かんま': '、', 'カンマ': '、', 'くてん': '、', '読点': '、',
      'ぴりおど': '。', 'ピリオド': '。', 'まる': '。', '句点': '。',
      'はてな': '？', 'はてなまーく': '？', 'クエスチョンマーク': '？',
      'びっくりまーく': '！', 'かんたんふ': '！', '感嘆符': '！',
      'かいぎょう': '\n', '改行': '\n',
    },
    ko: {
      '쉼표': ',', '콤마': ',', '마침표': '.', '온점': '.',
      '물음표': '?', '느낌표': '!', '줄바꿈': '\n', '새 줄': '\n',
      '세미콜론': ';', '콜론': ':', '하이픈': '-', '대시': '—',
      '여는 괄호': '(', '닫는 괄호': ')',
    },
    zh: {
      '逗号': '，', '句号': '。', '问号': '？', '感叹号': '！', '叹号': '！',
      '换行': '\n', '分号': '；', '冒号': '：', '破折号': '—',
      '左括号': '（', '右括号': '）',
    },
    vi: {
      'dấu phẩy': ',', 'dấu chấm': '.', 'dấu hỏi': '?', 'dấu chấm hỏi': '?',
      'dấu chấm than': '!', 'dòng mới': '\n', 'xuống dòng': '\n',
      'dấu chấm phẩy': ';', 'dấu hai chấm': ':', 'dấu gạch ngang': '-',
    },
    th: {
      'จุลภาค': ',', 'มหัพภาค': ',', 'จุด': '.', 'เครื่องหมายคำถาม': '?',
      'เครื่องหมายอัศเจรีย์': '!', 'บรรทัดใหม่': '\n', 'ขึ้นบรรทัดใหม่': '\n',
      'อัฒภาค': ';', 'จุดคู่': ':',
    },
    id: {
      'koma': ',', 'titik': '.', 'tanda tanya': '?', 'tanda seru': '!',
      'baris baru': '\n', 'titik koma': ';', 'titik dua': ':', 'tanda hubung': '-',
    },
    ms: {
      'koma': ',', 'noktah': '.', 'tanda soal': '?', 'tanda seru': '!',
      'baris baru': '\n', 'koma bertitik': ';', 'titik bertindih': ':',
    },
    ca: {
      'coma': ',', 'punt': '.', "signe d'interrogació": '?', 'interrogant': '?',
      "signe d'exclamació": '!', 'exclamació': '!', 'nova línia': '\n',
      'punt i coma': ';', 'dos punts': ':', 'guió': '—',
    },
    gl: {
      'coma': ',', 'punto': '.', 'nova liña': '\n',
      'punto e coma': ';', 'dous puntos': ':',
    },
    fil: {
      'kuwit': ',', 'tuldok': '.', 'tandang pananong': '?',
      'tandang pandamdam': '!', 'bagong linya': '\n',
    },
  };

  // Languages whose script has no spaces between words — substring
  // replacement is used instead of word-boundary matching.
  const NO_WORD_BOUNDARY_LANGS = new Set(['zh', 'ja', 'th', 'lo', 'km', 'my']);

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // \b only understands ASCII — wrap with Unicode letter/number boundaries
  // so Cyrillic, Hangul, Arabic, Devanagari etc. commands also match.
  const withBoundary = (inner, useBoundary) => useBoundary
    ? `(?<![\\p{L}\\p{N}])${inner}(?![\\p{L}\\p{N}])`
    : inner;

  // Compiled regex caches — onresult fires several times per second, so
  // rebuilding ~20 RegExp objects on every result is wasteful.
  let punctCacheKey = null;
  let punctCacheEntries = [];
  let replCacheKey = null;
  let replCacheEntries = [];

  const getPunctuationEntries = (lang, useBoundary) => {
    const key = `${lang}|${useBoundary}`;
    if (key !== punctCacheKey) {
      // English commands always work; the dictation language adds its own.
      const map = {...PUNCTUATION_MAP.en, ...(PUNCTUATION_MAP[lang] || {})};
      punctCacheEntries = Object.entries(map)
        .sort((a, b) => b[0].length - a[0].length)
        .map(([command, punct]) => [
          new RegExp(withBoundary(escapeRegExp(command), useBoundary), 'giu'),
          punct,
        ]);
      punctCacheKey = key;
    }
    return punctCacheEntries;
  };

  const getReplacementEntries = (lang, useBoundary) => {
    const replacements = getState().wordReplacements || [];
    const key = `${lang}|${useBoundary}|${JSON.stringify(replacements)}`;
    if (key !== replCacheKey) {
      replCacheEntries = replacements
        .filter(rep => (rep.from || '').trim() && rep.to != null && rep.to !== '')
        .map(rep => [
          new RegExp(
            withBoundary(escapeRegExp(rep.from.trim()).replace(/\s+/g, '\\s+'), useBoundary),
            'giu'
          ),
          rep.to,
        ]);
      replCacheKey = key;
    }
    return replCacheEntries;
  };

  // Apply voice punctuation commands and word replacements to a transcript fragment.
  const processTranscript = (text) => {
    let result = text;

    const lang = (getState().recognitionLanguage || 'en-US').split('-')[0];
    const useBoundary = !NO_WORD_BOUNDARY_LANGS.has(lang);

    // Voice punctuation: replace spoken commands with punctuation marks.
    if (Boolean(getState().isVoicePunctuationEnabled)) {
      for (const [re, punct] of getPunctuationEntries(lang, useBoundary)) {
        result = result.replace(re, punct);
      }
      // Tidy spacing around the inserted marks: no space before closing
      // punctuation, none after opening brackets, none around newlines.
      result = result
        .replace(/\s+([,.!?;:)\]}»”…，。、！？；：؟؛،])/g, '$1')
        .replace(/([(\[{«“（])\s+/g, '$1')
        .replace(/ *\n */g, '\n');
    }

    // Word replacements: left side → right side, case-insensitive, with
    // flexible whitespace inside the "from" phrase and Unicode boundaries
    // so it works in any language, not just Latin scripts.
    // Function replacer keeps "$" and other chars in "to" literal.
    for (const [re, to] of getReplacementEntries(lang, useBoundary)) {
      result = result.replace(re, () => to);
    }

    return result;
  };

  recognition.onresult = (event) => {
    // Pick up manual edits made between speech results
    const currentValue = readInputValue();
    const expectedValue = [baseTranscript, finalTranscript, interimTranscript]
      .filter(Boolean)
      .reduce(joinTranscriptParts, '');
    if (currentValue !== expectedValue && isRecognitionRunning) {
      rebaseTranscriptsFromCurrentInput();
    }

    let finalTranscriptFragment = '';
    let newInterimTranscript = '';
    const startIndex = Math.max(event.resultIndex, lastFinalResultIndex + 1);
    for (let i = startIndex; i < event.results.length; ++i) {
      const transcript = processTranscript(event.results[i][0].transcript.trim());
      if (event.results[i].isFinal) {
        finalTranscriptFragment = joinTranscriptParts(finalTranscriptFragment, transcript);
        lastFinalResultIndex = Math.max(lastFinalResultIndex, i);
      } else {
        newInterimTranscript = joinTranscriptParts(newInterimTranscript, transcript);
      }
    }
    finalTranscript = joinTranscriptParts(finalTranscript, finalTranscriptFragment);
    interimTranscript = newInterimTranscript;
    applyTranscriptsToInput();
    startSilenceCountdown();
  };

  recognition.onerror = (event) => {
    const nonCriticalErrors = ['no-speech', 'aborted'];
    const permissionErrors = ['audio-capture', 'not-allowed', 'service-not-allowed'];

    if (nonCriticalErrors.includes(event.error)) {
      // Expected when user is silent or manually stops — no visual error state
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

    if (event.error === 'network') {
      // The speech service was unreachable — usually a transient connectivity
      // or service hiccup. Keep the session alive; onend retries with backoff.
      networkRetryCount += 1;
      console.warn(`Speech recognition network error (retry ${networkRetryCount}/${NETWORK_RETRY_MAX_ATTEMPTS})`);
      isRecognitionRunning = false;
      stopSilenceCountdown();
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
    if (!shouldAutoRestart) {
      floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
      setState({isListening: false});
      return;
    }
    if (networkRetryCount > NETWORK_RETRY_MAX_ATTEMPTS) {
      // Service stayed unreachable through all retries — give up.
      console.error('Speech recognition unreachable, giving up after retries');
      shouldAutoRestart = false;
      networkRetryCount = 0;
      setState({isListening: false});
      floatingMicButton.style.backgroundImage = MIC_IMG_ERR_URL;
      setTimeout(() => {
        if (!getState().isListening) {
          floatingMicButton.style.backgroundImage = MIC_IMG_OFF_URL;
        }
      }, 1000);
      return;
    }
    const delay = networkRetryCount > 0
      ? Math.min(NETWORK_RETRY_BASE_DELAY_MS * 2 ** (networkRetryCount - 1), NETWORK_RETRY_MAX_DELAY_MS)
      : 0;
    networkRetryTimer = setTimeout(() => {
      networkRetryTimer = null;
      if (!shouldAutoRestart || isRecognitionRunning) {
        return;
      }
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
    }, delay);
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
        try {
          recognition.stop();
        } catch {
          // Already stopped — onstart of the next run applies the new lang.
        }
      } else {
        recognition.lang = selectedLanguage;
      }
    }
  });

  recognition.onstart = () => {
    shouldAutoRestart = true;
    // A successful start proves the service is reachable — clear backoff state.
    networkRetryCount = 0;
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
    if (!floatingButtonContainer) return;
    const containerRect = floatingButtonContainer.getBoundingClientRect();

    const outOfBounds = containerRect.left < 0 || containerRect.top < 0 ||
      containerRect.right > window.innerWidth || containerRect.bottom > window.innerHeight;
    if (!outOfBounds) return;

    // Clear the CSS right/bottom fallback before writing left/top so the
    // element doesn't stretch across both edges.
    floatingButtonContainer.style.right = 'auto';
    floatingButtonContainer.style.bottom = 'auto';

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

    const outOfBounds = panelRect.right > w || panelRect.bottom > h ||
      panelRect.left < 0 || panelRect.top < 0;
    if (!outOfBounds) return;

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

  // Safety net: if layout wasn't ready during init (zero offsetWidth,
  // delayed CSS, etc.) the elements may still lack left/top. Re-run once
  // the page finishes loading so they never get stuck on the left edge.
  // Declared after checkPanelPosition/checkButtonPosition to avoid TDZ.
  const ensureControlsPositioned = () => {
    if (!container.style.left) initPanel();
    if (!floatingButtonContainer.style.left) initFloatingButtonPosition();
    checkPanelPosition();
    checkButtonPosition();
  };
  if (document.readyState === 'complete') {
    requestAnimationFrame(ensureControlsPositioned);
  } else {
    window.addEventListener('load', ensureControlsPositioned, { once: true });
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
