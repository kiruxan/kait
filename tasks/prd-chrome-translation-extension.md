# PRD: Chrome Translation Extension (Grok XAI)

## Introduction

A Chrome browser extension that enables users to translate selected text on any web page using the Grok XAI API. When users select text (words or paragraphs), a tooltip-style popup displays the translation. The extension auto-detects the source language and translates to a user-configured target language. The trigger behavior is configurable between automatic popup on selection or a floating button click.

## Goals

- Provide seamless in-page translation without leaving the current website
- Auto-detect source language for any selected text
- Display translations in a non-intrusive tooltip popup
- Allow users to configure target language and API key in extension settings
- Support configurable trigger behavior (automatic vs. button click)

## User Stories

### US-001: Extension manifest and project structure
**Description:** As a developer, I need the basic Chrome extension structure so the extension can be loaded in the browser.

**Acceptance Criteria:**
- [ ] Create `manifest.json` with Manifest V3 format
- [ ] Configure required permissions: `activeTab`, `storage`, `contextMenus`
- [ ] Set up content script to run on all URLs
- [ ] Extension loads in Chrome without errors

### US-002: Settings page with API key storage
**Description:** As a user, I want to configure my XAI API key so the extension can make translation requests.

**Acceptance Criteria:**
- [ ] Settings page accessible from extension popup/options
- [ ] Input field for XAI API key (masked/password type)
- [ ] Save button stores API key in `chrome.storage.sync`
- [ ] Saved API key persists across browser sessions
- [ ] Show success message on save

### US-003: Target language configuration
**Description:** As a user, I want to select my preferred target language so translations appear in my desired language.

**Acceptance Criteria:**
- [ ] Dropdown with common languages (English, Spanish, French, German, Chinese, Japanese, Korean, Russian, Portuguese, Italian, etc.)
- [ ] Default to English if not configured
- [ ] Selection saved to `chrome.storage.sync`
- [ ] Setting persists across browser sessions

### US-004: Trigger mode configuration
**Description:** As a user, I want to choose how translations are triggered so I can control when popups appear.

**Acceptance Criteria:**
- [ ] Toggle/radio option in settings: "Automatic" vs "Button click"
- [ ] Default to "Automatic" mode
- [ ] Setting saved to `chrome.storage.sync`
- [ ] Change takes effect immediately without page reload

### US-005: Text selection detection
**Description:** As a user, I want the extension to detect when I select text so it can offer translation.

**Acceptance Criteria:**
- [ ] Content script listens for `mouseup` events
- [ ] Captures selected text via `window.getSelection()`
- [ ] Ignores empty selections or whitespace-only
- [ ] Works on paragraphs and single words
- [ ] Works across all websites

### US-006: Automatic translation popup (default mode)
**Description:** As a user, I want a translation popup to appear automatically when I select text so I get instant translations.

**Acceptance Criteria:**
- [ ] Popup appears near the selected text within 100ms of selection
- [ ] Shows loading indicator while fetching translation
- [ ] Displays translated text when complete
- [ ] Popup positioned to not overflow viewport edges

### US-007: Floating button trigger (configurable mode)
**Description:** As a user, I want a small button to appear after selection so I can choose when to translate.

**Acceptance Criteria:**
- [ ] Small translate icon/button appears near selection end
- [ ] Button appears only when "Button click" mode is enabled
- [ ] Clicking button triggers translation popup
- [ ] Button disappears when clicking elsewhere

### US-008: XAI API integration for translation
**Description:** As a developer, I need to integrate with Grok XAI API to perform translations.

**Acceptance Criteria:**
- [ ] Function to call XAI API with selected text
- [ ] Request includes: text to translate, target language
- [ ] Prompt instructs model to auto-detect source language
- [ ] Parse and return translated text from response
- [ ] Handle API errors gracefully

### US-009: Translation tooltip UI
**Description:** As a user, I want to see translations in a clean tooltip so I can read them easily.

**Acceptance Criteria:**
- [ ] Tooltip styled to match modern browser aesthetic
- [ ] Shows translated text clearly
- [ ] Tooltip disappears when clicking outside of it
- [ ] Tooltip disappears when making a new selection
- [ ] Does not interfere with page content/scrolling

### US-010: API key missing error handling
**Description:** As a user, I want clear feedback when the API key is not configured so I know how to fix it.

**Acceptance Criteria:**
- [ ] If API key is missing, show error in tooltip: "API key not configured"
- [ ] Include clickable link/button to open settings
- [ ] Do not make API call if key is missing

### US-011: API error handling
**Description:** As a user, I want to see helpful error messages when translation fails so I understand what went wrong.

**Acceptance Criteria:**
- [ ] Display user-friendly error message in tooltip
- [ ] Handle network errors: "Network error. Please check your connection."
- [ ] Handle invalid API key: "Invalid API key. Please check settings."
- [ ] Handle rate limiting: "Too many requests. Please wait a moment."

## Functional Requirements

- FR-1: Extension must use Chrome Manifest V3 format
- FR-2: Store API key and settings in `chrome.storage.sync` for cross-device sync
- FR-3: Content script must inject into all web pages (`<all_urls>`)
- FR-4: Auto-detect source language using XAI model's capabilities (include in prompt)
- FR-5: Translation popup must appear within 500ms of trigger
- FR-6: Popup must be positioned relative to selection, within viewport bounds
- FR-7: Popup must be removed when user clicks outside or makes new selection
- FR-8: Default trigger mode: automatic popup on selection
- FR-9: Default target language: English
- FR-10: API requests must include proper error handling and timeout (30s max)

## Non-Goals

- No pronunciation or phonetics display
- No word definitions or examples
- No translation history
- No website whitelist/blacklist
- No offline translation capability
- No bulk/page translation
- No keyboard shortcuts (initial version)
- No copy button on tooltip (initial version)

## Technical Considerations

### Extension Structure
```
extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   └── popup.js
├── options/
│   ├── options.html
│   └── options.js
├── content/
│   ├── content.js
│   └── content.css
├── background/
│   └── service-worker.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### XAI API Integration
- Endpoint: `https://api.x.ai/v1/chat/completions`
- Model: `grok-2-latest` (or appropriate model)
- Prompt structure should request translation with auto-detection:
  ```
  Translate the following text to [TARGET_LANGUAGE].
  Auto-detect the source language.
  Return only the translated text, no explanations.

  Text: [SELECTED_TEXT]
  ```

### Chrome APIs Used
- `chrome.storage.sync` - Settings persistence
- `chrome.runtime.sendMessage` - Content script to background communication
- `chrome.action` - Extension popup/icon

### Styling
- Tooltip should use CSS isolation (Shadow DOM or unique class prefixes)
- Prevent page styles from affecting tooltip appearance
- Use system fonts for consistency

## Success Metrics

- Translation appears within 500ms of trigger
- Extension works on 99% of websites without conflicts
- API errors are handled gracefully with clear user messaging
- Settings persist correctly across browser sessions and devices

## Open Questions

- Should we support multiple target languages that user can switch between quickly?
- Should there be a visual indicator showing detected source language?
- What is the maximum text length we should allow for translation?
- Should we add a "close" button to the tooltip or rely only on click-outside?
