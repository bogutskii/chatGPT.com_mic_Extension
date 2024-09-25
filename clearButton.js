export const setupClearButton = () => {
  const sendButton = document.querySelector('[data-testid="send-button"]');
  const inputField = document.querySelector('#prompt-textarea');

  if (sendButton && !document.querySelector('#clearButton')) {
    const clearButton = document.createElement('button');
    clearButton.id = 'clearButton';
    clearButton.classList.add('clear-button');
    document.body.appendChild(clearButton);

    clearButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (inputField) {
        inputField.value = '';
        const event = new Event('input', { bubbles: true });
        inputField.dispatchEvent(event);
      }
    });

    sendButton.addEventListener('click', () => {
      if (inputField) {
        setTimeout(() => {
          inputField.value = '';
          const event = new Event('input', { bubbles: true });
          inputField.dispatchEvent(event);
        }, 10);
      }
    });
  }
};