import {getState, setState} from './state.js';

export const setupWidthAdjustment = (modal) => {
  const widthSlider = modal.querySelector('#contentWidthSlider');
  if (!widthSlider) {
    return;
  }

  // ChatGPT constrains its content column via the CSS variables
  // --thread-content-max-width (desktop) and --mobile-thread-content-max-width
  // (narrow screens). Elements consume them through Tailwind classes like
  // "max-w-(--thread-content-max-width)". Instead of patching each element
  // inline — which makes lazy-rendered messages flash at the default width
  // until a MutationObserver re-run — we inject ONE stylesheet rule that
  // multiplies the consumed max-width by a scale variable. It applies
  // instantly to all current AND future nodes: new messages, streamed
  // responses and SPA navigation are all covered with zero re-application
  // and no jumps.
  const DESKTOP_VAR = '--thread-content-max-width';
  const MOBILE_VAR = '--mobile-thread-content-max-width';
  const THREAD_VARS = [DESKTOP_VAR, MOBILE_VAR];
  const SCALE_VAR = '--vtt-width-scale';
  const STYLE_ID = 'vtt-width-override';

  // Consumers of the desktop var get the scaled desktop var; consumers of
  // the mobile var get the scaled mobile var. Elements carrying BOTH
  // classes (breakpoint-switching) get the narrower of the two, which
  // approximates ChatGPT's own adaptive behavior. Tailwind v3 arbitrary-
  // value spelling (max-w-[var(--x)]) is included for older DOMs.
  const WIDTH_CSS = `
[class*="max-w-(--thread-content-max-width)"],
[class*="max-w-[var(--thread-content-max-width)]"] {
  max-width: calc(var(${DESKTOP_VAR}) * var(${SCALE_VAR}, 1)) !important;
}
[class*="max-w-(--mobile-thread-content-max-width)"],
[class*="max-w-[var(--mobile-thread-content-max-width)]"] {
  max-width: calc(var(${MOBILE_VAR}) * var(${SCALE_VAR}, 1)) !important;
}
[class*="max-w-(--thread-content-max-width)"][class*="max-w-(--mobile-thread-content-max-width)"],
[class*="max-w-[var(--thread-content-max-width)]"][class*="max-w-[var(--mobile-thread-content-max-width)]"] {
  max-width: min(
    calc(var(${DESKTOP_VAR}) * var(${SCALE_VAR}, 1)),
    calc(var(${MOBILE_VAR}) * var(${SCALE_VAR}, 1))
  ) !important;
}`;

  const ensureStyleElement = () => {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = WIDTH_CSS;
    }
    if (!el.isConnected) {
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  };

  const MIN_LIMIT_PX = 200;
  const MAX_LIMIT_PX = 4000;
  const baseWidths = new WeakMap();  // natural max-width for the inline fallback
  const elementKind = new WeakMap(); // 'css' | var name | 'inline' per element
  const managed = new Set();         // elements we patched (for pruning/resets)

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

  // Elements already handled by the injected stylesheet — the JS fallback
  // must skip them, otherwise the scale would be applied twice.
  const isCssCovered = (el) => {
    const c = el.getAttribute('class') || '';
    return c.includes('max-w-(--thread-content-max-width)') ||
      c.includes('max-w-(--mobile-thread-content-max-width)') ||
      c.includes('max-w-[var(--thread-content-max-width)]') ||
      c.includes('max-w-[var(--mobile-thread-content-max-width)]');
  };

  // Resolve the current pixel value of a thread-width variable inside a
  // given element's scope using a throwaway probe (inherits the cascade).
  const PROBE_CLASS = 'vtt-width-probe';
  const probeVarPx = (host, varName) => {
    const probe = document.createElement('div');
    probe.className = PROBE_CLASS;
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;' +
      `max-width:var(${varName});width:10000px;`;
    host.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).maxWidth);
    probe.remove();
    return Number.isFinite(px) ? px : null;
  };

  // Decide once per element what drives its max-width: the stylesheet rule
  // (class consumers), a CSS variable (semantic stylesheet consumers), or a
  // plain fixed value (older ChatGPT DOMs). Result is cached in elementKind.
  const detectKind = (el) => {
    if (isCssCovered(el)) return 'css';
    const mw = parseFloat(getComputedStyle(el).maxWidth);
    if (Number.isFinite(mw)) {
      for (const varName of THREAD_VARS) {
        const px = probeVarPx(el, varName);
        if (px != null && Math.abs(mw - px) <= 2) {
          return varName;
        }
      }
    }
    return 'inline';
  };

  const resetElement = (el) => {
    el.style.removeProperty('max-width');
    el.style.removeProperty('max-inline-size');
    baseWidths.delete(el);
  };

  const applyToElement = (el, factor) => {
    if (factor === 1) {
      resetElement(el);
      return;
    }
    let kind = elementKind.get(el);
    if (!kind) {
      kind = detectKind(el);
      elementKind.set(el, kind);
    }
    if (kind === 'css') {
      return; // handled by the injected rule — instant, no patching needed
    }
    if (kind !== 'inline') {
      // Var-driven element without a Tailwind consumer class: scale at the
      // consumption site so it still tracks variable changes.
      el.style.maxWidth = `calc(var(${kind}) * ${factor})`;
      el.style.maxInlineSize = `calc(var(${kind}) * ${factor})`;
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

  const collectContainers = () => {
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

  const adjustContentWidth = (width) => {
    try {
      const factor = (Number(width) || 100) / 100;
      ensureStyleElement();
      // One variable drives the whole stylesheet — instant re-theme.
      document.documentElement.style.setProperty(SCALE_VAR, String(factor));

      // Drop disconnected elements so `managed` cannot grow unboundedly.
      managed.forEach(el => {
        if (!el.isConnected) managed.delete(el);
      });

      // JS fallback for layouts where max-width is not driven by the
      // thread-width classes (older/other ChatGPT DOMs).
      collectContainers().forEach(el => {
        managed.add(el);
        applyToElement(el, factor);
      });
    } catch (error) {
      console.error('Width adjustment failed:', error);
    }
  };

  // Apply the stored width once on load.
  // Clamp to the slider's valid range so legacy stored values do not break.
  const sliderMin = Number(widthSlider.min) || 100;
  const sliderMax = Number(widthSlider.max) || 300;
  const state = getState();
  const rawWidth = Number(state.contentWidth) || 100;
  const width = Math.min(sliderMax, Math.max(sliderMin, rawWidth));
  widthSlider.value = String(width);
  // Keep the "N%" label in sync with the clamped value.
  const widthValueLabel = modal.querySelector('.width-slider-value');
  if (widthValueLabel) {
    widthValueLabel.textContent = `${width}%`;
  }
  adjustContentWidth(width);

  // Re-check only when DOM mutations can introduce NEW width containers.
  // The CSS rule needs no re-application at all — this exists solely for
  // the JS fallback path, so we gate it behind a cheap "interesting node"
  // check: streaming tokens and text edits inside existing messages cost
  // nothing.
  const isInterestingNode = (node) => {
    if (node.nodeType !== 1) return false;
    const cls = node.getAttribute?.('class') || '';
    if (cls.includes('thread-content-max-width')) return true;
    if (KNOWN_CONTAINER_SELECTORS.some(s => node.matches?.(s))) return true;
    try {
      if (node.querySelector?.('[class*="thread-content-max-width"]')) return true;
      if (node.querySelector?.(SEED_SELECTORS.join(','))) return true;
    } catch {
      // Malformed selectors must never break the observer.
    }
    return false;
  };

  let reapplyScheduled = false;
  const scheduleReapply = () => {
    if (reapplyScheduled) return;
    reapplyScheduled = true;
    // rAF coalesces bursts of mutations into one re-check per frame —
    // fast enough that even fallback layouts show no visible flash.
    requestAnimationFrame(() => {
      reapplyScheduled = false;
      adjustContentWidth(widthSlider.value);
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (isInterestingNode(n)) {
          scheduleReapply();
          return;
        }
      }
    }
  });
  const contentContainer = document.querySelector('main') || document.body;
  observer.observe(contentContainer, {childList: true, subtree: true});
  if (contentContainer !== document.body) {
    observer.observe(document.body, {childList: true});
  }

  // If the page ever removes our <style> (head re-render), put it back.
  const headObserver = new MutationObserver(ensureStyleElement);
  headObserver.observe(document.head || document.documentElement, {childList: true});

  widthSlider.addEventListener('input', (event) => {
    const newWidth = Number(event.target.value);
    adjustContentWidth(newWidth);
    setState({contentWidth: newWidth});
  });
};
