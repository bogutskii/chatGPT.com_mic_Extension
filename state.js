let state = {
  favoriteLanguages: ['en-US', 'uk-UA', 'ru-RU'],
  micPosition: 'default',
  recognitionLanguage: 'en-US',
  isAutoGenerationEnabled: true,
  isListening: false,
};

export const getState = () => state;

export const setState = (newState) => {
  state = { ...state, ...newState };
  chrome.storage.local.set(state);
};

export const initializeState = async () => {
  const storedState = await chrome.storage.local.get(Object.keys(state));
  state = { ...state, ...storedState };
};
