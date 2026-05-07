import {localizePage, t} from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  localizePage();

  const manifest = chrome.runtime.getManifest();
  if (manifest) {
    const versionEl = document.getElementById('version');
    if (versionEl) {
      versionEl.textContent = 'v' + manifest.version;
    }
  }

  function sendTabMessage(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: action }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Action failed:', chrome.runtime.lastError.message);
          alert(t('reloadPageAlert'));
        }
      });
    });
  }

  const centerMicBtn = document.getElementById('centerMic');
  const centerPanelBtn = document.getElementById('centerPanel');

  if (centerMicBtn) {
    centerMicBtn.addEventListener('click', () => sendTabMessage('centerMic'));
  }
  if (centerPanelBtn) {
    centerPanelBtn.addEventListener('click', () => sendTabMessage('centerPanel'));
  }
});
