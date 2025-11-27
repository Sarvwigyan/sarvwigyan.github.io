// Global Data Object (Original Structure - Now Populated from JSONs)
const storeData = {
    books: [], // Populated from books.json
    games: [], // Populated from games.json
    productivity: [] // Populated from productivity.json
};

// Featured Items (Original - Assuming hardcoded; add your featured data here if not defined elsewhere)
let featured = [
    // Example: { id: 1, title: 'Featured Book', type: 'Books', ... } - Add real ones!
    // Learning Note: This is for the horizontal "Featured Apps" section under "All". Make it dynamic from a featured.json later.
];

// NEW: Global Counter for Nested Scroll Locks
let scrollLockCount = 0;

// Updated Helpers for Scroll Lock (Now Handles Nesting with Reference Counting)
function lockBodyScroll() {
    // Learning Note: Increments count; adds class only on first lock (prevents redundant adds).
    scrollLockCount++;
    if (scrollLockCount === 1) {
        document.body.classList.add('modal-open');
    }
    // Debug: console.log('Locked! Count:', scrollLockCount); // Uncomment to watch in Console
}

function unlockBodyScroll() {
    // Learning Note: Decrements count; removes class only when all modals closed (hits 0).
    scrollLockCount = Math.max(0, scrollLockCount - 1); // Safety: Never go negative
    if (scrollLockCount === 0) {
        document.body.classList.remove('modal-open');
    }
    // Debug: console.log('Unlocked! Count:', scrollLockCount); // Uncomment to watch
}

// Function to Render Cards in a Grid (Updated: Dynamic Button Text – "Read" for Books + Loading Indicator Fix)
function renderCards(items, gridId) {
    // Learning Note: Clears the grid div, loops through items, builds HTML for each card, adds to DOM.
    // Items is an array like storeData.books; gridId is 'booksGrid', etc.
    const grid = document.getElementById(gridId);
    const noResults = document.getElementById(gridId.replace('Grid', 'NoResults')) || null; // Fallback if no no-results div
    
    // NEW: Hide loading indicator when rendering books
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (gridId === 'booksGrid' && loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }

    grid.innerHTML = ''; // Clear existing cards

    if (items.length === 0) {
        if (noResults) noResults.style.display = 'block';
        return;
    }

    if (noResults) noResults.style.display = 'none';

    items.forEach(item => {
        // UPDATED: Button text – "Read" strictly for Books type, "Download" otherwise
        const buttonText = item.type === 'Books' ? 'Read' : 'Download';

        // Learning Note: Builds card HTML dynamically. data-item-id for JS clicks later.
        const cardHtml = `
            <div class="card" data-item-id="${item.id}" role="button" tabindex="0">
                <img src="${item.logo}" alt="${item.title} logo" class="card-logo" onerror="this.src='https://via.placeholder.com/80?text=Logo'"> <!-- Fallback img if logo fails -->
                <div class="card-title">${item.title}</div>
                <div class="card-type">${item.type}${item.verified ? ' <i class="fas fa-check-circle" style="color: #4caf50;"></i> Verified' : ''}</div>
                <button class="card-download" onclick="handleDownloadClick(event, '${item.file || item.downloadUrl || ''}')">${buttonText}</button>
            </div>
        `;
        grid.innerHTML += cardHtml;
    });

    // Add click listeners to cards for detail view (Learning Note: Uses event delegation for efficiency)
    document.querySelectorAll(`#${gridId} .card`).forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-download')) { // Ignore if clicking download button
                const itemId = card.dataset.itemId;
                const item = [...storeData.books, ...storeData.games, ...storeData.productivity].find(i => i.id == itemId);
                if (item) openDetail(item);
            }
        });
    });
}

// Tab Switching Function (Original - initTabs Calls This)
function switchTab(tabId) {
    // Learning Note: Hides all sections/tabs, shows selected one. Featured shows only under "All".
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });

    const section = document.getElementById(tabId);
    if (section) section.classList.add('active');

    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    if (tab) {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
    }

    // Show featured only for "all"
    document.querySelector('.featured-section').style.display = tabId === 'all' ? 'block' : 'none';
}

// Initialize Tabs (Original - Adds Click/Keydown Listeners)
function initTabs() {
    // Learning Note: Makes tabs keyboard-accessible (Enter/Space to switch).
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(tab.dataset.tab);
        });
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchTab(tab.dataset.tab);
            }
        });
    });
}

// Search Initialization (Original - Filters Current Section)
function initSearch() {
    // Learning Note: Listens to input on search bar, filters cards in active section by title/desc/type.
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const activeSectionId = document.querySelector('.section.active').id;
        let items = [];

        // Get items based on active tab (Learning Note: Switch for each section)
        switch (activeSectionId) {
            case 'all': items = [...storeData.books, ...storeData.games, ...storeData.productivity]; break;
            case 'books': items = storeData.books; break;
            case 'games': items = storeData.games; break;
            case 'productivity': items = storeData.productivity; break;
            case 'recent': items = JSON.parse(localStorage.getItem('recentItems') || '[]'); break;
        }

        // Filter by query
        const filtered = items.filter(item =>
            item.title.toLowerCase().includes(query) ||
            (item.shortDesc && item.shortDesc.toLowerCase().includes(query)) ||
            item.type.toLowerCase().includes(query)
        );

        // Re-render filtered
        const gridId = activeSectionId + 'Grid';
        renderCards(filtered, gridId);
    });
}

// Settings Initialization (Original - Loads Theme from localStorage)
function initSettings() {
    // Learning Note: Applies saved theme.
    const theme = localStorage.getItem('theme') || 'dark';
    document.body.dataset.theme = theme;
    document.getElementById('theme').value = theme;
}

// Toggle Settings Modal (Original + Scroll Lock & History for Back Button)
function toggleSettings() {
    // Learning Note: Shows/hides settings window + overlay. Now locks scroll/history on open, unlocks on close.
    const settingsWindow = document.getElementById('settingsWindow');
    const overlay = document.getElementById('overlay');
    const wasOpen = settingsWindow.classList.contains('active'); // Check if opening or closing
    settingsWindow.classList.toggle('active');
    overlay.classList.toggle('active');

    if (!wasOpen) {
        // Opening: Lock scroll + push history
        lockBodyScroll();
        history.pushState({ modal: 'settings' }, '', '#settings');
    } else {
        // Closing: Unlock scroll + clean URL
        unlockBodyScroll();
        history.replaceState(null, '', window.location.pathname);
    }
}

// Save Settings (Original)
function saveSettings() {
    // Learning Note: Saves theme to localStorage, applies theme, closes modal.
    const theme = document.getElementById('theme').value;

    localStorage.setItem('theme', theme);
    document.body.dataset.theme = theme;

    toggleSettings();
}

// Open Detail Modal (Updated: Dynamic Button Text – "Read" for Books)
function openDetail(item) {
    // Learning Note: Fills modal fields, sets download onclick, shows modal/overlay. Now locks scroll/history + dynamic text.
    document.getElementById('detailLogo').src = item.logo;
    document.getElementById('detailLogo').alt = `${item.title} logo`;
    document.getElementById('detailTitle').textContent = item.title;
    document.getElementById('detailType').textContent = item.type;
    document.getElementById('detailVerified').innerHTML = item.verified ? '<i class="fas fa-check-circle" style="color: #4caf50;"></i> Verified' : '';
    document.getElementById('detailShortDesc').textContent = item.shortDesc || '';
    document.getElementById('detailLongDesc').textContent = item.longDesc || '';

    // Images (Learning Note: Builds gallery; click for zoom if added later)
    const imagesDiv = document.getElementById('detailImages');
    imagesDiv.innerHTML = '';
    if (item.images && item.images.length > 0) {
        item.images.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.alt = item.imageAlts ? (item.imageAlts[idx] || `${item.title} image ${idx + 1}`) : `${item.title} image ${idx + 1}`;
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(src, '_blank'); // Open full image
            imagesDiv.appendChild(img);
        });
    }

    // UPDATED: Dynamic button text for detail view – "Read" strictly for Books
    const detailButton = document.getElementById('detailDownload');
    const buttonText = item.type === 'Books' ? 'Read' : 'Download';
    detailButton.textContent = buttonText;  // Set the text

    // Download/Read button
    detailButton.onclick = () => handleDownloadClick(null, item.file || item.downloadUrl || '');

    // Show modal + Lock scroll + Push history state
    document.getElementById('detailView').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    lockBodyScroll();  // Lock scroll
    history.pushState({ modal: 'detail' }, '', '#detail');  // Fake URL for back button
}

// Close Detail Modal (Original + Scroll Unlock & History Clean)
function closeDetail() {
    document.getElementById('detailView').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    unlockBodyScroll();  // Unlock scroll
    history.replaceState(null, '', window.location.pathname);  // Clean up URL (remove #detail)
}

// Handle Download Click (Original + For PDFs, Lock Scroll & History)
function handleDownloadClick(event, url) {
    if (event) event.stopPropagation(); // Prevent card click if from card button
    if (!url) {
        alert('Download not available yet.'); // Placeholder
        return;
    }
    if (url.includes('.pdf')) {
        // Open PDF in modal iframe
        document.getElementById('bookIframe').src = url;
        document.getElementById('bookModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
        lockBodyScroll();  // Lock scroll
        history.pushState({ modal: 'book' }, '', '#book');  // Fake URL for back button
    } else {
        // Direct download
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Close Book Modal (Original + Scroll Unlock & History Clean)
function closeBookModal() {
    document.getElementById('bookModal').classList.remove('active');
    document.getElementById('bookIframe').src = ''; // Clear iframe
    document.getElementById('overlay').classList.remove('active');
    unlockBodyScroll();  // Unlock scroll
    history.replaceState(null, '', window.location.pathname);  // Clean up URL
}

// Books Filter Functions (Original - For Language Multi-Select)
// Toggle Language Dropdown
function toggleLanguageDropdown() {
    const dropdown = document.getElementById('languageCheckboxes');
    const arrow = document.getElementById('langDropdownArrow');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    arrow.classList.toggle('rotate');
}

// Toggle All Languages Checkbox
function toggleAllLanguages(checkbox) {
    document.querySelectorAll('.lang-checkbox').forEach(cb => cb.checked = checkbox.checked);
    updateSelectedLanguagesLabel();
    filterBooksByLanguage();
}

// Update Label for Selected Languages
function updateSelectedLanguagesLabel() {
    const checked = document.querySelectorAll('.lang-checkbox:checked');
    const labels = Array.from(checked).map(cb => cb.value.charAt(0).toUpperCase() + cb.value.slice(1)).join(', ');
    document.getElementById('selectedLanguagesLabel').textContent = labels || 'Select Language';
}

// Filter Books by Selected Languages
function filterBooksByLanguage() {
    const selected = Array.from(document.querySelectorAll('.lang-checkbox:checked')).map(cb => cb.value.toLowerCase());
    let filtered = storeData.books;
    if (selected.length > 0) {
        filtered = storeData.books.filter(book => selected.includes((book.language || '').toLowerCase()));
    }
    renderCards(filtered, 'booksGrid');
}

// Handle Main Filter Change (Original - For Books Select Dropdown)
function handleMainFilterChange() {
    const value = document.getElementById('booksFilter').value;
    const wrapper = document.getElementById('languageFilterWrapper');
    const arrow = document.getElementById('mainFilterArrow');
    arrow.classList.toggle('rotate', value !== '');

    if (value === 'language') {
        wrapper.style.display = 'block';
        filterBooksByLanguage();
    } else {
        wrapper.style.display = 'none';
        renderCards(storeData.books, 'booksGrid'); // Reset to all
    }
    // Learning Note: Expand for 'genre'/'author' by adding similar dropdowns/arrays in data.
}

// Async Data Loader (New - Populates storeData from JSONs)
async function loadDataFromJSON() {
    // Learning Note: Fetches each JSON async (parallel-ish). If one fails, others still load. Empty array fallback = "No results".
    try {
        const [booksRes, gamesRes, prodRes] = await Promise.all([
            fetch('books.json').then(r => r.json()),
            fetch('games.json').then(r => r.json()),
            fetch('productivity.json').then(r => r.json())
        ]);
        storeData.books = booksRes;
        storeData.games = gamesRes;
        storeData.productivity = prodRes;
        console.log('Data loaded from JSONs! Total items:', storeData.books.length + storeData.games.length + storeData.productivity.length);
    } catch (err) {
        console.error('JSON load error (check files exist):', err);
        // No UI error - just empty grids show "No results" (graceful fallback)
    }
}

// Main Initialization (Original DOMContentLoaded - Now Awaits Data Load + Updated popstate Listener)
document.addEventListener('DOMContentLoaded', async () => {
    // Learning Note: Awaits data before rendering (async). Then runs all original init/renders.
    await loadDataFromJSON();

    // Render all sections
    renderCards([...storeData.books, ...storeData.games, ...storeData.productivity], 'allGrid');
    renderCards(storeData.books, 'booksGrid');
    renderCards(storeData.games, 'gamesGrid');
    renderCards(storeData.productivity, 'productivityGrid');
    renderCards(featured, 'featuredGrid'); // If featured is empty, no cards
    renderCards(JSON.parse(localStorage.getItem('recentItems') || '[]'), 'recentGrid');

    // Original inits
    initTabs();
    initSearch();
    initSettings();

    // Original event listeners
    document.getElementById('closeBtn').addEventListener('click', closeDetail);
    document.getElementById('bookModalClose').addEventListener('click', closeBookModal);
    document.getElementById('settingsIcon').addEventListener('click', toggleSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);

    // Overlay click (closes modals if clicking outside)
    document.getElementById('overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('overlay')) {
            const bookModal = document.getElementById('bookModal');
            const settingsWindow = document.getElementById('settingsWindow');
            const detailView = document.getElementById('detailView');

            if (bookModal.classList.contains('active')) closeBookModal();
            else if (settingsWindow.classList.contains('active')) toggleSettings();
            else if (detailView.classList.contains('active')) closeDetail();
        }
    });

    // Language checkboxes (for books filter)
    document.querySelectorAll('.lang-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const selectAll = document.getElementById('selectAllLanguages');
            selectAll.checked = document.querySelectorAll('.lang-checkbox').length ===
                document.querySelectorAll('.lang-checkbox:checked').length;
            updateSelectedLanguagesLabel();
            filterBooksByLanguage();
        });
    });

    // UPDATED: Handle Browser Back/Forward for Modals (Closes Innermost First for Nesting)
    window.addEventListener('popstate', (event) => {
        // Learning Note: Fires on back/forward. Prioritizes closing innermost (book > detail > settings) to match count drops.
        const bookModal = document.getElementById('bookModal');
        const detailView = document.getElementById('detailView');
        const settingsWindow = document.getElementById('settingsWindow');

        if (bookModal.classList.contains('active')) {
            closeBookModal();  // Close inner first
        } else if (detailView.classList.contains('active')) {
            closeDetail();
        } else if (settingsWindow.classList.contains('active')) {
            toggleSettings();  // Since it's a toggle
        }
        // Safety: If deep nest (rare), this chains—back once closes one layer.
    });

    // Escape key (closes modals/dropdowns)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const bookModal = document.getElementById('bookModal');
            const settingsWindow = document.getElementById('settingsWindow');
            const detailView = document.getElementById('detailView');
            const dropdown = document.getElementById('languageCheckboxes');

            if (bookModal.classList.contains('active')) closeBookModal();
            else if (settingsWindow.classList.contains('active')) toggleSettings();
            else if (detailView.classList.contains('active')) closeDetail();
            else if (dropdown.style.display === 'block') toggleLanguageDropdown();
        }
    });

    // Default to "All" tab
    switchTab('all');

    console.log('Sarvstore ready! Check tabs and search.'); // Learning: Debug log - remove in production
});