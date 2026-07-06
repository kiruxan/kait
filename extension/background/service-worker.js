// Service worker for handling translation API calls

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_MODEL = 'grok-4-1-fast-non-reasoning';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Generate prompt for single word translation
 * @param {string} word - The word to translate
 * @param {string} targetLanguage - The target language
 * @returns {string} The prompt
 */
function getSingleWordPrompt(word, targetLanguage) {
  return `Translate the word "${word}" to ${targetLanguage}. Auto-detect the source language.

Return a JSON object with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
{
  "sourceLanguage": "the detected source language name",
  "partOfSpeech": "noun/verb/adjective/adverb/etc",
  "translations": ["primary translation", "variant 2", "variant 3"],
  "pronunciation": "phonetic pronunciation of the original word (optional, can be null)"
}

Rules:
- "translations" must have 2-3 translation variants, ordered by most common usage
- "partOfSpeech" should be the most common grammatical role of this word
- Return ONLY the JSON object, nothing else`;
}

/**
 * Count words in a text string
 * @param {string} text - The text to count words in
 * @returns {number} The word count
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Generate prompt for long text translation
 * @param {string} text - The text to translate
 * @param {string} targetLanguage - The target language
 * @returns {string} The prompt
 */
function getLongTextPrompt(text, targetLanguage) {
  return `Translate the following text to ${targetLanguage}. Auto-detect the source language.

Return a JSON object with EXACTLY this structure (no markdown, no code blocks, just raw JSON):
{
  "sourceLanguage": "the detected source language name",
  "translation": "the full translated text",
  "notes": "brief notes in ${targetLanguage}, separated by \\n"
}

Text to translate:
${text}

Rules:
- Return ONLY the JSON object, nothing else
- "translation" should be the complete, accurate translation
- "notes" should be written in ${targetLanguage}, be very brief, and only include important info (idioms, cultural references, rare words). Use \\n to separate different notes. If nothing notable, return empty string ""`;
}

/**
 * Translates text using the Grok XAI API
 * @param {string} text - The text to translate
 * @param {string} targetLanguage - The target language for translation
 * @param {string} apiKey - The XAI API key
 * @param {string} mode - The translation mode ('single' or 'long')
 * @param {string} model - The AI model to use
 * @returns {Promise<{success: boolean, translation?: string, data?: object, error?: string}>}
 */
async function translateText(text, targetLanguage, apiKey, mode = 'long', model = DEFAULT_MODEL) {
  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'No text provided' };
  }

  // Select prompt based on mode
  const prompt = mode === 'single' 
    ? getSingleWordPrompt(text, targetLanguage)
    : getLongTextPrompt(text, targetLanguage);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;

      if (status === 401) {
        return { success: false, error: 'Invalid API key. Please check settings.' };
      }

      if (status === 429) {
        return { success: false, error: 'Too many requests. Please wait a moment.' };
      }

      // Generic error for other status codes
      return { success: false, error: 'Translation failed. Please try again.' };
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      const content = data.choices[0].message.content.trim();
      
      // Try to parse as JSON for structured responses
      try {
        // Remove potential markdown code blocks
        let jsonContent = content;
        if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        
        const parsedData = JSON.parse(jsonContent);
        
        // Add word count locally for long text mode
        if (mode === 'long') {
          parsedData.wordCount = countWords(text);
        }
        
        return { success: true, data: parsedData, mode: mode };
      } catch (parseError) {
        // Fallback: return as plain translation for backward compatibility
        return { success: true, translation: content, mode: 'fallback' };
      }
    }

    return { success: false, error: 'Invalid response from API' };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Please try again.' };
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }

    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

// ============================================
// Message Handling
// ============================================

/**
 * Handle incoming messages from content scripts
 * @param {Object} message - The message object
 * @param {chrome.runtime.MessageSender} sender - The sender info
 * @param {function} sendResponse - Function to send response back
 * @returns {boolean} True to indicate async response
 */
function handleMessage(message, sender, sendResponse) {
  if (message.action === 'translate') {
    handleTranslateRequest(message, sendResponse);
    return true; // Indicates async response
  }

  if (message.action === 'openSettings') {
    chrome.runtime.openOptionsPage();
    return false;
  }

  return false;
}

/**
 * Handle translation request from content script
 * @param {Object} message - The message with text, targetLanguage, and mode
 * @param {function} sendResponse - Function to send response back
 */
async function handleTranslateRequest(message, sendResponse) {
  const { text, targetLanguage, mode } = message;

  try {
    // Retrieve API key and model from storage
    const result = await chrome.storage.sync.get(['apiKey', 'model']);
    const apiKey = result.apiKey;
    const model = result.model || DEFAULT_MODEL;

    if (!apiKey) {
      sendResponse({ success: false, error: 'API key not configured' });
      return;
    }

    // Call translate function with mode and model
    const translationResult = await translateText(text, targetLanguage, apiKey, mode, model);
    sendResponse(translationResult);

  } catch (error) {
    sendResponse({ success: false, error: 'Failed to process translation request' });
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(handleMessage);
