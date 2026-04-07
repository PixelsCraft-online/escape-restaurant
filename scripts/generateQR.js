const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '../client/public/qr');

async function generateQRCodes() {
  console.log('Generating QR Codes for 20 tables...');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    for (let i = 1; i <= 20; i++) {
        const url = `${CLIENT_URL}/menu?table=${i}`;
        const filePath = path.join(OUTPUT_DIR, `table_${i}.png`);
        
        await QRCode.toFile(filePath, url, {
            color: {
                dark: '#000000',  // Black dots
                light: '#ffffff' // White background
            },
            width: 300,
            margin: 2
        });
        
        console.log(`✅ Generated: table_${i}.png -> ${url}`);
    }
    console.log('🎉 All QR Codes generated successfully in client/public/qr/');
  } catch (err) {
    console.error('Failed to generate QR codes', err);
  }
}

generateQRCodes();
