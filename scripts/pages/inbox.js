// Inbox — faithful 2013 /My/Messages port.
// Markup contract from the real 2013 Pages.Messages bundle (reference/authentic-js-messages-app-2013.js):
// jQuery-UI tabs (#MessagesTabs), .messageDivider rows with unread/read states, .singleMessage empty
// state, button strips (#inbox-general-buttons / #inbox-detail-buttons). Data layer is Rovloo's
// (window.roblox messages API); the Sent tab is a Rovloo extra (authentic tabs: Inbox/Notifications/Archive).

let currentTab = 'inbox';
let currentPage = 0;
let totalPages = 1;
let currentMessages = [];
let selectedMessageId = null;
let inboxInitialized = false;

async function loadInboxPage() {
    console.log('Loading inbox page...');

    if (!inboxInitialized) {
        initInboxTabs();
        initInboxButtons();
        inboxInitialized = true;
    }

    currentTab = 'inbox';
    currentPage = 0;

    setActiveInboxTab('inbox');
    showListView();

    await loadMessages('inbox', 0);
    await loadNotificationCount();
}

function setActiveInboxTab(tabName) {
    document.querySelectorAll('#MessagesTabs .ui-tabs-nav li').forEach(li => {
        const active = li.dataset.tab === tabName;
        li.classList.toggle('ui-tabs-active', active);
        li.classList.toggle('ui-state-active', active);
    });
}

function initInboxTabs() {
    document.querySelectorAll('#MessagesTabs .ui-tabs-nav li').forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabName = tab.dataset.tab;
            setActiveInboxTab(tabName);

            currentTab = tabName;
            currentPage = 0;

            showListView();

            if (tabName === 'notifications') {
                await loadNotifications();
            } else {
                await loadMessages(tabName, 0);
            }
        });
    });
}

function initInboxButtons() {

    document.getElementById('inbox-prev-btn')?.addEventListener('click', async () => {
        if (currentPage > 0) {
            currentPage--;
            await loadMessages(currentTab, currentPage);
        }
    });

    document.getElementById('inbox-next-btn')?.addEventListener('click', async () => {
        if (currentPage < totalPages - 1) {
            currentPage++;
            await loadMessages(currentTab, currentPage);
        }
    });

    document.getElementById('pm-back-btn')?.addEventListener('click', () => {
        showListView();
    });

    document.getElementById('inbox-select-all')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#MessagesInbox .message-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    document.getElementById('inbox-mark-read-btn')?.addEventListener('click', async () => {
        await markSelectedMessages('read');
    });

    document.getElementById('inbox-mark-unread-btn')?.addEventListener('click', async () => {
        await markSelectedMessages('unread');
    });
}

async function markSelectedMessages(action) {
    const checkboxes = document.querySelectorAll('#MessagesInbox .message-checkbox:checked');
    if (checkboxes.length === 0) {
        return;
    }

    const messageIds = Array.from(checkboxes)
        .map(cb => cb.dataset.messageId)
        .filter(id => id)
        .map(id => parseInt(id, 10));

    if (messageIds.length === 0) return;

    try {
        if (action === 'read') {
            await window.roblox.markMessagesRead(messageIds);
        } else {
            await window.roblox.markMessagesUnread(messageIds);
        }

        await loadMessages(currentTab, currentPage);

        const selectAll = document.getElementById('inbox-select-all');
        if (selectAll) selectAll.checked = false;

    } catch (error) {
        console.error(`Failed to mark messages as ${action}:`, error);
    }
}

function inboxLoadingState(text) {
    // Authentic empty/status idiom: span.singleMessage (Resources.Messages strings)
    return `<span class="singleMessage">${text}</span>`;
}

async function loadMessages(tab, pageNumber) {
    const list = document.getElementById('MessagesInbox');
    if (!list) return;

    list.innerHTML = inboxLoadingState('Loading messages...');

    try {
        const response = await window.roblox.getMessages(tab, pageNumber, 20);

        currentMessages = response.collection || [];
        totalPages = response.totalPages || 1;

        updatePagination();
        await renderMessages(currentMessages);

    } catch (error) {
        console.error('Failed to load messages:', error);
        // Authentic error string from the real Resources.Messages bundle
        list.innerHTML = inboxLoadingState("We're sorry; an unexpected error occurred. Please refresh the page or try again.");
    }
}

async function renderMessages(messages) {
    const list = document.getElementById('MessagesInbox');
    if (!list) return;

    if (!messages || messages.length === 0) {
        // Authentic string from Resources.Messages
        list.innerHTML = inboxLoadingState('You have no messages.');
        return;
    }

    const isSentTab = currentTab === 'sent';

    // Authentic 2013 row: .sub-divider-bottom.messageDivider.(unread|read) >
    //   label.messageCheckbox + .roblox-avatar-image (48px headshot) +
    //   .roblox-message-summary > .wrappedText (bold sender <br> subject - excerpt) + .messageDate
    list.innerHTML = messages.map(msg => {
        const isUnread = !msg.isRead && !isSentTab;
        const stateClass = isUnread ? 'unread' : 'read';
        const date = formatMessageDate(msg.created);
        const counterpart = isSentTab ? msg.recipient : msg.sender;
        const personName = counterpart?.displayName || counterpart?.name || 'Unknown';
        const personId = counterpart?.id || 0;
        const excerpt = (msg.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

        return `
            <div class="sub-divider-bottom messageDivider ${stateClass} roblox-message-row" data-messageid="${msg.id}">
                <label class="messageCheckbox roblox-inboxCheckbox">
                    <input type="checkbox" class="message-checkbox" data-message-id="${msg.id}">
                </label>
                <div class="roblox-avatar-image">
                    <a href="#" data-user-id="${personId}" class="inbox-user-link">
                        <img src="images/spinners/spinner100x100.gif" data-avatar-userid="${personId}" width="48" height="48" border="0" alt="${escapeHtml(personName)}"/>
                    </a>
                </div>
                <div class="roblox-messageRow roblox-message-summary">
                    <div class="wrappedText notranslate">
                        <span class="positionAboveLink">${escapeHtml(personName)}</span>
                        <br />
                        <span class="subject notranslate">${escapeHtml(msg.subject || '(No Subject)')}</span>&nbsp;-&nbsp;
                        <span>${escapeHtml(excerpt)}</span>
                    </div>
                    <span class="messageDate ${stateClass}">${date}</span>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.messageDivider').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox' || e.target.closest('.inbox-user-link')) return;
            const messageId = row.dataset.messageid;
            const message = currentMessages.find(m => String(m.id) === messageId);
            if (message) {
                showMessageDetail(message);
            }
        });
    });

    list.querySelectorAll('.inbox-user-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const userId = link.dataset.userId;
            if (userId && userId !== '0') {
                navigateTo('profile', { userId });
            }
        });
    });

    // Hydrate the 48px headshots in one batch (authentic rows carried AvatarImage widgets)
    const userIds = [...new Set(messages
        .map(m => (isSentTab ? m.recipient : m.sender)?.id)
        .filter(id => id))];
    if (userIds.length > 0) {
        try {
            const avatars = await window.roblox.getUserThumbnails(userIds, '48x48', 'Headshot');
            if (avatars?.data) {
                avatars.data.forEach(t => {
                    if (t.targetId && t.imageUrl) {
                        list.querySelectorAll(`img[data-avatar-userid="${t.targetId}"]`).forEach(img => {
                            img.src = t.imageUrl;
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to load message avatars:', e);
        }
    }
}

async function showMessageDetail(message) {
    selectedMessageId = message.id;

    if (!message.isRead) {
        try {
            await window.roblox.markMessagesRead([message.id]);
            message.isRead = true;

            // Authentic behaviour: the row flips unread -> read when opened
            const row = document.querySelector(`#MessagesInbox .messageDivider[data-messageid="${message.id}"]`);
            if (row) {
                row.classList.remove('unread');
                row.classList.add('read');
            }
        } catch (e) {
            console.warn('Failed to mark message as read:', e);
        }
    }

    document.getElementById('pm-date').textContent = formatMessageDate(message.created, true);
    document.getElementById('pm-subject').textContent = message.subject || '(No Subject)';

    const bodyEl = document.getElementById('pm-body');
    if (bodyEl) {
        bodyEl.innerHTML = sanitizeMessageBody(message.body || '');
    }

    const counterpart = (currentTab === 'sent' ? message.recipient : message.sender) || {};
    const personName = counterpart.displayName || counterpart.name || 'Unknown';
    const senderLink = document.getElementById('pm-sender-link');
    if (senderLink) {
        senderLink.textContent = personName;
        senderLink.onclick = (e) => {
            e.preventDefault();
            if (counterpart.id) {
                navigateTo('profile', { userId: counterpart.id });
            }
        };
    }
    const avatarLink = document.getElementById('pm-sender-avatar-link');
    if (avatarLink) {
        avatarLink.onclick = (e) => {
            e.preventDefault();
            if (counterpart.id) {
                navigateTo('profile', { userId: counterpart.id });
            }
        };
    }

    const avatarImg = document.getElementById('pm-avatar-img');
    if (avatarImg) {
        avatarImg.src = 'images/spinners/spinner100x100.gif';
        if (counterpart.id) {
            try {
                const avatars = await window.roblox.getUserThumbnails([counterpart.id], '150x150', 'AvatarBust');
                if (avatars?.data?.[0]?.imageUrl) {
                    avatarImg.src = avatars.data[0].imageUrl;
                }
            } catch (e) {
                console.warn('Failed to load sender avatar:', e);
            }
        }
    }

    // Authentic strip swap: general buttons+list hide, detail buttons+pane show
    document.getElementById('inbox-general-buttons').style.display = 'none';
    document.getElementById('inbox-detail-buttons').style.display = 'block';
    document.getElementById('MessagesInbox').style.display = 'none';
    document.getElementById('MessagesDetailInbox').style.display = 'block';
}

function showListView() {
    document.getElementById('inbox-general-buttons').style.display = 'block';
    document.getElementById('inbox-detail-buttons').style.display = 'none';
    document.getElementById('MessagesInbox').style.display = 'block';
    document.getElementById('MessagesDetailInbox').style.display = 'none';
    selectedMessageId = null;
}

function updatePagination() {
    const prevBtn = document.getElementById('inbox-prev-btn');
    const nextBtn = document.getElementById('inbox-next-btn');
    const pageInfo = document.getElementById('inbox-page-info');

    // Silver pager arrows grey out via the sprite's disabled band (theme-wide idiom)
    prevBtn?.querySelector('.pager')?.classList.toggle('disabled', currentPage <= 0);
    nextBtn?.querySelector('.pager')?.classList.toggle('disabled', currentPage >= totalPages - 1);
    if (pageInfo) pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
}

async function loadNotificationCount() {
    try {
        const count = await window.roblox.getUnreadNotificationsCount();
        const countEl = document.getElementById('inbox-notif-count');
        if (countEl) {
            countEl.textContent = count.unreadNotifications || 0;
        }
    } catch (e) {
        console.warn('Failed to load notification count:', e);
    }
}

async function loadNotifications() {
    const list = document.getElementById('MessagesInbox');
    if (!list) return;

    list.innerHTML = inboxLoadingState('Loading notifications...');

    try {
        const response = await window.roblox.getRecentNotifications(20, 0);
        const notifications = response || [];

        if (!notifications.length) {
            list.innerHTML = inboxLoadingState('You have no notifications.');
            return;
        }

        // Authentic notifications tab: header line + expandable .roblox-notificationRow rows
        // (the 2013 app slides the notification body open on click)
        let html = '<div class="notifications-header">Notifications are important messages from ROBLOX.</div>';
        html += notifications.map((notif, i) => {
            const date = formatMessageDate(notif.eventDate);
            const content = notif.content?.states?.default?.visualItems?.textBody?.[0]?.label?.text || 'Notification';

            return `
                <div class="sub-divider-bottom messageDivider roblox-notificationRow" data-notif-index="${i}">
                    <div class="clearfix" style="padding-left: 12px;">
                        <div class="roblox-avatar-image">
                            <img src="images/Icons/roblox_16x15.png" width="16" height="15" border="0" alt="ROBLOX" style="margin-top: 16px;"/>
                        </div>
                        <div class="roblox-message-title clearfix">
                            <span class="roblox-message-subject">
                                <b>ROBLOX</b>
                                <br />
                                ${escapeHtml(content).slice(0, 160)}
                            </span>
                            <span class="greyedout" style="float: right;">${date}</span>
                        </div>
                    </div>
                    <div class="messageDivider notificationBody" style="display: none;">
                        <span>${escapeHtml(content)}</span>
                    </div>
                </div>
            `;
        }).join('');

        list.innerHTML = html;

        // Authentic expand/collapse (the 2013 JS slideToggles the body)
        list.querySelectorAll('.roblox-notificationRow').forEach(row => {
            row.addEventListener('click', () => {
                const body = row.querySelector('.notificationBody');
                if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
            });
        });

    } catch (error) {
        console.error('Failed to load notifications:', error);
        list.innerHTML = inboxLoadingState("We're sorry; an unexpected error occurred. Please refresh the page or try again.");
    }
}

function formatMessageDate(dateStr, includeTime = false) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    if (includeTime) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
    }

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeMessageBody(html) {

    let clean = html
        .replace(/<br\s*\/?>/gi, '<br>')
        .replace(/\r\n/g, '<br>')
        .replace(/\n/g, '<br>');

    const temp = document.createElement('div');
    temp.innerHTML = clean;

    temp.querySelectorAll('script, style').forEach(el => el.remove());

    temp.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return temp.innerHTML;
}
