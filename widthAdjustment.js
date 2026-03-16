export const setupWidthAdjustment = (modal) => {
  const widthSlider = modal.querySelector('input[type="range"]');
  let throttleTimeout;

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

  chrome.storage.local.get(['contentWidth'], (result) => {
    const width = result.contentWidth || 100;
    widthSlider.value = width;
    adjustContentWidth(width);
  });

  widthSlider.addEventListener('input', (event) => {
    const width = event.target.value;
    adjustContentWidth(width);
    chrome.storage.local.set({ contentWidth: width });
  });

  const throttledAdjust = () => {
    if (throttleTimeout) return;
    throttleTimeout = setTimeout(() => {
      const width = widthSlider.value;
      adjustContentWidth(width);
      throttleTimeout = null;
    }, 300);
  };

  const contentContainer = document.querySelector('main') || document.body;
  const observer = new MutationObserver(throttledAdjust);

  observer.observe(contentContainer, { childList: true, subtree: true });
};
