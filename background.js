// Builds the context menus honoring the interface-language override: when
// the user picked a UI language in settings, menu titles come from that
// locale's messages.json instead of the browser UI language.
const buildContextMenus = async () => {
  let overrideMessages = null;
  try {
    const {uiLanguage} = await chrome.storage.local.get('uiLanguage');
    if (uiLanguage && uiLanguage !== 'auto') {
      const res = await fetch(chrome.runtime.getURL(`_locales/${uiLanguage}/messages.json`));
      if (res.ok) overrideMessages = await res.json();
    }
  } catch {}

  const title = (key) => overrideMessages?.[key]?.message || chrome.i18n.getMessage(key);

  // Avoid duplicate menu items after extension updates / language switches.
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: 'centerMic',
    title: title('contextMenuCenterMic'),
    contexts: ['action'],
  });

  chrome.contextMenus.create({
    id: 'centerPanel',
    title: title('contextMenuCenterPanel'),
    contexts: ['action'],
  });
};

chrome.runtime.onInstalled.addListener(buildContextMenus);
chrome.runtime.onStartup.addListener(buildContextMenus);

// Rebuild menus when the interface language changes in settings.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.uiLanguage) buildContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'centerMic') {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'centerMic' });
    } catch (_error) {
      console.log('Could not send message to tab');
    }
  } else if (info.menuItemId === 'centerPanel') {
    // Menu item is only enabled in custom mode, send center command
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'centerPanel' });
    } catch (_error) {
      console.log('Could not send message to tab');
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'voice-get-tab-id') {
    sendResponse({ tabId: sender?.tab?.id ?? null });
    return true;
  }

  // Content scripts cannot always fetch extension resources (page CSP), so
  // the service worker serves locale files for the UI-language override.
  if (message?.action === 'getLocaleMessages') {
    const locale = String(message.locale || '');
    if (!/^[a-z]{2}$/.test(locale)) {
      sendResponse(null);
      return true;
    }
    fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`))
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => sendResponse(json))
      .catch(() => sendResponse(null));
    return true;
  }

  if (message?.action === 'voice-stop-other-tabs') {
    const currentTabId = Number(message.currentTabId);
    chrome.tabs.query({ url: ['*://chatgpt.com/*', '*://chat.deepseek.com/*'] }, (tabs) => {
      // Respond only after every other tab acknowledged the stop — the caller
      // delays its own recognition.start() until the audio session is free.
      const stops = tabs.map((tab) => new Promise((resolve) => {
        if (!tab?.id || tab.id === currentTabId) {
          resolve();
          return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'stopRecognitionIfActive' }, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      }));
      Promise.all(stops).then(() => sendResponse({ success: true }));
    });
    return true;
  }

  return false;
});

