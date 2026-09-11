import {getState, setState} from './state.js';

export const setupAutoGeneration = (modal) => {
  const autogenerationCheckbox = modal.querySelector('#autogenerationCheckbox');
  if (!autogenerationCheckbox) return;

  // Find and click the "Continue generating" button if present.
  // Uses aria-label first (locale-independent), falls back to text match.
  const checkForContinueButton = () => {
    try {
      if (!autogenerationCheckbox.checked) return;

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
        if (fallbackButton && fallbackButton.textContent.toLowerCase().includes('continue')) {
          fallbackButton.click();
        }
        return;
      }

      continueButton.click();
    } catch (error) {
      console.error('Auto-generation button check failed:', error);
    }
  };

  // Observe the main content area for new buttons instead of polling every 2s.
  // This is far cheaper than setInterval + full button scan on every tick.
  let observer = null;
  let debounceTimer = null;

  const startObserver = () => {
    if (observer) return;
    const contentContainer = document.querySelector('main') || document.body;
    const debouncedCheck = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        checkForContinueButton();
      }, 100);
    };
    observer = new MutationObserver(debouncedCheck);
    observer.observe(contentContainer, {childList: true, subtree: true});
    // Run an initial check in case a button is already present.
    checkForContinueButton();
  };

  const stopObserver = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  autogenerationCheckbox.addEventListener('change', () => {
    const isAutoGenerationEnabled = autogenerationCheckbox.checked;
    setState({isAutoGenerationEnabled});
    if (isAutoGenerationEnabled) {
      startObserver();
    } else {
      stopObserver();
    }
  });

  // Initialize from current state.
  const state = getState();
  if (state.isAutoGenerationEnabled !== undefined) {
    autogenerationCheckbox.checked = state.isAutoGenerationEnabled;
  }
  if (state.isAutoGenerationEnabled) {
    startObserver();
  }
};
