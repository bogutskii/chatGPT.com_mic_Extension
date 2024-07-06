export const setupAutoGeneration = (modal) => {
  const autogenerationCheckbox = modal.querySelector('#autogenerationCheckbox');
  const checkForContinueButton = () => {
    const continueButton = document.querySelector('div.flex.h-full.w-full.items-center.justify-end button');
    if (continueButton && autogenerationCheckbox.checked) {
      continueButton.click();
    }
  };

  autogenerationCheckbox.addEventListener('change', () => {
    const isAutoGenerationEnabled = autogenerationCheckbox.checked;
    chrome.storage.local.set({ isAutoGenerationEnabled });
    if (isAutoGenerationEnabled) {
      setInterval(checkForContinueButton, 2000);
    } else {
      clearInterval(checkForContinueButton);
    }
  });

  chrome.storage.local.get(['isAutoGenerationEnabled'], (result) => {
    if (result.isAutoGenerationEnabled !== undefined) {
      autogenerationCheckbox.checked = result.isAutoGenerationEnabled;
      if (result.isAutoGenerationEnabled) {
        setInterval(checkForContinueButton, 2000);
      }
    }
  });
};
