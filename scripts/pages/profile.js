

(function() {
    'use strict';

    let currentUserId = null;
    let isInitialized = false;

    document.addEventListener('DOMContentLoaded', function() {

        const isStandalonePage = window.location.pathname.includes('profile.html');
        if (isStandalonePage && document.getElementById('ProfileLoading')) {
            init();
        }
    });

    document.addEventListener('pageChange', function(e) {
        if (e.detail && e.detail.page === 'profile') {
            
            console.log('Profile page activated via SPA');
        }
    });

    window.ProfilePage = {
        load: loadProfileFromHash,
        loadUser: loadProfile
    };

    function init() {
        if (isInitialized) return;
        isInitialized = true;
        
        console.log('Profile page initialized');
        loadProfileFromHash();
    }

    function loadProfileFromHash() {
        const userId = getUserIdFromHash();
        if (userId) {
            currentUserId = userId;
            loadProfile(userId);
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
        
        const match = hash.match(/profile\/(\d+)/);
        if (match) return match[1];
        return null;
    }

    async function loadProfile(userId) {
        
        if (!document.getElementById('ProfileLoading')) {
            console.log('Profile page elements not found - not on profile page');
            return;
        }

        showLoading();

        try {
            // One aggregated IPC call — the main process fans out (with its
            // caches and keep-alive connections) instead of the page awaiting
            // a dozen round-trips in sequence.
            if (typeof window.roblox.getProfileBundle === 'function') {
                const bundle = await window.roblox.getProfileBundle(userId);
                if (!bundle || !bundle.user) {
                    throw new Error('User not found');
                }

                document.title = `${bundle.user.displayName || bundle.user.name} - ROBLOX`;

                await renderProfile(bundle.user, {
                    friendsCount: bundle.friendsCount,
                    followersCount: bundle.followersCount,
                    followingCount: bundle.followingCount,
                    presence: bundle.presence,
                    friends: bundle.friends,
                    games: bundle.games,
                    avatarUrl: bundle.avatarUrl,
                    friendThumbnails: bundle.friendThumbnails,
                    gameThumbnails: bundle.gameThumbnails,
                    hasPremium: bundle.hasPremium
                });

                showContent();
                return;
            }

            // Legacy path for older app builds without the bundle channel
            const userInfo = await window.roblox.getUserInfo(userId);
            if (!userInfo) {
                throw new Error('User not found');
            }

            document.title = `${userInfo.displayName || userInfo.name} - ROBLOX`;

            const [
                friendsCount,
                followersCount,
                followingCount,
                presence,
                friends,
                games
            ] = await Promise.all([
                window.roblox.getFriendsCount(userId).catch(() => ({ count: 0 })),
                window.roblox.getFollowersCount(userId).catch(() => ({ count: 0 })),
                window.roblox.getFollowingCount(userId).catch(() => ({ count: 0 })),
                window.roblox.getUserPresence([userId]).catch(() => ({ userPresences: [] })),
                window.roblox.getFriends(userId).catch(() => ({ data: [] })),
                window.roblox.getUserGames(userId).catch(() => ({ data: [] }))
            ]);

            await renderProfile(userInfo, {
                friendsCount: friendsCount.count || 0,
                followersCount: followersCount.count || 0,
                followingCount: followingCount.count || 0,
                presence: presence.userPresences?.[0] || null,
                friends: friends.data || [],
                games: games.data || []
            });

            showContent();
        } catch (error) {
            console.error('Failed to load profile:', error);
            showError('Failed to load user profile. The user may not exist.');
        }
    }

    async function renderProfile(user, data) {
        
        const headerEl = document.getElementById('ProfileHeader');
        if (headerEl) headerEl.textContent = `${user.displayName || user.name}'s Profile`;

        const statusEl = document.getElementById('UserOnlineStatus');
        if (statusEl && data.presence) {
            const isOnline = data.presence.userPresenceType > 0;
            statusEl.textContent = isOnline ? '[ Online ]' : '[ Offline ]';
            statusEl.className = isOnline ? 'UserOnlineMessage' : 'UserOfflineMessage';
            // color comes from the authentic .UserOnlineMessage/.UserOfflineMessage classes
        }

        const urlEl = document.getElementById('UserProfileURL');
        if (urlEl) {
            urlEl.textContent = `https://www.roblox.com/users/${user.id}/profile`;
            urlEl.href = `https://www.roblox.com/users/${user.id}/profile`;
        }

        const avatarEl = document.getElementById('AvatarImage');
        if (data.avatarUrl !== undefined) {
            // Bundle path: avatar URL is already fetched
            if (avatarEl && data.avatarUrl) {
                avatarEl.src = data.avatarUrl;
            }
        } else {
            try {
                const thumbResult = await window.roblox.getUserThumbnails([user.id], '150x200', 'AvatarBust');
                if (avatarEl && thumbResult?.data?.[0]?.imageUrl) {
                    avatarEl.src = thumbResult.data[0].imageUrl;
                }
            } catch (e) {
                console.warn('Failed to load avatar:', e);
            }
        }

        const avatarContainer = document.getElementById('AvatarImageLink');
        if (avatarContainer) {
            const existingOverlay = avatarContainer.querySelector('.obc-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            if (data.hasPremium !== undefined) {
                // Bundle path: premium status came with the bundle
                if (data.hasPremium === true) {
                    applyPremiumOverlay(avatarContainer, user);
                }
            } else if (window.RobloxClient && window.RobloxClient.auth) {
                // Legacy path — cosmetic, so it must never block content:
                // resolve the overlay after the page is already showing.
                (async () => {
                    try {
                        const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
                        if (!isLoggedIn) return;
                        const hasPremium = await window.roblox.validatePremiumMembership(user.id);
                        if (hasPremium === true) {
                            applyPremiumOverlay(avatarContainer, user);
                        }
                    } catch (e) {
                        console.debug('Could not verify premium status (requires login)');
                    }
                })();
            }
        }

        const blurbEl = document.getElementById('UserBlurb');
        if (blurbEl) {
            if (user.description && user.description.trim()) {
                blurbEl.innerHTML = window.formatDescription ? window.formatDescription(user.description) : escapeHtml(user.description);
                blurbEl.style.fontStyle = 'normal';
                blurbEl.style.color = '';
            } else {
                blurbEl.textContent = 'No description available.';
                blurbEl.style.fontStyle = 'italic';
                blurbEl.style.color = '#666';
            }
        }

        const friendsCountEl = document.getElementById('FriendsCount');
        const followersCountEl = document.getElementById('FollowersCount');
        const followingCountEl = document.getElementById('FollowingCount');
        const joinDateEl = document.getElementById('JoinDate');

        if (friendsCountEl) friendsCountEl.textContent = formatNumber(data.friendsCount);
        if (followersCountEl) followersCountEl.textContent = formatNumber(data.followersCount);
        if (followingCountEl) followingCountEl.textContent = formatNumber(data.followingCount);

        if (joinDateEl && user.created) {
            const joinDate = new Date(user.created);
            joinDateEl.textContent = joinDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        await Promise.all([
            renderFriends(data.friends.slice(0, 6), data.friendThumbnails),
            renderGames(data.games.slice(0, 6), data.gameThumbnails)
        ]);
    }

    function applyPremiumOverlay(avatarContainer, user) {
        console.log('Premium user detected:', user.name);

        const bcType = window.isRandomizeBCEnabled && window.isRandomizeBCEnabled()
            ? window.getBCTypeForUser(user.id)
            : 'OBC';
        const overlayImage = window.getBCOverlayImage
            ? window.getBCOverlayImage(bcType)
            : 'images/icons/overlay_obcOnly.png';

        const overlay = document.createElement('img');
        overlay.src = overlayImage;
        overlay.alt = bcType;
        overlay.className = 'obc-overlay';
        overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; height: auto; pointer-events: none;';
        avatarContainer.appendChild(overlay);
    }

    async function renderFriends(friends, prefetchedThumbs) {
        const container = document.getElementById('FriendsList');
        const noFriendsEl = document.getElementById('NoFriends');

        if (!container) return;

        if (!friends || friends.length === 0) {
            if (noFriendsEl) noFriendsEl.style.display = 'block';
            return;
        }

        if (noFriendsEl) noFriendsEl.style.display = 'none';
        container.innerHTML = '';

        let thumbnails = {};
        if (prefetchedThumbs) {
            prefetchedThumbs.forEach(t => {
                thumbnails[t.targetId] = t.imageUrl;
            });
        } else {
            const friendIds = friends.map(f => f.id);
            try {
                const thumbResult = await window.roblox.getUserThumbnails(friendIds, '75x75', 'Headshot');
                if (thumbResult?.data) {
                    thumbResult.data.forEach(t => {
                        thumbnails[t.targetId] = t.imageUrl;
                    });
                }
            } catch (e) {
                console.warn('Failed to load friend thumbnails:', e);
            }
        }

        friends.forEach(friend => {
            const div = document.createElement('div');
            div.style.cssText = 'display: inline-block; width: 75px; margin: 0; text-align: center; vertical-align: top;';
            
            const thumb = thumbnails[friend.id] || '../assets/ui/guest.png';
            
            div.innerHTML = `
                <a href="#profile?id=${friend.id}" style="cursor: pointer;">
                    <img src="${thumb}" alt="${escapeHtml(friend.name)}" 
                         style="width: 60px; height: 60px; border: 1px solid #ccc;"
                         onerror="this.src='../assets/ui/guest.png'"/>
                </a>
                <div style="font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                    <a href="#profile?id=${friend.id}">${escapeHtml(friend.name)}</a>
                </div>
            `;
            container.appendChild(div);
        });
    }

    async function renderGames(games, prefetchedThumbs) {
        const container = document.getElementById('PlacesList');
        const noPlacesEl = document.getElementById('NoPlaces');

        if (!container) return;

        if (!games || games.length === 0) {
            if (noPlacesEl) noPlacesEl.style.display = 'block';
            return;
        }

        if (noPlacesEl) noPlacesEl.style.display = 'none';
        container.innerHTML = '';

        let thumbnails = {};
        if (prefetchedThumbs) {
            prefetchedThumbs.forEach(t => {
                thumbnails[t.targetId] = t.imageUrl;
            });
        } else {
            const gameIds = games.map(g => g.id);
            try {
                // 480x270 — the thumbnails API rejects 420x230 as invalid
                const thumbResult = await window.roblox.getGameThumbnails(gameIds, '480x270');
                if (thumbResult?.data) {
                    thumbResult.data.forEach(t => {
                        thumbnails[t.targetId] = t.imageUrl;
                    });
                }
            } catch (e) {
                console.warn('Failed to load game thumbnails:', e);
            }
        }

        games.forEach(game => {
            const div = document.createElement('div');
            div.className = 'AccordionContent';
            div.style.cssText = 'padding: 10px; border-bottom: 1px solid #ddd;';

            const thumb = thumbnails[game.id] || '';

            const placeId = game.rootPlaceId || game.id;
            const universeId = game.id;
            const gameUrl = `#game?id=${placeId}&universe=${universeId}`;

            div.innerHTML = `
                <div style="display: flex; align-items: flex-start;">
                    <a href="${gameUrl}" style="cursor: pointer; margin-right: 10px;">
                        <img src="${thumb}" alt="${escapeHtml(game.name)}"
                             style="width: 420px; height: 230px; max-width: 414px; border: 1px solid #ccc;"
                             onerror="this.style.display='none'"/>
                    </a>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 13px; margin-bottom: 5px;">
                            <a href="${gameUrl}">${escapeHtml(game.name)}</a>
                        </div>
                        <div style="font-size: 11px; color: #666;">
                            ${game.placeVisits ? formatNumber(game.placeVisits) + ' visits' : ''}
                        </div>
                        <div style="font-size: 11px; color: green;">
                            ${game.playing ? game.playing + ' playing' : ''}
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0';
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toLocaleString();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading() {
        const loadingEl = document.getElementById('ProfileLoading');
        const errorEl = document.getElementById('ProfileError');
        const contentEl = document.getElementById('ProfileContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
    }

    function showContent() {
        const loadingEl = document.getElementById('ProfileLoading');
        const errorEl = document.getElementById('ProfileError');
        const contentEl = document.getElementById('ProfileContent');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
    }

    function showError(message) {
        
        if (window.showErrorPage) {
            window.showErrorPage(message, 'profile-content');
        } else {
            
            const loadingEl = document.getElementById('ProfileLoading');
            const errorEl = document.getElementById('ProfileError');
            const contentEl = document.getElementById('ProfileContent');

            if (loadingEl) loadingEl.style.display = 'none';
            if (errorEl) {
                errorEl.style.display = 'block';
                const pEl = errorEl.querySelector('p');
                if (pEl) pEl.textContent = message;
            }
            if (contentEl) contentEl.style.display = 'none';
        }
    }

    function resetProfilePage() {
        currentUserId = null;
        isInitialized = false;
        const container = document.getElementById('profile-content');
        if (container) {
            container.innerHTML = '';
        }
    }

    window.ProfilePage.reset = resetProfilePage;
})();
