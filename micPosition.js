export const setupMicPosition = (container, micButton, position = 'default') => {
  const inputField = document.querySelector('#prompt-textarea');
  const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
  const clearButton = document.querySelector('#clearButton');

  // Remove micButton from its current parent if it has one
  if (micButton.parentNode) {
    micButton.parentNode.removeChild(micButton);
  }

  if (position === 'input') {
    if (inputField && sendButton && clearButton) {
      sendButton.parentNode.insertBefore(micButton, clearButton);
    }
  } else {
    container.appendChild(micButton);
  }
};
