export const setupMicPosition = (container, micButton, languageSelector, position = 'default') => {
  const inputField = document.querySelector('#prompt-textarea');
  const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
  const clearButton = document.querySelector('#clearButton');

  if (position === 'input') {
    if (inputField && sendButton && clearButton) {
      sendButton.parentNode.insertBefore(micButton, clearButton);
    }
  } else {
    container.insertBefore(micButton, languageSelector);
  }
};
