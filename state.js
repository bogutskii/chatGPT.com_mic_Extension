let state = {
  favoriteLanguages: ['en-US', 'uk-UA', 'ru-RU'],
  micPosition: 'default-left',
  recognitionLanguage: 'ru-RU',
  isListening: false,
  isAutoGenerationEnabled: true,
  contentWidth: 100,
  floatingButtonX: undefined,
  floatingButtonY: undefined,
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
    state = { ...state, ...storedState };
  } catch (error) {
    console.error('Error during state initialization:', error);
  }
};

export const getState = () => state;

export const setState = (newState) => {
  state = { ...state, ...newState };
  chrome.storage.local.set(state, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save state:', chrome.runtime.lastError);
    } else {
      listeners.forEach(listener => listener());
    }
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
    state = { ...state, ...storedState };
    listeners.forEach(listener => listener());
  } catch (error) {
    console.error('Error during state synchronization:', error);
  }
};

export const rerenderComponents = () => {
  listeners.forEach(listener => listener());
};
