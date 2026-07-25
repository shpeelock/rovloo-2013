

const assetTypeMap = {
    1: 'Image',
    2: 'T-Shirt',
    3: 'Audio',
    4: 'Mesh',
    5: 'Lua',
    8: 'Hat',
    9: 'Place',
    10: 'Model',
    11: 'Shirt',
    12: 'Pants',
    13: 'Decal',
    17: 'Head',
    18: 'Face',
    19: 'Gear',
    21: 'Badge',
    22: 'Group Emblem',
    24: 'Animation',
    25: 'Arms',
    26: 'Legs',
    27: 'Torso',
    28: 'Right Arm',
    29: 'Left Arm',
    30: 'Left Leg',
    31: 'Right Leg',
    32: 'Package',
    33: 'YouTube Video',
    34: 'Game Pass',
    38: 'Plugin',
    40: 'MeshPart',
    41: 'Hair Accessory',
    42: 'Face Accessory',
    43: 'Neck Accessory',
    44: 'Shoulder Accessory',
    45: 'Front Accessory',
    46: 'Back Accessory',
    47: 'Waist Accessory',
    48: 'Climb Animation',
    49: 'Death Animation',
    50: 'Fall Animation',
    51: 'Idle Animation',
    52: 'Jump Animation',
    53: 'Run Animation',
    54: 'Swim Animation',
    55: 'Walk Animation',
    56: 'Pose Animation',
    61: 'Emote Animation',
    62: 'Video',
    64: 'T-Shirt Accessory',
    65: 'Shirt Accessory',
    66: 'Pants Accessory',
    67: 'Jacket Accessory',
    68: 'Sweater Accessory',
    69: 'Shorts Accessory',
    70: 'Left Shoe Accessory',
    71: 'Right Shoe Accessory',
    72: 'Dress Skirt Accessory',
    73: 'Font Family',
    74: 'Font Face',
    75: 'Mesh Hidden Surface Removal'
};

async function loadCatalogItemPage(itemId, itemType = 'Asset') {
    const container = document.getElementById('catalog-item-content');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading item...</div>';

    try {
        
        const items = [{ itemType: itemType, id: parseInt(itemId) }];
        let details;

        if (window.roblox?.getCatalogItemDetails) {
            details = await window.roblox.getCatalogItemDetails(items);
        } else {
            throw new Error('Item details API not available');
        }

        const item = details?.data?.[0];
        if (!item) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Item not found.</div>';
            return;
        }

        if (itemType === 'Asset' && window.roblox?.getAssetEconomyDetails) {
            try {
                const economyDetails = await window.roblox.getAssetEconomyDetails(itemId);
                if (economyDetails) {
                    
                    if (economyDetails.CollectibleItemId) item.collectibleItemId = economyDetails.CollectibleItemId;
                    if (economyDetails.CollectibleProductId) item.collectibleProductId = economyDetails.CollectibleProductId;
                    if (economyDetails.CollectiblesItemDetails) item.collectiblesItemDetails = economyDetails.CollectiblesItemDetails;
                    if (economyDetails.ProductId) item.productId = economyDetails.ProductId;
                    if (economyDetails.IsForSale !== undefined) item.isForSale = economyDetails.IsForSale;
                    if (economyDetails.IsPublicDomain !== undefined) item.isPublicDomain = economyDetails.IsPublicDomain;
                    
                    if (economyDetails.Created) item.created = economyDetails.Created;
                    if (economyDetails.Updated) item.updated = economyDetails.Updated;
                    
                    if (economyDetails.IsLimited !== undefined) item.isLimited = economyDetails.IsLimited;
                    if (economyDetails.IsLimitedUnique !== undefined) item.isLimitedUnique = economyDetails.IsLimitedUnique;
                    if (economyDetails.Remaining !== undefined) item.remaining = economyDetails.Remaining;
                    if (economyDetails.PriceInRobux !== undefined && item.price === undefined) item.price = economyDetails.PriceInRobux;
                    
                    if (economyDetails.LowestSellerPrice !== undefined) item.lowestResalePrice = economyDetails.LowestSellerPrice;
                    if (economyDetails.Sales !== undefined) item.sales = economyDetails.Sales;
                }
            } catch (e) {
                console.warn('Failed to fetch economy details:', e);
            }
        }

        if (itemType === 'Bundle' && window.roblox?.getSingleCatalogItemDetails) {
            try {
                const singleDetails = await window.roblox.getSingleCatalogItemDetails(itemId, 'Bundle');
                console.log('Single catalog item details response:', singleDetails);
                if (singleDetails) {
                    
                    if (singleDetails.itemCreatedUtc) item.created = singleDetails.itemCreatedUtc;
                    else if (singleDetails.createdUtc) item.created = singleDetails.createdUtc;
                    else if (singleDetails.created) item.created = singleDetails.created;

                    if (singleDetails.bundledItems && singleDetails.bundledItems.length > 0) {
                        
                        const assetIds = singleDetails.bundledItems
                            .filter(bi => bi.type === 'Asset')
                            .map(bi => bi.id);
                        
                        if (assetIds.length > 0 && window.roblox?.getDevelopAssetDetails) {
                            try {
                                const assetDetails = await window.roblox.getDevelopAssetDetails(assetIds);
                                console.log('Bundle asset details:', assetDetails);
                                if (assetDetails?.data && assetDetails.data.length > 0) {
                                    
                                    let mostRecentUpdate = null;
                                    for (const asset of assetDetails.data) {
                                        if (asset.updated) {
                                            const updateDate = new Date(asset.updated);
                                            if (!mostRecentUpdate || updateDate > mostRecentUpdate) {
                                                mostRecentUpdate = updateDate;
                                            }
                                        }
                                    }
                                    if (mostRecentUpdate) {
                                        item.updated = mostRecentUpdate.toISOString();
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to fetch bundle asset details:', e);
                            }
                        }
                    }

                    if (!item.updated && item.created) {
                        item.updated = item.created;
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch single catalog item details:', e);
            }
        }

        const response = await fetch('pages/catalog-item.html');
        const html = await response.text();
        container.innerHTML = html;

        await populateCatalogItemData(item);

    } catch (error) {
        console.error('Failed to load catalog item:', error);
        if (window.showErrorPage) {
            window.showErrorPage('Failed to load item details: ' + error.message, 'catalog-item-content');
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Failed to load item details.</div>';
        }
    }
}

async function populateCatalogItemData(item) {
    
    window.currentCatalogItem = item;

    const itemId = item.id || item.assetId || item.itemTargetId;
    const name = item.name || 'Unknown Item';
    const description = item.description || 'No description available.';
    const price = item.price ?? item.priceInRobux;
    const priceInTickets = item.priceInTickets;
    const creatorName = item.creatorName || 'ROBLOX';
    const creatorId = item.creatorTargetId || item.creatorId || 1;
    const creatorType = item.creatorType || 'User';
    const isLimited = item.isLimited || item.collectibleItemType === 'Limited';
    const isLimitedUnique = item.isLimitedUnique || item.collectibleItemType === 'LimitedUnique';
    const isForSale = item.isForSale !== false; 
    const favoriteCount = item.favoriteCount || 0;
    const remaining = item.unitsAvailableForConsumption;

    let userOwnsItem = false;
    let userFavoritedItem = false;
    try {
        if (window.roblox?.getCurrentUser && window.roblox?.userOwnsItem) {
            const currentUser = await window.roblox.getCurrentUser();
            if (currentUser?.id) {
                const itemType = item.itemType || 'Asset';
                const ownershipResult = await window.roblox.userOwnsItem(currentUser.id, itemType, itemId);
                
                userOwnsItem = ownershipResult?.data && ownershipResult.data.length > 0;

                if (itemType === 'Asset' && window.roblox?.getAssetFavoriteStatus) {
                    try {
                        const favoriteResult = await window.roblox.getAssetFavoriteStatus(currentUser.id, itemId);
                        userFavoritedItem = !!favoriteResult; 
                    } catch (favErr) {
                        
                        userFavoritedItem = false;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Failed to check item ownership:', e);
    }

    item.isFavorited = userFavoritedItem;

    let assetTypeName = 'Item';
    if (item.assetType) {
        
        if (typeof item.assetType === 'number') {
            assetTypeName = assetTypeMap[item.assetType] || 'Item';
        } else {
            assetTypeName = item.assetType;
        }
    } else if (item.itemType) {
        assetTypeName = item.itemType;
    }

    const nameEl = document.getElementById('item-name');
    if (nameEl) nameEl.textContent = name;

    const typeEl = document.getElementById('item-type');
    if (typeEl) {
        // Archive verbatim: limiteds append " / Collectible Item / Limited Edition" to the type line
        let typeLine = 'ROBLOX ' + assetTypeName;
        if (isLimited || isLimitedUnique) typeLine += ' / Collectible Item / Limited Edition';
        typeEl.textContent = typeLine;
    }

    const thumbEl = document.getElementById('item-thumbnail');
    const thumbLinkEl = document.getElementById('item-thumbnail-link');
    if (thumbEl) {
        try {
            let thumbResult;
            if (item.itemType === 'Bundle') {
                
                thumbResult = await window.roblox.getBundleThumbnails([itemId], '420x420');
            } else {
                thumbResult = await window.roblox.getAssetThumbnails([itemId], '420x420');
            }
            if (thumbResult?.data?.[0]?.imageUrl) {
                thumbEl.src = thumbResult.data[0].imageUrl;
            }
        } catch (e) {
            console.warn('Failed to load item thumbnail:', e);
        }
        thumbEl.alt = name;
    }
    if (thumbLinkEl) thumbLinkEl.title = name;

    const thumbnailContainer = document.getElementById('Thumbnail');
    if (thumbnailContainer && (isLimited || isLimitedUnique)) {
        
        const existingOverlay = thumbnailContainer.querySelector('.limited-overlay');
        if (existingOverlay) existingOverlay.remove();

        const limitedImg = document.createElement('img');
        limitedImg.className = 'limited-overlay';
        if (isLimitedUnique) {
            // Archive verbatim: the authentic 185x52 banner hangs 28px past the thumb's left edge
            // (the overflow clip on #assetContainer is authentic too)
            limitedImg.style.cssText = 'position: absolute; bottom: 0; left: 0; margin-left: -28px; z-index: 1;';
            limitedImg.src = 'images/icons/overlay_limitedUnique_banner.png';
            limitedImg.alt = 'Limited Unique';
        } else {
            // The plain-Limited asset (138x27) is designed flush-left — the -28px hang clips its text
            limitedImg.style.cssText = 'position: absolute; bottom: 0; left: 0; z-index: 1;';
            limitedImg.src = 'images/overlay_limited_big.png';
            limitedImg.alt = 'Limited';
        }
        thumbnailContainer.appendChild(limitedImg);
    }

    const wearableTypes = [2, 8, 11, 12, 17, 18, 19, 41, 42, 43, 44, 45, 46, 47]; 
    const assetTypeId = typeof item.assetType === 'number' ? item.assetType : null;
    const isWearable = assetTypeId && wearableTypes.includes(assetTypeId);
    
    const actionsContainer = document.getElementById('Actions');
    if (actionsContainer && isWearable && item.itemType !== 'Bundle') {
        actionsContainer.innerHTML = '';
        
        const tryOnBtn = document.createElement('a');
        tryOnBtn.id = 'try-on-btn';
        tryOnBtn.className = 'Button';
        tryOnBtn.href = '#';
        tryOnBtn.textContent = 'Try On';
        tryOnBtn.style.cssText = 'display: inline-block; margin-top: 10px;';
        tryOnBtn.onclick = async (e) => {
            e.preventDefault();
            await tryOnItem(itemId, { id: assetTypeId, name: assetTypeName }, name);
        };
        
        actionsContainer.appendChild(tryOnBtn);
    }

    const robuxPanel = document.getElementById('item-robux-panel');
    const robuxPriceEl = document.getElementById('item-price-robux');
    const offsalePanel = document.getElementById('item-offsale-panel');
    const buyRobuxBtn = document.getElementById('buy-robux-btn');
    const lowestResalePrice = item.lowestResalePrice;

    const isOffsale = !isForSale && !isLimited && !isLimitedUnique;

    let displayPrice = price;
    let usingResalePrice = false;
    if (isLimited || isLimitedUnique) {
        if (lowestResalePrice > 0) {
            
            displayPrice = lowestResalePrice;
            usingResalePrice = true;
        } else {
            
            displayPrice = null;
        }
    }

    const ownedPanel = document.getElementById('item-owned-panel');

    if (userOwnsItem) {
        if (robuxPanel) robuxPanel.style.display = 'none';
        if (offsalePanel) offsalePanel.style.display = 'none';
        if (ownedPanel) ownedPanel.style.display = 'block';
    } else if (isOffsale) {
        if (robuxPanel) robuxPanel.style.display = 'none';
        if (offsalePanel) offsalePanel.style.display = 'block';
        if (ownedPanel) ownedPanel.style.display = 'none';
    } else if (displayPrice !== null && displayPrice !== undefined && displayPrice > 0) {
        if (robuxPriceEl) robuxPriceEl.textContent = 'R$: ' + displayPrice.toLocaleString();
        if (robuxPanel) robuxPanel.style.display = 'block';
        if (offsalePanel) offsalePanel.style.display = 'none';
        if (ownedPanel) ownedPanel.style.display = 'none';

    } else if (displayPrice === 0) {
        
        if (robuxPriceEl) robuxPriceEl.textContent = 'Free';
        if (robuxPanel) robuxPanel.style.display = 'block';
        if (offsalePanel) offsalePanel.style.display = 'none';
        if (ownedPanel) ownedPanel.style.display = 'none';
    } else {
        if (robuxPanel) robuxPanel.style.display = 'none';
        if (offsalePanel) offsalePanel.style.display = 'none';
        if (ownedPanel) ownedPanel.style.display = 'none';
    }

    const ticketsPanel = document.getElementById('item-tickets-panel');
    const ticketsPriceEl = document.getElementById('item-price-tickets');
    if (priceInTickets) {
        if (ticketsPriceEl) ticketsPriceEl.textContent = 'Tx: ' + priceInTickets.toLocaleString();
        if (ticketsPanel) ticketsPanel.style.display = 'block';
    } else {
        if (ticketsPanel) ticketsPanel.style.display = 'none';
    }

    const creatorLinkEl = document.getElementById('item-creator-link');
    if (creatorLinkEl) {
        creatorLinkEl.textContent = creatorName;
        creatorLinkEl.href = '#';
        creatorLinkEl.onclick = (e) => {
            e.preventDefault();
            if (creatorType === 'Group') {
                window.location.hash = `#group?id=${creatorId}`;
            } else {
                window.location.hash = `#profile?id=${creatorId}`;
            }
        };
    }

    const creatorAvatarEl = document.getElementById('item-creator-avatar');
    const creatorAvatarLinkEl = document.getElementById('item-creator-avatar-link');
    if (creatorAvatarLinkEl) {
        creatorAvatarLinkEl.title = creatorName;
        creatorAvatarLinkEl.href = '#';
        creatorAvatarLinkEl.onclick = (e) => {
            e.preventDefault();
            if (creatorType === 'Group') {
                window.location.hash = `#group?id=${creatorId}`;
            } else {
                window.location.hash = `#profile?id=${creatorId}`;
            }
        };
    }
    if (creatorAvatarEl && creatorId) {
        try {
            if (creatorType === 'Group') {
                const groupThumbResult = await window.roblox.getGroupThumbnails([creatorId], '150x150');
                if (groupThumbResult?.data?.[0]?.imageUrl) {
                    creatorAvatarEl.src = groupThumbResult.data[0].imageUrl;
                }
            } else {
                const avatarResult = await window.roblox.getUserThumbnails([creatorId], '100x100', 'headshot');
                if (avatarResult?.data?.[0]?.imageUrl) {
                    creatorAvatarEl.src = avatarResult.data[0].imageUrl;
                }
                
                if (creatorAvatarLinkEl && window.addObcOverlayIfPremium) {
                    // Archive: the 66x19 BC strip sits flush at the avatar's bottom-left
                    // (in-flow img with top:-19px = bottom-aligned), natural size.
                    creatorAvatarLinkEl.style.position = 'relative';
                    creatorAvatarLinkEl.style.display = 'inline-block';
                    window.addObcOverlayIfPremium(creatorAvatarLinkEl, creatorId, { left: '0', bottom: '0' });
                }
            }
        } catch (e) {
            console.warn('Failed to load creator avatar:', e);
        }
        creatorAvatarEl.alt = creatorName;
    }

    const createdEl = document.getElementById('item-created');
    if (createdEl) {
        createdEl.textContent = item.created ? formatItemDate(item.created) : '--';
    }

    const updatedEl = document.getElementById('item-updated');
    if (updatedEl) {
        updatedEl.textContent = item.updated ? formatItemDate(item.updated) : '--';
    }

    const favoritesEl = document.getElementById('item-favorites');
    if (favoritesEl) favoritesEl.textContent = favoriteCount.toLocaleString();

    // Buy-box footnote: "N Remaining" (replaces the archive's non-functional "N Sold")
    if (isLimitedUnique && remaining !== undefined && remaining !== null) {
        const remFootnote = document.getElementById('item-remaining-footnote');
        const remCount = document.getElementById('item-remaining-count');
        if (remCount) remCount.textContent = Number(remaining).toLocaleString();
        if (remFootnote) remFootnote.style.display = 'block';
    }

    const descEl = document.getElementById('item-description');
    if (descEl) descEl.innerHTML = window.formatDescription ? window.formatDescription(description) : escapeHtml(description);

    const favStarEl = document.getElementById('item-fav-star');
    if (favStarEl) {
        favStarEl.className = item.isFavorited ? 'favorited' : 'notFavorited';
        favStarEl.style.cursor = 'pointer';
        favStarEl.title = item.isFavorited ? 'Remove from Favorites' : 'Add to Favorites';

        favStarEl.dataset.favorited = item.isFavorited ? 'true' : 'false';
        favStarEl.dataset.itemId = itemId;
        favStarEl.dataset.itemType = item.itemType || 'Asset';

        favStarEl.onclick = async (e) => {
            e.preventDefault();
            await toggleItemFavorite(favStarEl);
        };
    }

    if (isLimited || isLimitedUnique) {
        await loadItemResellers(item);
    }

    loadItemRecommendations(item).catch(e => console.warn('Recommendations failed:', e));

    if (window.BlacklistMenu && typeof window.BlacklistMenu.initItemDetailPage === 'function') {
        const blacklistContainer = document.getElementById('BlacklistSection');
        if (blacklistContainer) {
            window.BlacklistMenu.initItemDetailPage(item, blacklistContainer);
        }
    }

    setCurrentPurchaseItem(item);
}

async function loadItemResellers(item) {
    const itemId = item.id || item.assetId || item.itemTargetId;
    const collectibleItemId = item.collectibleItemId;
    const isLimitedUnique = item.isLimitedUnique || item.collectibleItemType === 'LimitedUnique';

    // Total stock for "Serial #N of TOTAL" — catalog details / collectibles details / economy remaining+sales
    window.currentItemTotalQuantity =
        item.totalQuantity ??
        item.collectiblesItemDetails?.TotalQuantity ??
        ((item.remaining !== undefined && item.sales !== undefined) ? (Number(item.remaining) + Number(item.sales)) : null);

    try {
        let resellers = [];

        if (collectibleItemId && window.roblox?.getCollectibleResellers) {
            const resellersData = await window.roblox.getCollectibleResellers(collectibleItemId, 100);
            resellers = resellersData?.data || [];
        }
        
        else if (window.roblox?.getAssetResellers) {
            const resellersData = await window.roblox.getAssetResellers(itemId);
            resellers = resellersData?.data || [];
        }

        if (resellers.length > 0) {
            const section = document.getElementById('item-resellers-section');
            const list = document.getElementById('item-resellers-list');

            if (section) section.style.display = 'block';
            if (list) {

                window.currentResellers = resellers;
                window.currentResellersPage = 1;
                window.resellersPerPage = 10;
                window.collectibleItemId = collectibleItemId;
                window.currentItemId = itemId;
                window.currentItemIsLimitedUnique = isLimitedUnique;

                await renderResellersPage(resellers, 1, itemId);
            }

            // Archive verbatim buy box for limiteds with sellers: "Best Price: R$N" + Buy Now
            // (cheapest reseller) + "See all private sellers (N)" replaces the regular price panel.
            const bestPanel = document.getElementById('item-bestprice-panel');
            if (bestPanel) {
                const cheapest = resellers.reduce((a, b) => ((b.price || Infinity) < (a.price || Infinity) ? b : a), resellers[0]);
                const priceEl = document.getElementById('item-bestprice-price');
                if (priceEl) priceEl.textContent = (cheapest.price || 0).toLocaleString();
                const seeAll = document.getElementById('item-see-all-sellers');
                if (seeAll) seeAll.textContent = `See all private sellers (${resellers.length})`;
                const buyBtn = document.getElementById('item-bestprice-buy');
                if (buyBtn) {
                    const sellerId = cheapest.seller?.sellerId || cheapest.seller?.id || 0;
                    const sellerName = (cheapest.seller?.name || 'Unknown').replace(/'/g, "\\'");
                    buyBtn.onclick = () => {
                        if (collectibleItemId && cheapest.collectibleProductId) {
                            window.purchaseFromReseller(collectibleItemId, cheapest.collectibleProductId, cheapest.collectibleItemInstanceId || '', sellerId, cheapest.price || 0, sellerName);
                        } else {
                            window.openItemOnRoblox(itemId);
                        }
                        return false;
                    };
                }
                ['item-robux-panel', 'item-tickets-panel', 'item-offsale-panel'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                bestPanel.style.display = 'block';
            }
        }
    } catch (e) {
        console.warn('Failed to load resellers:', e);
    }
}

// "Serial #1 of 10M" — stock counts from the millions up get truncated
function formatStockCount(n) {
    n = Number(n);
    if (!isFinite(n)) return '';
    if (n >= 1e6) {
        const m = n / 1e6;
        return (m % 1 === 0 ? m : m.toFixed(1)) + 'M';
    }
    return n.toLocaleString();
}

async function renderResellersPage(resellers, page, itemId) {
    const list = document.getElementById('item-resellers-list');
    if (!list) return;

    const perPage = window.resellersPerPage || 10;
    const totalPages = Math.ceil(resellers.length / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageResellers = resellers.slice(start, end);
    const collectibleItemId = window.collectibleItemId;
    const isLimitedUnique = window.currentItemIsLimitedUnique || false;

    const sellerIds = pageResellers.map(r => r.seller?.sellerId || r.seller?.id || 0).filter(id => id > 0);
    let avatarMap = {};
    if (sellerIds.length > 0 && window.roblox?.getUserThumbnails) {
        try {
            const thumbResult = await window.roblox.getUserThumbnails(sellerIds, '48x48', 'Headshot');
            if (thumbResult?.data) {
                thumbResult.data.forEach(t => {
                    if (t.targetId && t.imageUrl) {
                        avatarMap[t.targetId] = t.imageUrl;
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to fetch seller avatars:', e);
        }
    }

    // Archive verbatim (Midnight Blue Shaggy): table.ItemSalesTable, rows of
    // [avatar 48] [.SellerNameAndSerial: .SellerName link, span.robux price, .SerialNum
    // "Serial #N of TOTAL"] [.PriceBuyContainer: small green Buy Now].
    let html = `
        <table class="ItemSalesTable" cellspacing="0" cellpadding="0">
            <tbody>
    `;

    html += pageResellers.map(r => {
        const sellerId = r.seller?.sellerId || r.seller?.id || 0;
        const sellerName = r.seller?.name || 'Unknown';
        const serialNumber = r.serialNumber || '';
        const totalQuantity = window.currentItemTotalQuantity || '';
        const price = r.price || 0;
        const collectibleProductId = r.collectibleProductId;
        const collectibleItemInstanceId = r.collectibleItemInstanceId || '';

        const buyAction = collectibleItemId && collectibleProductId
            ? `window.purchaseFromReseller('${collectibleItemId}', '${collectibleProductId}', '${collectibleItemInstanceId}', ${sellerId}, ${price}, '${escapeItemHtml(sellerName).replace(/'/g, "\\'")}'); return false;`
            : `window.openItemOnRoblox(${itemId}); return false;`;

        const avatarUrl = avatarMap[sellerId] || '';

        return `
                <tr>
                    <td>
                        <a href="#" onclick="window.location.hash='#profile?id=${sellerId}'; return false;" style="display:inline-block;height:48px;width:48px;cursor:pointer;">
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeItemHtml(sellerName)}" width="48" height="48" border="0">` : `<span style="display:inline-block; width:48px; height:48px; background:#ccc;"></span>`}
                        </a>
                    </td>
                    <td class="SellerNameAndSerial">
                        <p class="SellerName"><a href="#" onclick="window.location.hash='#profile?id=${sellerId}'; return false;">${escapeItemHtml(sellerName)}</a></p>
                        <span class="robux">${price.toLocaleString()}</span>
                        ${isLimitedUnique && serialNumber ? `<p class="SerialNum">Serial #${serialNumber}${totalQuantity ? ` of ${formatStockCount(totalQuantity)}` : ''}</p>` : ''}
                    </td>
                    <td class="PriceBuyContainer">
                        <a class="roblox-buy-now btn-primary btn-small PurchaseButton" href="#" onclick="${buyAction}">Buy Now<span class="btn-text">Buy Now</span></a>
                    </td>
                </tr>
        `;
    }).join('');
    
    html += `
            </tbody>
        </table>
    `;

    if (totalPages > 1) {
        html += `
            <div class="resellers-pagination" style="padding:10px; font-size:12px;">
                <a href="#" onclick="window.goToResellersPage(1); return false;"${page <= 1 ? ' style="color:#999; pointer-events:none; font-size:12px;"' : ' style="font-size:12px;"'}>First</a>
                <a href="#" onclick="window.goToResellersPage(${totalPages}); return false;"${page >= totalPages ? ' style="color:#999; pointer-events:none; font-size:12px;"' : ' style="font-size:12px;"'}>Last</a>
                <a href="#" onclick="window.goToResellersPage(${page - 1}); return false;"${page <= 1 ? ' style="color:#999; pointer-events:none; font-size:12px;"' : ' style="font-size:12px;"'}>Previous</a>
                ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                    const pageNum = i + 1;
                    return `<a href="#" onclick="window.goToResellersPage(${pageNum}); return false;"${pageNum === page ? ' style="font-weight:bold; font-size:12px;"' : ' style="font-size:12px;"'}>${pageNum}</a>`;
                }).join(' ')}
                ${totalPages > 5 ? ' ... ' : ''}
                <a href="#" onclick="window.goToResellersPage(${page + 1}); return false;"${page >= totalPages ? ' style="color:#999; pointer-events:none; font-size:12px;"' : ' style="font-size:12px;"'}>Next</a>
            </div>
        `;
    }
    
    list.innerHTML = html;
    window.currentResellersPage = page;
}

window.openItemOnRoblox = function(itemId) {
    if (window.roblox?.openExternal) {
        window.roblox.openExternal(`https://www.roblox.com/catalog/${itemId}`);
    } else {
        window.open(`https://www.roblox.com/catalog/${itemId}`, '_blank');
    }
};

window.goToResellersPage = async function(page) {
    const resellers = window.currentResellers;
    const itemId = window.currentItemId;
    if (!resellers) return;
    
    const totalPages = Math.ceil(resellers.length / (window.resellersPerPage || 10));
    if (page < 1 || page > totalPages) return;
    
    await renderResellersPage(resellers, page, itemId);
};

async function loadItemRecommendations(item) {
    const list = document.getElementById('item-recommendations');
    if (!list) return;

    const itemId = item.id || item.assetId || item.itemTargetId;
    const assetTypeId = item.assetType || item.assetTypeId || item.itemTargetType || 8; 
    const bundleTypeId = item.bundleType || 1; 
    const isBundle = item.itemType === 'Bundle';

    try {
        let recommendations = [];

        if (isBundle && window.roblox?.getBundleRecommendations) {
            
            try {
                const response = await window.roblox.getBundleRecommendations(itemId, bundleTypeId, 7);
                if (response?.data && response.data.length > 0) {
                    
                    const bundleIds = response.data.filter(id => id !== parseInt(itemId));
                    if (bundleIds.length > 0 && window.roblox?.getCatalogItemDetails) {
                        const items = bundleIds.map(id => ({ itemType: 'Bundle', id: parseInt(id) }));
                        const details = await window.roblox.getCatalogItemDetails(items);
                        if (details?.data) {
                            recommendations = details.data.slice(0, 6);
                        }
                    }
                }
            } catch (e) {
                console.warn('Bundle recommendations API failed, falling back to search:', e);
            }
        } else if (!isBundle && window.roblox?.getAssetRecommendations) {
            
            try {
                const response = await window.roblox.getAssetRecommendations(itemId, assetTypeId, 7);
                if (response?.data && response.data.length > 0) {
                    
                    const assetIds = response.data.filter(id => id !== parseInt(itemId));
                    if (assetIds.length > 0 && window.roblox?.getCatalogItemDetails) {
                        const items = assetIds.map(id => ({ itemType: 'Asset', id: parseInt(id) }));
                        const details = await window.roblox.getCatalogItemDetails(items);
                        if (details?.data) {
                            recommendations = details.data.slice(0, 6);
                        }
                    }
                }
            } catch (e) {
                console.warn('Asset recommendations API failed, falling back to search:', e);
            }
        }

        if (recommendations.length === 0 && window.roblox?.searchCatalog) {
            const params = {
                categoryFilter: null,
                sortType: 0,
                keyword: '',
                limit: 10
            };
            const response = await window.roblox.searchCatalog(params);
            if (response?.data && response.data.length > 0) {
                recommendations = response.data.filter(r => r.id !== itemId).slice(0, 6);
            }
        }

        if (recommendations.length > 0) {
                
                let thumbnails = {};
                const assetItems = recommendations.filter(r => r.itemType !== 'Bundle');
                const bundleItems = recommendations.filter(r => r.itemType === 'Bundle');

                if (assetItems.length > 0 && window.roblox?.getAssetThumbnails) {
                    try {
                        const assetIds = assetItems.map(r => r.id);
                        const thumbData = await window.roblox.getAssetThumbnails(assetIds, '110x110');
                        if (thumbData?.data) {
                            thumbData.data.forEach(t => {
                                if (t.state === 'Completed' && t.imageUrl) {
                                    thumbnails[t.targetId] = t.imageUrl;
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to fetch asset recommendation thumbnails:', e);
                    }
                }

                if (bundleItems.length > 0 && window.roblox?.getBundleThumbnails) {
                    try {
                        const bundleIds = bundleItems.map(r => r.id);
                        const thumbData = await window.roblox.getBundleThumbnails(bundleIds, '150x150');
                        if (thumbData?.data) {
                            thumbData.data.forEach(t => {
                                if (t.state === 'Completed' && t.imageUrl) {
                                    thumbnails[t.targetId] = t.imageUrl;
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to fetch bundle recommendation thumbnails:', e);
                    }
                }

                // Authentic 2013 RecommendationsTab: ONE row of up to 5 .PortraitDiv cells in a
                // 175px x 800px centered table; PortraitDiv inline width:140/overflow:hidden/
                // margin:auto (NO height — long names push); imgs carry explicit 110x110 attrs;
                // creator line = stat-label + Detail stat (archive verbatim).
                const recRow = recommendations.slice(0, 5);

                const buildRow = (items) => items.map(r => {

                    const restrictions = r.itemRestrictions || [];
                    const isLimited = restrictions.includes('Limited');
                    const isLimitedUnique = restrictions.includes('LimitedUnique');

                    let limitedOverlay = '';
                    if (isLimitedUnique) {
                        limitedOverlay = '<img src="images/assetIcons/limitedunique.png" class="limited-overlay" alt="Limited U"/>';
                    } else if (isLimited) {
                        limitedOverlay = '<img src="images/assetIcons/limited.png" class="limited-overlay" alt="Limited"/>';
                    }

                    return `
                    <td>
                        <div class="PortraitDiv" style="width: 140px; overflow: hidden; margin: auto;">
                            <div class="AssetThumbnail">
                                <a href="#" onclick="window.location.hash='#catalog-item?id=${r.id}&type=${r.itemType || 'Asset'}'; return false;" title="${escapeItemHtml(r.name)}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
                                    <img src="${thumbnails[r.id] || 'images/spinners/spinner100x100.gif'}" height="110" width="110" border="0" alt="${escapeItemHtml(r.name)}"/>
                                </a>
                                ${limitedOverlay}
                            </div>
                            <div class="AssetDetails">
                                <div class="AssetName noTranslate">
                                    <a href="#" onclick="window.location.hash='#catalog-item?id=${r.id}&type=${r.itemType || 'Asset'}'; return false;">${escapeItemHtml(r.name)}</a>
                                </div>
                                <div class="AssetCreator">
                                    <span class="stat-label">Creator:</span> <span class="Detail stat"><a class="notranslate" href="#" onclick="window.location.hash='#profile?id=${r.creatorTargetId || 1}'; return false;">${escapeItemHtml(r.creatorName || 'ROBLOX')}</a></span>
                                </div>
                            </div>
                        </div>
                    </td>
                    `;
                }).join('');

                list.innerHTML = `<table cellspacing="0" align="Center" border="0" style="height:175px;width:800px;border-collapse:collapse;">
                    <tr>${buildRow(recRow)}</tr>
                </table>`;
                return;
        }

        list.innerHTML = '<div style="padding:10px;color:#666;">No recommendations available.</div>';
    } catch (error) {
        console.warn('Failed to load recommendations:', error);
        list.innerHTML = '<div style="padding:10px;color:#666;">Could not load recommendations.</div>';
    }
}

function formatItemDate(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatItemRelativeTime(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
}

function escapeItemHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function toggleItemFavorite(starEl) {
    if (!starEl) return;
    
    const itemId = starEl.dataset.itemId;
    const itemType = starEl.dataset.itemType;
    const isFavorited = starEl.dataset.favorited === 'true';
    
    if (!itemId) return;

    let userId = null;
    try {
        if (window.roblox?.getCurrentUser) {
            const currentUser = await window.roblox.getCurrentUser();
            userId = currentUser?.id;
        }
    } catch (e) {
        console.error('Failed to get current user:', e);
    }
    
    if (!userId) {
        console.warn('Must be logged in to favorite items');
        return;
    }

    const newFavorited = !isFavorited;
    starEl.className = newFavorited ? 'favorited' : 'notFavorited';
    starEl.dataset.favorited = newFavorited ? 'true' : 'false';
    starEl.title = newFavorited ? 'Remove from Favorites' : 'Add to Favorites';

    const favoritesEl = document.getElementById('item-favorites');
    let currentCount = 0;
    if (favoritesEl) {
        const match = favoritesEl.textContent.match(/(\d+)/);
        if (match) currentCount = parseInt(match[1], 10);
        const newCount = newFavorited ? currentCount + 1 : Math.max(0, currentCount - 1);
        favoritesEl.textContent = newCount.toLocaleString();
    }
    
    try {

        if (window.roblox?.setAssetFavorite) {
            await window.roblox.setAssetFavorite(userId, itemId, newFavorited);
            console.log(`Item ${itemId} ${newFavorited ? 'favorited' : 'unfavorited'}`);
        }
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        
        starEl.className = isFavorited ? 'favorited' : 'notFavorited';
        starEl.dataset.favorited = isFavorited ? 'true' : 'false';
        starEl.title = isFavorited ? 'Remove from Favorites' : 'Add to Favorites';
        if (favoritesEl) {
            favoritesEl.textContent = currentCount.toLocaleString();
        }
    }
}

function resetCatalogItemPage() {
    const container = document.getElementById('catalog-item-content');
    if (container) {
        container.innerHTML = '';
    }
    currentPurchaseItem = null;
    window.currentCatalogItem = null;

    window.currentResellers = null;
    window.currentResellersPage = null;
    window.resellersPerPage = null;
    window.collectibleItemId = null;
    window.currentItemId = null;
    window.currentItemIsLimitedUnique = null;
    window.currentItemTotalQuantity = null;
}

async function tryOnItem(assetId, assetType, assetName) {
    const tryOnBtn = document.getElementById('try-on-btn');
    const thumbEl = document.getElementById('item-thumbnail');
    if (!tryOnBtn) return;

    if (tryOnBtn.dataset.previewMode === 'true') {
        
        if (thumbEl && thumbEl.dataset.originalSrc) {
            thumbEl.src = thumbEl.dataset.originalSrc;
        }
        tryOnBtn.textContent = 'Try On';
        tryOnBtn.dataset.previewMode = 'false';
        return;
    }
    
    const originalText = tryOnBtn.textContent;
    tryOnBtn.textContent = 'Trying on...';
    tryOnBtn.style.pointerEvents = 'none';
    
    try {
        
        const currentUser = await window.roblox.getCurrentUser();
        if (!currentUser?.id) {
            throw new Error('Not logged in');
        }
        
        const currentAvatar = await window.roblox.getCurrentAvatarV2();
        if (!currentAvatar) {
            throw new Error('Failed to get current avatar');
        }

        const currentAssetIds = (currentAvatar.assets || []).map(a => a.id);

        if (currentAssetIds.includes(assetId)) {
            tryOnBtn.textContent = 'Already Wearing';
            setTimeout(() => {
                tryOnBtn.textContent = originalText;
                tryOnBtn.style.pointerEvents = 'auto';
            }, 2000);
            return;
        }

        const allAssetIds = [assetId, ...currentAssetIds];

        const bodyColors = currentAvatar.bodyColor3s ? {
            headColor: currentAvatar.bodyColor3s.headColor3 || 'F8F8F8',
            leftArmColor: currentAvatar.bodyColor3s.leftArmColor3 || 'F8F8F8',
            leftLegColor: currentAvatar.bodyColor3s.leftLegColor3 || 'F8F8F8',
            rightArmColor: currentAvatar.bodyColor3s.rightArmColor3 || 'F8F8F8',
            rightLegColor: currentAvatar.bodyColor3s.rightLegColor3 || 'F8F8F8',
            torsoColor: currentAvatar.bodyColor3s.torsoColor3 || 'F8F8F8'
        } : {
            headColor: 'F8F8F8',
            leftArmColor: 'F8F8F8',
            leftLegColor: 'F8F8F8',
            rightArmColor: 'F8F8F8',
            rightLegColor: 'F8F8F8',
            torsoColor: 'F8F8F8'
        };
        
        const scales = currentAvatar.scales || {
            height: 1,
            width: 1,
            head: 1,
            depth: 1,
            proportion: 0,
            bodyType: 0
        };
        
        const playerAvatarType = currentAvatar.playerAvatarType || 'R15';

        const result = await window.roblox.renderAvatarWithAssets(
            assetId,
            allAssetIds,
            bodyColors,
            scales,
            playerAvatarType,
            '420x420'
        );
        
        if (result?.state === 'Completed' && result?.imageUrl) {
            
            if (thumbEl) {
                
                if (!thumbEl.dataset.originalSrc) {
                    thumbEl.dataset.originalSrc = thumbEl.src;
                }
                thumbEl.src = result.imageUrl;
            }
            
            tryOnBtn.textContent = 'Take Off';
            tryOnBtn.dataset.previewMode = 'true';
            tryOnBtn.style.pointerEvents = 'auto';
        } else {
            console.warn('Avatar render failed or pending:', result);
            tryOnBtn.textContent = 'Preview Failed';
            setTimeout(() => {
                tryOnBtn.textContent = originalText;
                tryOnBtn.style.pointerEvents = 'auto';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Try on error:', error);
        tryOnBtn.textContent = 'Error';
        setTimeout(() => {
            tryOnBtn.textContent = 'Try On';
            tryOnBtn.style.pointerEvents = 'auto';
        }, 2000);
    }
}

let currentPurchaseItem = null;

function setCurrentPurchaseItem(item) {
    currentPurchaseItem = item;
}

async function showPurchaseConfirmation() {
    if (!currentPurchaseItem) {
        console.warn('No item data for purchase');
        return;
    }

    const modal = document.getElementById('purchase-modal');
    if (!modal) return;

    const item = currentPurchaseItem;
    const itemId = item.id || item.assetId || item.itemTargetId;
    const name = item.name || 'Unknown Item';
    const isLimited = item.isLimited || item.collectibleItemType === 'Limited';
    const isLimitedUnique = item.isLimitedUnique || item.collectibleItemType === 'LimitedUnique';

    let displayPrice = item.price ?? item.priceInRobux ?? 0;
    let purchaseFromReseller = false;
    
    if ((isLimited || isLimitedUnique) && window.currentResellers && window.currentResellers.length > 0) {
        
        const lowestReseller = window.currentResellers[0]; 
        if (lowestReseller) {
            displayPrice = lowestReseller.price || item.lowestResalePrice || displayPrice;
            purchaseFromReseller = true;
            
            item._resellerData = lowestReseller;
        }
    } else if ((isLimited || isLimitedUnique) && item.lowestResalePrice) {
        displayPrice = item.lowestResalePrice;
    }

    document.getElementById('purchase-modal-name').textContent = name;
    document.getElementById('purchase-modal-price').textContent = `R$ ${displayPrice.toLocaleString()}`;

    const priceEl = document.getElementById('purchase-modal-price');
    if (priceEl && purchaseFromReseller) {
        const resellerName = item._resellerData?.seller?.name || 'reseller';
        priceEl.innerHTML = `R$ ${displayPrice.toLocaleString()} <span style="font-size:11px;color:#666;">(from ${escapeItemHtml(resellerName)})</span>`;
    }

    const thumbImg = document.getElementById('purchase-modal-thumbnail');
    if (thumbImg) {
        const currentThumb = document.getElementById('item-thumbnail');
        if (currentThumb && currentThumb.src) {
            thumbImg.src = currentThumb.src;
        }
    }

    try {
        if (window.roblox?.getCurrentUser) {
            const currentUser = await window.roblox.getCurrentUser();
            if (currentUser && window.roblox?.getUserCurrency) {
                const currencyData = await window.roblox.getUserCurrency(currentUser.id);
                if (currencyData?.robux !== undefined) {
                    document.getElementById('purchase-modal-balance').textContent = `Your balance: R$ ${currencyData.robux.toLocaleString()}`;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to get user balance:', e);
    }

    const errorEl = document.getElementById('purchase-modal-error');
    const successEl = document.getElementById('purchase-modal-success');
    const buttonsEl = document.getElementById('purchase-modal-buttons');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const cancelBtn = document.getElementById('purchase-cancel-btn');
    const captchaContainer = document.getElementById('purchase-captcha-container');
    const captchaIframe = document.getElementById('purchase-captcha-iframe');
    
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.innerHTML = '';
    }
    if (successEl) {
        successEl.style.display = 'none';
        successEl.textContent = '';
    }
    if (buttonsEl) buttonsEl.style.display = 'block';
    if (confirmBtn) {
        confirmBtn.style.display = '';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Buy Now';
    }
    if (cancelBtn) {
        cancelBtn.textContent = 'Cancel';
    }
    if (captchaContainer) captchaContainer.style.display = 'none';
    if (captchaIframe) captchaIframe.src = '';

    pendingChallengeData = null;

    modal.style.display = 'block';

    document.getElementById('purchase-confirm-btn').onclick = () => confirmPurchase();
    document.getElementById('purchase-cancel-btn').onclick = () => closePurchaseModal();
}

function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    if (modal) modal.style.display = 'none';

    const captchaContainer = document.getElementById('purchase-captcha-container');
    const captchaIframe = document.getElementById('purchase-captcha-iframe');
    if (captchaContainer) captchaContainer.style.display = 'none';
    if (captchaIframe) captchaIframe.src = '';

    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const cancelBtn = document.getElementById('purchase-cancel-btn');
    const buttonsEl = document.getElementById('purchase-modal-buttons');
    if (confirmBtn) {
        confirmBtn.style.display = '';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Buy Now';
    }
    if (cancelBtn) {
        cancelBtn.textContent = 'Cancel';
    }
    if (buttonsEl) {
        buttonsEl.style.display = '';
    }

    pendingChallengeData = null;
}

let pendingChallengeData = null;

async function confirmPurchase() {
    if (!currentPurchaseItem) return;

    const item = currentPurchaseItem;
    const itemId = item.id || item.assetId || item.itemTargetId;
    const isLimited = item.isLimited || item.collectibleItemType === 'Limited';
    const isLimitedUnique = item.isLimitedUnique || item.collectibleItemType === 'LimitedUnique';

    let price, sellerId, sellerType, collectibleProductId, collectibleItemInstanceId;
    const collectibleItemId = item.collectibleItemId || window.collectibleItemId;
    
    if ((isLimited || isLimitedUnique) && item._resellerData) {
        
        const reseller = item._resellerData;
        console.log('Purchasing from reseller:', reseller);
        price = reseller.price;
        sellerId = reseller.seller?.sellerId || reseller.seller?.id;
        sellerType = 'User'; 
        collectibleProductId = reseller.collectibleProductId;
        collectibleItemInstanceId = reseller.collectibleItemInstanceId; 
        console.log('Reseller purchase params:', { price, sellerId, sellerType, collectibleProductId, collectibleItemId, collectibleItemInstanceId });
    } else {
        
        price = item.price ?? item.priceInRobux ?? 0;
        sellerId = item.creatorTargetId || item.creatorId || 1;
        sellerType = item.creatorType === 'Group' ? 'Group' : 'User';
        collectibleProductId = item.collectibleProductId;
        collectibleItemInstanceId = null; 
        console.log('Normal purchase params:', { price, sellerId, sellerType, collectibleProductId, collectibleItemId });
    }
    
    const productId = item.productId;

    const errorEl = document.getElementById('purchase-modal-error');
    const successEl = document.getElementById('purchase-modal-success');
    const buttonsEl = document.getElementById('purchase-modal-buttons');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const captchaContainer = document.getElementById('purchase-captcha-container');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    try {
        let result;

        let purchaserId = null;
        if (window.roblox?.getCurrentUser) {
            const currentUser = await window.roblox.getCurrentUser();
            purchaserId = currentUser?.id;
        }

        if (!purchaserId) {
            throw new Error('Must be logged in to purchase');
        }

        if (collectibleItemId && collectibleProductId) {
            
            if (!window.roblox?.purchaseCollectible) {
                throw new Error('Collectible purchase API not available');
            }

            result = await window.roblox.purchaseCollectible(collectibleItemId, {
                expectedPrice: price,
                expectedPurchaserId: purchaserId,
                expectedSellerId: sellerId,
                expectedSellerType: sellerType,
                collectibleProductId: collectibleProductId,
                collectibleItemInstanceId: collectibleItemInstanceId 
            });

            if (result?.requiresChallenge) {
                console.log('Purchase requires CAPTCHA verification:', result);
                await showCaptchaChallenge(result, collectibleItemId);
                return; 
            }
        } else if (productId) {

            if (!window.roblox?.purchaseItem) {
                throw new Error('Purchase API not available');
            }

            result = await window.roblox.purchaseItem(productId, {
                expectedPrice: price,
                expectedSellerId: sellerId
            });
        } else {
            throw new Error('Cannot purchase this item - missing product information. Try refreshing the page.');
        }

        if (result?.purchased || result?.success) {
            handlePurchaseSuccess();
        } else {
            throw new Error(result?.errorMessage || result?.purchaseResult || 'Purchase failed');
        }

    } catch (error) {
        console.error('Purchase failed:', error);
        handlePurchaseError(error, item);
    }
}

async function showCaptchaChallenge(challengeResult, collectibleItemId) {
    const errorEl = document.getElementById('purchase-modal-error');
    const captchaContainer = document.getElementById('purchase-captcha-container');
    const captchaIframe = document.getElementById('purchase-captcha-iframe');
    const confirmBtn = document.getElementById('purchase-confirm-btn');

    pendingChallengeData = {
        challengeId: challengeResult.challengeId,
        challengeType: challengeResult.challengeType,
        challengeMetadata: challengeResult.challengeMetadata,
        originalParams: challengeResult.originalParams,
        collectibleItemId: collectibleItemId
    };

    if (challengeResult.challengeType === 'forcetwostepverification') {
        
        await showTwoStepChallenge(challengeResult);
        return;
    }
    
    if (challengeResult.challengeType === 'twostepverification') {
        
        await showTwoStepVerification(challengeResult);
        return;
    }

    try {
        
        const blob = challengeResult.challengeMetadata?.dataExchangeBlob;
        
        if (!window.roblox?.getCaptchaToken) {
            throw new Error('CAPTCHA API not available');
        }
        
        const captchaResult = await window.roblox.getCaptchaToken({
            blob: blob,
            actionType: 'Generic'
        });
        
        if (!captchaResult?.success || !captchaResult?.embedUrl) {
            throw new Error(captchaResult?.error || 'Failed to get CAPTCHA');
        }
        
        console.log('Loading CAPTCHA embed URL:', captchaResult.embedUrl);

        pendingChallengeData.captchaToken = captchaResult.token;

        captchaContainer.style.display = 'block';
        captchaIframe.src = captchaResult.embedUrl;

        confirmBtn.textContent = 'Complete Verification';
        confirmBtn.disabled = false;
        confirmBtn.onclick = () => retryCaptchaPurchase();

        window.addEventListener('message', handleCaptchaMessage);
        
    } catch (error) {
        console.error('Failed to show CAPTCHA:', error);
        errorEl.textContent = 'Failed to load verification. Please try again or complete purchase on Roblox website.';
        errorEl.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Buy Now';
    }
}

async function showTwoStepChallenge(challengeResult) {
    const errorEl = document.getElementById('purchase-modal-error');
    const captchaContainer = document.getElementById('purchase-captcha-container');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const buttonsEl = document.getElementById('purchase-modal-buttons');
    
    const metadata = challengeResult.challengeMetadata;
    console.log('2FA Challenge - Full result:', challengeResult);
    console.log('2FA Challenge metadata:', metadata);

    const purchaseChallengeId = challengeResult.challengeId;
    
    console.log('Purchase Challenge ID:', purchaseChallengeId);

    let userId = null;
    if (window.roblox?.getCurrentUser) {
        const currentUser = await window.roblox.getCurrentUser();
        userId = currentUser?.id;
    }

    pendingChallengeData.purchaseChallengeId = purchaseChallengeId;
    pendingChallengeData.userId = userId;

    captchaContainer.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:14px; font-weight:bold; margin-bottom:10px;">Two-Step Verification Required</div>
            <div style="font-size:12px; color:#666; margin-bottom:15px;">
                Your account requires 2-Step Verification to make purchases.<br><br>
                <strong>If you have 2FA enabled:</strong><br>
                Enter your authenticator app code below.<br><br>
                <strong>If you don't have 2FA:</strong><br>
                You need to enable it in your Roblox account settings first.
            </div>
            <input type="text" id="twostep-code-input" placeholder="Enter 6-digit code" 
                   style="padding:8px; font-size:16px; width:150px; text-align:center; letter-spacing:3px;"
                   maxlength="6" autocomplete="off">
            <div style="margin-top:15px;">
                <button id="open-security-settings-btn" style="background:#6e99c9; color:#fff; border:none; padding:6px 12px; cursor:pointer; font-size:12px;">
                    Open Security Settings
                </button>
            </div>
            <div id="twostep-error" style="color:#cc0000; font-size:12px; margin-top:10px; display:none;"></div>
        </div>
    `;
    captchaContainer.style.display = 'block';

    pendingChallengeData.verificationMethod = 'authenticator';

    const securityBtn = document.getElementById('open-security-settings-btn');
    if (securityBtn) {
        securityBtn.onclick = () => {
            if (window.roblox?.openExternal) {
                window.roblox.openExternal('https://www.roblox.com/my/account#!/security');
            } else {
                window.open('https://www.roblox.com/my/account#!/security', '_blank');
            }
        };
    }

    setTimeout(() => {
        const input = document.getElementById('twostep-code-input');
        if (input) input.focus();
    }, 100);

    confirmBtn.textContent = 'Verify & Purchase';
    confirmBtn.disabled = false;
    confirmBtn.onclick = () => submitTwoStepCode();
}

async function showTwoStepVerification(challengeResult) {
    const captchaContainer = document.getElementById('purchase-captcha-container');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    
    const metadata = challengeResult.challengeMetadata;
    console.log('2FA Verification - Full result:', challengeResult);
    console.log('2FA Verification metadata:', metadata);

    const headerChallengeId = challengeResult.challengeId; 
    const metadataChallengeId = metadata?.challengeId; 
    const userId = metadata?.userId;
    
    console.log('Header Challenge ID:', headerChallengeId);
    console.log('Metadata Challenge ID:', metadataChallengeId);
    console.log('User ID:', userId);

    pendingChallengeData.purchaseChallengeId = headerChallengeId;
    pendingChallengeData.twostepChallengeId = metadataChallengeId;
    pendingChallengeData.userId = userId;
    pendingChallengeData.verificationMethod = 'authenticator';
    
    captchaContainer.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:14px; font-weight:bold; margin-bottom:10px;">Two-Step Verification</div>
            <div style="font-size:12px; color:#666; margin-bottom:15px;">
                Enter the 6-digit code from your authenticator app to complete this purchase.
            </div>
            <input type="text" id="twostep-code-input" placeholder="Enter 6-digit code" 
                   style="padding:8px; font-size:16px; width:150px; text-align:center; letter-spacing:3px;"
                   maxlength="6" autocomplete="off">
            <div id="twostep-error" style="color:#cc0000; font-size:12px; margin-top:10px; display:none;"></div>
        </div>
    `;
    captchaContainer.style.display = 'block';

    setTimeout(() => {
        const input = document.getElementById('twostep-code-input');
        if (input) input.focus();
    }, 100);

    confirmBtn.textContent = 'Verify & Purchase';
    confirmBtn.disabled = false;
    confirmBtn.onclick = () => submitTwoStepVerificationCode();
}

async function submitTwoStepVerificationCode() {
    if (!pendingChallengeData) return;
    
    const codeInput = document.getElementById('twostep-code-input');
    const twostepError = document.getElementById('twostep-error');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    
    const code = codeInput?.value?.trim();
    
    if (!code || code.length !== 6) {
        if (twostepError) {
            twostepError.textContent = 'Please enter a 6-digit code';
            twostepError.style.display = 'block';
        }
        return;
    }
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Verifying...';
    if (twostepError) twostepError.style.display = 'none';
    
    try {
        const { purchaseChallengeId, twostepChallengeId, userId, originalParams, collectibleItemId } = pendingChallengeData;

        const challengeIdToUse = twostepChallengeId || purchaseChallengeId;
        
        console.log('Verifying 2FA with challengeId:', challengeIdToUse, 'userId:', userId);

        const verifyResult = await window.roblox.verifyTwoStepForChallenge(userId, challengeIdToUse, code, 'authenticator');
        
        if (!verifyResult?.success) {
            throw new Error(verifyResult?.error || 'Verification failed');
        }
        
        console.log('2FA verified, got verificationToken:', verifyResult.verificationToken?.substring(0, 20) + '...');

        console.log('Continuing purchase challenge...');
        const continueResult = await window.roblox.continueChallenge(
            purchaseChallengeId,
            'twostepverification',
            verifyResult.verificationToken,
            verifyResult.rememberTicket,
            twostepChallengeId 
        );
        
        if (!continueResult?.success) {
            console.warn('Continue challenge response:', continueResult);
        }
        
        console.log('Retrying purchase...');

        const result = await window.roblox.purchaseCollectible(collectibleItemId, {
            ...originalParams,
            challengeId: purchaseChallengeId,
            challengeType: 'twostepverification',
            verificationToken: verifyResult.verificationToken,
            rememberTicket: verifyResult.rememberTicket
        });
        
        if (result?.requiresChallenge) {
            if (twostepError) {
                twostepError.textContent = 'Verification failed. Please try again.';
                twostepError.style.display = 'block';
            }
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Verify & Purchase';
        } else if (result?.purchased || result?.success) {
            handlePurchaseSuccess();
        } else {
            throw new Error(result?.errorMessage || 'Purchase failed after verification');
        }
        
    } catch (error) {
        console.error('2FA verification failed:', error);
        if (twostepError) {
            twostepError.textContent = error.message || 'Verification failed. Please try again.';
            twostepError.style.display = 'block';
        }
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Verify & Purchase';
    }
}

async function submitTwoStepCode() {
    if (!pendingChallengeData) return;
    
    const codeInput = document.getElementById('twostep-code-input');
    const twostepError = document.getElementById('twostep-error');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    
    const code = codeInput?.value?.trim();
    
    if (!code || code.length !== 6) {
        if (twostepError) {
            twostepError.textContent = 'Please enter a 6-digit code';
            twostepError.style.display = 'block';
        }
        return;
    }
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Verifying...';
    if (twostepError) twostepError.style.display = 'none';
    
    try {
        const { purchaseChallengeId, userId, verificationMethod, originalParams, collectibleItemId } = pendingChallengeData;
        
        if (!userId) {
            throw new Error('Could not get user ID for verification');
        }

        const method = verificationMethod || 'authenticator';
        console.log('Verifying 2FA code with challengeId:', purchaseChallengeId, 'method:', method);
        const verifyResult = await window.roblox.verifyTwoStepForChallenge(userId, purchaseChallengeId, code, method);
        
        if (!verifyResult?.success) {
            throw new Error(verifyResult?.error || 'Verification failed');
        }
        
        console.log('2FA verified, got verificationToken:', verifyResult.verificationToken?.substring(0, 20) + '...');

        console.log('Continuing purchase challenge...');
        const continueResult = await window.roblox.continueChallenge(
            purchaseChallengeId,
            'twostepverification',
            verifyResult.verificationToken,
            verifyResult.rememberTicket
        );
        
        if (!continueResult?.success) {
            console.warn('Continue challenge failed, but trying purchase anyway:', continueResult?.error);
        }
        
        console.log('Retrying purchase...');

        const result = await window.roblox.purchaseCollectible(collectibleItemId, {
            ...originalParams,
            challengeId: purchaseChallengeId,
            challengeType: 'twostepverification',
            verificationToken: verifyResult.verificationToken,
            rememberTicket: verifyResult.rememberTicket
        });
        
        if (result?.requiresChallenge) {
            if (twostepError) {
                twostepError.textContent = 'Verification failed. Please try again.';
                twostepError.style.display = 'block';
            }
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Verify & Purchase';
        } else if (result?.purchased || result?.success) {
            handlePurchaseSuccess();
        } else {
            throw new Error(result?.errorMessage || 'Purchase failed after verification');
        }
        
    } catch (error) {
        console.error('2FA verification failed:', error);
        if (twostepError) {
            twostepError.textContent = error.message || 'Verification failed. Please try again.';
            twostepError.style.display = 'block';
        }
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Verify & Purchase';
    }
}

function handleCaptchaMessage(event) {
    
    if (event.origin.includes('arkoselabs.com') || event.origin.includes('funcaptcha.com')) {
        console.log('CAPTCHA message received:', event.data);

        if (event.data && (event.data.eventId === 'challenge-complete' || 
                          event.data.eventId === 'challenge-suppressed' ||
                          (typeof event.data === 'string' && event.data.includes('token')))) {
            
            window.removeEventListener('message', handleCaptchaMessage);
            retryCaptchaPurchase();
        }
    }
}

async function retryCaptchaPurchase() {
    if (!pendingChallengeData) {
        console.error('No pending challenge data');
        return;
    }
    
    const errorEl = document.getElementById('purchase-modal-error');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const captchaContainer = document.getElementById('purchase-captcha-container');
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    errorEl.style.display = 'none';
    
    try {
        const { challengeId, challengeMetadata, originalParams, collectibleItemId, captchaToken } = pendingChallengeData;

        const captchaId = challengeMetadata?.unifiedCaptchaId;

        const result = await window.roblox.purchaseCollectible(collectibleItemId, {
            ...originalParams,
            challengeId: challengeId,
            captchaToken: captchaToken,
            captchaId: captchaId
        });
        
        if (result?.requiresChallenge) {
            
            errorEl.textContent = 'Verification failed. Please try again.';
            errorEl.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Try Again';
        } else if (result?.purchased || result?.success) {
            
            captchaContainer.style.display = 'none';
            handlePurchaseSuccess();
        } else {
            throw new Error(result?.errorMessage || result?.purchaseResult || 'Purchase failed');
        }
        
    } catch (error) {
        console.error('Retry purchase failed:', error);
        errorEl.textContent = error.message || 'Purchase failed after verification. Please try again.';
        errorEl.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Try Again';
    }

    pendingChallengeData = null;
}

function handlePurchaseSuccess() {
    const successEl = document.getElementById('purchase-modal-success');
    const buttonsEl = document.getElementById('purchase-modal-buttons');
    const captchaContainer = document.getElementById('purchase-captcha-container');
    
    captchaContainer.style.display = 'none';
    successEl.textContent = 'Purchase successful! The item has been added to your inventory.';
    successEl.style.display = 'block';
    buttonsEl.style.display = 'none';

    if (window.refreshHeaderRobux) {
        window.refreshHeaderRobux();
    }

    const robuxPanel = document.getElementById('item-robux-panel');
    const ownedPanel = document.getElementById('item-owned-panel');
    if (robuxPanel) robuxPanel.style.display = 'none';
    if (ownedPanel) ownedPanel.style.display = 'block';

    setTimeout(() => closePurchaseModal(), 2000);
}

function handlePurchaseError(error, item) {
    const errorEl = document.getElementById('purchase-modal-error');
    const successEl = document.getElementById('purchase-modal-success');
    const buttonsEl = document.getElementById('purchase-modal-buttons');
    const confirmBtn = document.getElementById('purchase-confirm-btn');
    const cancelBtn = document.getElementById('purchase-cancel-btn');

    if (error.message && error.message.includes('Challenge is required')) {
        const itemId = item.id || item.assetId || item.itemTargetId;
        errorEl.innerHTML = 'Roblox requires verification. <a href="#" id="open-roblox-link" style="color:#00f;">Click here to complete purchase on Roblox website</a>';
        errorEl.style.display = 'block';
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
        
        document.getElementById('open-roblox-link').onclick = (e) => {
            e.preventDefault();
            if (window.roblox?.openExternal) {
                window.roblox.openExternal(`https://www.roblox.com/catalog/${itemId}`);
            } else {
                window.open(`https://www.roblox.com/catalog/${itemId}`, '_blank');
            }
            closePurchaseModal();
        };
    } else if (error.message && error.message.includes('InsufficientBalance')) {
        
        const price = item._resellerData?.price || item.price || item.priceInRobux || 0;
        errorEl.innerHTML = `
            <div style="text-align:center;">
                <div style="font-weight:bold; color:#c00; margin-bottom:8px;">You don't have enough Robux!</div>
                <div style="font-size:12px; color:#666; margin-bottom:10px;">This item costs R$ ${price.toLocaleString()}</div>
                <a href="#" id="buy-robux-link" class="Button" style="display:inline-block; padding:5px 15px;">Get Robux</a>
            </div>
        `;
        errorEl.style.display = 'block';
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
        
        document.getElementById('buy-robux-link').onclick = (e) => {
            e.preventDefault();
            if (window.roblox?.openExternal) {
                window.roblox.openExternal('https://www.roblox.com/upgrades/robux');
            } else {
                window.open('https://www.roblox.com/upgrades/robux', '_blank');
            }
        };
        return;
    } else if (error.message && error.message.includes('QuantityLimitExceeded')) {
        
        successEl.textContent = 'You already own this item!';
        successEl.style.display = 'block';
        buttonsEl.style.display = 'none';

        const robuxPanel = document.getElementById('item-robux-panel');
        const ownedPanel = document.getElementById('item-owned-panel');
        if (robuxPanel) robuxPanel.style.display = 'none';
        if (ownedPanel) ownedPanel.style.display = 'block';

        setTimeout(() => closePurchaseModal(), 2000);
        return; 
    } else if (error.message && error.message.includes('PriceChanged')) {
        
        errorEl.innerHTML = `
            <div style="text-align:center;">
                <div style="font-weight:bold; color:#c00; margin-bottom:8px;">Price has changed!</div>
                <div style="font-size:12px; color:#666;">The seller may have updated their price. Please refresh and try again.</div>
            </div>
        `;
        errorEl.style.display = 'block';
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
    } else if (error.message && error.message.includes('ItemNotForSale')) {
        
        errorEl.innerHTML = `
            <div style="text-align:center;">
                <div style="font-weight:bold; color:#c00; margin-bottom:8px;">Item no longer available</div>
                <div style="font-size:12px; color:#666;">This item may have been sold to someone else. Please refresh to see current listings.</div>
            </div>
        `;
        errorEl.style.display = 'block';
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';
    } else {
        errorEl.textContent = error.message || 'Purchase failed. Please try again.';
        errorEl.style.display = 'block';
    }
    
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Buy Now';
    confirmBtn.onclick = () => confirmPurchase();
}

async function purchaseFromReseller(collectibleItemId, collectibleProductId, collectibleItemInstanceId, sellerId, price, sellerName) {
    if (!window.roblox?.purchaseCollectible) {
        alert('Collectible purchase API not available');
        return;
    }

    if (!confirm(`Buy from ${sellerName} for R$ ${price.toLocaleString()}?`)) {
        return;
    }

    try {
        let purchaserId = null;
        if (window.roblox?.getCurrentUser) {
            const currentUser = await window.roblox.getCurrentUser();
            purchaserId = currentUser?.id;
        }

        if (!purchaserId) {
            alert('Must be logged in to purchase');
            return;
        }

        const result = await window.roblox.purchaseCollectible(collectibleItemId, {
            expectedPrice: price,
            expectedPurchaserId: purchaserId,
            expectedSellerId: sellerId,
            expectedSellerType: 'User',
            collectibleProductId: collectibleProductId,
            collectibleItemInstanceId: collectibleItemInstanceId || null 
        });

        if (result?.purchased) {
            alert('Purchase successful! The item has been added to your inventory.');
            
            if (window.refreshHeaderRobux) {
                window.refreshHeaderRobux();
            }
            
            const itemId = currentPurchaseItem?.id || currentPurchaseItem?.assetId;
            if (itemId) {
                window.loadCatalogItemPage(itemId, 'Asset');
            }
        } else {
            throw new Error(result?.errorMessage || result?.purchaseResult || 'Purchase failed');
        }
    } catch (error) {
        console.error('Reseller purchase failed:', error);

        if (error.message && error.message.includes('Challenge is required')) {
            const itemId = currentPurchaseItem?.id || currentPurchaseItem?.assetId;
            if (confirm('Roblox requires verification to complete this purchase. Would you like to open this item on the Roblox website to complete the purchase?')) {
                if (window.roblox?.openExternal) {
                    window.roblox.openExternal(`https://www.roblox.com/catalog/${itemId}`);
                } else {
                    window.open(`https://www.roblox.com/catalog/${itemId}`, '_blank');
                }
            }
        } else {
            alert('Purchase failed: ' + (error.message || 'Unknown error'));
        }
    }
}

window.loadCatalogItemPage = loadCatalogItemPage;
window.resetCatalogItemPage = resetCatalogItemPage;
window.showPurchaseConfirmation = showPurchaseConfirmation;
window.purchaseFromReseller = purchaseFromReseller;
