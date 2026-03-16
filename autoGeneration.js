export const setupAutoGeneration = (modal) => {
  const autogenerationCheckbox = modal.querySelector('#autogenerationCheckbox');
  let intervalId;

  const checkForContinueButton = () => {
    try {
      let continueButton = document.querySelector('button[aria-label*="Continue"]');
      
      if (!continueButton) {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.toLowerCase().includes('continue')) {
            continueButton = btn;
            break;
          }
        }
      }
      
      if (!continueButton) {
        const fallbackButton = document.querySelector('div.flex.h-full.w-full.items-center.justify-end button');
        if (fallbackButton && fallbackButton.textContent.toLowerCase().includes('continue') && autogenerationCheckbox.checked) {
          fallbackButton.click();
        }
        return;
      }
      
      if (continueButton && autogenerationCheckbox.checked) {
        continueButton.click();
      }
    } catch (error) {
      console.error('Auto-generation button check failed:', error);
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