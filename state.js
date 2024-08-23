let state = {
  favoriteLanguages: ['en-US', 'uk-UA', 'ru-RU'],
  micPosition: 'default-left',
  recognitionLanguage: 'ru-RU',
  isListening: false,
  isAutoGenerationEnabled: true,
  contentWidth: 100,
};

const listeners = [];

export const initializeState = async () => {
  const storedState = await new Promise((resolve) => {
    chrome.storage.local.get(null, resolve);
  });
  state = { ...state, ...storedState };
  // console.log('State initialized:', state);
};

export const getState = () => state;

export const setState = (newState) => {
  state = { ...state, ...newState };
  console.log('Setting new state:', newState);
  chrome.storage.local.set(state, () => {
    // console.log('State saved:', state);
    listeners.forEach(listener => listener());
  });
};

export const subscribe = (listener) => {
  listeners.push(listener);
  // console.log('New listener added. Total listeners:', listeners.length);
};

export const syncState = async () => {
  try {
    const state = getState();
    chrome.storage.local.set(state, () => {
      console.log('State synchronized:', state);
      document.dispatchEvent(new CustomEvent('stateSynced', { detail: state }));
    });
  } catch (error) {
    console.error('Error during state synchronization:', error);
  }
};
export const rerenderComponents = () => {
  listeners.forEach(listener => listener());
};
