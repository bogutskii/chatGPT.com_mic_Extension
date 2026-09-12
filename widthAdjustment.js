import {getState, setState} from './state.js';

export const setupWidthAdjustment = (modal) => {
  const widthSlider = modal.querySelector('#contentWidthSlider');
  if (!widthSlider) {
    return;
  }

  // ChatGPT has changed its DOM several times, so we avoid relying on
  // specific class names. Instead we find the width-limiting containers
  // dynamically: walk up the ancestor chain from the composer textarea and
  // from a message element, and collect every ancestor whose computed
  // max-width is a fixed pixel value. Those are the "content column"
  // containers. Each element's natural (unmodified) base width is stored in
  // a WeakMap so we can scale it by the slider factor.
  const MIN_LIMIT_PX = 200;
  const MAX_LIMIT_PX = 4000;
  const baseWidths = new WeakMap();

  const SEED_SELECTORS = [
    '#prompt-textarea',
    'form [contenteditable="true"]',
    'form textarea',
    '[data-testid^="conversation-turn"]',
    'main article',
    'article',
  ];
  const KNOWN_CONTAINER_SELECTORS = [
    'section.wm-app-conversation',
    '.wm-app-composerPositioner',
    '.mx-auto.flex.flex-1',
  ];

  const isFixedMaxWidth = (mw) => {
    if (!mw || mw === 'none' || !mw.endsWith('px')) return false;
    const v = parseFloat(mw);
    return v >= MIN_LIMIT_PX && v <= MAX_LIMIT_PX;
  };

  const collectWidthContainers = () => {
    const found = new Set();
    KNOWN_CONTAINER_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => found.add(el));
    });
    SEED_SELECTORS.forEach(sel => {
      const seed = document.querySelector(sel);
      if (!seed) return;
      let el = seed.parentElement;
      while (el && el !== document.documentElement) {
        if (isFixedMaxWidth(getComputedStyle(el).maxWidth)) {
          found.add(el);
        }
        el = el.parentElement;
      }
    });
    return found;
  };

  const applyToElement = (el, factor) => {
    if (factor === 1) {
      el.style.removeProperty('max-width');
      el.style.removeProperty('max-inline-size');
      baseWidths.delete(el);
      return;
    }
    let base = baseWidths.get(el);
    if (base == null) {
      // Clear our overrides first so we read the natural constraint.
      el.style.removeProperty('max-width');
      el.style.removeProperty('max-inline-size');
      base = parseFloat(getComputedStyle(el).maxWidth);
      if (!Number.isFinite(base) || base <= 0) return;
      baseWidths.set(el, base);
    }
    el.style.maxWidth = `${base * factor}px`;
    el.style.maxInlineSize = `${base * factor}px`;
  };

  const adjustContentWidth = (width) => {
    try {
      const factor = (Number(width) || 100) / 100;
      collectWidthContainers().forEach(el => applyToElement(el, factor));
    } catch (error) {
      console.error('Width adjustment failed:', error);
    }
  };

  // Apply the stored width once on load.
  // Clamp to the slider's valid range so legacy stored values do not break.
  // 100 = default ChatGPT width (minimum), 300 = 3x — on wide screens the
  // column saturates at the parent's full width anyway.
  const state = getState();
  const rawWidth = state.contentWidth || 100;
  const width = Math.min(300, Math.max(100, Number(rawWidth) || 100));
  widthSlider.value = width;
  adjustContentWidth(width);

  // Re-apply width when ChatGPT re-renders its main layout container.
  // We observe only direct children of <main> (not the entire subtree) so
  // streaming/typing does not trigger a full re-scan on every keystroke.
  let reapplyTimer = null;
  const scheduleReapply = () => {
    if (reapplyTimer) return;
    reapplyTimer = setTimeout(() => {
      reapplyTimer = null;
      adjustContentWidth(widthSlider.value);
    }, 200);
  };

  const contentContainer = document.querySelector('main') || document.body;
  const observer = new MutationObserver(scheduleReapply);
  observer.observe(contentContainer, {childList: true});
  // ChatGPT SPA navigation may replace the whole app shell (an ancestor of
  // <main>), which would detach the observer above. Watching <body> direct
  // children too keeps re-application working in that case.
  if (contentContainer !== document.body) {
    observer.observe(document.body, {childList: true});
  }

  widthSlider.addEventListener('input', (event) => {
    const newWidth = event.target.value;
    adjustContentWidth(newWidth);
    setState({contentWidth: newWidth});
  });
};
