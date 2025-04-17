function post(type: string, payload: any) {
  window.parent.postMessage({ type, payload }, '*');
}

post('pageLoaded', { url: window.location.href });

const pushState = history.pushState;
history.pushState = function (...args) {
  pushState.apply(history, args);
  window.dispatchEvent(new Event('urlchange'));
};

const replaceState = history.replaceState;
history.replaceState = function (...args) {
  replaceState.apply(history, args);
  window.dispatchEvent(new Event('urlchange'));
};

// Listen for popstate (back/forward buttons) and custom urlchange
window.addEventListener('popstate', () => {
  post('pageChanged', { url: window.location.href });
});

window.addEventListener('urlchange', () => {
  post('pageChanged', { url: window.location.href });
});
