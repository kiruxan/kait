# Kait — Text Translator Chrome Extension

A Chrome extension that translates selected text on any web page using the [Grok XAI API](https://x.ai/). Select text to see a translation popup; source language is detected automatically.

## Prerequisites

- Google Chrome (or another Chromium-based browser)
- An [XAI API key](https://console.x.ai/)

## Install in Chrome

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `extension` folder inside this repository (not the repo root).

The extension should appear in your toolbar as **Text Translator**.

## Configure

1. On `chrome://extensions`, find **Text Translator** and click **Details**.
2. Click **Extension options** (or open the options page from the extension card).
3. Enter your **XAI API key** and adjust settings:
   - **AI Model** — Grok model used for translation
   - **Target Language** — language to translate into (default: English)
   - **Popup Font Size** — size of the translation popup
   - **Trigger Mode** — *Automatic* (popup on text selection) or *Button click* (show a button first)
4. Click **Save Settings**.

## Usage

1. Open any web page.
2. Select a word or paragraph.
3. In **Automatic** mode, a translation popup appears near the selection.
4. In **Button click** mode, click the translate button that appears after selecting text.

## Update after code changes

After pulling or editing extension files:

1. Go to `chrome://extensions`.
2. Click the **Reload** icon on the Text Translator card.

## Project structure

```
extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── background/            # Service worker (API calls)
├── content/               # Content script (selection + popup UI)
├── options/               # Settings page
└── icons/                 # Extension icons
```
