let state = {
  favoriteLanguages: ['en-US', 'uk-UA', 'ru-RU'],
  recognitionLanguage: 'ru-RU',
  isListening: false,
  isAutoGenerationEnabled: true,
  isAutoSendOnSilenceEnabled: false,
  autoSendSilenceDelaySec: 10,
  contentWidth: 100,
  floatingButtonX: undefined,
  floatingButtonY: undefined,
  panelX: undefined,
  panelY: undefined,
  isPanelMinimized: false,
};

const listeners = [];

export const initializeState = async () => {
  try {
    const storedState = await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(result);
      });
    });
    state = {...state, ...storedState};
  } catch (error) {
    console.error('Error during state initialization:', error);
  }
};

export const getState = () => state;

let saveQueue = Promise.resolve();

export const setState = (newState) => {
  state = {...state, ...newState};

  saveQueue = saveQueue.then(() => {
    return new Promise((resolve) => {
      if (!chrome.runtime?.id) {
        // Extension context invalidated, skip saving
        resolve();
        return;
      }
      chrome.storage.local.set(newState, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save state:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }).then(() => {
    listeners.forEach(listener => listener());
  });
};

export const subscribe = (listener) => {
  listeners.push(listener);
};

export const syncState = async () => {
  try {
    const storedState = await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(result);
      });
    });
    state = {...state, ...storedState};
    listeners.forEach(listener => listener());
  } catch (error) {
    console.error('Error during state synchronization:', error);
  }
};

export const rerenderComponents = () => {
  listeners.forEach(listener => listener());
};
