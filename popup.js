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
      const tab = tabs[0];
      if (!tab) return;
      // The content script only runs on chatgpt.com — don't message
      // unrelated tabs (they would fail with "receiving end does not exist").
      let isChatGptTab = false;
      try {
        isChatGptTab = new URL(tab.url || '').hostname === 'chatgpt.com';
      } catch {
        // Unparseable URL — treated as non-ChatGPT below.
      }
      if (!isChatGptTab) {
        alert(t('notChatGptAlert'));
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: action }, () => {
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

  const openSettingsBtn = document.getElementById('openSettings');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => sendTabMessage('openSettings'));
  }
});
