export const setupClearButton = (modal) => {
  const ensureClearButton = () => {
    const sendButton = document.querySelector('[data-testid="fruitjuice-send-button"]');
    if (sendButton && !document.querySelector('#clearButton')) {
      const clearButton = document.createElement('button');
      clearButton.id = 'clearButton';
      clearButton.style.backgroundColor = 'transparent';
      clearButton.style.border = 'none';
      clearButton.style.width = '40px';
      clearButton.style.height = '41px';
      clearButton.style.cursor = 'pointer';
      clearButton.style.backgroundImage = `url(chrome-extension://${chrome.runtime.id}/img/clear.png)`;
      clearButton.style.backgroundSize = 'cover';
      clearButton.style.backgroundRepeat = 'no-repeat';

      sendButton.parentNode.insertBefore(clearButton, sendButton);

      clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        const inputField = document.querySelector('#prompt-textarea');
        if (inputField) {
          inputField.value = '';
        }
      });

      sendButton.addEventListener('click', () => {
        const inputField = document.querySelector('#prompt-textarea');
        if (inputField) {
          setTimeout(() => {
            inputField.value = '';
          }, 10);
        }
      });
    }
  };

  ensureClearButton();
  new MutationObserver(ensureClearButton).observe(document.body, { childList: true, subtree: true });
};
