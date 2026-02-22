/**
 * Package extension for Chrome Web Store
 */

import { createWriteStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple zip implementation using node's built-in zlib
// For production, you'd use archiver or similar
async function createZip() {
    const sourceDir = __dirname;
    const outputFile = join(sourceDir, 'spidey-sense-chess.zip');
    
    console.log('🕷️ Packaging Spidey Sense Chess...');
    
    // For now, we'll use the zip command line tool
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
        // List of files to include
        const files = [
            'manifest.json',
            'config.js',
            'background/',
            'content/',
            'popup/',
            'utils/',
            'icons/'
        ];
        
        // Create zip using command line
        await execAsync(`cd "${sourceDir}" && zip -r spidey-sense-chess.zip ${files.join(' ')} -x "*.DS_Store" -x "node_modules/*" -x "package*.json" -x "generate-icons.js" -x "package-extension.js" -x "reference-repo/*"`);
        
        console.log('✅ Package created: spidey-sense-chess.zip');
        
        // Get file size
        const stats = await stat(outputFile);
        console.log(`📦 Package size: ${(stats.size / 1024).toFixed(2)} KB`);
        
    } catch (error) {
        console.error('❌ Packaging failed:', error.message);
        
        // Fallback: try without exclusions
        try {
            await execAsync(`cd "${sourceDir}" && zip -r spidey-sense-chess.zip manifest.json config.js background content popup utils icons`);
            console.log('✅ Package created (fallback): spidey-sense-chess.zip');
        } catch (error2) {
            console.error('❌ Fallback also failed:', error2.message);
        }
    }
}

createZip();
