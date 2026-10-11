// Centralized i18n helper for content scripts, popup, and background.
// Chrome automatically falls back to the default locale if a key is missing.

// UI locales the extension ships. 'auto' means "follow the browser UI
// language" (chrome.i18n resolves it with fallback to default_locale).
export const UI_LANGUAGES = [
  {code: 'en', name: 'English'},
  {code: 'ru', name: 'Русский'},
  {code: 'uk', name: 'Українська'},
  {code: 'es', name: 'Español'},
  {code: 'fr', name: 'Français'},
  {code: 'pt', name: 'Português'},
  {code: 'hi', name: 'हिन्दी'},
  {code: 'ko', name: '한국어'},
  {code: 'zh', name: '中文'},
];

let overrideMessages = null;
let overrideLocale = null;

// Resolves a messages.json entry to a plain string, applying the same
// substitution rules chrome.i18n uses: $$ → literal $, $name$ → named
// placeholder (its content "$1" points at a substitution), $1..$9 →
// positional substitutions.
const resolveOverrideMessage = (entry, substitutions) => {
  const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
  return entry.message
    .replace(/\$\$/g, '\u0001')
    .replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)\$/g, (match, name) => {
      const ph = entry.placeholders?.[name.toLowerCase()];
      const idx = ph ? Number(String(ph.content || '').replace('$', '')) : NaN;
      return Number.isInteger(idx) && subs[idx - 1] !== undefined ? subs[idx - 1] : match;
    })
    .replace(/\$(\d)/g, (match, n) => (subs[n - 1] !== undefined ? subs[n - 1] : match))
    .replace(/\u0001/g, '$');
};

// Loads a locale's messages.json so the UI can be switched independently of
// the browser language. Passing 'auto'/null/unknown clears the override.
// Falls back to the service worker when a page CSP blocks the direct fetch
// of the extension resource from the content-script context.
export const loadLocaleOverride = async (lang) => {
  overrideMessages = null;
  overrideLocale = null;
  if (!lang || lang === 'auto' || !UI_LANGUAGES.some(l => l.code === lang)) return;
  try {
    const res = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
    if (res.ok) {
      overrideMessages = await res.json();
      overrideLocale = lang;
      return;
    }
  } catch {}
  try {
    const messages = await chrome.runtime.sendMessage({action: 'getLocaleMessages', locale: lang});
    if (messages && typeof messages === 'object') {
      overrideMessages = messages;
      overrideLocale = lang;
    }
  } catch {}
  if (!overrideMessages) {
    console.warn('Failed to load UI locale override:', lang);
  }
};

// Effective UI language: manual override if set, else the browser UI
// language (base subtag, e.g. "pt-BR" → "pt").
export const getEffectiveUILanguage = () => {
  if (overrideLocale) return overrideLocale;
  try {
    return (chrome.i18n.getUILanguage() || 'en').toLowerCase().split('-')[0];
  } catch {
    return 'en';
  }
};

// Chrome Web Store review link — hl follows the effective UI language when
// we ship that locale, otherwise English.
const STORE_LISTING_ID = 'mnpljfjhhpogbgajfjfoolhahhoebeao';
const STORE_HL_OVERRIDES = {pt: 'pt-BR', zh: 'zh-CN'};
const STORE_SUPPORTED_HL = ['en', 'es', 'fr', 'hi', 'ko', 'pt', 'ru', 'uk', 'zh'];
export const getStoreReviewUrl = () => {
  const base = getEffectiveUILanguage();
  const hl = STORE_SUPPORTED_HL.includes(base) ? (STORE_HL_OVERRIDES[base] || base) : 'en';
  return `https://chromewebstore.google.com/detail/voice-to-text-for-chatgpt/${STORE_LISTING_ID}?hl=${hl}`;
};

export const t = (messageName, substitutions) => {
  try {
    const entry = overrideMessages?.[messageName];
    if (entry?.message) return resolveOverrideMessage(entry, substitutions);
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
