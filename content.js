// Isolated world: manages chrome.storage and bridges settings to MAIN world via sessionStorage.
// content-main.js (MAIN world) reads from sessionStorage on every event.

const STORAGE_KEY = 'gdocspf_settings';

const defaults = {
  enabled: false,
  imageWidth: 400,
  shortcuts: {
    h1: 'q', h2: 'w', h3: 'e', h4: 'r',
    normal: 't', bullet: 'y',
    removeSpace: 'u',
    bulletFixer: '',
  },
};

function sync(data) {
  // Only keep shortcuts for actions that still exist — old keys like
  // spaceBefore/spaceAfter linger in chrome.storage and would shadow new ones.
  const shortcuts = {};
  for (const action of Object.keys(defaults.shortcuts)) {
    shortcuts[action] = data.shortcuts?.[action] ?? defaults.shortcuts[action];
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, ...data, shortcuts }));
}

chrome.storage.sync.get(defaults, sync);
chrome.storage.onChanged.addListener(() => chrome.storage.sync.get(defaults, sync));
