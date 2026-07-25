# 2013 ROBLOX Theme for Rovloo

Recreation of the 2013 ROBLOX website interface.

## Key Differences from 2011 Theme

1. **Full-width navigation bar** - The main nav spans the entire screen width
2. **Full-width sub-navigation** - The subnav also spans full width  
3. **ROBLOX logo button** - Smaller logo button instead of the full banner image
4. **"My ROBLOX" → "Home"** - Navigation item renamed
5. **Alert Space** - Currency, friends, messages in the top-right nav bar

## Implementation Status

### Completed
- [x] Downloaded 2013 CSS from roblox.com
- [x] Downloaded UI icons from Web Archive
- [x] Created full-width navigation structure in HTML
- [x] Created 2013-layout.css with full-width nav styles
- [x] Created 2013-nav.js for dropdown and login state handling
- [x] Updated manifest.json

### Page conversion (2011 → 2013)
All content pages have been converted from the inherited 2011 look to the 2013
design system (flat white boxes with `#ccc` borders, dark `#363636` section
titles instead of the blue `#6e99c9` gradient `StandardBoxHeader`, `#095fb5`
links, green `bg-btn-green` buttons, Arial 12px, 970px content width):

- [x] Badge / Game Pass / Catalog Item detail pages
- [x] Character / Avatar page
- [x] Builders Club upgrade page
- [x] Reviews (Rovloo community) page
- [x] Profile, Friends, People, Stuff (rendered from `scripts/main.js` templates — converted via CSS only, no JS changes)
- [x] Inbox, Groups, Account/Settings (inline `#page-*` sections of `index.html`)
- [x] Catalog browse page

Implementation notes:
- Conversion was **CSS-only** — no page scripts were modified, so every element
  id/class the JS reads is preserved. Per-page styling lives in `styles/pages/*.css`;
  a few pages whose styling already lived in `styles/overrides.css`
  (badge, gamepass, character, profile, and the shared `#UserAssetsPane`
  asset grid) were modernized in place there.
- The dead 2011 `<head>`/chrome inside the full-document `pages/*.html` files
  (catalog, profile, friends, people) is not rendered — the SPA extracts only the
  content container — so it was left as-is.

### TODO
- [ ] Test with actual login flow
- [ ] Fine-tune CSS colors to match archived page exactly
- [ ] Refresh preview.png screenshot

## Downloaded Assets

### CSS (from roblox.com - still serving 2013 CSS!)
- `CSS/2013/main-2013.css` - Main stylesheet
- `CSS/2013/page-2013.css` - Page-specific styles

### UI Icons (from Web Archive)
- `images/2013/btn-logo.png` - ROBLOX logo button
- `images/2013/icon-13plus.png` - 13+ account indicator
- `images/2013/icon-see-more.png` - See more arrow
- `images/2013/icon-offline.png` - Offline status
- `images/2013/icon-online-chat.png` - Online chat icon
- `images/2013/icon-close-chat.png` - Close chat button
- `images/2013/icon-report-abuse.png` - Report abuse button
- `images/2013/facebook-connect.png` - Facebook connect image
- `images/2013/loading-spinner.gif` - Loading animation
- `images/2013/progress-spinner.gif` - Progress animation

## File Structure

```
themes/roblox-2013/
├── CSS/
│   └── 2013/
│       ├── main-2013.css      # Original 2013 ROBLOX CSS
│       └── page-2013.css      # Page-specific 2013 CSS
├── images/
│   └── 2013/
│       ├── btn-logo.png       # Logo button
│       └── ...                # Other 2013 icons
├── styles/
│   └── 2013-layout.css        # Our 2013 layout overrides
├── scripts/
│   └── 2013-nav.js            # 2013 navigation handling
├── reference/
│   └── archive-home.html      # Archived 2013 page for reference
├── index.html                 # Main theme entry point
└── manifest.json              # Theme metadata
```

## Reference

The `reference/archive-home.html` file contains the archived 2013 Home page for reference.
