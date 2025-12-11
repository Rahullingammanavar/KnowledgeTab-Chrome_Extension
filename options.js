document.addEventListener('DOMContentLoaded', () => {
    // FIX: Set worker source here to avoid CSP inline script errors
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

    // UI Elements
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const keyStatus = document.getElementById('keyStatus');
    const dropZone = document.getElementById('dropZone');
    const pdfInput = document.getElementById('pdfInput');
    const uploadStatus = document.getElementById('uploadStatus');
    const bookList = document.getElementById('bookList');
    const totalQuotesEl = document.getElementById('totalQuotes');
    const customQuotesEl = document.getElementById('customQuotes');
    const resetBtn = document.getElementById('resetBtn');

    // Load saved data
    loadSettings();

    // Event Listeners
    saveKeyBtn.addEventListener('click', saveApiKey);

    // File Upload Handling
    dropZone.addEventListener('click', () => pdfInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ffd700';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        handleFiles(e.dataTransfer.files);
    });
    pdfInput.addEventListener('change', (e) => handleFiles(e.target.files));

    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all your saved books and quotes?')) {
            chrome.storage.local.clear(() => {
                location.reload();
            });
        }
    });

    // STORAGE FUNCTIONS
    function loadSettings() {
        chrome.storage.local.get(['geminiApiKey', 'processedBooks', 'customQuotes'], (result) => {
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
            }

            const books = result.processedBooks || [];
            updateBookList(books);

            // Updates stats
            // We need to count built-in quotes + custom quotes
            // Ideally we'd import quotes.js, but since it's an options page and quotes.js is global in newtab... 
            // For now, we'll just show custom quotes stats until we unify the data source.
            // Let's assume ~20 built-in quotes.
            const customCount = (result.customQuotes || []).length;
            customQuotesEl.textContent = customCount;
            totalQuotesEl.textContent = 22 + customCount; // 22 is approx base count
        });
    }

    function saveApiKey() {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showStatus(keyStatus, 'Please enter a valid API Key.', 'error');
            return;
        }

        chrome.storage.local.set({ geminiApiKey: key }, () => {
            showStatus(keyStatus, 'API Key saved successfully!', 'success');
        });
    }

    // FILE HANDLING
    async function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];

        if (file.type !== 'application/pdf') {
            showStatus(uploadStatus, 'Please upload a valid PDF file.', 'error');
            return;
        }

        // Show loading state
        showStatus(uploadStatus, `Processing ${file.name}... This may take a moment.`, 'success');

        try {
            // 1. Check API Key
            const data = await chrome.storage.local.get(['geminiApiKey', 'processedBooks']);
            if (!data.geminiApiKey) {
                showStatus(uploadStatus, 'Error: Please save your Gemini API Key first.', 'error');
                return;
            }

            // 2. Read PDF
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            let fullText = '';
            // Limit to first 40 pages to ensure we get good content but stay within reasonable limits
            // Most "Intro" and "Chapter 1" wisdom is here.
            const maxPages = Math.min(pdf.numPages, 40);

            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
            }

            if (fullText.length < 500) {
                showStatus(uploadStatus, 'Error: Could not extract enough text. Is this a scanned PDF?', 'error');
                return;
            }

            // 3. Send to AI
            showStatus(uploadStatus, `Analyzing text with Gemini AI (0/${maxPages} pages read)...`, 'success');
            const extractedQuotes = await AIService.extractQuotes(fullText, data.geminiApiKey);

            // 4. Save Results
            // Add book title to each quote
            const newQuotes = extractedQuotes.map(q => ({
                text: q.text,
                author: q.author || "Unknown",
                book: file.name.replace('.pdf', '')
            }));

            // Save text to "customQuotes"
            const currentCustomQuotes = (await chrome.storage.local.get('customQuotes')).customQuotes || [];
            const updatedCustomQuotes = [...currentCustomQuotes, ...newQuotes];

            // Update books list
            const currentBooks = data.processedBooks || [];
            if (!currentBooks.some(b => b.title === file.name)) {
                currentBooks.push({
                    title: file.name,
                    quoteCount: newQuotes.length,
                    date: new Date().toISOString()
                });
            }

            await chrome.storage.local.set({
                customQuotes: updatedCustomQuotes,
                processedBooks: currentBooks
            });

            // 5. Update UI
            updateBookList(currentBooks);
            // Update stats
            const total = 22 + updatedCustomQuotes.length;
            customQuotesEl.textContent = updatedCustomQuotes.length;
            totalQuotesEl.textContent = total;

            showStatus(uploadStatus, `Success! Extracted ${newQuotes.length} quotes from "${file.name}".`, 'success');

        } catch (error) {
            console.error(error);
            showStatus(uploadStatus, `Error: ${error.message}`, 'error');
        }
    }

    // HELPER UI
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status ${type}`;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status';
        }, 5000);
    }

    function updateBookList(books) {
        bookList.innerHTML = '';
        if (!books || books.length === 0) {
            bookList.innerHTML = '<li style="color: #9aa0a6; padding: 1rem; text-align: center;">No books processed yet.</li>';
            return;
        }

        books.forEach(book => {
            const li = document.createElement('li');
            li.className = 'book-item';
            li.innerHTML = `
                <span>${book.title}</span>
                <span class="badge">${book.quoteCount} quotes</span>
            `;
            bookList.appendChild(li);
        });
    }
});
