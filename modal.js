import { getState, setState } from './state.js';

export const createModal = () => {
  const modal = document.createElement('div');
  modal.style.color = '#000';
  modal.style.display = 'none';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.zIndex = '1001';
  modal.style.backgroundColor = '#fff';
  modal.style.padding = '20px';
  modal.style.border = '1px solid #ccc';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  modal.style.transition = 'all 0.3s ease-in-out';
  modal.style.width = '400px';
  modal.style.maxWidth = '90%';

  return modal;
};

export const createModalOverlay = () => {
  const modalOverlay = document.createElement('div');
  modalOverlay.style.display = 'none';
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = '0';
  modalOverlay.style.left = '0';
  modalOverlay.style.width = '100%';
  modalOverlay.style.height = '100%';
  modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modalOverlay.style.zIndex = '1000';

  return modalOverlay;
};

export const setupModal = async (modal, favoriteLanguages, updateLanguageSelector, container, micButton) => {
  const state = getState();
  const languageContainer = document.createElement('div');
  languageContainer.style.backgroundColor = '#f9f9f9';
  languageContainer.style.padding = '10px';
  languageContainer.style.borderRadius = '5px';
  languageContainer.style.marginBottom = '10px';

  const languageListInfo = document.createElement('div');
  languageListInfo.textContent = 'Select Favorite Languages:';
  languageListInfo.style.fontWeight = 'bold';

  const selectAllButton = document.createElement('button');
  selectAllButton.textContent = 'Select All';
  selectAllButton.style.marginTop = '10px';
  selectAllButton.style.backgroundColor = '#800080';
  selectAllButton.style.color = '#fff';
  selectAllButton.style.border = 'none';
  selectAllButton.style.padding = '10px 20px';
  selectAllButton.style.borderRadius = '5px';
  selectAllButton.style.cursor = 'pointer';

  const deselectAllButton = document.createElement('button');
  deselectAllButton.textContent = 'Deselect All';
  deselectAllButton.style.marginTop = '10px';
  deselectAllButton.style.backgroundColor = '#800080';
  deselectAllButton.style.color = '#fff';
  deselectAllButton.style.border = 'none';
  deselectAllButton.style.padding = '10px 20px';
  deselectAllButton.style.borderRadius = '5px';
  deselectAllButton.style.cursor = 'pointer';

  const languageList = document.createElement('div');
  languageList.style.width = '100%';
  languageList.style.height = '200px';
  languageList.style.overflowY = 'scroll';
  languageList.style.border = '1px solid #ccc';
  languageList.style.borderRadius = '5px';
  languageList.style.marginTop = '10px';

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

  modal.appendChild(languageContainer);

  const micPositionContainer = document.createElement('div');
  micPositionContainer.style.backgroundColor = '#f9f9f9';
  micPositionContainer.style.padding = '10px';
  micPositionContainer.style.borderRadius = '5px';
  micPositionContainer.style.marginBottom = '10px';

  const micPositionInfo = document.createElement('div');
  micPositionInfo.textContent = 'Microphone Position:';
  micPositionInfo.style.margin = '10px auto';
  micPositionInfo.style.textAlign = 'center';
  micPositionInfo.style.fontWeight = 'bold';

  const micPositionSelector = document.createElement('select');
  micPositionSelector.style.marginLeft = '35%';
  const positions = [
    { value: 'default', name: 'Default' },
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
    const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
    const clearButton = document.querySelector('#clearButton');
    if (selectedPosition === 'input') {
      if (inputField && sendButton && clearButton) {
        sendButton.parentNode.insertBefore(micButton, clearButton);
      }
    } else {
      container.appendChild(micButton);
    }
  });

  micPositionContainer.appendChild(micPositionInfo);
  micPositionContainer.appendChild(micPositionSelector);
  modal.appendChild(micPositionContainer);

  const autogenerationContainer = document.createElement('div');
  autogenerationContainer.style.backgroundColor = '#f9f9f9';
  autogenerationContainer.style.padding = '10px';
  autogenerationContainer.style.borderRadius = '5px';
  autogenerationContainer.style.marginBottom = '10px';

  const autogenerationInfo = document.createElement('label');
  autogenerationInfo.style.display = 'flex';
  autogenerationInfo.style.alignItems = 'center';
  autogenerationInfo.style.fontWeight = 'bold';
  autogenerationInfo.textContent = 'Auto continue generate responses:';

  const autogenerationCheckbox = document.createElement('input');
  autogenerationCheckbox.type = 'checkbox';
  autogenerationCheckbox.id = 'autogenerationCheckbox';
  autogenerationCheckbox.style.marginLeft = '10px';
  autogenerationCheckbox.checked = state.isAutoGenerationEnabled;

  const autogenerationIcon = document.createElement('span');
  autogenerationIcon.textContent = 'ℹ️';
  autogenerationIcon.title = 'Auto continue generate responses if enabled 2 second delay';
  autogenerationIcon.style.cursor = 'pointer';
  autogenerationIcon.style.marginLeft = '10px';
  autogenerationInfo.appendChild(autogenerationCheckbox);
  autogenerationInfo.appendChild(autogenerationIcon);
  autogenerationContainer.appendChild(autogenerationInfo);
  modal.appendChild(autogenerationContainer);

  const widthSliderContainer = document.createElement('div');
  widthSliderContainer.style.display = 'flex';
  widthSliderContainer.style.flexDirection = 'column';
  widthSliderContainer.style.alignItems = 'center';
  widthSliderContainer.style.backgroundColor = '#f9f9f9';
  widthSliderContainer.style.padding = '10px';
  widthSliderContainer.style.borderRadius = '5px';
  widthSliderContainer.style.marginBottom = '10px';

  const widthSliderLabel = document.createElement('label');
  widthSliderLabel.textContent = 'Adjust Content Width:';
  widthSliderLabel.style.marginBottom = '5px';
  const widthSlider = document.createElement('input');
  widthSlider.type = 'range';
  widthSlider.min = '50';
  widthSlider.max = '100';
  widthSlider.step = '5';
  widthSlider.value = state.contentWidth;
  widthSliderContainer.appendChild(widthSliderLabel);
  widthSliderContainer.appendChild(widthSlider);
  modal.appendChild(widthSliderContainer);

  const donationContainer = document.createElement('div');
  donationContainer.style.backgroundColor = '#f9f9f9';
  donationContainer.style.padding = '10px';
  donationContainer.style.borderRadius = '5px';
  donationContainer.style.marginBottom = '10px';

  const donationLink = document.createElement('a');
  donationLink.href = 'https://buymeacoffee.com/bogutskii';
  donationLink.textContent = 'Donate';
  donationLink.style.display = 'block';
  donationLink.style.marginTop = '10px';
  donationLink.style.textDecoration = 'underline';
  donationLink.style.color = '#800080';
  donationLink.style.textAlign = 'center';

  const LinkedInLink = document.createElement('a');
  LinkedInLink.href = 'https://www.linkedin.com/in/petr-bogutskii/';
  LinkedInLink.textContent = 'LinkedIn';
  LinkedInLink.style.display = 'block';
  LinkedInLink.style.marginTop = '10px';
  LinkedInLink.style.textDecoration = 'underline';
  LinkedInLink.style.color = '#800080';
  LinkedInLink.style.textAlign = 'center';

  const githubLink = document.createElement('a');
  githubLink.href = 'https://github.com/bogutskii';
  githubLink.textContent = 'GitHub';
  githubLink.style.display = 'block';
  githubLink.style.marginTop = '10px';
  githubLink.style.textDecoration = 'underline';
  githubLink.style.color = '#800080';
  githubLink.style.textAlign = 'center';

  const author = document.createElement('div');
  author.textContent = '@Petr Bogutskii';
  author.style.marginTop = '10px';
  author.style.textAlign = 'center';

  donationContainer.appendChild(donationLink);
  donationContainer.appendChild(LinkedInLink);
  donationContainer.appendChild(githubLink);
  donationContainer.appendChild(author);
  modal.appendChild(donationContainer);

  const hotkeysInfoContainer = document.createElement('div');
  hotkeysInfoContainer.style.display = 'flex';
  hotkeysInfoContainer.style.alignItems = 'center';
  hotkeysInfoContainer.style.justifyContent = 'center';
  hotkeysInfoContainer.style.marginTop = '10px';
  hotkeysInfoContainer.style.textAlign = 'center';

  const hotkeysInfoTitle = document.createElement('div');
  hotkeysInfoTitle.textContent = 'Hotkeys:';
  hotkeysInfoTitle.style.fontWeight = 'bold';
  hotkeysInfoTitle.style.marginRight = '5px';

  const hotkeysInfo = document.createElement('div');
  hotkeysInfo.innerHTML = '<b> Control + M</b>';
  hotkeysInfo.style.display = 'flex';

  const hotkeysIcon = document.createElement('div');
  hotkeysIcon.textContent = 'ℹ️';
  hotkeysIcon.title = 'Hotkeys: Control + M to start/stop microphone.';
  hotkeysIcon.style.marginLeft = '10px';
  hotkeysIcon.style.cursor = 'pointer';

  hotkeysInfoContainer.appendChild(hotkeysInfoTitle);
  hotkeysInfoContainer.appendChild(hotkeysInfo);
  hotkeysInfoContainer.appendChild(hotkeysIcon);
  modal.appendChild(hotkeysInfoContainer);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Ok';
  cancelButton.style.marginTop = '10px';
  cancelButton.style.backgroundColor = '#8f8f8f';
  cancelButton.style.color = '#fff';
  cancelButton.style.border = 'none';
  cancelButton.style.padding = '10px 20px';
  cancelButton.style.borderRadius = '5px';
  cancelButton.style.cursor = 'pointer';
  cancelButton.style.display = 'block';
  cancelButton.style.margin = '20px auto';

  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.backgroundColor = '#800080';
  });

  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.backgroundColor = '#8f8f8f';
  });

  buttonContainer.appendChild(cancelButton);
  modal.appendChild(buttonContainer);

  cancelButton.addEventListener('click', () => {
    modal.style.display = 'none';
    document.querySelector('.modal-overlay').style.display = 'none';
  });
};
