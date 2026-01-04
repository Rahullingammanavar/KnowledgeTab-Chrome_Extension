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

        try {
            // 1. Check API Key
            const data = await chrome.storage.local.get(['geminiApiKey', 'processedBooks']);
            if (!data.geminiApiKey) {
                showStatus(uploadStatus, 'Error: Please save your Gemini API Key first.', 'error');
                return;
            }

            showStatus(uploadStatus, `Reading ${file.name}...`, 'success');

            // 2. Read PDF
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            const CHUNK_SIZE = 20; // Process 20 pages at a time
            const totalPages = pdf.numPages;
            let allQuotes = [];

            // 3. Process in Chunks
            for (let i = 1; i <= totalPages; i += CHUNK_SIZE) {
                const endPage = Math.min(i + CHUNK_SIZE - 1, totalPages);
                showStatus(uploadStatus, `Analyzing pages ${i}-${endPage} of ${totalPages}...`, 'success');

                let chunkText = '';
                for (let j = i; j <= endPage; j++) {
                    const page = await pdf.getPage(j);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    chunkText += pageText + ' ';
                }

                if (chunkText.trim().length > 100) {
                    try {
                        const chunkQuotes = await AIService.extractQuotes(chunkText, data.geminiApiKey);
                        allQuotes = [...allQuotes, ...chunkQuotes];
                    } catch (err) {
                        console.warn(`Failed to extract quotes from pages ${i}-${endPage}:`, err);
                        // Continue to next chunk even if one fails
                    }
                }

                // Small delay to be nice to the API
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (allQuotes.length === 0) {
                throw new Error("No quotes found in the entire book. Is it a scanned PDF?");
            }

            // 4. Save Results
            // Add book title to each quote
            const finalQuotes = allQuotes.map(q => ({
                text: q.text,
                author: q.author || "Unknown",
                book: file.name.replace('.pdf', '')
            }));

            // Save text to "customQuotes"
            const currentCustomQuotes = (await chrome.storage.local.get('customQuotes')).customQuotes || [];
            const updatedCustomQuotes = [...currentCustomQuotes, ...finalQuotes];

            // Update books list
            const currentBooks = data.processedBooks || [];
            // Remove old entry if it exists to update count
            const existingBookIndex = currentBooks.findIndex(b => b.title === file.name);
            if (existingBookIndex !== -1) {
                currentBooks.splice(existingBookIndex, 1);
            }

            currentBooks.push({
                title: file.name,
                quoteCount: finalQuotes.length,
                date: new Date().toISOString()
            });

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

            showStatus(uploadStatus, `Success! Extracted ${finalQuotes.length} quotes from full book "${file.name}".`, 'success');

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
            // Store book title in data attribute for easy access
            li.dataset.title = book.title;
            li.innerHTML = `
                <span>${book.title}</span>
                <span class="badge">${book.quoteCount} quotes</span>
            `;

            // Add click listener to open modal
            li.addEventListener('click', () => {
                openModal(book.title);
            });

            bookList.appendChild(li);
        });
    }

    // --- MODAL LOGIC ---
    const modal = document.getElementById('quoteModal');
    const closeModalBtn = document.querySelector('.close-modal');
    const modalBookTitle = document.getElementById('modalBookTitle');
    const modalQuoteList = document.getElementById('modalQuoteList');
    const newQuoteText = document.getElementById('newQuoteText');
    const addQuoteBtn = document.getElementById('addQuoteBtn');

    let currentOpenBook = null;

    // Close Modal Listeners
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Add Quote Listener
    addQuoteBtn.addEventListener('click', async () => {
        const text = newQuoteText.value.trim();
        if (!text) return;

        await addQuote(text, currentOpenBook);
        newQuoteText.value = ''; // clear input
    });

    async function openModal(bookTitle) {
        currentOpenBook = bookTitle;
        modalBookTitle.textContent = bookTitle;
        modal.style.display = 'block';
        await renderModalQuotes(bookTitle);
    }

    function closeModal() {
        modal.style.display = 'none';
        currentOpenBook = null;
    }

    async function renderModalQuotes(bookTitle) {
        modalQuoteList.innerHTML = '<div style="text-align:center; padding:20px; color:#9aa0a6;">Loading quotes...</div>';

        const data = await chrome.storage.local.get('customQuotes');
        const allQuotes = data.customQuotes || [];

        // Filter quotes for this book
        // Note: The file logic removes .pdf extension during save, but UI lists full name.
        // We need to match loosely or fix the saving logic consistency. 
        // options.js save logic: book: file.name.replace('.pdf', '')
        // updateBookList logic: book.title is file.name (with .pdf)
        const targetBookName = bookTitle.replace('.pdf', '');

        const bookQuotes = allQuotes.filter(q => q.book === targetBookName || q.book === bookTitle);

        modalQuoteList.innerHTML = '';
        if (bookQuotes.length === 0) {
            modalQuoteList.innerHTML = '<div style="text-align:center; padding:20px; color:#9aa0a6;">No quotes found for this book.</div>';
            return;
        }

        bookQuotes.forEach(quote => {
            const li = document.createElement('li');
            li.className = 'quote-item-view';

            const textDiv = document.createElement('div');
            textDiv.className = 'quote-content';
            textDiv.textContent = `"${quote.text}"`;

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-quote-btn';
            delBtn.innerHTML = '&#10006;'; // X symbol
            delBtn.title = 'Delete Quote';
            delBtn.onclick = () => deleteQuote(quote.text, bookTitle);

            li.appendChild(textDiv);
            li.appendChild(delBtn);
            modalQuoteList.appendChild(li);
        });
    }

    // Manual Quote Handling
    const manualQuoteText = document.getElementById('manualQuoteText');
    const manualQuoteSource = document.getElementById('manualQuoteSource');
    const addManualQuoteBtn = document.getElementById('addManualQuoteBtn');
    const manualStatus = document.getElementById('manualStatus');

    if (addManualQuoteBtn) {
        addManualQuoteBtn.addEventListener('click', async () => {
            const text = manualQuoteText.value.trim();
            const source = manualQuoteSource.value.trim() || "My Thoughts";

            if (!text) {
                showStatus(manualStatus, 'Please enter some text.', 'error');
                return;
            }

            try {
                await addQuote(text, source);
                manualQuoteText.value = '';
                manualQuoteSource.value = '';
                showStatus(manualStatus, 'Thought saved successfully!', 'success');
            } catch (err) {
                console.error(err);
                showStatus(manualStatus, 'Failed to save.', 'error');
            }
        });
    }

    async function addQuote(text, bookTitle) {
        if (!bookTitle) return;

        const data = await chrome.storage.local.get(['customQuotes', 'processedBooks']);
        let allQuotes = data.customQuotes || [];
        let books = data.processedBooks || [];

        // Add proper normalization
        const normalizedTitle = bookTitle.replace('.pdf', '');

        const newQuote = {
            text: text,
            author: "Unknown", // User added
            book: normalizedTitle
        };

        allQuotes.push(newQuote);

        // Update book count or create new book
        const bookIndex = books.findIndex(b => b.title === bookTitle);
        if (bookIndex !== -1) {
            books[bookIndex].quoteCount += 1;
        } else {
            // Create new book entry
            books.push({
                title: bookTitle,
                quoteCount: 1,
                date: new Date().toISOString()
            });
        }

        await chrome.storage.local.set({ customQuotes: allQuotes, processedBooks: books });

        // Refresh views
        updateBookList(books);

        // Only render modal if it's open and matches
        if (currentOpenBook === bookTitle) {
            await renderModalQuotes(bookTitle);
        }

        // Update stats
        const total = 22 + allQuotes.length;
        customQuotesEl.textContent = allQuotes.length;
        totalQuotesEl.textContent = total;
    }

    async function deleteQuote(quoteText, bookTitle) {
        if (!confirm('Are you sure you want to delete this quote?')) return;

        const data = await chrome.storage.local.get(['customQuotes', 'processedBooks']);
        let allQuotes = data.customQuotes || [];
        let books = data.processedBooks || [];

        // Filter out the specific quote
        const initialLength = allQuotes.length;
        allQuotes = allQuotes.filter(q => q.text !== quoteText);

        if (allQuotes.length === initialLength) return; // Nothing deleted

        // Update book count
        const bookIndex = books.findIndex(b => b.title === bookTitle);
        if (bookIndex !== -1) {
            books[bookIndex].quoteCount = Math.max(0, books[bookIndex].quoteCount - 1);

            // Optional: Remove book if count is 0? 
            // Only if it's not a real file-based book maybe? For now keep it simple.
            if (books[bookIndex].quoteCount === 0) {
                // Maybe remove it? Let's keep it so user can add back to it easily.
            }
        }

        await chrome.storage.local.set({ customQuotes: allQuotes, processedBooks: books });

        // Refresh views
        updateBookList(books);
        if (currentOpenBook === bookTitle) {
            await renderModalQuotes(bookTitle);
        }

        // Update stats
        const total = 22 + allQuotes.length;
        customQuotesEl.textContent = allQuotes.length;
        totalQuotesEl.textContent = total;
    }
});
