document.addEventListener('DOMContentLoaded', () => {
    // Get elements
    const quoteContainer = document.getElementById('quote-container');
    const quoteTextElement = document.getElementById('quote-text');
    const authorElement = document.getElementById('author');
    const bookElement = document.getElementById('book');

    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');

    // Get quotes from global scope (loaded via quotes.js)
    const builtInQuotes = window.quotes || [];

    // Fetch custom quotes from storage
    chrome.storage.local.get(['customQuotes'], (result) => {
        const customQuotes = result.customQuotes || [];
        const quotesList = [...builtInQuotes, ...customQuotes];

        // Display Quote Logic
        if (quotesList && quotesList.length > 0) {
            let randomIndex;
            const lastQuoteIndex = localStorage.getItem('lastQuoteIndex');

            // Try to get a new quote that isn't the same as the last one
            if (quotesList.length > 1) {
                // Safety break to prevent infinite loops if something is weird
                let attempts = 0;
                do {
                    randomIndex = Math.floor(Math.random() * quotesList.length);
                    attempts++;
                } while (randomIndex == lastQuoteIndex && attempts < 10);
            } else {
                randomIndex = Math.floor(Math.random() * quotesList.length);
            }

            // Save this index for next time
            localStorage.setItem('lastQuoteIndex', randomIndex);

            const randomQuote = quotesList[randomIndex];

            quoteTextElement.textContent = `"${randomQuote.text}"`;
            authorElement.textContent = `- ${randomQuote.author}`;

            // Handle "book" field - logic to support both old structure and new structure
            // Old structure: book is just string. New structure: book is string.
            if (randomQuote.book) {
                bookElement.textContent = `from "${randomQuote.book}"`;
                bookElement.style.display = 'block';
            } else {
                bookElement.style.display = 'none';
            }
        } else {
            // Fallback
            quoteTextElement.textContent = "Stay hungry, stay foolish.";
            authorElement.textContent = "Steve Jobs";
        }
    });

    // Timer Logic: Switch to Search after 5 seconds
    // Timer Logic: Redirect to Google after 8 seconds
    setTimeout(() => {
        // Fade out quote
        quoteContainer.classList.add('fade-out');

        // Wait for fade out to finish (1s) then redirect
        setTimeout(() => {
            window.location.replace("https://www.google.com");
        }, 1000);
    }, 8000); // 8 seconds delay

    // Search Functionality
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                // Check if it's a URL
                if (query.match(/^(http|https):\/\/[^ "]+$/) || query.match(/^www\.[^ "]+$/) || query.includes('.com') || query.includes('.org') || query.includes('.net')) {
                    let url = query;
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    window.location.href = url;
                } else {
                    // Search Google
                    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                }
            }
        }
    });
});
