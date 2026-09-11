import {getState, setState} from './state.js';

export const setupWidthAdjustment = (modal) => {
  const widthSlider = modal.querySelector('#contentWidthSlider');
  if (!widthSlider) {
    return;
  }

  const adjustContentWidth = (width) => {
    try {
      const contentElements = document.querySelectorAll('.mx-auto.flex.flex-1');
      contentElements.forEach(el => {
        el.style.maxWidth = `${width}%`;
      });
    } catch (error) {
      console.error('Width adjustment failed:', error);
    }
  };

  // Apply the stored width once on load.
  // Clamp to the slider's valid range so legacy stored values do not break
  // after the range was changed. 100 = default ChatGPT width, 90 = slightly
  // narrower, 175 = much wider.
  const state = getState();
  const rawWidth = state.contentWidth || 100;
  const width = Math.min(175, Math.max(90, Number(rawWidth) || 100));
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

  widthSlider.addEventListener('input', (event) => {
    const newWidth = event.target.value;
    adjustContentWidth(newWidth);
    setState({contentWidth: newWidth});
  });
};
