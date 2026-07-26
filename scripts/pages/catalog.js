
(function() {
    'use strict';

    let catalogLoaded = false;
    let currentMode = 'Featured';   // catalog opens on the Featured section (was Classic)
    let currentCategory = 'All';
    let currentSubcategory = '';
    let currentPage = 1;
    let currentCursor = '';
    let currentKeyword = '';
    let totalPages = 1;
    const itemsPerPage = 30;

    let currentSalesType = 'All';

    let currentTimeFilter = 'AllTime';

    let classicItemsList = null;

    let cursorHistory = [''];
    let isLoadingPage = false;
    let pendingReload = false;
    let lastLoadedPage = 1;
    let catalogLoadToken = 0;
    let catalogRenderGen = 0;
    let classicTotalItems = 0;

    let economyWorker = null;
    let workerTaskId = 0;
    const workerCallbacks = new Map();

    function initWorker() {
        if (!economyWorker) {
            try {
                economyWorker = new Worker('scripts/workers/economy-worker.js');
                economyWorker.addEventListener('message', function(e) {
                    const { id, success, result, error } = e.data;
                    const callback = workerCallbacks.get(id);
                    if (callback) {
                        workerCallbacks.delete(id);
                        if (success) {
                            callback.resolve(result);
                        } else {
                            callback.reject(new Error(error));
                        }
                    }
                });
                economyWorker.addEventListener('error', function(e) {
                    console.error('[Catalog] Worker error:', e.message);
                });
                console.log('[Catalog] Economy worker initialized');
            } catch (e) {
                console.warn('[Catalog] Failed to initialize worker:', e);
            }
        }
    }

    function runWorkerTask(type, data) {
        if (!economyWorker) return Promise.reject(new Error('Worker not initialized'));

        return new Promise((resolve, reject) => {
            const id = ++workerTaskId;
            workerCallbacks.set(id, { resolve, reject });
            economyWorker.postMessage({ type, data, id });
        });
    }

    // Category/Subcategory coordinates from the API's OWN enum endpoints (catalog.roblox.com
    // /v1/categories + /v1/subcategories). This is the v1 search request form — the only one that
    // returns nextPageCursor (the old taxonomy-hash form never paginates). Group headers map to a
    // bare Category (native umbrellas: Accessories=11, Body=18, Clothing=3).
    const categoryMap = {
        'All': { catalogCategory: 1 },
        'Accessories': { catalogCategory: 11 },
        'Body': { catalogCategory: 18 },
        'Clothing': { catalogCategory: 3 },
        // no 3D-only union exists in the search API (Subcategory 52 is not searchable) — the group
        // maps to the Clothing umbrella; its flyout leaves stay 3D-specific.
        '3D Clothing': { catalogCategory: 3 },
        'Hats': { catalogCategory: 11, catalogSubcategory: 54 },
        'Hair': { catalogCategory: 18, catalogSubcategory: 20 },
        'Face': { catalogCategory: 11, catalogSubcategory: 21 },
        'Neck': { catalogCategory: 11, catalogSubcategory: 22 },
        'Shoulder': { catalogCategory: 11, catalogSubcategory: 23 },
        'Front': { catalogCategory: 11, catalogSubcategory: 24 },
        'Back': { catalogCategory: 11, catalogSubcategory: 25 },
        'Waist': { catalogCategory: 11, catalogSubcategory: 26 },
        'Gear': { catalogCategory: 11, catalogSubcategory: 5 },
        'Faces': { catalogCategory: 18, catalogSubcategory: 10 },
        'Heads': { catalogCategory: 18, catalogSubcategory: 15 },
        'Packages': { catalogCategory: 18, catalogSubcategory: 37 },
        'T-Shirts': { catalogCategory: 3, catalogSubcategory: 55 },
        'Shirts': { catalogCategory: 3, catalogSubcategory: 56 },
        'Pants': { catalogCategory: 3, catalogSubcategory: 57 },
        'Emotes': { catalogCategory: 12, catalogSubcategory: 39 },
        'Animations': { catalogCategory: 12, catalogSubcategory: 38 },
        '3D T-Shirts': { catalogCategory: 3, catalogSubcategory: 58 },
        '3D Shirts': { catalogCategory: 3, catalogSubcategory: 59 },
        '3D Pants': { catalogCategory: 3, catalogSubcategory: 60 },
        'Jackets': { catalogCategory: 3, catalogSubcategory: 61 },
        'Sweaters': { catalogCategory: 3, catalogSubcategory: 62 },
        'Shorts': { catalogCategory: 3, catalogSubcategory: 63 },
        'Dresses & Skirts': { catalogCategory: 3, catalogSubcategory: 65 },
        'Shoes': { catalogCategory: 3, catalogSubcategory: 64 }
    };

    const sortTypeMap = {
        'Relevance': 0,
        'Classic': 0,
        'Featured': 0,
        'TopFavorites': 1,  
        'BestSelling': 2,   
        'RecentlyUpdated': 3, 
        'ForSale': 4,       
        'PriceHighToLow': 4, 
        'PriceLowToHigh': 5, 
        'PublicDomain': 0   
    };

    let filterCreator = '';
    let filterPriceMin = null;
    let filterPriceMax = null;

    const isStandalonePage = window.location.pathname.includes('catalog.html');

    if (isStandalonePage) {
        document.addEventListener('DOMContentLoaded', initCatalog);
    } else {
        
        document.addEventListener('pageChange', function(e) {
            if (e.detail.page === 'catalog') {
                if (!catalogLoaded) {
                    loadCatalogPage();
                } else {
                    
                    initCatalog();
                }
            }
        });
    }

    async function loadClassicItemsFromJSON() {
        if (classicItemsList) {
            return classicItemsList;
        }

        try {
            const response = await fetch('data/classic-items.json');
            if (!response.ok) throw new Error('Failed to load classic items JSON');

            const data = await response.json();

            let allItems = [];

            if (Array.isArray(data.items)) {
                
                allItems = data.items;
            } else if (data.items && typeof data.items === 'object') {
                
                for (const category of Object.keys(data.items)) {
                    const categoryItems = data.items[category];
                    if (Array.isArray(categoryItems)) {
                        allItems.push(...categoryItems);
                    }
                }
            }

            try {
                const facesResponse = await fetch('data/faces-2011.json');
                if (facesResponse.ok) {
                    const facesData = await facesResponse.json();
                    if (facesData.faces && Array.isArray(facesData.faces)) {
                        
                        const faceItems = facesData.faces.map(face => ({
                            id: face.id,
                            name: face.name,
                            filter: 'Faces-ForSale', 
                            category: 'Faces',
                            source: face.source || 'wayback-2011'
                        }));

                        const existingIds = new Set(allItems.map(item => item.id));
                        const newFaces = faceItems.filter(face => !existingIds.has(face.id));

                        if (newFaces.length > 0) {
                            allItems.push(...newFaces);
                            console.log(`Added ${newFaces.length} faces from 2011 Wayback catalog`);
                        }
                    }
                }
            } catch (facesError) {
                console.warn('Failed to load 2011 faces:', facesError);
                
            }

            classicItemsList = allItems;
            console.log(`Loaded ${classicItemsList.length} classic items from JSON`);
            return classicItemsList;
        } catch (error) {
            console.error('Failed to load classic items JSON:', error);
            return [];
        }
    }

    async function loadCatalogPage() {
        const container = document.getElementById('catalog-content');
        if (!container) {
            console.error('Catalog container not found');
            return;
        }

        container.innerHTML = '<div class="catalog-loading">Loading catalog...</div>';

        try {
            const response = await fetch('pages/catalog.html');
            if (!response.ok) throw new Error('Failed to fetch catalog page');

            let html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const catalogContainer = doc.getElementById('CatalogContainer');
            if (catalogContainer) {
                let content = catalogContainer.innerHTML;
                content = content.replace(/\.\.\/images\//g, 'images/');
                content = content.replace(/\.\.\/CSS\//g, 'CSS/');

                browseModeHandlerAttached = false;
                categoryHandlerAttached = false;
                paginationHandlerAttached = false;

                container.innerHTML = '<div id="CatalogContainer">' + content + '</div>';
                catalogLoaded = true;
                initCatalog();
            } else {
                const bodyDiv = doc.getElementById('Body');
                if (bodyDiv) {
                    let content = bodyDiv.innerHTML;
                    content = content.replace(/\.\.\/images\//g, 'images/');
                    content = content.replace(/\.\.\/CSS\//g, 'CSS/');

                    browseModeHandlerAttached = false;
                    categoryHandlerAttached = false;
                    paginationHandlerAttached = false;

                    container.innerHTML = content;
                    catalogLoaded = true;
                    initCatalog();
                } else {
                    if (window.showErrorPage) {
                        window.showErrorPage('Failed to parse catalog page', 'catalog-content');
                    } else {
                        container.innerHTML = '<div class="catalog-error">Failed to parse catalog page</div>';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load catalog page:', error);
            if (window.showErrorPage) {
                window.showErrorPage('Failed to load catalog: ' + error.message, 'catalog-content');
            } else {
                container.innerHTML = '<div class="catalog-error">Failed to load catalog: ' + error.message + '</div>';
            }
        }
    }

    function initCatalog() {
        
        initWorker();

        filterCreator = '';
        filterPriceMin = null;
        filterPriceMax = null;

        const creatorInput = document.getElementById('CatalogCreatorFilter');
        const priceMinInput = document.getElementById('CatalogPriceMin');
        const priceMaxInput = document.getElementById('CatalogPriceMax');
        if (creatorInput) creatorInput.value = '';
        if (priceMinInput) priceMinInput.value = '';
        if (priceMaxInput) priceMaxInput.value = '';

        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (itemsContainer) {
            itemsContainer.innerHTML = `
                <div class="catalog-classic-loading" style="text-align: center; padding: 60px 20px;">
                    <img src="images/spinners/spinner100x100.gif" alt="Loading..." style="margin-bottom: 10px;"><br>
                    <span style="color: #666;">Loading items...</span>
                </div>
            `;
        }

        initSearchHandlers();
        initBrowseModeHandlers();
        initCategoryHandlers();
        initPaginationHandlers();
        initFilterHandlers();
        initLegendToggle();
        initBrowseCategoryDropdown();
        initDropdownToggleButton();

        // Landing = splash state (authentic /catalog/): dropdown open, no Filters stack.
        setCatalogNavState('splash');
        syncFilterLinkSelection();

        // Breadcrumb label (authentic .breadCrumbFilter data-filter="category"): clicking it keeps
        // the category but clears everything below it (keyword, creator, prices) per Pages.Catalog's
        // cascading-clear f({...}).
        const breadcrumb = document.getElementById('ctl00_cphRoblox_rbxCatalog_AssetsDisplaySetLabel');
        if (breadcrumb && breadcrumb.classList.contains('breadCrumbFilter') && !breadcrumb.dataset.wired) {
            breadcrumb.dataset.wired = '1';
            breadcrumb.addEventListener('click', function(e) {
                e.preventDefault();
                currentKeyword = '';
                filterCreator = '';
                filterPriceMin = null;
                filterPriceMax = null;
                const si = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchTextBox');
                const ci = document.getElementById('CatalogCreatorFilter');
                const pmin = document.getElementById('CatalogPriceMin');
                const pmax = document.getElementById('CatalogPriceMax');
                if (si) si.value = '';
                if (ci) ci.value = '';
                if (pmin) pmin.value = '';
                if (pmax) pmax.value = '';
                currentPage = 1; currentCursor = ''; cursorHistory = [''];
                syncFilterLinkSelection();
                updateDisplayLabel();
                loadCatalogItems();
            });
        }

        // The h1 "Catalog" link returns to the landing (authentic: it linked to /catalog/).
        const catalogLink = document.getElementById('CatalogLink');
        if (catalogLink && !catalogLink.dataset.wired) {
            catalogLink.dataset.wired = '1';
            catalogLink.addEventListener('click', function(e) {
                e.preventDefault();
                currentMode = 'Featured';
                const sm = document.getElementById('SortMain');
                if (sm) sm.value = 'Relevance';
                currentCategory = 'All';
                currentSalesType = 'All';
                currentKeyword = '';
                filterCreator = '';
                filterPriceMin = null;
                filterPriceMax = null;
                currentPage = 1;
                currentCursor = '';
                cursorHistory = [''];
                const si = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchTextBox');
                if (si) si.value = '';
                setCatalogNavState('splash');
                syncCategorySelection();
                syncFilterLinkSelection();
                updateCategoryAvailability();
                updateTimeFilterVisibility();
                updateDisplayLabel();
                loadCatalogItems();
            });
        }

        updateCategoryAvailability();

        updateDisplayLabel();

        loadCatalogItems();
        
        console.log('Catalog page initialized with live API');
    }

    // ===== Two-state left nav (authentic /catalog/ vs /catalog/browse.aspx) =====
    // The real site had TWO server-rendered states: the LANDING (/catalog/) with the always-open
    // #dropdown.splashdropdown, and the BROWSE state (/catalog/browse.aspx — where every category/
    // search/filter/sort action navigated) where the dropdown collapses to a click-toggle popup
    // (#dropdown.browsedropdown) and the left nav shows the Filters stack (#CatalogFilters) instead,
    // with the legend gaining .divider-top. Rovloo swaps states client-side (no page reload).
    function setCatalogNavState(state) {
        const dropdown = document.getElementById('dropdown');
        const filters = document.getElementById('CatalogFilters');
        const legend = document.getElementById('legend');
        const btn = document.getElementById('BrowseCategoriesButton');
        if (!dropdown) return;
        const browse = state === 'browse';
        dropdown.classList.toggle('splashdropdown', !browse);
        dropdown.classList.toggle('browsedropdown', browse);
        dropdown.classList.remove('open');
        if (filters) filters.style.display = browse ? '' : 'none';
        if (legend) legend.classList.toggle('divider-top', browse);
        // Splash button is permanently lit (archive: class="browseDropdownButton hover").
        if (btn) btn.classList.toggle('hover', !browse);
        catalogNavState = browse ? 'browse' : 'splash';
    }
    let catalogNavState = 'splash';
    function enterBrowseState() { if (catalogNavState !== 'browse') setCatalogNavState('browse'); }

    // Port of the real Widgets.HierarchicalDropdown InitializeDropdown (the click-toggle used by the
    // browse-state .browsedropdown popup): button hover lights it, click toggles the dropdown (kept
    // lit while open), any document click closes. In splash state the dropdown is display:block via
    // CSS, so the toggle only affects the browse state's .open class.
    function initDropdownToggleButton() {
        const btn = document.getElementById('BrowseCategoriesButton');
        const dropdown = document.getElementById('dropdown');
        if (!btn || !dropdown || btn.dataset.toggleWired) return;
        btn.dataset.toggleWired = '1';
        let open = false;
        let fadeTimer = null;

        // jQuery fadeIn/fadeOut("fast") = 200ms opacity fade — the real InitializeDropdown used
        // exactly that on the browse-state popup.
        const FADE_MS = 200;
        function fadeIn() {
            clearTimeout(fadeTimer);
            dropdown.classList.add('open');
            dropdown.style.transition = 'none';
            dropdown.style.opacity = '0';
            void dropdown.offsetWidth;
            dropdown.style.transition = `opacity ${FADE_MS}ms`;
            dropdown.style.opacity = '1';
        }
        function fadeOut() {
            clearTimeout(fadeTimer);
            dropdown.style.transition = `opacity ${FADE_MS}ms`;
            dropdown.style.opacity = '0';
            fadeTimer = setTimeout(() => {
                dropdown.classList.remove('open');
                dropdown.style.transition = '';
                dropdown.style.opacity = '';
            }, FADE_MS);
        }

        btn.addEventListener('mouseover', () => btn.classList.add('hover'));
        btn.addEventListener('mouseout', () => { if (!open && catalogNavState === 'browse') btn.classList.remove('hover'); });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (catalogNavState !== 'browse') return;
            if (open) {
                fadeOut();
                open = false;
                btn.classList.remove('hover');
            } else {
                btn.classList.add('hover');
                fadeIn();
                open = true;
            }
        });
        document.addEventListener('click', () => {
            if (catalogNavState === 'browse' && open) {
                fadeOut();
                open = false;
                btn.classList.remove('hover');
            }
        });
    }

    // Combined category+salestype selection (one reload) — used by the Browse dropdown (incl. the
    // Collectibles slideOut, whose links carry data-salestype [+ data-category]) and the browse-state
    // flat Category list. keepFilters = authentic data-keepfilters semantics (category switches keep
    // creator/price filters; plain selections clear them, per Pages.Catalog's s() vs f({types,category})).
    function applySelection(opts) {
        // Section entries (Featured/Classic in Browse by Category) carry a mode; picking one resets
        // the sort select to Relevance-equivalent browsing of that section. A PLAIN selection (no
        // data-mode) must LEAVE a section — on the real page category links navigated to browse.aspx
        // with just Category, dropping Featured; only sorts persisted. Without this the catalog never
        // leaves Featured/Classic once entered.
        if (opts.mode !== undefined) {
            currentMode = opts.mode;
        } else if (currentMode === 'Classic' || currentMode === 'Featured') {
            currentMode = 'Relevance';
        }
        const sm = document.getElementById('SortMain');
        if (sm) sm.value = [...sm.options].some(o => o.value === currentMode) ? currentMode : 'Relevance';
        updateTimeFilterVisibility();
        if (opts.salesType !== undefined) currentSalesType = opts.salesType;
        if (opts.category !== undefined) currentCategory = opts.category;
        if (!opts.keepFilters) {
            // Authentic s() semantics: a plain selection clears the KEYWORD too — without this a
            // previous search kept contaminating every category you switched into.
            currentKeyword = '';
            filterCreator = '';
            filterPriceMin = null;
            filterPriceMax = null;
            const si = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchTextBox');
            const ci = document.getElementById('CatalogCreatorFilter');
            const pmin = document.getElementById('CatalogPriceMin');
            const pmax = document.getElementById('CatalogPriceMax');
            if (si) si.value = '';
            if (ci) ci.value = '';
            if (pmin) pmin.value = '';
            if (pmax) pmax.value = '';
            syncFilterLinkSelection();
        }
        currentPage = 1;
        currentCursor = '';
        cursorHistory = [''];
        enterBrowseState();
        syncCategorySelection();
        updateCategoryAvailability();
        updateDisplayLabel();
        loadCatalogItems();
    }

    // Mark .selected on the dropdown + flat category lists to reflect the current section
    // (mode Classic/Featured), Collectibles salestype, and category.
    function syncCategorySelection() {
        const isColl = currentSalesType === 'Collectible';
        const isSection = currentMode === 'Classic' || currentMode === 'Featured';
        document.querySelectorAll('#CategoryList li, #FlatCategoryList li').forEach(li => {
            if (li.classList.contains('DropdownDivider')) return;
            const link = li.querySelector(':scope > a[data-category], :scope > a[data-salestype], :scope > a[data-mode]') || li.querySelector('a[data-category]');
            if (!link) { li.classList.remove('selected'); return; }
            const linkColl = link.dataset.salestype === 'Collectible';
            const linkMode = link.dataset.mode;
            const linkCat = link.dataset.category;
            let selected;
            if (isColl) {
                selected = linkColl && (linkCat === undefined || linkCat === currentCategory);
            } else if (isSection) {
                selected = linkMode === currentMode && (linkCat === undefined || linkCat === currentCategory || linkCat === 'All');
            } else {
                selected = !linkColl && linkMode === undefined && linkCat === currentCategory;
            }
            li.classList.toggle('selected', !!selected);
        });
    }

    // Mark .selected on the creator/price filter link lists from the current filter state.
    function syncFilterLinkSelection() {
        document.querySelectorAll('#CatalogFilters .creatorFilter').forEach(a => {
            a.classList.toggle('selected', (a.dataset.creator || '') === (filterCreator || ''));
        });
        const priceMode = (filterPriceMin === 0 && filterPriceMax === 0) ? 'free'
            : (filterPriceMin !== null || filterPriceMax !== null) ? 'robux' : 'all';
        document.querySelectorAll('#CatalogFilters .priceFilter').forEach(a => {
            a.classList.toggle('selected', a.dataset.price === priceMode);
        });
        const priceInputs = document.getElementById('priceInputs');
        if (priceInputs) priceInputs.style.display = (priceMode === 'robux') ? '' : 'none';
    }

    // Faithful vanilla-JS port of the real 2013 `Widgets.HierarchicalDropdown` module (recovered from
    // jsak.roblox.com/e8b579b8…js — see reference/catalog-js/Widgets.HierarchicalDropdown.js). The real
    // plugin drove the "Browse by Category" slideout flyouts with DIRECTION-AWARE hover intent: it
    // tracks the mouse X direction over the dropdown, and when you hover a row it either shows that
    // row's submenu immediately, or — if you're travelling RIGHT toward an already-considered submenu
    // (or the row is data-delay="always") — waits 1000ms before committing, so diagonally crossing
    // other rows on the way to a submenu doesn't hijack it. data-delay="never" = always immediate,
    // "ignore" = do nothing. Submenus equalize their li widths and hide 100ms after leaving the box.
    // Submenu vertical position came from server-rendered per-row `top:-Npx` offsets aligning each
    // submenu to the box top; we compute the equivalent once so tall submenus stay in view.
    function initBrowseCategoryDropdown() {
        const dropdown = document.getElementById('dropdown');
        const list = document.getElementById('CategoryList');
        if (!dropdown || !list || dropdown.dataset.hdInit) return;
        dropdown.dataset.hdInit = '1';

        const topLis = Array.from(list.children);
        const allSubs = () => Array.from(list.querySelectorAll(':scope > li > ul'));
        let lastX = 0, dir = 0;          // dir: 1 = moving right (toward submenu), else -1 (as in the original)
        let delayTimer = null;

        // Pre-align each submenu to the box top (server did this via inline top:-Npx).
        allSubs().forEach(ul => { ul.style.top = (-ul.parentElement.offsetTop) + 'px'; });

        const hoveredSub = () => list.querySelector(':scope > li > ul[data-hover="true"]');
        function hideAll() { allSubs().forEach(ul => { ul.style.display = 'none'; }); topLis.forEach(li => li.classList.remove('hover-open')); }
        function equalizeWidths(ul) {
            let w = ul.offsetWidth;
            const lis = ul.querySelectorAll('li');
            lis.forEach(li => { if (li.offsetWidth > w) w = li.offsetWidth; });
            lis.forEach(li => { if (li.offsetWidth < w) li.style.width = w + 'px'; });
        }
        function show(li) {
            const sub = li.querySelector(':scope > ul');
            hideAll();
            if (sub) { sub.style.display = 'block'; li.classList.add('hover-open'); equalizeWidths(sub); }
        }

        allSubs().forEach(ul => {
            ul.addEventListener('mouseover', () => { ul.dataset.hover = 'true'; });
            ul.addEventListener('mouseout', () => { ul.dataset.hover = 'false'; });
        });

        topLis.forEach(li => {
            li.addEventListener('mouseover', () => {
                const delay = li.dataset.delay;
                if (delay === 'ignore' || hoveredSub()) return;
                li.dataset.hover = 'true';
                if (delay !== 'never' && (dir === 1 || delay === 'always')) {
                    clearTimeout(delayTimer);
                    delayTimer = setTimeout(() => {
                        if (!hoveredSub()) {
                            const hv = list.querySelector(':scope > li[data-hover="true"]');
                            if (hv) show(hv); else hideAll();
                        }
                    }, 1000);
                } else {
                    show(li);
                }
            });
            li.addEventListener('mouseout', () => { delete li.dataset.hover; });
        });

        dropdown.addEventListener('mouseleave', () => { setTimeout(hideAll, 100); lastX = 0; dir = 0; });
        dropdown.addEventListener('mousemove', e => {
            const prev = lastX; lastX = e.pageX;
            dir = prev < lastX ? 1 : -1;   // matches the original: 1 when moving right, else -1
        });

        // Selecting a category closes the flyout; clicking outside closes it too.
        list.addEventListener('click', e => { if (e.target.closest('a[data-category], a[data-salestype]')) hideAll(); });
        document.addEventListener('click', e => { if (!dropdown.contains(e.target)) hideAll(); });
    }

    function initLegendToggle() {
        const header = document.getElementById('legendheader');
        const content = document.getElementById('legendcontent');
        if (!header || !content || header.dataset.wired) return;
        header.dataset.wired = '1';
        header.addEventListener('click', function() {
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : '';
            header.classList.toggle('expanded', !isOpen);
        });
    }

    function initFilterHandlers() {
        const creatorInput = document.getElementById('CatalogCreatorFilter');
        const priceMinInput = document.getElementById('CatalogPriceMin');
        const priceMaxInput = document.getElementById('CatalogPriceMax');
        const applyBtn = document.getElementById('CatalogApplyFilters');
        const clearBtn = document.getElementById('CatalogClearFilters');

        // Revisiting the catalog re-runs initCatalog on the SAME persistent DOM — without a guard
        // every visit stacked another set of listeners (N visits = N loads per click/Enter).
        if (applyBtn && applyBtn.dataset.wired) return;
        if (applyBtn) applyBtn.dataset.wired = '1';

        function applyFiltersFromInputs() {
            filterCreator = creatorInput?.value.trim() || '';
            filterPriceMin = priceMinInput?.value ? parseInt(priceMinInput.value, 10) : null;
            filterPriceMax = priceMaxInput?.value ? parseInt(priceMaxInput.value, 10) : null;

            currentPage = 1;
            currentCursor = '';
            cursorHistory = [''];

            enterBrowseState();
            syncFilterLinkSelection();
            updateDisplayLabel();
            loadCatalogItems();
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                applyFiltersFromInputs();
            });
        }

        // Price Go button (browse-state Currency/Price px inputs).
        const priceGoBtn = document.getElementById('CatalogPriceGo');
        if (priceGoBtn) {
            priceGoBtn.addEventListener('click', function(e) {
                e.preventDefault();
                applyFiltersFromInputs();
            });
        }

        // Authentic browse-state filter LINK lists (recovered browse.aspx: .creatorFilter /
        // .priceFilter). All Creators/ROBLOX set the creator; All Currency clears prices, Robux
        // reveals the px inputs, Free = exactly 0.
        const filtersBlock = document.getElementById('CatalogFilters');
        if (filtersBlock && !filtersBlock.dataset.linksWired) {
            filtersBlock.dataset.linksWired = '1';
            filtersBlock.addEventListener('click', function(e) {
                const creatorLink = e.target.closest('a.creatorFilter');
                if (creatorLink) {
                    e.preventDefault();
                    filterCreator = creatorLink.dataset.creator || '';
                    if (creatorInput) creatorInput.value = filterCreator;
                    currentPage = 1; currentCursor = ''; cursorHistory = [''];
                    syncFilterLinkSelection();
                    updateDisplayLabel();
                    loadCatalogItems();
                    return;
                }
                const priceLink = e.target.closest('a.priceFilter');
                if (priceLink) {
                    e.preventDefault();
                    const mode = priceLink.dataset.price;
                    if (mode === 'all') { filterPriceMin = null; filterPriceMax = null; }
                    else if (mode === 'free') { filterPriceMin = 0; filterPriceMax = 0; }
                    else if (mode === 'robux') {
                        // Reveal the px inputs; only reload once a range is applied via Go.
                        filterPriceMin = filterPriceMin ?? null;
                        document.querySelectorAll('#CatalogFilters .priceFilter').forEach(a => a.classList.toggle('selected', a === priceLink));
                        const pi = document.getElementById('priceInputs');
                        if (pi) pi.style.display = '';
                        return;
                    }
                    if (priceMinInput) priceMinInput.value = filterPriceMin ?? '';
                    if (priceMaxInput) priceMaxInput.value = filterPriceMax ?? '';
                    currentPage = 1; currentCursor = ''; cursorHistory = [''];
                    syncFilterLinkSelection();
                    updateDisplayLabel();
                    loadCatalogItems();
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.preventDefault();

                filterCreator = '';
                filterPriceMin = null;
                filterPriceMax = null;

                if (creatorInput) creatorInput.value = '';
                if (priceMinInput) priceMinInput.value = '';
                if (priceMaxInput) priceMaxInput.value = '';

                currentPage = 1;
                currentCursor = '';
                cursorHistory = [''];
                
                updateDisplayLabel();
                loadCatalogItems();
            });
        }

        [creatorInput, priceMinInput, priceMaxInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        applyBtn?.click();
                    }
                });
            }
        });
    }

    function initSearchHandlers() {
        const searchInput = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchTextBox');
        const searchBtn = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchButton');
        const resetBtn = document.getElementById('ctl00_cphRoblox_rbxCatalog_ResetSearchButton');

        // Same double-binding guard as initFilterHandlers (initCatalog re-runs on every revisit).
        if (searchBtn && searchBtn.dataset.wired) return;
        if (searchBtn) searchBtn.dataset.wired = '1';

        if (searchBtn) {
            searchBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const query = searchInput?.value.trim();
                searchCatalog(query);
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchCatalog(this.value.trim());
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                currentKeyword = '';
                setMode('Relevance');
            });
        }

        // Authentic: the search-bar category select re-runs the search on change (empty-search enabled).
        const catSelect = document.getElementById('categoriesForKeyword');
        if (catSelect) {
            catSelect.addEventListener('change', function() {
                searchCatalog(searchInput ? searchInput.value.trim() : '');
            });
        }
    }

    let browseModeHandlerAttached = false;
    let categoryHandlerAttached = false;
    let paginationHandlerAttached = false;

    function initBrowseModeHandlers() {

        if (browseModeHandlerAttached) return;

        // Authentic sort control (recovered Pages.Catalog): #SortMain = sort type, #SortAggregation =
        // time aggregation, plus a Collectibles-only checkbox for Rovloo's salestype filter.
        const sortMain = document.getElementById('SortMain');
        const sortAgg = document.getElementById('SortAggregation');
        const collCheck = document.getElementById('collectiblesOnlyCheckbox');
        if (sortMain || sortAgg || collCheck) {
            if (sortMain) sortMain.addEventListener('change', () => setMode(sortMain.value));
            if (sortAgg) sortAgg.addEventListener('change', () => setTimeFilter(sortAgg.value));
            if (collCheck) collCheck.addEventListener('change', () => setSalesType(collCheck.checked ? 'Collectible' : 'All'));
            browseModeHandlerAttached = true;
            return;
        }

        // Legacy fallback: the old #BrowseMode vertical list (a[href*='m=']).
        const browseMode = document.getElementById('BrowseMode');
        if (!browseMode) return;

        browseMode.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && browseMode.contains(link)) {
                e.preventDefault();
                e.stopPropagation();
                const href = link.getAttribute('href') || '';
                const modeMatch = href.match(/m=(\w+)/);
                if (modeMatch) setMode(modeMatch[1]);
            }
        });

        browseModeHandlerAttached = true;
    }

    function initCategoryHandlers() {
        const browseMode = document.getElementById('BrowseMode');
        const browseUl = browseMode && browseMode.querySelector('ul');

        // Legacy list-injection path — only runs if a #BrowseMode <ul> is present. The sort UI now
        // uses the authentic #SortMain/#SortAggregation selects (recovered Pages.Catalog), so
        // #BrowseMode is gone and this block is skipped; the statically-provided #CategoryList
        // (authentic dropdown) is used as-is. Handler binding below always runs.
        if (browseMode && browseUl) {
        if (!document.getElementById('TimeFilterList')) {
            const timeFilterHtml = `
                <div id="TimeFilterSection" style="display: none;">
                    <h2 id="TimeFilterHeader">Time</h2>
                    <ul id="TimeFilterList">
                        <li class="selected"><h3><a href="#" data-timefilter="AllTime">All Time</a></h3></li>
                        <li><h3><a href="#" data-timefilter="PastWeek">Past Week</a></h3></li>
                        <li><h3><a href="#" data-timefilter="PastDay">Past Day</a></h3></li>
                    </ul>
                </div>
            `;
            browseMode.insertAdjacentHTML('beforebegin', timeFilterHtml);
        }

        if (!document.getElementById('SortByList')) {
            const sortByHtml = `
                <h2>Sort By</h2>
                <ul id="SortByList">
                    <li class="selected"><h3><a href="#" data-salestype="All">All</a></h3></li>
                    <li><h3><a href="#" data-salestype="Collectible">Collectible</a></h3></li>
                </ul>
            `;
            browseUl.insertAdjacentHTML('afterend', sortByHtml);
        }

        if (!document.getElementById('CategoryList')) {
            const sortByList = document.getElementById('SortByList');
            if (sortByList) {
                const categoryHtml = `
                    <h2>Categories</h2>
                    <ul id="CategoryList">
                        <li class="selected"><h3><a href="#" data-category="All">All Categories</a></h3></li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="accessories">▶ Accessories</a></h3>
                            <ul class="category-subitems" data-group="accessories" style="display: none;">
                                <li><h3><a href="#" data-category="Hats">Hats</a></h3></li>
                                <li><h3><a href="#" data-category="Hair">Hair</a></h3></li>
                                <li><h3><a href="#" data-category="Face">Face Accessories</a></h3></li>
                                <li><h3><a href="#" data-category="Neck">Neck</a></h3></li>
                                <li><h3><a href="#" data-category="Shoulder">Shoulder</a></h3></li>
                                <li><h3><a href="#" data-category="Front">Front</a></h3></li>
                                <li><h3><a href="#" data-category="Back">Back</a></h3></li>
                                <li><h3><a href="#" data-category="Waist">Waist</a></h3></li>
                            </ul>
                        </li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="body">▶ Body</a></h3>
                            <ul class="category-subitems" data-group="body" style="display: none;">
                                <li><h3><a href="#" data-category="Faces">Faces</a></h3></li>
                                <li><h3><a href="#" data-category="Heads">Heads</a></h3></li>
                                <li><h3><a href="#" data-category="Packages">Packages</a></h3></li>
                            </ul>
                        </li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="clothing">▶ Clothing</a></h3>
                            <ul class="category-subitems" data-group="clothing" style="display: none;">
                                <li><h3><a href="#" data-category="T-Shirts">T-Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="Shirts">Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="Pants">Pants</a></h3></li>
                            </ul>
                        </li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="clothing3d">▶ 3D Clothing</a></h3>
                            <ul class="category-subitems" data-group="clothing3d" style="display: none;">
                                <li><h3><a href="#" data-category="3D T-Shirts">T-Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="3D Shirts">Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="Sweaters">Sweaters</a></h3></li>
                                <li><h3><a href="#" data-category="Jackets">Jackets</a></h3></li>
                                <li><h3><a href="#" data-category="3D Pants">Pants</a></h3></li>
                                <li><h3><a href="#" data-category="Shorts">Shorts</a></h3></li>
                                <li><h3><a href="#" data-category="Dresses & Skirts">Dresses & Skirts</a></h3></li>
                                <li><h3><a href="#" data-category="Bodysuits">Bodysuits</a></h3></li>
                                <li><h3><a href="#" data-category="Shoes">Shoes</a></h3></li>
                            </ul>
                        </li>
                        
                        <li><h3><a href="#" data-category="Gear">Gear</a></h3></li>
                        <li><h3><a href="#" data-category="Emotes">Emotes</a></h3></li>
                        <li><h3><a href="#" data-category="Animations">Animations</a></h3></li>
                    </ul>
                `;
                sortByList.insertAdjacentHTML('afterend', categoryHtml);
            }
        }
        } // end legacy injection (only when #BrowseMode present)

        const sortByList = document.getElementById('SortByList');
        if (sortByList && !sortByList.dataset.handlerAttached) {
            sortByList.addEventListener('click', function(e) {
                const link = e.target.closest('a[data-salestype]');
                if (link) {
                    e.preventDefault();
                    const salesType = link.dataset.salestype;
                    setSalesType(salesType);
                }
            });
            sortByList.dataset.handlerAttached = 'true';
        }

        const timeFilterList = document.getElementById('TimeFilterList');
        if (timeFilterList && !timeFilterList.dataset.handlerAttached) {
            timeFilterList.addEventListener('click', function(e) {
                const link = e.target.closest('a[data-timefilter]');
                if (link) {
                    e.preventDefault();
                    const timeFilter = link.dataset.timefilter;
                    setTimeFilter(timeFilter);
                }
            });
            timeFilterList.dataset.handlerAttached = 'true';
        }

        if (categoryHandlerAttached) return;

        const categoryList = document.getElementById('CategoryList');
        if (categoryList) {
            categoryList.addEventListener('click', function(e) {

                const toggleLink = e.target.closest('a.category-toggle');
                if (toggleLink) {
                    e.preventDefault();
                    const group = toggleLink.dataset.group;
                    const subitems = categoryList.querySelector(`.category-subitems[data-group="${group}"]`);
                    if (subitems) {
                        const isHidden = subitems.style.display === 'none';
                        subitems.style.display = isHidden ? '' : 'none';

                        toggleLink.textContent = (isHidden ? '▼ ' : '▶ ') + toggleLink.textContent.substring(2);
                    }
                    return;
                }

                const link = e.target.closest('a[data-category], a[data-salestype], a[data-mode]');
                if (link) {
                    e.preventDefault();
                    // Section entries (Featured/Classic) carry data-mode; Collectibles entries carry
                    // data-salestype (optionally + data-category, e.g. "Collectible Hats"); plain
                    // entries carry only data-category (salestype resets, current sort kept).
                    applySelection({
                        mode: link.dataset.mode,
                        category: link.dataset.category !== undefined ? link.dataset.category : 'All',
                        salesType: link.dataset.salestype !== undefined ? link.dataset.salestype : 'All'
                    });
                }
            });
            categoryHandlerAttached = true;
        }

        // Browse-state flat Category list (authentic data-keepfilters: keep creator/price filters
        // when switching category from the filter stack).
        const flatList = document.getElementById('FlatCategoryList');
        if (flatList && !flatList.dataset.handlerAttached) {
            flatList.dataset.handlerAttached = '1';
            flatList.addEventListener('click', function(e) {
                const link = e.target.closest('a.assetTypeFilter');
                if (!link) return;
                e.preventDefault();
                applySelection({
                    mode: link.dataset.mode,
                    category: link.dataset.category !== undefined ? link.dataset.category : 'All',
                    salesType: link.dataset.salestype !== undefined ? link.dataset.salestype : 'All',
                    keepFilters: link.dataset.keepfilters !== undefined
                });
            });
        }
    }

    function initPaginationHandlers() {
        
        if (paginationHandlerAttached) return;

        const catalogContainer = document.getElementById('catalog-content') || document.body;
        catalogContainer.addEventListener('click', function(e) {

            const prevBtn = e.target.closest('.catalog-prev-btn');
            if (prevBtn) {
                e.preventDefault();
                if (isLoadingPage) { console.warn('[Catalog pager] prev ignored: a load is still in flight'); return; }

                if (currentPage > 1) {
                    currentPage--;

                    if (currentMode !== 'Classic' && cursorHistory.length > 1) {
                        cursorHistory.pop();
                        currentCursor = cursorHistory[cursorHistory.length - 1] || '';
                    }
                    loadCatalogItems();
                } else {
                    console.log('[Catalog pager] prev ignored: already on page 1');
                }
                return;
            }

            const nextBtn = e.target.closest('.catalog-next-btn');
            if (nextBtn) {
                e.preventDefault();
                if (isLoadingPage) { console.warn('[Catalog pager] next ignored: a load is still in flight'); return; }

                const canGoNext = currentMode === 'Classic'
                    ? currentPage < totalPages
                    : (currentPage < totalPages || currentCursor);

                if (canGoNext) {
                    currentPage++;
                    console.log(`[Catalog pager] next -> page ${currentPage} (mode=${currentMode}, cursor=${!!currentCursor})`);
                    loadCatalogItems();
                } else {
                    console.warn(`[Catalog pager] next ignored: no more pages known (page=${currentPage}, totalPages=${totalPages}, cursor=${JSON.stringify(currentCursor)})`);
                }
            }
        });

        paginationHandlerAttached = true;
    }

    function bindPaginationHandlers() {
        
    }

    function setMode(mode) {
        currentMode = mode;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = [''];

        // Authentic: sort changes navigated to browse.aspx — enter the browse state.
        enterBrowseState();

        // Sync the authentic sort select (source of truth is currentMode). Section modes
        // (Classic/Featured) have no sort option — the select shows Relevance for them.
        const sortMain = document.getElementById('SortMain');
        if (sortMain && sortMain.value !== mode) {
            sortMain.value = [...sortMain.options].some(o => o.value === mode) ? mode : 'Relevance';
        }

        // Legacy #BrowseMode list marking (harmless if the list is absent).
        const modeItems = document.querySelectorAll('#BrowseMode ul li');
        modeItems.forEach(li => {
            const link = li.querySelector('a');
            const href = link?.getAttribute('href') || '';
            li.className = href.includes('m=' + mode) ? 'Selected' : '';
        });

        updateCategoryAvailability();

        updateTimeFilterVisibility();

        updateDisplayLabel();
        loadCatalogItems();
    }

    function updateCategoryAvailability() {
        const categoryList = document.getElementById('CategoryList');
        if (!categoryList) return;

        const isClassicMode = currentMode === 'Classic';
        const isCollectibleMode = currentSalesType === 'Collectible';
        const allowedInClassic = ['All', 'Faces'];
        
        // The v1 search scopes collectibles natively (SalesTypeFilter=2 combines with any
        // Category/Subcategory — verified live), so the old taxonomy-era category restrictions for
        // collectibles mode are gone.
        const notAllowedInCollectible = [];

        // Grey/disable LEAF links directly (dropdown slideOut leaves + browse-state flat list) —
        // iterating li's grabbed a group row's first slideOut leaf and greyed the wrong element.
        document.querySelectorAll('#CategoryList a[data-category], #FlatCategoryList a[data-category]').forEach(link => {
            const li = link.closest('li');
            const category = link.dataset.category;
            // Collectible entries (data-salestype) are governed by mode, not category lists.
            const isCollectibleEntry = link.dataset.salestype !== undefined;
            // Section entries (data-mode: Classic/Featured) SWITCH section, so mode restrictions
            // never apply to them.
            const isSectionEntry = link.dataset.mode !== undefined;

            let isAllowed = true;
            if (isClassicMode && !isSectionEntry && (isCollectibleEntry || !allowedInClassic.includes(category))) {
                isAllowed = false;
            }
            if (isCollectibleMode && !isCollectibleEntry && !isSectionEntry && notAllowedInCollectible.includes(category)) {
                isAllowed = false;
            }

            if (isAllowed) {
                if (li) li.classList.remove('disabled');
                link.style.pointerEvents = '';
                link.style.color = '';
            } else {
                if (li) li.classList.add('disabled');
                link.style.pointerEvents = 'none';
                link.style.color = '#999';
            }
        });

        if (isCollectibleMode && notAllowedInCollectible.includes(currentCategory)) {
            currentCategory = 'All';
            categoryList.querySelectorAll('li').forEach(li => {
                
                if (li.classList.contains('category-group')) return;
                
                const link = li.querySelector('a[data-category]');
                if (link?.dataset.category === 'All') {
                    li.classList.add('selected');
                } else {
                    li.classList.remove('selected');
                }
            });
        }

        const sortByList = document.getElementById('SortByList');
        if (sortByList) {
            sortByList.querySelectorAll('li').forEach(li => {
                const link = li.querySelector('a[data-salestype]');
                if (!link) return;

                const salesType = link.dataset.salestype;
                const isAllowed = !isClassicMode || salesType === 'All';

                if (isAllowed) {
                    li.classList.remove('disabled');
                    link.style.pointerEvents = '';
                    link.style.color = '';
                } else {
                    li.classList.add('disabled');
                    link.style.pointerEvents = 'none';
                    link.style.color = '#999';
                }
            });

            if (isClassicMode && currentSalesType === 'Collectible') {
                currentSalesType = 'All';
                sortByList.querySelectorAll('li').forEach(li => {
                    const link = li.querySelector('a[data-salestype]');
                    li.className = (link?.dataset.salestype === 'All') ? 'selected' : '';
                });
            }
        }

        // Authentic Collectibles-only checkbox: disabled in Classic mode (no collectibles there),
        // and force-unchecked if it was on.
        const collCheck = document.getElementById('collectiblesOnlyCheckbox');
        if (collCheck) {
            collCheck.disabled = isClassicMode;
            if (isClassicMode && currentSalesType === 'Collectible') { currentSalesType = 'All'; }
            collCheck.checked = (currentSalesType === 'Collectible');
        }
    }

    function setCategory(category) {
        currentCategory = category;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = [''];

        enterBrowseState();
        syncCategorySelection();

        updateDisplayLabel();
        loadCatalogItems();
    }

    function setSalesType(salesType) {
        currentSalesType = salesType;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = [''];

        enterBrowseState();
        syncCategorySelection();

        // Legacy list sync (harmless if absent).
        document.querySelectorAll('#SortByList li').forEach(li => {
            const link = li.querySelector('a');
            li.className = (link?.dataset.salestype === salesType) ? 'selected' : '';
        });

        updateCategoryAvailability();

        updateDisplayLabel();
        loadCatalogItems();
    }

    function setTimeFilter(timeFilter) {
        currentTimeFilter = timeFilter;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = [''];

        enterBrowseState();

        // Sync authentic #SortAggregation select + legacy list (harmless if absent).
        const sortAgg = document.getElementById('SortAggregation');
        if (sortAgg && sortAgg.value !== timeFilter) sortAgg.value = timeFilter;
        document.querySelectorAll('#TimeFilterList li').forEach(li => {
            const link = li.querySelector('a');
            li.className = (link?.dataset.timefilter === timeFilter) ? 'selected' : '';
        });

        updateDisplayLabel();
        loadCatalogItems();
    }

    function updateTimeFilterVisibility() {
        const sortAgg = document.getElementById('SortAggregation');
        const timeFilterSection = document.getElementById('TimeFilterSection');
        const timeFilterList = document.getElementById('TimeFilterList');

        // Authentic: the time/aggregation select is only relevant for Top Favorites / Best Selling.
        const showTimeFilter = currentMode === 'TopFavorites' || currentMode === 'BestSelling';

        if (sortAgg) sortAgg.style.display = showTimeFilter ? '' : 'none';
        if (timeFilterSection) timeFilterSection.style.display = showTimeFilter ? '' : 'none';

        if (!showTimeFilter && currentTimeFilter !== 'AllTime') {
            currentTimeFilter = 'AllTime';
            if (sortAgg) sortAgg.value = 'AllTime';
            if (timeFilterList) {
                timeFilterList.querySelectorAll('li').forEach(li => {
                    const link = li.querySelector('a[data-timefilter]');
                    if (link?.dataset.timefilter === 'AllTime') {
                        li.className = 'selected';
                    } else {
                        li.className = '';
                    }
                });
            }
        }
    }

    function updateDisplayLabel() {
        const displayLabel = document.getElementById('ctl00_cphRoblox_rbxCatalog_AssetsDisplaySetLabel');
        if (displayLabel) {
            const modeNames = {
                'Relevance': 'All Items',
                'Classic': 'Classic Items',
                'Featured': 'Featured Items',
                'TopFavorites': 'Top Favorites',
                'RecentlyUpdated': 'Recently Updated',
                'ForSale': 'For Sale',
                'BestSelling': 'Best Selling',
                'PriceHighToLow': 'Price (High to Low)',
                'PriceLowToHigh': 'Price (Low to High)'
            };
            
            let label = modeNames[currentMode] || 'Items';

            if ((currentMode === 'TopFavorites' || currentMode === 'BestSelling') && currentTimeFilter !== 'AllTime') {
                const timeNames = {
                    'PastWeek': '(Past Week)',
                    'PastDay': '(Past Day)'
                };
                label += ' ' + (timeNames[currentTimeFilter] || '');
            }

            // Breadcrumb wording (authentic .breadCrumbFilter style): keyword > collectibles >
            // plain browsing ("All Categories" / bare category name) > sort-mode with category suffix.
            if (currentKeyword) {
                label = `Search Results: "${currentKeyword}"`;
            } else if (currentSalesType === 'Collectible') {
                const collLabel = currentCategory !== 'All' ? `Collectible ${currentCategory}` : 'Collectibles';
                label = currentMode === 'Relevance' ? collLabel : `${label} - ${collLabel}`;
            } else if (currentMode === 'Relevance') {
                label = currentCategory !== 'All' ? currentCategory : 'All Categories';
            } else if (currentCategory !== 'All') {
                label += ` - ${currentCategory}`;
            }

            if (filterCreator) {
                label += ` by ${filterCreator}`;
            }
            if (filterPriceMin !== null || filterPriceMax !== null) {
                const minStr = filterPriceMin !== null ? `R$${filterPriceMin}` : 'R$0';
                const maxStr = filterPriceMax !== null ? `R$${filterPriceMax}` : '∞';
                label += ` (${minStr} - ${maxStr})`;
            }
            
            displayLabel.textContent = label;
        }

        // Authentic "Showing X - Y of Z results" line (browse.aspx #secondRow). Only rendered when
        // the totals are actually known (Classic mode); cursor-based API modes can't know Z.
        const countEl = document.getElementById('CatalogResultsCount');
        if (countEl) {
            if (currentMode === 'Classic' && classicTotalItems > 0) {
                const start = (currentPage - 1) * itemsPerPage + 1;
                const end = Math.min(currentPage * itemsPerPage, classicTotalItems);
                countEl.textContent = `Showing ${start.toLocaleString()} - ${end.toLocaleString()} of ${classicTotalItems.toLocaleString()} results`;
            } else {
                countEl.textContent = '';
            }
        }
    }

    function searchCatalog(query) {
        currentKeyword = query;

        // Authentic: the search-bar category select scopes the keyword search by category.
        const catSel = document.getElementById('categoriesForKeyword');
        if (catSel && catSel.value) {
            currentCategory = catSel.value;
        }

        currentPage = 1;
        currentCursor = '';
        cursorHistory = [''];
        enterBrowseState();
        syncCategorySelection();
        updateDisplayLabel();
        loadCatalogItems();
    }

    async function loadClassicItems() {
        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        const table = itemsContainer?.querySelector('table');

        const allItems = await loadClassicItemsFromJSON();

        if (!allItems || allItems.length === 0) {
            console.warn('No classic items found in JSON');
            return [];
        }

        let filteredItems = allItems;
        if (currentKeyword) {
            const keyword = currentKeyword.toLowerCase();
            filteredItems = allItems.filter(item => 
                item.name && item.name.toLowerCase().includes(keyword)
            );
        }

        if (currentCategory && currentCategory !== 'All') {
            filteredItems = filteredItems.filter(item => {
                
                if (item.filter) {
                    return item.filter.toLowerCase().startsWith(currentCategory.toLowerCase());
                }
                
                if (item.category) {
                    return item.category.toLowerCase() === currentCategory.toLowerCase();
                }
                return false;
            });
        }

        totalPages = Math.ceil(filteredItems.length / itemsPerPage);
        classicTotalItems = filteredItems.length;
        const startIdx = (currentPage - 1) * itemsPerPage;
        const pageItems = filteredItems.slice(startIdx, startIdx + itemsPerPage);

        console.log(`Classic items: ${filteredItems.length} total, page ${currentPage}/${totalPages}, showing ${pageItems.length} items`);

        if (pageItems.length > 0) {
            const items = pageItems.map(item => ({ itemType: 'Asset', id: item.id }));
            try {
                let detailsResponse;
                if (window.roblox?.getCatalogItemDetails) {
                    detailsResponse = await window.roblox.getCatalogItemDetails(items);
                } else if (window.robloxAPI?.getCatalogItemDetails) {
                    detailsResponse = await window.robloxAPI.getCatalogItemDetails(items);
                }

                if (detailsResponse?.data) {
                    
                    const detailsMap = new Map();
                    detailsResponse.data.forEach(item => {
                        const id = item.id || item.assetId;
                        if (id) detailsMap.set(id, item);
                    });

                    const economyCache = getEconomyCache();

                    const mergedItems = pageItems.map(jsonItem => {
                        const apiItem = detailsMap.get(jsonItem.id);
                        const economyData = economyCache[jsonItem.id];
                        
                        let result;
                        if (apiItem) {
                            result = {
                                ...apiItem,
                                id: jsonItem.id,
                                name: apiItem.name || jsonItem.name,
                                itemType: apiItem.itemType || 'Asset'
                            };
                        } else {
                            
                            result = {
                                id: jsonItem.id,
                                name: jsonItem.name,
                                itemType: 'Asset',
                                creatorName: 'ROBLOX',
                                creatorTargetId: 1,
                                price: null,
                                favoriteCount: 0
                            };
                        }

                        if (economyData) {
                            result.isLimited = economyData.isLimited;
                            result.isLimitedUnique = economyData.isLimitedUnique;
                            result.isForSale = economyData.isForSale;
                            result.priceInRobux = economyData.priceInRobux;
                            if (economyData.lowestSellerPrice) {
                                result.lowestResalePrice = economyData.lowestSellerPrice;
                            }
                        }
                        
                        return result;
                    });

                    return mergedItems;
                }
            } catch (error) {
                console.warn('Failed to fetch item details, using JSON data:', error);
            }
        }

        const economyCache = getEconomyCache();
        return pageItems.map(item => {
            const economyData = economyCache[item.id];
            const result = {
                id: item.id,
                name: item.name,
                itemType: 'Asset',
                creatorName: 'ROBLOX',
                creatorTargetId: 1,
                price: null,
                favoriteCount: 0
            };

            if (economyData) {
                result.isLimited = economyData.isLimited;
                result.isLimitedUnique = economyData.isLimitedUnique;
                result.isForSale = economyData.isForSale;
                result.priceInRobux = economyData.priceInRobux;
                if (economyData.lowestSellerPrice) {
                    result.lowestResalePrice = economyData.lowestSellerPrice;
                }
            }
            
            return result;
        });
    }

    function applyFilters(items) {
        if (!items || items.length === 0) {
            return items;
        }

        let filteredItems = items;

        if (filterCreator) {
            const creatorLower = filterCreator.toLowerCase();
            filteredItems = filteredItems.filter(item => {
                const itemCreator = (item.creatorName || '').toLowerCase();
                return itemCreator.includes(creatorLower);
            });
        }

        if (filterPriceMin !== null || filterPriceMax !== null) {
            filteredItems = filteredItems.filter(item => {
                
                const price = item.lowestResalePrice || item.price || item.priceInRobux;

                if (price === null || price === undefined) {
                    return false;
                }

                if (filterPriceMin !== null && price < filterPriceMin) {
                    return false;
                }
                if (filterPriceMax !== null && price > filterPriceMax) {
                    return false;
                }
                return true;
            });
        }

        if (filterPriceMin !== null || filterPriceMax !== null) {
            filteredItems.sort((a, b) => {
                const priceA = a.lowestResalePrice || a.price || a.priceInRobux || 0;
                const priceB = b.lowestResalePrice || b.price || b.priceInRobux || 0;
                return priceA - priceB;
            });
        }

        if (filterCreator) {
            filteredItems.sort((a, b) => {
                const creatorA = (a.creatorName || '').toLowerCase();
                const creatorB = (b.creatorName || '').toLowerCase();
                return creatorA.localeCompare(creatorB);
            });
        }

        return filteredItems;
    }

    async function loadCatalogItems() {
        // A selection made while a load is in flight must not be silently dropped (that left the UI
        // showing the OLD category with the NEW selection highlighted, and desynced the pager) —
        // queue one trailing reload that picks up the latest state instead.
        if (isLoadingPage) { pendingReload = true; return; }
        isLoadingPage = true;

        // Watchdog: if anything in this load hangs without resolving (a dead IPC call, a request
        // that never settles), isLoadingPage would stay true forever and every pager/filter click
        // would be silently ignored from then on — the exact "stuck on page 1" failure. Force-clear
        // the flag after 20s and surface the timeout visibly.
        const loadToken = ++catalogLoadToken;
        setTimeout(() => {
            if (isLoadingPage && loadToken === catalogLoadToken) {
                console.error('[Catalog] Load watchdog fired: a catalog load hung for 20s — clearing the in-flight flag');
                isLoadingPage = false;
                const box = document.querySelector('#CatalogContainer .Assets .StandardBox');
                if (box && !box.querySelector('.CatalogItemOuter')) {
                    box.innerHTML = '<div class="catalog-no-results" style="text-align:center;padding:40px;color:#cc0000;">Catalog load timed out — check the console for the request that never finished, then try again.</div>';
                }
                const overlay = document.querySelector('#CatalogContainer .catalog-loading-overlay');
                if (overlay) overlay.style.display = 'none';
            }
        }, 20000);
        
        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (!itemsContainer) {
            console.log('Items container not found');
            isLoadingPage = false;
            return;
        }

        const table = itemsContainer.querySelector('table');

        if (currentMode === 'Classic' && !table) {
            itemsContainer.innerHTML = `
                <div class="catalog-classic-loading" style="text-align: center; padding: 60px 20px;">
                    <img src="images/spinners/spinner100x100.gif" alt="Loading..." style="margin-bottom: 10px;"><br>
                    <span style="color: #666;">Loading classic items...</span>
                </div>
            `;
        } else {
            
            let loadingOverlay = itemsContainer.querySelector('.catalog-loading-overlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'catalog-loading-overlay';
                loadingOverlay.innerHTML = `<div class="catalog-loading-spinner">Loading page ${currentPage}...</div>`;
                itemsContainer.style.position = 'relative';
                itemsContainer.appendChild(loadingOverlay);
            } else {
                loadingOverlay.innerHTML = `<div class="catalog-loading-spinner">Loading page ${currentPage}...</div>`;
                loadingOverlay.style.display = 'flex';
            }

            if (table) {
                table.style.opacity = '0.3';
            }
        }

        document.querySelectorAll('.catalog-prev-btn, .catalog-next-btn').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });

        try {
            
            const hasFilters = filterCreator || filterPriceMin !== null || filterPriceMax !== null;

            if (currentMode === 'Classic' && !hasFilters) {
                const items = await loadClassicItems();
                await renderCatalogItems(items);
                lastLoadedPage = currentPage;
                updatePagination();
                // Refresh the "Showing X - Y of Z results" line now that classicTotalItems is known.
                updateDisplayLabel();

                fetchResalePricesForLimitedItems(items, true);

                preloadAllClassicEconomyData();
                return;
            }

            const catMapping = categoryMap[currentCategory] || { catalogCategory: 1 };
            const sortType = sortTypeMap[currentMode] ?? 0;

            let sortAggregation = null;
            if ((currentMode === 'TopFavorites' || currentMode === 'BestSelling') && currentTimeFilter !== 'AllTime') {
                sortAggregation = currentTimeFilter === 'PastDay' ? 1 : 3;
            }

            const cursorToUse = cursorHistory[currentPage - 1] || '';

            const params = {
                // v1 Category/Subcategory coordinates (the paginating request form)
                catalogCategory: catMapping.catalogCategory ?? 1,
                catalogSubcategory: catMapping.catalogSubcategory || null,
                sortType: sortType,
                sortAggregation: sortAggregation,
                keyword: currentKeyword,
                limit: itemsPerPage,
                cursor: cursorToUse,
                collectiblesOnly: currentSalesType === 'Collectible',

                creatorName: filterCreator || '',
                minPrice: filterPriceMin,
                maxPrice: filterPriceMax
            };

            console.log('Fetching catalog with params:', params);

            let response;
            if (window.roblox?.searchCatalog) {
                response = await window.roblox.searchCatalog(params);
            } else if (window.robloxAPI?.searchCatalog) {
                response = await window.robloxAPI.searchCatalog(params);
            } else {
                throw new Error('Catalog API not available');
            }

            console.log('Catalog response:', response);

            if (response?.data) {
                await renderCatalogItems(response.data);

                if (response.nextPageCursor) {
                    currentCursor = response.nextPageCursor;
                    
                    if (cursorHistory.length <= currentPage) {
                        cursorHistory.push(currentCursor);
                        
                        if (cursorHistory.length > 10) {
                            cursorHistory.shift(); 
                            currentPage--; 
                        }
                    } else {
                        cursorHistory[currentPage] = currentCursor;
                    }
                    totalPages = currentPage + 1;
                } else {
                    currentCursor = '';
                    totalPages = currentPage;
                }
                lastLoadedPage = currentPage;
                updatePagination();

                fetchResalePricesForLimitedItems(response.data);
            } else {
                await renderCatalogItems([]);
            }
        } catch (error) {
            console.error('Failed to load catalog items:', error);
            // The old error path wrote into a <table> that no longer exists since the tile rewrite —
            // failures (e.g. a rejected page-2 cursor) were completely invisible and the pager just
            // silently stayed put. Show the error in the tiles container and roll the page counter
            // back to what it was before this request so the pager stays consistent.
            // Clamp, don't assign: a failed page-N navigation rolls back to the last good page, but a
            // failed FRESH load (selection reset currentPage to 1) must stay at 1, not jump forward
            // to a stale lastLoadedPage from the previous selection.
            currentPage = Math.min(lastLoadedPage, currentPage);
            itemsContainer.innerHTML = '<div class="catalog-no-results" style="text-align:center;padding:40px;color:#cc0000;">Failed to load items: ' + escapeHtml(error.message) + '</div>';
            updatePagination();
        } finally {
            isLoadingPage = false;

            const overlay = itemsContainer.querySelector('.catalog-loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }

            const table = itemsContainer.querySelector('table');
            if (table) {
                table.style.opacity = '1';
            }

            document.querySelectorAll('.catalog-prev-btn, .catalog-next-btn').forEach(btn => {
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            });

            // Run the reload queued by a selection made while this load was in flight.
            if (pendingReload) {
                pendingReload = false;
                loadCatalogItems();
            }
        }
    }

    async function renderCatalogItems(items) {
        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (!itemsContainer) return;

        if (window.roblox?.blacklist?.filterItems) {
            try {
                const filtered = await window.roblox.blacklist.filterItems(items);
                if (filtered.length < items.length) {
                    console.log('[Blacklist] Filtered', items.length - filtered.length, 'catalog items');
                }
                items = filtered;
            } catch (e) {
                console.warn('[Blacklist] Filter failed:', e);
            }
        }

        // Clear any loading indicator/overlay left by loadCatalogItems.
        itemsContainer.querySelectorAll('.catalog-classic-loading, .catalog-loading-overlay').forEach(el => el.remove());

        if (!items || items.length === 0) {
            itemsContainer.innerHTML = '<div class="catalog-no-results" style="text-align:center;padding:40px;color:#666;">No items found</div>';
            return;
        }

        // Bump the render generation so any deferred chunk from a SUPERSEDED render (e.g. the
        // Classic load that fires right before a mode switch) bails instead of appending stale tiles.
        const renderGen = ++catalogRenderGen;

        // Authentic 2013 catalog: floated .CatalogItemOuter tiles (hover-expand), NOT a table.
        // Big "featured hero" row is a LANDING-page device (the real /catalog/ featured landing) —
        // category/All/sort/search browsing was all-Small tiles on the real browse.aspx. Restrict it
        // to page 1 of the Featured/Classic sections so it doesn't leak into plain browsing.
        const isSectionLanding = currentMode === 'Featured' || currentMode === 'Classic';
        const bigCount = (currentPage === 1 && isSectionLanding && !currentKeyword) ? Math.min(4, items.length) : 0;
        const INITIAL = 24; // render the first screenful synchronously, defer the rest

        const firstChunk = Math.min(items.length, INITIAL);
        let html = '';
        for (let i = 0; i < firstChunk; i++) {
            html += renderCatalogItem(items[i], i < bigCount);
        }
        itemsContainer.innerHTML = html;

        // Force the Small grid onto a new line below the Big hero row.
        if (bigCount > 0 && itemsContainer.children[bigCount]) {
            const clr = document.createElement('div');
            clr.style.clear = 'both';
            itemsContainer.insertBefore(clr, itemsContainer.children[bigCount]);
        }

        if (items.length > firstChunk) {
            setTimeout(() => {
                if (renderGen !== catalogRenderGen) return; // superseded — drop stale append
                const tmp = document.createElement('div');
                let more = '';
                for (let i = firstChunk; i < items.length; i++) {
                    more += renderCatalogItem(items[i], false);
                }
                tmp.innerHTML = more;
                const frag = document.createDocumentFragment();
                while (tmp.firstChild) frag.appendChild(tmp.firstChild);
                itemsContainer.appendChild(frag);
                wireCatalogTileClicks(itemsContainer);
            }, 100);
        }

        wireCatalogTileClicks(itemsContainer);
        fetchThumbnails(items);
    }

    function wireCatalogTileClicks(container) {
        container.querySelectorAll('.CatalogItemOuter').forEach(tile => {
            if (tile.dataset.clickWired) return;
            tile.dataset.clickWired = '1';
            tile.addEventListener('click', function(e) {
                // Let the real name/image <a> links navigate on their own.
                if (e.target.closest('a')) return;
                const itemId = this.dataset.itemId;
                const itemType = this.dataset.itemType || 'Asset';
                if (itemId) navigateToItemDetail(itemId, itemType);
            });
        });
    }

    async function fetchThumbnails(items) {
        
        const assetItems = items.filter(item => item.itemType !== 'Bundle');
        const bundleItems = items.filter(item => item.itemType === 'Bundle');

        const assetIds = assetItems.map(item => item.id || item.assetId).filter(Boolean);
        const bundleIds = bundleItems.map(item => item.id || item.bundleId).filter(Boolean);

        const fetchPromises = [];

        if (assetIds.length > 0) {
            const assetPromise = (async () => {
                try {
                    let thumbnailData;
                    if (window.roblox?.getAssetThumbnails) {
                        thumbnailData = await window.roblox.getAssetThumbnails(assetIds, '110x110');
                    } else if (window.robloxAPI?.getAssetThumbnails) {
                        thumbnailData = await window.robloxAPI.getAssetThumbnails(assetIds, '110x110');
                    }

                    if (thumbnailData?.data) {
                        thumbnailData.data.forEach(thumb => {
                            if (thumb.state === 'Completed' && thumb.imageUrl) {
                                const img = document.querySelector(`[data-item-id="${thumb.targetId}"] .roblox-item-image img`);
                                if (img) {
                                    img.src = thumb.imageUrl;
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Failed to fetch asset thumbnails:', error);
                }
            })();
            fetchPromises.push(assetPromise);
        }

        if (bundleIds.length > 0) {
            const bundlePromise = (async () => {
                try {
                    let thumbnailData;
                    if (window.roblox?.getBundleThumbnails) {
                        thumbnailData = await window.roblox.getBundleThumbnails(bundleIds, '150x150');
                    } else if (window.robloxAPI?.getBundleThumbnails) {
                        thumbnailData = await window.robloxAPI.getBundleThumbnails(bundleIds, '150x150');
                    }

                    if (thumbnailData?.data) {
                        thumbnailData.data.forEach(thumb => {
                            if (thumb.state === 'Completed' && thumb.imageUrl) {
                                const img = document.querySelector(`[data-item-id="${thumb.targetId}"] .roblox-item-image img`);
                                if (img) {
                                    img.src = thumb.imageUrl;
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Failed to fetch bundle thumbnails:', error);
                }
            })();
            fetchPromises.push(bundlePromise);
        }

        await Promise.all(fetchPromises);
    }

    const ECONOMY_CACHE_KEY = 'classicEconomyCache_v4';
    const ECONOMY_CACHE_PRELOAD_KEY = 'classicEconomyPreloadTimestamp';
    const ECONOMY_CACHE_TTL = 24 * 60 * 60 * 1000; 
    const ECONOMY_CACHE_MAX_SIZE = 500; 
    const PRELOAD_COOLDOWN = 7 * 24 * 60 * 60 * 1000; 
    let preloadInProgress = false;

    function getEconomyCache() {
        try {
            const cache = JSON.parse(localStorage.getItem(ECONOMY_CACHE_KEY) || '{}');
            const now = Date.now();

            const validCache = {};
            for (const [id, data] of Object.entries(cache)) {
                if (data.timestamp && (now - data.timestamp < ECONOMY_CACHE_TTL)) {
                    validCache[id] = data;
                }
            }

            if (Object.keys(validCache).length !== Object.keys(cache).length) {
                setEconomyCache(validCache);
            }

            return validCache;
        } catch { return {}; }
    }

    function checkLocalStorageQuota() {
        try {
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }
            
            const sizeKB = (totalSize / 1024).toFixed(2);
            
            const quotaWarningThreshold = 4 * 1024 * 1024; 

            if (totalSize > quotaWarningThreshold) {
                console.warn(`[Catalog] localStorage usage high: ${sizeKB} KB. Consider clearing old data.`);
                return false;
            }
            return true;
        } catch (e) {
            return true; 
        }
    }

    function setEconomyCache(cache) {
        try {
            
            checkLocalStorageQuota();

            const entries = Object.entries(cache);

            if (entries.length > ECONOMY_CACHE_MAX_SIZE) {
                
                entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

                const trimmedCache = {};
                entries.slice(-ECONOMY_CACHE_MAX_SIZE).forEach(([id, data]) => {
                    trimmedCache[id] = data;
                });

                localStorage.setItem(ECONOMY_CACHE_KEY, JSON.stringify(trimmedCache));
            } else {
                localStorage.setItem(ECONOMY_CACHE_KEY, JSON.stringify(cache));
            }
        } catch (e) {
            
            console.warn('[Catalog] localStorage quota exceeded, clearing economy cache');
            try {
                localStorage.removeItem(ECONOMY_CACHE_KEY);
                localStorage.setItem(ECONOMY_CACHE_KEY, JSON.stringify(cache));
            } catch {  }
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function preloadAllClassicEconomyData() {
        if (preloadInProgress) return;

        try {
            const lastPreload = localStorage.getItem(ECONOMY_CACHE_PRELOAD_KEY);
            if (lastPreload) {
                const timeSincePreload = Date.now() - parseInt(lastPreload);
                if (timeSincePreload < PRELOAD_COOLDOWN) {
                    const daysRemaining = Math.ceil((PRELOAD_COOLDOWN - timeSincePreload) / (24 * 60 * 60 * 1000));
                    console.log(`[Catalog] Skipping preload - last run ${Math.floor(timeSincePreload / (24 * 60 * 60 * 1000))} days ago, next run in ${daysRemaining} days`);
                    return;
                }
            }
        } catch (e) {
            console.warn('[Catalog] Error checking preload timestamp:', e);
        }

        preloadInProgress = true;

        const allItems = await loadClassicItemsFromJSON();
        if (!allItems || allItems.length === 0) {
            preloadInProgress = false;
            return;
        }

        const cache = getEconomyCache();
        const uncachedItems = allItems.filter(item => !cache[item.id]);

        if (uncachedItems.length === 0 || Object.keys(cache).length >= ECONOMY_CACHE_MAX_SIZE * 0.8) {
            console.log(`[Catalog] Cache sufficiently populated (${Object.keys(cache).length}/${ECONOMY_CACHE_MAX_SIZE}), skipping preload`);
            preloadInProgress = false;
            
            try {
                localStorage.setItem(ECONOMY_CACHE_PRELOAD_KEY, Date.now().toString());
            } catch (e) {}
            return;
        }

        console.log(`[Catalog] Starting batch preload for ${uncachedItems.length} classic items...`);

        const BATCH_SIZE = 20;
        let loaded = 0;

        for (let i = 0; i < uncachedItems.length; i += BATCH_SIZE) {
            
            if (currentMode !== 'Classic') {
                console.log('Preload paused - left Classic mode');
                preloadInProgress = false;
                return;
            }

            const batch = uncachedItems.slice(i, i + BATCH_SIZE);
            const assetIds = batch.map(item => item.id);

            try {
                
                const batchResults = await window.roblox?.getAssetEconomyDetailsBatch(assetIds, BATCH_SIZE);

                if (batchResults) {
                    
                    batchResults.forEach((economyDetails, assetId) => {
                        if (economyDetails) {
                            cache[assetId] = {
                                isLimited: economyDetails.IsLimited || economyDetails.isLimited || false,
                                isLimitedUnique: economyDetails.IsLimitedUnique || economyDetails.isLimitedUnique || false,
                                lowestSellerPrice: economyDetails.LowestSellerPrice ?? economyDetails.lowestSellerPrice ?? null,
                                priceInRobux: economyDetails.PriceInRobux ?? economyDetails.priceInRobux ?? null,
                                isForSale: economyDetails.IsForSale || economyDetails.isForSale || false,
                                timestamp: Date.now() 
                            };

                            loaded++;

                            applyEconomyDataToDOM(assetId, cache[assetId], true);
                        }
                    });

                    setEconomyCache(cache);
                    console.log(`Preloaded ${loaded}/${uncachedItems.length} items (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
                }
            } catch (e) {
                console.warn(`[Catalog] Error loading batch ${Math.floor(i / BATCH_SIZE) + 1}:`, e);
                
            }

            await delay(100);
        }

        setEconomyCache(cache);
        console.log(`[Catalog] Preload complete: ${loaded} items cached`);

        try {
            localStorage.setItem(ECONOMY_CACHE_PRELOAD_KEY, Date.now().toString());
        } catch (e) {
            console.warn('[Catalog] Could not save preload timestamp:', e);
        }

        preloadInProgress = false;
    }

    async function fetchResalePricesForLimitedItems(items, isClassicMode = false) {
        console.log('[Economy] fetchResalePricesForLimitedItems called', { itemCount: items.length, isClassicMode });

        if (!window.roblox?.getAssetEconomyDetails) {
            console.warn('[Economy] window.roblox.getAssetEconomyDetails not available');
            return;
        }

        const cache = getEconomyCache();
        console.log('[Economy] Cache has', Object.keys(cache).length, 'entries');

        const itemsToFetch = isClassicMode
            ? items.filter(item => !cache[item.id]) 
            : items.filter(item => {
                const hasLimitedRestriction = item.itemRestrictions?.includes('Limited') || 
                    item.itemRestrictions?.includes('LimitedUnique') ||
                    item.itemRestrictions?.includes('Collectible');
                const isLimited = item.isLimited || item.isLimitedUnique ||
                    item.collectibleItemType === 'Limited' || item.collectibleItemType === 'LimitedUnique' ||
                    hasLimitedRestriction;
                
                return isLimited && !item.lowestPrice && !cache[item.id];
            });

        console.log('[Economy] Items to fetch:', itemsToFetch.length);

        let cachedApplied = 0;
        for (const item of items) {
            const cached = cache[item.id];
            
            if (cached && !item.lowestPrice) {
                applyEconomyDataToDOM(item.id, cached, isClassicMode);
                cachedApplied++;
            }
        }
        console.log('[Economy] Applied cached data to', cachedApplied, 'items');

        let fetchedCount = 0;
        let errorCount = 0;
        for (const item of itemsToFetch) {
            try {
                const economyDetails = await window.roblox.getAssetEconomyDetails(item.id);
                console.log('[Economy] Fetched item', item.id, ':', economyDetails);

                if (economyDetails) {
                    const data = {
                        isLimited: economyDetails.IsLimited || economyDetails.isLimited || false,
                        isLimitedUnique: economyDetails.IsLimitedUnique || economyDetails.isLimitedUnique || false,
                        lowestSellerPrice: economyDetails.LowestSellerPrice ?? economyDetails.lowestSellerPrice ?? null,
                        priceInRobux: economyDetails.PriceInRobux ?? economyDetails.priceInRobux ?? null,
                        isForSale: economyDetails.IsForSale || economyDetails.isForSale || false,
                        timestamp: Date.now() 
                    };
                    console.log('[Economy] Parsed data:', data);

                    cache[item.id] = data;
                    setEconomyCache(cache);

                    applyEconomyDataToDOM(item.id, data, isClassicMode);
                    fetchedCount++;
                }
            } catch (e) {
                console.warn('[Economy] Error fetching item', item.id, ':', e.message);
                errorCount++;
            }
        }
        console.log('[Economy] Fetched', fetchedCount, 'items, errors:', errorCount);
    }

    function applyEconomyDataToDOM(itemId, data, isClassicMode) {
        const assetEl = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!assetEl) {
            console.log('[Economy DOM] Element not found for item', itemId);
            return;
        }

        const isLimited = data.isLimited || data.isLimitedUnique;

        if (isLimited) {
            const thumbDiv = assetEl.querySelector('.roblox-item-image');
            if (thumbDiv && !thumbDiv.querySelector('.limited-badge')) {
                const badge = document.createElement('div');
                badge.className = 'limited-badge';
                badge.innerHTML = data.isLimitedUnique
                    ? '<img src="images/UI/catalog/legend-limitedu.png" alt="Limited U">'
                    : '<img src="images/UI/catalog/legend-limited.png" alt="Limited">';
                thumbDiv.appendChild(badge);
                console.log('[Economy DOM] Added limited badge to item', itemId);
            }
        }

        const priceEl = assetEl.querySelector('.robux-price .robux');
        const priceContainer = assetEl.querySelector('.robux-price');
        
        if (isLimited) {
            console.log('[Economy DOM] Item', itemId, 'is limited, lowestSellerPrice:', data.lowestSellerPrice);
            
            if (priceEl && priceContainer) {
                if (data.lowestSellerPrice && data.lowestSellerPrice > 0) {
                    priceEl.textContent = `R$: ${data.lowestSellerPrice.toLocaleString()}`;
                    priceContainer.style.display = 'block';
                    console.log('[Economy DOM] Updated price for limited item', itemId);
                }
                
            }
        } else if (isClassicMode && data.isForSale && data.priceInRobux !== null) {
            
            if (priceEl && priceContainer) {
                priceEl.textContent = data.priceInRobux === 0 ? 'Free' : `R$: ${data.priceInRobux.toLocaleString()}`;
                priceContainer.style.display = 'block';
                console.log('[Economy DOM] Updated price for item', itemId, 'to', data.priceInRobux);
            }
        } else if (isClassicMode && !data.isForSale) {
            
            if (priceEl && priceContainer) {
                priceEl.textContent = 'Off Sale';
                priceEl.style.color = '#cc0000';
                priceContainer.style.display = 'block';
            }
        }
    }

    function renderCatalogItem(item, big) {
        const id = item.id || item.assetId;
        const name = item.name || 'Unknown Item';

        const hasLimitedRestriction = item.itemRestrictions?.includes('Limited');
        const hasLimitedUniqueRestriction = item.itemRestrictions?.includes('LimitedUnique');
        const hasCollectibleRestriction = item.itemRestrictions?.includes('Collectible');

        const isLimitedUnique = item.isLimitedUnique || 
            item.collectibleItemType === 'LimitedUnique' || 
            hasLimitedUniqueRestriction ||
            hasCollectibleRestriction; 

        const isLimited = !isLimitedUnique && (
            item.isLimited || 
            item.collectibleItemType === 'Limited' || 
            hasLimitedRestriction
        );

        if (hasLimitedRestriction || hasLimitedUniqueRestriction || hasCollectibleRestriction) {
            console.log('[Catalog] Item', id, name, 'restrictions:', item.itemRestrictions, 
                'isLimitedUnique:', isLimitedUnique, 'isLimited:', isLimited);
        }

        let displayPrice = null;
        let priceText = '';
        
        if (isLimited || isLimitedUnique) {
            
            if (item.lowestPrice && item.lowestPrice > 0) {
                displayPrice = item.lowestPrice;
                priceText = `R$: ${displayPrice.toLocaleString()}`;
            } else if (item.lowestResalePrice && item.lowestResalePrice > 0) {
                displayPrice = item.lowestResalePrice;
                priceText = `R$: ${displayPrice.toLocaleString()}`;
            } else {
                
                priceText = '';
            }
        } else if (currentMode === 'Classic') {
            
            if (item.isForSale === false) {
                priceText = 'Off Sale';
            } else if (item.priceInRobux !== undefined && item.priceInRobux !== null) {
                displayPrice = item.priceInRobux;
                priceText = displayPrice === 0 ? 'Free' : `R$: ${displayPrice.toLocaleString()}`;
            }
            
        } else {
            
            const price = item.price ?? item.lowestPrice ?? null;
            if (price !== null && price !== undefined) {
                displayPrice = price;
                priceText = displayPrice === 0 ? 'Free' : `R$: ${displayPrice.toLocaleString()}`;
            }
        }

        const priceInTickets = item.priceInTickets;
        const creatorName = item.creatorName || item.creator?.name || 'ROBLOX';
        const creatorId = item.creatorTargetId || item.creator?.id || 1;
        const creatorType = item.creatorType || item.creator?.type || 'User';
        const favoriteCount = item.favoriteCount || 0;
        const remaining = item.unitsAvailableForConsumption;
        const itemType = item.itemType || 'Asset';

        const creatorHref = creatorType === 'Group' ? `#group?id=${creatorId}` : `#profile?id=${creatorId}`;

        const placeholderImg = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        let thumbUrl = item.thumbnailUrl || placeholderImg;

        // Limited / BC badge overlaid on the thumbnail (JS also appends this post-load in
        // applyEconomyDataToDOM, targeting .roblox-item-image — keep the class name in sync).
        let limitedBadge = '';
        if (isLimitedUnique) {
            limitedBadge = '<div class="limited-badge"><img src="images/UI/catalog/legend-limitedu.png" alt="Limited U"></div>';
        } else if (isLimited) {
            limitedBadge = '<div class="limited-badge"><img src="images/UI/catalog/legend-limited.png" alt="Limited"></div>';
        }

        // Authentic price = .robux-price > .robux (economy DOM update hook queries .robux-price .robux).
        let priceHtml = '';
        if (priceText) {
            const isOffSale = priceText === 'Off Sale';
            const priceStyle = isOffSale ? ' style="color:#cc0000;"' : '';
            priceHtml = `<div class="robux-price"><span class="robux notranslate"${priceStyle}>${escapeHtml(priceText)}</span></div>`;
        } else if (priceInTickets) {
            priceHtml = `<div class="robux-price"><span class="robux notranslate">Tx: ${priceInTickets.toLocaleString()}</span></div>`;
        } else {
            priceHtml = `<div class="robux-price" style="display:none;"><span class="robux notranslate"></span></div>`;
        }

        // Extra hover-content rows (revealed on tile hover, authentic CatalogHoverContent).
        let remainingHtml = '';
        if (isLimitedUnique && remaining !== undefined) {
            remainingHtml = `<div><span class="CatalogItemInfoLabel" style="color:#cc0000;">Remaining:</span> <span class="HoverInfo">${remaining.toLocaleString()}</span></div>`;
        }

        const detailHref = `#catalog-item?id=${id}&type=${itemType}`;
        const outerClass = big ? 'CatalogItemOuter BigOuter' : 'CatalogItemOuter SmallOuter';
        const viewClass = big ? 'SmallCatalogItemView BigView' : 'SmallCatalogItemView SmallView';
        const innerClass = big ? 'CatalogItemInner BigInner' : 'CatalogItemInner SmallInner';
        const imageClass = big ? 'roblox-item-image image-large' : 'roblox-item-image image-small';
        const imgSize = big ? 150 : 110;

        return `
            <div class="${outerClass}" data-item-id="${id}" data-item-type="${itemType}">
                <div class="${viewClass}">
                    <div class="${innerClass}">
                        <div class="${imageClass}">
                            <a href="${detailHref}" title="${escapeHtml(name)}"><img src="${thumbUrl}" width="${imgSize}" height="${imgSize}" loading="lazy" border="0" alt="${escapeHtml(name)}"/></a>
                            ${limitedBadge}
                        </div>
                        <div class="textDisplay">
                            <div class="CatalogItemName notranslate"><a class="name notranslate" href="${detailHref}" title="${escapeHtml(name)}">${escapeHtml(name)}</a></div>
                            ${priceHtml}
                        </div>
                        <div class="CatalogHoverContent">
                            <div><span class="CatalogItemInfoLabel">Creator:</span> <span class="HoverInfo notranslate"><a href="${creatorHref}">${escapeHtml(creatorName)}</a></span></div>
                            <div><span class="CatalogItemInfoLabel">Favorited:</span> <span class="HoverInfo">${favoriteCount.toLocaleString()} times</span></div>
                            ${remainingHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updatePagination() {
        // Authentic pager (recovered Pages.Catalog): #pagingprevious / #pagingnext anchors that get a
        // .disabled class at the ends, plus a .Paging_Input page-number box (type + Enter to jump).
        // Prev/next keep the .catalog-prev-btn / .catalog-next-btn classes so the delegated handler in
        // initPaginationHandlers still routes clicks.
        const headerPager = document.getElementById('ctl00_cphRoblox_rbxCatalog_HeaderPagerPanel');
        if (headerPager) headerPager.style.display = 'none';

        const prevDisabled = currentPage <= 1;
        const hasMorePages = currentMode === 'Classic'
            ? currentPage < totalPages
            : (currentPage < totalPages || currentCursor);
        const nextDisabled = !hasMorePages;

        // Authentic browse.aspx pager markup: span.pager.previous + span.page.text with the
        // .Paging_Input page box ("Page [n] of N") + span.pager.next. The page-number input only
        // makes sense when the total page count is known (Classic mode); cursor-based modes can't
        // jump to an arbitrary page, so just show the current page.
        let pageInfo;
        if (currentMode === 'Classic' && totalPages > 0) {
            pageInfo = `Page <input class="Paging_Input translate" type="text" value="${currentPage}"/> of <span id="ctl00_cphRoblox_rbxCatalog_FooterPagerLabel">${totalPages.toLocaleString()}</span><span class="paging_pagenums_container"></span>`;
        } else {
            pageInfo = `<span id="ctl00_cphRoblox_rbxCatalog_FooterPagerLabel">Page ${currentPage}</span>`;
        }

        const pagerHtml = `
            <div class="PagingContainerDivTop">
                <span class="pager previous catalog-prev-btn${prevDisabled ? ' disabled' : ''}" id="pagingprevious"></span>
                <span class="page text">${pageInfo}</span>
                <span class="pager next catalog-next-btn${nextDisabled ? ' disabled' : ''}" id="pagingnext"></span>
            </div>`;

        const footerPager = document.getElementById('ctl00_cphRoblox_rbxCatalog_FooterPagerPanel');
        if (footerPager) {
            footerPager.innerHTML = pagerHtml;
            footerPager.style.display = 'block';
            const input = footerPager.querySelector('.Paging_Input');
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' || e.which === 13) {
                        e.preventDefault();
                        if (isLoadingPage) return;
                        let p = Math.round(parseInt(this.value, 10));
                        if (!isNaN(p) && p >= 1) {
                            if (p > totalPages) p = totalPages;
                            currentPage = p;
                            loadCatalogItems();
                        }
                    }
                });
            }
        }

        bindPaginationHandlers();
    }

    function navigateToItemDetail(itemId, itemType = 'Asset') {
        window.location.hash = `#catalog-item?id=${itemId}&type=${itemType}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function resetCatalogPage() {
        
        if (economyWorker) {
            economyWorker.terminate();
            economyWorker = null;
            workerCallbacks.clear();
            console.log('[Catalog] Economy worker terminated');
        }

        classicItemsList = null;

        currentMode = 'Featured';
        currentCategory = 'All';
        currentSubcategory = '';
        currentSalesType = 'All';
        currentTimeFilter = 'AllTime';
        currentPage = 1;
        currentCursor = '';
        currentKeyword = '';
        totalPages = 1;
        cursorHistory = [''];
        isLoadingPage = false;
        catalogLoaded = false;

        browseModeHandlerAttached = false;
        categoryHandlerAttached = false;
        paginationHandlerAttached = false;

        // Clear the rendered tiles (authentic port renders into .Assets .StandardBox, not the
        // legacy AssetsDataList table — clear both in case an old table id is ever present).
        const legacyTable = document.getElementById('ctl00_cphRoblox_rbxCatalog_AssetsDataList');
        if (legacyTable) legacyTable.innerHTML = '';
        const tilesBox = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (tilesBox) tilesBox.innerHTML = '';

        // Back to the splash/landing nav state for the next visit.
        classicTotalItems = 0;
        catalogNavState = 'splash';
    }

    window.CatalogPage = {
        init: initCatalog,
        load: loadCatalogPage,
        setMode: setMode,
        setCategory: setCategory,
        setSalesType: setSalesType,
        setTimeFilter: setTimeFilter,
        search: searchCatalog,
        showItem: navigateToItemDetail,
        reset: resetCatalogPage
    };
})();
