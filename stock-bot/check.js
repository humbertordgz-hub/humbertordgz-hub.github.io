// Watches product pages for the Zelda 40th Anniversary Switch 2 and pings a
// Discord webhook when one flips from not-in-stock to in-stock. Read-only:
// it never adds to cart, logs in, or checks out anything.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'state.json');

const TARGETS = [
  {
    name: 'Best Buy',
    url: 'https://www.bestbuy.com/product/switch-2-the-legend-of-zelda-40th-anniversary-edition/J7GSL57HTY',
  },
  {
    name: 'Target',
    url: 'https://www.target.com/p/nintendo-8482-switch-2-the-legend-of-zelda-40th-anniversary-edition-console-system/-/A-1013322047',
  },
  {
    name: 'Walmart',
    url: 'https://www.walmart.com/ip/Nintendo-Switch-2-The-Legend-of-Zelda-40th-Anniversary-Edition/21002656445',
  },
  {
    name: 'Nintendo Store',
    url: 'https://www.nintendo.com/us/store/products/nintendo-switch-2-the-legend-of-zelda-40th-anniversary-edition-121642/',
  },
];

const IN_STOCK_PATTERNS = [/add to cart/i, /add to bag/i, /buy now/i, /ship it/i];
const OUT_OF_STOCK_PATTERNS = [
  /sold out/i,
  /out of stock/i,
  /currently unavailable/i,
  /notify me/i,
  /coming soon/i,
  /join waitlist/i,
  /email me when available/i,
];
// Some retailers (Walmart, Best Buy) sometimes serve a bot-verification
// challenge instead of the real page. We detect that and log it as
// "blocked" rather than misreporting it as out-of-stock.
const BLOCKED_PATTERNS = [
  /verify you are human/i,
  /press (and )?hold/i,
  /activate and hold/i,
  /robot or human/i,
  /access denied/i,
  /are you a robot/i,
  /security check/i,
  /request unsuccessful/i,
];

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function classify(text) {
  if (BLOCKED_PATTERNS.some((p) => p.test(text))) return 'blocked';
  const outOfStock = OUT_OF_STOCK_PATTERNS.some((p) => p.test(text));
  const inStock = IN_STOCK_PATTERNS.some((p) => p.test(text));
  if (inStock && !outOfStock) return 'in_stock';
  if (outOfStock) return 'out_of_stock';
  return 'unknown';
}

async function notifyDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    console.error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  }
}

async function checkTarget(context, target) {
  const page = await context.newPage();
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const text = await page.innerText('body').catch(() => '');
    return { status: classify(text), snippet: text.slice(0, 400) };
  } catch (err) {
    console.error(`[${target.name}] check failed: ${err.message}`);
    return { status: 'error', snippet: '' };
  } finally {
    await page.close();
  }
}

async function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL env var is not set');

  const state = loadState();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });

  for (const target of TARGETS) {
    const { status, snippet } = await checkTarget(context, target);
    const previous = state[target.name]?.status;
    console.log(`[${target.name}] status=${status} (previous=${previous ?? 'none'})`);
    if (status === 'unknown' || status === 'blocked') {
      console.log(`[${target.name}] page text snippet: ${JSON.stringify(snippet)}`);
    }

    if (status === 'in_stock' && previous !== 'in_stock') {
      await notifyDiscord(
        webhookUrl,
        `🚨 **${target.name}** looks IN STOCK for the Zelda 40th Anniversary Switch 2!\n${target.url}`,
      );
    }

    state[target.name] = { status, checkedAt: new Date().toISOString() };
  }

  await browser.close();
  saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
