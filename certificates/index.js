setTimeout(() => {
  document.getElementById('url').innerText = document.location.href;
  document.getElementById('mac').hidden = !isMac() || isAndroid();
  document.getElementById('other').hidden = !(isMac() || isWindows()) || isAndroid();
  document.getElementById('ios').hidden = !isIOS();
  document.getElementById('android').hidden = !isAndroid();
}, 30);

function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 && !isTouch();
}

function isAndroid() {
  return navigator.userAgent.toLowerCase().indexOf('android') > -1;
}

function isWindows() {
  return navigator.platform.indexOf('Win') > -1;
}
function isIOS() {
  return (
    ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
    // iPad on iOS 13 detection
    isTouch()
  );
}

function isTouch() {
  return navigator.userAgent.includes('Mac') && 'ontouchend' in document;
}
