/**
 * 2013 My ROBLOX (Home) Page Script
 * Handles loading user data, friends, feed, and games
 */

(function () {
    'use strict';

    document.addEventListener('pageChange', function (e) {
        if (e.detail && e.detail.page === 'myroblox') {
            loadMyRobloxPage();
        }
    });

    async function loadMyRobloxPage() {
        try {
            const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
            if (!isLoggedIn) {
                navigateTo('home');
                return;
            }

            const user = await window.RobloxClient.api.getCurrentUser();
            if (!user) {
                navigateTo('home');
                return;
            }

            // Update greeting
            const usernameEl = document.getElementById('myroblox-username');
            if (usernameEl) {
                usernameEl.textContent = user.displayName || user.name;
            }

            // Load all sections in parallel
            loadMyAvatar(user.id);
            loadMyStats(user.id);
            loadNotificationsCount();
            loadBestFriends(user.id);
            loadRobloxNews();
            loadRecentlyPlayedGames();
            loadRecommendedGames();
            loadMyFeed();

        } catch (error) {
            console.error('Failed to load My ROBLOX page:', error);
            if (window.showErrorPage) {
                window.showErrorPage('Failed to load My ROBLOX page: ' + error.message, 'myroblox-content');
            }
        }
    }

    async function loadMyAvatar(userId) {
        const avatarImg = document.getElementById('myroblox-avatar-img');
        if (!avatarImg) return;

        try {
            const thumbnails = await window.roblox.getUserThumbnails([userId], '150x150', 'AvatarThumbnail');
            if (thumbnails?.data && thumbnails.data[0]?.imageUrl) {
                avatarImg.src = thumbnails.data[0].imageUrl;
            }

            // Add OBC/Premium overlay if applicable
            const avatarHolder = document.getElementById('UserAvatar');
            if (avatarHolder && window.addObcOverlayIfPremium) {
                await window.addObcOverlayIfPremium(avatarHolder, userId, { bottom: '5px', left: '5px' });
            }
        } catch (e) {
            console.error('Failed to load avatar:', e);
        }
    }

    async function loadMyStats(userId) {
        try {
            // Friends count
            const friendsCount = await window.roblox.getFriendsCount(userId).catch(() => ({ count: 0 }));
            const friendsEl = document.getElementById('myroblox-friends-count');
            if (friendsEl) {
                friendsEl.textContent = friendsCount.count || 0;
            }

            // Messages count
            const messagesEl = document.getElementById('myroblox-messages-count');
            if (messagesEl) {
                try {
                    const unreadCount = await window.roblox.getUnreadMessagesCount();
                    messagesEl.textContent = unreadCount.count || 0;
                } catch (e) {
                    messagesEl.textContent = '0';
                }
            }

            // Robux
            const robuxEl = document.getElementById('myroblox-robux-count');
            if (robuxEl) {
                try {
                    const currency = await window.roblox.getUserCurrency(userId);
                    robuxEl.textContent = (currency.robux || 0).toLocaleString();
                } catch (e) {
                    robuxEl.textContent = '0';
                }
            }

            // Rovloo Score
            const rovlooScoreEl = document.getElementById('myroblox-rovloo-score');
            if (rovlooScoreEl) {
                try {
                    const rating = await window.roblox.reviews.getUserRating(userId);
                    const score = rating?.totalScore || 0;
                    const scoreText = score >= 0 ? `+${score}` : score.toString();
                    rovlooScoreEl.textContent = scoreText;
                    rovlooScoreEl.title = `Rovloo Score: ${scoreText} (${rating?.reviewCount || 0} reviews)`;
                } catch (e) {
                    rovlooScoreEl.textContent = '0';
                }
            }

        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    }

    async function loadNotificationsCount() {
        const notificationsEl = document.getElementById('myroblox-notifications-count');
        if (!notificationsEl) return;

        try {
            const result = await window.roblox.getUnreadNotificationsCount();
            notificationsEl.textContent = result.unreadNotifications || 0;
        } catch (e) {
            console.warn('Failed to load notifications count:', e);
            notificationsEl.textContent = '0';
        }
    }

    async function loadBestFriends(userId) {
        const container = document.getElementById('myroblox-best-friends');
        if (!container) return;

        try {
            // Get friends list (limited to 3 for display)
            const friendsResult = await window.roblox.getFriends(userId, 3);
            const friends = friendsResult?.data || [];

            if (friends.length === 0) {
                container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 5px;">No friends yet. Add some friends!</div>';
                return;
            }

            // Get thumbnails for friends
            const friendIds = friends.map(f => f.id);
            let thumbnailMap = {};
            try {
                const thumbnails = await window.roblox.getUserThumbnails(friendIds, '48x48', 'AvatarHeadShot');
                if (thumbnails?.data) {
                    thumbnails.data.forEach(t => {
                        if (t.targetId && t.imageUrl) {
                            thumbnailMap[t.targetId] = t.imageUrl;
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to load friend thumbnails:', e);
            }

            // Get presence info
            let presenceMap = {};
            try {
                const presence = await window.roblox.getUsersPresence(friendIds);
                if (presence?.userPresences) {
                    presence.userPresences.forEach(p => {
                        presenceMap[p.userId] = p;
                    });
                }
            } catch (e) {
                console.warn('Failed to load friend presence:', e);
            }

            let html = '';
            for (const friend of friends) {
                const thumbnail = thumbnailMap[friend.id] || 'images/spinners/spinner100x100.gif';
                const presence = presenceMap[friend.id];
                const isOnline = presence?.userPresenceType > 0;
                const statusIcon = isOnline
                    ? 'images/Icons/online.png'
                    : 'images/Icons/offline.png';
                const statusTitle = isOnline ? 'Online' : 'Offline';

                html += `
                    <div class="user">
                        <div class="roblox-avatar-image">
                            <a href="#profile?id=${friend.id}">
                                <img src="${thumbnail}" alt="${escapeHtml(friend.name)}" title="${escapeHtml(friend.name)}"/>
                            </a>
                        </div>
                        <div class="info">
                            <img src="${statusIcon}" title="${statusTitle}" alt="${statusTitle}"/>
                            <a class="name" href="#profile?id=${friend.id}">${escapeHtml(friend.displayName || friend.name)}</a>
                        </div>
                        <div class="clear"></div>
                    </div>
                `;
            }

            container.innerHTML = html;

        } catch (e) {
            console.error('Failed to load best friends:', e);
            container.innerHTML = '<div style="color: #c00; font-size: 11px;">Failed to load friends</div>';
        }
    }

    async function loadRobloxNews() {
        const container = document.getElementById('myroblox-news');
        if (!container) return;

        // Static news items (in a real app, this would fetch from an API)
        const newsItems = [
            { title: 'Welcome to Rovloo!', url: '#' },
            { title: 'Check out the latest games', url: '#games' },
            { title: 'Visit the Catalog for new items', url: '#catalog' }
        ];

        let html = '';
        for (const item of newsItems) {
            html += `
                <div class="roblox-news-feed-item">
                    <a href="${item.url}">${escapeHtml(item.title)}</a>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // Cache for recommended games
    const RECOMMENDED_GAMES_CACHE_KEY = 'rovloo_recommended_games_cache';
    const RECOMMENDED_GAMES_CACHE_TTL = 5 * 60 * 1000;
    let recommendedGamesRateLimited = false;
    let recommendedGamesRateLimitResetTime = 0;

    function getRecommendedGamesCache() {
        try {
            const cached = localStorage.getItem(RECOMMENDED_GAMES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.timestamp && (Date.now() - parsed.timestamp < RECOMMENDED_GAMES_CACHE_TTL)) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to read recommended games cache:', e);
        }
        return null;
    }

    function setRecommendedGamesCache(data) {
        try {
            localStorage.setItem(RECOMMENDED_GAMES_CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save recommended games cache:', e);
        }
    }

    async function loadRecommendedGames() {
        const container = document.getElementById('myroblox-recommended-games');
        if (!container) return;

        // Check cache first
        const cachedGames = getRecommendedGamesCache();
        if (cachedGames && cachedGames.length > 0) {
            renderRecommendedGames(container, cachedGames);
            return;
        }

        try {
            let universeIds = [];

            if (window.roblox?.getOmniRecommendations) {
                const recommendationsData = await window.roblox.getOmniRecommendations('Home');
                if (recommendationsData?.sorts && recommendationsData.sorts.length > 0) {
                    for (const sort of recommendationsData.sorts) {
                        if (sort.recommendationList && sort.recommendationList.length > 0) {
                            const sortUniverseIds = sort.recommendationList
                                .filter(rec => rec.contentType === 'Game' && rec.contentId)
                                .map(rec => rec.contentId)
                                .slice(0, 6);
                            universeIds.push(...sortUniverseIds);
                        }
                    }
                }
            }

            const uniqueUniverseIds = [...new Set(universeIds)].slice(0, 4);

            if (uniqueUniverseIds.length === 0) {
                container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">No recommendations available.</div>';
                return;
            }

            // Get game details
            let gamesInfo = [];
            if (window.roblox?.getGamesProductInfo) {
                const result = await window.roblox.getGamesProductInfo(uniqueUniverseIds);
                if (result?.data) {
                    gamesInfo = result.data;
                }
            }

            // Get thumbnails
            let thumbnailMap = {};
            if (window.roblox?.getUniverseThumbnails) {
                const thumbResult = await window.roblox.getUniverseThumbnails(uniqueUniverseIds, '768x432');
                if (thumbResult?.data) {
                    thumbResult.data.forEach(item => {
                        if (item.thumbnails && item.thumbnails.length > 0 && item.universeId) {
                            thumbnailMap[item.universeId] = item.thumbnails[0].imageUrl;
                        }
                    });
                }
            }

            const processedGames = gamesInfo.map(game => ({
                universeId: game.id,
                placeId: game.rootPlaceId,
                name: game.name,
                playing: game.playing,
                thumbnail: thumbnailMap[game.id] || null
            }));

            setRecommendedGamesCache(processedGames);
            renderRecommendedGames(container, processedGames);

        } catch (error) {
            console.error('Failed to load recommended games:', error);
            container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">Failed to load recommendations.</div>';
        }
    }

    function renderRecommendedGames(container, gamesData) {
        if (!container || !gamesData || gamesData.length === 0) {
            container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">No recommendations available.</div>';
            return;
        }

        let html = '';
        for (const game of gamesData) {
            const thumbnail = game.thumbnail || 'images/spinners/spinner100x100.gif';
            html += `
                <div class="recent-place-container">
                    <div class="recent-place-thumb">
                        <a href="#game-detail?id=${game.placeId}&universe=${game.universeId}">
                            <img src="${thumbnail}" alt="${escapeHtml(game.name)}" class="recent-place-thumb-img"/>
                        </a>
                    </div>
                    <div class="recent-place-Info">
                        <div class="recent-place-name">
                            <a href="#game-detail?id=${game.placeId}&universe=${game.universeId}">${escapeHtml(game.name)}</a>
                        </div>
                        <div class="recent-place-players-online">${(game.playing || 0).toLocaleString()} playing</div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    async function loadRecentlyPlayedGames() {
        const container = document.getElementById('myroblox-recently-played');
        if (!container) return;

        try {
            const playtimeData = await window.PlaytimeTracker.getAllPlaytime();

            if (!playtimeData || Object.keys(playtimeData).length === 0) {
                container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">No recently played games.</div>';
                return;
            }

            const sortedGames = Object.entries(playtimeData)
                .filter(([placeId, data]) => data && data.totalMinutes > 0)
                .sort((a, b) => (b[1].lastPlayed || 0) - (a[1].lastPlayed || 0))
                .slice(0, 5);

            if (sortedGames.length === 0) {
                container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">No recently played games.</div>';
                return;
            }

            const placeIds = sortedGames.map(([placeId]) => parseInt(placeId));

            // Get place details
            const placeDetailsResults = [];
            for (const placeId of placeIds) {
                try {
                    const result = await window.roblox.getPlaceDetails([placeId]);
                    if (result && result[0]) {
                        placeDetailsResults.push(result[0]);
                    }
                } catch (e) {
                    console.warn(`Failed to get details for place ${placeId}:`, e);
                }
            }

            if (placeDetailsResults.length === 0) {
                container.innerHTML = '<div style="color: #666; font-size: 11px; padding: 10px;">No game details available.</div>';
                return;
            }

            // Get game details
            const universeIds = placeDetailsResults.map(p => p.universeId).filter(Boolean);
            let gamesInfo = [];
            if (universeIds.length > 0) {
                const gameDetailsResult = await window.roblox.getGameDetails(universeIds);
                if (gameDetailsResult?.data) {
                    gamesInfo = gameDetailsResult.data.map(gameData => {
                        const placeData = placeDetailsResults.find(p => p.universeId === gameData.id);
                        return {
                            placeId: placeData?.placeId,
                            universeId: gameData.id,
                            name: gameData.name,
                            playing: gameData.playing || 0
                        };
                    });
                }
            }

            // Get thumbnails
            let thumbnailMap = {};
            if (universeIds.length > 0 && window.roblox?.getUniverseThumbnails) {
                try {
                    const thumbResult = await window.roblox.getUniverseThumbnails(universeIds, '768x432');
                    if (thumbResult?.data) {
                        thumbResult.data.forEach(item => {
                            if (item.thumbnails && item.thumbnails.length > 0 && item.universeId) {
                                thumbnailMap[item.universeId] = item.thumbnails[0].imageUrl;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Failed to fetch thumbnails:', e);
                }
            }

            // Render
            let html = '';
            for (const game of gamesInfo) {
                const playtimeInfo = playtimeData[game.placeId];
                const thumbnail = thumbnailMap[game.universeId] || 'images/spinners/spinner100x100.gif';
                const playtime = playtimeInfo ? window.PlaytimeTracker.formatPlaytimeMinutes(playtimeInfo.totalMinutes) : '< 1m';

                html += `
                    <div class="recent-place-container">
                        <div class="recent-place-thumb">
                            <a href="#game-detail?id=${game.placeId}&universe=${game.universeId}">
                                <img src="${thumbnail}" alt="${escapeHtml(game.name)}" class="recent-place-thumb-img"/>
                            </a>
                        </div>
                        <div class="recent-place-Info">
                            <div class="recent-place-name">
                                <a href="#game-detail?id=${game.placeId}&universe=${game.universeId}">${escapeHtml(game.name)}</a>
                            </div>
                            <div class="recent-place-players-online">${game.playing.toLocaleString()} playing</div>
                            <div class="recent-place-playtime">Played: ${playtime}</div>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;

        } catch (error) {
            console.error('Failed to load recently played games:', error);
            container.innerHTML = '<div style="color: #c00; font-size: 11px; padding: 10px;">Failed to load games.</div>';
        }
    }

    async function loadMyFeed() {
        const feedEl = document.getElementById('myroblox-feed');
        if (!feedEl) return;

        try {
            // Get group shouts
            let groupShoutNotifications = [];
            try {
                const shouts = await window.roblox.groupShouts.getRecent();
                groupShoutNotifications = shouts
                    .filter(shout => shout.isNew || !shout.interacted)
                    .slice(0, 10)
                    .map(shout => ({
                        type: 'groupShout',
                        groupId: shout.groupId,
                        groupName: shout.groupName,
                        shoutBody: shout.body,
                        shoutPoster: shout.poster?.username || 'Unknown',
                        shoutDate: shout.updated,
                        isNew: shout.isNew
                    }));
            } catch (e) {
                console.warn('Failed to get group shouts:', e);
            }

            // Get Roblox notifications
            const notifications = await window.roblox.getRecentNotifications();

            // Get Rovloo notifications
            let rovlooNotifications = [];
            try {
                const rovlooResult = await window.roblox.reviews.getNotifications({ includeRead: false, limit: 20 });
                rovlooNotifications = rovlooResult?.notifications || [];
            } catch (e) {
                console.log('Could not load Rovloo notifications:', e.message);
            }

            // Get group thumbnails
            let groupThumbnailMap = {};
            if (groupShoutNotifications.length > 0) {
                const groupIds = groupShoutNotifications.map(n => n.groupId);
                try {
                    const groupThumbs = await window.roblox.getGroupThumbnails(groupIds, '150x150');
                    if (groupThumbs?.data) {
                        groupThumbs.data.forEach(t => {
                            if (t.targetId && t.imageUrl) {
                                groupThumbnailMap[t.targetId] = t.imageUrl;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Failed to fetch group thumbnails:', e);
                }
            }

            // Collect all feed items
            const allFeedItems = [];

            for (const shoutNotif of groupShoutNotifications) {
                allFeedItems.push({
                    type: 'groupShout',
                    timestamp: shoutNotif.shoutDate ? new Date(shoutNotif.shoutDate).getTime() : Date.now(),
                    data: shoutNotif,
                    thumbnail: groupThumbnailMap[shoutNotif.groupId] || 'images/spinners/spinner100x100.gif'
                });
            }

            for (const rovlooNotif of rovlooNotifications) {
                allFeedItems.push({
                    type: 'rovloo',
                    timestamp: rovlooNotif.timestamp || Date.now(),
                    data: rovlooNotif
                });
            }

            // Get user thumbnails for Roblox notifications
            let userThumbnailMap = {};
            if (notifications && notifications.length > 0) {
                const userIds = [];
                for (const notification of notifications) {
                    try {
                        const thumbnail = notification.content?.states?.default?.visualItems?.thumbnail;
                        if (thumbnail && thumbnail[0]?.idType === 'userThumbnail' && thumbnail[0]?.id) {
                            userIds.push(parseInt(thumbnail[0].id));
                        }
                    } catch (e) {}
                }

                if (userIds.length > 0) {
                    try {
                        const thumbnails = await window.roblox.getUserThumbnails(userIds, '48x48', 'AvatarHeadShot');
                        if (thumbnails?.data) {
                            thumbnails.data.forEach(t => {
                                if (t.targetId && t.imageUrl) {
                                    userThumbnailMap[t.targetId] = t.imageUrl;
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to fetch notification thumbnails:', e);
                    }
                }

                for (const notification of notifications) {
                    allFeedItems.push({
                        type: 'roblox',
                        timestamp: notification.eventDate ? new Date(notification.eventDate).getTime() : Date.now(),
                        data: notification,
                        thumbnailMap: userThumbnailMap
                    });
                }
            }

            // Sort by timestamp
            allFeedItems.sort((a, b) => b.timestamp - a.timestamp);

            // Render feed
            if (allFeedItems.length === 0) {
                feedEl.innerHTML = '<div style="color: #666; padding: 10px;">Your feed is empty. Play some games or add friends to see activity here!</div>';
                return;
            }

            let feedHtml = '';
            for (const item of allFeedItems) {
                const date = new Date(item.timestamp).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                });

                if (item.type === 'groupShout') {
                    const shout = item.data;
                    feedHtml += `
                        <div class="feed-item feed-item-shout">
                            <div class="feed-image-container">
                                <a href="#groups?groupId=${shout.groupId}">
                                    <img src="${item.thumbnail}" alt="${escapeHtml(shout.groupName)}"/>
                                </a>
                            </div>
                            <div class="feed-text-container">
                                <div><a href="#groups?groupId=${shout.groupId}"><b>${escapeHtml(shout.groupName)}</b></a> posted a new shout:</div>
                                <div class="Feedtext">"${escapeHtml(shout.shoutBody)}"</div>
                                <div style="color: #999; font-size: 11px; margin-top: 4px;">- ${escapeHtml(shout.shoutPoster)} • ${date}</div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'rovloo') {
                    const notif = item.data;
                    feedHtml += `
                        <div class="feed-item feed-item-rovloo">
                            <div class="feed-image-container">
                                <img src="images/rovloo/rovloo-ico64.png" alt="Rovloo" style="width: 32px; height: 32px; margin: 8px;"/>
                            </div>
                            <div class="feed-text-container">
                                <div><b style="color: #666;">Rovloo</b></div>
                                <div>${escapeHtml(notif.message)}</div>
                                <div style="color: #999; font-size: 11px; margin-top: 4px;">${date}</div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'roblox') {
                    const notif = item.data;
                    let avatarHtml = '';
                    try {
                        const thumb = notif.content?.states?.default?.visualItems?.thumbnail;
                        if (thumb && thumb[0]?.idType === 'userThumbnail' && thumb[0]?.id) {
                            const avatarUrl = item.thumbnailMap[thumb[0].id];
                            if (avatarUrl) {
                                avatarHtml = `<img src="${avatarUrl}" alt=""/>`;
                            }
                        }
                    } catch (e) {}

                    let message = '';
                    try {
                        const textBody = notif.content?.states?.default?.visualItems?.textBody;
                        if (textBody && textBody[0]?.label?.text) {
                            message = textBody[0].label.text.replace(/Connection request/gi, 'Friend request');
                        }
                    } catch (e) {}

                    if (!message) {
                        message = notif.content?.notificationType || notif.notificationSourceType || 'New notification';
                    }

                    feedHtml += `
                        <div class="feed-item">
                            <div class="feed-image-container">${avatarHtml}</div>
                            <div class="feed-text-container">
                                <div>${message}</div>
                                <div style="color: #999; font-size: 11px; margin-top: 4px;">${date}</div>
                            </div>
                        </div>
                    `;
                }
            }

            feedEl.innerHTML = feedHtml;

        } catch (e) {
            console.error('Failed to load feed:', e);
            feedEl.innerHTML = '<div style="color: #666; padding: 10px;">Your feed is empty. Play some games or add friends to see activity here!</div>';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function resetMyRobloxPage() {
        const containers = [
            'myroblox-avatar-img',
            'myroblox-feed',
            'myroblox-best-friends',
            'myroblox-recently-played',
            'myroblox-recommended-games'
        ];

        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'myroblox-avatar-img') {
                    el.src = 'images/spinners/spinner100x100.gif';
                } else {
                    el.innerHTML = '';
                }
            }
        });
    }

    window.MyRobloxPage = {
        load: loadMyRobloxPage,
        reset: resetMyRobloxPage
    };

})();
