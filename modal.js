import {getState, setState} from './state.js';
import {t} from './i18n.js';
import {getChangelog, CURRENT_VERSION} from './changelog.js';

const loadCSS = (url) => {
  const existingLink = document.querySelector(`link[href="${url}"]`);
  if (existingLink) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = url;
  document.head.appendChild(link);
};

loadCSS(chrome.runtime.getURL('styles.css'));

export const createModal = () => {
  const modal = document.createElement('div');
  modal.classList.add('modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', t('modalLabel'));
  return modal;
};

export const createModalOverlay = () => {
  const modalOverlay = document.createElement('div');
  modalOverlay.classList.add('modal-overlay');
  return modalOverlay;
};

export const setupModal = async (modal, favoriteLanguages, updateLanguageSelector, container, updateFloatingButtonPosition, floatingButtonContainer) => {
  const state = getState();

  // Small ⓘ icon that reveals a hint on hover or click — keeps the settings
  // compact instead of stacking permanent hint blocks under every option.
  const createHintIcon = (text) => {
    const icon = document.createElement('span');
    icon.classList.add('hint-icon');
    icon.textContent = 'ⓘ';
    icon.setAttribute('role', 'button');
    icon.setAttribute('aria-label', 'Info');
    icon.setAttribute('tabindex', '0');
    const tip = document.createElement('span');
    tip.classList.add('hint-tooltip');
    tip.textContent = text;
    icon.appendChild(tip);
    // preventDefault stops a wrapping <label> from toggling its checkbox.
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      tip.classList.toggle('show');
    });
    return icon;
  };

  const makeLabelText = (text, hint) => {
    const span = document.createElement('span');
    span.classList.add('label-text-with-hint');
    span.textContent = text;
    if (hint) {
      span.appendChild(createHintIcon(hint));
    }
    return span;
  };
  // column container
  const columnsContainer = document.createElement('div');
  columnsContainer.classList.add('columns');

  // first column
  const languageContainer = document.createElement('div');
  languageContainer.classList.add('column', 'language-container', 'settings-card');

  const languageListInfo = document.createElement('div');
  languageListInfo.textContent = t('selectFavoriteLanguages');
  languageListInfo.classList.add('language-list-info');

  // Search input — filters the language list as the user types.
  const languageSearch = document.createElement('input');
  languageSearch.type = 'search';
  languageSearch.placeholder = t('searchLanguages') || 'Search languages...';
  languageSearch.classList.add('language-search');
  languageSearch.setAttribute('aria-label', t('searchLanguages') || 'Search languages');

  const languageActionsRow = document.createElement('div');
  languageActionsRow.classList.add('language-actions-row');

  const selectAllButton = document.createElement('button');
  selectAllButton.textContent = t('selectAll');
  selectAllButton.classList.add('select-all-button');

  const deselectAllButton = document.createElement('button');
  deselectAllButton.textContent = t('deselectAll');
  deselectAllButton.classList.add('deselect-all-button');

  languageActionsRow.appendChild(selectAllButton);
  languageActionsRow.appendChild(deselectAllButton);

  const languageList = document.createElement('div');
  languageList.classList.add('language-list');

  const saveFavoriteLanguagesFunction = () => {
    const newFavoriteLanguages = Array.from(languageList.querySelectorAll('input:checked')).map(input => input.value);
    setState({favoriteLanguages: newFavoriteLanguages});
  };

  const {languages} = await import(chrome.runtime.getURL('languages.js'));

  // Build all language items once, then show/hide based on search filter.
  const languageItems = [];
  languages.forEach(lang => {
    const label = document.createElement('label');
    label.classList.add('language-item');
    label.dataset.name = lang.name.toLowerCase();
    label.dataset.code = lang.code.toLowerCase();
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = lang.code;
    checkbox.checked = state.favoriteLanguages.includes(lang.code);
    checkbox.onclick = saveFavoriteLanguagesFunction;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(lang.name));
    languageItems.push(label);
    languageList.appendChild(label);
  });

  // Filter languages by search query — matches name or code.
  const filterLanguages = (query) => {
    const q = query.trim().toLowerCase();
    languageItems.forEach(item => {
      const matches = !q || item.dataset.name.includes(q) || item.dataset.code.includes(q);
      item.style.display = matches ? '' : 'none';
    });
  };

  languageSearch.addEventListener('input', () => filterLanguages(languageSearch.value));

  languageContainer.appendChild(languageListInfo);
  languageContainer.appendChild(languageSearch);
  languageContainer.appendChild(languageActionsRow);
  languageContainer.appendChild(languageList);

  selectAllButton.addEventListener('click', () => {
    // Only select visible (filtered) items so hidden ones are not affected.
    languageList.querySelectorAll('label:not([style*="display: none"]) input').forEach(checkbox => {
      checkbox.checked = true;
    });
    saveFavoriteLanguagesFunction();
  });

  deselectAllButton.addEventListener('click', () => {
    languageList.querySelectorAll('label:not([style*="display: none"]) input').forEach(checkbox => {
      checkbox.checked = false;
    });
    saveFavoriteLanguagesFunction();
  });

  columnsContainer.appendChild(languageContainer);

  // second column
  const settingsContainer = document.createElement('div');
  settingsContainer.classList.add('column');

  const widthSliderContainer = document.createElement('div');
  widthSliderContainer.classList.add('width-slider-container', 'settings-card');

  // A <label> would forward clicks to its first labelable descendant —
  // which would be the reset button, not the slider — so use a div here.
  const widthSliderLabel = document.createElement('div');
  widthSliderLabel.classList.add('width-slider-label');
  widthSliderLabel.appendChild(makeLabelText(t('adjustContentWidth'), t('contentWidthHint')));

  const widthSliderValue = document.createElement('span');
  widthSliderValue.classList.add('width-slider-value');
  widthSliderValue.textContent = `${state.contentWidth}%`;

  const widthSlider = document.createElement('input');
  widthSlider.type = 'range';
  widthSlider.id = 'contentWidthSlider';
  widthSlider.min = '100';
  widthSlider.max = '300';
  widthSlider.step = '5';
  widthSlider.value = state.contentWidth;

  // Restores the default 100% width. Reuses the slider's own 'input' event
  // so the rollback goes through the same path as a manual drag: the
  // override is removed and 100 is persisted.
  const widthResetButton = document.createElement('button');
  widthResetButton.type = 'button';
  widthResetButton.classList.add('width-reset-button');
  widthResetButton.textContent = t('resetWidth');
  widthResetButton.addEventListener('click', () => {
    widthSlider.value = '100';
    widthSlider.dispatchEvent(new Event('input', {bubbles: true}));
  });

  const widthSliderLabelRight = document.createElement('span');
  widthSliderLabelRight.classList.add('width-slider-label-right');
  widthSliderLabelRight.appendChild(widthSliderValue);
  widthSliderLabelRight.appendChild(widthResetButton);
  widthSliderLabel.appendChild(widthSliderLabelRight);

  widthSliderContainer.appendChild(widthSliderLabel);
  widthSliderContainer.appendChild(widthSlider);
  settingsContainer.appendChild(widthSliderContainer);

  widthSlider.addEventListener('input', () => {
    widthSliderValue.textContent = `${widthSlider.value}%`;
  });

  const autoSendOnSilenceContainer = document.createElement('div');
  autoSendOnSilenceContainer.classList.add('silence-autosend-container', 'settings-card');

  const autoSendOnSilenceRow = document.createElement('div');
  autoSendOnSilenceRow.classList.add('silence-autosend-row');

  const autoSendOnSilenceInfo = document.createElement('label');
  autoSendOnSilenceInfo.classList.add('autogeneration-info');
  autoSendOnSilenceInfo.appendChild(makeLabelText(t('autoSendOnSilence'),
    `${t('autoSendBeta')}\n\n${t('autoSendHint')}`));

  const autoSendOnSilenceCheckbox = document.createElement('input');
  autoSendOnSilenceCheckbox.type = 'checkbox';
  autoSendOnSilenceCheckbox.id = 'autoSendOnSilenceCheckbox';
  autoSendOnSilenceCheckbox.checked = Boolean(state.isAutoSendOnSilenceEnabled);
  const autoSendControl = document.createElement('span');
  autoSendControl.classList.add('control-group');
  autoSendControl.appendChild(autoSendOnSilenceCheckbox);
  autoSendOnSilenceInfo.appendChild(autoSendControl);

  const autoSendOnSilenceDelayControl = document.createElement('div');
  autoSendOnSilenceDelayControl.classList.add('silence-delay-control');

  const autoSendOnSilenceDelaySlider = document.createElement('input');
  autoSendOnSilenceDelaySlider.type = 'range';
  autoSendOnSilenceDelaySlider.id = 'autoSendOnSilenceDelaySlider';
  autoSendOnSilenceDelaySlider.min = '2';
  autoSendOnSilenceDelaySlider.max = '30';
  autoSendOnSilenceDelaySlider.step = '1';
  autoSendOnSilenceDelaySlider.value = String(Number(state.autoSendSilenceDelaySec) || 10);

  const autoSendOnSilenceDelayValue = document.createElement('span');
  autoSendOnSilenceDelayValue.classList.add('silence-delay-value');

  const autoSendOnSilenceWarning = document.createElement('div');
  autoSendOnSilenceWarning.classList.add('silence-delay-warning', 'setting-hint', 'warning');
  autoSendOnSilenceWarning.textContent = t('autoSendWarning');

  const getNormalizedDelay = (rawDelay) => {
    const parsedDelay = Number(rawDelay);
    if (!Number.isFinite(parsedDelay)) {
      return 10;
    }
    return Math.min(30, Math.max(2, Math.round(parsedDelay)));
  };

  const renderAutoSendOnSilenceDelay = () => {
    const delaySec = getNormalizedDelay(autoSendOnSilenceDelaySlider.value);
    autoSendOnSilenceDelaySlider.value = String(delaySec);
    autoSendOnSilenceDelayValue.textContent = `${delaySec}s`;
    const showWarning = autoSendOnSilenceCheckbox.checked && delaySec >= 20;
    autoSendOnSilenceWarning.classList.toggle('show', showWarning);
    autoSendOnSilenceDelaySlider.disabled = !autoSendOnSilenceCheckbox.checked;
    autoSendOnSilenceDelayValue.classList.toggle('disabled', !autoSendOnSilenceCheckbox.checked);
  };

  autoSendOnSilenceCheckbox.addEventListener('change', () => {
    setState({isAutoSendOnSilenceEnabled: autoSendOnSilenceCheckbox.checked});
    renderAutoSendOnSilenceDelay();
  });

  autoSendOnSilenceDelaySlider.addEventListener('input', () => {
    const delaySec = getNormalizedDelay(autoSendOnSilenceDelaySlider.value);
    setState({autoSendSilenceDelaySec: delaySec});
    renderAutoSendOnSilenceDelay();
  });

  autoSendOnSilenceDelayControl.appendChild(autoSendOnSilenceDelaySlider);
  autoSendOnSilenceDelayControl.appendChild(autoSendOnSilenceDelayValue);
  autoSendOnSilenceRow.appendChild(autoSendOnSilenceInfo);
  autoSendOnSilenceRow.appendChild(autoSendOnSilenceDelayControl);
  autoSendOnSilenceContainer.appendChild(autoSendOnSilenceRow);
  autoSendOnSilenceContainer.appendChild(autoSendOnSilenceWarning);

  // Keep microphone on after auto-send — allows continuous dictation.
  const keepMicOnRow = document.createElement('div');
  keepMicOnRow.classList.add('silence-autosend-row', 'keep-mic-on-row');

  const keepMicOnLabel = document.createElement('label');
  keepMicOnLabel.classList.add('autogeneration-info');
  keepMicOnLabel.appendChild(makeLabelText(t('keepMicOnAfterAutoSend'), t('keepMicOnAfterAutoSendHint')));

  const keepMicOnCheckbox = document.createElement('input');
  keepMicOnCheckbox.type = 'checkbox';
  keepMicOnCheckbox.id = 'keepMicOnCheckbox';
  keepMicOnCheckbox.checked = Boolean(state.keepMicOnAfterAutoSend);
  const keepMicOnControl = document.createElement('span');
  keepMicOnControl.classList.add('control-group');
  keepMicOnControl.appendChild(keepMicOnCheckbox);
  keepMicOnLabel.appendChild(keepMicOnControl);

  keepMicOnCheckbox.addEventListener('change', () => {
    setState({keepMicOnAfterAutoSend: keepMicOnCheckbox.checked});
  });

  keepMicOnRow.appendChild(keepMicOnLabel);
  autoSendOnSilenceContainer.appendChild(keepMicOnRow);

  // Sound on auto-send option
  const soundRow = document.createElement('div');
  soundRow.classList.add('silence-autosend-row', 'sound-row');

  const soundLabel = document.createElement('label');
  soundLabel.classList.add('autogeneration-info');
  soundLabel.appendChild(makeLabelText(t('soundOnAutoSend'), t('soundOnAutoSendHint')));

  const soundCheckbox = document.createElement('input');
  soundCheckbox.type = 'checkbox';
  soundCheckbox.id = 'soundOnAutoSendCheckbox';
  soundCheckbox.checked = Boolean(state.soundOnAutoSend);
  const soundControl = document.createElement('span');
  soundControl.classList.add('control-group');
  soundControl.appendChild(soundCheckbox);
  soundLabel.appendChild(soundControl);

  soundCheckbox.addEventListener('change', () => {
    setState({soundOnAutoSend: soundCheckbox.checked});
  });

  soundRow.appendChild(soundLabel);
  autoSendOnSilenceContainer.appendChild(soundRow);
  settingsContainer.appendChild(autoSendOnSilenceContainer);
  renderAutoSendOnSilenceDelay();

  const pttContainer = document.createElement('div');
  pttContainer.classList.add('silence-autosend-container', 'ptt-container', 'settings-card');

  const pttRow = document.createElement('div');
  pttRow.classList.add('silence-autosend-row');

  const pttInfo = document.createElement('label');
  pttInfo.classList.add('autogeneration-info');
  pttInfo.appendChild(makeLabelText(t('pushToTalk'), t('pushToTalkHint')));

  const pttCheckbox = document.createElement('input');
  pttCheckbox.type = 'checkbox';
  pttCheckbox.id = 'pttCheckbox';
  pttCheckbox.checked = Boolean(state.isPushToTalkEnabled);
  const pttControl = document.createElement('span');
  pttControl.classList.add('control-group');
  pttControl.appendChild(pttCheckbox);
  pttInfo.appendChild(pttControl);

  const pttKeyControl = document.createElement('div');
  pttKeyControl.classList.add('silence-delay-control');

  const pttComboSelect = document.createElement('select');
  pttComboSelect.classList.add('ptt-key-select');
  const isMac = () => {
    const pf = navigator.platform || '';
    const ua = navigator.userAgent || '';
    return pf.toUpperCase().includes('MAC') || ua.toUpperCase().includes('MAC');
  };
  const altLabel = isMac() ? 'Option' : 'Alt';
  const pttComboOptions = [
    {value: 'Control+Shift', text: 'Ctrl+Shift'},
    {value: 'Alt+Shift', text: `${altLabel}+Shift`},
    {value: 'Control+Alt', text: `Ctrl+${altLabel}`},
    {value: 'Shift+Alt', text: `Shift+${altLabel}`},
    {value: 'Alt', text: altLabel},
    {value: 'Control', text: 'Ctrl'},
  ];
  pttComboOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.text;
    pttComboSelect.appendChild(option);
  });
  pttComboSelect.value = state.pushToTalkCombo || 'Control+Shift';
  pttComboSelect.disabled = !pttCheckbox.checked;

  pttKeyControl.appendChild(pttComboSelect);

  const renderPttState = () => {
    pttComboSelect.disabled = !pttCheckbox.checked;
  };

  pttCheckbox.addEventListener('change', () => {
    setState({isPushToTalkEnabled: pttCheckbox.checked});
    renderPttState();
  });

  pttComboSelect.addEventListener('change', () => {
    setState({pushToTalkCombo: pttComboSelect.value});
  });

  pttRow.appendChild(pttInfo);
  pttRow.appendChild(pttKeyControl);
  pttContainer.appendChild(pttRow);
  settingsContainer.appendChild(pttContainer);
  renderPttState();

  // Voice punctuation commands
  const punctuationContainer = document.createElement('div');
  punctuationContainer.classList.add('silence-autosend-container', 'settings-card');

  const punctuationRow = document.createElement('div');
  punctuationRow.classList.add('silence-autosend-row');

  const punctuationLabel = document.createElement('label');
  punctuationLabel.classList.add('autogeneration-info');
  punctuationLabel.appendChild(makeLabelText(t('voicePunctuation'), t('voicePunctuationHint')));

  const punctuationCheckbox = document.createElement('input');
  punctuationCheckbox.type = 'checkbox';
  punctuationCheckbox.id = 'voicePunctuationCheckbox';
  punctuationCheckbox.checked = Boolean(state.isVoicePunctuationEnabled);
  const punctuationControl = document.createElement('span');
  punctuationControl.classList.add('control-group');
  punctuationControl.appendChild(punctuationCheckbox);
  punctuationLabel.appendChild(punctuationControl);

  punctuationCheckbox.addEventListener('change', () => {
    setState({isVoicePunctuationEnabled: punctuationCheckbox.checked});
  });

  punctuationRow.appendChild(punctuationLabel);
  punctuationContainer.appendChild(punctuationRow);
  settingsContainer.appendChild(punctuationContainer);

  // Word replacements dictionary
  const replacementsContainer = document.createElement('div');
  replacementsContainer.classList.add('silence-autosend-container', 'settings-card');

  const replacementsTitle = document.createElement('div');
  replacementsTitle.classList.add('language-list-info');
  replacementsTitle.textContent = t('wordReplacements');
  replacementsTitle.appendChild(createHintIcon(t('wordReplacementsHint')));

  const replacementsList = document.createElement('div');
  replacementsList.classList.add('replacements-list');

  const renderReplacements = () => {
    const current = getState().wordReplacements || [];
    replacementsList.innerHTML = '';
    current.forEach((rep, idx) => {
      const row = document.createElement('div');
      row.classList.add('replacement-row');

      const fromInput = document.createElement('input');
      fromInput.type = 'text';
      fromInput.value = rep.from || '';
      fromInput.placeholder = t('replacementFrom');
      fromInput.classList.add('replacement-input');

      const arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.classList.add('replacement-arrow');

      const toInput = document.createElement('input');
      toInput.type = 'text';
      toInput.value = rep.to || '';
      toInput.placeholder = t('replacementTo');
      toInput.classList.add('replacement-input');

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.classList.add('replacement-remove');
      removeBtn.setAttribute('aria-label', 'Remove');

      const updateReplacement = () => {
        const updated = [...getState().wordReplacements || []];
        updated[idx] = {from: fromInput.value, to: toInput.value};
        setState({wordReplacements: updated});
      };
      fromInput.addEventListener('input', updateReplacement);
      toInput.addEventListener('input', updateReplacement);

      removeBtn.addEventListener('click', () => {
        const updated = [...getState().wordReplacements || []];
        updated.splice(idx, 1);
        setState({wordReplacements: updated});
        renderReplacements();
      });

      row.appendChild(fromInput);
      row.appendChild(arrow);
      row.appendChild(toInput);
      row.appendChild(removeBtn);
      replacementsList.appendChild(row);
    });
  };

  const addReplacementBtn = document.createElement('button');
  addReplacementBtn.classList.add('add-replacement-button');
  addReplacementBtn.textContent = t('addReplacement');
  addReplacementBtn.addEventListener('click', () => {
    const current = getState().wordReplacements || [];
    setState({wordReplacements: [...current, {from: '', to: ''}]});
    renderReplacements();
  });

  replacementsContainer.appendChild(replacementsTitle);
  replacementsContainer.appendChild(replacementsList);
  replacementsContainer.appendChild(addReplacementBtn);
  settingsContainer.appendChild(replacementsContainer);
  renderReplacements();

  // Hotkeys info below Push-to-Talk, above Center buttons
  const hotkeysInfoContainer = document.createElement('div');
  hotkeysInfoContainer.classList.add('hotkeys-info-container');

  const hotkeysInfoTitle = document.createElement('div');
  hotkeysInfoTitle.classList.add('hotkeys-info-title');
  hotkeysInfoTitle.textContent = t('hotkeys');

  const hotkeysInfo = document.createElement('div');
  const hotkeysInfoBold = document.createElement('b');
  hotkeysInfoBold.textContent = t('hotkeysInfo');
  hotkeysInfo.appendChild(hotkeysInfoBold);

  const hotkeysIcon = document.createElement('div');
  hotkeysIcon.classList.add('hotkeys-icon');
  hotkeysIcon.textContent = 'ℹ️';

  const tooltip = document.createElement('div');
  tooltip.classList.add('click-tooltip');
  tooltip.textContent = t('hotkeysTooltip');
  hotkeysIcon.appendChild(tooltip);

  hotkeysIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    tooltip.classList.toggle('show');
    setTimeout(() => tooltip.classList.remove('show'), 2000);
  });

  hotkeysInfoContainer.appendChild(hotkeysInfoTitle);
  hotkeysInfoContainer.appendChild(hotkeysInfo);
  hotkeysInfoContainer.appendChild(hotkeysIcon);
  settingsContainer.appendChild(hotkeysInfoContainer);

  const centerButtonsRow = document.createElement('div');
  centerButtonsRow.classList.add('center-buttons-row');

  const centerMicButton = document.createElement('button');
  centerMicButton.classList.add('center-mic-button');
  centerMicButton.textContent = t('centerMic');
  centerMicButton.addEventListener('click', () => {
    const centerX = window.innerWidth / 2 - floatingButtonContainer.offsetWidth / 2;
    const centerY = window.innerHeight / 2 - floatingButtonContainer.offsetHeight / 2;
    updateFloatingButtonPosition(centerX, centerY);
  });

  const centerPanelButton = document.createElement('button');
  centerPanelButton.classList.add('center-mic-button');
  centerPanelButton.textContent = t('centerPanel');
  centerPanelButton.addEventListener('click', () => {
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    const centerX = window.innerWidth / 2 - container.offsetWidth / 2;
    const centerY = window.innerHeight / 2 - container.offsetHeight / 2;
    container.style.left = `${centerX}px`;
    container.style.top = `${centerY}px`;
    setState({ panelX: centerX, panelY: centerY });
  });

  centerButtonsRow.appendChild(centerMicButton);
  centerButtonsRow.appendChild(centerPanelButton);
  settingsContainer.appendChild(centerButtonsRow);

  // Changelog badge + tooltip
  const changelogBadge = document.createElement('button');
  changelogBadge.classList.add('changelog-badge');
  changelogBadge.textContent = `v${CURRENT_VERSION}`;
  changelogBadge.setAttribute('aria-label', 'What\'s new');

  const changelogTooltip = document.createElement('div');
  changelogTooltip.classList.add('changelog-tooltip');

  const userLocale = (() => {
    try {
      const uiLang = chrome.i18n?.getUILanguage?.();
      if (uiLang) return uiLang.split('-')[0];
    } catch {}
    return (navigator.language || 'en').split('-')[0];
  })();

  const changes = getChangelog(CURRENT_VERSION, userLocale);
  changes.forEach((change) => {
    const p = document.createElement('p');
    p.textContent = change;
    changelogTooltip.appendChild(p);
  });

  changelogBadge.appendChild(changelogTooltip);

  changelogBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    changelogTooltip.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    changelogTooltip.classList.remove('show');
    modal.querySelectorAll('.hint-tooltip.show').forEach(el => el.classList.remove('show'));
  });

  const closeModal = () => {
    modal.classList.remove('modal-open');
    modal.style.display = 'none';
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  // Header
  const modalHeader = document.createElement('div');
  modalHeader.classList.add('modal-header');

  const modalTitle = document.createElement('h2');
  modalTitle.classList.add('modal-title');
  modalTitle.textContent = t('settingsTitle') || 'Settings';

  const headerActions = document.createElement('div');
  headerActions.classList.add('modal-header-actions');
  headerActions.appendChild(changelogBadge);

  const closeButton = document.createElement('button');
  closeButton.classList.add('modal-close-btn');
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.addEventListener('click', closeModal);

  // Theme selector — light / dark / system
  const themeSelector = document.createElement('div');
  themeSelector.classList.add('theme-selector');

  const applyTheme = (theme) => {
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const value = isDark ? 'dark' : 'light';
    // Namespaced attribute on both the modal and the document root: ChatGPT
    // may put its own data-theme on ancestors, which would make generic
    // [data-theme="dark"] selectors match permanently and break switching.
    modal.setAttribute('data-vtt-theme', value);
    document.documentElement.setAttribute('data-vtt-theme', value);
  };

  const currentTheme = getState().theme || 'system';
  applyTheme(currentTheme);

  // React to OS theme changes while "system" is selected.
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((getState().theme || 'system') === 'system') {
        applyTheme('system');
      }
    });
  } catch {}

  const themeOptions = [
    {value: 'light', label: t('themeLight')},
    {value: 'system', label: t('themeSystem')},
    {value: 'dark', label: t('themeDark')},
  ];

  themeOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.classList.add('theme-option');
    btn.textContent = opt.label;
    btn.title = opt.label;
    if (opt.value === currentTheme) btn.classList.add('active');
    btn.addEventListener('click', () => {
      themeSelector.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setState({theme: opt.value});
      applyTheme(opt.value);
    });
    themeSelector.appendChild(btn);
  });

  headerActions.appendChild(themeSelector);
  headerActions.appendChild(closeButton);

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(headerActions);

  // Body
  const modalBody = document.createElement('div');
  modalBody.classList.add('modal-body');
  columnsContainer.appendChild(settingsContainer);
  modalBody.appendChild(columnsContainer);

  // Footer
  const modalFooter = document.createElement('div');
  modalFooter.classList.add('modal-footer');

  const donationContainer = document.createElement('div');
  donationContainer.classList.add('donation-container');

  const linksContainer = document.createElement('div');
  linksContainer.classList.add('donation-links');

  const donationLink = document.createElement('a');
  donationLink.href = 'https://buymeacoffee.com/bogutskii';
  donationLink.classList.add('donation-link');
  donationLink.textContent = t('donate');

  const LinkedInLink = document.createElement('a');
  LinkedInLink.href = 'https://www.linkedin.com/in/petr-bogutskii/';
  LinkedInLink.classList.add('linkedin-link');
  LinkedInLink.textContent = 'LinkedIn';

  const githubLink = document.createElement('a');
  githubLink.href = 'https://github.com/bogutskii';
  githubLink.classList.add('github-link');
  githubLink.textContent = 'GitHub';

  linksContainer.appendChild(donationLink);
  linksContainer.appendChild(LinkedInLink);
  linksContainer.appendChild(githubLink);

  donationContainer.appendChild(linksContainer);

  const author = document.createElement('div');
  author.classList.add('author');
  author.textContent = '@Petr Bogutskii';

  donationContainer.appendChild(author);
  modalFooter.appendChild(donationContainer);

  // Reset settings button
  const resetButton = document.createElement('button');
  resetButton.classList.add('reset-settings-button');
  resetButton.textContent = t('resetSettings');
  resetButton.addEventListener('click', () => {
    if (confirm(t('resetSettingsConfirm'))) {
      chrome.storage.local.clear(() => {
        location.reload();
      });
    }
  });
  modalFooter.appendChild(resetButton);

  modal.appendChild(modalHeader);
  modal.appendChild(modalBody);
  modal.appendChild(modalFooter);

  // Close modal on Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.style.display === 'block') {
      closeModal();
    }
  });
};
