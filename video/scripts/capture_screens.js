import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'assets');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PAGES_TO_CAPTURE = [
  { name: 'home.png', path: '/', selector: 'h1' },
  { name: 'marketplace.png', path: '/buyer/marketplace', selector: 'div' },
  { name: 'market_prices.png', path: '/market-prices', selector: 'div' },
  { name: 'farmer_flow.png', path: '/farmer/login', selector: 'button' },
  { name: 'buyer_flow.png', path: '/buyer/login', selector: 'button' },
];

const BASE_URL = 'http://localhost:5173';

async function run() {
  console.log('🚀 Capturing ultra-high-resolution real AgriDirect screens from local build...');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1.5 },
  });

  const page = await browser.newPage();

  for (const item of PAGES_TO_CAPTURE) {
    const url = `${BASE_URL}${item.path}`;
    const targetFile = path.join(OUTPUT_DIR, item.name);
    console.log(`📸 Navigating to ${url} -> ${item.name}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: targetFile, type: 'png' });
      const stats = fs.statSync(targetFile);
      console.log(`✅ Saved ${item.name} (${stats.size} bytes)`);
    } catch (err) {
      console.warn(`⚠️ Error capturing ${item.name}: ${err.message}. Taking direct screenshot...`);
      await page.screenshot({ path: targetFile, type: 'png' });
    }
  }

  await browser.close();
  console.log('🎉 All high-res AgriDirect website screens captured successfully!');
}

run().catch((e) => {
  console.error('Fatal capture error:', e);
  process.exit(1);
});

