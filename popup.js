const DEFAULTS = {
  enabled: false,
  imageWidth: 400,
  shortcuts: {
    h1: 'q', h2: 'w', h3: 'e', h4: 'r',
    normal: 't', bullet: 'y',
    removeSpace: 'u',
    bulletFixer: '',
  },
};

// Load saved settings and populate UI
chrome.storage.sync.get(DEFAULTS, ({ enabled, imageWidth, shortcuts }) => {
  document.getElementById('enabled').checked = enabled;
  document.getElementById('imageWidth').value = imageWidth;

  for (const input of document.querySelectorAll('.key-input')) {
    const action = input.dataset.action;
    input.value = shortcuts[action] ?? '';
  }
});

// Toggle
document.getElementById('enabled').addEventListener('change', (e) => {
  chrome.storage.sync.set({ enabled: e.target.checked });
});

// Image width
document.getElementById('imageWidth').addEventListener('change', (e) => {
  const val = Math.max(50, Math.min(2000, parseInt(e.target.value, 10) || 400));
  e.target.value = val;
  chrome.storage.sync.set({ imageWidth: val });
});

// Key recorder: pressing any key in a key-input captures it
for (const input of document.querySelectorAll('.key-input')) {
  input.addEventListener('focus', () => { input.value = ''; });

  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    // Ignore modifier-only keypresses
    if (['Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return;

    // Clear conflicting bindings (one key → one action)
    const newKey = e.key.toLowerCase();
    clearConflict(input.dataset.action, newKey);

    input.value = newKey;
    saveShortcuts();
  });

  // Show placeholder on blur if empty
  input.addEventListener('blur', () => {
    if (!input.value) input.value = '';
  });
}

function clearConflict(currentAction, newKey) {
  for (const other of document.querySelectorAll('.key-input')) {
    if (other.dataset.action !== currentAction && other.value.toLowerCase() === newKey) {
      other.value = '';
    }
  }
}

function saveShortcuts() {
  const shortcuts = {};
  for (const input of document.querySelectorAll('.key-input')) {
    shortcuts[input.dataset.action] = input.value.toLowerCase();
  }
  chrome.storage.sync.set({ shortcuts });
}
