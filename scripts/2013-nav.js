/**
 * 2013 ROBLOX Theme - Navigation Script
 */

// Update 2013 header based on login state
function update2013Header(isLoggedIn, userData) {
    const loginContainer = document.getElementById('loginContainer');
    const logoutContainer = document.getElementById('logoutContainer');
    const userWrapper = document.getElementById('AuthenticatedUserNameWrapper');
    const userDivider = document.getElementById('userDivider');
    const ticketsContainer = document.getElementById('ticketsContainer');
    const robuxContainer = document.getElementById('robuxContainer');
    const currencyDivider = document.getElementById('currencyDivider');
    const friendsContainer = document.getElementById('friendsContainer');
    const messagesContainer = document.getElementById('messagesContainer');
    const msgDivider = document.getElementById('msgDivider');
    const subNav = document.getElementById('SubNav2013');
    const submenuSpacer = document.getElementById('submenuSpacer');
    
    if (isLoggedIn && userData) {
        // Show logged-in elements
        if (loginContainer) loginContainer.style.display = 'none';
        if (logoutContainer) logoutContainer.style.display = '';
        if (userWrapper) userWrapper.style.display = '';
        if (userDivider) userDivider.style.display = '';
        if (ticketsContainer) ticketsContainer.style.display = '';
        if (robuxContainer) robuxContainer.style.display = '';
        if (currencyDivider) currencyDivider.style.display = '';
        if (friendsContainer) friendsContainer.style.display = '';
        if (messagesContainer) messagesContainer.style.display = '';
        if (msgDivider) msgDivider.style.display = '';
        if (subNav) subNav.style.display = '';
        if (submenuSpacer) submenuSpacer.style.display = '';
        
        // Update username
        const displayUsername = document.getElementById('displayUsername');
        if (displayUsername && userData.name) {
            displayUsername.textContent = userData.name;
        }
        
        // Update currency
        const ticketsCaption = document.getElementById('TicketsAlertCaption');
        const robuxCaption = document.getElementById('RobuxAlertCaption');
        if (ticketsCaption) ticketsCaption.textContent = formatNumber(userData.tickets || 0);
        if (robuxCaption) robuxCaption.textContent = formatNumber(userData.robux || 0);
        
        // 13+ icon
        const over13icon = document.getElementById('over13icon');
        if (over13icon) over13icon.style.display = userData.isOver13 ? '' : 'none';
        
        // Friend requests
        const friendsBubble = document.getElementById('FriendsBubble');
        const friendsText = document.getElementById('FriendsAlertText');
        if (friendsBubble && friendsText && userData.friendRequests > 0) {
            friendsBubble.style.display = '';
            friendsText.textContent = userData.friendRequests;
        }
    } else {
        // Show logged-out elements
        if (loginContainer) loginContainer.style.display = '';
        if (logoutContainer) logoutContainer.style.display = 'none';
        if (userWrapper) userWrapper.style.display = 'none';
        if (userDivider) userDivider.style.display = 'none';
        if (ticketsContainer) ticketsContainer.style.display = 'none';
        if (robuxContainer) robuxContainer.style.display = 'none';
        if (currencyDivider) currencyDivider.style.display = 'none';
        if (friendsContainer) friendsContainer.style.display = 'none';
        if (messagesContainer) messagesContainer.style.display = 'none';
        if (msgDivider) msgDivider.style.display = 'none';
        if (subNav) subNav.style.display = 'none';
        if (submenuSpacer) submenuSpacer.style.display = 'none';
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Logout handler
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('lsLoginStatus');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof window.logout === 'function') {
                window.logout();
            } else if (typeof window.electronAPI !== 'undefined' && window.electronAPI.logout) {
                window.electronAPI.logout();
            }
        });
    }
});

// Listen for login state changes
window.addEventListener('loginStateChanged', function(e) {
    update2013Header(e.detail.isLoggedIn, e.detail.userData);
});

window.update2013Header = update2013Header;
