
document.addEventListener('DOMContentLoaded', async () => {
  
  ensurePagesInBody();
  
  initTitlebar();
  initNavigation();
  initFooterLinks();
  initThemeSettings();
  
  // Check login state and navigate to appropriate page
  const isLoggedIn = await checkLoginState();
  
  // If logged in, go to myroblox (My ROBLOX/Home), otherwise show the public home page
  if (isLoggedIn) {
    navigateTo('myroblox');
  } else {
    loadHomePage();
    // Initialize Christmas banner for home page if not logged in
    if (window.ChristmasBanner && window.ChristmasBanner.isActive()) {
      window.ChristmasBanner.init('home');
    }
  }
});

const THEME_STORAGE_KEY = 'rovloo_theme';
const CONDITIONAL_THEMES_KEY = 'rovloo_conditional_themes';
const CONDITIONAL_THEMES_PREFERENCE_KEY = 'rovloo_conditional_themes_preference';
const RANDOMIZE_BC_KEY = 'rovloo_randomize_bc';
const SWF_QUALITY_KEY = 'rovloo_swf_quality';
const SWF_PLAYER_KEY = 'rovloo_swf_player';

function initThemeSettings() {
  
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'roblox-2.0';
  applyTheme(savedTheme);

  const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
  if (themeRadio) {
    themeRadio.checked = true;
  }

  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      applyTheme(newTheme);

      updateConditionalThemesToggle();
    });
  });

  initConditionalThemesToggle();

  initRandomizeBCToggle();

  initGpuAccelerationToggle();

  initSwfQualitySelect();
}

function initConditionalThemesToggle() {
  const toggle = document.getElementById('conditional-themes-toggle');
  if (!toggle) return;

  const enabled = localStorage.getItem(CONDITIONAL_THEMES_KEY) !== 'false';
  toggle.checked = enabled;

  toggle.addEventListener('change', () => {
    const newValue = toggle.checked;
    localStorage.setItem(CONDITIONAL_THEMES_KEY, newValue ? 'true' : 'false');

    if (!toggle.disabled) {
      localStorage.setItem(CONDITIONAL_THEMES_PREFERENCE_KEY, newValue ? 'true' : 'false');
    }

    if (!newValue && !isOutrageousThemeSelected()) {
      document.body.classList.remove('obc-theme');
    }
  });

  updateConditionalThemesToggle();
}

function updateConditionalThemesToggle() {
  const toggle = document.getElementById('conditional-themes-toggle');
  const label = toggle?.closest('label');
  
  if (!toggle || !label) return;

  const isAlternateTheme = isAlternateThemeSelected();
  
  if (isAlternateTheme) {
    
    toggle.disabled = true;
    toggle.checked = false; 
    label.style.opacity = '0.5';
    label.style.cursor = 'not-allowed';
    label.title = 'Conditional theme overrides are not available when using Outrageous or Rovloo themes';

    localStorage.setItem(CONDITIONAL_THEMES_KEY, 'false');
  } else {
    
    toggle.disabled = false;
    label.style.opacity = '1';
    label.style.cursor = 'pointer';
    label.title = '';

    const userPreference = localStorage.getItem(CONDITIONAL_THEMES_PREFERENCE_KEY);
    const shouldEnable = userPreference !== null ? userPreference === 'true' : true;
    
    toggle.checked = shouldEnable;
    localStorage.setItem(CONDITIONAL_THEMES_KEY, shouldEnable ? 'true' : 'false');
  }
}

function areConditionalThemesEnabled() {
  return localStorage.getItem(CONDITIONAL_THEMES_KEY) !== 'false';
}

window.areConditionalThemesEnabled = areConditionalThemesEnabled;

function initRandomizeBCToggle() {
  const toggle = document.getElementById('randomize-bc-toggle');
  if (!toggle) return;

  const enabled = localStorage.getItem(RANDOMIZE_BC_KEY) === 'true';
  toggle.checked = enabled;

  toggle.addEventListener('change', () => {
    localStorage.setItem(RANDOMIZE_BC_KEY, toggle.checked ? 'true' : 'false');
  });
}

function isRandomizeBCEnabled() {
  return localStorage.getItem(RANDOMIZE_BC_KEY) === 'true';
}

window.isRandomizeBCEnabled = isRandomizeBCEnabled;

function getBCTypeForUser(userId) {
  const id = parseInt(userId, 10);
  if (isNaN(id)) return 'OBC'; 

  let hash = id;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;

  const bucket = Math.abs(hash) % 3;
  
  switch (bucket) {
    case 0: return 'BC';
    case 1: return 'TBC';
    case 2: return 'OBC';
    default: return 'OBC';
  }
}

window.getBCTypeForUser = getBCTypeForUser;

// size: 'big' (66x19 banner, the default — used on larger avatar contexts like the main
// profile avatar) or 'small' (22x12 corner badge — images/icons/overlay_*_small.png, matches
// the authentic Big/Small overlay naming convention e.g. .PersonalServerOverlay_Big/_Small)
function getBCOverlayImage(bcType, size = 'big') {
  const suffix = size === 'small' ? '_small' : 'Only';
  switch (bcType) {
    case 'BC': return `images/icons/overlay_bc${suffix}.png`;
    case 'TBC': return `images/icons/overlay_tbc${suffix}.png`;
    case 'OBC':
    default: return `images/icons/overlay_obc${suffix}.png`;
  }
}

window.getBCOverlayImage = getBCOverlayImage;

function applyConditionalRovlooTheme() {
  if (areConditionalThemesEnabled() && !isAlternateThemeSelected()) {
    document.body.classList.remove('halloween-theme', 'thanksgiving-theme', 'christmas-theme', 'obc-theme');
    document.body.classList.add('rovloo-theme');
  }
}

function removeConditionalRovlooTheme() {
  if (!isRovlooThemeSelected()) {
    document.body.classList.remove('rovloo-theme');
    
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'roblox-2.0';
    if (currentTheme === 'roblox-2.0' && areConditionalThemesEnabled()) {
      const seasonalTheme = getCurrentSeasonalTheme();
      if (seasonalTheme) {
        document.body.classList.add(seasonalTheme);
      }
    }
  }
}

window.applyConditionalRovlooTheme = applyConditionalRovlooTheme;
window.removeConditionalRovlooTheme = removeConditionalRovlooTheme;

async function initGpuAccelerationToggle() {
  const toggle = document.getElementById('gpu-acceleration-toggle');
  const restartNotice = document.getElementById('gpu-restart-notice');
  if (!toggle) return;

  try {
    if (window.RobloxClient?.settings?.getGpuAcceleration) {
      const enabled = await window.RobloxClient.settings.getGpuAcceleration();
      toggle.checked = enabled;
    } else {
      
      toggle.checked = true;
    }
  } catch (e) {
    console.warn('Failed to load GPU acceleration setting:', e);
    toggle.checked = true;
  }

  toggle.addEventListener('change', async () => {
    try {
      if (window.RobloxClient?.settings?.setGpuAcceleration) {
        const result = await window.RobloxClient.settings.setGpuAcceleration(toggle.checked);
        if (result?.requiresRestart && restartNotice) {
          restartNotice.style.display = 'block';
        }
      }
    } catch (e) {
      console.error('Failed to save GPU acceleration setting:', e);
    }
  });
}

function initSwfQualitySelect() {
  const select = document.getElementById('swf-quality-select');
  if (!select) return;

  // Load saved setting
  const savedQuality = localStorage.getItem(SWF_QUALITY_KEY) || 'low';
  select.value = savedQuality;

  select.addEventListener('change', () => {
    const newQuality = select.value;
    localStorage.setItem(SWF_QUALITY_KEY, newQuality);

    // If Christmas banner is active, reload it with new quality
    if (window.ChristmasBanner && window.ChristmasBanner.isActive()) {
      window.ChristmasBanner.reloadWithQuality(newQuality);
    }
  });
}

// Export function to get SWF quality setting
window.getSwfQuality = function() {
  return localStorage.getItem(SWF_QUALITY_KEY) || 'low';
};

function initSwfPlayerSelect() {
  const select = document.getElementById('swf-player-select');
  if (!select) return;

  // Load saved setting
  const savedPlayer = localStorage.getItem(SWF_PLAYER_KEY) || 'ruffle';
  select.value = savedPlayer;

  select.addEventListener('change', () => {
    const newPlayer = select.value;
    localStorage.setItem(SWF_PLAYER_KEY, newPlayer);

    // If Christmas banner is active, reload it with new player
    if (window.ChristmasBanner && window.ChristmasBanner.isActive()) {
      window.ChristmasBanner.reloadWithPlayer(newPlayer);
    }
  });
}

// Export function to get SWF player setting
window.getSwfPlayer = function() {
  return localStorage.getItem(SWF_PLAYER_KEY) || 'ruffle';
};

function applyTheme(themeName) {
  
  document.body.classList.remove('obc-theme', 'rovloo-theme', 'halloween-theme', 'thanksgiving-theme', 'christmas-theme');

  if (themeName === 'outrageous-2.0') {
    document.body.classList.add('obc-theme');
  } else if (themeName === 'rovloo') {
    document.body.classList.add('rovloo-theme');
  } else if (themeName === 'halloween') {
    document.body.classList.add('halloween-theme');
  } else if (themeName === 'thanksgiving') {
    document.body.classList.add('thanksgiving-theme');
  } else if (themeName === 'christmas') {
    document.body.classList.add('christmas-theme');
  } else if (themeName === 'roblox-2.0') {
    
    if (areConditionalThemesEnabled()) {
      const seasonalTheme = getCurrentSeasonalTheme();
      if (seasonalTheme) {
        document.body.classList.add(seasonalTheme);
      }
    }
  }
}

function getCurrentSeasonalTheme() {
  const now = new Date();
  const month = now.getMonth(); 
  const day = now.getDate();

  if (month === 9 && day >= 22 && day <= 31) {
    return 'halloween-theme';
  }

  if ((month === 10 && day >= 22) || (month === 11 && day === 1)) {
    return 'thanksgiving-theme';
  }

  if ((month === 11 && day >= 14) || (month === 0 && day === 1)) {
    return 'christmas-theme';
  }

  return null;
}

window.getCurrentSeasonalTheme = getCurrentSeasonalTheme;

function isOutrageousThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'outrageous-2.0';
}

function isRovlooThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'rovloo';
}

function isHalloweenThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'halloween';
}

function isThanksgivingThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'thanksgiving';
}

function isChristmasThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'christmas';
}

function isAlternateThemeSelected() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);
  return theme === 'outrageous-2.0' || theme === 'rovloo' || theme === 'halloween' || theme === 'thanksgiving' || theme === 'christmas';
}

const PREMIUM_CACHE_TTL = 24 * 60 * 60 * 1000; 
const PREMIUM_CACHE_MAX_SIZE = 100; 
const PREMIUM_STORAGE_KEY = 'rovloo_premium_cache';
const PREMIUM_RATELIMIT_KEY = 'rovloo_premium_ratelimit';

function loadPremiumCache() {
  try {
    const stored = localStorage.getItem(PREMIUM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const entries = [];
      const now = Date.now();
      
      Object.entries(parsed).forEach(([userId, data]) => {
        if (now - data.timestamp < PREMIUM_CACHE_TTL && data.value !== null) {
          entries.push([userId, data]);
        }
      });
      
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const cache = new Map();
      entries.slice(0, PREMIUM_CACHE_MAX_SIZE).forEach(([k, v]) => cache.set(k, v));
      return cache;
    }
  } catch (e) {
    console.warn('Failed to load premium cache:', e);
  }
  return new Map();
}

function savePremiumCache() {
  try {
    
    const entries = Array.from(premiumStatusCache.entries());
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const obj = {};
    entries.slice(0, PREMIUM_CACHE_MAX_SIZE).forEach(([k, v]) => {
      obj[k] = v;
    });
    localStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save premium cache:', e);
  }
}

function loadRateLimitState() {
  try {
    const stored = localStorage.getItem(PREMIUM_RATELIMIT_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      if (state.resetTime > Date.now()) {
        return state;
      }
    }
  } catch (e) {}
  return { isLimited: false, resetTime: 0, backoffMultiplier: 1 };
}

function saveRateLimitState() {
  try {
    localStorage.setItem(PREMIUM_RATELIMIT_KEY, JSON.stringify({
      isLimited: premiumRateLimited,
      resetTime: premiumRateLimitResetTime,
      backoffMultiplier: rateLimitBackoffMultiplier
    }));
  } catch (e) {}
}

const premiumStatusCache = loadPremiumCache();
window.premiumStatusCache = premiumStatusCache; 

let premiumRequestQueue = [];
let isProcessingQueue = false;
const PREMIUM_REQUEST_DELAY = 1000; 
const BASE_RATELIMIT_WAIT = 30000; 
const MAX_BACKOFF_MULTIPLIER = 8; 

const rateLimitState = loadRateLimitState();
let premiumRateLimited = rateLimitState.isLimited && rateLimitState.resetTime > Date.now();
let premiumRateLimitResetTime = rateLimitState.resetTime;
let rateLimitBackoffMultiplier = rateLimitState.backoffMultiplier;

function clearPremiumRateLimit() {
  premiumRateLimited = false;
  premiumRateLimitResetTime = 0;
  rateLimitBackoffMultiplier = 1;
  localStorage.removeItem(PREMIUM_RATELIMIT_KEY);
  console.log('Premium rate limit cleared');
}
window.clearPremiumRateLimit = clearPremiumRateLimit;

function isPremiumRateLimited() {
  if (premiumRateLimited && Date.now() < premiumRateLimitResetTime) {
    return true;
  }
  if (premiumRateLimited) {
    premiumRateLimited = false;
    
    rateLimitBackoffMultiplier = Math.max(1, rateLimitBackoffMultiplier / 2);
    saveRateLimitState();
  }
  return false;
}

function getRateLimitResetIn() {
  if (!isPremiumRateLimited()) return 0;
  return Math.max(0, premiumRateLimitResetTime - Date.now());
}
window.getPremiumRateLimitResetIn = getRateLimitResetIn; 

async function processPremiumQueue() {
  console.log(`processPremiumQueue called - isProcessing: ${isProcessingQueue}, queueLength: ${premiumRequestQueue.length}`);
  if (isProcessingQueue) return;
  if (premiumRequestQueue.length === 0) return;

  if (isPremiumRateLimited()) {
    const waitTime = getRateLimitResetIn();
    console.log(`Premium API rate limited, waiting ${Math.ceil(waitTime/1000)}s...`);
    setTimeout(processPremiumQueue, waitTime + 100);
    return;
  }
  
  isProcessingQueue = true;
  const { userId, resolve } = premiumRequestQueue.shift();
  console.log(`Processing premium request for userId: ${userId}`);

  const cached = premiumStatusCache.get(String(userId));
  if (cached && (Date.now() - cached.timestamp < PREMIUM_CACHE_TTL)) {
    isProcessingQueue = false;
    resolve(cached.value);
    if (premiumRequestQueue.length > 0) {
      setTimeout(processPremiumQueue, 10); 
    }
    return;
  }
  
  try {
    console.log(`Making premium API call for userId: ${userId}`);
    const result = await window.roblox.validatePremiumMembership(userId);
    console.log(`Premium API result for ${userId}:`, result);
    premiumStatusCache.set(String(userId), { value: result, timestamp: Date.now() });
    savePremiumCache(); 
    resolve(result);

    if (rateLimitBackoffMultiplier > 1) {
      rateLimitBackoffMultiplier = Math.max(1, rateLimitBackoffMultiplier - 0.5);
      saveRateLimitState();
    }
  } catch (e) {
    
    if (e?.message?.includes('429') || e?.status === 429 || e?.response?.status === 429) {
      premiumRateLimited = true;
      
      const waitTime = BASE_RATELIMIT_WAIT * rateLimitBackoffMultiplier;
      premiumRateLimitResetTime = Date.now() + waitTime;
      rateLimitBackoffMultiplier = Math.min(MAX_BACKOFF_MULTIPLIER, rateLimitBackoffMultiplier * 2);
      saveRateLimitState();

      premiumRequestQueue.unshift({ userId, resolve });
      console.warn(`Premium validation rate limited, waiting ${Math.ceil(waitTime/1000)}s (backoff: ${rateLimitBackoffMultiplier}x)`);
    } else {
      
      premiumStatusCache.set(String(userId), { value: false, timestamp: Date.now() - PREMIUM_CACHE_TTL + 60 * 60 * 1000 });
      savePremiumCache();
      resolve(false);
    }
  }
  
  isProcessingQueue = false;

  if (premiumRequestQueue.length > 0) {
    setTimeout(processPremiumQueue, PREMIUM_REQUEST_DELAY);
  }
}

async function getPremiumStatus(userId) {
  const userIdStr = String(userId);

  const cached = premiumStatusCache.get(userIdStr);
  if (cached && cached.value !== null && (Date.now() - cached.timestamp < PREMIUM_CACHE_TTL)) {
    console.log(`Premium cache hit for ${userId}:`, cached.value);
    return cached.value;
  }

  if (cached && cached.value === null) {
    console.log(`Clearing invalid null cache entry for ${userId}`);
    premiumStatusCache.delete(userIdStr);
    savePremiumCache();
  }

  const resetIn = getRateLimitResetIn();
  if (resetIn > 120000) { 
    console.log(`Skipping premium check for ${userId} - rate limited for ${Math.ceil(resetIn/1000)}s`);
    return null; 
  }
  
  console.log(`Queuing premium check for ${userId}, rate limit reset in: ${resetIn}ms, queue length: ${premiumRequestQueue.length}`);

  const existingRequest = premiumRequestQueue.find(r => String(r.userId) === userIdStr);
  if (existingRequest) {
    
    return new Promise(resolve => {
      const originalResolve = existingRequest.resolve;
      existingRequest.resolve = (value) => {
        originalResolve(value);
        resolve(value);
      };
    });
  }

  return new Promise(resolve => {
    premiumRequestQueue.push({ userId, resolve });
    processPremiumQueue();
  });
}
window.getPremiumStatus = getPremiumStatus; 

async function addObcOverlayIfPremium(container, userId, overlayStyle = {}) {
  if (!container || !userId) return false;

  const existingOverlay = container.querySelector('.obc-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  try {
    const hasPremium = await getPremiumStatus(userId);
    
    if (hasPremium === true) {
      
      const bcType = isRandomizeBCEnabled() ? getBCTypeForUser(userId) : 'OBC';
      const overlayImage = getBCOverlayImage(bcType, overlayStyle.size);
      
      const overlay = document.createElement('img');
      overlay.src = overlayImage;
      overlay.alt = bcType;
      overlay.className = 'obc-overlay';

      const bottomPos = overlayStyle.bottom || '0';
      const leftPos = overlayStyle.left || '0';
      const defaultStyle = `position: absolute; bottom: ${bottomPos}; left: ${leftPos}; height: auto; pointer-events: none;`;

      if (overlayStyle.width) {
        overlay.style.cssText = defaultStyle + ` width: ${overlayStyle.width};`;
      } else {
        overlay.style.cssText = defaultStyle;
      }
      
      container.appendChild(overlay);
      return true;
    }
  } catch (e) {
    
  }
  return false;
}
window.addObcOverlayIfPremium = addObcOverlayIfPremium; 

function ensurePagesInBody() {
  const body = document.getElementById('Body');
  const container = document.getElementById('Container');
  const pageHome = document.getElementById('page-home');

  if (body) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
      if (page.parentElement !== body) {
        body.appendChild(page);
      }
    });
  }

  if (pageHome) {
    
    let column1c = pageHome.querySelector(':scope > .Column1c') || document.querySelector('.Column1c');
    let column2c = pageHome.querySelector(':scope > .Column2c') || document.querySelector('.Column2c');

    if (column1c) {
      const firstChild = pageHome.firstElementChild;
      if (firstChild !== column1c) {
        pageHome.insertBefore(column1c, pageHome.firstChild);
      }
    }

    if (column2c && column1c) {
      if (column2c.previousElementSibling !== column1c) {
        column1c.after(column2c);
      }
    } else if (column2c) {
      pageHome.appendChild(column2c);
    }
  }

  if (container) {
    const footer = document.getElementById('Footer');
    if (footer && footer.parentElement !== container) {
      container.appendChild(footer);
    }
  }
}

function initFooterLinks() {

  document.querySelectorAll('a[data-page]').forEach(link => {
    // Skip logo button - it has its own handler in navigation.js
    if (link.classList.contains('btn-logo')) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  document.querySelectorAll('.SEOGenreLinks a[data-genre]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('games', { genre: link.dataset.genre });
    });
  });

  document.querySelectorAll('a[data-page="games"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('games');
    });
  });
}

function cleanupBeforeClose() {
  console.log('[Cleanup] Starting app cleanup before close...');
  console.log('[Cleanup] Current page:', window.currentPageName);

  // Clear all timeouts and intervals by getting their IDs
  // Note: This is a brute force approach to clear any lingering timers
  const highestTimeoutId = setTimeout(() => {}, 0);
  for (let i = 0; i < highestTimeoutId; i++) {
    clearTimeout(i);
  }
  console.log('[Cleanup] Cleared all timeouts up to ID:', highestTimeoutId);

  const highestIntervalId = setInterval(() => {}, 999999);
  for (let i = 0; i < highestIntervalId; i++) {
    clearInterval(i);
  }
  clearInterval(highestIntervalId);
  console.log('[Cleanup] Cleared all intervals up to ID:', highestIntervalId);

  // Clear performance.js memory cleanup interval
  if (window.Performance?.cleanup) {
    window.Performance.cleanup();
    console.log('[Cleanup] Performance cleanup done');
  }

  // Clear home page random facts interval
  if (window.randomFactsIntervalId) {
    clearInterval(window.randomFactsIntervalId);
    window.randomFactsIntervalId = null;
    console.log('[Cleanup] Random facts interval cleared');
  }

  // Clear local server settings status check interval
  if (window.localServerSettingsInstance?.destroy) {
    window.localServerSettingsInstance.destroy();
    console.log('[Cleanup] Local server settings destroyed');
  }

  // Terminate catalog economy worker
  if (window.CatalogPage?.reset) {
    window.CatalogPage.reset();
    console.log('[Cleanup] Catalog worker terminated');
  }

  // Clean up current page if any
  if (window.currentPageName && window.Performance) {
    window.Performance.cleanupPage(window.currentPageName);
    console.log('[Cleanup] Current page cleaned up:', window.currentPageName);
  }

  console.log('[Cleanup] All cleanup tasks completed');
}

function initTitlebar() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => {
    window.RobloxClient.window.minimize();
  });

  document.getElementById('btn-maximize')?.addEventListener('click', () => {
    window.RobloxClient.window.maximize();
  });

  document.getElementById('btn-close')?.addEventListener('click', async () => {
    console.log('[Close] Close button clicked');
    cleanupBeforeClose();

    // Give cleanup a moment to complete before closing
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[Close] Calling window.close()');
    try {
      // Try to quit the app if the method exists
      if (window.RobloxClient?.app?.quit) {
        console.log('[Close] Calling app.quit()');
        window.RobloxClient.app.quit();
      } else {
        console.log('[Close] Calling window.close()');
        window.RobloxClient.window.close();
      }
    } catch (error) {
      console.error('[Close] Error closing window:', error);
    }
  });

  // Also cleanup on beforeunload in case window is closed another way
  window.addEventListener('beforeunload', () => {
    cleanupBeforeClose();
  });

  // Additional cleanup on unload event
  window.addEventListener('unload', () => {
    cleanupBeforeClose();
  });
}

async function updateSubNavForPage(pageName, params = {}) {
  const subNav = document.getElementById('SubNav2013');
  if (!subNav) return;

  const myRobloxPages = ['myroblox', 'inbox', 'account', 'character', 'stuff', 'sets', 'groups', 'money', 'advertising', 'ambassadors', 'share', 'places'];

  const isMyRobloxPage = myRobloxPages.includes(pageName);

  let isLoggedIn = false;
  try {
    isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
  } catch (e) {
    isLoggedIn = false;
  }

  if (!isLoggedIn) {
    subNav.style.display = 'none';
    return;
  }

  if (isMyRobloxPage) {
    subNav.style.display = 'block';
    return;
  }

  if (pageName === 'profile' || pageName === 'friends') {
    try {
      const currentUser = await window.RobloxClient.api.getCurrentUser();
      const viewingUserId = params.userId ? String(params.userId) : null;
      if (viewingUserId && currentUser && String(currentUser.id) === viewingUserId) {
        subNav.style.display = 'block';
        return;
      }
    } catch (e) {
      
    }
  }

  subNav.style.display = 'none';
}

function navigateToPage(pageName, params = {}) {
  navigateTo(pageName, params);
}

let currentPageName = null;
window.currentPageName = currentPageName;

// Keep the heavy list pages (games, catalog) warm across in-session
// navigation: wiping them on every nav-away forced a full refetch + rerender
// on "back", even though both pages short-circuit when still loaded.
// Reset only once the page hasn't been visited for a while.
const PAGE_WARM_TTL = 5 * 60 * 1000;
const pageLastVisited = {};
function pageIsStale(pageName) {
  const last = pageLastVisited[pageName];
  return !last || (Date.now() - last) > PAGE_WARM_TTL;
}

// Hover prefetch: after a short dwell on a game/profile link, warm the main
// process's caches for the click that's probably coming. Best-effort only —
// the main process dedupes identical in-flight requests, so this never
// duplicates work the click itself would do.
const prefetchedHrefs = new Set();
let prefetchHoverTimer = null;
let profilePrefetchesInFlight = 0;
document.addEventListener('mouseover', function (e) {
  if (!e.target || !e.target.closest || !window.roblox) return;
  const link = e.target.closest('a[href*="#game?"], a[href*="#profile?"]');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (!href || prefetchedHrefs.has(href)) return;

  // 300ms dwell: sweeping the cursor across a friends grid must not fire a
  // prefetch per tile — profile bundles hit the rate-limited friends API.
  clearTimeout(prefetchHoverTimer);
  prefetchHoverTimer = setTimeout(function () {
    if (prefetchedHrefs.size > 300) prefetchedHrefs.clear();
    try {
      const params = new URLSearchParams(href.split('?')[1] || '');
      if (href.includes('#game?')) {
        prefetchedHrefs.add(href);
        const universeId = parseInt(params.get('universe'), 10);
        if (universeId && window.roblox.getGameDetails) {
          window.roblox.getGameDetails([universeId]).catch(function () {});
        }
      } else {
        // At most 2 speculative profile bundles at a time — a real click
        // is never gated by this, it goes straight through.
        if (profilePrefetchesInFlight >= 2) return;
        prefetchedHrefs.add(href);
        const userId = parseInt(params.get('id'), 10);
        // Guest links carry id=-1 — nothing to prefetch for those
        if (userId > 0 && window.roblox.getProfileBundle) {
          profilePrefetchesInFlight++;
          window.roblox.getProfileBundle(userId)
            .catch(function () {})
            .finally(function () { profilePrefetchesInFlight--; });
        }
      }
    } catch (err) { /* prefetch is best-effort */ }
  }, 300);
});

function navigateTo(pageName, params = {}) {
  if (currentPageName) {
    pageLastVisited[currentPageName] = Date.now();
  }
  
  if (currentPageName && currentPageName !== pageName && window.Performance) {
    window.Performance.cleanupPage(currentPageName);
  }

  if (pageName !== 'profile' && !isOutrageousThemeSelected()) {
    document.body.classList.remove('obc-theme');
  }

  if (pageName !== 'reviews') {
    if (pageName === 'games' && params.category === 'rovloo') {
      
    } else if (pageName !== 'games') {
      
      removeConditionalRovlooTheme();
    } else {
      
      removeConditionalRovlooTheme();
    }
  }

  if (pageName === 'reviews') {
    applyConditionalRovlooTheme();
  }

  if (pageName !== 'profile' && pageName !== 'reviews') {
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'roblox-2.0';
    if (currentTheme === 'roblox-2.0' && areConditionalThemesEnabled()) {
      const seasonalTheme = getCurrentSeasonalTheme();
      if (seasonalTheme) {
        document.body.classList.add(seasonalTheme);
      }
    }
  }

  if (pageName !== 'badge' && typeof window.resetBadgePage === 'function') {
    window.resetBadgePage();
  }

  if (pageName !== 'catalog-item' && typeof window.resetCatalogItemPage === 'function') {
    window.resetCatalogItemPage();
  }

  if (pageName !== 'game-detail' && window.GameDetailPage?.reset) {
    window.GameDetailPage.reset();
  }

  if (pageName !== 'catalog' && window.CatalogPage?.reset && pageIsStale('catalog')) {
    window.CatalogPage.reset();
  }

  if (pageName !== 'games' && window.GamesPage?.reset && pageIsStale('games')) {
    window.GamesPage.reset();
  }

  if (pageName !== 'profile' && window.ProfilePage?.reset) {
    window.ProfilePage.reset();
  }

  if (pageName !== 'myroblox' && window.MyRobloxPage?.reset) {
    window.MyRobloxPage.reset();
  }

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  currentPageName = window.currentPageName = pageName;

  // 'landing' uses the home page element but without login redirect
  const displayPageName = pageName === 'landing' ? 'home' : pageName;
  const targetPage = document.getElementById(`page-${displayPageName}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Update Christmas banner if active
  if (window.ChristmasBanner && window.ChristmasBanner.isActive()) {
    window.ChristmasBanner.onPageChange(pageName);
  }

  document.querySelectorAll('#MainNav li').forEach(li => {
    li.classList.remove('active');
    const link = li.querySelector('a[data-page]');
    if (link && link.dataset.page === pageName) {
      li.classList.add('active');
    }
  });

  updateSubNavForPage(pageName, params);

  document.dispatchEvent(new CustomEvent('pageChange', { 
    detail: { page: pageName, params } 
  }));

  switch (pageName) {
    case 'home':
    case 'landing':
      // loadHomePage() itself gates on login state and redirects to myroblox when logged in
      // (matches the real 2013 site's server-side redirect off Default.aspx) — no duplicate
      // login check needed here, and no case may bypass it.
      loadHomePage();
      break;
    case 'games':

      break;
    case 'profile':
      loadProfilePage(params.userId);
      break;
    case 'catalog':
      
      break;
    case 'bc':
      
      break;
    case 'people':
      loadPeoplePage();
      break;
    case 'friends':
      
      if (params.userId) {
        window.location.hash = `#friends?id=${params.userId}`;
      }
      loadFriendsPage(params.userId);
      break;
    case 'stuff':
      
      if (params.userId) {
        window.location.hash = `#stuff?id=${params.userId}`;
      }
      loadStuffPage(params.userId);
      break;
    case 'myroblox':
      
      break;
    case 'inbox':
      
      if (typeof loadInboxPage === 'function') {
        loadInboxPage();
      }
      break;
    case 'groups':
      
      break;
    case 'badge':
      
      if (params.badgeId) {
        loadBadgePage(params.badgeId);
      }
      break;
    case 'gamepass':
      
      if (params.id && window.loadGamePassPage) {
        window.loadGamePassPage(params.id);
      }
      break;
    case 'catalog-item':
      
      if (params.id && window.loadCatalogItemPage) {
        window.loadCatalogItemPage(params.id, params.type || 'Asset');
      }
      break;
    case 'character':
      
      loadCharacterPage();
      break;
    case 'account':

      if (window.loadAccountPage) {
        window.loadAccountPage();
      }
      if (window.BlacklistMenu && typeof window.BlacklistMenu.initAccountPage === 'function') {
        window.BlacklistMenu.initAccountPage();
      }
      break;
    case 'game-detail':
      
      if (params.id || params.placeId) {
        loadGameDetailPage(params.id || params.placeId, params.universe || params.universeId);
      }
      break;
  }
}

async function loadGameDetailPage(placeId, universeId = null) {
  
  if (window.GameDetailPage?.load) {
    window.GameDetailPage.load(placeId, universeId);
  } else if (window.loadGameDetailPage) {
    window.loadGameDetailPage(placeId, universeId);
  }
}

window.addEventListener('hashchange', handleHashChange);

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#profile"]');
  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const userId = params.get('id');
      if (userId) {
        navigateTo('profile', { userId });
      }
    } else {
      
      window.location.hash = href;
    }
  }
  
  const friendsLink = e.target.closest('a[href^="#friends"]');
  if (friendsLink) {
    e.preventDefault();
    const href = friendsLink.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const userId = params.get('id');
      if (userId) {
        navigateTo('friends', { userId });
      }
    } else {
      window.location.hash = href;
    }
  }

  const catalogItemLink = e.target.closest('a[href^="#catalog-item"]');
  if (catalogItemLink) {
    e.preventDefault();
    const href = catalogItemLink.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const itemId = params.get('id');
      const itemType = params.get('type') || 'Asset';
      if (itemId) {
        navigateTo('catalog-item', { id: itemId, type: itemType });
      }
    } else {
      window.location.hash = href;
    }
  }

  const gameDetailLink = e.target.closest('a[href^="#game-detail"]');
  if (gameDetailLink) {
    e.preventDefault();
    const href = gameDetailLink.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const placeId = params.get('id') || params.get('placeId');
      const universeId = params.get('universe') || params.get('universeId');
      if (placeId) {
        navigateTo('game-detail', { id: placeId, universe: universeId });
      }
    } else {
      window.location.hash = href;
    }
  }
});

function handleHashChange() {
  const hash = window.location.hash;

  if (hash.startsWith('#profile')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const userId = params.get('id');
    if (userId) {
      navigateTo('profile', { userId });
    }
  }
  
  else if (hash.startsWith('#game-detail')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const placeId = params.get('id') || params.get('placeId');
    const universeId = params.get('universe') || params.get('universeId');
    if (placeId) {
      navigateTo('game-detail', { id: placeId, universe: universeId });
    }
  }
  
  else if (hash.startsWith('#gamepass')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const gamePassId = params.get('id');
    if (gamePassId) {
      navigateTo('gamepass', { id: gamePassId });
    }
  }
  
  else if (hash.startsWith('#game')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const gameId = params.get('id');
    if (gameId) {
      navigateTo('game-detail', { id: gameId });
    }
  }
  
  else if (hash.startsWith('#badge')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const badgeId = params.get('id');
    if (badgeId) {
      navigateTo('badge', { badgeId });
    }
  }
  
  else if (hash.startsWith('#friends')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const userId = params.get('id');
    if (userId) {
      navigateTo('friends', { userId });
    }
  }
  
  else if (hash.startsWith('#group')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const groupId = params.get('id');
    if (groupId) {
      navigateTo('groups', { groupId });
    }
  }
  
  else if (hash.startsWith('#catalog-item')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const itemId = params.get('id');
    const itemType = params.get('type') || 'Asset';
    if (itemId) {
      navigateTo('catalog-item', { id: itemId, type: itemType });
    }
  }
  
  else if (hash.startsWith('#catalog')) {
    navigateTo('catalog');
  }
}

setTimeout(() => {
  if (window.location.hash) {
    handleHashChange();
  }
}, 100);

async function loadCharacterPage() {
  const container = document.getElementById('character-content');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading character...</div>';

  try {
    const response = await fetch('pages/character.html');
    if (!response.ok) throw new Error('Failed to load character page');
    const html = await response.text();
    container.innerHTML = html;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        
        if (window.CharacterPage && window.CharacterPage.init) {
          window.CharacterPage.init();
        }
      });
    });
  } catch (e) {
    console.error('Failed to load character page:', e);
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Failed to load character page.</div>';
  }
}

async function loadProfilePage(userId) {
  const container = document.getElementById('profile-content');
  if (!container) return;
  
  if (!userId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px; color: #666;">
        <p style="font-size: 14px;">No user specified.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div id="ProfileLoading" style="text-align: center; padding: 60px;">
      <div class="loading">Loading profile...</div>
    </div>
    <div id="ProfileError" style="display: none; text-align: center; padding: 60px; color: #cc0000;">
      <p>Failed to load profile.</p>
    </div>
    <div id="ProfileContent" class="MyRobloxContainer" style="display: none;">
      <!-- Faithful transcription of the 2013 User.aspx #Body (reference/archive-profile-roblox-2013.html):
           two 484px divider-right/divider-left columns, each section's content wrapped in its own
           .divider-bottom; full-width #UserContainer Inventory below. Render-target ids preserved. -->
      <div>
        <!-- LEFT COLUMN -->
        <div class="divider-right" style="width: 484px; float: left;">
          <h2 class="title"><span id="ProfileHeader">User's Profile</span></h2>

          <!-- Profile card -->
          <div class="divider-bottom" style="position: relative; z-index: 3; padding-bottom: 20px;">
            <div style="width: 100%;">
              <div>
                <div style="text-align: center;">
                  <span id="UserOnlineStatus" class="UserOfflineMessage">[ Offline ]</span>
                </div>
              </div>
              <div><div><center>
                <div style="margin-bottom: 10px;">
                  <span style="font-size: 13px;"><a id="UserProfileURL" href="#" target="_blank"></a></span><br/>
                </div>
                <a id="AvatarImageLink" title="" style="display:inline-block;height:200px;width:150px;">
                  <img id="AvatarImage" src="assets/ui/guest.png" height="200" width="150" border="0" alt="Avatar"/>
                </a>
                <br/>
                <div class="UserBlurb" style="margin-top: 10px; overflow-y: auto; max-height: 450px;">
                  <span id="UserBlurb"></span>
                </div>
                <div id="ProfileButtons" style="margin: 10px auto;">
                  <a id="FriendButton" class="GrayButton Disabled">Send Friend Request</a>
                  <div class="SendMessageProfileBtnDiv">
                    <a id="MessageButton" class="GrayButton" style="margin: 0 5px;" href="#">Send Message</a>
                  </div>
                  <div class="clear"></div>
                </div>
              </center></div></div>
            </div>
          </div>

          <!-- ROBLOX Badges -->
          <h2 class="title"><span>ROBLOX Badges</span></h2>
          <div class="divider-bottom" style="padding-bottom: 20px;">
            <div id="NoRobloxBadges" class="profile-empty" style="display: none;">This user has no ROBLOX badges.</div>
            <div id="RobloxBadgesList" class="RobloxBadgeContainer"></div>
          </div>

          <!-- Player Badges -->
          <div id="BadgesDisplayPane" class="divider-bottom" style="clear: both; padding-bottom: 20px;">
            <h2 class="title"><span>Player Badges</span></h2>
            <div style="min-height: 90px;">
              <div id="NoBadges" class="profile-empty" style="display: none;">This user has no badges.</div>
              <div id="BadgesList" class="PlayerBadgeContainer"></div>
            </div>
          </div>

          <!-- Statistics -->
          <h2 class="title"><span>Statistics</span></h2>
          <div class="divider-bottom" style="padding-bottom: 20px;">
            <table class="statsTable">
              <tr>
                <td class="statsLabel"><acronym title="The number of this user's friends.">Friends</acronym>:</td>
                <td class="statsValue"><span id="FriendsCount">0</span></td>
              </tr>
              <tr>
                <td class="statsLabel"><acronym title="The number of users following this user.">Followers</acronym>:</td>
                <td class="statsValue"><span id="FollowersCount">0</span></td>
              </tr>
              <tr>
                <td class="statsLabel"><acronym title="The number of users this user is following.">Following</acronym>:</td>
                <td class="statsValue"><span id="FollowingCount">0</span></td>
              </tr>
              <tr>
                <td class="statsLabel"><acronym title="When this user joined ROBLOX.">Join Date</acronym>:</td>
                <td class="statsValue"><span id="JoinDate">Unknown</span></td>
              </tr>
            </table>
          </div>

          <!-- Groups -->
          <div id="UserGroupsPane" style="clear: both;">
            <h2 class="title"><span>Groups</span></h2>
            <div style="clear: both; padding-bottom: 20px; padding-left: 30px;">
              <div id="NoGroups" class="profile-empty" style="display: none;">This user is not in any groups.</div>
              <div id="GroupsList" class="GroupsGrid"></div>
              <div class="clear"></div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="divider-left" style="width: 484px; float: left; position: relative; left: -1px;">
          <!-- Active Places (right column only) -->
          <div class="divider-bottom" style="padding-bottom: 20px; padding-left: 20px;">
            <h2 class="title" style="float: left;"><span id="PlacesHeader">Active Places</span></h2>
            <div class="clear"></div>
            <div id="UserPlacesPane">
              <div id="UserPlaces" style="overflow: hidden;">
                <div id="NoPlaces" class="profile-empty" style="display: none;">This user has no active places.</div>
                <div id="PlacesList"></div>
              </div>
            </div>
          </div>

          <!-- Friends (RIGHT COLUMN, below Active Places — authentic: centered table, 3 per row) -->
          <div class="divider-bottom" style="padding-left: 20px;">
          <div style="margin: 12px 0 20px; overflow: visible;">
            <h2 style="float: left;"><span id="FriendsHeader">Friends</span></h2>
            <a id="FriendsSeeAll" class="btn-small btn-neutral" style="float: right; display: none;" href="#">See All<span class="btn-text">See All</span></a>
            <div class="clear"></div>
          </div>
          <div style="padding-top: 30px;">
            <div id="NoFriends" class="profile-empty" style="display: none;">This user has no friends.</div>
            <table id="FriendsList" class="FriendsGrid" cellspacing="0" align="Center" border="0" style="border-collapse:collapse;"></table>
          </div>
        </div>

          <!-- Favorites (RIGHT COLUMN, below Friends — authentic: 3 per row) -->
          <div class="divider-bottom" style="padding-left: 20px; padding-bottom: 20px;">
          <div style="overflow: auto;">
            <h2 class="title" style="float: left;"><span id="FavoritesHeader">Favorites</span></h2>
            <div class="PanelFooter" style="float: right; font: 12px Arial; text-transform: none;">
              Category:&nbsp;
              <select id="FavoritesCategory">
                <option value="9" selected="selected">Places</option>
              </select>
            </div>
            <div class="clear"></div>
          </div>
          <div id="FavoritesContent">
            <div id="NoFavorites" class="profile-empty" style="display: none;">This user has no favorites.</div>
            <table id="FavoritesList" cellspacing="0" border="0" style="border-collapse:collapse;"></table>
          </div>
          <div id="FavoritesPagination" class="FooterPager" style="display: none;">
            <a id="FavoritesPrevPage" href="#"><span class="pager previous"></span></a>
            <span id="FavoritesPageInfo">Page 1</span>
            <a id="FavoritesNextPage" href="#"><span class="pager next"></span></a>
          </div>
        </div>
        </div>
        <div class="clear" style="clear: both;"></div>

        <!-- Inventory (full width) -->
        <div id="UserContainer">
          <div id="UserAssetsPane" style="border-top: 1px solid #ccc;">
            <h2 class="title" style="display: block;"><span>Inventory</span></h2>
            <div id="UserAssets">
              <div id="AssetsMenu" class="divider-right"></div>
              <div id="AssetsContent">
                <table id="AssetsList" cellspacing="0" border="0" style="border-collapse:collapse;"></table>
                <div id="AssetsPagination" class="FooterPager" style="display: none;">
                  <a id="AssetsPrevPage" href="javascript:void(0)"><span class="pager previous"></span></a>
                  <span id="AssetsPageInfo" style="margin: 0 15px;">Page 1</span>
                  <a id="AssetsNextPage" href="javascript:void(0)"><span class="pager next"></span></a>
                </div>
                <!-- Recommended Hats — authentic: INSIDE #AssetsContent, after the pager, so it aligns
                     with the item grid (both after the 158px menu). 784px, overflows the 685px content. -->
                <div style="width: 784px;">
                  <div id="RecommendationsPane" style="display: none;">
                    <h3 class="RecommendationHeader2 divider-top">Recommended Hats <a href="#catalog">See All <span>&#187;</span></a></h3>
                    <div id="AssetRecommendations" class="AssetRecommenderContainer"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Marks this profile as the one on display — any still-running background
  // hydration from a previously viewed profile checks this and drops out.
  currentProfileUserId = userId;

  try {
    const userInfo = await window.roblox.getUserInfo(userId);
    if (!userInfo) {
      throw new Error('User not found');
    }

    document.title = `${userInfo.displayName || userInfo.name} - ROBLOX`;

    // Progressive render: the user's identity is enough to show the page —
    // hiding everything until the slowest section resolved made profiles
    // feel far slower than they are. Each section below fills into its
    // fixed-geometry box as its own data arrives (no layout shift), and
    // every callback is guarded so a stale profile can't paint over a new one.
    await renderProfileIdentity(userInfo);
    document.getElementById('ProfileLoading').style.display = 'none';
    document.getElementById('ProfileContent').style.display = 'block';

    const ifCurrent = (fn) => (result) => {
      if (currentProfileUserId !== userId) return;
      return fn(result);
    };

    loadProfileAvatarAndPremium(userInfo);

    window.roblox.getFriendsCount(userId).catch(() => ({ count: 0 }))
      .then(ifCurrent(r => {
        const el = document.getElementById('FriendsCount');
        if (el) el.textContent = formatNumber(r.count || 0);
      }));
    window.roblox.getFollowersCount(userId).catch(() => ({ count: 0 }))
      .then(ifCurrent(r => {
        const el = document.getElementById('FollowersCount');
        if (el) el.textContent = formatNumber(r.count || 0);
      }));
    window.roblox.getFollowingCount(userId).catch(() => ({ count: 0 }))
      .then(ifCurrent(r => {
        const el = document.getElementById('FollowingCount');
        if (el) el.textContent = formatNumber(r.count || 0);
      }));
    window.roblox.getUserPresence([userId]).catch(() => ({ userPresences: [] }))
      .then(ifCurrent(r => renderProfileStatus(r.userPresences?.[0] || null)));

    window.roblox.getFriends(userId).catch(() => ({ data: [] }))
      .then(ifCurrent(r => renderProfileFriends((r.data || []).slice(0, 6), userInfo.name, userId)));
    window.roblox.getUserGames(userId).catch(() => ({ data: [] }))
      .then(ifCurrent(r => renderProfileGames((r.data || []).slice(0, 6))));
    window.roblox.getUserBadges(userId, 25, '').catch(() => ({ data: [], nextPageCursor: null }))
      .then(ifCurrent(r => renderProfileBadges(r.data || [], r.nextPageCursor || null, userId)));
    window.roblox.getUserGroups(userId).catch(() => ({ data: [] }))
      .then(ifCurrent(r => renderProfileGroups(r.data || [])));
    window.roblox.getRobloxBadges(userId).catch(() => [])
      .then(ifCurrent(r => renderRobloxBadges(userInfo, { robloxBadges: r || [] })));

    updateFriendButton(userId).catch(() => {});
    Promise.resolve(renderProfileInventory(userId)).catch(() => {});

    // Favorites: first page renders as soon as it arrives (50 items = 8+ UI
    // pages at 6/page); any remaining pages hydrate in the background.
    window.roblox.getUserFavoriteGames(userId, 50).catch(() => ({ data: [] }))
      .then(ifCurrent(favorites => {
        renderProfileFavorites(favorites.data || [], userInfo.name, userId, 1);
        if (favorites.nextPageCursor) {
          getAllUserFavoriteGames(userId, favorites.nextPageCursor, favorites.data || [])
            .then(ifCurrent(all => {
              if ((all.data || []).length > (favorites.data || []).length) {
                renderProfileFavorites(all.data, userInfo.name, userId, 1);
              }
            }))
            .catch(() => {});
        }
      }));

  } catch (error) {
    console.error('Failed to load profile:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load user profile. The user may not exist.', 'profile-content');
    } else {
      document.getElementById('ProfileLoading').style.display = 'none';
      document.getElementById('ProfileError').style.display = 'block';
      document.getElementById('ProfileError').querySelector('p').textContent = 'Failed to load user profile. The user may not exist.';
    }
  }
}

// Identity-only render: everything derivable from the user object alone,
// so the page can show before any other endpoint responds.
async function renderProfileIdentity(user) {

  const headerEl = document.getElementById('ProfileHeader');
  if (headerEl) headerEl.textContent = `${user.displayName || user.name}'s Profile`;

  const urlEl = document.getElementById('UserProfileURL');
  if (urlEl) {
    urlEl.textContent = `https://www.roblox.com/users/${user.id}/profile`;
    urlEl.href = `https://www.roblox.com/users/${user.id}/profile`;
  }

  const blurbEl = document.getElementById('UserBlurb');
  if (blurbEl) {
    let description = user.description;

    if (!description && window.roblox.getUserDescription) {
      try {
        description = await window.roblox.getUserDescription(user.id);
      } catch (e) {
        console.log('Could not fetch user description:', e);
      }
    }

    if (description && description.trim()) {
      blurbEl.textContent = description;
      blurbEl.style.fontStyle = 'normal';
      blurbEl.style.color = '';
    } else {
      blurbEl.textContent = 'No description available.';
      blurbEl.style.fontStyle = 'italic';
      blurbEl.style.color = '#666';
    }
  }

  const joinDateEl = document.getElementById('JoinDate');
  if (joinDateEl && user.created) {
    const joinDate = new Date(user.created);
    joinDateEl.textContent = joinDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

function renderProfileStatus(presence) {
  const statusEl = document.getElementById('UserOnlineStatus');
  if (statusEl && presence) {
    const isOnline = presence.userPresenceType > 0;
    statusEl.textContent = isOnline ? '[ Online ]' : '[ Offline ]';
    statusEl.className = isOnline ? 'UserOnlineMessage' : 'UserOfflineMessage';
    statusEl.style.color = isOnline ? 'green' : '#666';
  }
}

// Avatar bust + BC overlay — cosmetic, so it runs unawaited alongside the
// section fetches.
async function loadProfileAvatarAndPremium(user) {
  try {
    const thumbResult = await window.roblox.getUserThumbnails([user.id], '150x200', 'AvatarBust');
    const avatarEl = document.getElementById('AvatarImage');
    if (avatarEl && thumbResult?.data?.[0]?.imageUrl) {
      avatarEl.src = thumbResult.data[0].imageUrl;
    }
  } catch (e) {
    console.warn('Failed to load avatar:', e);
  }

  const avatarContainer = document.getElementById('AvatarImageLink');
  if (avatarContainer) {

    const existingOverlay = avatarContainer.querySelector('.obc-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    try {
      const hasPremium = await window.roblox.validatePremiumMembership(user.id);

      if (hasPremium === true) {
        console.log('Premium user detected:', user.name);

        const bcType = isRandomizeBCEnabled() ? getBCTypeForUser(user.id) : 'OBC';
        const overlayImage = getBCOverlayImage(bcType);

        if (areConditionalThemesEnabled() && bcType === 'OBC') {
          
          document.body.classList.remove('halloween-theme', 'thanksgiving-theme', 'christmas-theme');
          document.body.classList.add('obc-theme');
        } else if (!isOutrageousThemeSelected()) {
          
          document.body.classList.remove('obc-theme');
        }

        const overlay = document.createElement('img');
        overlay.src = overlayImage;
        overlay.alt = bcType;
        overlay.className = 'obc-overlay';
        overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; height: auto; pointer-events: none;';
        avatarContainer.appendChild(overlay);
      } else if (!isOutrageousThemeSelected()) {
        
        document.body.classList.remove('obc-theme');
      }
    } catch (e) {

      if (!isOutrageousThemeSelected()) {
        document.body.classList.remove('obc-theme');
      }
      console.debug('Could not verify premium status:', e);
    }
  }
}

async function renderProfileFavorites(favorites, username, userId, page = 1) {
  const container = document.getElementById('FavoritesList');
  const noFavoritesEl = document.getElementById('NoFavorites');
  const headerEl = document.getElementById('FavoritesHeader');
  const paginationEl = document.getElementById('FavoritesPagination');
  const prevBtn = document.getElementById('FavoritesPrevPage');
  const nextBtn = document.getElementById('FavoritesNextPage');
  const pageInfoEl = document.getElementById('FavoritesPageInfo');
  
  if (!container) return;

  if (headerEl) {
    headerEl.textContent = 'Favorites';
  }
  
  if (!favorites || favorites.length === 0) {
    if (noFavoritesEl) noFavoritesEl.style.display = 'block';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }
  
  if (noFavoritesEl) noFavoritesEl.style.display = 'none';
  if (paginationEl) paginationEl.style.display = 'block';
  
  container.innerHTML = '';
  
  const itemsPerPage = 6;
  const totalPages = Math.ceil(favorites.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pagedFavorites = favorites.slice(startIndex, endIndex);

  if (pageInfoEl) pageInfoEl.textContent = `Page ${page} of ${totalPages}`;

  // Authentic pager: keep both silver arrows present; grey the unavailable one via the .disabled
  // sprite state (matching the archive's <span class="pager previous disabled">). Hide the whole
  // pager only when there's a single page.
  if (paginationEl) paginationEl.style.display = totalPages > 1 ? 'block' : 'none';
  if (prevBtn) prevBtn.querySelector('.pager')?.classList.toggle('disabled', page <= 1);
  if (nextBtn) nextBtn.querySelector('.pager')?.classList.toggle('disabled', page >= totalPages);

  if (prevBtn && nextBtn) {
    const newPrevBtn = prevBtn.cloneNode(true);
    const newNextBtn = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    
    if (page > 1) {
      newPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderProfileFavorites(favorites, username, userId, page - 1);
      });
    }
    if (page < totalPages) {
      newNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderProfileFavorites(favorites, username, userId, page + 1);
      });
    }
  }

  const universeIds = pagedFavorites.map(f => f.id);
  let thumbnails = {};
  try {
    const thumbResult = await window.robloxAPI.getGameIcons(universeIds, '150x150');
    if (thumbResult?.data) {
      thumbResult.data.forEach(t => {
        thumbnails[t.targetId] = t.imageUrl;
      });
    }
  } catch (e) {
    console.warn('Failed to load favorite thumbnails:', e);
  }

  // Authentic 2013 favorites: <td class="Asset"> cells, 3 per row, in the FavoritesList table
  let favRow = null;
  pagedFavorites.forEach((game, index) => {
    if (index % 3 === 0) {
      favRow = document.createElement('tr');
      container.appendChild(favRow);
    }
    const thumb = thumbnails[game.id] || '';
    const creatorName = game.creator?.name || game.creator?.username || 'Unknown';
    const creatorType = game.creator?.type || game.creator?.creatorType || 'User';
    const creatorId = game.creator?.id || game.creator?.creatorTargetId;
    const placeId = game.rootPlaceId || game.id;

    let creatorDisplay;
    if (creatorType === 'User' && creatorId) {
      creatorDisplay = `<a href="#profile?id=${creatorId}" class="notranslate">${escapeHtml(creatorName)}</a>`;
    } else if (creatorType === 'Group' && creatorId) {
      creatorDisplay = `<a href="#group?id=${creatorId}" class="notranslate">${escapeHtml(creatorName)}</a>`;
    } else {
      creatorDisplay = escapeHtml(creatorName);
    }

    const td = document.createElement('td');
    td.className = 'Asset';
    td.setAttribute('valign', 'top');
    td.innerHTML = `
      <div style="padding:5px; margin-right: 30px; margin-left: 10px">
        <div class="AssetThumbnail notranslate">
          <a href="#game?id=${placeId}" title="${escapeHtml(game.name)}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
            ${thumb ? `<img src="${thumb}" height="110" width="110" border="0" alt="${escapeHtml(game.name)}" onerror="this.style.display='none'"/>` : ''}
          </a>
        </div>
        <div class="AssetDetails notranslate" style="clear:both;">
          <div class="AssetName"><a href="#game?id=${placeId}">${escapeHtml(game.name)}</a></div>
          <div class="AssetCreator"><span class="Label">Creator:</span> <span class="Detail">${creatorDisplay}</span></div>
        </div>
      </div>
    `;
    favRow.appendChild(td);
  });
}

let currentProfileUserId = null;

async function getAllUserFavoriteGames(userId, startCursor = '', seed = []) {
    let allFavorites = seed.slice();
    let cursor = startCursor;
    let hasNextPage = true;

    while(hasNextPage) {
        try {
            const result = await window.roblox.getUserFavoriteGames(userId, 50, cursor);
            if (result.data && result.data.length > 0) {
                allFavorites = allFavorites.concat(result.data);
            }
            cursor = result.nextPageCursor;
            hasNextPage = !!cursor;
        } catch (error) {
            console.error('Failed to fetch a page of favorites:', error);
            hasNextPage = false;
        }
    }
    return { data: allFavorites };
}

function renderRobloxBadges(user, data) {
  const container = document.getElementById('RobloxBadgesList');
  const noBadgesEl = document.getElementById('NoRobloxBadges');
  
  if (!container) return;

  const badge2011Images = {
    
    'Veteran': 'images/Badges/Veteran-75x75_v-2.png',
    'Friendship': 'images/Badges/Friendship-75x75_v-2.png',
    'Homestead': 'images/Badges/Homestead-70x75_v-2.png',
    'Bricksmith': 'images/Badges/Bricksmith-54x75_v-2.png',
    'Warrior': 'images/Badges/Warrior-75x75_v-2.png',
    'Bloxxer': 'images/Badges/Bloxxer-75x75_v-2.png',
    'Combat Initiation': 'images/Badges/CombatInitiation-75x75_v-2.png',
    'Inviter': 'images/Badges/Inviter-75x75_v-2.png',
    'Administrator': 'images/Badges/Administrator-75x75_v-2.png',
    'Welcome To The Club': 'images/Badges/BuildersClub-75x75.png',
    'Builders Club': 'images/Badges/BuildersClub-75x75.png',
    'Turbo Builders Club': 'images/Badges/TurboBuildersClub-75x75.png',
    'Outrageous Builders Club': 'images/Badges/obcbadge75x75.png',
    
    1: 'images/Badges/Administrator-75x75_v-2.png', 
    2: 'images/Badges/Friendship-75x75_v-2.png', 
    3: 'images/Badges/CombatInitiation-75x75_v-2.png', 
    4: 'images/Badges/Warrior-75x75_v-2.png', 
    5: 'images/Badges/Bloxxer-75x75_v-2.png', 
    6: 'images/Badges/Homestead-70x75_v-2.png', 
    7: 'images/Badges/Bricksmith-54x75_v-2.png', 
    11: 'images/Badges/Inviter-75x75_v-2.png', 
    12: 'images/Badges/Veteran-75x75_v-2.png', 
    18: 'images/Badges/BuildersClub-75x75.png' 
  };

  const robloxBadges = data.robloxBadges || [];
  
  if (robloxBadges.length === 0) {
    if (noBadgesEl) noBadgesEl.style.display = 'block';
    return;
  }
  
  if (noBadgesEl) noBadgesEl.style.display = 'none';
  container.innerHTML = '';

  const table = document.createElement('table');
  table.cellSpacing = '0';
  table.align = 'Left';
  table.border = '0';
  table.style.borderCollapse = 'collapse';

  let currentRow = null;
  robloxBadges.forEach((badge, index) => {
    if (index % 5 === 0) {   // authentic 2013 ROBLOX-badge grid is 5 per row
      currentRow = document.createElement('tr');
      table.appendChild(currentRow);
    }

    const localImage = badge2011Images[badge.name] || badge2011Images[badge.id];
    const imageUrl = localImage || badge.imageUrl || '';

    const td = document.createElement('td');
    td.innerHTML = `
      <div class="Badge notranslate">
        <div class="BadgeImage">
          <a title="${escapeHtml(badge.description || '')}">
            <img src="${imageUrl}" alt="${escapeHtml(badge.name)}" style="height:75px;width:75px;border-width:0px;" onerror="this.src='${badge.imageUrl || ''}'; this.onerror=null;"/>
          </a>
        </div>
        <div class="BadgeLabel">
          <a>${escapeHtml(badge.name)}</a>
        </div>
      </div>
    `;
    currentRow.appendChild(td);
  });
  
  container.appendChild(table);
}

async function updateFriendButton(profileUserId) {
  const buttonsEl = document.getElementById('ProfileButtons');
  const friendBtn = document.getElementById('FriendButton');
  if (!buttonsEl || !friendBtn) return;

  try {
    const currentUser = await window.RobloxClient.api.getCurrentUser();
    if (!currentUser) return;

    if (String(currentUser.id) === String(profileUserId)) {
      buttonsEl.style.display = 'none';
      return;
    }

    const statusResult = await window.roblox.getFriendshipStatuses(currentUser.id, [profileUserId]);
    const status = statusResult?.data?.[0]?.status;

    friendBtn.onclick = null;

    if (status === 'Friends') {
      friendBtn.textContent = 'Friends';
      friendBtn.classList.add('Disabled');
    } else if (status === 'RequestSent') {
      friendBtn.textContent = 'Friend Request Sent';
      friendBtn.classList.add('Disabled');
    } else if (status === 'RequestReceived') {
      friendBtn.textContent = 'Accept Friend Request';
      friendBtn.classList.remove('Disabled');
      friendBtn.onclick = async (e) => {
        e.preventDefault();
        friendBtn.textContent = 'Accepting...';
        try {
          await window.roblox.acceptFriendRequest(profileUserId);
          friendBtn.textContent = 'Friends';
          friendBtn.classList.add('Disabled');
        } catch (err) {
          console.error('Failed to accept friend request:', err);
          friendBtn.textContent = 'Accept Friend Request';
        }
      };
    } else {
      friendBtn.textContent = 'Send Friend Request';
      friendBtn.classList.remove('Disabled');
      friendBtn.onclick = async (e) => {
        e.preventDefault();
        friendBtn.textContent = 'Sending...';
        try {
          await window.roblox.sendFriendRequest(profileUserId);
          friendBtn.textContent = 'Friend Request Sent';
          friendBtn.classList.add('Disabled');
        } catch (err) {
          console.error('Failed to send friend request:', err);
          friendBtn.textContent = 'Send Friend Request';
          friendBtn.classList.remove('Disabled');
        }
      };
    }
  } catch (e) {
    console.warn('Could not determine friendship status:', e);
  }
}

async function renderProfileFriends(friends, username, userId) {
  const container = document.getElementById('FriendsList');
  const noFriendsEl = document.getElementById('NoFriends');
  const headerEl = document.getElementById('FriendsHeader');
  
  if (!container) return;

  if (headerEl && username) {
    headerEl.textContent = `${username}'s Friends`;
    const seeAll = document.getElementById('FriendsSeeAll');
    if (seeAll) {
      seeAll.href = `#friends?id=${userId}`;
      seeAll.style.display = 'inline-block';
    }
  }
  
  if (!friends || friends.length === 0) {
    if (noFriendsEl) noFriendsEl.style.display = 'block';
    return;
  }
  
  if (noFriendsEl) noFriendsEl.style.display = 'none';
  container.innerHTML = '';
  
  const friendIds = friends.map(f => f.id);

  let userDetails = {};
  try {
    const usersResult = await window.roblox.getUsersByIds(friendIds);
    if (usersResult?.data) {
      usersResult.data.forEach(u => {
        userDetails[u.id] = u;
      });
    }
  } catch (e) {
    console.warn('Failed to load user details:', e);
  }

  let thumbnails = {};
  try {
    const thumbResult = await window.roblox.getUserThumbnails(friendIds, '150x150', 'AvatarBust');
    if (thumbResult?.data) {
      thumbResult.data.forEach(t => {
        thumbnails[t.targetId] = t.imageUrl;
      });
    }
  } catch (e) {
    console.warn('Failed to load friend thumbnails:', e);
  }

  let presenceMap = {};
  try {
    const presenceResult = await window.roblox.getUserPresence(friendIds);
    if (presenceResult?.userPresences) {
      presenceResult.userPresences.forEach(p => {
        presenceMap[p.userId] = p.userPresenceType; 
      });
    }
  } catch (e) {
    console.warn('Failed to load friend presence:', e);
  }

  // Authentic 2013 profile Friends: a centered <table> of .Friend notranslate cells, 3 PER ROW
  // (archive dlFriends: </tr><tr> every 3). Lives in the right column below Active Places.
  let row = null;
  for (let index = 0; index < friends.length; index++) {
    const friend = friends[index];
    if (index % 3 === 0) { row = document.createElement('tr'); container.appendChild(row); }
    const thumb = thumbnails[friend.id] || 'assets/ui/guest.png';
    const presence = presenceMap[friend.id] || 0;
    const isOnline = presence > 0;
    const statusIcon = isOnline ? 'assets/ui/online.png' : 'assets/ui/offline.png';

    const user = userDetails[friend.id] || {};
    const friendName = user.name || user.displayName || friend.name || friend.displayName || 'Unknown';

    const td = document.createElement('td');
    td.innerHTML = `
      <div class="Friend notranslate">
        <div class="Avatar">
          <a href="#profile?id=${friend.id}" title="${escapeHtml(friendName)}" style="display:inline-block;height:100px;width:100px;cursor:pointer;position:relative;">
            <img src="${thumb}" border="0" alt="${escapeHtml(friendName)}" style="width:100px;height:100px;object-fit:cover;" onerror="this.src='assets/ui/guest.png'"/>
          </a>
        </div>
        <div class="Summary">
          <span class="OnlineStatus"><img src="${statusIcon}" alt="${isOnline ? 'Online' : 'Offline'}" style="width:10px;height:10px;vertical-align:middle;"/></span>
          <span class="Name"><a href="#profile?id=${friend.id}">${escapeHtml(friendName)}</a></span>
        </div>
      </div>
    `;
    row.appendChild(td);

    const avatarContainer = td.querySelector('.Avatar a');
    if (avatarContainer) {
      addObcOverlayIfPremium(avatarContainer, friend.id, { bottom: '-12px' });
    }
  }
}

async function renderProfileGames(games) {
  const container = document.getElementById('PlacesList');
  const noPlacesEl = document.getElementById('NoPlaces');
  
  if (!container) return;
  
  if (!games || games.length === 0) {
    if (noPlacesEl) noPlacesEl.style.display = 'block';
    return;
  }
  
  if (noPlacesEl) noPlacesEl.style.display = 'none';
  container.innerHTML = '';

  const universeIds = games.map(g => g.id);
  let thumbnails = {};
  try {
    
    const thumbResult = await window.roblox.getGameThumbnails(universeIds, '480x270');
    if (thumbResult?.data) {
      thumbResult.data.forEach(t => {
        
        if (t.thumbnails && t.thumbnails.length > 0) {
          thumbnails[t.universeId] = t.thumbnails[0].imageUrl;
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load game thumbnails:', e);
  }

  // Authentic 2013 User.aspx Active Places: jQuery-UI accordion (flat h3 headers + panels).
  // We replicate jQuery UI's exact class structure so the page-bundle .ui-accordion/.ui-state-*
  // /.ui-icon CSS applies verbatim; the toggle behaviour is done in JS (no jQuery UI loaded).
  const accordion = document.createElement('div');
  accordion.id = 'accordion';
  accordion.className = 'accordion ui-accordion ui-widget ui-helper-reset';

  // jQuery-UI 1.9.2 accordion behaviour: exactly ONE panel open at a time (collapsible:false), with a
  // sliding open/close animation (~300ms). Replicated here in plain JS via a height transition.
  const headers = [];
  const panels = [];
  let openIndex = 0;
  const setHeaderState = (hdr, isOpen) => {
    hdr.classList.toggle('ui-state-active', isOpen);
    hdr.classList.toggle('ui-accordion-header-active', isOpen);
    hdr.classList.toggle('ui-corner-top', isOpen);
    hdr.classList.toggle('ui-corner-all', !isOpen);
    const icon = hdr.querySelector('.ui-accordion-header-icon');
    icon.classList.toggle('ui-icon-triangle-1-s', isOpen);
    icon.classList.toggle('ui-icon-triangle-1-e', !isOpen);
  };
  const slidePanel = (pnl, open, dur = 300) => {
    pnl.style.overflow = 'hidden';
    let ended = false;
    const finish = () => {
      if (ended) return; ended = true;
      pnl.removeEventListener('transitionend', onEnd);
      pnl.style.transition = ''; pnl.style.height = ''; pnl.style.overflow = '';
      if (!open) { pnl.style.display = 'none'; pnl.classList.remove('ui-accordion-content-active'); }
    };
    const onEnd = (e) => { if (e.target === pnl && e.propertyName === 'height') finish(); };
    pnl.addEventListener('transitionend', onEnd);
    // Set the START height (opening: 0 from a fresh display:block; closing: current full height).
    if (open) {
      pnl.style.display = 'block';
      pnl.classList.add('ui-accordion-content-active');
      pnl.style.height = '0px';
    } else {
      pnl.style.height = pnl.scrollHeight + 'px';
    }
    // Two rAFs guarantee the start height paints before we set the transition + target — reliable even
    // when a sibling panel animates in the same tick (a plain reflow gets clobbered and the transition
    // silently no-ops, leaving the old panel stuck open).
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ended) return; // fallback already settled us (e.g. throttled background tab)
      pnl.style.transition = `height ${dur}ms ease`;
      pnl.style.height = open ? pnl.scrollHeight + 'px' : '0px';
    }));
    setTimeout(finish, dur + 80); // fallback: settle even if transitionend never fires
  };
  const openAccordion = (idx) => {
    if (idx === openIndex) return; // collapsible:false — clicking the already-open header does nothing
    const prev = openIndex;
    openIndex = idx;
    setHeaderState(headers[prev], false);
    slidePanel(panels[prev], false);
    setHeaderState(headers[idx], true);
    slidePanel(panels[idx], true);
  };

  games.forEach((game, index) => {
    const thumb = thumbnails[game.id] || '';
    const placeId = game.rootPlaceId || game.id;
    const active = index === 0;

    // jQuery-UI 1.9.2 enhances the server's `<div><h3></h3></div>` header wrapper: the ui-*
    // classes land on the WRAPPER DIV (not the h3), the inline-styled <h3> stays as its child,
    // and the triangle icon span is prepended. Active header adds ui-state-active +
    // ui-accordion-header-active + ui-corner-top; the rest get ui-corner-all. No jQuery UI is
    // loaded here, so we emit the post-enhancement DOM directly and toggle it in JS below.
    const header = document.createElement('div');
    header.setAttribute('role', 'tab');
    header.className = 'ui-accordion-header ui-helper-reset ui-accordion-icons ui-state-default '
      + (active ? 'ui-state-active ui-accordion-header-active ui-corner-top' : 'ui-corner-all');
    header.innerHTML = `<span class="ui-accordion-header-icon ui-icon ${active ? 'ui-icon-triangle-1-s' : 'ui-icon-triangle-1-e'}"></span>`
      + `<h3 class="notranslate" style="display:block;font-size:15px;font-weight:bold;color:#363636;float:left;overflow:hidden;height:22px;">${escapeHtml(game.name)}</h3>`;

    // Panel keeps the server's notranslate class + inline padding (0 20px, top 0), exactly as the
    // archive; jQuery UI adds the ui-accordion-content-* classes on top.
    const panel = document.createElement('div');
    panel.setAttribute('role', 'tabpanel');
    panel.className = 'notranslate ui-accordion-content ui-helper-reset ui-widget-content ui-corner-bottom'
      + (active ? ' ui-accordion-content-active' : '');
    panel.style.cssText = `margin:0;padding-left:20px;padding-right:20px;padding-top:0;display:${active ? 'block' : 'none'};`;
    // Inline styles on Statistics/Thumbnail/Description are copied VERBATIM from the archive element
    // attributes (they beat any bundle rule, so the rendered look is guaranteed authentic).
    panel.innerHTML = `
      <div class="Place">
        <div class="PlayStatus"></div>
        <br>
        <div class="Statistics" style="font-family: arial;color: #666; font-size: 12px; letter-spacing: normal">
          <span>Visited ${formatNumber(game.placeVisits || 0)} times</span>
        </div>
        <div class="Thumbnail" style="width:414px;overflow:hidden;position: relative;">
          <a href="#game?id=${placeId}" title="${escapeHtml(game.name)}" style="display:inline-block;height:230px;width:420px;cursor:pointer;">
            ${thumb ? `<img src="${thumb}" height="230" width="420" border="0" alt="${escapeHtml(game.name)}" onerror="this.style.display='none'"/>` : ''}
          </a>
        </div>
        ${game.description ? `<div class="Description" style="font-family: arial; color: #666; font-size: 12px;line-height: inherit; border: none"><span>${escapeHtml(game.description)}</span></div>` : ''}
        <div class="PlayOptions" style="display:block">
          <div class="VisitButtonsLeft Centered">
            <div class="VisitButton VisitButtonPlay" placeid="${placeId}">
              <a class="btn-large btn-large-green-play" href="#game?id=${placeId}" title="Play this game">Play<span class="btn-text">Play</span></a>
            </div>
          </div>
        </div>
      </div>
    `;

    const idx = index;
    header.addEventListener('click', () => openAccordion(idx));

    headers.push(header);
    panels.push(panel);
    accordion.appendChild(header);
    accordion.appendChild(panel);
  });

  container.appendChild(accordion);
}

const badgePaginationState = {
  allBadges: [],
  currentPage: 0,
  userId: null,
  nextApiCursor: null,
  hasMoreFromApi: false,
  isLoading: false,
  thumbnailCache: new Map()
};
const badgesPerPage = 12;

function handleBadgePagination(e) {
  const btn = e.target.closest('#badgePrevBtn, #badgeNextBtn');
  if (!btn || btn.classList.contains('disabled') || badgePaginationState.isLoading) return;

  if (btn.id === 'badgePrevBtn' && badgePaginationState.currentPage > 0) {
    badgePaginationState.currentPage--;
    renderProfileBadges(null, null, null);
  } else if (btn.id === 'badgeNextBtn') {
    badgePaginationState.currentPage++;
    renderProfileBadges(null, null, null);
  }
}

async function renderProfileBadges(badges, nextCursor, userId) {
  const container = document.getElementById('BadgesList');
  const noBadgesEl = document.getElementById('NoBadges');

  if (!container) return;

  if (userId) {
    badgePaginationState.userId = userId;
    badgePaginationState.allBadges = badges || [];
    badgePaginationState.currentPage = 0;
    badgePaginationState.nextApiCursor = nextCursor;
    badgePaginationState.hasMoreFromApi = !!nextCursor;
    badgePaginationState.thumbnailCache.clear();
  }

  if (badgePaginationState.allBadges.length === 0) {
    if (noBadgesEl) noBadgesEl.style.display = 'block';
    const existingPager = container.parentElement?.querySelector('.badge-pager');
    if (existingPager) existingPager.remove();
    return;
  }

  if (noBadgesEl) noBadgesEl.style.display = 'none';

  badgePaginationState.isLoading = true;
  container.style.opacity = '0.5';

  const startIdx = badgePaginationState.currentPage * badgesPerPage;
  let pageBadges = badgePaginationState.allBadges.slice(startIdx, startIdx + badgesPerPage);

  while (pageBadges.length < badgesPerPage && badgePaginationState.hasMoreFromApi) {
    try {
      const result = await window.roblox.getUserBadges(badgePaginationState.userId, 25, badgePaginationState.nextApiCursor);
      if (result?.data && result.data.length > 0) {
        badgePaginationState.allBadges = badgePaginationState.allBadges.concat(result.data);
        pageBadges = badgePaginationState.allBadges.slice(startIdx, startIdx + badgesPerPage);
      }
      badgePaginationState.nextApiCursor = result?.nextPageCursor || null;
      badgePaginationState.hasMoreFromApi = !!result?.nextPageCursor;

      if (!result?.data || result.data.length === 0) break;
    } catch (e) {
      console.warn('Failed to fetch more badges:', e);
      badgePaginationState.hasMoreFromApi = false;
      break;
    }
  }

  const badgeIds = pageBadges.map(b => b.id);
  const uncachedIds = badgeIds.filter(id => !badgePaginationState.thumbnailCache.has(id));

  if (uncachedIds.length > 0) {
    try {
      const thumbResult = await window.roblox.getBadgeThumbnails(uncachedIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          badgePaginationState.thumbnailCache.set(t.targetId, t.imageUrl);
        });
      }
    } catch (e) {
      console.warn('Failed to load badge thumbnails:', e);
    }
  }

  container.innerHTML = '';
  pageBadges.forEach(badge => {
    const thumb = badgePaginationState.thumbnailCache.get(badge.id) || '';
    const div = document.createElement('div');
    div.className = 'TileBadges';
    // Authentic .TileBadges (profile.css): float:left; margin:10px 10px → 95px tile, 5 per row,
    // cleared by .PlayerBadgeContainer{overflow:hidden}. No inline override.
    div.innerHTML = `
      <a href="#badge?id=${badge.id}" title="${escapeHtml(badge.name)}" style="display:inline-block;height:75px;width:75px;cursor:pointer;">
        ${thumb ? `<img src="${thumb}" border="0" alt="${escapeHtml(badge.name)}" style="width:75px;height:75px;" onerror="this.style.display='none'"/>` : ''}
      </a>
    `;
    container.appendChild(div);
  });

  container.style.opacity = '1';
  badgePaginationState.isLoading = false;

  const totalLoaded = badgePaginationState.allBadges.length;
  const currentPageEnd = (badgePaginationState.currentPage + 1) * badgesPerPage;
  const hasNext = currentPageEnd < totalLoaded || badgePaginationState.hasMoreFromApi;
  const hasPrev = badgePaginationState.currentPage > 0;

  let pager = container.parentElement?.querySelector('.badge-pager');
  if (hasNext || hasPrev) {
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'badge-pager';
      pager.style.cssText = 'text-align: center; padding: 5px; margin-top: 5px;';
      pager.addEventListener('click', handleBadgePagination);
      container.parentElement.appendChild(pager);
    }
    pager.innerHTML = `
      <a id="badgePrevBtn" href="javascript:void(0)" class="pager previous${!hasPrev ? ' disabled' : ''}"></a>
      <span>Page ${badgePaginationState.currentPage + 1}</span>
      <a id="badgeNextBtn" href="javascript:void(0)" class="pager next${!hasNext ? ' disabled' : ''}"></a>
    `;
  } else if (pager) {
    pager.remove();
  }
}

const groupPaginationState = {
  allGroups: [],
  currentPage: 0,
  isLoading: false,
  thumbnailCache: new Map()
};
const groupsPerPage = 15;

function handleGroupPagination(e) {
  const btn = e.target.closest('#groupPrevBtn, #groupNextBtn');
  if (!btn || btn.classList.contains('disabled') || groupPaginationState.isLoading) return;

  const totalPages = Math.ceil(groupPaginationState.allGroups.length / groupsPerPage);

  if (btn.id === 'groupPrevBtn' && groupPaginationState.currentPage > 0) {
    groupPaginationState.currentPage--;
    renderProfileGroups(null, true);
  } else if (btn.id === 'groupNextBtn' && groupPaginationState.currentPage < totalPages - 1) {
    groupPaginationState.currentPage++;
    renderProfileGroups(null, true);
  }
}

async function renderProfileGroups(groups, isPageChange = false) {
  const container = document.getElementById('GroupsList');
  const noGroupsEl = document.getElementById('NoGroups');

  if (!container) return;

  if (!isPageChange && groups) {
    groupPaginationState.allGroups = groups;
    groupPaginationState.currentPage = 0;
    groupPaginationState.thumbnailCache.clear();
  }

  if (!groupPaginationState.allGroups || groupPaginationState.allGroups.length === 0) {
    if (noGroupsEl) noGroupsEl.style.display = 'block';
    const existingPager = container.parentElement?.querySelector('.group-pager');
    if (existingPager) existingPager.remove();
    return;
  }

  if (noGroupsEl) noGroupsEl.style.display = 'none';

  groupPaginationState.isLoading = true;
  container.style.opacity = '0.5';

  const startIdx = groupPaginationState.currentPage * groupsPerPage;
  const pageGroups = groupPaginationState.allGroups.slice(startIdx, startIdx + groupsPerPage);

  const groupIds = pageGroups.map(g => g.group?.id || g.id);
  const uncachedIds = groupIds.filter(id => !groupPaginationState.thumbnailCache.has(id));

  if (uncachedIds.length > 0) {
    try {
      const thumbResult = await window.roblox.getGroupThumbnails(uncachedIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          groupPaginationState.thumbnailCache.set(t.targetId, t.imageUrl);
        });
      }
    } catch (e) {
      console.warn('Failed to load group thumbnails:', e);
    }
  }

  container.innerHTML = '';
  // Authentic 2013: groups are floated .groupEmblemThumbnail divs (not a table)
  pageGroups.forEach((groupData) => {
    const group = groupData.group || groupData;
    const thumb = groupPaginationState.thumbnailCache.get(group.id) || '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'float: left;';
    wrap.innerHTML = `
      <div class="groupEmblemThumbnail" style="width:70px; overflow:hidden;">
        <div class="groupEmblemImage notranslate" style="width:70px; height:72px; margin:0; padding-top:0; background-repeat:no-repeat; background-image:none;">
          <a href="#group?id=${group.id}" title="${escapeHtml(group.name)}" style="display:inline-block;height:62px;width:60px;cursor:pointer;">
            ${thumb ? `<img src="${thumb}" height="62" width="60" border="0" alt="${escapeHtml(group.name)}" onerror="this.style.display='none'"/>` : ''}
          </a>
        </div>
      </div>
    `;
    container.appendChild(wrap);
  });

  container.style.opacity = '1';
  groupPaginationState.isLoading = false;

  const totalPages = Math.ceil(groupPaginationState.allGroups.length / groupsPerPage);

  let pager = container.parentElement?.querySelector('.group-pager');
  if (totalPages > 1) {
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'group-pager';
      pager.style.cssText = 'text-align: center; padding: 5px; margin-top: 5px;';
      pager.addEventListener('click', handleGroupPagination);
      container.parentElement.appendChild(pager);
    }
    pager.innerHTML = `
      <a id="groupPrevBtn" href="javascript:void(0)" class="pager previous${groupPaginationState.currentPage === 0 ? ' disabled' : ''}"></a>
      <span>Page ${groupPaginationState.currentPage + 1} of ${totalPages}</span>
      <a id="groupNextBtn" href="javascript:void(0)" class="pager next${groupPaginationState.currentPage >= totalPages - 1 ? ' disabled' : ''}"></a>
    `;
  } else if (pager) {
    pager.remove();
  }
}

// Authentic order/labels/ids from the real 2013 /My/Stuff.aspx category rail
// (reference/archive-stuff-2013.html AssetCategoryRepeater, ctl00-ctl19). Shared with the
// Profile page's Inventory section — both widgets are the same #UserContainer/#AssetsMenu
// component, just embedded (Profile) vs. standalone (Stuff).
const assetCategories = [
  { id: 17, name: 'Heads' },
  { id: 18, name: 'Faces' },
  { id: 19, name: 'Gear' },
  { id: 8, name: 'Hats' },
  { id: 2, name: 'T-Shirts' },
  { id: 11, name: 'Shirts' },
  { id: 12, name: 'Pants' },
  { id: 13, name: 'Decals' },
  { id: 10, name: 'Models' },
  { id: 38, name: 'Plugins' },
  { id: 9, name: 'Places' },
  { id: 34, name: 'Game Passes' },
  { id: 3, name: 'Audio' },
  { id: 21, name: 'Badges' },
  { id: 29, name: 'Left Arms' },
  { id: 28, name: 'Right Arms' },
  { id: 31, name: 'Left Legs' },
  { id: 30, name: 'Right Legs' },
  { id: 27, name: 'Torsos' },
  { id: 32, name: 'Packages' }
];

let currentAssetCategory = 8; 
let currentAssetCursor = '';
let currentAssetPage = 1;
let currentInventoryUserId = null;
let assetCursorHistory = []; 

async function renderProfileInventory(userId, showRecommendations = true) {
  currentInventoryUserId = userId;
  assetCursorHistory = []; 
  const menuContainer = document.getElementById('AssetsMenu');
  const assetsContent = document.getElementById('AssetsContent');
  if (!menuContainer) return;

  let canView = true;
  try {
    const result = await window.roblox.canViewInventory(userId);
    canView = result?.canView !== false;
  } catch (e) {
    console.warn('Could not check inventory visibility:', e);
  }
  
  if (!canView) {
    menuContainer.innerHTML = '';
    if (assetsContent) {
      assetsContent.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">This user\'s inventory is private.</div>';
    }
    return;
  }

  menuContainer.innerHTML = assetCategories.map(cat => `
    <div class="verticaltab${cat.id === currentAssetCategory ? ' selected' : ''}">
      <a href="javascript:void(0)" onclick="selectAssetCategory(${cat.id})">${cat.name}</a>
    </div>
  `).join('');

  const assetsContentEl = document.getElementById('AssetsContent');
  if (assetsContentEl && !assetsContentEl.dataset.handlerAttached) {
    assetsContentEl.dataset.handlerAttached = 'true';
    assetsContentEl.addEventListener('click', (e) => {
      const link = e.target.closest('.inventory-item-link');
      if (link) {
        e.preventDefault();
        const assetId = link.dataset.assetId;
        if (assetId) {
          navigateToPage('catalog-item', { id: assetId });
        }
      }
    });
  }

  await loadInventoryCategory(userId, currentAssetCategory);
  if (showRecommendations) {
    renderProfileRecommendations().catch(e => console.warn('Recommendations failed:', e));
  }
}

// Authentic 2013 profile "Recommended Hats" block (full-width, below the inventory). The archive
// seeds it from the default inventory category (Hats); we reuse the catalog search API (Hats =
// categoryFilter 8) and render the authentic 5x2 PortraitDiv grid. Fails silently (pane stays hidden).
async function renderProfileRecommendations() {
  const pane = document.getElementById('RecommendationsPane');
  const list = document.getElementById('AssetRecommendations');
  if (!pane || !list) return;

  const searchApi = window.roblox?.searchCatalog ? window.roblox : (window.robloxAPI?.searchCatalog ? window.robloxAPI : null);
  if (!searchApi) return;

  const response = await searchApi.searchCatalog({ categoryFilter: 8, subcategory: '', sortType: 0, keyword: '', limit: 10 });
  const items = (response?.data || []).filter(r => r.itemType !== 'Bundle').slice(0, 10);
  if (items.length === 0) return;

  let thumbnails = {};
  const thumbApi = window.roblox?.getAssetThumbnails ? window.roblox : (window.robloxAPI?.getAssetThumbnails ? window.robloxAPI : null);
  if (thumbApi) {
    try {
      const thumbData = await thumbApi.getAssetThumbnails(items.map(r => r.id), '110x110');
      thumbData?.data?.forEach(t => { if (t.imageUrl) thumbnails[t.targetId] = t.imageUrl; });
    } catch (e) { console.warn('Recommendation thumbnails failed:', e); }
  }

  const cell = (r, i) => `
    <td><div class="PortraitDiv" style="width:140px;min-height:165px;margin:auto;" data-se="recommended-items-${i}">
      <div class="AssetThumbnail">
        <a href="javascript:void(0)" onclick="window.location.hash='#catalog-item?id=${r.id}&type=Asset';return false;" title="${escapeHtml(r.name)}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
          <img src="${thumbnails[r.id] || ''}" height="110" width="110" border="0" alt="${escapeHtml(r.name)}" onerror="this.style.visibility='hidden'"/>
        </a>
      </div>
      <div class="AssetDetails">
        <div class="AssetName noTranslate"><a href="javascript:void(0)" onclick="window.location.hash='#catalog-item?id=${r.id}&type=Asset';return false;">${escapeHtml(r.name)}</a></div>
        <div class="AssetCreator"><span class="stat-label">Creator:</span> <span class="Detail stat"><a class="notranslate" href="javascript:void(0)" onclick="window.location.hash='#profile?id=${r.creatorTargetId || 1}';return false;">${escapeHtml(r.creatorName || 'ROBLOX')}</a></span></div>
      </div>
    </div></td>`;
  const row1 = items.slice(0, 5).map((r, i) => cell(r, i)).join('');
  const row2 = items.slice(5, 10).map((r, i) => cell(r, i + 5)).join('');
  list.innerHTML = `<table cellspacing="0" align="Center" border="0" style="height:175px;width:784px;border-collapse:collapse;"><tr>${row1}</tr>${row2 ? `<tr>${row2}</tr>` : ''}</table>`;
  pane.style.display = 'block';
}

window.selectAssetCategory = async function(categoryId) {
  currentAssetCategory = categoryId;
  currentAssetCursor = '';
  currentAssetPage = 1;
  assetCursorHistory = []; 

  const menuContainer = document.getElementById('AssetsMenu');
  if (menuContainer) {
    menuContainer.innerHTML = assetCategories.map(cat => `
      <div class="verticaltab${cat.id === currentAssetCategory ? ' selected' : ''}">
        <a href="javascript:void(0)" onclick="selectAssetCategory(${cat.id})">${cat.name}</a>
      </div>
    `).join('');
  }
  
  await loadInventoryCategory(currentInventoryUserId, categoryId);
};

async function fetchInventoryEconomyDetails(assetIds) {
  const economyDetails = {};
  if (!window.roblox?.getAssetEconomyDetails) return economyDetails;
  
  for (const assetId of assetIds) {
    try {
      const ecoData = await window.roblox.getAssetEconomyDetails(assetId);
      if (ecoData) {
        economyDetails[assetId] = {
          isLimited: ecoData.IsLimited || ecoData.isLimited || false,
          isLimitedUnique: ecoData.IsLimitedUnique || ecoData.isLimitedUnique || false,
          lowestSellerPrice: ecoData.LowestSellerPrice ?? ecoData.lowestSellerPrice ?? null,
          priceInRobux: ecoData.PriceInRobux ?? ecoData.priceInRobux ?? null,
          isForSale: ecoData.IsForSale ?? ecoData.isForSale ?? false
        };
      }
    } catch (e) {
      console.warn('Failed to load economy details for asset', assetId, ':', e);
    }
  }
  return economyDetails;
}

function buildInventoryPriceHtml(details, ecoData) {
  const restrictions = details.itemRestrictions || [];
  const isLimited = restrictions.includes('Limited') || restrictions.includes('Collectible') || ecoData?.isLimited;
  const isLimitedUnique = restrictions.includes('LimitedUnique') || ecoData?.isLimitedUnique;
  
  if (isLimited || isLimitedUnique) {
    
    const resalePrice = ecoData?.lowestSellerPrice || details.lowestPrice;
    if (resalePrice && resalePrice > 0) {
      return `<div class="PriceInRobux">R$: ${resalePrice.toLocaleString()}</div>`;
    }
    
    return '';
  } else {
    
    const isForSale = ecoData?.isForSale;
    const price = ecoData?.priceInRobux ?? details.price;
    
    if (isForSale === false) {
      
      return `<div class="PriceInRobux" style="color:#cc0000;">Off Sale</div>`;
    } else if (price !== undefined && price !== null) {
      
      return price === 0 ? `<div class="PriceInRobux">Free</div>` : `<div class="PriceInRobux">R$: ${price.toLocaleString()}</div>`;
    }
    return '';
  }
}

async function loadInventoryCategory(userId, assetTypeId, cursor = '', isGoingBack = false) {
  const container = document.getElementById('AssetsList');
  const paginationEl = document.getElementById('AssetsPagination');

  if (!container) return;

  container.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading...</td></tr>';

  try {
    
    if (assetTypeId === 21) {
      await loadInventoryBadges(userId, cursor, isGoingBack);
      return;
    }

    const result = await window.roblox.getUserInventory(userId, assetTypeId, 10, cursor, 'Desc');

    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No items to display.</td></tr>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    const assetIds = result.data.map(item => item.assetId);
    let thumbnails = {};
    try {
      const thumbResult = await window.robloxAPI.getAssetThumbnails(assetIds, '110x110');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load asset thumbnails:', e);
    }

    let itemDetails = {};
    try {
      const items = assetIds.map(id => ({ itemType: 'Asset', id: id }));
      const detailsResult = await window.roblox.getCatalogItemDetails(items);
      if (detailsResult?.data) {
        detailsResult.data.forEach(item => {
          itemDetails[item.id] = item;
        });
      }
    } catch (e) {
      console.warn('Failed to load catalog item details:', e);
    }

    const economyDetails = await fetchInventoryEconomyDetails(assetIds);

    container.innerHTML = '';
    let currentRow = null;
    result.data.forEach((item, index) => {
      if (index % 6 === 0) {   // authentic 2013 inventory grid is 6 per row
        currentRow = document.createElement('tr');
        container.appendChild(currentRow);
      }

      const thumb = thumbnails[item.assetId] || 'images/spinners/spinner100x100.gif';
      const details = itemDetails[item.assetId] || {};
      const ecoData = economyDetails[item.assetId] || {};
      const creatorName = details.creatorName || 'ROBLOX';
      const creatorType = details.creatorType || 'User';

      const restrictions = details.itemRestrictions || [];
      const isLimited = restrictions.includes('Limited') || restrictions.includes('Collectible') || ecoData.isLimited;
      const isLimitedUnique = restrictions.includes('LimitedUnique') || ecoData.isLimitedUnique;

      let limitedOverlay = '';
      if (isLimitedUnique) {
        limitedOverlay = '<img src="images/assetIcons/limitedunique.png" class="limited-overlay" alt="Limited U"/>';
      } else if (isLimited) {
        limitedOverlay = '<img src="images/assetIcons/limited.png" class="limited-overlay" alt="Limited"/>';
      }

      const priceHtml = buildInventoryPriceHtml(details, ecoData);

      const td = document.createElement('td');
      td.className = 'Asset';
      td.setAttribute('valign', 'top');
      td.innerHTML = `
        <div style="padding: 5px">
          <div class="AssetThumbnail" style="position: relative;">
            <a href="javascript:void(0)" data-asset-id="${item.assetId}" class="inventory-item-link" title="${escapeHtml(item.assetName || item.name || 'Item')}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
              <img src="${thumb}" border="0" alt="${escapeHtml(item.assetName || item.name || 'Item')}" onerror="this.src='images/spinners/spinner100x100.gif'"/>
            </a>
            ${limitedOverlay}
          </div>
          <div class="AssetDetails">
            <div class="AssetName">
              <a href="javascript:void(0)" data-asset-id="${item.assetId}" class="inventory-item-link">${escapeHtml(item.assetName || item.name || 'Item')}</a>
            </div>
            <div class="AssetCreator">
              <span class="Label">Creator:</span> <span class="Detail">
                <a href="${creatorType === 'Group' ? '#group?id=' + details.creatorTargetId : '#profile?id=' + details.creatorTargetId}">${escapeHtml(creatorName)}</a>
              </span>
            </div>
            ${priceHtml}
          </div>
        </div>
      `;
      currentRow.appendChild(td);
    });

    currentAssetCursor = result.nextPageCursor || '';
    
    if (paginationEl) {
      const prevBtn = document.getElementById('AssetsPrevPage');
      const nextBtn = document.getElementById('AssetsNextPage');
      const pageInfo = document.getElementById('AssetsPageInfo');
      
      if (pageInfo) pageInfo.textContent = `Page ${currentAssetPage}`;
      
      if (prevBtn) {
        prevBtn.querySelector('.pager')?.classList.toggle('disabled', currentAssetPage <= 1);
        prevBtn.onclick = () => {
          if (currentAssetPage > 1) {
            currentAssetPage--;
            
            assetCursorHistory.pop();
            const prevCursor = assetCursorHistory.length > 0 ? assetCursorHistory[assetCursorHistory.length - 1] : '';
            loadInventoryCategory(userId, assetTypeId, prevCursor, true); 
          }
        };
      }
      
      if (nextBtn) {
        nextBtn.querySelector('.pager')?.classList.toggle('disabled', !currentAssetCursor);
        nextBtn.onclick = () => {
          if (currentAssetCursor) {
            currentAssetPage++;
            assetCursorHistory.push(currentAssetCursor);
            loadInventoryCategory(userId, assetTypeId, currentAssetCursor);
          }
        };
      }
      
      paginationEl.style.display = (currentAssetPage > 1 || currentAssetCursor) ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Failed to load inventory:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #cc0000; padding: 20px;">Failed to load inventory.</td></tr>';
  }
}

async function loadInventoryBadges(userId, cursor = '', isGoingBack = false) {
  const container = document.getElementById('AssetsList');
  const paginationEl = document.getElementById('AssetsPagination');
  
  if (!container) return;
  
  try {
    const result = await window.roblox.getUserBadges(userId, 10, cursor);
    
    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No items to display.</td></tr>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    const badgeIds = result.data.map(badge => badge.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getBadgeThumbnails(badgeIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load badge thumbnails:', e);
    }

    container.innerHTML = '';
    let currentRow = null;
    result.data.forEach((badge, index) => {
      if (index % 6 === 0) {   // authentic 2013 inventory grid is 6 per row
        currentRow = document.createElement('tr');
        container.appendChild(currentRow);
      }
      
      const thumb = thumbnails[badge.id] || 'images/spinners/spinner100x100.gif';
      
      const td = document.createElement('td');
      td.className = 'Asset';
      td.setAttribute('valign', 'top');
      td.innerHTML = `
        <div style="padding: 5px">
          <div class="AssetThumbnail" style="position: relative;">
            <a href="#badge?id=${badge.id}" title="${escapeHtml(badge.name || 'Badge')}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
              <img src="${thumb}" border="0" alt="${escapeHtml(badge.name || 'Badge')}" style="max-width:110px;max-height:110px;" onerror="this.src='images/spinners/spinner100x100.gif'"/>
            </a>
          </div>
          <div class="AssetDetails">
            <div class="AssetName">
              <a href="#badge?id=${badge.id}">${escapeHtml(badge.name || 'Badge')}</a>
            </div>
          </div>
        </div>
      `;
      currentRow.appendChild(td);
    });

    currentAssetCursor = result.nextPageCursor || '';
    
    if (paginationEl) {
      const prevBtn = document.getElementById('AssetsPrevPage');
      const nextBtn = document.getElementById('AssetsNextPage');
      const pageInfo = document.getElementById('AssetsPageInfo');
      
      if (pageInfo) pageInfo.textContent = `Page ${currentAssetPage}`;
      
      if (prevBtn) {
        prevBtn.querySelector('.pager')?.classList.toggle('disabled', currentAssetPage <= 1);
        prevBtn.onclick = () => {
          if (currentAssetPage > 1) {
            currentAssetPage--;
            assetCursorHistory.pop();
            const prevCursor = assetCursorHistory.length > 0 ? assetCursorHistory[assetCursorHistory.length - 1] : '';
            loadInventoryBadges(userId, prevCursor, true);
          }
        };
      }
      
      if (nextBtn) {
        nextBtn.querySelector('.pager')?.classList.toggle('disabled', !currentAssetCursor);
        nextBtn.onclick = () => {
          if (currentAssetCursor) {
            currentAssetPage++;
            assetCursorHistory.push(currentAssetCursor);
            loadInventoryBadges(userId, currentAssetCursor);
          }
        };
      }
      
      paginationEl.style.display = (currentAssetPage > 1 || currentAssetCursor) ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Failed to load badges:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #cc0000; padding: 20px;">Failed to load badges.</td></tr>';
  }
}

async function loadStuffPage(userId) {
  const container = document.getElementById('stuff-content');
  if (!container) return;

  if (!userId) {
    try {
      const currentUser = await window.RobloxClient.api.getCurrentUser();
      if (currentUser && currentUser.id) {
        userId = currentUser.id;
      }
    } catch (e) {
      console.error('Could not get current user:', e);
    }
  }

  if (!userId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px; color: #666;">
        <p style="font-size: 14px;">Please log in to view your inventory.</p>
      </div>
    `;
    return;
  }

  // Authentic /My/Stuff.aspx structure (reference/archive-stuff-2013.html): the same
  // #UserContainer > #UserAssetsPane > #AssetsMenu/#AssetsContent widget the Profile page's
  // Inventory section already ports faithfully — reused wholesale via renderProfileInventory,
  // minus Recommended Hats (not present on the standalone Stuff page). Header text "Inventory"
  // is verbatim from the archive (no username prefix on the real page).
  container.innerHTML = `
    <div class="MyRobloxContainer">
      <div id="UserContainer">
        <div id="UserAssetsPane">
          <h2 class="title" style="width:970px"><span>Inventory</span></h2>
          <div id="UserAssets">
            <div id="AssetsMenu" class="divider-right"></div>
            <div id="AssetsContent">
              <table id="AssetsList" cellspacing="0" border="0" style="border-collapse:collapse;"></table>
              <div id="AssetsPagination" class="FooterPager" style="display: none;">
                <a id="AssetsPrevPage" href="javascript:void(0)"><span class="pager previous"></span></a>
                <span id="AssetsPageInfo" style="margin: 0 15px;">Page 1</span>
                <a id="AssetsNextPage" href="javascript:void(0)"><span class="pager next"></span></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  await renderProfileInventory(userId, false);
}


  async function loadFriendsPage(userId) {
    const container = document.getElementById('friends-content');
    if (!container) return;

    if (!userId) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #666;">
          <p style="font-size: 14px;">No user specified.</p>
        </div>
      `;
      return;
    }

    // Faithful 2013 /My/EditFriends.aspx structure (reference/roblonium-editfriends.aspx):
    // tab-container (Friends/Friend Requests — Requests tab hidden unless viewing your own
    // friends list, matching the real page's login-owner-only feature) + .friends-container
    // tile grid, rendered by scripts/pages/friends.js.
    container.innerHTML = `
      <div id="FriendsLoading" style="text-align: center; padding: 60px;">
        <div class="loading">Loading friends...</div>
      </div>
      <div id="FriendsError" style="display: none; text-align: center; padding: 60px; color: #cc0000;">
        <p>Failed to load friends.</p>
      </div>
      <div class="MyRobloxContainer" id="FriendsContent" style="display: none;">
        <h1 id="FriendsPageHeader">My Friends</h1>
        <div id="FriendTabs" class="tab-container">
          <div class="tab active" data-id="friends_tab">Friends</div>
          <div class="tab" data-id="requests_tab" style="display: none;">Friend Requests</div>
        </div>
        <div class="tab-content active" id="friends_tab">
          <div class="friends-container" id="FriendsGrid"></div>
          <div class="friends-pager" id="FriendsPager"></div>
        </div>
        <div class="tab-content" id="requests_tab">
          <div class="requests-buttons">
            <a href="#" id="AcceptAllButton" class="btn-small btn-neutral">Accept All<span class="btn-text">Accept All</span></a>
            <a href="#" id="DeclineAllButton" class="btn-small btn-neutral">Decline All<span class="btn-text">Decline All</span></a>
          </div>
          <div class="friends-container" id="RequestsGrid"></div>
          <div class="friends-pager" id="RequestsPager"></div>
        </div>
      </div>
    `;

    if (window.FriendsPage) {
      window.FriendsPage.load();
    }
  }

  function loadPeoplePage() {
  const container = document.getElementById('people-content');
  if (container) {
    // Authentic Browse.aspx — the era's user search (the 2011 People.aspx was gone by 2013;
    // the nav linked People -> /Browse.aspx). FLAT late-2013 generation, transcribed VERBATIM
    // from reference/archive-browse-oct2013.html (+ the populated flat-era results capture
    // archive-browse-search-oct2014.html): plain 876x28 bar with .form-label "Search:"
    // (margin-right 30px), 400px box, native "Search Users" submit + "Search Groups" button,
    // then a 720px table.table of results. Right 160px column held an ad — omitted.
    container.innerHTML = `
      <div id="BrowseContainer" style="text-align: left">
        <div style="width: 876px; height: 28px; margin-bottom: 10px; clear: both;">
          <span class="form-label" style="margin-right: 30px;">Search: </span>
          <span>
            <span class="SearchBox"><input type="text" maxlength="100" id="SearchTextBox" style="width: 400px;"></span>
            <span class="SearchButton"><input type="submit" value="Search Users" id="SearchButton" class="translate"></span>
            <input type="button" id="GroupsSearchButton" class="translate" value="Search Groups">
          </span>
        </div>
        <div class="SearchError" id="peopleSearchError"></div>
        <div style="float:left;min-height:600px">
          <div id="UsersSearchedPane"></div>
        </div>
        <div style="float:right;width:160px;"></div>
        <br style="clear:both">
      </div>
    `;

    initPeopleSearch();
  }
}

function initPeopleSearch() {

  setTimeout(() => {
    const searchBtn = document.getElementById('SearchButton');
    const searchInput = document.getElementById('SearchTextBox');
    const groupsBtn = document.getElementById('GroupsSearchButton');

    if (searchBtn) {
      searchBtn.onclick = doPeopleSearch;
    }
    if (searchInput) {
      searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') doPeopleSearch();
      };
      // The real page focused the box on load ($("#...SearchTextBox").focus())
      searchInput.focus();
    }
    if (groupsBtn) {
      // The real button redirected to the groups search with the same keyword
      groupsBtn.onclick = () => {
        const kw = document.getElementById('SearchTextBox')?.value.trim();
        navigateTo('groups');
        if (kw) {
          setTimeout(() => {
            const gInput = document.getElementById('groups-search-input');
            const gBtn = document.getElementById('groups-search-btn');
            if (gInput && gBtn) { gInput.value = kw; gBtn.click(); }
          }, 150);
        }
      };
    }
  }, 0);
}

async function doPeopleSearch() {
  const input = document.getElementById('SearchTextBox');
  const errorBox = document.getElementById('peopleSearchError');
  const pane = document.getElementById('UsersSearchedPane');
  const query = input?.value.trim();

  if (!query) {
    errorBox.textContent = 'Please enter a username to search.';
    return;
  }

  errorBox.textContent = '';
  pane.innerHTML = '<div style="padding: 20px; color: #666;">Searching...</div>';

  try {
    const result = await window.roblox.searchUsers(query, 12);

    if (!result || !result.data || result.data.length === 0) {
      pane.innerHTML = '';
      errorBox.textContent = 'No users found.';
      return;
    }

    const users = result.data;
    const userIds = users.map(u => u.id);

    // Avatar thumbs (48x48 like the real t*ak.roblox.com tiles), presence for the
    // online-dot + Location/Last Seen column, and per-user info for the Blurb column.
    let thumbnails = {};
    let presence = {};
    const blurbs = {};
    const [thumbResult, presenceResult] = await Promise.all([
      window.roblox.getUserThumbnails(userIds, '48x48', 'Avatar').catch(() => null),
      window.roblox.getUserPresence(userIds).catch(() => null),
      Promise.all(users.map(u =>
        window.roblox.getUserInfo(u.id).then(info => { blurbs[u.id] = info?.description || ''; }).catch(() => {})
      ))
    ]);
    if (thumbResult?.data) thumbResult.data.forEach(t => { thumbnails[t.targetId] = t.imageUrl; });
    if (presenceResult?.userPresences) presenceResult.userPresences.forEach(p => { presence[p.userId] = p; });

    // Verbatim flat-era result grid: table.table 720px, tr.table-header, PLAIN rows
    // (separation = the .table td 1px #ccc top border), td.first on the first two cells,
    // "Last Seen" column, previous-usernames footnote line under the blurb.
    const rows = users.map((user) => {
      const name = escapeHtml(user.name);
      const thumb = thumbnails[user.id] || 'assets/ui/guest.png';
      const p = presence[user.id];
      const isOnline = p && p.userPresenceType > 0;
      let statusAlt, locationText;
      if (isOnline) {
        const where = p.lastLocation || 'Website';
        statusAlt = `${name} is online at ${escapeHtml(where)}.`;
        locationText = escapeHtml(where);
      } else {
        const lastSeen = p?.lastOnline
          ? new Date(p.lastOnline).toLocaleString('en-US', {
              month: 'numeric', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
            }).replace(',', '')
          : '';
        statusAlt = `${name} is offline${lastSeen ? ` (last seen at ${lastSeen}` : ''}.`;
        locationText = escapeHtml(lastSeen);
      }
      const prevNames = Array.isArray(user.previousUsernames) && user.previousUsernames.length
        ? escapeHtml(user.previousUsernames.join(', '))
        : '';
      return `
        <tr>
          <td class="first" style="width:50px;">
            <a title="${name}" href="#" onclick="navigateTo('profile', { userId: ${user.id} }); return false;" style="display:inline-block;height:48px;width:48px;cursor:pointer;" data-avatar-user-id="${user.id}"><img src="${thumb}" height="48" width="48" border="0" alt="${name}" onerror="this.src='assets/ui/guest.png'; this.onerror=null;"></a>
          </td><td class="first" style="width:7px;">
            <span class="OnlineStatus"><img src="images/${isOnline ? 'online' : 'offline'}.png" alt="${statusAlt}" style="border-width:0px;"></span>
          </td><td>
            <a href="#" onclick="navigateTo('profile', { userId: ${user.id} }); return false;">${name}</a>
          </td><td>
            <div style="width:400px;overflow:hidden;word-wrap:break-word;"><span>${escapeHtml(blurbs[user.id] || '')}</span></div>
            <div class="previous-usernames-container footnote" style="overflow:hidden;word-wrap:break-word;"><span>${prevNames}</span></div>
          </td><td>
            <span>${locationText}</span>
          </td>
        </tr>`;
    }).join('');

    pane.innerHTML = `
      <div>
        <table class="table" cellspacing="0" cellpadding="4" border="0" id="UsersSearchedGrid" style="width:720px;border-collapse:collapse;">
          <tr class="table-header">
            <th scope="col">Avatar</th><th scope="col">&nbsp;</th><th scope="col">Name</th><th scope="col">Blurb</th><th scope="col">Last Seen</th>
          </tr>${rows}
        </table>
      </div>`;

    // BC overlays exactly as the real page rendered them: a sibling img after the avatar,
    // align=left + position:relative;top:-12px, the *_small icon variants.
    for (const user of users) {
      const anchor = pane.querySelector(`a[data-avatar-user-id="${user.id}"]`);
      if (!anchor) continue;
      try {
        const hasPremium = await getPremiumStatus(user.id);
        if (hasPremium === true) {
          const bcType = isRandomizeBCEnabled() ? getBCTypeForUser(user.id) : 'OBC';
          const overlay = document.createElement('img');
          overlay.src = getBCOverlayImage(bcType, 'small');
          overlay.alt = bcType;
          overlay.setAttribute('align', 'left');
          overlay.style.cssText = 'position:relative;top:-12px;';
          anchor.appendChild(overlay);
        }
      } catch (e) {}
    }

  } catch (error) {
    console.error('Search error:', error);
    pane.innerHTML = '';
    errorBox.textContent = 'Failed to search users. Please try again.';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDescription(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

window.formatDescription = formatDescription;

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

function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'textContent') {
      el.textContent = value;
    } else if (key === 'innerHTML') {
      el.innerHTML = value;
    } else if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  });
  return el;
}

function showLoading(container) {
  container.innerHTML = '<div class="loading">Loading...</div>';
}

function showError(container, message) {
  container.innerHTML = `<div class="error">${message}</div>`;
}

function showErrorPage(errorReason, containerId) {
  
  let container;
  if (containerId) {
    container = document.getElementById(containerId);
  }

  if (!container) {
    container = document.getElementById('home-content') ||
                document.getElementById('catalog-content') ||
                document.getElementById('games-content') ||
                document.getElementById('profile-content') ||
                document.getElementById('friends-content') ||
                document.getElementById('groups-content') ||
                document.getElementById('inbox-content') ||
                document.getElementById('character-content') ||
                document.getElementById('badge-content') ||
                document.getElementById('bc-content') ||
                document.getElementById('people-content') ||
                document.querySelector('#Body > div[id$="-content"]') ||
                document.getElementById('Body');
  }

  if (!container) {
    console.error('Could not find container to show error page');
    return;
  }

  container.innerHTML = '';
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-page';
  errorDiv.style.cssText = 'text-align: center; padding: 40px 20px; font-family: Arial, Helvetica, sans-serif;';
  
  const h1 = document.createElement('h1');
  h1.className = 'error-page-title';
  h1.style.cssText = 'font-size: 24px; font-weight: bold; margin: 0 0 10px 0;';
  h1.textContent = 'Oops - page failure';
  
  const p = document.createElement('p');
  p.className = 'error-page-message';
  p.style.cssText = 'font-size: 18px; font-weight: bold; margin: 0 0 30px 0;';
  p.textContent = 'Error: ' + errorReason;
  
  const img = document.createElement('img');
  img.src = 'images/page_failure.png';
  img.alt = 'Error';
  img.style.cssText = 'margin: 20px 0;';
  
  const br = document.createElement('br');
  
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = 'display: inline-block; background-color: #0066cc; color: #fff; font-weight: bold; font-size: 14px; padding: 8px 20px; text-decoration: none; border: 2px outset #6699cc; cursor: pointer; margin-top: 20px;';
  btn.textContent = 'Go Back';
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    navigateTo('home');
  });
  
  errorDiv.appendChild(h1);
  errorDiv.appendChild(p);
  errorDiv.appendChild(img);
  errorDiv.appendChild(br);
  errorDiv.appendChild(btn);
  
  container.appendChild(errorDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.showErrorPage = showErrorPage;

let lastErrorTime = 0;
const ERROR_DEBOUNCE_MS = 2000;

function showErrorNotification(message) {
  
  const existing = document.getElementById('error-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'error-notification';
  notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #cc0000; color: white; padding: 12px 20px; border-radius: 4px; z-index: 10000; font-family: Arial, sans-serif; font-size: 12px; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
  notification.textContent = message;

  const closeBtn = document.createElement('span');
  closeBtn.textContent = ' ×';
  closeBtn.style.cssText = 'cursor: pointer; font-weight: bold; margin-left: 10px;';
  closeBtn.onclick = () => notification.remove();
  notification.appendChild(closeBtn);
  
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) notification.remove();
  }, 8000);
}
window.showErrorNotification = showErrorNotification;

function isCriticalError(error, filename) {
  
  if (filename && /\.(png|gif|jpg|jpeg|svg|ico|css)$/i.test(filename)) {
    return false;
  }

  if (error?.message?.includes('ResizeObserver')) {
    return false;
  }

  if (error instanceof SyntaxError || error instanceof ReferenceError || error instanceof TypeError) {
    return true;
  }

  const criticalPatterns = ['Cannot read', 'is not defined', 'is not a function', 'Failed to fetch', 'NetworkError'];
  if (error?.message && criticalPatterns.some(p => error.message.includes(p))) {
    return true;
  }
  
  return false;
}

function findActiveContentContainer() {
  
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const contentId = activePage.id.replace('page-', '') + '-content';
    const content = document.getElementById(contentId);
    if (content) return content;
  }

  return document.querySelector('[id$="-content"]:not(:empty)') ||
         document.getElementById('Body');
}

window.addEventListener('error', function(event) {
  console.error('Uncaught error:', event.error || event.message);

  const now = Date.now();
  if (now - lastErrorTime < ERROR_DEBOUNCE_MS) return;
  lastErrorTime = now;

  if (!event.error && event.message) {
    const isSyntaxError = event.message.includes('SyntaxError') || 
                          event.message.includes('Unexpected token') ||
                          event.message.includes('Unexpected identifier') ||
                          event.message.includes('Unexpected end of input') ||
                          event.message.includes('Invalid or unexpected token');
    
    if (isSyntaxError) {
      const filename = event.filename ? event.filename.split('/').pop() : 'unknown';
      const errorMsg = `Syntax error in ${filename} (line ${event.lineno}): ${event.message}`;
      console.error('Syntax error detected:', errorMsg);
      
      const container = findActiveContentContainer();
      if (container && window.showErrorPage) {
        window.showErrorPage(errorMsg, container.id);
      }
      return;
    }
  }

  if (!event.error) return;
  
  const errorMessage = event.error.message || 'Unknown error';
  
  if (isCriticalError(event.error, event.filename)) {
    
    const container = findActiveContentContainer();
    if (container && window.showErrorPage) {
      window.showErrorPage('JavaScript error: ' + errorMessage, container.id);
    }
  } else {
    
    showErrorNotification('Error: ' + errorMessage);
  }
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);

  const now = Date.now();
  if (now - lastErrorTime < ERROR_DEBOUNCE_MS) return;
  lastErrorTime = now;
  
  const reason = event.reason?.message || String(event.reason);

  if (!reason || reason === 'undefined' || reason === '[object Object]') return;

  const isCritical = reason.includes('Failed to fetch') || 
                     reason.includes('NetworkError') ||
                     reason.includes('net::ERR_') ||
                     reason.includes('ECONNREFUSED');
  
  if (isCritical) {
    const container = findActiveContentContainer();
    if (container && window.showErrorPage) {
      window.showErrorPage('Network error: ' + reason, container.id);
    }
  } else {
    
    showErrorNotification('Error: ' + reason);
  }
});

window.addEventListener('offline', function() {
  console.warn('Network connection lost');
  
  const notification = document.createElement('div');
  notification.id = 'offline-notification';
  notification.style.cssText = 'position: fixed; top: 30px; left: 50%; transform: translateX(-50%); background: #cc0000; color: white; padding: 10px 20px; border-radius: 4px; z-index: 10000; font-family: Arial, sans-serif; font-size: 12px;';
  notification.textContent = 'You are offline. Some features may not work.';
  document.body.appendChild(notification);
});

window.addEventListener('online', function() {
  console.log('Network connection restored');
  const notification = document.getElementById('offline-notification');
  if (notification) {
    notification.remove();
  }
});

let gameLaunchCancelled = false;

function showGameLaunchOverlay(statusText = 'Starting Roblox...') {
    gameLaunchCancelled = false;
    const overlay = document.getElementById('game-launch-overlay');
    const statusEl = document.getElementById('game-launch-status');
    const cancelBtn = document.getElementById('game-launch-cancel');
    
    if (overlay) {
        if (statusEl) statusEl.textContent = statusText;
        
        overlay.style.display = 'flex';

        if (cancelBtn) {
            cancelBtn.onclick = async (e) => {
                e.preventDefault();
                gameLaunchCancelled = true;

                if (statusEl) statusEl.textContent = 'Cancelling...';

                try {
                    if (window.roblox?.cancelGameLaunch) {
                        await window.roblox.cancelGameLaunch();
                        console.log('Game launch cancelled via API');
                    } else if (window.robloxAPI?.cancelGameLaunch) {
                        await window.robloxAPI.cancelGameLaunch();
                        console.log('Game launch cancelled via robloxAPI');
                    }
                } catch (err) {
                    console.error('Error cancelling game launch:', err);
                }
                
                hideGameLaunchOverlay();
            };
        }
    } else {
        console.error('[Overlay] Game launch overlay element not found!');
    }
}

function updateGameLaunchStatus(statusText) {
    const statusEl = document.getElementById('game-launch-status');
    if (statusEl) statusEl.textContent = statusText;
}

function hideGameLaunchOverlay() {
    const overlay = document.getElementById('game-launch-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function isGameLaunchCancelled() {
    return gameLaunchCancelled;
}

function autoHideGameLaunchOverlay(delay = 5000) {
    setTimeout(() => {
        if (!gameLaunchCancelled) {
            hideGameLaunchOverlay();
        }
    }, delay);
}

window.showGameLaunchOverlay = showGameLaunchOverlay;
window.updateGameLaunchStatus = updateGameLaunchStatus;
window.hideGameLaunchOverlay = hideGameLaunchOverlay;
window.isGameLaunchCancelled = isGameLaunchCancelled;
window.autoHideGameLaunchOverlay = autoHideGameLaunchOverlay;


// ============================================
// Party Game Launch Toast Notification
// ============================================

/**
 * Show a toast notification for party game launches
 * @param {Object} data - Game launch data { gameName, gameThumbnail, countdown, placeId }
 */
function showPartyGameLaunchToast(data) {
    // Remove any existing toast
    const existingToast = document.getElementById('party-game-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'party-game-toast';
    toast.className = 'party-game-toast';
    
    const thumbnailHtml = data.gameThumbnail 
        ? `<img src="${data.gameThumbnail}" alt="${data.gameName}" class="toast-game-icon" onerror="this.style.display='none'">`
        : '<div class="toast-game-icon-placeholder"></div>';
    
    toast.innerHTML = `
        <div class="toast-content">
            ${thumbnailHtml}
            <div class="toast-text">
                <div class="toast-title">Party Game Launch</div>
                <div class="toast-game-name">${data.gameName || 'Unknown Game'}</div>
                <div class="toast-countdown">Launching in <span id="toast-countdown-num">${data.countdown || 5}</span>s...</div>
            </div>
        </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('party-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'party-toast-styles';
        style.textContent = `
            .party-game-toast {
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #003366 0%, #004080 100%);
                border: 2px solid #0066cc;
                border-radius: 4px;
                padding: 12px;
                z-index: 100000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                animation: toast-slide-in 0.3s ease-out;
                max-width: 300px;
                font-family: Arial, sans-serif;
            }
            
            @keyframes toast-slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .party-game-toast .toast-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .party-game-toast .toast-game-icon {
                width: 56px;
                height: 56px;
                border-radius: 4px;
                object-fit: cover;
                flex-shrink: 0;
                border: 1px solid #0066cc;
            }
            
            .party-game-toast .toast-game-icon-placeholder {
                width: 56px;
                height: 56px;
                border-radius: 4px;
                background: #002244;
                flex-shrink: 0;
                border: 1px solid #0066cc;
            }
            
            .party-game-toast .toast-text {
                flex: 1;
                min-width: 0;
            }
            
            .party-game-toast .toast-title {
                font-size: 11px;
                color: #66b3ff;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 2px;
            }
            
            .party-game-toast .toast-game-name {
                font-size: 14px;
                color: #fff;
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            
            .party-game-toast .toast-countdown {
                font-size: 12px;
                color: #99ccff;
            }
            
            .party-game-toast .toast-countdown span {
                color: #ffcc00;
                font-weight: bold;
            }
            
            .party-game-toast.toast-fade-out {
                animation: toast-fade-out 0.3s ease-in forwards;
            }
            
            @keyframes toast-fade-out {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Countdown timer
    let countdown = data.countdown || 5;
    const countdownEl = document.getElementById('toast-countdown-num');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) {
            countdownEl.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            toast.classList.add('toast-fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    }, 1000);
    
    // Store interval for cleanup
    toast.dataset.intervalId = countdownInterval;
}

/**
 * Initialize party event listeners for themes
 */
function initPartyListeners() {
    if (window.roblox?.party?.onGameLaunching) {
        const cleanup = window.roblox.party.onGameLaunching((data) => {
            console.log('[2011 Theme] Party game launching:', data);
            showPartyGameLaunchToast(data);
            
            // Also launch the game after countdown
            if (data.placeId) {
                setTimeout(() => {
                    if (window.roblox?.launchGameDirect) {
                        window.roblox.launchGameDirect(data.placeId, data.gameName, data.gameThumbnail);
                    } else if (window.robloxAPI?.launchGameDirect) {
                        window.robloxAPI.launchGameDirect(data.placeId, data.gameName, data.gameThumbnail);
                    }
                }, (data.countdown || 5) * 1000);
            }
        });
        
        // Store cleanup function for later
        window._partyCleanup = cleanup;
    }
}

// Initialize party listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPartyListeners);
} else {
    initPartyListeners();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window._partyCleanup) {
        window._partyCleanup();
    }
});

// Export for external use
window.showPartyGameLaunchToast = showPartyGameLaunchToast;
