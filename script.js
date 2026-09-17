/* =================================================================
   SARVSTORE v3.1
   ================================================================= */
(function () {
    'use strict';

    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    /* ============================================================
       THEME
       ============================================================ */
    const THEME_KEY = 'sarvwigyan-theme';
    const VALID_THEMES = ['light', 'dark'];

    function getStoredTheme() {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (VALID_THEMES.includes(saved)) return saved;
        } catch (_) {}
        return 'light';
    }

    function applyTheme(theme) {
        if (!VALID_THEMES.includes(theme)) theme = 'light';
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
    }

    /* ============================================================
       STATE
       ============================================================ */
    const storeData = { books: [], journals: [] };

    let currentPage = { all: 1, books: 1, journals: 1, recent: 1 };
    const CARDS_PER_PAGE = 20;
    let isLoading = false;
    let hasMoreItems = { all: true, books: true, journals: true, recent: true };

    let activeModals = [];
    let currentBookId = null;

    /* ============================================================
       READING PROGRESS
       ============================================================ */
    const SarvwigyanProgress = (function () {
        const syncEndpoint = null; // set to a URL to enable remote sync

        function keyFor(bookId) { return 'readingProgress_' + bookId; }

        function save(bookId, data) {
            const payload = {
                scrollY: data.scrollY || 0,
                percent: Math.max(0, Math.min(100, Math.round(data.percent || 0))),
                timestamp: Date.now(),
                lastRead: new Date().toISOString()
            };
            try { localStorage.setItem(keyFor(bookId), JSON.stringify(payload)); } catch (_) {}

            if (syncEndpoint) {
                fetch(syncEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.assign({ bookId: bookId }, payload)),
                    keepalive: true
                }).catch(function () { /* silent */ });
            }
        }

        function load(bookId) {
            try {
                const raw = localStorage.getItem(keyFor(bookId));
                return raw ? JSON.parse(raw) : null;
            } catch (_) { return null; }
        }

        function clear(bookId) {
            try { localStorage.removeItem(keyFor(bookId)); } catch (_) {}
        }

        function clearAll() {
            const remove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.indexOf('readingProgress_') === 0) remove.push(k);
            }
            remove.forEach(function (k) { localStorage.removeItem(k); });
        }

        function estimatePercent(p) {
            if (!p) return 0;
            if (typeof p.percent === 'number') return p.percent;
            return Math.min(100, Math.round((p.scrollY / 8000) * 100));
        }

        return { save: save, load: load, clear: clear, clearAll: clearAll, estimatePercent: estimatePercent };
    })();

    /* ============================================================
       IFRAME SCROLL TRACKING
       ============================================================ */
    function restoreScrollPosition(iframe, bookId) {
        const p = SarvwigyanProgress.load(bookId);
        if (!p || p.scrollY <= 0) return;

        const restore = function () {
            try {
                if (iframe.contentWindow) iframe.contentWindow.scrollTo(0, p.scrollY);
            } catch (_) {}
            setTimeout(function () {
                try { if (iframe.contentWindow) iframe.contentWindow.scrollTo(0, p.scrollY); } catch (_) {}
            }, 500);
            setTimeout(function () {
                try { if (iframe.contentWindow) iframe.contentWindow.scrollTo(0, p.scrollY); } catch (_) {}
            }, 1000);
        };

        try {
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') restore();
            else iframe.onload = restore;
        } catch (_) {}
    }

    function setupScrollTracking(iframe, bookId) {
        let t;
        const track = function () {
            try {
                if (!iframe.contentWindow) return;
                const win = iframe.contentWindow;
                const doc = iframe.contentDocument;
                const y = win.scrollY || doc.documentElement.scrollTop;
                const docH = Math.max(doc.documentElement.scrollHeight, (doc.body && doc.body.scrollHeight) || 0);
                const viewport = win.innerHeight || 800;
                const total = Math.max(1, docH - viewport);
                const percent = Math.min(100, Math.round((y / total) * 100));

                if (y > 100) {
                    clearTimeout(t);
                    t = setTimeout(function () {
                        SarvwigyanProgress.save(bookId, { scrollY: y, percent: percent });
                    }, 900);
                }
            } catch (_) {}
        };

        try {
            if (iframe.contentWindow) {
                iframe.contentWindow.addEventListener('scroll', track, { passive: true });
                iframe.onload = function () {
                    restoreScrollPosition(iframe, bookId);
                    try { iframe.contentWindow.addEventListener('scroll', track, { passive: true }); } catch (_) {}
                };
            }
        } catch (_) {}
    }

    /* ============================================================
       RECENT ITEMS
       ============================================================ */
    function addToRecentItems(item) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem('recentItems') || '[]'); } catch (_) {}
        list = list.filter(function (r) { return r.id !== item.id; });
        list.unshift(item);
        list = list.slice(0, 10);
        try { localStorage.setItem('recentItems', JSON.stringify(list)); } catch (_) {}

        const recentEl = document.getElementById('recent');
        if (recentEl && recentEl.classList.contains('active')) {
            renderCards(list, 'recentGrid', true);
        }
    }

    /* ============================================================
       MODALS
       ============================================================ */
    function lockBodyScroll() {
        if (activeModals.length === 0) document.body.classList.add('modal-open');
        activeModals.push('lock');
    }
    function unlockBodyScroll() {
        activeModals.pop();
        if (activeModals.length === 0) document.body.classList.remove('modal-open');
    }
    function closeAllModals() {
        let closedAny = false;
        ['bookModal', 'detailView', 'settingsWindow'].forEach(function (id) {
            const m = document.getElementById(id);
            if (m && m.classList.contains('active')) {
                m.classList.remove('active');
                closedAny = true;
            }
        });
        if (closedAny) {
            const ov = document.getElementById('overlay');
            if (ov) ov.classList.remove('active');
            activeModals = [];
            document.body.classList.remove('modal-open');
            currentBookId = null;
            history.replaceState(null, '', window.location.pathname);
        }
    }

    /* ============================================================
       SKELETONS
       ============================================================ */
    function renderSkeletons(gridId, count) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        count = count || 12;
        let html = '';
        for (let i = 0; i < count; i++) {
            html += '<div class="skeleton-card" aria-hidden="true">' +
                '<div class="skeleton-block skeleton-logo"></div>' +
                '<div class="skeleton-block skeleton-title"></div>' +
                '<div class="skeleton-block skeleton-title-2"></div>' +
                '<div class="skeleton-block skeleton-type"></div>' +
                '<div class="skeleton-block skeleton-btn"></div>' +
            '</div>';
        }
        grid.innerHTML = html;
    }

    /* ============================================================
       PAGINATION
       ============================================================ */
    function getPaginatedItems(items, section, reset) {
        if (reset) {
            currentPage[section] = 1;
            hasMoreItems[section] = true;
        }
        const endIndex = currentPage[section] * CARDS_PER_PAGE;
        const slice = items.slice(0, endIndex);
        hasMoreItems[section] = endIndex < items.length;
        return slice;
    }

    function loadMoreItems(section) {
        if (isLoading || !hasMoreItems[section]) return;
        isLoading = true;

        const indicator = document.getElementById('loadingIndicator');
        if (indicator) indicator.style.display = 'block';

        setTimeout(function () {
            currentPage[section]++;
            let items = [];
            switch (section) {
                case 'all': items = storeData.books.concat(storeData.journals); break;
                case 'books': items = storeData.books; break;
                case 'journals': items = storeData.journals; break;
                case 'recent': try { items = JSON.parse(localStorage.getItem('recentItems') || '[]'); } catch (_) { items = []; } break;
            }
            const slice = getPaginatedItems(items, section, false);
            renderCards(slice, section + 'Grid', false);

            isLoading = false;
            if (indicator && (!hasMoreItems[section] || items.length <= CARDS_PER_PAGE)) {
                indicator.style.display = 'none';
            }
        }, 260);
    }

    function isScrolledToBottom() {
        const st = window.scrollY || document.documentElement.scrollTop;
        const sh = document.documentElement.scrollHeight;
        const ch = document.documentElement.clientHeight;
        return st + ch >= sh - 120;
    }

    let scrollRaf = false;
    function handleScroll() {
        if (scrollRaf) return;
        scrollRaf = true;
        requestAnimationFrame(function () {
            const active = document.querySelector('.section.active');
            if (active && isScrolledToBottom() && hasMoreItems[active.id] && !isLoading) {
                loadMoreItems(active.id);
            }
            scrollRaf = false;
        });
    }

    /* ============================================================
       CARD RENDERING
       ============================================================ */
    function buildProgressRing(percent) {
        if (!percent || percent <= 0) return '';
        const clamped = Math.max(0, Math.min(100, percent));
        const r = 14;
        const c = 2 * Math.PI * r;
        const offset = c - (clamped / 100) * c;
        return '<div class="progress-ring-wrap" title="पढ़ना जारी रखें — ' + clamped + '%">' +
            '<svg class="progress-ring" viewBox="0 0 34 34">' +
                '<circle class="progress-ring-bg" cx="17" cy="17" r="' + r + '"></circle>' +
                '<circle class="progress-ring-fg" cx="17" cy="17" r="' + r + '" ' +
                    'stroke-dasharray="' + c.toFixed(2) + '" ' +
                    'stroke-dashoffset="' + offset.toFixed(2) + '"></circle>' +
            '</svg>' +
            '<span class="progress-ring-text">' + clamped + '</span>' +
        '</div>';
    }

    function escapeAttr(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderCards(items, gridId, reset) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const noResults = document.getElementById(gridId.replace('Grid', 'NoResults'));
        const section = gridId.replace('Grid', '');

        const indicator = document.getElementById('loadingIndicator');
        if (gridId === 'booksGrid' && indicator && reset) indicator.style.display = 'none';

        if (reset) {
            currentPage[section] = 1;
            hasMoreItems[section] = true;
        }

        if (items.length === 0 && reset) {
            grid.innerHTML = '';
            if (noResults) noResults.style.display = 'block';
            if (indicator) indicator.style.display = 'none';
            return;
        }

        if (noResults && reset) noResults.style.display = 'none';

        const paginated = getPaginatedItems(items, section, reset);

        const html = paginated.map(function (item) {
            const progress = SarvwigyanProgress.load(item.id);
            const percent = progress ? SarvwigyanProgress.estimatePercent(progress) : 0;
            const ring = buildProgressRing(percent);
            const fileUrl = item.file || item.downloadUrl || '';
            const verified = item.verified
                ? ' <i class="fas fa-check-circle" style="color:#22c55e"></i> Verified'
                : '';

            return '<div class="card" data-item-id="' + escapeAttr(item.id) + '" role="button" tabindex="0">' +
                ring +
                '<img src="' + escapeAttr(item.logo) + '" alt="' + escapeAttr(item.title) + ' logo" class="card-logo" loading="lazy" ' +
                    'onerror="this.onerror=null;this.src=\'https://via.placeholder.com/80?text=Logo\'">' +
                '<div class="card-title">' + escapeAttr(item.title) + '</div>' +
                '<div class="card-type">' + escapeAttr(item.type) + verified + '</div>' +
                '<button type="button" class="card-download" data-url="' + escapeAttr(fileUrl) + '" data-id="' + escapeAttr(item.id) + '">Read</button>' +
            '</div>';
        }).join('');

        if (reset) grid.innerHTML = html;
        else grid.insertAdjacentHTML('beforeend', html);

        if (indicator && gridId === 'booksGrid') {
            if (!hasMoreItems[section] || items.length <= CARDS_PER_PAGE) indicator.style.display = 'none';
        }
    }

    /* ============================================================
       DELEGATION
       ============================================================ */
    function findItemById(id) {
        const all = storeData.books.concat(storeData.journals);
        for (let i = 0; i < all.length; i++) {
            if (all[i].id == id) return all[i];
        }
        return null;
    }

    function attachGridDelegation() {
        ['allGrid', 'booksGrid', 'journalsGrid', 'recentGrid'].forEach(function (gridId) {
            const grid = document.getElementById(gridId);
            if (!grid) return;

            grid.addEventListener('click', function (e) {
                const dl = e.target.closest('.card-download');
                if (dl) {
                    e.stopPropagation();
                    handleDownloadClick(e, dl.getAttribute('data-url'), dl.getAttribute('data-id'));
                    return;
                }
                const card = e.target.closest('.card');
                if (card) {
                    const item = findItemById(card.getAttribute('data-item-id'));
                    if (item) openDetail(item);
                }
            });

            grid.addEventListener('keydown', function (e) {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) {
                    e.preventDefault();
                    const item = findItemById(e.target.getAttribute('data-item-id'));
                    if (item) openDetail(item);
                }
            });
        });
    }

    /* ============================================================
       TABS
       ============================================================ */
    function switchTab(tabId) {
        $$('.section').forEach(function (s) { s.classList.remove('active'); });
        $$('.tab').forEach(function (t) {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });

        const section = document.getElementById(tabId);
        if (section) section.classList.add('active');

        const tab = document.querySelector('[data-tab="' + tabId + '"]');
        if (tab) {
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
        }

        if (tabId === 'recent') {
            let recent = [];
            try { recent = JSON.parse(localStorage.getItem('recentItems') || '[]'); } catch (_) {}
            renderCards(recent, 'recentGrid', true);
        }
    }

    function initTabs() {
        $$('.tab').forEach(function (tab) {
            tab.addEventListener('click', function (e) {
                e.preventDefault();
                switchTab(tab.getAttribute('data-tab'));
            });
            tab.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    switchTab(tab.getAttribute('data-tab'));
                }
            });
        });
    }

    /* ============================================================
       SEARCH
       ============================================================ */
    function initSearch() {
        const input = document.getElementById('searchInput');
        if (!input) return;

        let t;
        input.addEventListener('input', function () {
            clearTimeout(t);
            t = setTimeout(function () {
                const q = input.value.toLowerCase().trim();
                const active = document.querySelector('.section.active');
                if (!active) return;

                let items = [];
                switch (active.id) {
                    case 'all': items = storeData.books.concat(storeData.journals); break;
                    case 'books': items = storeData.books; break;
                    case 'journals': items = storeData.journals; break;
                    case 'recent': try { items = JSON.parse(localStorage.getItem('recentItems') || '[]'); } catch (_) { items = []; } break;
                }

                const filtered = items.filter(function (i) {
                    return i.title.toLowerCase().indexOf(q) !== -1 ||
                        (i.shortDesc && i.shortDesc.toLowerCase().indexOf(q) !== -1) ||
                        i.type.toLowerCase().indexOf(q) !== -1;
                });

                renderCards(filtered, active.id + 'Grid', true);
            }, 180);
        });
    }

    /* ============================================================
       SETTINGS
       ============================================================ */
    function initSettings() {
        applyTheme(getStoredTheme());
        const sel = document.getElementById('theme');
        if (sel) sel.value = document.documentElement.getAttribute('data-theme') || 'light';
    }

    function toggleSettings() {
        const sw = document.getElementById('settingsWindow');
        const ov = document.getElementById('overlay');
        if (!sw || !ov) return;
        const wasOpen = sw.classList.contains('active');
        if (!wasOpen) closeAllModals();
        sw.classList.toggle('active');
        ov.classList.toggle('active');

        if (!wasOpen) {
            lockBodyScroll();
            history.pushState({ modal: 'settings' }, '', '#settings');
        } else {
            unlockBodyScroll();
            history.replaceState(null, '', window.location.pathname);
        }
    }

    function saveSettings() {
        const sel = document.getElementById('theme');
        if (!sel) return;
        applyTheme(sel.value);
        toggleSettings();
    }

    /* ============================================================
       DETAIL VIEW
       ============================================================ */
    function openDetail(item) {
        addToRecentItems(item);

        const logoEl = document.getElementById('detailLogo');
        if (logoEl) { logoEl.src = item.logo; logoEl.alt = item.title + ' logo'; }

        const set = function (id, val) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        set('detailTitle', item.title);
        set('detailType', item.type);
        set('detailShortDesc', item.shortDesc || '');
        set('detailLongDesc', item.longDesc || '');

        const verifiedEl = document.getElementById('detailVerified');
        if (verifiedEl) {
            verifiedEl.innerHTML = item.verified
                ? '<i class="fas fa-check-circle" style="color:#22c55e"></i> Verified'
                : '';
            const progress = SarvwigyanProgress.load(item.id);
            if (progress) {
                const pct = SarvwigyanProgress.estimatePercent(progress);
                const info = document.createElement('div');
                info.className = 'detail-progress';
                info.innerHTML = '<span style="color:var(--accent); font-size:0.85rem;">📖 ' + pct + '% पूर्ण — जहाँ छोड़ा था वहीं से जारी रखें</span>';
                verifiedEl.appendChild(info);
            }
        }

        const imagesDiv = document.getElementById('detailImages');
        if (imagesDiv) {
            imagesDiv.innerHTML = '';
            if (item.images && item.images.length) {
                item.images.forEach(function (src, idx) {
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = (item.imageAlts && item.imageAlts[idx]) || (item.title + ' image ' + (idx + 1));
                    img.style.cursor = 'pointer';
                    img.loading = 'lazy';
                    img.onclick = function () { window.open(src, '_blank', 'noopener,noreferrer'); };
                    imagesDiv.appendChild(img);
                });
            }
        }

        const btn = document.getElementById('detailDownload');
        if (btn) {
            const progress = SarvwigyanProgress.load(item.id);
            btn.textContent = progress ? 'Continue Reading' : 'Read';
            btn.onclick = function () {
                handleDownloadClick(null, item.file || item.downloadUrl || '', item.id);
            };
        }

        closeAllModals();

        const detail = document.getElementById('detailView');
        const ov = document.getElementById('overlay');
        if (detail) detail.classList.add('active');
        if (ov) ov.classList.add('active');
        lockBodyScroll();
        history.pushState({ modal: 'detail' }, '', '#detail');
    }

    function closeDetail() {
        const el = document.getElementById('detailView');
        const ov = document.getElementById('overlay');
        if (el) el.classList.remove('active');
        if (ov) ov.classList.remove('active');
        unlockBodyScroll();
        history.replaceState(null, '', window.location.pathname);
    }

    /* ============================================================
       BOOK MODAL
       ============================================================ */
    function handleDownloadClick(event, url, itemId) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        currentBookId = itemId;

        if (event) {
            const card = event.target.closest('.card');
            if (card) {
                const item = findItemById(card.getAttribute('data-item-id'));
                if (item) addToRecentItems(item);
            }
        }

        if (!url) { alert('Content not available yet.'); return; }

        closeAllModals();

        const iframe = document.getElementById('bookIframe');
        const modal = document.getElementById('bookModal');
        const ov = document.getElementById('overlay');

        if (iframe) iframe.src = url;
        if (modal) modal.classList.add('active');
        if (ov) ov.classList.add('active');
        lockBodyScroll();
        history.pushState({ modal: 'book' }, '', '#book');

        setTimeout(function () {
            if (iframe) setupScrollTracking(iframe, itemId);
        }, 1000);
    }

    function closeBookModal() {
        if (currentBookId) {
            try {
                const iframe = document.getElementById('bookIframe');
                if (iframe && iframe.contentWindow) {
                    const y = iframe.contentWindow.scrollY || iframe.contentDocument.documentElement.scrollTop;
                    if (y > 100) {
                        const doc = iframe.contentDocument;
                        const docH = Math.max(doc.documentElement.scrollHeight, (doc.body && doc.body.scrollHeight) || 0);
                        const viewport = iframe.contentWindow.innerHeight || 800;
                        const total = Math.max(1, docH - viewport);
                        const pct = Math.min(100, Math.round((y / total) * 100));
                        SarvwigyanProgress.save(currentBookId, { scrollY: y, percent: pct });
                    }
                }
            } catch (_) {}
        }

        const modal = document.getElementById('bookModal');
        const iframe = document.getElementById('bookIframe');
        const ov = document.getElementById('overlay');

        if (modal) modal.classList.remove('active');
        if (iframe) iframe.src = '';
        if (ov) ov.classList.remove('active');
        unlockBodyScroll();
        history.replaceState(null, '', window.location.pathname);
        currentBookId = null;
    }

    /* ============================================================
       FILTERS
       ============================================================ */
    function toggleLanguageDropdown() {
        const dd = document.getElementById('languageCheckboxes');
        const arrow = document.getElementById('langDropdownArrow');
        if (!dd || !arrow) return;
        const open = dd.style.display === 'block';
        dd.style.display = open ? 'none' : 'block';
        arrow.classList.toggle('rotate', !open);
    }

    function toggleAllLanguages(cb) {
        $$('.lang-checkbox').forEach(function (c) { c.checked = cb.checked; });
        updateSelectedLanguagesLabel();
        filterBooksByLanguage();
    }

    function updateSelectedLanguagesLabel() {
        const checked = $$('.lang-checkbox:checked');
        const labels = checked.map(function (cb) {
            return cb.value.charAt(0).toUpperCase() + cb.value.slice(1);
        }).join(', ');
        const el = document.getElementById('selectedLanguagesLabel');
        if (el) el.textContent = labels || 'Select Language';
    }

    function filterBooksByLanguage() {
        const sel = $$('.lang-checkbox:checked').map(function (cb) { return cb.value.toLowerCase(); });
        let filtered = storeData.books;
        if (sel.length) {
            filtered = filtered.filter(function (b) {
                return sel.indexOf((b.language || '').toLowerCase()) !== -1;
            });
        }
        renderCards(filtered, 'booksGrid', true);
    }

    function handleMainFilterChange() {
        const f = document.getElementById('booksFilter');
        if (!f) return;
        const v = f.value;
        const wrapper = document.getElementById('languageFilterWrapper');
        const arrow = document.getElementById('mainFilterArrow');
        if (arrow) arrow.classList.toggle('rotate', v !== '');
        if (v === 'language') {
            if (wrapper) wrapper.style.display = 'block';
            filterBooksByLanguage();
        } else {
            if (wrapper) wrapper.style.display = 'none';
            renderCards(storeData.books, 'booksGrid', true);
        }
    }

    /* ============================================================
       DATA LOADER
       ============================================================ */
    async function loadDataFromJSON() {
        renderSkeletons('allGrid', 12);
        renderSkeletons('booksGrid', 12);
        renderSkeletons('journalsGrid', 8);

        const fetchJson = function (url) {
            return fetch(url).then(function (r) {
                return r.ok ? r.json() : [];
            }).catch(function () { return []; });
        };

        try {
            const results = await Promise.all([
                fetchJson('books.json'),
                fetchJson('journals.json')
            ]);
            storeData.books = results[0] || [];
            storeData.journals = results[1] || [];
        } catch (err) {
            console.error('Data load error:', err);
        }
    }

    /* ============================================================
       GLOBAL HANDLERS
       ============================================================ */
    function handleOverlayClick(e) {
        const ov = document.getElementById('overlay');
        if (e.target !== ov) return;
        if (document.getElementById('bookModal').classList.contains('active')) closeBookModal();
        else if (document.getElementById('detailView').classList.contains('active')) closeDetail();
        else if (document.getElementById('settingsWindow').classList.contains('active')) toggleSettings();
    }

    function handlePopState() {
        if (document.getElementById('bookModal').classList.contains('active')) closeBookModal();
        else if (document.getElementById('detailView').classList.contains('active')) closeDetail();
        else if (document.getElementById('settingsWindow').classList.contains('active')) toggleSettings();
    }

    function handleEscapeKey(e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('bookModal').classList.contains('active')) closeBookModal();
        else if (document.getElementById('detailView').classList.contains('active')) closeDetail();
        else if (document.getElementById('settingsWindow').classList.contains('active')) toggleSettings();
        else {
            const box = document.getElementById('languageCheckboxes');
            if (box && box.style.display === 'block') toggleLanguageDropdown();
        }
    }

    /* ============================================================
       BOOT
       ============================================================ */
    async function boot() {
        applyTheme(getStoredTheme());

        await loadDataFromJSON();

        renderCards(storeData.books.concat(storeData.journals), 'allGrid', true);
        renderCards(storeData.books, 'booksGrid', true);
        renderCards(storeData.journals, 'journalsGrid', true);

        let recent = [];
        try { recent = JSON.parse(localStorage.getItem('recentItems') || '[]'); } catch (_) {}
        renderCards(recent, 'recentGrid', true);

        attachGridDelegation();
        initTabs();
        initSearch();
        initSettings();

        window.addEventListener('scroll', handleScroll, { passive: true });

        const closeBtn = document.getElementById('closeBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeDetail);
        const bookModalClose = document.getElementById('bookModalClose');
        if (bookModalClose) bookModalClose.addEventListener('click', closeBookModal);
        const settingsIcon = document.getElementById('settingsIcon');
        if (settingsIcon) settingsIcon.addEventListener('click', toggleSettings);
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) saveBtn.addEventListener('click', saveSettings);
        const overlay = document.getElementById('overlay');
        if (overlay) overlay.addEventListener('click', handleOverlayClick);

        $$('.lang-checkbox').forEach(function (cb) {
            cb.addEventListener('change', function () {
                const all = document.getElementById('selectAllLanguages');
                if (all) {
                    all.checked = $$('.lang-checkbox').length === $$('.lang-checkbox:checked').length;
                }
                updateSelectedLanguagesLabel();
                filterBooksByLanguage();
            });
        });

        window.addEventListener('popstate', handlePopState);
        document.addEventListener('keydown', handleEscapeKey);

        switchTab('all');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();