// Settings storage functionality

// DOM elements
const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model');
const targetLanguageSelect = document.getElementById('target-language');
const fontSizeSelect = document.getElementById('font-size');
const triggerModeRadios = document.querySelectorAll('input[name="triggerMode"]');
const statusMessage = document.getElementById('status-message');

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'grok-4-1-fast-non-reasoning',
  targetLanguage: 'English',
  fontSize: '14',
  triggerMode: 'automatic'
};

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Handle form submission
form.addEventListener('submit', saveSettings);

/**
 * Load saved settings from chrome.storage.sync and populate the form
 */
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
    // Populate API key
    apiKeyInput.value = result.apiKey || '';

    // Populate model selection
    modelSelect.value = result.model || DEFAULT_SETTINGS.model;

    // Populate target language (default to English if not set)
    targetLanguageSelect.value = result.targetLanguage || DEFAULT_SETTINGS.targetLanguage;

    // Populate font size
    fontSizeSelect.value = result.fontSize || DEFAULT_SETTINGS.fontSize;

    // Populate trigger mode (default to automatic if not set)
    const triggerMode = result.triggerMode || DEFAULT_SETTINGS.triggerMode;
    triggerModeRadios.forEach((radio) => {
      radio.checked = radio.value === triggerMode;
    });
  });
}

/**
 * Save settings to chrome.storage.sync
 * @param {Event} event - Form submit event
 */
function saveSettings(event) {
  event.preventDefault();

  // Get selected trigger mode
  let selectedTriggerMode = DEFAULT_SETTINGS.triggerMode;
  triggerModeRadios.forEach((radio) => {
    if (radio.checked) {
      selectedTriggerMode = radio.value;
    }
  });

  // Prepare settings object
  const settings = {
    apiKey: apiKeyInput.value,
    model: modelSelect.value,
    targetLanguage: targetLanguageSelect.value,
    fontSize: fontSizeSelect.value,
    triggerMode: selectedTriggerMode
  };

  // Save to chrome.storage.sync
  chrome.storage.sync.set(settings, () => {
    // Check for errors
    if (chrome.runtime.lastError) {
      showStatus('Error saving settings. Please try again.', 'error');
      return;
    }

    // Show success message
    showStatus('Settings saved successfully!', 'success');
  });
}

/**
 * Display status message to the user
 * @param {string} message - Message to display
 * @param {string} type - Type of message ('success' or 'error')
 */
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 3000);
  }
}
