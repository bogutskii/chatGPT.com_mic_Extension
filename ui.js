export const createContainer = () => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.right = '10px';
  container.style.bottom = '10px';
  container.style.zIndex = '1000';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '10px';
  return container;
};

export const createButton = (backgroundImageUrl) => {
  const button = document.createElement('button');
  button.style.backgroundColor = 'transparent';
  button.style.border = 'none';
  button.style.width = '40px';
  button.style.height = '40px';
  button.style.cursor = 'pointer';
  button.style.transition = 'background-color 0.5s ease';
  if (backgroundImageUrl) {
    button.style.backgroundImage = `url(${backgroundImageUrl})`;
    button.style.backgroundSize = 'cover';
    button.style.backgroundRepeat = 'no-repeat';
  }
  return button;
};

export const createSelect = (options) => {
  const select = document.createElement('select');
  select.style.color = '#000';
  select.style.backgroundColor = '#f6f6f6';
  select.style.border = '1px solid #ccc';
  select.style.padding = '5px';
  select.style.borderRadius = '4px';
  options.forEach(optionData => {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.text;
    select.appendChild(option);
  });
  return select;
};

export const createResetButton = () => {
  const resetButton = createButton(`chrome-extension://${chrome.runtime.id}/img/refresh_170.png`);
  resetButton.style.width = '60px';
  resetButton.style.height = '60px';
  resetButton.style.cursor = 'pointer';
  resetButton.style.marginLeft = "-10px";
  resetButton.style.transition = 'background-color 0.5s ease';
  resetButton.style.position = 'relative';
  resetButton.style.backgroundSize = 'cover';
  resetButton.style.backgroundRepeat = 'no-repeat';
  return resetButton;
};

