const fs = require('fs');
const path = require('path');

const outputFilename = 'All_CCERT_Code.txt';

// In folders ko ignore marna hai (Bhaari kachra aur images)
const ignoreDirs = ['node_modules', 'build', '.git', 'assets', '.firebase'];

// In files ko strictly ignore marna hai (Privacy ke liye API keys aur lock files)
const ignoreFiles = ['.env', 'config.js', 'package-lock.json'];

// Sirf in extensions wali files ka code uthana hai
const allowedExtensions = ['.js', '.jsx', '.css', '.html', '.json', '.rules'];

let allCode = '';

function scanFolder(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!ignoreDirs.includes(file)) {
                scanFolder(fullPath);
            }
        } else {
            const ext = path.extname(file);
            
            // File extension allow honi chahiye aur ignore list mein nahi honi chahiye
            if (allowedExtensions.includes(ext) && !ignoreFiles.includes(file)) {
                
                // Extra security: Agar file ke naam mein 'env' hai toh usko chhod do
                if (file.includes('env')) continue;

                const content = fs.readFileSync(fullPath, 'utf-8');
                allCode += `\n\n/*******************************************************\n`;
                allCode += ` * FILE: ${fullPath}\n`;
                allCode += ` *******************************************************/\n\n`;
                allCode += content;
            }
        }
    }
}

console.log("🚀 Script start ho rahi hai... Frontend aur Backend dono ka code nikal raha hoon...");

// Frontend aur Backend dono folders ko scan karo
scanFolder('./frontend');
scanFolder('./backend');

// File save karo
fs.writeFileSync(outputFilename, allCode);
console.log(`\n✅ Success Bhai! Saara code (Frontend + Backend) '${outputFilename}' mein aa gaya hai.`);
console.log(`🔒 Privacy maintained: .env aur keys wali files safe hain.`);