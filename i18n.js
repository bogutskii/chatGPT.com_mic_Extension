// Centralized i18n helper for content scripts, popup, and background.
// Chrome automatically falls back to the default locale if a key is missing.
export const t = (messageName, substitutions) => {
  try {
    return chrome.i18n.getMessage(messageName, substitutions) || messageName;
  } catch {
    return messageName;
  }
};

// Helper to localize static HTML elements with [data-i18n] attributes.
// Preserves child elements (like spans) by updating only the first text node.
export const localizePage = () => {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const translated = t(key);
    if (!translated || translated === key) return;

    if (el.tagName === 'TITLE') {
      el.textContent = translated;
      return;
    }

    // Replace only the leading text node so nested spans (e.g. version badge) stay intact
    const firstText = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (firstText) {
      firstText.textContent = translated;
    } else {
      el.textContent = translated;
    }
  });
};
