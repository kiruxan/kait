// Content script for text translation extension
// This script handles text selection and tooltip display

(function() {
  'use strict';

  // Constants
  const MAX_WORDS = 1000;

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Count the number of words in a text string
   * @param {string} text - The text to count words in
   * @returns {number} The word count
   */
  function countWords(text) {
    return text.trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
  }

  /**
   * Check if the text is a single word
   * @param {string} text - The text to check
   * @returns {boolean} True if single word
   */
  function isSingleWord(text) {
    return countWords(text) === 1;
  }

  /**
   * Determine the translation mode based on text
   * @param {string} text - The text to analyze
   * @returns {'single'|'long'} The translation mode
   */
  function getTranslationMode(text) {
    return isSingleWord(text) ? 'single' : 'long';
  }

  /**
   * Format duration in milliseconds to human readable format
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration (e.g., "2s 345ms" or "456ms")
   */
  function formatDuration(ms) {
    if (ms >= 1000) {
      const seconds = Math.floor(ms / 1000);
      const milliseconds = ms % 1000;
      return seconds + 's ' + milliseconds + 'ms';
    }
    return ms + 'ms';
  }

  // Tooltip state
  let tooltipHost = null;
  let tooltipElement = null;
  let shadowRoot = null;
  let translateButton = null;

  /**
   * Create the tooltip host element with Shadow DOM
   */
  function createTooltipHost() {
    if (tooltipHost) return;

    tooltipHost = document.createElement('div');
    tooltipHost.id = 'kait-translation-tooltip-host';
    shadowRoot = tooltipHost.attachShadow({ mode: 'closed' });

    // Inject styles into shadow DOM
    const styles = document.createElement('style');
    styles.textContent = `
      .kait-tooltip {
        position: fixed;
        z-index: 2147483647;
        max-width: 400px;
        min-width: 150px;
        padding: 12px 16px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333333;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        pointer-events: auto;
        box-sizing: border-box;
      }

      .kait-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .kait-tooltip-content {
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .kait-tooltip-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666666;
      }

      .kait-tooltip-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e0e0e0;
        border-top-color: #4a90d9;
        border-radius: 50%;
        animation: kait-spin 0.8s linear infinite;
      }

      @keyframes kait-spin {
        to { transform: rotate(360deg); }
      }

      .kait-tooltip-error {
        color: #d93025;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .kait-tooltip-error-icon {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        fill: #d93025;
      }

      .kait-tooltip-error-message {
        flex: 1;
      }

      .kait-tooltip-settings-link {
        color: #4a90d9;
        text-decoration: underline;
        cursor: pointer;
        background: none;
        border: none;
        font: inherit;
        padding: 0;
        margin-top: 8px;
        display: inline-block;
      }

      .kait-tooltip-settings-link:hover {
        color: #357abd;
      }

      /* ============================================ */
      /* Single Word Translation Styles */
      /* ============================================ */

      .kait-tooltip-word-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e8e8e8;
        flex-wrap: wrap;
      }

      .kait-tooltip-word-original {
        font-weight: 600;
        color: #555555;
      }

      .kait-tooltip-word-arrow {
        color: #999999;
        font-size: 0.85em;
      }

      .kait-tooltip-word-primary {
        font-weight: 600;
        color: #333333;
        font-size: 1.1em;
      }

      .kait-tooltip-pos {
        display: inline-block;
        padding: 2px 8px;
        background: #e8f4fc;
        color: #4a90d9;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: 500;
        text-transform: lowercase;
        margin-bottom: 8px;
      }

      .kait-tooltip-pronunciation {
        color: #888888;
        font-size: 0.85em;
        font-style: italic;
        margin-bottom: 8px;
      }

      .kait-tooltip-variants {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .kait-tooltip-variants li {
        padding: 4px 0;
        color: #555555;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .kait-tooltip-variants li::before {
        content: '•';
        color: #4a90d9;
        font-weight: bold;
      }

      .kait-tooltip-variant-primary {
        font-weight: 500;
      }

      /* ============================================ */
      /* Long Text Translation Styles */
      /* ============================================ */

      .kait-tooltip-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8em;
        color: #888888;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e8e8e8;
      }

      .kait-tooltip-header-lang {
        font-weight: 500;
        color: #666666;
      }

      .kait-tooltip-header-dot {
        color: #cccccc;
      }

      .kait-tooltip-header-count {
        color: #999999;
      }

      .kait-tooltip-header-duration {
        margin-left: auto;
        color: #aaaaaa;
        font-size: 0.9em;
      }

      .kait-tooltip-translation {
        font-size: 1em;
        line-height: 1.6;
        color: #333333;
        margin-bottom: 12px;
      }

      .kait-tooltip-notes {
        font-size: 0.9em;
        line-height: 1.5;
        color: #333333;
        font-style: italic;
        padding-top: 10px;
        border-top: 1px solid #e8e8e8;
      }

      /* Floating translate button styles */
      .kait-translate-button {
        position: fixed;
        z-index: 2147483647;
        width: 36px;
        height: 36px;
        padding: 0;
        background: #4a90d9;
        border: none;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transform: scale(0.8);
        transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
        pointer-events: auto;
      }

      .kait-translate-button.visible {
        opacity: 1;
        transform: scale(1);
      }

      .kait-translate-button:hover {
        background: #357abd;
        transform: scale(1.1);
      }

      .kait-translate-button:active {
        transform: scale(0.95);
      }

      .kait-translate-button-icon {
        width: 20px;
        height: 20px;
        fill: #ffffff;
      }
    `;
    shadowRoot.appendChild(styles);

    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'kait-tooltip';
    shadowRoot.appendChild(tooltipElement);

    // Create floating translate button element
    translateButton = document.createElement('button');
    translateButton.className = 'kait-translate-button';
    translateButton.setAttribute('aria-label', 'Translate selected text');
    // Translate icon SVG
    translateButton.innerHTML = `<svg class="kait-translate-button-icon" viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
    // Click handler will be set up later by button trigger mode
    translateButton.addEventListener('click', function(event) {
      // Dispatch custom event for button click handling
      document.dispatchEvent(new CustomEvent('kait-translate-button-click', {
        detail: { originalEvent: event }
      }));
    });
    shadowRoot.appendChild(translateButton);

    document.body.appendChild(tooltipHost);
  }

  /**
   * Show the tooltip with text content
   * @param {string} content - The text content to display
   */
  function showTooltipText(content) {
    if (!tooltipElement) createTooltipHost();

    tooltipElement.innerHTML = `<div class="kait-tooltip-content">${escapeHtml(content)}</div>`;
    tooltipElement.classList.add('visible');
  }

  /**
   * Show the tooltip with loading state
   */
  function showTooltipLoading() {
    if (!tooltipElement) createTooltipHost();

    tooltipElement.innerHTML = `
      <div class="kait-tooltip-loading">
        <div class="kait-tooltip-spinner"></div>
        <span>Translating...</span>
      </div>
    `;
    tooltipElement.classList.add('visible');
  }

  /**
   * Show the tooltip with an error message
   * @param {string} message - The error message to display
   * @param {boolean} showSettingsLink - Whether to show a link to settings
   */
  function showTooltipError(message, showSettingsLink = false) {
    if (!tooltipElement) createTooltipHost();

    const errorIcon = `<svg class="kait-tooltip-error-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

    let settingsLinkHtml = '';
    if (showSettingsLink) {
      settingsLinkHtml = `<button class="kait-tooltip-settings-link" data-action="open-settings">Open extension settings</button>`;
    }

    tooltipElement.innerHTML = `
      <div class="kait-tooltip-error">
        ${errorIcon}
        <div class="kait-tooltip-error-message">
          ${escapeHtml(message)}
          ${settingsLinkHtml}
        </div>
      </div>
    `;
    tooltipElement.classList.add('visible');

    // Add click handler for settings link
    if (showSettingsLink) {
      const settingsLink = tooltipElement.querySelector('[data-action="open-settings"]');
      if (settingsLink) {
        settingsLink.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          chrome.runtime.sendMessage({ action: 'openSettings' });
        });
      }
    }
  }

  /**
   * Show tooltip with single word translation result
   * @param {object} data - The parsed translation data
   * @param {string} originalWord - The original word that was translated
   * @param {number} duration - The API call duration in milliseconds
   */
  function showTooltipSingleWord(data, originalWord, duration) {
    if (!tooltipElement) createTooltipHost();

    const translations = data.translations || [];
    const primaryTranslation = translations[0] || data.translation || '';
    const partOfSpeech = data.partOfSpeech || '';
    const pronunciation = data.pronunciation || '';
    const sourceLanguage = data.sourceLanguage || '';

    // Build variants list (skip first one as it's shown in header)
    let variantsHtml = '';
    if (translations.length > 1) {
      const otherVariants = translations.slice(1);
      variantsHtml = `
        <ul class="kait-tooltip-variants">
          ${otherVariants.map(function(v) { return '<li>' + escapeHtml(v) + '</li>'; }).join('')}
        </ul>
      `;
    }

    // Build pronunciation if available
    let pronunciationHtml = '';
    if (pronunciation) {
      pronunciationHtml = '<div class="kait-tooltip-pronunciation">' + escapeHtml(pronunciation) + '</div>';
    }

    // Build part of speech badge
    let posHtml = '';
    if (partOfSpeech) {
      posHtml = '<span class="kait-tooltip-pos">' + escapeHtml(partOfSpeech) + '</span>';
    }

    // Build duration display
    const durationHtml = duration ? '<span class="kait-tooltip-header-duration">' + formatDuration(duration) + '</span>' : '';

    tooltipElement.innerHTML = `
      <div class="kait-tooltip-word-header">
        <span class="kait-tooltip-word-original">${escapeHtml(originalWord)}</span>
        <span class="kait-tooltip-word-arrow">→</span>
        <span class="kait-tooltip-word-primary">${escapeHtml(primaryTranslation)}</span>
        ${durationHtml}
      </div>
      ${posHtml}
      ${pronunciationHtml}
      ${variantsHtml}
    `;
    tooltipElement.classList.add('visible');
  }

  /**
   * Show tooltip with long text translation result
   * @param {object} data - The parsed translation data
   * @param {number} duration - The API call duration in milliseconds
   */
  function showTooltipLongText(data, duration) {
    if (!tooltipElement) createTooltipHost();

    const translation = data.translation || '';
    const sourceLanguage = data.sourceLanguage || 'Unknown';
    const wordCount = data.wordCount || 0;
    const notes = data.notes || '';

    // Build notes section if available
    let notesHtml = '';
    if (notes) {
      // Split notes by line breaks and render each as a separate line
      const noteLines = notes.split('\n').filter(function(line) { return line.trim().length > 0; });
      const notesContent = noteLines.map(function(line) { return escapeHtml(line.trim()); }).join('<br>');
      notesHtml = `
        <div class="kait-tooltip-notes">
          ${notesContent}
        </div>
      `;
    }

    // Build duration display
    const durationHtml = duration ? '<span class="kait-tooltip-header-duration">' + formatDuration(duration) + '</span>' : '';

    tooltipElement.innerHTML = `
      <div class="kait-tooltip-header">
        <span class="kait-tooltip-header-lang">${escapeHtml(sourceLanguage)}</span>
        <span class="kait-tooltip-header-dot">•</span>
        <span class="kait-tooltip-header-count">${wordCount} words</span>
        ${durationHtml}
      </div>
      <div class="kait-tooltip-translation">${escapeHtml(translation)}</div>
      ${notesHtml}
    `;
    tooltipElement.classList.add('visible');
  }

  /**
   * Display translation result based on mode
   * @param {object} result - The translation result from the service worker
   * @param {string} originalText - The original text that was translated
   * @param {string} mode - The translation mode ('single' or 'long')
   * @param {number} duration - The API call duration in milliseconds
   */
  function displayTranslationResult(result, originalText, mode, duration) {
    // Handle structured data response
    if (result.data) {
      if (result.mode === 'single' || mode === 'single') {
        showTooltipSingleWord(result.data, originalText, duration);
      } else {
        showTooltipLongText(result.data, duration);
      }
    } else if (result.translation) {
      // Fallback: plain text translation (backward compatibility)
      showTooltipText(result.translation);
    } else {
      showTooltipError('Translation failed');
    }
  }

  /**
   * Hide the tooltip
   */
  function hideTooltip() {
    if (tooltipElement) {
      tooltipElement.classList.remove('visible');
    }
  }

  /**
   * Show the floating translate button
   */
  function showTranslateButton() {
    if (!translateButton) createTooltipHost();
    translateButton.classList.add('visible');
  }

  /**
   * Hide the floating translate button
   */
  function hideTranslateButton() {
    if (translateButton) {
      translateButton.classList.remove('visible');
    }
  }

  /**
   * Position the translate button near the given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  function positionTranslateButton(x, y) {
    if (!translateButton) return;

    const padding = 8;
    const buttonSize = 36;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Position the button to the right of and slightly above the selection end
    let left = x + padding;
    let top = y - buttonSize - padding;

    // Adjust if button would go off right edge
    if (left + buttonSize > viewportWidth - padding) {
      left = x - buttonSize - padding;
    }

    // Adjust if button would go off left edge
    if (left < padding) {
      left = padding;
    }

    // Adjust if button would go off top edge
    if (top < padding) {
      top = y + padding;
    }

    // Adjust if button would go off bottom edge
    if (top + buttonSize > viewportHeight - padding) {
      top = viewportHeight - buttonSize - padding;
    }

    translateButton.style.left = `${left}px`;
    translateButton.style.top = `${top}px`;
  }

  /**
   * Position the tooltip near the given coordinates, keeping it within viewport
   * @param {number} x - X coordinate (typically from mouse event or selection)
   * @param {number} y - Y coordinate (typically from mouse event or selection)
   */
  function positionTooltip(x, y) {
    if (!tooltipElement) return;

    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Make tooltip visible temporarily to measure it
    tooltipElement.style.visibility = 'hidden';
    tooltipElement.style.left = '0px';
    tooltipElement.style.top = '0px';

    const rect = tooltipElement.getBoundingClientRect();
    const tooltipWidth = rect.width;
    const tooltipHeight = rect.height;

    // Calculate position - try to place below and to the right of cursor
    let left = x;
    let top = y + padding;

    // Adjust if tooltip would go off right edge
    if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }

    // Adjust if tooltip would go off left edge
    if (left < padding) {
      left = padding;
    }

    // Adjust if tooltip would go off bottom edge - place above instead
    if (top + tooltipHeight > viewportHeight - padding) {
      top = y - tooltipHeight - padding;
    }

    // Adjust if tooltip would go off top edge
    if (top < padding) {
      top = padding;
    }

    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.visibility = 'visible';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - The text to escape
   * @returns {string} - The escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Export functions for use by other parts of the content script
  window.kaitTooltip = {
    create: createTooltipHost,
    showText: showTooltipText,
    showLoading: showTooltipLoading,
    showError: showTooltipError,
    showSingleWord: showTooltipSingleWord,
    showLongText: showTooltipLongText,
    displayResult: displayTranslationResult,
    hide: hideTooltip,
    position: positionTooltip,
    showButton: showTranslateButton,
    hideButton: hideTranslateButton,
    positionButton: positionTranslateButton
  };

  // ============================================
  // Text Selection Detection
  // ============================================

  // Selection state
  let currentSelection = {
    text: '',
    range: null,
    position: { x: 0, y: 0 }
  };

  /**
   * Get the selected text from the page
   * @returns {string} The selected text, trimmed
   */
  function getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return '';
    }
    return selection.toString().trim();
  }

  /**
   * Check if the selected text is valid (non-empty and not just whitespace)
   * @param {string} text - The text to validate
   * @returns {boolean} True if valid, false otherwise
   */
  function isValidSelection(text) {
    return text.length > 0;
  }

  /**
   * Get the position for the tooltip based on the selection
   * @param {MouseEvent} event - The mouseup event
   * @returns {{x: number, y: number}} The x,y coordinates for tooltip positioning
   */
  function getSelectionPosition(event) {
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position at the end of the selection (bottom-right)
      return {
        x: rect.right,
        y: rect.bottom
      };
    }

    // Fallback to mouse position
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  /**
   * Store the current selection range for later use
   * @returns {Range|null} The cloned range or null if no selection
   */
  function storeSelectionRange() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      return selection.getRangeAt(0).cloneRange();
    }
    return null;
  }

  /**
   * Handle mouseup event to detect text selection
   * @param {MouseEvent} event - The mouseup event
   */
  function handleMouseUp(event) {
    // Small delay to ensure selection is complete
    setTimeout(function() {
      const selectedText = getSelectedText();

      if (isValidSelection(selectedText)) {
        // Store selection data
        currentSelection.text = selectedText;
        currentSelection.range = storeSelectionRange();
        currentSelection.position = getSelectionPosition(event);

        // Dispatch custom event for other parts of the extension to handle
        const selectionEvent = new CustomEvent('kait-text-selected', {
          detail: {
            text: currentSelection.text,
            position: currentSelection.position,
            range: currentSelection.range
          }
        });
        document.dispatchEvent(selectionEvent);
      }
    }, 10);
  }

  // Add mouseup event listener
  document.addEventListener('mouseup', handleMouseUp);

  // Export selection functions for use by other parts of the content script
  window.kaitSelection = {
    getText: getSelectedText,
    isValid: isValidSelection,
    getPosition: function() { return currentSelection.position; },
    getRange: function() { return currentSelection.range; },
    getCurrent: function() { return currentSelection; }
  };

  // ============================================
  // Message Passing to Service Worker
  // ============================================

  /**
   * Send a translation request to the service worker
   * @param {string} text - The text to translate
   * @param {string} targetLanguage - The target language
   * @param {string} mode - The translation mode ('single' or 'long')
   * @returns {Promise<{success: boolean, translation?: string, data?: object, error?: string}>}
   */
  function requestTranslation(text, targetLanguage, mode) {
    return new Promise(function(resolve) {
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: text,
          targetLanguage: targetLanguage,
          mode: mode
        },
        function(response) {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: 'Failed to communicate with extension' });
            return;
          }
          resolve(response || { success: false, error: 'No response from service worker' });
        }
      );
    });
  }

  // Export message functions for use by other parts of the content script
  window.kaitMessaging = {
    translate: requestTranslation
  };

  // ============================================
  // Automatic Translation Mode
  // ============================================

  /**
   * Get settings from chrome storage
   * @returns {Promise<{apiKey: string, targetLanguage: string, fontSize: string, triggerMode: string}>}
   */
  function getSettings() {
    return new Promise(function(resolve) {
      chrome.storage.sync.get(
        {
          apiKey: '',
          targetLanguage: 'English',
          fontSize: '14',
          triggerMode: 'automatic'
        },
        function(settings) {
          resolve(settings);
        }
      );
    });
  }

  /**
   * Apply font size to tooltip
   * @param {string} fontSize - Font size in pixels
   */
  function applyTooltipFontSize(fontSize) {
    if (tooltipElement) {
      tooltipElement.style.fontSize = fontSize + 'px';
    }
  }

  /**
   * Check if the error message indicates an API key issue (missing or invalid)
   * @param {string} error - The error message
   * @returns {boolean} True if the error is about API key issues
   */
  function isApiKeyError(error) {
    if (!error) return false;
    const lowerError = error.toLowerCase();
    return lowerError.includes('api key not configured') ||
           lowerError.includes('invalid api key');
  }

  /**
   * Handle automatic translation when text is selected
   * @param {CustomEvent} event - The kait-text-selected event
   */
  async function handleAutoTranslation(event) {
    const { text, position } = event.detail;

    // Get settings to check trigger mode
    const settings = await getSettings();

    // Only proceed if trigger mode is automatic
    if (settings.triggerMode !== 'automatic') {
      return;
    }

    // Position and show tooltip
    createTooltipHost();
    positionTooltip(position.x, position.y);
    applyTooltipFontSize(settings.fontSize);

    // Check word count limit
    const wordCount = countWords(text);
    if (wordCount > MAX_WORDS) {
      showTooltipError('Text is too long (' + wordCount + ' words). Maximum: ' + MAX_WORDS + ' words.');
      return;
    }

    // Check if API key is configured before making request
    if (!settings.apiKey) {
      showTooltipError('API key not configured', true);
      return;
    }

    // Determine translation mode
    const mode = getTranslationMode(text);

    // Show loading state
    showTooltipLoading();

    // Send translation request with mode and measure time
    const startTime = Date.now();
    const result = await requestTranslation(text, settings.targetLanguage, mode);
    const duration = Date.now() - startTime;

    // Display result based on mode
    if (result.success) {
      displayTranslationResult(result, text, mode, duration);
    } else {
      // Show settings link if API key error (missing or invalid)
      const showSettingsLink = isApiKeyError(result.error);
      showTooltipError(result.error || 'Translation failed', showSettingsLink);
    }
  }

  // Listen for text selection events
  document.addEventListener('kait-text-selected', handleAutoTranslation);

  // Export automatic translation functions
  window.kaitAutoTranslate = {
    getSettings: getSettings,
    handleAutoTranslation: handleAutoTranslation,
    isApiKeyError: isApiKeyError
  };

  // ============================================
  // Button Trigger Mode
  // ============================================

  // Store current selection for button mode
  let pendingButtonSelection = null;

  /**
   * Handle button trigger mode when text is selected
   * @param {CustomEvent} event - The kait-text-selected event
   */
  async function handleButtonTriggerMode(event) {
    const { text, position } = event.detail;

    // Get settings to check trigger mode
    const settings = await getSettings();

    // Only proceed if trigger mode is button
    if (settings.triggerMode !== 'button') {
      return;
    }

    // Store the selection for later use when button is clicked
    pendingButtonSelection = {
      text: text,
      position: position,
      targetLanguage: settings.targetLanguage
    };

    // Hide any existing tooltip
    hideTooltip();

    // Create elements if needed
    createTooltipHost();

    // Position and show the translate button near selection
    positionTranslateButton(position.x, position.y);
    showTranslateButton();
  }

  /**
   * Handle click on the translate button
   * @param {CustomEvent} customEvent - The kait-translate-button-click event
   */
  async function handleTranslateButtonClick(customEvent) {
    // Prevent default on the original mouse event
    if (customEvent.detail && customEvent.detail.originalEvent) {
      customEvent.detail.originalEvent.preventDefault();
      customEvent.detail.originalEvent.stopPropagation();
    }

    if (!pendingButtonSelection) {
      return;
    }

    const { text, position, targetLanguage } = pendingButtonSelection;

    // Hide the button
    hideTranslateButton();

    // Position tooltip and apply font size
    positionTooltip(position.x, position.y);
    const settings = await getSettings();
    applyTooltipFontSize(settings.fontSize);

    // Check word count limit
    const wordCount = countWords(text);
    if (wordCount > MAX_WORDS) {
      showTooltipError('Text is too long (' + wordCount + ' words). Maximum: ' + MAX_WORDS + ' words.');
      pendingButtonSelection = null;
      return;
    }

    // Check if API key is configured before making request
    if (!settings.apiKey) {
      showTooltipError('API key not configured', true);
      pendingButtonSelection = null;
      return;
    }

    // Determine translation mode
    const mode = getTranslationMode(text);

    // Show loading state
    showTooltipLoading();

    // Send translation request with mode and measure time
    const startTime = Date.now();
    const result = await requestTranslation(text, targetLanguage, mode);
    const duration = Date.now() - startTime;

    // Display result based on mode
    if (result.success) {
      displayTranslationResult(result, text, mode, duration);
    } else {
      // Show settings link if API key error (missing or invalid)
      const showSettingsLink = isApiKeyError(result.error);
      showTooltipError(result.error || 'Translation failed', showSettingsLink);
    }

    // Clear pending selection
    pendingButtonSelection = null;
  }

  /**
   * Handle clicks outside the button to dismiss it
   * @param {MouseEvent} event - The click event
   */
  function handleOutsideClick(event) {
    // If clicking inside the tooltip host (button or tooltip), ignore
    if (tooltipHost && tooltipHost.contains(event.target)) {
      return;
    }

    // Hide the button if visible
    hideTranslateButton();
    pendingButtonSelection = null;
  }

  // Listen for text selection events for button mode
  document.addEventListener('kait-text-selected', handleButtonTriggerMode);

  // Listen for translate button click
  document.addEventListener('kait-translate-button-click', handleTranslateButtonClick);

  // Add click listener to document for outside clicks
  document.addEventListener('mousedown', handleOutsideClick);

  // ============================================
  // Tooltip Dismissal Behavior
  // ============================================

  /**
   * Handle clicks outside the tooltip to dismiss it
   * @param {MouseEvent} event - The click event
   */
  function handleTooltipOutsideClick(event) {
    // If clicking inside the tooltip host (button or tooltip), ignore
    if (tooltipHost && tooltipHost.contains(event.target)) {
      return;
    }

    // Hide the tooltip if visible
    hideTooltip();
  }

  /**
   * Handle new text selection - dismiss tooltip when new selection starts
   * @param {CustomEvent} event - The kait-text-selected event
   */
  function handleDismissOnNewSelection(event) {
    // Hide the tooltip when a new selection is made
    // This runs before the translation handlers to clear the previous tooltip
    hideTooltip();
  }

  // Add click listener to dismiss tooltip when clicking outside
  document.addEventListener('click', handleTooltipOutsideClick);

  // Listen for new text selection to dismiss existing tooltip
  // Use capture phase to ensure this runs before translation handlers
  document.addEventListener('kait-text-selected', handleDismissOnNewSelection, true);

  /**
   * Handle scroll events to dismiss tooltip and button
   * Since tooltip uses fixed positioning, it won't follow the selection during scroll
   */
  function handleScroll() {
    hideTooltip();
    hideTranslateButton();
    pendingButtonSelection = null;
  }

  // Add scroll listener to dismiss tooltip when scrolling
  // Use passive: true for better scroll performance
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Export tooltip dismissal functions
  window.kaitDismissal = {
    handleOutsideClick: handleTooltipOutsideClick,
    handleNewSelection: handleDismissOnNewSelection,
    handleScroll: handleScroll
  };

  // Export button trigger mode functions
  window.kaitButtonMode = {
    handleButtonTriggerMode: handleButtonTriggerMode,
    getPendingSelection: function() { return pendingButtonSelection; }
  };

})();
