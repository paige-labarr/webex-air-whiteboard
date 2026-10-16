(function () {
  // Share the extension base URL with injector.js so it can load local fonts
  document.documentElement.dataset.airWbExtUrl = chrome.runtime.getURL('');

  let sandboxIframe = null;

  function getSandbox() {
    if (sandboxIframe) return sandboxIframe;
    if (!document.body && !document.documentElement) return null;

    sandboxIframe = document.createElement('iframe');
    sandboxIframe.src = chrome.runtime.getURL('sandbox.html');
    sandboxIframe.style.display = 'none';
    (document.body || document.documentElement).appendChild(sandboxIframe);
    return sandboxIframe;
  }

  window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === 'AIR_WB_FRAME' && event.source === window) {
      const sb = getSandbox();
      if (sb && sb.contentWindow) {
        sb.contentWindow.postMessage(event.data, '*');
      }
    } else if (
      event.data.type === 'AIR_WB_HAND' &&
      sandboxIframe &&
      event.source === sandboxIframe.contentWindow
    ) {
      window.postMessage(event.data, '*');
    }
  });
})();