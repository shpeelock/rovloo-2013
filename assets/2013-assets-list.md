# 2013 ROBLOX Theme - Asset List

This document lists all assets needed for the 2013 ROBLOX theme, extracted from the archived Home page.

## CSS Stylesheets

The 2013 theme uses these main CSS files:

| File | Original URL | Archive URL |
|------|-------------|-------------|
| main-2013.css | `https://www.roblox.com/CSS/Base/CSS/FetchCSS?path=main___9f842fd9a1a7173bd52d5de5563566b8_m.css` | [Web Archive](https://web.archive.org/web/2013/https://www.roblox.com/CSS/Base/CSS/FetchCSS?path=main___9f842fd9a1a7173bd52d5de5563566b8_m.css) |
| page-2013.css | `https://www.roblox.com/CSS/Base/CSS/FetchCSS?path=page___bd540dc4bbc3cb88bfd00f03ec91d022_m.css` | [Web Archive](https://web.archive.org/web/2013/https://www.roblox.com/CSS/Base/CSS/FetchCSS?path=page___bd540dc4bbc3cb88bfd00f03ec91d022_m.css) |
| BestFriends.css | Local file from archive | Already in reference folder |

## UI Icons (Hashed Filenames)

These are the UI icons used in the 2013 interface:

| Description | Hash | Extension | Suggested Name |
|-------------|------|-----------|----------------|
| 13+ Account Icon | 8ed6b064a35786706f738c0858345c11 | png | icon-13plus.png |
| See More Arrow | efe86a4cae90d4c37a5d73480dea4cb1 | png | icon-see-more.png |
| Offline Status | 3a3aa21b169be06d20de7586e56e3739 | png | icon-offline.png |
| Facebook Connect | 4ec0c6c40a454f2f6537946d00f09b56 | png | facebook-connect.png |
| Loading Spinner | ec4e85b0c4396cf753a06fade0a8d8af | gif | loading-spinner.gif |
| Report Abuse | 1ea8de3b0f71a67b032b67ddc1770c78 | png | icon-report-abuse.png |
| Online Chat Icon | 164e80229d83c8b6e55b1eb671887e54 | png | icon-online-chat.png |
| Close Chat | 8a762994af1e122de8ac427005ac3d9b | png | icon-close-chat.png |
| Progress Spinner | e998fb4c03e8c2e30792f2f3436e9416 | gif | progress-spinner.gif |
| TRUSTe Seal | (in footer) | png | truste-seal.png |

## Navigation Structure (2013 vs 2011)

### Key Differences:
1. **Full-width navigation bar** - spans entire screen width
2. **Full-width sub-navigation bar** - also spans entire screen
3. **ROBLOX logo** - smaller, just the "ROBLOX" text/logo button (not the full banner)
4. **"My ROBLOX" renamed to "Home"**

### 2013 Main Navigation Items:
- Home (was "My ROBLOX")
- Games
- Catalog
- Develop
- Builders Club
- Forum
- More (dropdown: People, Blog, Help)

### 2013 Sub-Navigation Items:
- Profile
- Character
- Friends
- Groups
- Inventory
- Sets
- Trade
- Money
- Advertising
- Account

## Header Elements

### Alert Space (Top Right):
- Logout button
- Tickets count with icon
- Robux count with icon
- Friend requests with notification bubble
- Messages icon
- Username display with 13+ icon

### Currency Icons:
- Tickets icon (yellow)
- Robux icon (green)
- Friends icon (blue)
- Messages icon

## Color Scheme (2013)

Based on the archived CSS:
- Navigation background: Dark blue/black gradient
- Sub-navigation: Gray gradient
- Body background: Light gray (#f2f2f2)
- Link color: Blue (#0066cc)
- Header text: White on dark background

## Web Archive Sources

For downloading assets that fail from CDN:

1. **Main Archive Page**: 
   `https://web.archive.org/web/20131101000000*/http://www.roblox.com/home`

2. **CSS Files**:
   `https://web.archive.org/web/2013/https://www.roblox.com/CSS/`

3. **Image Assets**:
   `https://web.archive.org/web/2013/https://images.rbxcdn.com/`

## Manual Download Instructions

If the automated script fails:

1. Go to https://web.archive.org
2. Search for `roblox.com/home` with date range 2013
3. Open the archived page
4. Use browser DevTools (F12) > Network tab
5. Reload and filter by "img" or "css"
6. Right-click and save each asset

## File Organization

```
themes/roblox-2013/
├── CSS/
│   └── 2013/
│       ├── main-2013.css
│       └── page-2013.css
├── images/
│   └── 2013/
│       ├── icon-13plus.png
│       ├── icon-see-more.png
│       └── ... (other icons)
├── assets/
│   └── 2013/
│       └── (additional assets)
└── styles/
    └── 2013-overrides.css (our custom overrides)
```
