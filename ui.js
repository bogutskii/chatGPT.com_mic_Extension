export const createContainer = () => {
  const container = document.createElement('div');
  container.classList.add('mainMenu-container');
  return container;
};

export const createButton = (backgroundImageUrl) => {
  const button = document.createElement('button');
  button.classList.add('button');
  if (backgroundImageUrl) {
    button.style.backgroundImage = `url(${backgroundImageUrl})`;
  }
  return button;
};

export const createSelect = (options) => {
  const select = document.createElement('select');
  select.classList.add('select');
  options.forEach(optionData => {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.text;
    select.appendChild(option);
  });
  return select;
};
