import { getState, setState } from './state.js';

const loadCSS = (url) => {
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

export const setupModal = async (modal, favoriteLanguages, updateLanguageSelector, container, micButton) => {
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
    console.log('New favorite languages:', newFavoriteLanguages);
    setState({ favoriteLanguages: newFavoriteLanguages });
  };

  const { languages } = await import(chrome.runtime.getURL('languages.js'));
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

  const micPositionContainer = document.createElement('div');
  micPositionContainer.classList.add('mic-position-container');

  const micPositionInfo = document.createElement('div');
  micPositionInfo.textContent = 'Microphone Position:';
  micPositionInfo.classList.add('mic-position-info');

  const micPositionSelector = document.createElement('select');
  micPositionSelector.classList.add('mic-position-selector');
  const positions = [
    { value: 'default-left', name: 'Default Left' },
    { value: 'default-right', name: 'Default Right' },
    { value: 'input', name: 'In Input' }
  ];
  positions.forEach(pos => {
    const option = document.createElement('option');
    option.value = pos.value;
    option.textContent = pos.name;
    micPositionSelector.appendChild(option);
  });

  micPositionSelector.addEventListener('change', (event) => {
    const selectedPosition = event.target.value;
    setState({ micPosition: selectedPosition });
    const inputField = document.querySelector('#prompt-textarea');
    const sendButton = document.querySelector('[data-testid="send-button"]');
    const clearButton = document.querySelector('#clearButton');
    if (selectedPosition === 'input') {
      if (inputField && sendButton && clearButton) {
        sendButton.parentNode.insertBefore(micButton, clearButton);
      }
    } else if (selectedPosition === 'default-left') {
      container.insertBefore(micButton, container.querySelector('select'));
    } else if (selectedPosition === 'default-right') {
      container.appendChild(micButton);
    }
  });

  micPositionContainer.appendChild(micPositionInfo);
  micPositionContainer.appendChild(micPositionSelector);
  settingsContainer.appendChild(micPositionContainer);

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
  widthSlider.min = '50';
  widthSlider.max = '100';
  widthSlider.step = '5';
  widthSlider.value = state.contentWidth;
  widthSliderContainer.appendChild(widthSliderLabel);
  widthSliderContainer.appendChild(widthSlider);
  settingsContainer.appendChild(widthSliderContainer);

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
  hotkeysIcon.title = 'Hotkeys: Control + M to start/stop microphone.';

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
