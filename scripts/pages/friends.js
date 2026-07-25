// Friends — faithful 2013 /My/EditFriends.aspx port.
// Structure from reference/roblonium-editfriends.aspx: tab-container (Friends/Friend Requests —
// "Best Friends" omitted, that concept doesn't exist in Roblox's current API), .friends-container
// grid of .friend-container tiles with a hover-revealed gear .dropdown (Remove Friend /
// Accept-Decline Friend Request). Data layer: getFriends/getUserPresence/getUserThumbnails
// (unchanged from the previous version) plus newly-wired acceptFriendRequest/
// declineFriendRequest/unfriend (added to roblox-api.js + preload this session — previously
// implemented in the backend but never exposed to the renderer).

(function() {
    'use strict';

    let currentUserId = null;
    let viewingOwnFriends = false;

    let allFriends = [];
    let friendsPage = 1;
    const FRIENDS_PER_PAGE = 28;
    // Roblox's friend-requests endpoint only accepts specific limit values (10/18/25/50/100) —
    // an arbitrary value like FRIENDS_PER_PAGE gets rejected with a 400, which is exactly what
    // surfaced as "Failed to load friend requests."
    const REQUESTS_PER_PAGE = 25;

    let requestsCursor = '';
    let requestsCursorHistory = [];
    let requestsItems = [];

    document.addEventListener('pageChange', function(e) {
        if (e.detail && e.detail.page === 'friends') {
            console.log('Friends page activated via SPA');
        }
    });

    window.FriendsPage = {
        load: loadFriendsFromHash
    };

    function loadFriendsFromHash() {
        const userId = getUserIdFromHash();
        if (userId) {
            currentUserId = userId;
            initTabs();
            loadFriends(userId);
        } else {
            showError('No user ID specified.');
        }
    }

    function getUserIdFromHash() {
        const hash = window.location.hash;
        if (hash.includes('?id=')) {
            const params = new URLSearchParams(hash.split('?')[1]);
            return params.get('id');
        }
        const match = hash.match(/friends\/(\d+)/);
        if (match) return match[1];
        return null;
    }

    function initTabs() {
        document.querySelectorAll('#page-friends .tab-container .tab').forEach(tab => {
            if (tab.dataset.bound) return;
            tab.dataset.bound = 'true';
            tab.addEventListener('click', () => {
                document.querySelectorAll('#page-friends .tab-container .tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#page-friends .tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.id)?.classList.add('active');

                if (tab.dataset.id === 'requests_tab' && requestsItems.length === 0) {
                    loadRequests();
                }
            });
        });

        document.getElementById('AcceptAllButton')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await bulkRequestAction('accept');
        });
        document.getElementById('DeclineAllButton')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await bulkRequestAction('decline');
        });
    }

    async function loadFriends(userId) {
        showLoading();

        try {
            const currentUser = await window.RobloxClient.api.getCurrentUser().catch(() => null);
            viewingOwnFriends = !!currentUser && String(currentUser.id) === String(userId);

            const [userInfo, friendsResult] = await Promise.all([
                window.roblox.getUserInfo(userId),
                window.roblox.getFriends(userId)
            ]);

            if (!userInfo) throw new Error('User not found');

            document.title = `${userInfo.displayName || userInfo.name}'s Friends - ROBLOX`;
            const headerEl = document.getElementById('FriendsPageHeader');
            if (headerEl) headerEl.textContent = viewingOwnFriends ? 'My Friends' : `${userInfo.displayName || userInfo.name}'s Friends`;

            allFriends = friendsResult.data || [];

            const requestsTab = document.querySelector('.tab[data-id="requests_tab"]');
            if (requestsTab) requestsTab.style.display = viewingOwnFriends ? '' : 'none';

            renderFriendsPage(1);
            showContent();

            if (viewingOwnFriends) {
                loadRequestCount();
            }
        } catch (error) {
            console.error('Failed to load friends:', error);
            showError('Failed to load friends list.');
        }
    }

    async function loadRequestCount() {
        try {
            const result = await window.roblox.getFriendRequestCount();
            const tab = document.querySelector('.tab[data-id="requests_tab"]');
            if (tab && result?.count) {
                tab.textContent = `Friend Requests (${result.count})`;
            }
        } catch (e) {
            console.warn('Failed to load friend request count:', e);
        }
    }

    // ---------- Friends tab ----------

    function renderFriendsPage(page) {
        friendsPage = page;
        const grid = document.getElementById('FriendsGrid');
        if (!grid) return;

        if (allFriends.length === 0) {
            grid.innerHTML = '<div class="no-content-message">This user has no friends. <a href="/browse.aspx" class="text-link">Find friends</a> on ROBLOX.</div>';
            renderPager('FriendsPager', 0, 1, renderFriendsPage);
            return;
        }

        const totalPages = Math.ceil(allFriends.length / FRIENDS_PER_PAGE);
        const startIndex = (page - 1) * FRIENDS_PER_PAGE;
        const pageFriends = allFriends.slice(startIndex, startIndex + FRIENDS_PER_PAGE);

        renderFriendTiles(grid, pageFriends, 'remove');
        renderPager('FriendsPager', page, totalPages, renderFriendsPage);
    }

    // ---------- Friend Requests tab ----------

    async function loadRequests(cursor = '', isGoingBack = false) {
        const grid = document.getElementById('RequestsGrid');
        if (!grid) return;

        grid.innerHTML = '<div class="no-content-message">Loading...</div>';

        try {
            const result = await window.roblox.getFriendRequests(REQUESTS_PER_PAGE, cursor);
            requestsItems = result?.data || [];
            requestsCursor = result?.nextPageCursor || '';

            if (requestsItems.length === 0 && !cursor) {
                grid.innerHTML = '<div class="no-content-message">You have no pending friend requests.</div>';
                renderPager('RequestsPager', 0, 1, () => {});
                return;
            }

            renderFriendTiles(grid, requestsItems, 'request');

            const prevBtn = document.getElementById('RequestsPrev');
            const nextBtn = document.getElementById('RequestsNext');
            renderPager('RequestsPager', 1, requestsCursor ? 2 : 1, null, {
                hasPrev: requestsCursorHistory.length > 0,
                hasNext: !!requestsCursor,
                onPrev: () => {
                    requestsCursorHistory.pop();
                    const prevCursor = requestsCursorHistory[requestsCursorHistory.length - 1] || '';
                    loadRequests(prevCursor, true);
                },
                onNext: () => {
                    requestsCursorHistory.push(cursor);
                    loadRequests(requestsCursor);
                }
            });
        } catch (error) {
            console.error('Failed to load friend requests:', error);
            grid.innerHTML = '<div class="no-content-message">Failed to load friend requests.</div>';
        }
    }

    async function bulkRequestAction(action) {
        if (requestsItems.length === 0) return;
        const ids = requestsItems.map(r => r.id || r.requesterId || r.senderId).filter(Boolean);

        for (const id of ids) {
            try {
                if (action === 'accept') {
                    await window.roblox.acceptFriendRequest(id);
                } else {
                    await window.roblox.declineFriendRequest(id);
                }
            } catch (e) {
                console.warn(`Failed to ${action} friend request from`, id, e);
            }
        }

        await loadRequests();
        loadRequestCount();
    }

    // ---------- shared tile renderer ----------

    async function renderFriendTiles(grid, people, mode) {
        grid.innerHTML = '';

        renderSkeletonTiles(grid, people.length);

        const ids = people.map(p => p.id || p.requesterId || p.senderId).filter(Boolean);

        // The friends/friend-requests list endpoints don't reliably include name/displayName on
        // their own — getUsersByIds is the real source of truth for that (same as the pre-port
        // version of this file relied on).
        const [userDetailsResult, thumbnailsResult, presenceResult] = await Promise.all([
            window.roblox.getUsersByIds(ids).catch(() => ({ data: [] })),
            window.roblox.getUserThumbnails(ids, '100x100', 'AvatarBust').catch(() => ({ data: [] })),
            mode === 'remove' ? window.roblox.getUserPresence(ids).catch(() => ({ userPresences: [] })) : Promise.resolve({ userPresences: [] })
        ]);

        const userDetails = {};
        (userDetailsResult?.data || []).forEach(u => { userDetails[u.id] = u; });

        const thumbnails = {};
        (thumbnailsResult?.data || []).forEach(t => { thumbnails[t.targetId] = t.imageUrl; });

        const presenceMap = {};
        (presenceResult?.userPresences || []).forEach(p => { presenceMap[p.userId] = p; });

        grid.innerHTML = '';

        people.forEach(person => {
            const id = person.id || person.requesterId || person.senderId;
            const details = userDetails[id];
            const name = details?.name || details?.displayName || person.name || person.displayName || 'Unknown';
            const thumb = thumbnails[id] || 'images/spinners/spinner100x100.gif';

            let statusIcon = 'images/offline.png';
            let statusText = `${name} is offline`;
            if (mode === 'remove') {
                const presence = presenceMap[id];
                const isOnline = presence && presence.userPresenceType > 0;
                statusIcon = isOnline ? 'images/online.png' : 'images/offline.png';
                statusText = isOnline ? `${name} is online` : `${name} is offline`;
            }

            const actionsHtml = mode === 'remove'
                ? `<li><a href="#" class="friend-action" data-action="remove" data-user-id="${id}">Remove Friend</a></li>`
                : `<li><a href="#" class="friend-action" data-action="accept" data-user-id="${id}">Accept Friend Request</a></li>
                   <li><a href="#" class="friend-action" data-action="decline" data-user-id="${id}">Decline Friend Request</a></li>`;

            const tile = document.createElement('div');
            tile.className = 'friend-container notranslate';
            tile.dataset.userId = id;
            tile.innerHTML = `
                <div class="friend-hover">
                    <div class="friend-dropdown">
                        <div class="dropdown">
                            <div class="button gear"></div>
                            <ul class="dropdown-list">
                                ${actionsHtml}
                            </ul>
                        </div>
                    </div>
                    <div class="friend-avatar roblox-avatar-image">
                        <a href="#profile?id=${id}" title="${escapeHtml(name)}">
                            <img src="${thumb}" width="100" height="100" border="0" alt="${escapeHtml(name)}" onerror="this.src='images/spinners/spinner100x100.gif'"/>
                        </a>
                    </div>
                </div>
                <div class="friend-name">
                    <img src="${statusIcon}" alt="${escapeHtml(statusText)}" title="${escapeHtml(statusText)}"/>
                    <a class="text-link" title="${escapeHtml(name)}" href="#profile?id=${id}">${escapeHtml(name)}</a>
                </div>
            `;
            grid.appendChild(tile);
        });

        wireTileInteractions(grid);
    }

    function renderSkeletonTiles(grid, count) {
        grid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const tile = document.createElement('div');
            tile.className = 'friend-container skeleton-friend';
            tile.innerHTML = '<div class="friend-avatar"></div><div class="friend-name">&nbsp;</div>';
            grid.appendChild(tile);
        }
    }

    function wireTileInteractions(grid) {
        grid.querySelectorAll('.dropdown .button.gear').forEach(gear => {
            gear.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = gear.closest('.dropdown');
                const wasOpen = dropdown.classList.contains('open');
                grid.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
                if (!wasOpen) dropdown.classList.add('open');
            });
        });

        grid.querySelectorAll('.friend-action').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const userId = link.dataset.action === 'remove' || link.dataset.action === 'accept' || link.dataset.action === 'decline'
                    ? link.dataset.userId
                    : null;
                const action = link.dataset.action;
                if (!userId) return;

                try {
                    if (action === 'remove') {
                        await window.roblox.unfriend(userId);
                        allFriends = allFriends.filter(f => String(f.id) != String(userId));
                        renderFriendsPage(friendsPage);
                    } else if (action === 'accept') {
                        await window.roblox.acceptFriendRequest(userId);
                        requestsItems = requestsItems.filter(r => String(r.id || r.requesterId) != String(userId));
                        renderFriendTiles(document.getElementById('RequestsGrid'), requestsItems, 'request');
                        loadRequestCount();
                    } else if (action === 'decline') {
                        await window.roblox.declineFriendRequest(userId);
                        requestsItems = requestsItems.filter(r => String(r.id || r.requesterId) != String(userId));
                        renderFriendTiles(document.getElementById('RequestsGrid'), requestsItems, 'request');
                        loadRequestCount();
                    }
                } catch (err) {
                    console.error(`Failed to ${action}:`, err);
                    alert(`Failed to ${action.replace('-', ' ')}. Please try again.`);
                }
            });
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('#page-friends .dropdown.open').forEach(d => d.classList.remove('open'));
    });

    // ---------- pager (silver arrow sprite, established sitewide pattern) ----------

    function renderPager(containerId, currentPage, totalPages, goToPage, custom) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (totalPages <= 1 && !custom) {
            container.innerHTML = '';
            return;
        }

        const hasPrev = custom ? custom.hasPrev : currentPage > 1;
        const hasNext = custom ? custom.hasNext : currentPage < totalPages;

        container.innerHTML = `
            <a id="${containerId}Prev" href="javascript:void(0)"><span class="pager previous${hasPrev ? '' : ' disabled'}"></span></a>
            <span class="pageInfo">Page ${currentPage}${totalPages > 1 && !custom ? ' of ' + totalPages : ''}</span>
            <a id="${containerId}Next" href="javascript:void(0)"><span class="pager next${hasNext ? '' : ' disabled'}"></span></a>
        `;

        document.getElementById(`${containerId}Prev`)?.addEventListener('click', () => {
            if (!hasPrev) return;
            if (custom) custom.onPrev();
            else goToPage(currentPage - 1);
        });
        document.getElementById(`${containerId}Next`)?.addEventListener('click', () => {
            if (!hasNext) return;
            if (custom) custom.onNext();
            else goToPage(currentPage + 1);
        });
    }

    // ---------- page state ----------

    function showLoading() {
        document.getElementById('FriendsLoading').style.display = 'block';
        document.getElementById('FriendsError').style.display = 'none';
        document.getElementById('FriendsContent').style.display = 'none';
    }

    function showContent() {
        document.getElementById('FriendsLoading').style.display = 'none';
        document.getElementById('FriendsError').style.display = 'none';
        document.getElementById('FriendsContent').style.display = 'block';
    }

    function showError(message) {
        if (window.showErrorPage) {
            window.showErrorPage(message, 'friends-content');
        } else {
            document.getElementById('FriendsLoading').style.display = 'none';
            const errorEl = document.getElementById('FriendsError');
            errorEl.style.display = 'block';
            errorEl.querySelector('p').textContent = message;
            document.getElementById('FriendsContent').style.display = 'none';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
})();
