export const setupMicPosition = (container, micButton, position = 'default-left') => {
  const inputField = document.querySelector('#prompt-textarea');
  const sendButton = document.querySelector('[data-testid="send-button"]');
  const clearButton = document.querySelector('#clearButton');
  const languageSelector = container.querySelector('select');

  if (micButton.parentNode) {
    micButton.parentNode.removeChild(micButton);
  }

  if (position === 'input') {
    if (inputField && sendButton && clearButton) {
      if (sendButton.parentNode) {
        sendButton.parentNode.insertBefore(micButton, clearButton);
      }
    }
  } else if (position === 'default-left') {
    container.insertBefore(micButton, languageSelector);
  } else if (position === 'default-right') {
    container.appendChild(micButton);
  }
};
