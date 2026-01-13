(function() {
    'use strict';

    const CHRISTMAS_BANNER_CONFIG = {
        homeSWF: 'images/cssthemes/christmas/holiday_banner_home_v3.swf',
        globalSWF: 'images/cssthemes/christmas/holiday_banner_global_v3.swf',
        fallbackImage: 'images/cssthemes/christmas/bg-holiday_banner_no_flash.jpg',
        sessionKey: 'rovloo_christmas_home_played',
        ruffleUrl: 'scripts/ruffle/ruffle.js'
    };

    let ruffleLoaded = false;
    let swf2jsLoaded = false;
    let currentPlayer = null;
    let currentPlayerType = null;
    let bannerContainer = null;
    let currentBannerType = null;
    let isTransitioning = false;

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

    async function loadRuffle() {
        if (ruffleLoaded) return true;

        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;

            const checkRuffle = () => {
                if (window.RufflePlayer) {
                    console.log('[Christmas] Ruffle is ready');
                    ruffleLoaded = true;
                    resolve(true);
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('[Christmas] Ruffle failed to load after 5 seconds');
                    reject(new Error('Ruffle not available'));
                    return;
                }

                setTimeout(checkRuffle, 100);
            };

            checkRuffle();
        });
    }

    async function loadSwf2js() {
        if (swf2jsLoaded) return true;

        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;

            const checkSwf2js = () => {
                if (window.swf2js) {
                    console.log('[Christmas] swf2js is ready');
                    swf2jsLoaded = true;
                    resolve(true);
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('[Christmas] swf2js failed to load after 5 seconds');
                    reject(new Error('swf2js not available'));
                    return;
                }

                setTimeout(checkSwf2js, 100);
            };

            checkSwf2js();
        });
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
        if (bannerContainer) {
            applyTransform(bannerContainer);
        }
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
            frameRate: 24
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
        const errorHandler = (event) => {
            if (event.filename && event.filename.includes('swf2js')) {
                swf2jsError = event.error || new Error(event.message);
                console.warn('[Christmas] swf2js runtime error:', event.message);
                event.preventDefault();
            }
        };
        window.addEventListener('error', errorHandler);

        return new Promise((resolve, reject) => {
            try {
                const player = window.swf2js.load(swfPath, {
                    tagId: canvasId,
                    width: 1840,
                    height: 36,
                    quality: quality,
                    autoStart: true,
                    callback: function(success) {
                        window.removeEventListener('error', errorHandler);
                        if (success && !swf2jsError) {
                            console.log('[Christmas] swf2js loaded successfully');
                            currentPlayerType = 'swf2js';
                            resolve({ player: player, canvas: canvas });
                        } else {
                            console.warn('[Christmas] swf2js failed - SWF may use unsupported features (BitmapData, etc.)');
                            canvas.remove();
                            reject(new Error('swf2js failed to load SWF or encountered runtime error'));
                        }
                    }
                });

                setTimeout(() => {
                    window.removeEventListener('error', errorHandler);
                    if (swf2jsError) {
                        console.warn('[Christmas] swf2js encountered errors, falling back to Ruffle');
                        canvas.remove();
                        reject(swf2jsError);
                    } else if (currentPlayerType !== 'swf2js') {
                        currentPlayerType = 'swf2js';
                        resolve({ player: player, canvas: canvas });
                    }
                }, 1500);

            } catch (error) {
                window.removeEventListener('error', errorHandler);
                console.error('[Christmas] swf2js error:', error);
                canvas.remove();
                reject(error);
            }
        });
    }

    function destroyPlayer(player, playerType) {
        if (!player) return;

        try {
            if (playerType === 'ruffle') {
                if (typeof player.destroy === 'function') {
                    player.destroy();
                }
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

    async function playSWF(swfPath, isHomeAnimation = false) {
        if (isTransitioning) {
            console.log('[Christmas] Transition in progress, skipping');
            return;
        }

        try {
            isTransitioning = true;

            const siteHeader = document.querySelector('.site-header');
            if (!siteHeader) {
                throw new Error('Site header not found');
            }

            const oldContainer = bannerContainer;
            const oldPlayer = currentPlayer;
            const oldPlayerType = currentPlayerType;

            const selectedPlayer = getSelectedPlayer();
            console.log('[Christmas] Using player engine:', selectedPlayer);

            const { scale, translateX, translateY } = getTransformValues();

            const newContainer = document.createElement('div');
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
                if (selectedPlayer === 'swf2js') {
                    newPlayer = await playSWFWithRuffle(swfPath, newContainer);
                } else {
                    newPlayer = await playSWFWithSwf2js(swfPath, newContainer);
                }
            }

            applyTransform(newContainer);

            await new Promise(resolve => setTimeout(resolve, 150));

            bannerContainer = newContainer;
            currentPlayer = newPlayer;

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
                    newContainer.id = 'christmas-banner-container';
                    newContainer.style.zIndex = '1';
                    isTransitioning = false;
                }, 450);
            } else {
                newContainer.style.transition = 'opacity 0.4s ease-in-out';
                requestAnimationFrame(() => {
                    newContainer.style.opacity = '1';
                });
                newContainer.id = 'christmas-banner-container';
                isTransitioning = false;
            }

            window.removeEventListener('resize', onResize);
            window.addEventListener('resize', onResize);

            currentBannerType = isHomeAnimation ? 'home' : 'global';

            console.log(`[Christmas] Playing ${isHomeAnimation ? 'home' : 'global'} animation: ${swfPath}`);

            if (isHomeAnimation) {
                markHomeAnimationPlayed();

                const homeAnimationDuration = (500 / 24) * 1000;
                setTimeout(() => {
                    if (currentBannerType === 'home') {
                        console.log('[Christmas] Home animation finished, switching to global loop');
                        playSWF(CHRISTMAS_BANNER_CONFIG.globalSWF, false);
                    }
                }, homeAnimationDuration);
            }

        } catch (error) {
            console.error('[Christmas] Failed to play SWF:', error);
            isTransitioning = false;
            showFallbackBanner();
        }
    }

    function showFallbackBanner() {
        const siteHeader = document.querySelector('.site-header');
        if (siteHeader) {
            siteHeader.style.backgroundImage = `url('${CHRISTMAS_BANNER_CONFIG.fallbackImage}')`;
            siteHeader.style.backgroundRepeat = 'repeat-x';
        }
    }

    function initChristmasBanner(pageName) {
        if (!isChristmasThemeActive()) {
            return;
        }

        console.log('[Christmas] Initializing banner for page:', pageName);

        const isHomePage = pageName === 'home' || pageName === 'myroblox';
        const shouldPlayHomeAnimation = isHomePage && isFirstHomeVisit();

        const swfToPlay = shouldPlayHomeAnimation
            ? CHRISTMAS_BANNER_CONFIG.homeSWF
            : CHRISTMAS_BANNER_CONFIG.globalSWF;

        const newBannerType = shouldPlayHomeAnimation ? 'home' : 'global';
        if (currentBannerType === newBannerType && currentPlayer) {
            return;
        }

        playSWF(swfToPlay, shouldPlayHomeAnimation);
    }

    function onPageChange(pageName) {
        if (!isChristmasThemeActive()) return;

        console.log(`[Christmas] onPageChange called: ${pageName}, currentBannerType: ${currentBannerType}`);

        const isHomePage = pageName === 'home' || pageName === 'myroblox';

        if (isHomePage && isFirstHomeVisit()) {
            if (currentBannerType !== 'home') {
                console.log('[Christmas] Switching to home animation (first visit)');
                playSWF(CHRISTMAS_BANNER_CONFIG.homeSWF, true);
            }
        } else if (!isHomePage) {
            if (currentBannerType !== 'global') {
                console.log('[Christmas] Switching to global animation (left home page)');
                playSWF(CHRISTMAS_BANNER_CONFIG.globalSWF, false);
            }
        }
    }

    function destroyBanner() {
        window.removeEventListener('resize', onResize);

        destroyPlayer(currentPlayer, currentPlayerType);
        currentPlayer = null;
        currentPlayerType = null;

        if (bannerContainer) {
            bannerContainer.remove();
            bannerContainer = null;
        }

        currentBannerType = null;
        isTransitioning = false;

        console.log('[Christmas] Banner destroyed');
    }

    function reloadWithQuality(newQuality) {
        if (!isChristmasThemeActive() || !currentBannerType) {
            return;
        }

        console.log('[Christmas] Reloading banner with quality:', newQuality);

        const swfToPlay = currentBannerType === 'home'
            ? CHRISTMAS_BANNER_CONFIG.homeSWF
            : CHRISTMAS_BANNER_CONFIG.globalSWF;

        const wasHomeAnimation = currentBannerType === 'home';
        currentBannerType = null;

        playSWF(swfToPlay, wasHomeAnimation);
    }

    function reloadWithPlayer(newPlayer) {
        if (!isChristmasThemeActive() || !currentBannerType) {
            return;
        }

        console.log('[Christmas] Reloading banner with player:', newPlayer);

        const swfToPlay = currentBannerType === 'home'
            ? CHRISTMAS_BANNER_CONFIG.homeSWF
            : CHRISTMAS_BANNER_CONFIG.globalSWF;

        const wasHomeAnimation = currentBannerType === 'home';
        currentBannerType = null;

        playSWF(swfToPlay, wasHomeAnimation);
    }

    window.ChristmasBanner = {
        init: initChristmasBanner,
        onPageChange: onPageChange,
        destroy: destroyBanner,
        isActive: isChristmasThemeActive,
        reloadWithQuality: reloadWithQuality,
        reloadWithPlayer: reloadWithPlayer
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (isChristmasThemeActive()) {
            const activePage = document.querySelector('.page.active');
            const pageName = activePage ? activePage.id.replace('page-', '') : 'home';
            initChristmasBanner(pageName);
        }
    });

})();
