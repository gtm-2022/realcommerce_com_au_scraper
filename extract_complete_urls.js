const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');
const fs = require('fs');

const BASE_URL = 'https://www.realcommercial.com.au/xml-sitemap/pdp-sitemap-for-sale-';
const OUTPUT_JSON = 'realcommercial_sitemap_urls.json';
const OUTPUT_TXT = 'realcommercial_sitemap_urls.txt';
const DELAY_MS = 800; // polite delay between sub-sitemap requests
const MAX_CONSECUTIVE_MISSES = 2; // stop after this many consecutive 404s (in case of a gap)

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.realcommercial.com.au/',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      // Don't retry on 404 - that just means this sitemap page doesn't exist
      if (status === 404) throw err;
      console.log(`  [${label}] attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(2000 * attempt);
    }
  }
}

// Fetch + gunzip a sub-sitemap (.xml.gz) and return all listing URLs in it
async function fetchSubSitemapUrls(sitemapUrl) {
  const res = await axios.get(sitemapUrl, { headers: HEADERS, responseType: 'arraybuffer' });
  const xml = zlib.gunzipSync(res.data).toString('utf-8');
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $('url > loc').each((i, el) => urls.push($(el).text().trim()));
  return urls;
}

async function main() {
  const allUrls = new Set();
  let page = 1;
  let consecutiveMisses = 0;

  while (consecutiveMisses < MAX_CONSECUTIVE_MISSES) {
    const sitemapUrl = `${BASE_URL}${page}.xml.gz`;
    console.log(`\nFetching: ${sitemapUrl}`);

    try {
      const urls = await withRetry(() => fetchSubSitemapUrls(sitemapUrl), sitemapUrl);
      urls.forEach((u) => allUrls.add(u));
      console.log(`  -> ${urls.length} URLs (running total: ${allUrls.size})`);
      consecutiveMisses = 0;
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        console.log(`  -> 404, no such sitemap page (${page})`);
        consecutiveMisses++;
      } else {
        console.log(`  SKIPPED page ${page} after failed attempts: ${err.message}`);
        consecutiveMisses++;
      }
    }

    page++;
    await sleep(DELAY_MS);
  }

  const finalUrls = Array.from(allUrls);
  console.log(`\nTOTAL unique listing URLs: ${finalUrls.length}`);

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalUrls, null, 2));
  fs.writeFileSync(OUTPUT_TXT, finalUrls.join('\n'));
  console.log(`Saved -> ${OUTPUT_JSON} and ${OUTPUT_TXT}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});