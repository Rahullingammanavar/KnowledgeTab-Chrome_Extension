# Self-Help Wisdom - Chrome Extension

Transform your new tab page into a source of daily inspiration. "Self-Help Wisdom" replaces the default new tab with powerful quotes from your favorite self-help books. It uses Google's Gemini AI to analyze your personal PDF library and build a custom knowledge base of wisdom that matters to you.

## Features

*   **Daily Inspiration**: A clean, beautiful new tab page featuring a randomized quote.
*   **AI-Powered Extraction**: Upload any PDF book, and the built-in Gemini AI integration will read it and extract the most meaningful quotes and insights automatically.
*   **Personal Knowledge Base**: Build a library of wisdom from the books you've read.
*   **Customizable**: Manage your API key and processed books via the Options page.
*   **Privacy Focused**: All your data and extracted quotes are stored locally in your browser. Nothing is sent to any server except the text you explicitly process with the Gemini API.

---

## How to Install (for Users)

Since this extension is not on the Chrome Web Store, you can install it manually in Developer Mode. It's safe and easy!

### Step 1: Download the Code
1.  Click the green **Code** button on this GitHub page.
2.  Select **Download ZIP**.
3.  Unzip the downloaded file to a folder on your computer. Remember where you put it!

### Step 2: Load into Chrome
1.  Open Google Chrome and type `chrome://extensions` in the address bar.
2.  In the top-right corner, turn on the **Developer mode** toggle switch.
3.  Click the **Load unpacked** button that appeared in the top-left corner.
4.  Select the folder you unzipped in Step 1 (the folder that contains `manifest.json`).

### Step 3: Setup your API Key
To extract meaningful quotes from your books, you need a free API key from Google.
1.  Click the extension icon in your browser toolbar (it looks like a puzzle piece).
2.  Click **"Self-Help Wisdom"** -> **Extension Options** (or right-click the icon and choose Options).
3.  Click the link to **Get a free Google Gemini API Key** (or go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)).
4.  Paste your key into the box and click **Save**.

---

## How to Use

1.  **Open the Options Page**: If you aren't there already, right-click the extension icon and select "Options".
2.  **Upload a Book**: Drag and drop a PDF of a self-help book into the "Upload New Book" area.
3.  **Wait for Magic**: The extension will read the book and use AI to extract the best quotes. This might take 10-30 seconds.
4.  **Enjoy**: Open a new tab! You will see a quote from your newly processed book. Every time you open a tab, you'll get a new dose of wisdom.

---

## For Developers

Feel free to fork this repository and improve it!

**Tech Stack:**
*   Vanilla JavaScript (No framework bloat)
*   Chrome Extensions API (Manifest V3)
*   PDF.js (for reading PDFs)
*   Google Gemini API (for AI text analysis)
