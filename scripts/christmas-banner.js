(function() {
    'use strict';

    const CHRISTMAS_BANNER_CONFIG = {
        homeSWF: 'images/cssthemes/christmas/holiday_banner_home_v3.swf',
        globalSWF: 'images/cssthemes/christmas/holiday_banner_global_v3.swf',
        fallbackImage: 'images/cssthemes/christmas/bg-holiday_banner_no_flash.jpg',
        sessionKey: 'rovloo_christmas_home_played',
        ruffleUrl: 'scripts/ruffle/ruffle.js',
        swf2jsUrl: 'scripts/swf2js/swf2js.js',
        // The home intro is 500 frames @ 24fps. Kept as a timeout because neither engine gives a
        // reliable "movie ended" event for a looping timeline; the timer is now tracked and
        // cancelled (see homeSwitchTimer) instead of firing blind.
        homeFrames: 500,
        homeFps: 24
    };

    let ruffleLoaded = false;
    let swf2jsLoaded = false;
    let currentPlayer = null;
    let currentPlayerType = null;
    let bannerContainer = null;
    let currentBannerType = null;
    let isTransitioning = false;
    // A request that arrived mid-transition. Previously such requests were dropped, which could
    // strand the banner on the wrong animation (e.g. the home->global switch landing while a
    // page-change transition was still running).
    let pendingRequest = null;
    let homeSwitchTimer = null;

    function isChristmasThemeActive() {
        return document.body.classList.contains('christmas-theme');
    }

    function isFirstHomeVisit() {
        return !sessionStorage.getItem(CHRISTMAS_BANNER_CONFIG.sessionKey);
    }

    function markHomeAnimationPlayed() {
        sessionStorage.setItem(CHRISTMAS_BANNER_CONFIG.sessionKey, 'true');
    }

    function getSelectedPlayer() {
        return window.getSwfPlayer ? window.getSwfPlayer() : 'ruffle';
    }

    // Engines are injected on first use rather than shipped in index.html, so a normal launch
    // never pays their fetch/parse cost (Ruffle 417KB + swf2js 749KB).
    const injected = {};
    function injectScript(src) {
        if (injected[src]) return injected[src];
        injected[src] = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src;
            el.async = false;
            el.onload = () => resolve(true);
            el.onerror = () => {
                injected[src] = null;
                reject(new Error(`Failed to load ${src}`));
            };
            document.head.appendChild(el);
        });
        return injected[src];
    }

    function waitForGlobal(name, label) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            const check = () => {
                if (window[name]) {
                    resolve(true);
                    return;
                }
                if (++attempts >= maxAttempts) {
                    console.error(`[Christmas] ${label} failed to load after 5 seconds`);
                    reject(new Error(`${label} not available`));
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
    }

    async function loadRuffle() {
        if (ruffleLoaded) return true;
        if (!window.RufflePlayer) await injectScript(CHRISTMAS_BANNER_CONFIG.ruffleUrl);
        await waitForGlobal('RufflePlayer', 'Ruffle');
        ruffleLoaded = true;
        return true;
    }

    async function loadSwf2js() {
        if (swf2jsLoaded) return true;
        if (!window.swf2js) await injectScript(CHRISTMAS_BANNER_CONFIG.swf2jsUrl);
        await waitForGlobal('swf2js', 'swf2js');
        swf2jsLoaded = true;
        return true;
    }

    function getTransformValues() {
        const siteHeader = document.querySelector('.site-header');
        const navWidth = siteHeader ? siteHeader.offsetWidth : window.innerWidth;
        const scale = 1;
        const navContentStart = (navWidth - 970) / 2;
        const swfContentStart = 435;
        const translateX = (navContentStart / scale) - swfContentStart;
        const translateY = 0;
        return { scale, translateX, translateY };
    }

    function applyTransform(container) {
        if (!container) return;
        const { scale, translateX, translateY } = getTransformValues();
        container.style.transform = `scale(${scale}) translateX(${translateX}px) translateY(${translateY}px)`;
        container.style.transformOrigin = 'left top';
    }

    function onResize() {
        // Re-align every live container, not just the current one — during a crossfade there are
        // two, and the outgoing one used to stay at the old offset while it faded.
        document.querySelectorAll('[id^="christmas-banner-container"]').forEach(applyTransform);
    }

    function getSwf2jsQuality() {
        const quality = window.getSwfQuality ? window.getSwfQuality() : 'low';
        switch (quality) {
            case 'low': return 0.25;
            case 'medium': return 0.5;
            case 'high': return 0.8;
            case 'best': return 1.0;
            default: return 0.25;
        }
    }

    // Fallback is a CSS class (the stylesheet already ships `.christmas-theme.no-flash .site-header`)
    // rather than an inline style, so it can actually be turned back OFF. The old inline-style
    // version was permanent: once a load failed the JPEG stayed behind every later banner.
    function setFallbackBanner(on) {
        document.body.classList.toggle('no-flash', !!on);
    }

    function emptyContainer(container) {
        if (!container) return;
        while (container.firstChild) container.removeChild(container.firstChild);
    }

    async function playSWFWithRuffle(swfPath, newContainer) {
        await loadRuffle();

        const ruffle = window.RufflePlayer.newest();
        const newPlayer = ruffle.createPlayer();

        newPlayer.style.cssText = `
            width: 1840px;
            height: 36px;
            display: block;
            background: transparent;
        `;

        newContainer.appendChild(newPlayer);

        const quality = window.getSwfQuality ? window.getSwfQuality() : 'low';

        await newPlayer.load({
            url: swfPath,
            autoplay: "on",
            unmuteOverlay: "hidden",
            loadingAnimation: false,
            splashScreen: false,
            preloader: false,
            wmode: "transparent",
            quality: quality,
            letterbox: "off",
            forceScale: true,
            frameRate: CHRISTMAS_BANNER_CONFIG.homeFps
        });

        currentPlayerType = 'ruffle';
        return newPlayer;
    }

    async function playSWFWithSwf2js(swfPath, newContainer) {
        await loadSwf2js();

        const canvasId = 'christmas-banner-canvas-' + Date.now();
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.width = 1840;
        canvas.height = 36;
        canvas.style.cssText = `
            width: 1840px;
            height: 36px;
            display: block;
            background: transparent;
        `;
        newContainer.appendChild(canvas);

        const quality = getSwf2jsQuality();

        let swf2jsError = null;
        let settled = false;
        const errorHandler = (event) => {
            if (event.filename && event.filename.includes('swf2js')) {
                swf2jsError = event.error || new Error(event.message);
                console.warn('[Christmas] swf2js runtime error:', event.message);
                event.preventDefault();
            }
        };
        window.addEventListener('error', errorHandler);

        return new Promise((resolve, reject) => {
            const finish = (fn, arg) => {
                if (settled) return;
                settled = true;
                window.removeEventListener('error', errorHandler);
                clearTimeout(watchdog);
                fn(arg);
            };

            const watchdog = setTimeout(() => {
                if (swf2jsError) {
                    console.warn('[Christmas] swf2js encountered errors, falling back');
                    canvas.remove();
                    finish(reject, swf2jsError);
                } else {
                    currentPlayerType = 'swf2js';
                    finish(resolve, { player: pendingPlayer, canvas: canvas });
                }
            }, 1500);

            let pendingPlayer = null;
            try {
                pendingPlayer = window.swf2js.load(swfPath, {
                    tagId: canvasId,
                    width: 1840,
                    height: 36,
                    quality: quality,
                    autoStart: true,
                    callback: function(success) {
                        if (success && !swf2jsError) {
                            console.log('[Christmas] swf2js loaded successfully');
                            currentPlayerType = 'swf2js';
                            finish(resolve, { player: pendingPlayer, canvas: canvas });
                        } else {
                            console.warn('[Christmas] swf2js failed - SWF may use unsupported features');
                            canvas.remove();
                            finish(reject, new Error('swf2js failed to load SWF'));
                        }
                    }
                });
            } catch (error) {
                console.error('[Christmas] swf2js error:', error);
                canvas.remove();
                finish(reject, error);
            }
        });
    }

    function destroyPlayer(player, playerType) {
        if (!player) return;

        try {
            if (playerType === 'ruffle') {
                // ruffle-player elements have no destroy(); stopping the movie and detaching the
                // element is what actually releases the AVM instance and its audio.
                if (typeof player.pause === 'function') player.pause();
                if (typeof player.destroy === 'function') player.destroy();
                if (player.parentNode) player.remove();
            } else if (playerType === 'swf2js') {
                if (player.player && typeof player.player.stop === 'function') {
                    player.player.stop();
                }
                if (player.canvas && player.canvas.parentNode) {
                    player.canvas.remove();
                }
            }
        } catch (e) {
            console.log('[Christmas] Error destroying player:', e);
        }
    }

    function runPending() {
        const next = pendingRequest;
        pendingRequest = null;
        if (next) playSWF(next.swfPath, next.isHomeAnimation);
    }

    async function playSWF(swfPath, isHomeAnimation = false) {
        // Coalesce instead of dropping: remember the most recent request and run it once the
        // in-flight transition finishes.
        if (isTransitioning) {
            pendingRequest = { swfPath, isHomeAnimation };
            return;
        }

        let newContainer = null;

        try {
            isTransitioning = true;

            const siteHeader = document.querySelector('.site-header');
            if (!siteHeader) {
                throw new Error('Site header not found');
            }

            // Any previously scheduled home->global switch belongs to a banner we are replacing.
            if (homeSwitchTimer) {
                clearTimeout(homeSwitchTimer);
                homeSwitchTimer = null;
            }

            const oldContainer = bannerContainer;
            const oldPlayer = currentPlayer;
            const oldPlayerType = currentPlayerType;

            const selectedPlayer = getSelectedPlayer();
            console.log('[Christmas] Using player engine:', selectedPlayer);

            const { scale, translateX, translateY } = getTransformValues();

            newContainer = document.createElement('div');
            newContainer.id = 'christmas-banner-container-new';
            newContainer.style.cssText = `
                position: fixed;
                top: 30px;
                left: 0;
                width: 1840px;
                height: 36px;
                z-index: 1;
                pointer-events: none;
                overflow: visible;
                opacity: 0;
                background: transparent;
                transform-origin: left top;
                transform: scale(${scale}) translateX(${translateX}px) translateY(${translateY}px);
            `;

            siteHeader.insertBefore(newContainer, siteHeader.firstChild);

            let newPlayer;
            try {
                if (selectedPlayer === 'swf2js') {
                    newPlayer = await playSWFWithSwf2js(swfPath, newContainer);
                } else {
                    newPlayer = await playSWFWithRuffle(swfPath, newContainer);
                }
            } catch (playerError) {
                console.warn(`[Christmas] ${selectedPlayer} failed, trying fallback player`);
                // Clear whatever the failed engine left behind, otherwise the fallback engine's
                // player is appended alongside it and BOTH run (double CPU + RAM).
                emptyContainer(newContainer);
                if (selectedPlayer === 'swf2js') {
                    newPlayer = await playSWFWithRuffle(swfPath, newContainer);
                } else {
                    newPlayer = await playSWFWithSwf2js(swfPath, newContainer);
                }
            }

            // A theme switch (or destroy) may have happened while the SWF was loading.
            if (!isChristmasThemeActive()) {
                destroyPlayer(newPlayer, currentPlayerType);
                newContainer.remove();
                isTransitioning = false;
                pendingRequest = null;
                return;
            }

            setFallbackBanner(false);
            applyTransform(newContainer);

            await new Promise(resolve => setTimeout(resolve, 150));

            bannerContainer = newContainer;
            currentPlayer = newPlayer;
            currentBannerType = isHomeAnimation ? 'home' : 'global';

            const finishTransition = () => {
                newContainer.id = 'christmas-banner-container';
                newContainer.style.zIndex = '1';
                isTransitioning = false;
                runPending();
            };

            if (oldContainer) {
                newContainer.style.opacity = '1';
                newContainer.style.zIndex = '0';
                oldContainer.style.zIndex = '1';
                oldContainer.style.transition = 'opacity 0.4s ease-in-out';

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        oldContainer.style.opacity = '0';
                    });
                });

                setTimeout(() => {
                    destroyPlayer(oldPlayer, oldPlayerType);
                    oldContainer.remove();
                    finishTransition();
                }, 450);
            } else {
                newContainer.style.transition = 'opacity 0.4s ease-in-out';
                requestAnimationFrame(() => {
                    newContainer.style.opacity = '1';
                });
                finishTransition();
            }

            window.removeEventListener('resize', onResize);
            window.addEventListener('resize', onResize);

            console.log(`[Christmas] Playing ${isHomeAnimation ? 'home' : 'global'} animation: ${swfPath}`);

            if (isHomeAnimation) {
                markHomeAnimationPlayed();

                const homeAnimationDuration =
                    (CHRISTMAS_BANNER_CONFIG.homeFrames / CHRISTMAS_BANNER_CONFIG.homeFps) * 1000;
                homeSwitchTimer = setTimeout(() => {
                    homeSwitchTimer = null;
                    if (currentBannerType === 'home' && isChristmasThemeActive()) {
                        console.log('[Christmas] Home animation finished, switching to global loop');
                        playSWF(CHRISTMAS_BANNER_CONFIG.globalSWF, false);
                    }
                }, homeAnimationDuration);
            }

        } catch (error) {
            console.error('[Christmas] Failed to play SWF:', error);
            // Without this the orphaned 1840px fixed container stayed in the header on every
            // failure, stacking up one per attempt.
            if (newContainer && newContainer.parentNode) newContainer.remove();
            isTransitioning = false;
            pendingRequest = null;
            setFallbackBanner(true);
        }
    }

    function initChristmasBanner(pageName) {
        if (!isChristmasThemeActive()) {
            return;
        }

        const isHomePage = pageName === 'home' || pageName === 'myroblox';
        const shouldPlayHomeAnimation = isHomePage && isFirstHomeVisit();

        const newBannerType = shouldPlayHomeAnimation ? 'home' : 'global';

        // Startup calls this from two places (this file's DOMContentLoaded and main.js once the
        // login check resolves). Without this guard both fired and the second SWF load was either
        // dropped mid-transition or loaded twice.
        if (currentPlayer || isTransitioning || pendingRequest) {
            if (currentBannerType === newBannerType) return;
        }

        console.log('[Christmas] Initializing banner for page:', pageName);

        playSWF(shouldPlayHomeAnimation
            ? CHRISTMAS_BANNER_CONFIG.homeSWF
            : CHRISTMAS_BANNER_CONFIG.globalSWF, shouldPlayHomeAnimation);
    }

    function onPageChange(pageName) {
        if (!isChristmasThemeActive()) return;

        const isHomePage = pageName === 'home' || pageName === 'myroblox';
        const wantHome = isHomePage && isFirstHomeVisit();
        const wantType = wantHome ? 'home' : 'global';

        // What the banner will be once anything in flight settles.
        const effectiveType = pendingRequest
            ? (pendingRequest.isHomeAnimation ? 'home' : 'global')
            : currentBannerType;

        if (effectiveType === wantType && (currentPlayer || isTransitioning || pendingRequest)) {
            return;
        }

        console.log(`[Christmas] Switching to ${wantType} animation (page: ${pageName})`);
        playSWF(wantHome ? CHRISTMAS_BANNER_CONFIG.homeSWF : CHRISTMAS_BANNER_CONFIG.globalSWF, wantHome);
    }

    function destroyBanner() {
        window.removeEventListener('resize', onResize);

        if (homeSwitchTimer) {
            clearTimeout(homeSwitchTimer);
            homeSwitchTimer = null;
        }

        destroyPlayer(currentPlayer, currentPlayerType);
        currentPlayer = null;
        currentPlayerType = null;

        if (bannerContainer) {
            bannerContainer.remove();
            bannerContainer = null;
        }

        // Sweep any container left over from an interrupted transition.
        document.querySelectorAll('[id^="christmas-banner-container"]').forEach(el => el.remove());

        currentBannerType = null;
        isTransitioning = false;
        pendingRequest = null;
        setFallbackBanner(false);

        console.log('[Christmas] Banner destroyed');
    }

    function reloadBanner(reason, value) {
        if (!isChristmasThemeActive() || !currentBannerType) {
            return;
        }

        console.log(`[Christmas] Reloading banner with ${reason}:`, value);

        const wasHomeAnimation = currentBannerType === 'home';
        const swfToPlay = wasHomeAnimation
            ? CHRISTMAS_BANNER_CONFIG.homeSWF
            : CHRISTMAS_BANNER_CONFIG.globalSWF;

        // Deliberately NOT clearing currentBannerType here: the old code nulled it before calling
        // playSWF, so if the call was dropped mid-transition the banner state was left as "none"
        // and later page changes misjudged what was on screen.
        playSWF(swfToPlay, wasHomeAnimation);
    }

    window.ChristmasBanner = {
        init: initChristmasBanner,
        onPageChange: onPageChange,
        destroy: destroyBanner,
        isActive: isChristmasThemeActive,
        reloadWithQuality: (q) => reloadBanner('quality', q),
        reloadWithPlayer: (p) => reloadBanner('player', p)
    };

    function currentPageName() {
        const activePage = document.querySelector('.page.active');
        return activePage ? activePage.id.replace('page-', '') : 'home';
    }

    // The banner container's geometry (position/size/opacity) lives in INLINE styles set by
    // playSWF, so it does NOT disappear when `body.christmas-theme` is removed — switching themes
    // used to leave a running Flash player pinned over the header forever. The class is toggled
    // from several places (applyTheme, applyConditionalRovlooTheme, removeConditionalRovlooTheme
    // and the per-page seasonal logic in navigateTo), so rather than patch each call site — and
    // miss the next one — reconcile against the class itself.
    let lastActiveState = null;

    function syncWithThemeState() {
        const active = isChristmasThemeActive();
        if (active === lastActiveState) return;
        lastActiveState = active;

        if (active) {
            initChristmasBanner(currentPageName());
        } else {
            destroyBanner();
        }
    }

    function startThemeObserver() {
        lastActiveState = isChristmasThemeActive();
        new MutationObserver(syncWithThemeState)
            .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.body) {
        startThemeObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startThemeObserver, { once: true });
    }

    document.addEventListener('DOMContentLoaded', () => {
        lastActiveState = isChristmasThemeActive();
        if (lastActiveState) {
            initChristmasBanner(currentPageName());
        }
    });

})();
