/**
 * 2013 ROBLOX Theme Asset Downloader
 * 
 * This script downloads assets from the archived 2013 ROBLOX page.
 * Run with: node scripts/download-2013-assets.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Base directories
const ASSETS_DIR = path.join(__dirname, '..', 'assets', '2013');
const CSS_DIR = path.join(__dirname, '..', 'CSS', '2013');
const IMAGES_DIR = path.join(__dirname, '..', 'images', '2013');

// Create directories if they don't exist
[ASSETS_DIR, CSS_DIR, IMAGES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// 2013 CSS files from roblox.com
const CSS_URLS = [
    {
        url: 'https://www.roblox.com/CSS/Base/CSS/FetchCSS?path=main___9f842fd9a1a7173bd52d5de5563566b8_m.css',
        filename: 'main-2013.css'
    },
    {
        url: 'https://www.roblox.com/CSS/Base/CSS/FetchCSS?path=page___bd540dc4bbc3cb88bfd00f03ec91d022_m.css',
        filename: 'page-2013.css'
    }
];

// UI assets from the archived page (hashed filenames mapped to descriptive names)
const UI_ASSETS = [
    { hash: '8ed6b064a35786706f738c0858345c11', ext: 'png', name: 'icon-13plus' },
    { hash: 'efe86a4cae90d4c37a5d73480dea4cb1', ext: 'png', name: 'icon-see-more' },
    { hash: '3a3aa21b169be06d20de7586e56e3739', ext: 'png', name: 'icon-offline' },
    { hash: '4ec0c6c40a454f2f6537946d00f09b56', ext: 'png', name: 'facebook-connect' },
    { hash: 'ec4e85b0c4396cf753a06fade0a8d8af', ext: 'gif', name: 'loading-spinner' },
    { hash: '1ea8de3b0f71a67b032b67ddc1770c78', ext: 'png', name: 'icon-report-abuse' },
    { hash: '164e80229d83c8b6e55b1eb671887e54', ext: 'png', name: 'icon-online-chat' },
    { hash: '8a762994af1e122de8ac427005ac3d9b', ext: 'png', name: 'icon-close-chat' },
    { hash: 'e998fb4c03e8c2e30792f2f3436e9416', ext: 'gif', name: 'progress-spinner' }
];

// These are the CDN URLs for the hashed assets
// They're typically served from images.rbxcdn.com or similar
const CDN_BASE_URLS = [
    'https://images.rbxcdn.com/',
    'https://tr.rbxcdn.com/',
    'https://t0.rbxcdn.com/'
];

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        console.log(`Downloading: ${url}`);
        
        const request = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                console.log(`  Redirecting to: ${redirectUrl}`);
                downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            
            const file = fs.createWriteStream(destPath);
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`  Saved: ${destPath}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
        
        request.on('error', reject);
        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error(`Timeout for ${url}`));
        });
    });
}

async function downloadCSS() {
    console.log('\n=== Downloading 2013 CSS Files ===\n');
    
    for (const css of CSS_URLS) {
        const destPath = path.join(CSS_DIR, css.filename);
        try {
            await downloadFile(css.url, destPath);
        } catch (err) {
            console.error(`  Failed: ${err.message}`);
        }
    }
}

async function downloadUIAssets() {
    console.log('\n=== Downloading 2013 UI Assets ===\n');
    console.log('Note: These assets use hashed filenames from the archived page.');
    console.log('They may need to be sourced from web.archive.org if direct download fails.\n');
    
    for (const asset of UI_ASSETS) {
        const filename = `${asset.name}.${asset.ext}`;
        const destPath = path.join(IMAGES_DIR, filename);
        
        // Try different CDN URLs
        let downloaded = false;
        for (const baseUrl of CDN_BASE_URLS) {
            const url = `${baseUrl}${asset.hash}`;
            try {
                await downloadFile(url, destPath);
                downloaded = true;
                break;
            } catch (err) {
                // Try next CDN
            }
        }
        
        if (!downloaded) {
            console.log(`  Could not download ${asset.name} - may need manual download from archive`);
            console.log(`  Original hash: ${asset.hash}.${asset.ext}`);
        }
    }
}

// Generate a mapping file for reference
function generateAssetMapping() {
    const mapping = {
        description: '2013 ROBLOX Theme Asset Mapping',
        generated: new Date().toISOString(),
        css: CSS_URLS.map(c => ({ original: c.url, local: `CSS/2013/${c.filename}` })),
        ui_assets: UI_ASSETS.map(a => ({
            original_hash: `${a.hash}.${a.ext}`,
            local: `images/2013/${a.name}.${a.ext}`,
            description: a.name.replace(/-/g, ' ')
        }))
    };
    
    const mappingPath = path.join(__dirname, '..', 'assets', '2013-asset-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`\nAsset mapping saved to: ${mappingPath}`);
}

async function main() {
    console.log('2013 ROBLOX Theme Asset Downloader');
    console.log('===================================\n');
    
    await downloadCSS();
    await downloadUIAssets();
    generateAssetMapping();
    
    console.log('\n=== Download Complete ===');
    console.log('\nNext steps:');
    console.log('1. Check the downloaded files in assets/2013, CSS/2013, and images/2013');
    console.log('2. For any failed downloads, try web.archive.org with the original URLs');
    console.log('3. Update the theme CSS to reference the new 2013 styles');
}

main().catch(console.error);
