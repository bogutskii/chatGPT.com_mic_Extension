import {getState, setState} from './state.js';

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
  languageContainer.classList.add('column', 'language-container');

  const languageListInfo = document.createElement('div');
  languageListInfo.textContent = 'Select Favorite Languages:';
  languageListInfo.classList.add('language-list-info');

  const selectAllButton = document.createElement('button');
  selectAllButton.textContent = 'Select All';
  selectAllButton.classList.add('select-all-button');

  const deselectAllButton = document.createElement('button');
  deselectAllButton.textContent = 'Deselect All';
  deselectAllButton.classList.add('deselect-all-button');

  const languageList = document.createElement('div');
  languageList.classList.add('language-list');

  const saveFavoriteLanguagesFunction = () => {
    const newFavoriteLanguages = Array.from(languageList.querySelectorAll('input:checked')).map(input => input.value);
    setState({favoriteLanguages: newFavoriteLanguages});
  };

  const {languages} = await import(chrome.runtime.getURL('languages.js'));
  languages.forEach(lang => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.padding = '5px';
    label.style.cursor = 'pointer';
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
  languageContainer.appendChild(selectAllButton);
  languageContainer.appendChild(deselectAllButton);
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
  autogenerationContainer.classList.add('autogeneration-container');

  const autogenerationInfo = document.createElement('label');
  autogenerationInfo.classList.add('autogeneration-info');
  autogenerationInfo.textContent = 'Auto continue generate responses:';

  const autogenerationCheckbox = document.createElement('input');
  autogenerationCheckbox.type = 'checkbox';
  autogenerationCheckbox.id = 'autogenerationCheckbox';
  autogenerationCheckbox.checked = state.isAutoGenerationEnabled;

  const autogenerationIcon = document.createElement('span');
  autogenerationIcon.textContent = 'ℹ️';
  autogenerationIcon.classList.add('hotkeys-icon');
  autogenerationIcon.title = 'Auto continue generate responses if enabled 2 second delay';
  autogenerationInfo.appendChild(autogenerationCheckbox);
  autogenerationInfo.appendChild(autogenerationIcon);
  autogenerationContainer.appendChild(autogenerationInfo);
  settingsContainer.appendChild(autogenerationContainer);

  const widthSliderContainer = document.createElement('div');
  widthSliderContainer.classList.add('width-slider-container');

  const widthSliderLabel = document.createElement('label');
  widthSliderLabel.classList.add('width-slider-label');
  widthSliderLabel.textContent = 'Adjust Content Width:';
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
  autoSendOnSilenceContainer.classList.add('silence-autosend-container');

  const autoSendOnSilenceRow = document.createElement('div');
  autoSendOnSilenceRow.classList.add('silence-autosend-row');

  const autoSendOnSilenceInfo = document.createElement('label');
  autoSendOnSilenceInfo.classList.add('autogeneration-info');
  autoSendOnSilenceInfo.textContent = 'Auto-send on silence:';

  const autoSendOnSilenceCheckbox = document.createElement('input');
  autoSendOnSilenceCheckbox.type = 'checkbox';
  autoSendOnSilenceCheckbox.id = 'autoSendOnSilenceCheckbox';
  autoSendOnSilenceCheckbox.checked = Boolean(state.isAutoSendOnSilenceEnabled);
  autoSendOnSilenceInfo.appendChild(autoSendOnSilenceCheckbox);

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
  autoSendOnSilenceWarning.classList.add('silence-delay-warning');
  autoSendOnSilenceWarning.textContent = 'At 20–30s, auto-send can be interrupted by sleep mode, tab suspension, or page reload.';

  const autoSendOnSilenceBeta = document.createElement('div');
  autoSendOnSilenceBeta.classList.add('silence-delay-beta');
  autoSendOnSilenceBeta.textContent = 'Beta feature: we are collecting feedback on performance and limitations.';

  const autoSendOnSilenceHint = document.createElement('div');
  autoSendOnSilenceHint.classList.add('silence-delay-hint');
  autoSendOnSilenceHint.textContent = 'Tip: click the countdown timer to pause or resume auto-send.';

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
  pttContainer.classList.add('silence-autosend-container', 'ptt-container');

  const pttRow = document.createElement('div');
  pttRow.classList.add('silence-autosend-row');

  const pttInfo = document.createElement('label');
  pttInfo.classList.add('autogeneration-info');
  pttInfo.textContent = 'Push-to-Talk (walkie-talkie):';

  const pttCheckbox = document.createElement('input');
  pttCheckbox.type = 'checkbox';
  pttCheckbox.id = 'pttCheckbox';
  pttCheckbox.checked = Boolean(state.isPushToTalkEnabled);
  pttInfo.appendChild(pttCheckbox);

  const pttKeyControl = document.createElement('div');
  pttKeyControl.classList.add('silence-delay-control');

  const pttComboSelect = document.createElement('select');
  pttComboSelect.classList.add('ptt-key-select');
  const pttComboOptions = [
    {value: 'Control+Shift', text: 'Ctrl+Shift'},
    {value: 'Alt+Shift', text: 'Alt+Shift'},
    {value: 'Control+Alt', text: 'Ctrl+Alt'},
    {value: 'Shift+Alt', text: 'Shift+Alt'},
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
  pttHint.classList.add('silence-delay-hint');
  pttHint.textContent = 'Hold the selected key to record, release to stop. Works even while the microphone is off.';
  pttHint.style.marginTop = '6px';
  pttHint.style.color = '#4338ca';
  pttHint.style.background = 'rgba(99, 102, 241, 0.08)';

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

  const centerMicButton = document.createElement('button');
  centerMicButton.classList.add('center-mic-button');
  centerMicButton.textContent = 'Center Mic';
  centerMicButton.style.marginTop = '8px';
  centerMicButton.style.marginBottom = '4px';
  centerMicButton.style.marginLeft = 'auto';
  centerMicButton.style.marginRight = '8px';
  centerMicButton.addEventListener('click', () => {
    const centerX = window.innerWidth / 2 - floatingButtonContainer.offsetWidth / 2;
    const centerY = window.innerHeight / 2 - floatingButtonContainer.offsetHeight / 2;
    updateFloatingButtonPosition(centerX, centerY);
  });

  settingsContainer.appendChild(centerMicButton);

  // Center panel button
  const centerPanelButton = document.createElement('button');
  centerPanelButton.classList.add('center-mic-button');
  centerPanelButton.textContent = 'Center Panel';
  centerPanelButton.style.marginTop = '8px';
  centerPanelButton.style.marginLeft = 'auto';
  centerPanelButton.style.marginRight = 'auto';

  centerPanelButton.addEventListener('click', () => {
    // Reset conflicting CSS properties
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    const centerX = window.innerWidth / 2 - container.offsetWidth / 2;
    const centerY = window.innerHeight / 2 - container.offsetHeight / 2;
    container.style.left = `${centerX}px`;
    container.style.top = `${centerY}px`;
    setState({ panelX: centerX, panelY: centerY });
  });

  settingsContainer.appendChild(centerPanelButton);

  columnsContainer.appendChild(settingsContainer);
  modal.appendChild(columnsContainer);

  const donationContainer = document.createElement('div');
  donationContainer.classList.add('donation-container');

  const linksContainer = document.createElement('div');
  linksContainer.classList.add('donation-links');

  const donationLink = document.createElement('a');
  donationLink.href = 'https://buymeacoffee.com/bogutskii';
  donationLink.classList.add('donation-link');
  donationLink.textContent = 'Donate';

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

  modal.appendChild(donationContainer);

  const hotkeysInfoContainer = document.createElement('div');
  hotkeysInfoContainer.classList.add('hotkeys-info-container');

  const hotkeysInfoTitle = document.createElement('div');
  hotkeysInfoTitle.classList.add('hotkeys-info-title');
  hotkeysInfoTitle.textContent = 'Hotkeys:';

  const hotkeysInfo = document.createElement('div');
  hotkeysInfo.innerHTML = '<b> Control + M</b>';

  const hotkeysIcon = document.createElement('div');
  hotkeysIcon.classList.add('hotkeys-icon');
  hotkeysIcon.textContent = 'ℹ️';

  // Click tooltip
  const tooltip = document.createElement('div');
  tooltip.classList.add('click-tooltip');
  tooltip.textContent = 'Hotkeys: Control + M to start/stop microphone.';
  hotkeysIcon.appendChild(tooltip);

  hotkeysIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    tooltip.classList.toggle('show');
    setTimeout(() => tooltip.classList.remove('show'), 2000);
  });

  hotkeysInfoContainer.appendChild(hotkeysInfoTitle);
  hotkeysInfoContainer.appendChild(hotkeysInfo);
  hotkeysInfoContainer.appendChild(hotkeysIcon);
  modal.appendChild(hotkeysInfoContainer);

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('button-container');

  const cancelButton = document.createElement('button');
  cancelButton.classList.add('cancel-button');
  cancelButton.textContent = 'Ok';

  cancelButton.addEventListener('click', () => {
    modal.style.display = 'none';
    document.querySelector('.modal-overlay').style.display = 'none';
  });

  buttonContainer.appendChild(cancelButton);
  modal.appendChild(buttonContainer);
};
