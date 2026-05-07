chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');

  // Create context menu items
  chrome.contextMenus.create({
    id: 'centerMic',
    title: chrome.i18n.getMessage('contextMenuCenterMic'),
    contexts: ['action'],
  });

  chrome.contextMenus.create({
    id: 'centerPanel',
    title: chrome.i18n.getMessage('contextMenuCenterPanel'),
    contexts: ['action'],
  });
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

