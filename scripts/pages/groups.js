

let groupsInitialized = false;
let currentSearchCursor = '';
let currentSearchKeyword = '';
let searchCursorHistory = []; 
let currentSearchPage = 1;
let currentGroupId = null;
let currentRoleId = null;
let membersCache = [];
let membersApiCursor = '';
let membersHasMore = true;
let membersFetchCtx = null;
let currentMembersPage = 1;
const MEMBERS_PER_PAGE = 8;
let wallCursor = '';
let wallCursorHistory = []; 
let currentWallPage = 1;
let wallPostsCache = []; 
let wallHasMore = true; 
let currentUserId = null;

const WALL_POSTS_PER_PAGE = 8;

let myGroupRoles = {};
let myGroupsRailData = [];
let myGroupsRailPage = 0;
const RAIL_GROUPS_PER_PAGE = 10;

// Render the current page of the left rail + CarouselPager arrow states.
function renderMyGroupsRail() {
  const container = document.getElementById('my-groups-list');
  if (!container) return;
  const totalPages = Math.max(1, Math.ceil(myGroupsRailData.length / RAIL_GROUPS_PER_PAGE));
  if (myGroupsRailPage >= totalPages) myGroupsRailPage = totalPages - 1;
  const slice = myGroupsRailData.slice(myGroupsRailPage * RAIL_GROUPS_PER_PAGE, (myGroupsRailPage + 1) * RAIL_GROUPS_PER_PAGE);
  container.innerHTML = slice.map(g => `
        <div class="GroupListItemContainer" data-group-id="${g.id}" onclick="loadGroupDetail(${g.id})">
          <div class="GroupListImageContainer"><img src="${g.thumb}" alt="${escapeHtml(g.name)}" width="32" height="32"></div>
          <div class="GroupListName"><a href="#" onclick="return false;">${escapeHtml(g.name)}</a></div>
          <div style="clear: left;"></div>
        </div>`).join('');
  if (currentGroupId) {
    container.querySelectorAll('.GroupListItemContainer').forEach(row => {
      row.classList.toggle('selected', String(row.dataset.groupId) === String(currentGroupId));
    });
  }
  document.getElementById('my-groups-up')?.classList.toggle('disabled', myGroupsRailPage === 0);
  document.getElementById('my-groups-down')?.classList.toggle('disabled', myGroupsRailPage >= totalPages - 1);
}

document.addEventListener('pageChange', async (e) => {
  if (e.detail.page === 'groups') {
    await initGroupsPage(e.detail.params);
  }
});

async function initGroupsPage(params = {}) {
  
  if (!groupsInitialized) {
    setupGroupsEventListeners();
    groupsInitialized = true;
  }

  if (params.groupId) {
    await loadGroupDetail(params.groupId);
    return;
  }

  // Default = the My/Groups three-column view with the first rail group loaded (the real
  // My/Groups.aspx always showed a selected group). Logged-out users get the search page —
  // the real site's Groups link went to Groups/Search.aspx when there was no My/Groups.
  await loadMyGroups();

  if (myGroupsRailData.length > 0) {
    showMyGroupsView();
    if (!currentGroupId) await loadGroupDetail(myGroupsRailData[0].id);
  } else {
    showGroupsSearch();
  }
}

function showMyGroupsView() {
  document.getElementById('groups-search-view').style.display = 'none';
  document.getElementById('groups-my-view').style.display = 'block';
}

function setupGroupsEventListeners() {
  
  function runGroupSearch(keyword) {
    // The authentic SearchControls input carries a "Search all groups" watermark — ignore it.
    if (!keyword || keyword === 'Search all groups') return;
    currentSearchKeyword = keyword;
    currentSearchCursor = '';
    searchCursorHistory = [];
    currentSearchPage = 1;
    showGroupsSearch();
    // Keep the search page's own (blue-bar) box in sync with wherever the search came from
    const blueBox = document.getElementById('GroupsSearchTextBox');
    if (blueBox) blueBox.value = keyword;
    searchGroups(keyword);
  }

  document.getElementById('groups-search-btn')?.addEventListener('click', () => {
    runGroupSearch(document.getElementById('groups-search-input').value.trim());
  });

  document.getElementById('groups-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runGroupSearch(e.target.value.trim());
  });

  // Groups/Search.aspx blue bar: "Search Groups" submit + "Search Users" -> Browse.aspx (people)
  document.getElementById('SearchGroupsSubmit')?.addEventListener('click', () => {
    runGroupSearch(document.getElementById('GroupsSearchTextBox').value.trim());
  });
  document.getElementById('GroupsSearchTextBox')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runGroupSearch(e.target.value.trim());
  });
  document.getElementById('SearchUsersFromGroupsBtn')?.addEventListener('click', () => {
    const kw = document.getElementById('GroupsSearchTextBox')?.value.trim();
    navigateTo('people');
    if (kw) {
      setTimeout(() => {
        const uInput = document.getElementById('SearchTextBox');
        const uBtn = document.getElementById('SearchButton');
        if (uInput && uBtn) { uInput.value = kw; uBtn.click(); }
      }, 150);
    }
  });

  document.getElementById('groups-prev-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentSearchPage > 1) {
      currentSearchPage--;
      
      const prevCursor = currentSearchPage === 1 ? '' : searchCursorHistory[currentSearchPage - 2] || '';
      searchGroups(currentSearchKeyword, prevCursor, true);
    }
  });

  document.getElementById('groups-next-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentSearchCursor) {
      
      searchCursorHistory[currentSearchPage - 1] = currentSearchCursor;
      currentSearchPage++;
      searchGroups(currentSearchKeyword, currentSearchCursor);
    }
  });

  document.getElementById('group-back-btn')?.addEventListener('click', () => {
    showGroupsSearch();
  });

  // Rail CarouselPager arrows page the My Groups list
  document.getElementById('my-groups-up')?.addEventListener('click', () => {
    if (myGroupsRailPage > 0) { myGroupsRailPage--; renderMyGroupsRail(); }
  });
  document.getElementById('my-groups-down')?.addEventListener('click', () => {
    const totalPages = Math.ceil(myGroupsRailData.length / RAIL_GROUPS_PER_PAGE);
    if (myGroupsRailPage < totalPages - 1) { myGroupsRailPage++; renderMyGroupsRail(); }
  });

  // Group creation isn't supported in Rovloo — open the real site's create page
  document.getElementById('CreateGroupBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.roblox?.openExternal) {
      window.roblox.openExternal('https://www.roblox.com/groups/create');
    }
  });

  document.getElementById('group-join-btn')?.addEventListener('click', async () => {
    if (currentGroupId) {
      await joinGroup(currentGroupId);
    }
  });

  document.getElementById('group-leave-btn')?.addEventListener('click', async () => {
    if (currentGroupId) {
      await leaveGroup(currentGroupId);
    }
  });

  // Members pager walks the client-side cache 8 at a time (the API only pages by 10/25/50/100,
  // so displayMembersPage refills the cache from the cursor as needed — same pattern as the wall).
  document.getElementById('members-prev-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentMembersPage > 1 && currentGroupId) {
      currentMembersPage = 1;
      displayMembersPage();
    }
  });

  document.getElementById('members-prev-page-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentMembersPage > 1 && currentGroupId) {
      currentMembersPage--;
      displayMembersPage();
    }
  });

  document.getElementById('members-next-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentGroupId && (membersCache.length > currentMembersPage * MEMBERS_PER_PAGE || membersHasMore)) {
      currentMembersPage++;
      displayMembersPage();
    }
  });

  document.getElementById('wall-next-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentGroupId) {
      currentWallPage++;
      displayWallPage();
    }
  });
  
  document.getElementById('wall-prev-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentWallPage > 1 && currentGroupId) {
      currentWallPage--;
      displayWallPage();
    }
  });
}

async function loadMyGroups() {
  const container = document.getElementById('my-groups-list');
  if (!container) return;
  
  try {
    const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
    if (!isLoggedIn) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">Login to see your groups</div>';
      return;
    }
    
    const currentUser = await window.RobloxClient.api.getCurrentUser();
    if (!currentUser) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">Could not load user info</div>';
      return;
    }
    
    const groups = await window.roblox.getUserGroups(currentUser.id);

    if (!groups?.data || groups.data.length === 0) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">You are not in any groups</div>';
      return;
    }

    // Cache each group's role name for the .MyRank line on the detail view
    myGroupRoles = {};
    groups.data.forEach(item => {
      if (item.role?.name) myGroupRoles[item.group.id] = item.role.name;
    });

    const groupIds = groups.data.map(g => g.group.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getGroupThumbnails(groupIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load group thumbnails:', e);
    }
    
    // Authentic My/Groups.aspx rail rows (real ~/CSS/Pages/Groups/Groups.css vocabulary):
    // .GroupListItemContainer > .GroupListImageContainer (32px icon, white-bordered) +
    // .GroupListName (11px, black, bold+arrow when .selected). Row click loads the group.
    // Paged vertically via the CarouselPager up/down arrows (btn-arrowsprite sprite).
    myGroupsRailData = groups.data.map(item => ({
      id: item.group.id,
      name: item.group.name,
      thumb: thumbnails[item.group.id] || 'images/spinners/spinner100x100.gif'
    }));
    myGroupsRailPage = 0;
    renderMyGroupsRail();

  } catch (error) {
    console.error('Failed to load my groups:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load groups: ' + error.message, 'groups-content');
    } else {
      container.innerHTML = '<div style="color: #cc0000; padding: 10px;">Failed to load groups</div>';
    }
  }
}

async function searchGroups(keyword, cursor = '', isGoingBack = false) {
  const resultsBox = document.getElementById('groups-search-results');
  const pagination = document.getElementById('groups-search-pagination');
  const errorBox = document.getElementById('groups-search-error');

  if (!resultsBox) return;

  errorBox.textContent = '';
  resultsBox.innerHTML = '<div style="padding: 20px; color: #666;">Searching...</div>';

  try {

    const searchCursor = (isGoingBack && searchCursorHistory.length === 0) ? '' : cursor;
    const results = await window.roblox.searchGroups(keyword, 10, searchCursor);

    if (!results?.data || results.data.length === 0) {
      resultsBox.innerHTML = '';
      pagination.style.display = 'none';
      errorBox.textContent = 'No groups found.';
      return;
    }

    const groupIds = results.data.map(g => g.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getGroupThumbnails(groupIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load group thumbnails:', e);
    }

    // Verbatim Oct-2013 Groups/Search.aspx result grid (the FLAT generation): table.table 720px,
    // tr.table-header (blank | Group | Description | Members | Public), PLAIN rows (no
    // alternating classes — separation is the .table td 1px #ccc top border), 48x48 emblem
    // links, descriptions truncated to ~200 chars with the FULL text in title, raw member
    // counts (the real page printed 4199, not 4,199).
    const rows = results.data.map((group) => {
      const thumb = thumbnails[group.id] || 'images/spinners/spinner100x100.gif';
      const name = escapeHtml(group.name);
      const fullDesc = group.description || '';
      const shortDesc = fullDesc.length > 200 ? fullDesc.substring(0, 200) : fullDesc;
      return `
        <tr>
          <td>
            <a class="group-search-image-link" title="${name}" href="#" onclick="loadGroupDetail(${group.id}); return false;" style="display:inline-block;height:48px;width:48px;cursor:pointer;"><img src="${thumb}" height="48" width="48" border="0" alt="${name}"></a>
          </td><td>
            <div style="overflow: hidden;"><div title="${name}">
              <a href="#" onclick="loadGroupDetail(${group.id}); return false;" class="group-search-name-link">${name}</a>
            </div></div>
          </td><td>
            <div style="overflow:hidden;width:400px;word-wrap:break-word;"><span title="${escapeHtml(fullDesc)}" class="group-search-description">${escapeHtml(shortDesc)}</span></div>
          </td><td>
            ${group.memberCount || 0}
          </td><td>
            ${group.publicEntryAllowed ? 'Yes' : 'No'}
          </td>
        </tr>`;
    }).join('');

    resultsBox.innerHTML = `
      <div>
        <table class="table" cellspacing="0" cellpadding="4" border="0" id="GroupsSearchResultsGrid" style="width:720px;border-collapse:collapse;">
          <tr class="table-header">
            <th scope="col">&nbsp;</th><th scope="col">Group</th><th scope="col">Description</th><th scope="col">Members</th><th scope="col">Public</th>
          </tr>${rows}
        </table>
      </div>`;

    currentSearchCursor = results.nextPageCursor || '';

    // Authentic centered "Pages:" pager — "<< Prev" only past page 1, "Next >>" while a cursor remains
    document.getElementById('groups-page-info').style.display = 'none';
    document.getElementById('groups-prev-btn').style.display = currentSearchPage > 1 ? 'inline' : 'none';
    document.getElementById('groups-next-btn').style.display = currentSearchCursor ? 'inline' : 'none';
    pagination.style.display = (currentSearchPage > 1 || currentSearchCursor) ? 'block' : 'none';

  } catch (error) {
    console.error('Failed to search groups:', error);
    resultsBox.innerHTML = '';
    errorBox.textContent = 'Search failed. Please try again.';
  }
}

async function loadGroupDetail(groupId) {
  currentGroupId = groupId;

  showMyGroupsView();
  document.getElementById('group-detail-view').style.display = 'block';

  // Mark the selected group in the left rail (authentic .selected arrow + bold name).
  document.querySelectorAll('#my-groups-list .GroupListItemContainer').forEach(row => {
    row.classList.toggle('selected', String(row.dataset.groupId) === String(groupId));
  });

  currentMembersPage = 1;
  wallCursor = '';
  currentRoleId = null;

  // Immediate loading state — with rate-limit protection the fetch can take a while,
  // and leaving the previous group's data on screen reads as "nothing happened".
  document.getElementById('group-detail-name').textContent = 'Loading group...';
  document.getElementById('group-detail-description').textContent = 'Loading description...';
  document.getElementById('group-detail-emblem').src = 'images/spinners/spinner100x100.gif';
  document.getElementById('group-owner-link').textContent = 'Loading...';
  document.getElementById('group-status-box').style.display = 'none';
  document.getElementById('group-my-rank').style.display = 'none';
  document.getElementById('group-join-container').style.display = 'none';
  const rightColumn = document.getElementById('right-column');
  if (rightColumn) rightColumn.style.display = 'none';
  const membersGrid = document.getElementById('group-members-grid');
  if (membersGrid) membersGrid.innerHTML = '<div style="color: #666; text-align: center;">Loading members...</div>';
  const wallContainer = document.getElementById('group-wall-container');
  if (wallContainer) wallContainer.innerHTML = '<div style="color: #666; text-align: center; padding: 10px;">Loading wall posts...</div>';

  const wallSection = document.getElementById('group-wall-section');
  if (wallSection) {
    wallSection.style.display = '';
  }

  try {

    const group = await window.roblox.getGroup(groupId);

    // The user may have clicked another group while this one was loading — the newer
    // load owns the view now, so drop this one instead of racing it.
    if (currentGroupId !== groupId) return;
    
    if (!group) {
      document.getElementById('group-detail-name').textContent = 'Group not found';
      return;
    }

    document.getElementById('group-detail-name').textContent = group.name;
    document.getElementById('group-detail-description').innerHTML = window.formatDescription ? window.formatDescription(group.description) : escapeHtml(group.description || 'No description');

    const emblemLink = document.getElementById('group-emblem-link');
    if (emblemLink) {
      emblemLink.title = group.name;
    }

    // Fired without await — the emblem fills in whenever it arrives instead
    // of gating the rest of the page.
    const emblemPromise = window.roblox.getGroupThumbnails([groupId], '150x150')
      .then(thumbResult => {
        if (currentGroupId !== groupId) return;
        if (thumbResult?.data?.[0]?.imageUrl) {
          document.getElementById('group-detail-emblem').src = thumbResult.data[0].imageUrl;
          document.getElementById('group-detail-emblem').alt = group.name;
        }
      })
      .catch(e => console.warn('Failed to load group emblem:', e));

    if (group.owner) {
      const ownerLink = document.getElementById('group-owner-link');
      ownerLink.textContent = group.owner.username || group.owner.displayName;
      ownerLink.href = '#';
      ownerLink.onclick = () => {
        
        const ownerId = group.owner.userId || group.owner.id;
        navigateTo('profile', { userId: ownerId });
        return false;
      };
    } else {
      document.getElementById('group-owner-link').textContent = 'No owner';
    }

    const statusBox = document.getElementById('group-status-box');
    
    if (group.shout && group.shout.body) {
      document.getElementById('group-status-text').textContent = group.shout.body;
      
      const posterLink = document.getElementById('group-status-poster');
      if (group.shout.poster) {
        posterLink.textContent = group.shout.poster.username;
        posterLink.href = '#';
        posterLink.onclick = () => {
          navigateTo('profile', { userId: group.shout.poster.userId });
          return false;
        };
      }
      
      const statusDate = document.getElementById('group-status-date');
      if (group.shout.updated) {
        const date = new Date(group.shout.updated);
        statusDate.textContent = date.toLocaleDateString('en-US', {
          month: 'numeric', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });
      }
      
      statusBox.style.display = 'block';
    } else {
      statusBox.style.display = 'none';
    }

    // My Rank line (authentic .MyRank) — role comes from the user-groups payload cached by loadMyGroups
    const myRankBox = document.getElementById('group-my-rank');
    if (myRankBox) {
      const myRole = myGroupRoles[groupId];
      if (myRole) {
        document.getElementById('group-my-rank-name').textContent = myRole;
        myRankBox.style.display = 'block';
      } else {
        myRankBox.style.display = 'none';
      }
    }

    initGroupTabs();
    resetGroupTabPanes();

    // Roles, wall, and membership are independent fetches — run them together
    // instead of one after another.
    await Promise.all([
      emblemPromise,
      loadGroupRoles(groupId),
      loadGroupWall(groupId),
      updateGroupMembershipUI(groupId)
    ]);
    if (currentGroupId !== groupId) return;

  } catch (error) {
    console.error('Failed to load group detail:', error);
    document.getElementById('group-detail-name').textContent = 'Failed to load group';
  }
}

// ===== Authentic GroupsPeopleContainer tab strip (Places / Members / Allies / Enemies / Store) =====
// Tab switching swaps StandardTabGray/StandardTabGrayActive (the real page's classes) and lazy-loads
// each pane's data on first open. Members stays the default active tab.
const groupTabLoaded = {};

function resetGroupTabPanes() {
  ['Places', 'Allies', 'Enemies', 'Items'].forEach(p => { groupTabLoaded[p] = false; });
  switchGroupTab('Members');
  const places = document.getElementById('GroupPlaces');
  if (places) places.innerHTML = '';
  const allies = document.getElementById('group-allies-grid');
  if (allies) allies.innerHTML = '';
  const enemies = document.getElementById('group-enemies-grid');
  if (enemies) enemies.innerHTML = '';
  const store = document.getElementById('GroupItemPaneContent');
  if (store) store.innerHTML = '';
}

function switchGroupTab(pane) {
  document.querySelectorAll('#GroupsPeopleContainer .GroupsPeopleTabs_Container div[data-pane]').forEach(tab => {
    tab.className = tab.dataset.pane === pane ? 'StandardTabGrayActive' : 'StandardTabGray';
  });
  ['Places', 'Members', 'Allies', 'Enemies', 'Items'].forEach(p => {
    const el = document.getElementById('GroupsPeoplePane_' + p);
    if (el) el.style.display = (p === pane) ? '' : 'none';
  });
}

function initGroupTabs() {
  const strip = document.querySelector('#GroupsPeopleContainer .GroupsPeopleTabs_Container');
  if (!strip || strip.dataset.wired) return;
  strip.dataset.wired = '1';
  strip.addEventListener('click', function(e) {
    const tab = e.target.closest('div[data-pane]');
    if (!tab) return;
    const pane = tab.dataset.pane;
    switchGroupTab(pane);
    if (pane !== 'Members' && !groupTabLoaded[pane]) {
      groupTabLoaded[pane] = true;
      if (pane === 'Places') loadGroupPlaces(currentGroupId);
      else if (pane === 'Allies') loadGroupRelationships(currentGroupId, 'allies');
      else if (pane === 'Enemies') loadGroupRelationships(currentGroupId, 'enemies');
      else if (pane === 'Items') loadGroupStore(currentGroupId);
    }
  });
}

// Places pane — authentic carousel (4 per page, Skinny arrows), backed by getGroupGames.
let groupPlacesPage = 1;
let groupPlacesCache = null;
async function loadGroupPlaces(groupId) {
  const container = document.getElementById('GroupPlaces');
  if (!container || !groupId) return;
  container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">Loading places...</div>';
  try {
    if (!groupPlacesCache || groupPlacesCache.groupId !== groupId) {
      const games = await window.roblox.getGroupGames(groupId, 'Public', 50, '', 'Asc');
      const data = games?.data || [];
      let thumbs = {};
      if (data.length) {
        try {
          const t = await window.roblox.getGameIcons(data.map(g => g.id), '150x150');
          (t?.data || []).forEach(x => { thumbs[x.targetId] = x.imageUrl; });
        } catch (e) { /* icons optional */ }
      }
      groupPlacesCache = { groupId, data, thumbs };
      groupPlacesPage = 1;
    }
    renderGroupPlacesPage();
  } catch (e) {
    console.error('Failed to load group places:', e);
    container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No places</div>';
  }
}

function renderGroupPlacesPage() {
  const container = document.getElementById('GroupPlaces');
  if (!container || !groupPlacesCache) return;
  const PAGE = 4;
  const { data, thumbs } = groupPlacesCache;
  if (!data.length) {
    container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">This group has no places.</div>';
    document.getElementById('GroupPlacesPrev').style.visibility = 'hidden';
    document.getElementById('GroupPlacesNext').style.visibility = 'hidden';
    return;
  }
  const lastPage = Math.ceil(data.length / PAGE);
  const slice = data.slice((groupPlacesPage - 1) * PAGE, groupPlacesPage * PAGE);
  container.innerHTML = slice.map(g => `
    <div class="GroupPlace">
      <div class="PlaceThumb"><a href="#game-detail?placeId=${g.rootPlace?.id || ''}&universeId=${g.id}"><img src="${thumbs[g.id] || 'images/spinners/spinner100x100.gif'}" alt="${escapeHtml(g.name)}" width="100"></a></div>
      <div class="PlaceInfo">
        <div class="PlaceName"><a class="notranslate" href="#game-detail?placeId=${g.rootPlace?.id || ''}&universeId=${g.id}">${escapeHtml(g.name)}</a></div>
        <div class="PlayersOnline">${(g.playing || 0).toLocaleString()} players online</div>
      </div>
    </div>`).join('') + '<div style="clear:both;"></div>';
  document.getElementById('GroupPlacesPrev').style.visibility = groupPlacesPage > 1 ? 'visible' : 'hidden';
  document.getElementById('GroupPlacesNext').style.visibility = groupPlacesPage < lastPage ? 'visible' : 'hidden';
}

// Allies/Enemies — authentic 42x42 floated emblem grid.
async function loadGroupRelationships(groupId, kind) {
  const container = document.getElementById(kind === 'allies' ? 'group-allies-grid' : 'group-enemies-grid');
  if (!container || !groupId) return;
  container.innerHTML = '<div style="color:#666;padding:10px;">Loading...</div>';
  try {
    const result = kind === 'allies'
      ? await window.roblox.getGroupAllies(groupId, 50, 0)
      : await window.roblox.getGroupEnemies(groupId, 50, 0);
    const related = result?.relatedGroups || [];
    if (!related.length) {
      container.innerHTML = `<div style="color:#666;padding:10px;">This group has no ${kind}.</div>`;
      return;
    }
    let thumbs = {};
    try {
      const t = await window.roblox.getGroupThumbnails(related.map(g => g.id), '150x150');
      (t?.data || []).forEach(x => { thumbs[x.targetId] = x.imageUrl; });
    } catch (e) { /* emblems optional */ }
    container.innerHTML = related.map(g => `
      <div class="relationship-tile">
        <a href="#" title="${escapeHtml(g.name)}" onclick="loadGroupDetail(${g.id}); return false;"><img src="${thumbs[g.id] || 'images/spinners/spinner100x100.gif'}" alt="${escapeHtml(g.name)}"></a>
      </div>`).join('');
  } catch (e) {
    console.error(`Failed to load group ${kind}:`, e);
    container.innerHTML = `<div style="color:#666;padding:10px;">This group has no ${kind}.</div>`;
  }
}

// Store — group-created clothing via the v1 group-store search.
async function loadGroupStore(groupId) {
  const container = document.getElementById('GroupItemPaneContent');
  if (!container || !groupId) return;
  container.innerHTML = '<div style="color:#666;padding:10px;">Loading store...</div>';
  try {
    const result = await window.roblox.getGroupStoreItems(groupId, 30, '');
    const items = result?.data || [];
    if (!items.length) {
      container.innerHTML = '<div style="color:#666;padding:10px;">This group does not sell anything.</div>';
      return;
    }
    let thumbs = {};
    try {
      const t = await window.roblox.getAssetThumbnails(items.map(i => i.id), '110x110');
      (t?.data || []).forEach(x => { thumbs[x.targetId] = x.imageUrl; });
    } catch (e) { /* thumbnails optional */ }
    container.innerHTML = items.map(i => `
      <div class="group-store-item">
        <a href="#catalog-item?id=${i.id}&type=${i.itemType || 'Asset'}"><img src="${thumbs[i.id] || 'images/spinners/spinner100x100.gif'}" alt="${escapeHtml(i.name)}"></a>
        <div><a href="#catalog-item?id=${i.id}&type=${i.itemType || 'Asset'}">${escapeHtml(i.name)}</a></div>
        <div>${(i.price !== null && i.price !== undefined) ? '<span class="robux">' + i.price.toLocaleString() + '</span>' : ''}</div>
      </div>`).join('') + '<div style="clear:both;"></div>';
  } catch (e) {
    console.error('Failed to load group store:', e);
    container.innerHTML = '<div style="color:#666;padding:10px;">This group does not sell anything.</div>';
  }
}

// Places carousel arrows
document.addEventListener('click', function(e) {
  if (e.target.id === 'GroupPlacesPrev' && groupPlacesPage > 1) { groupPlacesPage--; renderGroupPlacesPage(); }
  else if (e.target.id === 'GroupPlacesNext' && groupPlacesCache && groupPlacesPage < Math.ceil(groupPlacesCache.data.length / 4)) { groupPlacesPage++; renderGroupPlacesPage(); }
});
window.loadGroupDetail = window.loadGroupDetail || loadGroupDetail;

function showGroupsSearch() {
  // The authentic Groups/Search.aspx was a standalone page (no rail) — swap the whole view.
  document.getElementById('groups-search-view').style.display = 'block';
  document.getElementById('groups-my-view').style.display = 'none';
  document.querySelectorAll('#my-groups-list .GroupListItemContainer').forEach(row => row.classList.remove('selected'));
  currentGroupId = null;
  document.getElementById('GroupsSearchTextBox')?.focus();
}

window.showGroupsSearch = showGroupsSearch;

async function loadGroupRoles(groupId) {
  const tabsContainer = document.getElementById('group-role-tabs');
  if (!tabsContainer) return;
  
  try {
    const roles = await window.roblox.getGroupRoles(groupId);
    
    if (!roles?.roles || roles.roles.length === 0) {
      tabsContainer.innerHTML = '';
      await loadGroupMembers(groupId);
      return;
    }

    // Authentic 2013 Members pane: a single role <select class="MembersDropDownList"> with
    // "[rank] Name" labels (ascending rank, like the real dlRolesetList), not a button stack.
    const sortedRoles = roles.roles.sort((a, b) => a.rank - b.rank);

    tabsContainer.innerHTML = `
      <select class="MembersDropDownList" id="group-role-select">
        ${sortedRoles.map(role => `
          <option value="${role.id}" data-role-rank="${role.rank}" data-role-count="${role.memberCount || 0}">${role.name} (${role.memberCount || 0})</option>
        `).join('')}
      </select>`;

    const select = document.getElementById('group-role-select');
    select.addEventListener('change', function() {
      const opt = this.options[this.selectedIndex];
      const roleName = opt.textContent.replace(/^\[\d+\]\s*/, '');
      document.getElementById('group-role-name').textContent = roleName;
      document.getElementById('group-role-count').textContent = opt.dataset.roleCount || 0;
      document.getElementById('group-role-rank').textContent = opt.dataset.roleRank || 1;
      currentRoleId = parseInt(this.value, 10);
      currentMembersPage = 1;
      currentMembersPage = 1;
      loadGroupMembers(groupId, currentRoleId);
    });

    if (sortedRoles.length > 0) {
      currentRoleId = sortedRoles[0].id;

      document.getElementById('group-role-name').textContent = sortedRoles[0].name;
      document.getElementById('group-role-count').textContent = sortedRoles[0].memberCount || 0;
      document.getElementById('group-role-rank').textContent = sortedRoles[0].rank;
      await loadGroupMembers(groupId, sortedRoles[0].id);
    }
    
  } catch (error) {
    console.error('Failed to load group roles:', error);
    tabsContainer.innerHTML = '';
    await loadGroupMembers(groupId);
  }
}

async function selectRole(groupId, roleId, element) {
  
  document.querySelectorAll('#group-role-tabs input').forEach(btn => {
    btn.className = 'RoleSetButton';
  });
  element.className = 'SelectedRoleSetButton';

  document.getElementById('group-role-name').textContent = element.value;
  document.getElementById('group-role-count').textContent = element.dataset.roleCount || 0;
  document.getElementById('group-role-rank').textContent = element.dataset.roleRank || 1;
  
  currentRoleId = roleId;
  currentMembersPage = 1;
  currentMembersPage = 1;
  await loadGroupMembers(groupId, roleId);
}

window.selectRole = selectRole;

async function loadGroupMembers(groupId, roleId = null) {
  const container = document.getElementById('group-members-grid');
  if (!container) return;

  container.innerHTML = '<div style="color: #666; text-align: center;">Loading members...</div>';

  membersCache = [];
  membersApiCursor = '';
  membersHasMore = true;
  membersFetchCtx = { groupId, roleId };
  currentMembersPage = 1;

  await displayMembersPage();
}

// Pull the next API batch (limit 10 — the API's minimum page size) into the cache.
async function fetchMoreMembers() {
  const { groupId, roleId } = membersFetchCtx;
  let members;
  let useRoleEndpoint = false;

  if (roleId) {
    try {
      members = await window.roblox.getGroupRoleMembers(groupId, roleId, 10, membersApiCursor, 'Desc');
      useRoleEndpoint = true;
    } catch (e) {
      console.warn('Role members endpoint failed, falling back to general members:', e);
      members = await window.roblox.getGroupMembers(groupId, 10, membersApiCursor, 'Desc');
    }
  } else {
    members = await window.roblox.getGroupMembers(groupId, 10, membersApiCursor, 'Desc');
  }

  let batch = members?.data || [];
  if (roleId && !useRoleEndpoint) {
    batch = batch.filter(m => m.role?.id === roleId);
  }
  batch = batch.filter(m => {
    const userId = m.userId || m.user?.userId;
    const username = m.username || m.user?.username;
    return userId && username;
  });

  membersCache.push(...batch);
  membersApiCursor = members?.nextPageCursor || '';
  membersHasMore = !!membersApiCursor;
}

// Render the current 8-member page, refilling the cache from the API cursor as needed.
async function displayMembersPage() {
  const container = document.getElementById('group-members-grid');
  const pagination = document.getElementById('group-members-pagination');
  if (!container) return;

  try {
    while (membersCache.length < currentMembersPage * MEMBERS_PER_PAGE && membersHasMore) {
      await fetchMoreMembers();
    }

    if (membersCache.length === 0) {
      container.innerHTML = '<div style="color: #666; text-align: center;">No members found</div>';
      pagination.style.display = 'none';
      return;
    }

    // Clamp if a short final batch left this page empty
    const totalPages = Math.max(1, Math.ceil(membersCache.length / MEMBERS_PER_PAGE));
    if (currentMembersPage > totalPages) currentMembersPage = totalPages;

    const displayMembers = membersCache.slice((currentMembersPage - 1) * MEMBERS_PER_PAGE, currentMembersPage * MEMBERS_PER_PAGE);

    const userIds = displayMembers.map(m => m.userId || m.user?.userId).filter(id => id);
    let avatars = {};
    try {
      const avatarResult = await window.roblox.getUserThumbnails(userIds, '48x48', 'Headshot');
      if (avatarResult?.data) {
        avatarResult.data.forEach(a => {
          avatars[a.targetId] = a.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load member avatars:', e);
    }

    // Authentic 2013 member cards: plain floated .GroupMember divs (50px, CSS-governed), 48x48
    // avatar with the Avatar/Summary/Name vocabulary from the real GroupRoleSetsMembersPane.
    let html = '';
    for (const member of displayMembers) {
      const userId = member.userId || member.user?.userId;
      const username = member.username || member.user?.username || 'Unknown';
      if (!userId) continue;

      const avatar = avatars[userId] || '';
      const placeholderAvatar = 'images/spinners/spinner100x100.gif';

      html += `
        <div class="GroupMember">
          <div class="Avatar">
            <a href="#" title="${username}" onclick="navigateTo('profile', { userId: ${userId} }); return false;">
              <img src="${avatar || placeholderAvatar}" alt="${username}" height="48" width="48" border="0" onerror="this.src='${placeholderAvatar}'; this.onerror=null;">
            </a>
          </div>
          <div class="Summary">
            <span class="Name">
              <a href="#" title="${username}" onclick="navigateTo('profile', { userId: ${userId} }); return false;">${username}</a>
            </span>
          </div>
        </div>
      `;
    }

    container.innerHTML = html + '<div style="clear:both;"></div>';

    document.getElementById('members-page-info').textContent = currentMembersPage;

    const firstBtn = document.getElementById('members-prev-btn');
    const prevBtn = document.getElementById('members-prev-page-btn');
    if (currentMembersPage > 1) {
      firstBtn?.removeAttribute('disabled');
      prevBtn?.removeAttribute('disabled');
    } else {
      firstBtn?.setAttribute('disabled', 'disabled');
      prevBtn?.setAttribute('disabled', 'disabled');
    }

    const hasNext = membersCache.length > currentMembersPage * MEMBERS_PER_PAGE || membersHasMore;
    const nextBtn = document.getElementById('members-next-btn');
    if (hasNext) {
      nextBtn.removeAttribute('disabled');
    } else {
      nextBtn.setAttribute('disabled', 'disabled');
    }

    pagination.style.display = 'block';

  } catch (error) {
    console.error('Failed to load group members:', error);
    container.innerHTML = '<div style="color: #cc0000; text-align: center;">Failed to load members</div>';
  }
}

async function loadGroupWall(groupId) {
  const container = document.getElementById('group-wall-container');
  
  if (!container) return;

  wallPostsCache = [];
  wallCursor = '';
  wallHasMore = true;
  currentWallPage = 1;
  
  container.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #666;">Loading wall posts...</td></tr>';
  
  try {
    
    await fetchMoreWallPosts(groupId);

    displayWallPage();
    
  } catch (error) {
    console.error('Failed to load group wall:', error);
    
    const isPermissionError = error?.message?.includes('permission') || 
                              error?.message?.includes('Permission') ||
                              error?.message?.includes('403');
    
    const wallSection = document.getElementById('group-wall-section');
    if (isPermissionError && wallSection) {
      
      wallSection.style.display = 'none';
    } else {
      container.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #cc0000;">Failed to load wall</td></tr>';
    }
  }
}

async function fetchMoreWallPosts(groupId) {
  if (!wallHasMore) return;
  
  const wall = await window.roblox.getGroupWall(groupId, 25, wallCursor, 'Desc');
  
  if (wall?.data && wall.data.length > 0) {
    
    const userIds = wall.data
      .filter(p => p.poster?.user?.userId)
      .map(p => p.poster.user.userId);
    
    let avatars = {};
    if (userIds.length > 0) {
      try {
        const avatarResult = await window.roblox.getUserThumbnails(userIds, '48x48', 'Headshot');
        if (avatarResult?.data) {
          avatarResult.data.forEach(a => {
            avatars[a.targetId] = a.imageUrl;
          });
        }
      } catch (e) {
        console.warn('Failed to load wall avatars:', e);
      }
    }

    wall.data.forEach(post => {
      if (post.poster?.user?.userId) {
        post._avatarUrl = avatars[post.poster.user.userId] || 'images/spinners/spinner100x100.gif';
      }
    });
    
    wallPostsCache = wallPostsCache.concat(wall.data);
  }
  
  wallCursor = wall?.nextPageCursor || '';
  wallHasMore = !!wallCursor;
}

async function displayWallPage() {
  const container = document.getElementById('group-wall-container');
  const pagination = document.getElementById('group-wall-pagination');
  const prevBtn = document.getElementById('wall-prev-btn');
  const nextBtn = document.getElementById('wall-next-btn');
  const pageInfo = document.getElementById('wall-page-info');
  
  if (!container) return;
  
  const startIndex = (currentWallPage - 1) * WALL_POSTS_PER_PAGE;
  const endIndex = startIndex + WALL_POSTS_PER_PAGE;

  if (endIndex > wallPostsCache.length && wallHasMore) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Loading more posts...</div>';
    await fetchMoreWallPosts(currentGroupId);
  }

  const postsToShow = wallPostsCache.slice(startIndex, endIndex);

  if (postsToShow.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No wall posts</div>';
    if (pagination) pagination.style.display = 'none';
    return;
  }

  // Authentic 2013 wall post markup (archive-group-roblox-2013.html): alternating div rows with
  // .RepeaterImage (48x48 avatar + .UserLink) and .RepeaterText (.GroupWall_PostContainer bold-italic
  // body + .GroupWall_PostDate) — the table-based version was 2011-shaped.
  const html = postsToShow.map((post, index) => {
    if (!post.poster?.user) return '';

    const userId = post.poster.user.userId;
    const username = post.poster.user.username || post.poster.user.displayName || 'Unknown';
    const avatar = post._avatarUrl || 'images/spinners/spinner100x100.gif';
    const date = new Date(post.created).toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });
    const rowClass = index % 2 === 0 ? 'AlternatingItemTemplateOdd' : 'AlternatingItemTemplateEven';

    const fullText = escapeHtml(post.body);
    const needsTruncate = post.body.length > 120;
    const truncatedText = needsTruncate ? escapeHtml(post.body.substring(0, 120)) + '...' : fullText;
    const postId = `wall-post-${post.id}`;

    const showMoreLink = needsTruncate ?
      `<a href="javascript:void(0)" id="${postId}-link" class="show-more-link" onclick="toggleWallPost('${postId}')">Show More</a>` : '';

    return `
      <div class="${rowClass}">
        <div class="RepeaterImage">
          <a href="#" title="${username}" onclick="navigateTo('profile', { userId: ${userId} }); return false;" style="display:inline-block;height:48px;width:48px;cursor:pointer;"><img src="${avatar}" border="0" alt="${username}" height="48" width="48"></a>
          <div class="UserLink notranslate">
            <a href="#" onclick="navigateTo('profile', { userId: ${userId} }); return false;">${username}</a>
          </div>
        </div>
        <div class="RepeaterText">
          <div class="GroupWall_PostContainer notranslate"><span id="${postId}-short">${truncatedText}</span><span id="${postId}-full" style="display:none;">${fullText}</span> ${showMoreLink}</div>
          <div class="GroupWall_PostDate"><span>${date}</span></div>
        </div>
        <div style="clear:both;"></div>
      </div>
    `;
  }).filter(h => h).join('');

  container.innerHTML = html || '<div style="text-align: center; padding: 20px; color: #666;">No wall posts</div>';

  const hasNextPage = endIndex < wallPostsCache.length || wallHasMore;
  const hasPrevPage = currentWallPage > 1;
  
  if (pagination) {
    if (pageInfo) {
      // The markup wraps this span in "Page <span>" — write the number only.
      pageInfo.textContent = currentWallPage;
    }
    
    if (prevBtn) {
      prevBtn.style.display = hasPrevPage ? 'inline' : 'none';
    }
    
    if (nextBtn) {
      nextBtn.style.display = hasNextPage ? 'inline' : 'none';
    }

    pagination.style.display = (hasPrevPage || hasNextPage) ? 'block' : 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleWallPost(postId) {
  const shortEl = document.getElementById(`${postId}-short`);
  const fullEl = document.getElementById(`${postId}-full`);
  const link = document.getElementById(`${postId}-link`);
  
  if (fullEl.style.display === 'none') {
    shortEl.style.display = 'none';
    fullEl.style.display = 'inline';
    if (link) link.textContent = 'Show Less';
  } else {
    shortEl.style.display = 'inline';
    fullEl.style.display = 'none';
    if (link) link.textContent = 'Show More';
  }
}

window.toggleWallPost = toggleWallPost;

window.loadGroupDetail = loadGroupDetail;

window.searchGroups = searchGroups;

let pendingGroupChallenge = null;

async function updateGroupMembershipUI(groupId) {
  // Join lives in the description panel's left-col; Leave lives in the right-column
  // Controls box (the authentic 2013 placement) — membership decides which shows.
  const container = document.getElementById('group-join-container');
  const controlsColumn = document.getElementById('right-column');

  if (!container || !controlsColumn) return;

  try {

    const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
    if (!isLoggedIn) {
      container.style.display = 'none';
      controlsColumn.style.display = 'none';
      return;
    }

    const currentUser = await window.RobloxClient.api.getCurrentUser();
    if (!currentUser) {
      container.style.display = 'none';
      controlsColumn.style.display = 'none';
      return;
    }

    currentUserId = currentUser.id;

    const isMember = await window.roblox.isUserInGroup(currentUserId, groupId);

    if (isMember) {
      container.style.display = 'none';
      controlsColumn.style.display = 'block';
    } else {
      container.style.display = 'block';
      controlsColumn.style.display = 'none';
    }

  } catch (error) {
    console.error('Failed to check group membership:', error);
    container.style.display = 'none';
    controlsColumn.style.display = 'none';
  }
}

// The StyleGuide big buttons carry a duplicate label in a .btn-text overlay span —
// setting textContent directly would destroy it, so rebuild both label copies.
function setBigButtonText(btn, text) {
  btn.innerHTML = `${escapeHtml(text)} <span class="btn-text">${escapeHtml(text)}</span>`;
}

async function joinGroup(groupId) {
  const joinBtn = document.getElementById('group-join-btn');
  if (!joinBtn) return;

  joinBtn.style.pointerEvents = 'none';
  joinBtn.classList.add('btn-disabled-neutral');
  setBigButtonText(joinBtn, 'Joining...');

  try {
    const result = await window.roblox.joinGroup(groupId);

    if (result?.requiresChallenge) {
      await handleGroupChallenge(result, groupId, 'join');
      return;
    }

    if (result?.success || result?.groupId) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups(); 
    } else {
      throw new Error(result?.message || 'Failed to join group');
    }

  } catch (error) {
    console.error('Failed to join group:', error);
    alert('Failed to join group: ' + (error.message || 'Unknown error'));
    joinBtn.style.pointerEvents = '';
    joinBtn.classList.remove('btn-disabled-neutral');
    setBigButtonText(joinBtn, 'Join Group');
  }
}

async function leaveGroup(groupId) {
  const leaveBtn = document.getElementById('group-leave-btn');
  if (!leaveBtn || !currentUserId) return;

  if (!confirm('Are you sure you want to leave this group?')) {
    return;
  }

  const originalText = leaveBtn.textContent;
  leaveBtn.disabled = true;
  leaveBtn.textContent = 'Leaving...';

  try {
    const result = await window.roblox.leaveGroup(groupId, currentUserId);

    if (result?.requiresChallenge) {
      await handleGroupChallenge(result, groupId, 'leave');
      return;
    }

    if (result?.success || !result?.errors) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups(); 
    } else {
      throw new Error(result?.errors?.[0]?.message || 'Failed to leave group');
    }

  } catch (error) {
    console.error('Failed to leave group:', error);
    alert('Failed to leave group: ' + (error.message || 'Unknown error'));
    leaveBtn.disabled = false;
    leaveBtn.textContent = originalText;
  }
}

async function handleGroupChallenge(challengeResult, groupId, action) {
  console.log('Group action requires challenge:', challengeResult);

  pendingGroupChallenge = {
    challengeId: challengeResult.challengeId,
    challengeType: challengeResult.challengeType,
    groupId: groupId,
    action: action
  };

  const challengeType = challengeResult.challengeType;

  if (challengeType === 'twostepverification' || challengeType === 'forcetwostepverification') {
    await showGroupTwoStepVerification(challengeResult, action);
  } else if (challengeType === 'captcha' || challengeResult.challengeMetadata?.dataExchangeBlob) {
    
    await showGroupCaptchaChallenge(challengeResult, groupId, action);
  } else if (challengeType === 'proofofwork') {
    
    await handleProofOfWorkChallenge(challengeResult, groupId, action);
  } else if (challengeType === 'rostile') {
    
    console.log('Rostile puzzle challenge detected:', challengeResult.challengeMetadata);

    const showedRostile = await showRostileChallenge(challengeResult, groupId, action);
    if (!showedRostile) {
      
      const actionText = action === 'join' ? 'join' : 'leave';
      const confirmed = confirm(
        `This group requires puzzle verification (Rostile) which cannot be completed in the app.\n\n` +
        `Would you like to open the group page on Roblox.com to ${actionText} this group?`
      );
      
      if (confirmed) {
        const groupUrl = `https://www.roblox.com/communities/${groupId}`;
        if (window.roblox?.openExternal) {
          window.roblox.openExternal(groupUrl);
        } else {
          window.open(groupUrl, '_blank');
        }
      }
      
      resetGroupButtons();
    }
  } else {
    alert('This action requires verification. Please complete the action on the Roblox website.');
    resetGroupButtons();
  }
}

async function handleProofOfWorkChallenge(challengeResult, groupId, action) {
  console.log('Handling proof of work challenge...');

  try {
    
    const metadata = challengeResult.challengeMetadata;
    console.log('Proof of work metadata:', metadata);

    if (metadata.dataExchangeBlob) {
      console.log('Detected FunCaptcha requirement, showing captcha UI...');
      await showGroupCaptchaChallenge(challengeResult, groupId, action);
      return;
    }

    console.log('Calling continue endpoint for proof of work...');

    const continueMetadata = {
      challengeId: metadata.genericChallengeId || challengeResult.challengeId,
      actionType: 'Generic'
    };

    const continueResult = await window.roblox.continueProofOfWorkChallenge(
      challengeResult.challengeId,
      challengeResult.challengeType,
      continueMetadata
    );

    console.log('Continue result:', continueResult);

    console.log('Retrying group action after continue...');

    let result;
    if (action === 'join') {
      result = await window.roblox.joinGroup(groupId);
    } else {
      if (!currentUserId) {
        const currentUser = await window.RobloxClient.api.getCurrentUser();
        currentUserId = currentUser?.id;
      }
      result = await window.roblox.leaveGroup(groupId, currentUserId);
    }

    if (result?.requiresChallenge) {
      
      const newChallengeType = result.challengeType;
      if (newChallengeType === 'captcha' || result.challengeMetadata?.dataExchangeBlob) {
        console.log('Second attempt returned captcha challenge');
        await showGroupCaptchaChallenge(result, groupId, action);
        return;
      }

      alert('Verification failed. Please try again or complete the action on the Roblox website.');
      resetGroupButtons();
    } else if (result?.success || result?.groupId || !result?.errors) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups();
      pendingGroupChallenge = null;
    } else {
      throw new Error(result?.message || result?.errors?.[0]?.message || 'Action failed');
    }

  } catch (error) {
    console.error('Proof of work challenge handling failed:', error);
    alert('Failed to complete action: ' + (error.message || 'Unknown error'));
    resetGroupButtons();
  }
}

async function showRostileChallenge(challengeResult, groupId, action) {
  console.log('Rostile challenge detected - using in-app Roblox window');
  console.log('Metadata:', challengeResult.challengeMetadata);

  if (window.roblox?.bat?.performGroupAction) {
    try {
      const result = await window.roblox.bat.performGroupAction(groupId, action);
      
      if (result?.success) {
        await updateGroupMembershipUI(groupId);
        await loadMyGroups();
        pendingGroupChallenge = null;
      } else if (result?.cancelled) {
        console.log('User cancelled the action');
      } else if (result?.timeout) {
        alert('The action timed out. Please try again.');
      } else {
        alert('Failed to complete action: ' + (result?.error || 'Unknown error'));
      }
      
      resetGroupButtons();
      return true;
      
    } catch (error) {
      console.error('Failed to perform group action for Rostile:', error);
    }
  }
  
  return false; 
}

let currentCaptchaSession = null;

async function showGroupCaptchaChallenge(challengeResult, groupId, action) {
  console.log('Challenge required for group action, trying in-app captcha...');
  
  const actionText = action === 'join' ? 'join' : 'leave';
  const blob = challengeResult.challengeMetadata?.dataExchangeBlob;

  pendingGroupChallenge = {
    challengeId: challengeResult.challengeId,
    challengeType: challengeResult.challengeType,
    challengeMetadata: challengeResult.challengeMetadata,
    groupId: groupId,
    action: action
  };

  if (window.roblox?.funcaptcha && blob) {
    try {
      console.log('Starting in-app FunCaptcha...');
      
      const captchaResult = await window.roblox.funcaptcha.start({
        actionType: 'JoinGroup',
        blob: blob
      });
      
      console.log('FunCaptcha start result:', captchaResult);
      
      if (captchaResult?.success) {
        
        if (captchaResult.suppressed) {
          console.log('Captcha is suppressed, retrying action...');
          pendingGroupChallenge.captchaToken = captchaResult.token;
          await retryGroupActionAfterCaptcha();
          return;
        }

        currentCaptchaSession = {
          sessionId: captchaResult.sessionId,
          token: captchaResult.token,
          info: captchaResult.info,
          groupId: groupId,
          action: action
        };
        
        showCaptchaModal(captchaResult);
        return;
      } else {
        console.log('FunCaptcha start failed:', captchaResult?.error);
      }
    } catch (error) {
      console.error('In-app FunCaptcha error:', error);
    }
  }

  if (window.roblox?.bat?.performGroupAction) {
    try {
      console.log(`Falling back to Roblox window to ${actionText} group ${groupId}...`);
      
      const result = await window.roblox.bat.performGroupAction(groupId, action);
      
      console.log('Group action result:', result);
      
      if (result?.success) {
        await updateGroupMembershipUI(groupId);
        await loadMyGroups();
        pendingGroupChallenge = null;
      } else if (result?.cancelled) {
        console.log('User cancelled the action');
      } else if (result?.timeout) {
        alert('The action timed out. Please try again.');
      } else {
        alert('Failed to complete action: ' + (result?.error || 'Unknown error'));
      }
      
      resetGroupButtons();
      return;
      
    } catch (error) {
      console.error('Failed to perform group action:', error);
    }
  }

  alert(`This action requires verification that cannot be completed in the app.\n\nPlease ${actionText} the group on Roblox.com`);
  resetGroupButtons();
}

function showCaptchaModal(captchaResult) {
  const modal = document.getElementById('group-captcha-modal');
  const image = document.getElementById('captcha-image');
  const instruction = document.getElementById('captcha-instruction');
  const progress = document.getElementById('captcha-progress');
  const status = document.getElementById('captcha-status');
  const loading = document.getElementById('captcha-loading');
  const tiles = document.querySelectorAll('.captcha-tile');
  
  if (!modal) {
    console.error('Captcha modal not found');
    return;
  }

  instruction.textContent = captchaResult.info?.instruction || 'Pick the correct image';
  progress.textContent = `Wave ${(captchaResult.info?.currentWave || 0) + 1} of ${captchaResult.info?.waves || 1}`;
  status.textContent = '';
  loading.style.display = 'none';

  if (captchaResult.image) {
    image.src = `data:image/gif;base64,${captchaResult.image}`;
    image.style.display = 'block';
  }

  tiles.forEach(tile => {
    tile.disabled = false;
    tile.style.opacity = '1';
  });

  tiles.forEach(tile => {
    tile.onclick = () => handleCaptchaTileClick(parseInt(tile.dataset.tile));
  });

  const closeBtn = document.getElementById('captcha-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => cancelCaptcha();
  }

  modal.style.display = 'flex';
}

async function handleCaptchaTileClick(tileIndex) {
  if (!currentCaptchaSession) {
    console.error('No active captcha session');
    return;
  }
  
  const tiles = document.querySelectorAll('.captcha-tile');
  const status = document.getElementById('captcha-status');
  const progress = document.getElementById('captcha-progress');
  const image = document.getElementById('captcha-image');

  tiles.forEach(tile => {
    tile.disabled = true;
    tile.style.opacity = '0.5';
  });
  
  status.textContent = 'Checking answer...';
  
  try {
    const result = await window.roblox.funcaptcha.answer(
      currentCaptchaSession.sessionId,
      tileIndex
    );
    
    console.log('Captcha answer result:', result);
    
    if (!result.success) {
      status.textContent = 'Error: ' + (result.error || 'Unknown error');
      tiles.forEach(tile => {
        tile.disabled = false;
        tile.style.opacity = '1';
      });
      return;
    }
    
    if (result.completed) {
      
      if (result.solved) {
        status.textContent = 'Verification successful!';
        pendingGroupChallenge.captchaToken = currentCaptchaSession.token;

        setTimeout(async () => {
          hideCaptchaModal();
          await retryGroupActionAfterCaptcha();
        }, 500);
      } else {
        status.textContent = 'Verification failed. Please try again.';
        setTimeout(() => {
          hideCaptchaModal();
          resetGroupButtons();
        }, 1500);
      }
    } else {
      
      progress.textContent = `Wave ${result.wave + 1} of ${currentCaptchaSession.info?.waves || 1}`;
      status.textContent = '';

      if (result.image) {
        image.src = `data:image/gif;base64,${result.image}`;
      }

      tiles.forEach(tile => {
        tile.disabled = false;
        tile.style.opacity = '1';
      });
    }
  } catch (error) {
    console.error('Captcha answer error:', error);
    status.textContent = 'Error: ' + error.message;
    tiles.forEach(tile => {
      tile.disabled = false;
      tile.style.opacity = '1';
    });
  }
}

function hideCaptchaModal() {
  const modal = document.getElementById('group-captcha-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentCaptchaSession = null;
}

async function cancelCaptcha() {
  if (currentCaptchaSession?.sessionId) {
    try {
      await window.roblox.funcaptcha.cancel(currentCaptchaSession.sessionId);
    } catch (e) {
      console.log('Error cancelling captcha:', e);
    }
  }
  
  hideCaptchaModal();
  resetGroupButtons();
}

function handleGroupCaptchaMessage(event) {
  
  if (event.origin.includes('arkoselabs.com') || event.origin.includes('funcaptcha.com')) {
    console.log('Group CAPTCHA message received:', event.data);

    if (event.data && event.data.eventId) {
      if (event.data.eventId === 'challenge-complete' || event.data.eventId === 'challenge-suppressed') {
        console.log('CAPTCHA completed, retrying group action...');
        
        window.removeEventListener('message', handleGroupCaptchaMessage);
        retryGroupActionAfterCaptcha();
      }
    }
  }
}

async function retryGroupActionAfterCaptcha() {
  if (!pendingGroupChallenge) {
    console.error('No pending group challenge data');
    return;
  }

  const captchaContainer = document.getElementById('group-captcha-container');
  const captchaIframe = document.getElementById('group-captcha-iframe');

  try {
    const { challengeId, challengeMetadata, groupId, action, captchaToken } = pendingGroupChallenge;

    console.log('Retrying group action after captcha completion with challenge data...');

    const captchaId = challengeMetadata?.unifiedCaptchaId;

    const challengeParams = {
      challengeId: challengeId,
      challengeType: 'captcha',
      challengeMetadata: {
        unifiedCaptchaId: captchaId,
        captchaToken: captchaToken,
        actionType: 'Generic'
      }
    };

    console.log('Retrying with challenge params:', challengeParams);

    let result;
    if (action === 'join') {
      result = await window.roblox.joinGroup(groupId, challengeParams);
    } else {
      if (!currentUserId) {
        const currentUser = await window.RobloxClient.api.getCurrentUser();
        currentUserId = currentUser?.id;
      }
      result = await window.roblox.leaveGroup(groupId, currentUserId, challengeParams);
    }

    captchaContainer.style.display = 'none';
    captchaIframe.src = '';

    if (result?.requiresChallenge) {
      
      await handleGroupChallenge(result, groupId, action);
    } else if (result?.success || result?.groupId || !result?.errors) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups();
      pendingGroupChallenge = null;
    } else {
      throw new Error(result?.message || result?.errors?.[0]?.message || 'Action failed');
    }

  } catch (error) {
    console.error('Failed to complete group action after captcha:', error);
    alert('Failed to complete action: ' + (error.message || 'Unknown error'));
    captchaContainer.style.display = 'none';
    captchaIframe.src = '';
    resetGroupButtons();
  }
}

async function showGroupTwoStepVerification(challengeResult, action) {
  const actionText = action === 'join' ? 'join' : 'leave';
  const metadata = challengeResult.challengeMetadata;

  const code = prompt(
    `Two-Step Verification Required\n\n` +
    `To ${actionText} this group, enter the 6-digit code from your authenticator app:`
  );

  if (!code || code.trim().length !== 6) {
    resetGroupButtons();
    return;
  }

  try {
    if (!currentUserId) {
      const currentUser = await window.RobloxClient.api.getCurrentUser();
      currentUserId = currentUser?.id;
    }

    const challengeIdToUse = challengeResult.challengeType === 'twostepverification'
      ? (metadata?.challengeId || challengeResult.challengeId)
      : challengeResult.challengeId;

    console.log('Verifying 2FA for group action, challengeId:', challengeIdToUse);

    const verifyResult = await window.roblox.verifyTwoStepForChallenge(
      currentUserId,
      challengeIdToUse,
      code.trim(),
      'authenticator'
    );

    if (!verifyResult?.success) {
      throw new Error(verifyResult?.error || 'Verification failed');
    }

    console.log('2FA verified, continuing challenge...');

    const continueResult = await window.roblox.continueChallenge(
      challengeResult.challengeId,
      challengeResult.challengeType,
      verifyResult.verificationToken,
      verifyResult.rememberTicket,
      challengeIdToUse
    );

    console.log('Retrying group action...');

    let result;
    if (action === 'join') {
      result = await window.roblox.joinGroup(pendingGroupChallenge.groupId);
    } else {
      result = await window.roblox.leaveGroup(pendingGroupChallenge.groupId, currentUserId);
    }

    if (result?.requiresChallenge) {
      alert('Verification failed. Please try again.');
      resetGroupButtons();
    } else if (result?.success || result?.groupId || !result?.errors) {
      await updateGroupMembershipUI(pendingGroupChallenge.groupId);
      await loadMyGroups();
      pendingGroupChallenge = null;
    } else {
      throw new Error(result?.message || result?.errors?.[0]?.message || 'Action failed');
    }

  } catch (error) {
    console.error('2FA verification for group action failed:', error);
    alert('Verification failed: ' + (error.message || 'Unknown error'));
    resetGroupButtons();
  }
}

function resetGroupButtons() {
  const joinBtn = document.getElementById('group-join-btn');
  const leaveBtn = document.getElementById('group-leave-btn');
  const captchaModal = document.getElementById('group-captcha-modal');

  if (joinBtn) {
    joinBtn.style.pointerEvents = '';
    joinBtn.classList.remove('btn-disabled-neutral');
    setBigButtonText(joinBtn, 'Join Group');
  }

  if (leaveBtn) {
    leaveBtn.disabled = false;
    leaveBtn.textContent = 'Leave Group';
  }

  if (captchaModal) {
    captchaModal.style.display = 'none';
  }

  currentCaptchaSession = null;
  pendingGroupChallenge = null;
}
