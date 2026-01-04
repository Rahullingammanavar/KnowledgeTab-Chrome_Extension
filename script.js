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

    // Redirect Timer Variable
    let redirectTimer;

    // Function to render quote
    function renderQuote(quotesList) {
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
    }

    // Initialize Quotes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['customQuotes'], (result) => {
            const customQuotes = result.customQuotes || [];
            const quotesList = [...builtInQuotes, ...customQuotes];
            renderQuote(quotesList);
        });
    } else {
        console.warn('Chrome storage not available, using built-in quotes only.');
        renderQuote(builtInQuotes);
    }

    // Timer Logic: Redirect to Google after 8 seconds
    function startRedirectTimer() {
        redirectTimer = setTimeout(() => {
            // Fade out quote
            if (quoteContainer) quoteContainer.classList.add('fade-out');

            // Wait for fade out to finish (1s) then redirect
            setTimeout(() => {
                window.location.replace("https://www.google.com");
            }, 1000);
        }, 8000);
    }

    // Start the timer initially
    startRedirectTimer();

    // Function to cancel redirect on interaction
    function cancelRedirect() {
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
            console.log("Redirect cancelled due to interaction");
        }
    }

    // Search Functionality
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            cancelRedirect(); // Cancel redirect on type
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

        searchInput.addEventListener('focus', cancelRedirect);
    }


    // Breathing Widget Logic
    const breathingWidget = document.getElementById('breathingWidget');
    const closeBreathing = document.getElementById('closeBreathing');
    const breathingText = document.getElementById('breathingText');
    let breathingInterval;

    if (breathingWidget) {
        breathingWidget.addEventListener('click', (e) => {
            cancelRedirect(); // Cancel redirect

            console.log('Widget clicked', e.target);
            // If clicking close button, don't trigger open logic
            if (e.target === closeBreathing || (closeBreathing && closeBreathing.contains(e.target))) {
                console.log('Close button clicked (bubbled)');
                return;
            }

            if (!breathingWidget.classList.contains('active')) {
                console.log('Activating widget');
                breathingWidget.classList.add('active');
                startBreathingText();
            }
        });
    }

    if (closeBreathing) {
        closeBreathing.addEventListener('click', (e) => {
            console.log('Close button clicked directly');
            e.stopPropagation(); // Prevent widget click
            if (breathingWidget) breathingWidget.classList.remove('active');
            stopBreathingText();
        });
    }

    function startBreathingText() {
        if (!breathingText) return;
        // Initial state
        breathingText.textContent = "Breathe In...";

        let phase = 0; // 0 = In, 1 = Out

        breathingInterval = setInterval(() => {
            phase = (phase + 1) % 2;
            if (phase === 0) {
                breathingText.textContent = "Breathe In...";
            } else {
                breathingText.textContent = "Breathe Out...";
            }
        }, 4000); // 4 seconds per phase matches CSS animation
    }

    function stopBreathingText() {
        clearInterval(breathingInterval);
        if (breathingText) breathingText.textContent = "Start Breathing";
    }

    // Password Protection for Habit Tracker
    const habitBtn = document.getElementById('habitBtn');
    const passwordModal = document.getElementById('passwordModal');
    const closePasswordModal = document.getElementById('closePasswordModal');
    const passwordInput = document.getElementById('passwordInput');
    const submitPasswordFn = document.getElementById('submitPassword');
    const errorMessage = document.getElementById('errorMessage');

    const TARGET_URL = "https://docs.google.com/spreadsheets/d/1np697kiaT5nfF_J86_D0UVnkSgDakqQJrA9IIQyyWqo/edit?gid=0#gid=0";
    const CORRECT_PASSWORD = "4159";

    if (habitBtn && passwordModal) {
        habitBtn.addEventListener('click', () => {
            cancelRedirect(); // Cancel redirect
            console.log("Habit Button Clicked");
            passwordModal.style.display = "block";
            if (passwordInput) {
                passwordInput.value = "";
                passwordInput.focus();
            }
            if (errorMessage) errorMessage.style.display = "none";
        });
    } else {
        console.error("Habit button or password modal not found in DOM");
    }

    if (closePasswordModal) {
        closePasswordModal.addEventListener('click', () => {
            passwordModal.style.display = "none";
            // Restart timer when closing modal
            console.log("Modal closed, restarting redirect timer");
            startRedirectTimer();
        });
    }

    // Close on outside click
    window.addEventListener('click', (event) => {
        if (event.target == passwordModal) {
            passwordModal.style.display = "none";
            // Restart timer when clicking outside
            console.log("Clicked outside modal, restarting redirect timer");
            startRedirectTimer();
        }
    });

    function checkPassword() {
        if (!passwordInput) return;

        if (passwordInput.value === CORRECT_PASSWORD) {
            window.open(TARGET_URL, '_blank');
            if (passwordModal) passwordModal.style.display = "none";
        } else {
            if (errorMessage) errorMessage.style.display = "block";
            passwordInput.classList.add('shake');
            setTimeout(() => passwordInput.classList.remove('shake'), 500);
        }
    }

    if (submitPasswordFn) {
        submitPasswordFn.addEventListener('click', checkPassword);
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            cancelRedirect();
            if (e.key === 'Enter') {
                checkPassword();
            }
        });
    }
});
