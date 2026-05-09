import puppeteer from 'puppeteer';

export async function scrapeMarketPrices() {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        await page.goto('https://www.tgju.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const data = await page.evaluate(() => {
            const getVal = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.innerText.trim() : 'N/A';
            };
            return {
                usd: getVal('tr[data-market-row="price_dollar_rl"] .info-price'),
                eur: getVal('tr[data-market-row="price_eur"] .info-price'),
                gold: getVal('tr[data-market-row="geram18"] .info-price')
            };
        });
        
        return {
            ...data,
            updated: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        };
    } catch (e) {
        console.error("Scraping error:", e);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}
