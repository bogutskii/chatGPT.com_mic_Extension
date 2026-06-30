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
  return modal;
};

export const createModalOverlay = () => {
  const modalOverlay = document.createElement('div');
  modalOverlay.classList.add('modal-overlay');
  return modalOverlay;
};

export const setupModal = async (modal, favoriteLanguages, updateLanguageSelector, container, updateFloatingButtonPosition, floatingButtonContainer) => {
  const state = getState();
  // column container
  const columnsContainer = document.createElement('div');
  columnsContainer.classList.add('columns');

  // first column
  const languageContainer = document.createElement('div');
  languageContainer.classList.add('column', 'language-container', 'settings-card');

  const languageListInfo = document.createElement('div');
  languageListInfo.textContent = t('selectFavoriteLanguages');
  languageListInfo.classList.add('language-list-info');

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
  languages.forEach(lang => {
    const label = document.createElement('label');
    label.classList.add('language-item');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = lang.code;
    checkbox.checked = state.favoriteLanguages.includes(lang.code);
    checkbox.onclick = saveFavoriteLanguagesFunction;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(lang.name));
    languageList.appendChild(label);
  });

  languageContainer.appendChild(languageListInfo);
  languageContainer.appendChild(languageActionsRow);
  languageContainer.appendChild(languageList);

  selectAllButton.addEventListener('click', () => {
    languageList.querySelectorAll('input').forEach(checkbox => {
      checkbox.checked = true;
    });
    saveFavoriteLanguagesFunction();
  });

  deselectAllButton.addEventListener('click', () => {
    languageList.querySelectorAll('input').forEach(checkbox => {
      checkbox.checked = false;
    });
    saveFavoriteLanguagesFunction();
  });

  columnsContainer.appendChild(languageContainer);

  // second column
  const settingsContainer = document.createElement('div');
  settingsContainer.classList.add('column');

  const autogenerationContainer = document.createElement('div');
  autogenerationContainer.classList.add('autogeneration-container', 'settings-card');

  const autogenerationInfo = document.createElement('label');
  autogenerationInfo.classList.add('autogeneration-info');
  autogenerationInfo.textContent = t('autoContinueGenerate');

  const autogenerationCheckbox = document.createElement('input');
  autogenerationCheckbox.type = 'checkbox';
  autogenerationCheckbox.id = 'autogenerationCheckbox';
  autogenerationCheckbox.checked = state.isAutoGenerationEnabled;

  const autogenerationIcon = document.createElement('span');
  autogenerationIcon.textContent = 'ℹ️';
  autogenerationIcon.classList.add('hotkeys-icon');
  autogenerationIcon.title = t('autoContinueTooltip');
  const autogenerationControl = document.createElement('span');
  autogenerationControl.classList.add('control-group');
  autogenerationControl.appendChild(autogenerationCheckbox);
  autogenerationControl.appendChild(autogenerationIcon);
  autogenerationInfo.appendChild(autogenerationControl);
  autogenerationContainer.appendChild(autogenerationInfo);
  settingsContainer.appendChild(autogenerationContainer);

  const widthSliderContainer = document.createElement('div');
  widthSliderContainer.classList.add('width-slider-container', 'settings-card');

  const widthSliderLabel = document.createElement('label');
  widthSliderLabel.classList.add('width-slider-label');
  widthSliderLabel.textContent = t('adjustContentWidth');
  const widthSlider = document.createElement('input');
  widthSlider.type = 'range';
  widthSlider.id = 'contentWidthSlider';
  widthSlider.min = '50';
  widthSlider.max = '100';
  widthSlider.step = '5';
  widthSlider.value = state.contentWidth;
  widthSliderContainer.appendChild(widthSliderLabel);
  widthSliderContainer.appendChild(widthSlider);
  settingsContainer.appendChild(widthSliderContainer);

  const autoSendOnSilenceContainer = document.createElement('div');
  autoSendOnSilenceContainer.classList.add('silence-autosend-container', 'settings-card');

  const autoSendOnSilenceRow = document.createElement('div');
  autoSendOnSilenceRow.classList.add('silence-autosend-row');

  const autoSendOnSilenceInfo = document.createElement('label');
  autoSendOnSilenceInfo.classList.add('autogeneration-info');
  autoSendOnSilenceInfo.textContent = t('autoSendOnSilence');

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

  const autoSendOnSilenceBeta = document.createElement('div');
  autoSendOnSilenceBeta.classList.add('silence-delay-beta', 'setting-hint', 'beta');
  autoSendOnSilenceBeta.textContent = t('autoSendBeta');

  const autoSendOnSilenceHint = document.createElement('div');
  autoSendOnSilenceHint.classList.add('silence-delay-hint', 'setting-hint');
  autoSendOnSilenceHint.textContent = t('autoSendHint');

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
    autoSendOnSilenceBeta.classList.toggle('show', autoSendOnSilenceCheckbox.checked);
    autoSendOnSilenceHint.classList.toggle('show', autoSendOnSilenceCheckbox.checked);
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
  autoSendOnSilenceContainer.appendChild(autoSendOnSilenceBeta);
  autoSendOnSilenceContainer.appendChild(autoSendOnSilenceHint);
  settingsContainer.appendChild(autoSendOnSilenceContainer);
  renderAutoSendOnSilenceDelay();

  const pttContainer = document.createElement('div');
  pttContainer.classList.add('silence-autosend-container', 'ptt-container', 'settings-card');

  const pttRow = document.createElement('div');
  pttRow.classList.add('silence-autosend-row');

  const pttInfo = document.createElement('label');
  pttInfo.classList.add('autogeneration-info');
  pttInfo.textContent = t('pushToTalk');

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

  const pttHint = document.createElement('div');
  pttHint.classList.add('silence-delay-hint', 'setting-hint', 'info');
  pttHint.textContent = t('pushToTalkHint');

  const renderPttState = () => {
    pttComboSelect.disabled = !pttCheckbox.checked;
    pttHint.classList.toggle('show', pttCheckbox.checked);
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
  pttContainer.appendChild(pttHint);
  settingsContainer.appendChild(pttContainer);
  renderPttState();

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
  });

  const closeModal = () => {
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
