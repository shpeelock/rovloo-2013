/**
 * Download 2013 Navigation Assets from Web Archive
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'images', 'RevisedHeader');

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Navigation assets referenced in the 2013 CSS
const NAV_ASSETS = [
    'bg-main_menu_hover.png',
    'btn-rbx_logo.png',
    'bg-rbx_header.png',
    'bg-icon_sprites.png',
    'bg-alerts-v2.png',
    'bg-sub_menu_hover.png'
];

// Also need dropdown arrow
const BUTTON_ASSETS = [
    { path: 'Buttons', file: 'bg-drop_down_arrow.png' }
];

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);
        
        const request = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            const file = fs.createWriteStream(destPath);
            response.pipe(file);
            file.on('finish', () => { file.close(); console.log(`  Saved: ${path.basename(destPath)}`); resolve(); });
            file.on('error', reject);
        });
        request.on('error', reject);
        request.setTimeout(30000, () => { request.destroy(); reject(new Error('Timeout')); });
    });
}

async function main() {
    console.log('Downloading 2013 Navigation Assets\n');
    
    // Download RevisedHeader assets
    for (const file of NAV_ASSETS) {
        const url = `https://web.archive.org/web/2013/https://www.roblox.com/images/RevisedHeader/${file}`;
        const dest = path.join(IMAGES_DIR, file);
        try {
            await downloadFile(url, dest);
        } catch (e) {
            console.log(`  Failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Download button assets
    for (const asset of BUTTON_ASSETS) {
        const dir = path.join(__dirname, '..', 'images', asset.path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const url = `https://web.archive.org/web/2013/https://www.roblox.com/images/${asset.path}/${asset.file}`;
        const dest = path.join(dir, asset.file);
        try {
            await downloadFile(url, dest);
        } catch (e) {
            console.log(`  Failed: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\nDone!');
}

main().catch(console.error);
