// Global Data Object (Now only Books and Journals)
const storeData = {
    books: [], // Populated from books.json
    journals: [] // Populated from journals.json
};

// NEW: Lazy Loading Variables
let currentPage = {
    all: 1,
    books: 1,
    journals: 1,
    recent: 1
};
const CARDS_PER_PAGE = 20;
let isLoading = false;
let hasMoreItems = {
    all: true,
    books: true,
    journals: true,
    recent: true
};

// FIXED: Improved Scroll Lock Management
let activeModals = [];

// NEW: Track current book for progress saving
let currentBookId = null;

// NEW: Permanent Reading Progress Functions
function saveReadingProgress(bookId, scrollPosition) {
    try {
        const progress = {
            scrollY: scrollPosition,
            timestamp: Date.now(),
            lastRead: new Date().toISOString()
        };
        localStorage.setItem(`readingProgress_${bookId}`, JSON.stringify(progress));
        console.log(`Progress saved for ${bookId}:`, scrollPosition);
    } catch (error) {
        console.error('Error saving reading progress:', error);
    }
}

function loadReadingProgress(bookId) {
    try {
        const saved = localStorage.getItem(`readingProgress_${bookId}`);
        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        console.error('Error loading reading progress:', error);
        return null;
    }
}

function clearReadingProgress(bookId) {
    try {
        localStorage.removeItem(`readingProgress_${bookId}`);
        console.log(`Progress cleared for ${bookId}`);
    } catch (error) {
        console.error('Error clearing reading progress:', error);
    }
}

// NEW: Function to restore scroll position in iframe
function restoreScrollPosition(iframe, bookId) {
    const savedProgress = loadReadingProgress(bookId);
    if (savedProgress && savedProgress.scrollY > 0) {
        console.log(`Restoring scroll position for ${bookId}:`, savedProgress.scrollY);
        
        // Try multiple methods to ensure scroll restoration
        const restoreScroll = () => {
            try {
                // Method 1: Direct scroll
                if (iframe.contentWindow && iframe.contentDocument) {
                    iframe.contentWindow.scrollTo(0, savedProgress.scrollY);
                }
                
                // Method 2: Wait a bit and try again (for slow loading content)
                setTimeout(() => {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.scrollTo(0, savedProgress.scrollY);
                    }
                }, 500);
                
                // Method 3: One more try after content is fully loaded
                setTimeout(() => {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.scrollTo(0, savedProgress.scrollY);
                    }
                }, 1000);
            } catch (error) {
                console.warn('Could not restore scroll position:', error);
            }
        };

        // Set up scroll restoration
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            restoreScroll();
        } else {
            iframe.onload = restoreScroll;
        }
    }
}

// NEW: Function to setup scroll tracking for iframe
function setupScrollTracking(iframe, bookId) {
    let scrollTimeout;
    
    const trackScroll = () => {
        try {
            if (iframe.contentWindow) {
                const scrollY = iframe.contentWindow.scrollY || iframe.contentDocument.documentElement.scrollTop;
                
                // Only save if user has scrolled significantly
                if (scrollY > 100) {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(() => {
                        saveReadingProgress(bookId, scrollY);
                    }, 1000); // Debounce: save 1 second after user stops scrolling
                }
            }
        } catch (error) {
            // Cross-origin limitations - we'll handle this gracefully
            console.warn('Cannot track scroll position due to cross-origin restrictions');
        }
    };

    // Try to set up scroll listener
    try {
        if (iframe.contentWindow) {
            iframe.contentWindow.addEventListener('scroll', trackScroll);
            
            // Also track on iframe load
            iframe.onload = function() {
                restoreScrollPosition(iframe, bookId);
                iframe.contentWindow.addEventListener('scroll', trackScroll);
            };
        }
    } catch (error) {
        console.warn('Cannot setup scroll tracking due to cross-origin restrictions');
        // Fallback: Save progress when closing
        setupFallbackProgressSaving(iframe, bookId);
    }
}

// NEW: Fallback for cross-origin restrictions
function setupFallbackProgressSaving(iframe, bookId) {
    // Save current position when modal closes
    const originalCloseBookModal = closeBookModal;
    closeBookModal = function() {
        try {
            if (iframe.contentWindow) {
                const scrollY = iframe.contentWindow.scrollY || iframe.contentDocument.documentElement.scrollTop;
                if (scrollY > 100) {
                    saveReadingProgress(bookId, scrollY);
                }
            }
        } catch (error) {
            console.warn('Could not save scroll position on close');
        }
        originalCloseBookModal();
    };
}

// FIXED: Function to Add Item to Recently Viewed
function addToRecentItems(item) {
    let recentItems = JSON.parse(localStorage.getItem('recentItems') || '[]');
    
    // Remove if already exists (to avoid duplicates)
    recentItems = recentItems.filter(recentItem => recentItem.id !== item.id);
    
    // Add to beginning of array (most recent first)
    recentItems.unshift(item);
    
    // Keep only last 10 items
    recentItems = recentItems.slice(0, 10);
    
    // Save back to localStorage
    localStorage.setItem('recentItems', JSON.stringify(recentItems));
    
    // Update recent grid if we're on the recent tab
    if (document.getElementById('recent').classList.contains('active')) {
        renderCards(recentItems, 'recentGrid', true);
    }
}

// FIXED: Improved Scroll Lock Management
function lockBodyScroll() {
    if (activeModals.length === 0) {
        document.body.classList.add('modal-open');
    }
    activeModals.push('lock');
}

function unlockBodyScroll() {
    activeModals.pop();
    if (activeModals.length === 0) {
        document.body.classList.remove('modal-open');
    }
}

// FIXED: Function to close all modals properly
function closeAllModals() {
    const modals = ['bookModal', 'detailView', 'settingsWindow'];
    let closedAny = false;
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
            closedAny = true;
        }
    });
    
    // Close overlay only if we closed any modal
    if (closedAny) {
        document.getElementById('overlay').classList.remove('active');
        // Reset scroll locks
        activeModals = [];
        document.body.classList.remove('modal-open');
        // Clear current book tracking
        currentBookId = null;
        // Clear history state
        history.replaceState(null, '', window.location.pathname);
    }
}

// NEW: Function to get paginated items
function getPaginatedItems(items, section, reset = false) {
    if (reset) {
        currentPage[section] = 1;
        hasMoreItems[section] = true;
    }
    
    const startIndex = 0;
    const endIndex = currentPage[section] * CARDS_PER_PAGE;
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Check if there are more items to load
    hasMoreItems[section] = endIndex < items.length;
    
    return paginatedItems;
}

// NEW: Function to load more items
function loadMoreItems(section) {
    if (isLoading || !hasMoreItems[section]) return;
    
    isLoading = true;
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    // Simulate loading delay for better UX
    setTimeout(() => {
        currentPage[section]++;
        
        let items = [];
        switch (section) {
            case 'all': items = [...storeData.books, ...storeData.journals]; break;
            case 'books': items = storeData.books; break;
            case 'journals': items = storeData.journals; break;
            case 'recent': items = JSON.parse(localStorage.getItem('recentItems') || '[]'); break;
        }
        
        const paginatedItems = getPaginatedItems(items, section);
        renderCards(paginatedItems, section + 'Grid', false);
        
        isLoading = false;
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Hide loading indicator if no more items
        if (!hasMoreItems[section] && loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }, 300);
}

// NEW: Function to check if user has scrolled to bottom
function isScrolledToBottom() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    return scrollTop + clientHeight >= scrollHeight - 100; // 100px buffer
}

// NEW: Scroll event handler for lazy loading
function handleScroll() {
    const activeSection = document.querySelector('.section.active').id;
    
    if (isScrolledToBottom() && hasMoreItems[activeSection] && !isLoading) {
        loadMoreItems(activeSection);
    }
}

// UPDATED: Function to Render Cards in a Grid with Lazy Loading Support
function renderCards(items, gridId, reset = true) {
    const grid = document.getElementById(gridId);
    const noResults = document.getElementById(gridId.replace('Grid', 'NoResults')) || null;
    const section = gridId.replace('Grid', '');
    
    // NEW: Hide loading indicator when rendering books
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (gridId === 'booksGrid' && loadingIndicator && reset) {
        loadingIndicator.style.display = 'none';
    }

    // Clear grid only on reset
    if (reset) {
        grid.innerHTML = '';
        currentPage[section] = 1;
        hasMoreItems[section] = true;
    }

    if (items.length === 0 && reset) {
        if (noResults) noResults.style.display = 'block';
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }

    if (noResults && reset) noResults.style.display = 'none';

    // Get paginated items
    const paginatedItems = getPaginatedItems(items, section, reset);
    
    paginatedItems.forEach(item => {
        // NEW: Check if this item has reading progress
        const progress = loadReadingProgress(item.id);
        const progressBadge = progress ? ' <span class="progress-badge" title="Continue reading from where you left off">📖</span>' : '';
        
        // UPDATED: Always show "Read" button for all educational content
        const cardHtml = `
            <div class="card" data-item-id="${item.id}" role="button" tabindex="0">
                <img src="${item.logo}" alt="${item.title} logo" class="card-logo" onerror="this.src='https://via.placeholder.com/80?text=Logo'">
                <div class="card-title">${item.title}${progressBadge}</div>
                <div class="card-type">${item.type}${item.verified ? ' <i class="fas fa-check-circle" style="color: #4caf50;"></i> Verified' : ''}</div>
                <button class="card-download" onclick="handleDownloadClick(event, '${item.file || item.downloadUrl || ''}', '${item.id}')">Read</button>
            </div>
        `;
        grid.innerHTML += cardHtml;
    });

    // Add click listeners to cards for detail view
    document.querySelectorAll(`#${gridId} .card`).forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-download')) {
                const itemId = card.dataset.itemId;
                const item = [...storeData.books, ...storeData.journals].find(i => i.id == itemId);
                if (item) openDetail(item);
            }
        });
    });
    
    // NEW: Show/hide loading indicator based on whether there are more items
    if (loadingIndicator && gridId === 'booksGrid') {
        if (!hasMoreItems[section] || items.length <= CARDS_PER_PAGE) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Tab Switching Function (Updated: Refresh Recent Tab when switching to it)
function switchTab(tabId) {
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

    // NEW: Refresh recent items when switching to recent tab
    if (tabId === 'recent') {
        const recentItems = JSON.parse(localStorage.getItem('recentItems') || '[]');
        renderCards(recentItems, 'recentGrid', true);
    }
}

// Initialize Tabs
function initTabs() {
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

// Search Initialization (Updated for new sections)
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const activeSectionId = document.querySelector('.section.active').id;
        let items = [];

        // Get items based on active tab
        switch (activeSectionId) {
            case 'all': items = [...storeData.books, ...storeData.journals]; break;
            case 'books': items = storeData.books; break;
            case 'journals': items = storeData.journals; break;
            case 'recent': items = JSON.parse(localStorage.getItem('recentItems') || '[]'); break;
        }

        // Filter by query
        const filtered = items.filter(item =>
            item.title.toLowerCase().includes(query) ||
            (item.shortDesc && item.shortDesc.toLowerCase().includes(query)) ||
            item.type.toLowerCase().includes(query)
        );

        // Re-render filtered with reset
        const gridId = activeSectionId + 'Grid';
        renderCards(filtered, gridId, true);
    });
}

// Settings Initialization
function initSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.body.dataset.theme = theme;
    document.getElementById('theme').value = theme;
}

// Toggle Settings Modal
function toggleSettings() {
    const settingsWindow = document.getElementById('settingsWindow');
    const overlay = document.getElementById('overlay');
    const wasOpen = settingsWindow.classList.contains('active');
    
    // FIXED: Close all modals first to avoid conflicts
    if (!wasOpen) {
        closeAllModals();
    }
    
    settingsWindow.classList.toggle('active');
    overlay.classList.toggle('active');

    if (!wasOpen) {
        lockBodyScroll();
        history.pushState({ modal: 'settings' }, '', '#settings');
    } else {
        unlockBodyScroll();
        history.replaceState(null, '', window.location.pathname);
    }
}

// Save Settings
function saveSettings() {
    const theme = document.getElementById('theme').value;

    localStorage.setItem('theme', theme);
    document.body.dataset.theme = theme;

    toggleSettings();
}

// FIXED: Open Detail Modal with proper modal management
function openDetail(item) {
    addToRecentItems(item);

    document.getElementById('detailLogo').src = item.logo;
    document.getElementById('detailLogo').alt = `${item.title} logo`;
    document.getElementById('detailTitle').textContent = item.title;
    document.getElementById('detailType').textContent = item.type;
    document.getElementById('detailVerified').innerHTML = item.verified ? '<i class="fas fa-check-circle" style="color: #4caf50;"></i> Verified' : '';
    document.getElementById('detailShortDesc').textContent = item.shortDesc || '';
    document.getElementById('detailLongDesc').textContent = item.longDesc || '';

    // NEW: Show reading progress in detail view if available
    const progress = loadReadingProgress(item.id);
    if (progress) {
        const progressInfo = document.createElement('div');
        progressInfo.className = 'detail-progress';
        progressInfo.innerHTML = `<span style="color: var(--highlight); font-size: 0.9rem;">📖 You have reading progress - will continue from where you left off</span>`;
        document.getElementById('detailVerified').appendChild(progressInfo);
    }

    // Images
    const imagesDiv = document.getElementById('detailImages');
    imagesDiv.innerHTML = '';
    if (item.images && item.images.length > 0) {
        item.images.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.alt = item.imageAlts ? (item.imageAlts[idx] || `${item.title} image ${idx + 1}`) : `${item.title} image ${idx + 1}`;
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(src, '_blank');
            imagesDiv.appendChild(img);
        });
    }

    // UPDATED: Always show "Read" button for detail view
    const detailButton = document.getElementById('detailDownload');
    detailButton.textContent = progress ? 'Continue Reading' : 'Read';

    // Read button
    detailButton.onclick = () => handleDownloadClick(null, item.file || item.downloadUrl || '', item.id);

    // FIXED: Close any existing modals first
    closeAllModals();
    
    // Show modal + Lock scroll + Push history state
    document.getElementById('detailView').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    lockBodyScroll();
    history.pushState({ modal: 'detail' }, '', '#detail');
}

// FIXED: Close Detail Modal properly
function closeDetail() {
    document.getElementById('detailView').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    unlockBodyScroll();
    history.replaceState(null, '', window.location.pathname);
}

// FIXED: Handle Download Click with proper modal management AND progress tracking
function handleDownloadClick(event, url, itemId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // Set current book for progress tracking
    currentBookId = itemId;
    
    // Add to recent items
    if (event) {
        const card = event.target.closest('.card');
        if (card) {
            const cardItemId = card.dataset.itemId;
            const item = [...storeData.books, ...storeData.journals].find(i => i.id == cardItemId);
            if (item) {
                addToRecentItems(item);
            }
        }
    }
    
    if (!url) {
        alert('Content not available yet.');
        return;
    }
    
    // FIXED: Close any existing modals first
    closeAllModals();
    
    // Open content in modal iframe (for PDFs and archive.org content)
    const iframe = document.getElementById('bookIframe');
    iframe.src = url;
    document.getElementById('bookModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    lockBodyScroll();
    history.pushState({ modal: 'book' }, '', '#book');
    
    // NEW: Setup progress tracking for this book
    setTimeout(() => {
        setupScrollTracking(iframe, itemId);
    }, 1000);
}

// FIXED: Close Book Modal properly WITH progress saving
function closeBookModal() {
    // NEW: Save progress before closing if we have a current book
    if (currentBookId) {
        try {
            const iframe = document.getElementById('bookIframe');
            if (iframe.contentWindow) {
                const scrollY = iframe.contentWindow.scrollY || iframe.contentDocument.documentElement.scrollTop;
                if (scrollY > 100) {
                    saveReadingProgress(currentBookId, scrollY);
                }
            }
        } catch (error) {
            console.warn('Could not save scroll position on close');
        }
    }
    
    document.getElementById('bookModal').classList.remove('active');
    document.getElementById('bookIframe').src = '';
    document.getElementById('overlay').classList.remove('active');
    unlockBodyScroll();
    history.replaceState(null, '', window.location.pathname);
    
    // Reset current book tracking
    currentBookId = null;
}

// Books Filter Functions
function toggleLanguageDropdown() {
    const dropdown = document.getElementById('languageCheckboxes');
    const arrow = document.getElementById('langDropdownArrow');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    arrow.classList.toggle('rotate');
}

function toggleAllLanguages(checkbox) {
    document.querySelectorAll('.lang-checkbox').forEach(cb => cb.checked = checkbox.checked);
    updateSelectedLanguagesLabel();
    filterBooksByLanguage();
}

function updateSelectedLanguagesLabel() {
    const checked = document.querySelectorAll('.lang-checkbox:checked');
    const labels = Array.from(checked).map(cb => cb.value.charAt(0).toUpperCase() + cb.value.slice(1)).join(', ');
    document.getElementById('selectedLanguagesLabel').textContent = labels || 'Select Language';
}

function filterBooksByLanguage() {
    const selected = Array.from(document.querySelectorAll('.lang-checkbox:checked')).map(cb => cb.value.toLowerCase());
    let filtered = storeData.books;
    if (selected.length > 0) {
        filtered = storeData.books.filter(book => selected.includes((book.language || '').toLowerCase()));
    }
    renderCards(filtered, 'booksGrid', true);
}

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
        renderCards(storeData.books, 'booksGrid', true);
    }
}

// Async Data Loader (Updated for Journals)
async function loadDataFromJSON() {
    try {
        const [booksRes, journalsRes] = await Promise.all([
            fetch('books.json').then(r => r.json()),
            fetch('journals.json').then(r => r.json())
        ]);
        storeData.books = booksRes;
        storeData.journals = journalsRes;
        console.log('Data loaded from JSONs! Total items:', storeData.books.length + storeData.journals.length);
    } catch (err) {
        console.error('JSON load error (check files exist):', err);
    }
}

// FIXED: Improved overlay click handler
function handleOverlayClick(e) {
    if (e.target === document.getElementById('overlay')) {
        // FIXED: Close only the top-most modal
        if (document.getElementById('bookModal').classList.contains('active')) {
            closeBookModal();
        } else if (document.getElementById('detailView').classList.contains('active')) {
            closeDetail();
        } else if (document.getElementById('settingsWindow').classList.contains('active')) {
            toggleSettings();
        }
    }
}

// FIXED: Improved browser back/forward handling
function handlePopState(event) {
    // FIXED: Close only the top-most modal
    if (document.getElementById('bookModal').classList.contains('active')) {
        closeBookModal();
    } else if (document.getElementById('detailView').classList.contains('active')) {
        closeDetail();
    } else if (document.getElementById('settingsWindow').classList.contains('active')) {
        toggleSettings();
    }
}

// FIXED: Improved escape key handler
function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        // FIXED: Close only the top-most modal
        if (document.getElementById('bookModal').classList.contains('active')) {
            closeBookModal();
        } else if (document.getElementById('detailView').classList.contains('active')) {
            closeDetail();
        } else if (document.getElementById('settingsWindow').classList.contains('active')) {
            toggleSettings();
        } else if (document.getElementById('languageCheckboxes').style.display === 'block') {
            toggleLanguageDropdown();
        }
    }
}

// NEW: Function to clear all reading progress (optional feature)
function clearAllReadingProgress() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('readingProgress_')) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('Cleared all reading progress');
    // Refresh the view to update progress badges
    renderCards([...storeData.books, ...storeData.journals], 'allGrid', true);
    renderCards(storeData.books, 'booksGrid', true);
    renderCards(storeData.journals, 'journalsGrid', true);
}

// Main Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadDataFromJSON();

    // Render all sections with lazy loading
    renderCards([...storeData.books, ...storeData.journals], 'allGrid', true);
    renderCards(storeData.books, 'booksGrid', true);
    renderCards(storeData.journals, 'journalsGrid', true);
    
    // Initialize recent items from localStorage
    const recentItems = JSON.parse(localStorage.getItem('recentItems') || '[]');
    renderCards(recentItems, 'recentGrid', true);

    // Original inits
    initTabs();
    initSearch();
    initSettings();

    // NEW: Add scroll event listener for lazy loading
    window.addEventListener('scroll', handleScroll);

    // Event listeners
    document.getElementById('closeBtn').addEventListener('click', closeDetail);
    document.getElementById('bookModalClose').addEventListener('click', closeBookModal);
    document.getElementById('settingsIcon').addEventListener('click', toggleSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);

    // FIXED: Use the improved overlay click handler
    document.getElementById('overlay').addEventListener('click', handleOverlayClick);

    // Language checkboxes
    document.querySelectorAll('.lang-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const selectAll = document.getElementById('selectAllLanguages');
            selectAll.checked = document.querySelectorAll('.lang-checkbox').length ===
                document.querySelectorAll('.lang-checkbox:checked').length;
            updateSelectedLanguagesLabel();
            filterBooksByLanguage();
        });
    });

    // FIXED: Use improved browser back/forward handler
    window.addEventListener('popstate', handlePopState);

    // FIXED: Use improved escape key handler
    document.addEventListener('keydown', handleEscapeKey);

    // Default to "All" tab
    switchTab('all');

    console.log('Sarvstore ready! Lazy loading and permanent reading progress features implemented.');
});