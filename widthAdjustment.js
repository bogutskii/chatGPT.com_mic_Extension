export const setupWidthAdjustment = (modal) => {
  const widthSlider = modal.querySelector('input[type="range"]');

  const adjustContentWidth = (width) => {
    const contentElements = document.querySelectorAll('.mx-auto.flex.flex-1.gap-3.text-base.juice\\:gap-4.juice\\:md\\:gap-5.juice\\:lg\\:gap-6');
    contentElements.forEach(el => {
      el.style.maxWidth = `${width}%`;
    });
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

  const observer = new MutationObserver(() => {
    const width = widthSlider.value;
    adjustContentWidth(width);
  });

  observer.observe(document.body, { childList: true, subtree: true });
};
