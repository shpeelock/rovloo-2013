/**
 * 2013 ROBLOX Theme - Web Archive Asset Downloader
 * 
 * Downloads assets from web.archive.org since the original CDN links are expired.
 * Run with: node scripts/download-from-archive.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'images', '2013');

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Web Archive URLs for the 2013 assets
// Format: https://web.archive.org/web/TIMESTAMP/ORIGINAL_URL
const ARCHIVE_ASSETS = [
    {
        // 13+ icon
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/8ed6b064a35786706f738c0858345c11.png',
        filename: 'icon-13plus.png'
    },
    {
        // See more arrow
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/efe86a4cae90d4c37a5d73480dea4cb1.png',
        filename: 'icon-see-more.png'
    },
    {
        // Offline status
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/3a3aa21b169be06d20de7586e56e3739.png',
        filename: 'icon-offline.png'
    },
    {
        // Facebook connect
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/4ec0c6c40a454f2f6537946d00f09b56.png',
        filename: 'facebook-connect.png'
    },
    {
        // Loading spinner
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/ec4e85b0c4396cf753a06fade0a8d8af.gif',
        filename: 'loading-spinner.gif'
    },
    {
        // Report abuse
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/1ea8de3b0f71a67b032b67ddc1770c78.png',
        filename: 'icon-report-abuse.png'
    },
    {
        // Online chat icon
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/164e80229d83c8b6e55b1eb671887e54.png',
        filename: 'icon-online-chat.png'
    },
    {
        // Close chat
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/8a762994af1e122de8ac427005ac3d9b.png',
        filename: 'icon-close-chat.png'
    },
    {
        // Progress spinner
        archiveUrl: 'https://web.archive.org/web/2013/https://images.rbxcdn.com/e998fb4c03e8c2e30792f2f3436e9416.gif',
        filename: 'progress-spinner.gif'
    },
    {
        // ROBLOX logo button (2013 style)
        archiveUrl: 'https://web.archive.org/web/2013/https://www.roblox.com/images/btn-logo.png',
        filename: 'btn-logo.png'
    }
];

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);
        
        const request = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (response) => {
            // Handle redirects (Web Archive often redirects)
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
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
                console.log(`  Saved: ${path.basename(destPath)}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
        
        request.on('error', reject);
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error(`Timeout for ${url}`));
        });
    });
}

async function main() {
    console.log('2013 ROBLOX Theme - Web Archive Downloader');
    console.log('==========================================\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const asset of ARCHIVE_ASSETS) {
        const destPath = path.join(IMAGES_DIR, asset.filename);
        try {
            await downloadFile(asset.archiveUrl, destPath);
            successCount++;
        } catch (err) {
            console.error(`  Failed: ${err.message}`);
            failCount++;
        }
        
        // Small delay to be nice to Web Archive
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`\n=== Complete ===`);
    console.log(`Downloaded: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    
    if (failCount > 0) {
        console.log('\nFor failed downloads, try manually visiting:');
        console.log('https://web.archive.org/web/2013*/roblox.com');
        console.log('and searching for the specific asset.');
    }
}

main().catch(console.error);
