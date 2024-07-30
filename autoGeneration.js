export const setupAutoGeneration = (modal) => {
  const autogenerationCheckbox = modal.querySelector('#autogenerationCheckbox');
  let intervalId;

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
      intervalId = setInterval(checkForContinueButton, 2000);
    } else {
      clearInterval(intervalId);
    }
  });

  chrome.storage.local.get(['isAutoGenerationEnabled'], (result) => {
    if (result.isAutoGenerationEnabled !== undefined) {
      autogenerationCheckbox.checked = result.isAutoGenerationEnabled;
      if (result.isAutoGenerationEnabled) {
        intervalId = setInterval(checkForContinueButton, 2000);
      }
    }
  });
};