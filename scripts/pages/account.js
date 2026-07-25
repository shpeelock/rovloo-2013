// Settings — Rovloo's own config page (theme / performance / blacklist). Not an attempt at an
// authentic Roblox Account page; the tab widget is reused from main-bundle-2013.css but the
// content is this build's own settings, organized by what it is.

(function() {
    'use strict';

    let tabsInitialized = false;

    function loadAccountPage() {
        if (!tabsInitialized) {
            initTabs();
            tabsInitialized = true;
        }
    }

    function initTabs() {
        document.querySelectorAll('#page-account .tab-container .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#page-account .tab-container .tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#page-account .tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.id)?.classList.add('active');
            });
        });
    }

    window.loadAccountPage = loadAccountPage;
})();
