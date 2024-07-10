export const loadFavoriteLanguages = (callback) => {

  chrome.storage.local.get(['favoriteLanguages'], (result) => {
    console.log('loadFavoriteLanguages ' , result.favoriteLanguages)
    if (result.favoriteLanguages) {
      callback(result.favoriteLanguages);
    } else {
      callback(['en-US', 'uk-UA', 'ru-RU']);
    }
  });
};

export const saveFavoriteLanguages = (favoriteLanguages) => {
  chrome.storage.local.set({ favoriteLanguages });
};
