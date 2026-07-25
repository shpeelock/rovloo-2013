// Character Customizer — faithful 2013/2014 /My/Character.aspx port.
// DOM contract from reference/archive-character-2014-raw.html (ASP.NET rip): .Asset tiles with
// btn-small btn-neutral Wear/Remove overlays, .AttireCategorySelector category strip, mannequin
// .ColorChooserRegion selectors opening the ColorPicker modal, FooterPager First/Previous/Next/Last.
// Data layer is Rovloo's (window.roblox avatar APIs), unchanged from the previous version.

(function() {
    'use strict';

    if (window._characterPageLoaded) {
        console.log('[Character] Script already loaded, skipping duplicate');
        return;
    }
    window._characterPageLoaded = true;

    let currentUserId = null;
    let currentCategory = 8;
    let wardrobePage = 1;
    let wardrobeTotalPages = 1;
    let wardrobeItems = [];
    let outfitItems = [];

    let wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(75, 10 * 60 * 1000) : {};
    let isLoading = false;
    let currentAvatarType = 'R15';

    const ITEMS_PER_PAGE = 8;

    const categoryNames = {
        8: 'Hats',
        41: 'Hair',
        18: 'Faces',
        2: 'T-Shirts',
        11: 'Shirts',
        12: 'Pants',
        46: 'Back',
        45: 'Front',
        43: 'Neck',
        44: 'Shoulder',
        47: 'Waist',
        42: 'Face Acc',
        19: 'Gear',
        17: 'Heads',
        27: 'Torsos',
        29: 'Left Arms',
        28: 'Right Arms',
        31: 'Left Legs',
        30: 'Right Legs',
        'costumes': 'Packages'
    };

    const outfitCategories = {
        'costumes': [
            { itemType: 'Outfit', itemSubType: 1 },
            { itemType: 'Outfit', itemSubType: 5 }
        ]
    };

    let bodyColorsPalette = [];
    let selectedBodyPart = null;

    let currentBodyColors = {
        headColor3: 'F5CD30',
        torsoColor3: 'F5CD30',
        rightArmColor3: 'F5CD30',
        leftArmColor3: 'F5CD30',
        rightLegColor3: 'F5CD30',
        leftLegColor3: 'F5CD30'
    };
    let currentWearingAssets = [];

    async function initCharacterPage() {
        if (window._characterPageInitializing) {
            console.log('[Character] initCharacterPage skipped - already initializing');
            return;
        }
        window._characterPageInitializing = true;

        try {
            const user = await window.RobloxClient.api.getCurrentUser();
            if (!user || !user.id) {
                showError('You must be logged in to view this page.');
                return;
            }
            currentUserId = user.id;

            currentCategory = 8;
            wardrobePage = 1;
            wardrobeItems = [];
            wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(75, 10 * 60 * 1000) : {};
            assetDetailsCache = {};

            document.querySelectorAll('.AttireCategory a[data-category]').forEach(a => {
                setCategorySelected(a, a.dataset.category === '8');
            });

            setupEventListeners();
            await loadAvatarRules();

            await Promise.all([
                loadCurrentAvatar(),
                loadWardrobeItems()
            ]);

        } catch (e) {
            console.error('[Character] Failed to initialize character page:', e);
            showError('Failed to load character page.');
        } finally {
            window._characterPageInitializing = false;
        }
    }

    function setCategorySelected(anchor, selected) {
        // Authentic markup swaps the class between AttireCategorySelector and _Selected
        anchor.className = selected ? 'AttireCategorySelector_Selected' : 'AttireCategorySelector';
    }

    async function loadAvatarRules() {
        try {
            const rules = await window.roblox.getAvatarRules();
            if (rules?.bodyColorsPalette) {
                bodyColorsPalette = rules.bodyColorsPalette;
                initBodyColors();
            }
        } catch (e) {
            console.warn('Failed to load avatar rules:', e);
        }
    }

    function brickColorToHex(brickColorId) {
        const color = bodyColorsPalette.find(c => c.brickColorId === brickColorId);
        if (color && color.hexColor) {
            return color.hexColor.replace('#', '');
        }
        return 'F5CD30';
    }

    function showError(message) {
        if (window.showErrorPage) {
            window.showErrorPage(message, 'character-content');
        } else {
            const container = document.getElementById('character-content');
            if (container) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: #cc0000;">${message}</div>`;
            }
        }
    }

    // ---------- avatar + currently wearing ----------

    async function loadCurrentAvatar() {
        const characterContainer = document.getElementById('character-content');
        const wearingContainer = characterContainer?.querySelector('#CurrentlyWearing') || document.getElementById('CurrentlyWearing');
        let avatarImg = characterContainer?.querySelector('#AvatarImage') || document.getElementById('AvatarImage');

        if (wearingContainer) {
            wearingContainer.innerHTML = '<span class="singleMessage">Loading outfit...</span>';
        }

        try {
            const avatar = await window.roblox.getCurrentAvatar();

            if (avatar?.playerAvatarType) {
                currentAvatarType = avatar.playerAvatarType;
                updateAvatarTypeButtons();
            }

            if (avatar?.bodyColor3s) {
                currentBodyColors = {
                    headColor3: avatar.bodyColor3s.headColor3 || 'F5CD30',
                    torsoColor3: avatar.bodyColor3s.torsoColor3 || 'F5CD30',
                    rightArmColor3: avatar.bodyColor3s.rightArmColor3 || 'F5CD30',
                    leftArmColor3: avatar.bodyColor3s.leftArmColor3 || 'F5CD30',
                    rightLegColor3: avatar.bodyColor3s.rightLegColor3 || 'F5CD30',
                    leftLegColor3: avatar.bodyColor3s.leftLegColor3 || 'F5CD30'
                };
                updateBodyPartColors();
            } else if (avatar?.bodyColors) {
                const bc = avatar.bodyColors;
                currentBodyColors = {
                    headColor3: brickColorToHex(bc.headColorId),
                    torsoColor3: brickColorToHex(bc.torsoColorId),
                    rightArmColor3: brickColorToHex(bc.rightArmColorId),
                    leftArmColor3: brickColorToHex(bc.leftArmColorId),
                    rightLegColor3: brickColorToHex(bc.rightLegColorId),
                    leftLegColor3: brickColorToHex(bc.leftLegColorId)
                };
                updateBodyPartColors();
            }

            if (!avatarImg) {
                avatarImg = characterContainer?.querySelector('#AvatarImage') || document.getElementById('AvatarImage');
            }
            if (avatarImg && currentUserId) {
                loadAvatarThumbnailWithRetry(avatarImg, currentUserId).catch(err => {
                    console.warn('[Character] Avatar thumbnail load failed:', err);
                });
            }

            currentWearingAssets = avatar?.assets || [];

            if (!wearingContainer) return;

            if (currentWearingAssets.length === 0) {
                wearingContainer.innerHTML = '<div class="NoResults">No items currently worn.</div>';
                return;
            }

            // Authentic Accoutrements tile: AssetThumbnail (110px anchor + Remove btn-small overlay)
            // + AssetDetails (bold name + "Type:" label/detail line). Spinner placeholders,
            // hydrated below with pending-state retries.
            wearingContainer.innerHTML = `
                <div class="TileGroup">
                    ${currentWearingAssets.map(asset => {
                        const thumb = cachedThumb(asset.id);
                        const name = escapeHtml(asset.name || `Asset ${asset.id}`);
                        const typeName = escapeHtml(asset.assetType?.name || '');
                        return `
                        <div class="Asset">
                            <div class="AssetThumbnail">
                                <a title="click to remove" class="wearing-thumb" data-asset-id="${asset.id}" style="width: 110px; height: 110px; display: inline-block; cursor: pointer;"><img width="110" height="110" src="${thumb || 'images/spinners/spinner100x100.gif'}" data-thumb-id="${asset.id}" alt="click to remove" border="0"></a>
                                <div style="top: 0px; text-align: center; right: -7px; position: absolute;">
                                    <a title="click to remove" class="btn-small btn-neutral RemoveBtn" data-asset-id="${asset.id}" href="#">Remove<span class="btn-text">Remove</span></a>
                                </div>
                            </div>
                            <div class="AssetDetails">
                                <div class="AssetName">
                                    <a title="click to view" class="notranslate item-link" data-asset-id="${asset.id}" href="#">${name}</a>
                                </div>
                                ${typeName ? `<div class="AssetType"><span class="Label">Type:</span> <span class="Detail">${typeName}</span></div>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;

            const missingWearing = currentWearingAssets.map(a => a.id).filter(id => !cachedThumb(id));
            if (missingWearing.length) {
                hydrateThumbnails(wearingContainer, missingWearing, false);
            }

        } catch (e) {
            console.error('Failed to load current avatar:', e);
            if (wearingContainer) {
                wearingContainer.innerHTML = '<div class="NoResults">Failed to load outfit.</div>';
            }
        }
    }

    function updateBodyPartColors() {
        const colorMap = {
            'Head': currentBodyColors.headColor3,
            'Torso': currentBodyColors.torsoColor3,
            'RightArm': currentBodyColors.rightArmColor3,
            'LeftArm': currentBodyColors.leftArmColor3,
            'RightLeg': currentBodyColors.rightLegColor3,
            'LeftLeg': currentBodyColors.leftLegColor3
        };

        for (const [part, hexColor] of Object.entries(colorMap)) {
            const partEl = document.getElementById(`BP_${part}`);
            if (partEl && hexColor) {
                partEl.style.backgroundColor = `#${hexColor}`;
            }
        }
    }

    // ---------- wardrobe ----------

    async function loadWardrobeItems(resetPage = true) {
        const container = document.getElementById('WardrobeItems');
        if (!container || !currentUserId || isLoading) return;

        isLoading = true;
        if (resetPage) {
            wardrobePage = 1;
            wardrobeItems = [];
            wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(75, 10 * 60 * 1000) : {};
            assetDetailsCache = {};
        }

        container.innerHTML = '<span class="singleMessage">Loading items...</span>';

        try {
            let allItems = [];
            let pageToken = '';

            if (outfitCategories[currentCategory]) {
                do {
                    const result = await window.roblox.getAvatarInventory({
                        sortOption: '1',
                        pageLimit: 50,
                        itemCategories: outfitCategories[currentCategory],
                        pageToken: pageToken || undefined
                    });
                    if (result?.avatarInventoryItems) {
                        allItems = allItems.concat(result.avatarInventoryItems);
                    }
                    pageToken = result?.nextPageToken || '';
                } while (pageToken && allItems.length < 500);
            } else {
                do {
                    const result = await window.roblox.getAvatarInventory({
                        sortOption: '1',
                        pageLimit: 50,
                        itemSubType: currentCategory,
                        itemType: 'Asset',
                        pageToken: pageToken || undefined
                    });
                    if (result?.avatarInventoryItems) {
                        allItems = allItems.concat(result.avatarInventoryItems);
                    }
                    pageToken = result?.nextPageToken || '';
                } while (pageToken && allItems.length < 500);
            }

            wardrobeItems = allItems;
            wardrobeTotalPages = Math.max(1, Math.ceil(wardrobeItems.length / ITEMS_PER_PAGE));

            if (wardrobeItems.length === 0) {
                container.innerHTML = `<div class="NoResults">No ${categoryNames[currentCategory] || 'items'} in your inventory.</div>`;
                updateWardrobePagination();
                isLoading = false;
                return;
            }

            // Render immediately with spinner placeholders; thumbnails hydrate (with
            // pending-state retries) once the tiles are on screen.
            renderWardrobePage();

        } catch (e) {
            console.error('Failed to load wardrobe:', e);
            container.innerHTML = '<div class="NoResults">Failed to load items.</div>';
        }

        isLoading = false;
    }

    function cacheThumb(id, url) {
        if (wardrobeThumbnails.set) wardrobeThumbnails.set(id, url);
        else wardrobeThumbnails[id] = url;
    }
    function cachedThumb(id) {
        return (wardrobeThumbnails.get ? wardrobeThumbnails.get(id) : wardrobeThumbnails[id]) || '';
    }

    // The thumbnails API returns state:"Pending" with a null imageUrl for images not yet
    // generated — a one-shot fetch leaves those tiles permanently blank. Fetch, hydrate any
    // matching img[data-thumb-id] in the container, and retry pending ids with backoff
    // (same approach as the avatar's loadAvatarThumbnailWithRetry). A newer call on the same
    // container cancels the older retry loop (per-container generation stamp).
    async function hydrateThumbnails(containerEl, ids, isOutfits, maxRetries = 5) {
        if (!containerEl || !ids.length) return;
        const generation = (containerEl._hydrateGen || 0) + 1;
        containerEl._hydrateGen = generation;
        let remaining = [...new Set(ids)];
        let delay = 1000;

        for (let attempt = 0; attempt <= maxRetries && remaining.length; attempt++) {
            if (attempt > 0) {
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 1.5, 3000);
                if (generation !== containerEl._hydrateGen) return;
            }

            const stillPending = [];
            for (let i = 0; i < remaining.length; i += 50) {
                const batch = remaining.slice(i, i + 50);
                try {
                    const thumbResult = isOutfits
                        ? await window.roblox.getOutfitThumbnails(batch, '150x150')
                        : await window.roblox.getAssetThumbnails(batch, '110x110');
                    if (generation !== containerEl._hydrateGen) return;

                    const seen = new Set();
                    (thumbResult?.data || []).forEach(t => {
                        seen.add(t.targetId);
                        if (t.imageUrl) {
                            cacheThumb(t.targetId, t.imageUrl);
                            containerEl.querySelectorAll(`img[data-thumb-id="${t.targetId}"]`).forEach(img => {
                                img.src = t.imageUrl;
                            });
                        } else if (t.state === 'Pending' || !t.state) {
                            stillPending.push(t.targetId);
                        }
                        // Blocked/Error states: leave the spinner-less placeholder, no retry
                    });
                    // ids the API didn't answer for at all — retry those too
                    batch.forEach(id => { if (!seen.has(id) && !cachedThumb(id)) stillPending.push(id); });
                } catch (e) {
                    console.warn('Failed to load thumbnail batch:', e);
                    stillPending.push(...batch);
                }
            }
            remaining = stillPending;
        }
        if (remaining.length) {
            console.warn('[Character] Thumbnails still pending after retries:', remaining);
        }
    }

    let assetDetailsCache = {};

    async function loadItemRestrictions(assetIds) {
        // Limited/LimitedU overlays inside thumbnails (same treatment as the item pages)
        const missingIds = assetIds.filter(id => !assetDetailsCache[id]);
        if (missingIds.length === 0) return;

        try {
            const items = missingIds.map(id => ({ itemType: 'Asset', id: parseInt(id) }));
            const result = await window.roblox.getCatalogItemDetails(items);

            if (result?.data) {
                result.data.forEach(item => {
                    assetDetailsCache[item.id] = item;

                    const thumbCell = document.querySelector(`#WardrobeItems .AssetThumbnail a[data-asset-id="${item.id}"]`);
                    if (thumbCell) {
                        const restrictions = item.itemRestrictions || [];
                        const isLimited = restrictions.includes('Limited');
                        const isLimitedUnique = restrictions.includes('LimitedUnique');

                        if (isLimitedUnique || isLimited) {
                            const overlay = document.createElement('img');
                            overlay.className = 'limited-overlay';
                            overlay.src = isLimitedUnique ? 'images/assetIcons/limitedunique.png' : 'images/assetIcons/limited.png';
                            overlay.alt = isLimitedUnique ? 'Limited U' : 'Limited';
                            thumbCell.parentElement.appendChild(overlay);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to load item details:', e);
        }
    }

    function renderWardrobePage() {
        const container = document.getElementById('WardrobeItems');
        if (!container) return;

        const startIndex = (wardrobePage - 1) * ITEMS_PER_PAGE;
        const pageItems = wardrobeItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        if (pageItems.length === 0) {
            container.innerHTML = '<div class="NoResults">No items on this page.</div>';
            updateWardrobePagination();
            return;
        }

        const isOutfits = !!outfitCategories[currentCategory];
        const assetIdsOnPage = [];
        const idsToHydrate = [];

        // Authentic wardrobe tile: 110px thumbnail anchor + Wear btn-small overlay at right:-7px,
        // AssetDetails carries only the bold name link (no creator line on the 2013 page)
        container.innerHTML = `
            <div class="TileGroup">
                ${pageItems.map(item => {
                    const assetId = item.itemId;
                    const name = escapeHtml(item.itemName || `Asset ${assetId}`);
                    const thumb = cachedThumb(assetId);
                    const isWorn = currentWearingAssets.some(a => a.id == assetId);
                    const btnLabel = isWorn ? 'Remove' : 'Wear';
                    const btnClass = isWorn ? 'RemoveBtn' : 'WearBtn';
                    const btnTitle = isWorn ? 'click to remove' : 'click to wear';
                    if (!isOutfits) assetIdsOnPage.push(assetId);
                    if (!thumb) idsToHydrate.push(assetId);
                    return `
                    <div class="Asset">
                        <div class="AssetThumbnail">
                            <a class="item-link" data-asset-id="${assetId}" data-outfit="${isOutfits ? '1' : ''}" style="width: 110px; height: 110px; display: inline-block; cursor: pointer;"><img width="110" height="110" src="${thumb || 'images/spinners/spinner100x100.gif'}" data-thumb-id="${assetId}" border="0"></a>
                            <div style="top: 0px; text-align: center; right: -7px; position: absolute;">
                                <a title="${btnTitle}" class="btn-small btn-neutral ${btnClass}" data-asset-id="${assetId}" href="#">${btnLabel}<span class="btn-text">${btnLabel}</span></a>
                            </div>
                        </div>
                        <div class="AssetDetails">
                            <div class="AssetName">
                                <a title="click to view" class="notranslate item-link" data-asset-id="${assetId}" data-outfit="${isOutfits ? '1' : ''}" href="#">${name}</a>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        updateWardrobePagination();

        if (idsToHydrate.length) {
            hydrateThumbnails(container, idsToHydrate, isOutfits);
        }
        if (assetIdsOnPage.length) {
            loadItemRestrictions(assetIdsOnPage);
        }
    }

    function updateWardrobePagination() {
        const pager = document.getElementById('WardrobePagination');
        if (!pager) return;

        const hasPrev = wardrobePage > 1;
        const hasNext = wardrobePage < wardrobeTotalPages;

        // Authentic DataPager anatomy (from the rip's AttireDataPager_Footer): one flat span;
        // disabled ends are <a disabled="disabled">, the current page is the only nested <span>
        // (which is what .FooterPager span span's #d8d8d8 highlight targets)
        let pages = '';
        let startPage = Math.max(1, wardrobePage - 2);
        let endPage = Math.min(wardrobeTotalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        for (let i = startPage; i <= endPage; i++) {
            pages += i === wardrobePage
                ? `<span>${i}</span>&nbsp;`
                : `<a href="#" class="PageNum" data-page="${i}">${i}</a>&nbsp;`;
        }

        pager.innerHTML =
            `<a href="#" id="WardrobeFirst"${hasPrev ? '' : ' disabled="disabled"'}>First</a>&nbsp;` +
            `<a href="#" id="WardrobePrev"${hasPrev ? '' : ' disabled="disabled"'}>Previous</a>&nbsp;` +
            pages +
            `<a href="#" id="WardrobeNext"${hasNext ? '' : ' disabled="disabled"'}>Next</a>&nbsp;` +
            `<a href="#" id="WardrobeLast"${hasNext ? '' : ' disabled="disabled"'}>Last</a>&nbsp;`;
    }

    // ---------- outfits tab ----------

    async function loadOutfits() {
        const container = document.getElementById('OutfitsContainer');
        if (!container || !currentUserId) return;

        container.innerHTML = '<span class="singleMessage">Loading outfits...</span>';

        try {
            let allItems = [];
            let pageToken = '';
            do {
                const result = await window.roblox.getAvatarInventory({
                    sortOption: '1',
                    pageLimit: 50,
                    itemCategories: outfitCategories['costumes'],
                    pageToken: pageToken || undefined
                });
                if (result?.avatarInventoryItems) {
                    allItems = allItems.concat(result.avatarInventoryItems);
                }
                pageToken = result?.nextPageToken || '';
            } while (pageToken && allItems.length < 500);

            outfitItems = allItems;

            if (outfitItems.length === 0) {
                container.innerHTML = '<div class="NoResults">You have no outfits.</div>';
                return;
            }

            // Authentic outfit tile (Outfits.css): 100x170 container, 100px avatar, bold ellipsized
            // name. Spinner placeholders, hydrated with pending-state retries.
            container.innerHTML = outfitItems.map(o => `
                <div class="outfit-container" data-outfit-id="${o.itemId}">
                    <img class="outfit-avatar" src="${cachedThumb(o.itemId) || 'images/spinners/spinner100x100.gif'}" data-thumb-id="${o.itemId}" alt="${escapeHtml(o.itemName || '')}" title="click to wear"/>
                    <div class="outfit-name notranslate" title="${escapeHtml(o.itemName || '')}">${escapeHtml(o.itemName || `Outfit ${o.itemId}`)}</div>
                </div>
            `).join('');

            const missingOutfits = outfitItems.map(o => o.itemId).filter(id => !cachedThumb(id));
            if (missingOutfits.length) {
                hydrateThumbnails(container, missingOutfits, true);
            }

        } catch (e) {
            console.error('Failed to load outfits:', e);
            container.innerHTML = '<div class="NoResults">Failed to load outfits.</div>';
        }
    }

    async function wearOutfit(outfitId) {
        const outfit = outfitItems.find(o => o.itemId == outfitId) ||
                       wardrobeItems.find(o => o.itemId == outfitId);
        if (!outfit?.outfitDetail) {
            console.warn('Outfit detail missing for', outfitId);
            return;
        }
        const outfitAssets = outfit.outfitDetail.assets || [];
        if (outfitAssets.length === 0) return;

        const updatedAssets = [...currentWearingAssets];
        outfitAssets.forEach(a => {
            if (!updatedAssets.some(w => w.id === a.id)) {
                updatedAssets.push({ id: a.id, name: `Outfit Asset ${a.id}`, assetType: { id: 0, name: 'Unknown' } });
            }
        });

        try {
            const result = await window.roblox.setWearingAssets(updatedAssets);
            if (result?.success) {
                await loadCurrentAvatar();
                renderWardrobePage();
                setTimeout(refreshAvatarThumbnail, 1500);
            } else {
                showOutfitsError('Failed to wear outfit. Please try again.');
            }
        } catch (e) {
            console.error('Failed to wear outfit:', e);
            showOutfitsError('Failed to wear outfit. Please try again.');
        }
    }

    function showOutfitsError(msg) {
        const el = document.getElementById('outfits-error');
        if (el) {
            el.textContent = msg;
            el.classList.add('visible');
            setTimeout(() => el.classList.remove('visible'), 4000);
        }
    }

    // ---------- color picker ----------

    function initBodyColors() {
        const grid = document.getElementById('ColorGrid');
        if (!grid) return;

        // Authentic ColorPickerItem: 40x40 inline-block with the brick color as background
        grid.innerHTML = '';
        bodyColorsPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'ColorPickerItem';
            swatch.style.cssText = 'width: 40px; height: 40px; display: inline-block;';
            swatch.style.backgroundColor = color.hexColor;
            swatch.title = color.name;
            swatch.dataset.hexColor = color.hexColor.replace('#', '');
            swatch.dataset.colorId = color.brickColorId;
            grid.appendChild(swatch);
        });

        const pickerContainer = document.getElementById('ColorPickerContainer');
        if (pickerContainer && !document.getElementById('ColorPickerInput')) {
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = 'ColorPickerInput';
            picker.value = '#F5CD30';
            picker.title = 'Pick any color';
            picker.style.cssText = 'width: 30px; height: 30px; border: 1px solid #999; cursor: pointer; padding: 0; margin-left: 5px; vertical-align: middle;';
            pickerContainer.appendChild(picker);
        }
    }

    function openColorPicker(part) {
        selectedBodyPart = part;
        const modal = document.getElementById('ColorPickerModal');
        const overlay = document.getElementById('ColorPickerOverlay');
        if (modal) modal.style.display = 'block';
        if (overlay) overlay.style.display = 'block';

        const colorPicker = document.getElementById('ColorPickerInput');
        if (colorPicker) {
            const fieldName = partToField(part);
            if (fieldName && currentBodyColors[fieldName]) {
                colorPicker.value = '#' + currentBodyColors[fieldName];
            }
        }
    }

    function closeColorPicker() {
        const modal = document.getElementById('ColorPickerModal');
        const overlay = document.getElementById('ColorPickerOverlay');
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }

    function partToField(part) {
        return {
            'head': 'headColor3',
            'torso': 'torsoColor3',
            'rightArm': 'rightArmColor3',
            'leftArm': 'leftArmColor3',
            'rightLeg': 'rightLegColor3',
            'leftLeg': 'leftLegColor3'
        }[part];
    }

    // ---------- event wiring ----------

    function setupEventListeners() {
        const wardrobeContainer = document.getElementById('WardrobeItems');
        if (wardrobeContainer && wardrobeContainer._listenersAttached) {
            return;
        }
        if (wardrobeContainer) {
            wardrobeContainer._listenersAttached = true;
        }

        // attire category strip
        document.querySelectorAll('#page-character .AttireCategory a[data-category]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const categoryStr = anchor.dataset.category;
                const category = isNaN(categoryStr) ? categoryStr : parseInt(categoryStr);
                if (category && category !== currentCategory) {
                    currentCategory = category;
                    document.querySelectorAll('#page-character .AttireCategory a[data-category]').forEach(a => {
                        setCategorySelected(a, a === anchor);
                    });
                    loadWardrobeItems(true);
                }
            });
        });

        document.getElementById('CatalogHyperLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('catalog');
        });

        // Wardrobe/Outfits top tabs — authentic mechanism: tab-active class on both tab and pane
        document.querySelectorAll('#page-character .tab-container > div').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#page-character .tab-container > div').forEach(t => t.classList.remove('tab-active'));
                tab.classList.add('tab-active');
                const paneHolder = document.querySelector('#page-character .tab-container + div');
                paneHolder?.querySelectorAll(':scope > div').forEach(p => p.classList.remove('tab-active'));
                document.getElementById(tab.dataset.id)?.classList.add('tab-active');
                if (tab.dataset.id === 'tab-outfits' && outfitItems.length === 0) {
                    loadOutfits();
                }
            });
        });

        // wardrobe tile actions (delegated)
        wardrobeContainer?.addEventListener('click', async (e) => {
            const wearBtn = e.target.closest('.WearBtn');
            if (wearBtn) {
                e.preventDefault();
                await wearItem(wearBtn.dataset.assetId);
                return;
            }
            const removeBtn = e.target.closest('.RemoveBtn');
            if (removeBtn) {
                e.preventDefault();
                await removeItem(removeBtn.dataset.assetId);
                return;
            }
            const itemLink = e.target.closest('.item-link');
            if (itemLink) {
                e.preventDefault();
                if (itemLink.dataset.outfit) {
                    await wearOutfit(itemLink.dataset.assetId);
                } else {
                    navigateTo('catalog-item', { id: itemLink.dataset.assetId });
                }
            }
        });

        // currently wearing actions (delegated)
        document.getElementById('CurrentlyWearing')?.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.RemoveBtn');
            if (removeBtn) {
                e.preventDefault();
                await removeItem(removeBtn.dataset.assetId);
                return;
            }
            const thumb = e.target.closest('.wearing-thumb');
            if (thumb) {
                e.preventDefault();
                await removeItem(thumb.dataset.assetId);
                return;
            }
            const itemLink = e.target.closest('.item-link');
            if (itemLink) {
                e.preventDefault();
                navigateTo('catalog-item', { id: itemLink.dataset.assetId });
            }
        });

        // outfits tab (delegated)
        document.getElementById('OutfitsContainer')?.addEventListener('click', async (e) => {
            const tile = e.target.closest('.outfit-container');
            if (tile) {
                await wearOutfit(tile.dataset.outfitId);
            }
        });

        // mannequin regions open the color picker
        document.querySelectorAll('#page-character .ColorChooserRegion').forEach(region => {
            region.addEventListener('click', () => {
                openColorPicker(region.dataset.part);
            });
        });

        document.getElementById('ColorPickerClose')?.addEventListener('click', closeColorPicker);
        document.getElementById('ColorPickerOverlay')?.addEventListener('click', closeColorPicker);

        document.getElementById('ColorGrid')?.addEventListener('click', async (e) => {
            const swatch = e.target.closest('.ColorPickerItem');
            if (swatch && selectedBodyPart) {
                await setBodyColor(selectedBodyPart, swatch.dataset.hexColor);
                // The authentic postback re-rendered and dismissed the popup on selection
                closeColorPicker();
            }
        });

        document.getElementById('ColorPickerInput')?.addEventListener('input', async (e) => {
            if (selectedBodyPart) {
                await setBodyColor(selectedBodyPart, e.target.value);
            }
        });

        document.getElementById('RedrawAvatarLink')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await redrawAvatar();
        });

        document.getElementById('R6Button')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await setAvatarType('R6');
        });

        document.getElementById('R15Button')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await setAvatarType('R15');
        });

        // footer pager
        document.getElementById('WardrobePagination')?.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.closest('a');
            if (!target || target.hasAttribute('disabled')) return;

            if (target.id === 'WardrobeNext' && wardrobePage < wardrobeTotalPages) {
                wardrobePage++;
                renderWardrobePage();
            } else if (target.id === 'WardrobePrev' && wardrobePage > 1) {
                wardrobePage--;
                renderWardrobePage();
            } else if (target.id === 'WardrobeFirst') {
                wardrobePage = 1;
                renderWardrobePage();
            } else if (target.id === 'WardrobeLast') {
                wardrobePage = wardrobeTotalPages;
                renderWardrobePage();
            } else if (target.classList.contains('PageNum')) {
                const page = parseInt(target.dataset.page);
                if (page && page !== wardrobePage && page >= 1 && page <= wardrobeTotalPages) {
                    wardrobePage = page;
                    renderWardrobePage();
                }
            }
        });
    }

    // ---------- actions (unchanged data layer) ----------

    async function wearItem(assetId) {
        try {
            const wardrobeItem = wardrobeItems.find(item => item.itemId == assetId);
            if (!wardrobeItem) {
                console.error('Item not found in wardrobe:', assetId);
                alert('Item not found in your inventory.');
                return;
            }

            let updatedAssets;

            if (outfitCategories[currentCategory] && wardrobeItem.outfitDetail) {
                const outfitAssets = wardrobeItem.outfitDetail.assets || [];
                if (outfitAssets.length === 0) return;

                const newAssets = outfitAssets.map(a => ({
                    id: a.id,
                    name: `Outfit Asset ${a.id}`,
                    assetType: { id: 0, name: 'Unknown' }
                }));

                updatedAssets = [...currentWearingAssets];
                newAssets.forEach(newAsset => {
                    if (!updatedAssets.some(a => a.id === newAsset.id)) {
                        updatedAssets.push(newAsset);
                    }
                });
            } else {
                if (currentWearingAssets.some(a => a.id == assetId)) {
                    return;
                }
                const newAsset = {
                    id: parseInt(assetId),
                    name: wardrobeItem.itemName || `Asset ${assetId}`,
                    assetType: wardrobeItem.assetType || { id: currentCategory, name: categoryNames[currentCategory] || 'Unknown' }
                };
                updatedAssets = [...currentWearingAssets, newAsset];
            }

            const result = await window.roblox.setWearingAssets(updatedAssets);
            if (result?.success) {
                await loadCurrentAvatar();
                renderWardrobePage();
                setTimeout(refreshAvatarThumbnail, 1500);
            } else {
                console.error('Failed to wear item:', result);
                alert('Failed to wear item. Please try again.');
            }
        } catch (e) {
            console.error('Failed to wear item:', e);
            const errorMsg = e.message || e.toString();
            if (errorMsg.includes('LimitExceeded')) {
                alert('Cannot wear this item: You have reached the limit for this item type. Try removing a similar item first.');
            } else if (errorMsg.includes('ValidationErrors')) {
                alert('Cannot wear this item: Roblox rejected the request.');
            } else {
                alert('Failed to wear item. Please try again.');
            }
        }
    }

    async function removeItem(assetId) {
        try {
            const updatedAssets = currentWearingAssets.filter(a => a.id != assetId);
            const result = await window.roblox.setWearingAssets(updatedAssets);
            if (result?.success) {
                await loadCurrentAvatar();
                renderWardrobePage();
                setTimeout(refreshAvatarThumbnail, 1500);
            } else {
                console.error('Failed to remove item:', result);
                alert('Failed to remove item. Please try again.');
            }
        } catch (e) {
            console.error('Failed to remove item:', e);
            alert('Failed to remove item. Please try again.');
        }
    }

    let bodyColorTimeout = null;
    let pendingBodyColorUpdate = false;

    async function setBodyColor(bodyPart, hexColor) {
        try {
            const fieldName = partToField(bodyPart);
            if (!fieldName) return;

            const cleanHex = hexColor.replace('#', '');
            currentBodyColors[fieldName] = cleanHex;

            const partEl = document.getElementById(`BP_${bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)}`);
            if (partEl) {
                partEl.style.backgroundColor = `#${cleanHex}`;
            }

            const colorPicker = document.getElementById('ColorPickerInput');
            if (colorPicker && selectedBodyPart === bodyPart) {
                colorPicker.value = `#${cleanHex}`;
            }

            if (bodyColorTimeout) {
                clearTimeout(bodyColorTimeout);
            }

            bodyColorTimeout = setTimeout(async () => {
                if (pendingBodyColorUpdate) return;
                pendingBodyColorUpdate = true;
                try {
                    await window.roblox.setBodyColors(currentBodyColors);
                    setTimeout(redrawAvatar, 500);
                } catch (e) {
                    console.warn('Failed to set body colors:', e);
                } finally {
                    pendingBodyColorUpdate = false;
                }
            }, 300);
        } catch (e) {
            console.warn('Failed to set body color:', e);
        }
    }

    let lastRedrawTime = 0;
    const REDRAW_COOLDOWN = 10000;

    async function redrawAvatar() {
        const now = Date.now();
        const timeSinceLastRedraw = now - lastRedrawTime;

        if (timeSinceLastRedraw < REDRAW_COOLDOWN) {
            await refreshAvatarThumbnail();
            return;
        }

        const img = document.getElementById('AvatarImage');
        if (img) {
            img.style.opacity = '0.5';
        }
        try {
            lastRedrawTime = now;
            await window.roblox.redrawAvatar();
            setTimeout(async () => {
                await refreshAvatarThumbnail();
                if (img) img.style.opacity = '1';
            }, 2000);
        } catch (e) {
            console.warn('Failed to redraw avatar:', e);
            if (img) img.style.opacity = '1';
            await refreshAvatarThumbnail();
        }
    }

    function updateAvatarTypeButtons() {
        const r6Button = document.getElementById('R6Button');
        const r15Button = document.getElementById('R15Button');
        if (r6Button && r15Button) {
            r6Button.classList.toggle('active', currentAvatarType === 'R6');
            r15Button.classList.toggle('active', currentAvatarType === 'R15');
        }
    }

    async function setAvatarType(avatarType) {
        try {
            const r6Button = document.getElementById('R6Button');
            const r15Button = document.getElementById('R15Button');
            if (r6Button) r6Button.disabled = true;
            if (r15Button) r15Button.disabled = true;

            const result = await window.roblox.setAvatarType(avatarType);

            if (result?.success) {
                currentAvatarType = avatarType;
                updateAvatarTypeButtons();
                setTimeout(async () => {
                    await refreshAvatarThumbnail();
                }, 1500);
            } else {
                console.error('[Character] Failed to set avatar type:', result);
                alert('Failed to change avatar type. Please try again.');
            }
        } catch (e) {
            console.error('[Character] Error setting avatar type:', e);
            alert('Failed to change avatar type. Please try again.');
        } finally {
            const r6Button = document.getElementById('R6Button');
            const r15Button = document.getElementById('R15Button');
            if (r6Button) r6Button.disabled = false;
            if (r15Button) r15Button.disabled = false;
        }
    }

    async function loadAvatarThumbnailWithRetry(avatarImg, userId, maxRetries = 5, delay = 1000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const result = await window.roblox.getUserFullBodyAvatars([userId], '352x352');
                const thumbData = result?.data?.[0];

                if (thumbData?.imageUrl) {
                    return new Promise((resolve) => {
                        const onLoad = () => {
                            avatarImg.removeEventListener('error', onError);
                            resolve(true);
                        };
                        const onError = () => {
                            console.warn('[Character] Avatar image failed to load:', thumbData.imageUrl);
                            avatarImg.removeEventListener('load', onLoad);
                            resolve(false);
                        };
                        avatarImg.addEventListener('load', onLoad, { once: true });
                        avatarImg.addEventListener('error', onError, { once: true });

                        const newUrl = thumbData.imageUrl;
                        if (avatarImg.src === newUrl) {
                            avatarImg.src = '';
                        }
                        avatarImg.src = newUrl;
                    });
                } else if (thumbData?.state === 'Pending' || thumbData?.state === 'Blocked') {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay = Math.min(delay * 1.5, 3000);
                } else {
                    console.warn('[Character] Avatar thumbnail unknown state:', thumbData?.state, thumbData);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (e) {
                console.warn(`[Character] Failed to load avatar preview (attempt ${attempt + 1}):`, e);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.warn('[Character] Failed to load avatar thumbnail after max retries');
        return false;
    }

    async function refreshAvatarThumbnail() {
        const characterContainer = document.getElementById('character-content');
        const avatarImg = characterContainer?.querySelector('#AvatarImage') || document.getElementById('AvatarImage');
        if (avatarImg && currentUserId) {
            await loadAvatarThumbnailWithRetry(avatarImg, currentUserId, 3, 1500);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function resetCharacterPage() {
        currentUserId = null;
        currentCategory = 8;
        wardrobePage = 1;
        wardrobeTotalPages = 1;
        wardrobeItems = [];
        outfitItems = [];
        wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(200, 30 * 60 * 1000) : {};
        assetDetailsCache = {};
        bodyColorsPalette = [];
        selectedBodyPart = null;
        isLoading = false;
        currentAvatarType = 'R15';
        window._characterPageInitializing = false;
        currentBodyColors = {
            headColor3: 'F5CD30',
            torsoColor3: 'F5CD30',
            rightArmColor3: 'F5CD30',
            leftArmColor3: 'F5CD30',
            rightLegColor3: 'F5CD30',
            leftLegColor3: 'F5CD30'
        };
        currentWearingAssets = [];
    }

    window.CharacterPage = {
        init: initCharacterPage,
        reset: resetCharacterPage
    };

    document.addEventListener('pageChange', function(e) {
        if (e.detail && e.detail.page === 'character') {
            initCharacterPage();
        }
    });

})();
