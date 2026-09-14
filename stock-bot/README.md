# Switch 2 Zelda 40th Anniversary Edition — Stock Notify Bot

Watches Best Buy, Target, Walmart, and the Nintendo Store every 5 minutes.
When any of them flips from not-in-stock to in-stock, it posts an alert to
a Discord channel you control. It is read-only: it never logs in, adds to
cart, or buys anything — it only looks at the public page and tells you.

## One-time setup (no coding needed)

1. **Create a Discord webhook** (this is where alerts get posted):
   - Open Discord, create a server if you don't have one (free).
   - Create a text channel, e.g. `#switch2-alerts`.
   - Click the gear icon next to the channel → **Integrations** → **Webhooks** → **New Webhook**.
   - Click **Copy Webhook URL**. Keep this private — anyone with it can post to your channel.

2. **Add it as a GitHub secret** (so it's never exposed in the code):
   - In this repo on GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `DISCORD_WEBHOOK_URL`
   - Value: paste the webhook URL from step 1.
   - Save.

3. **Merge this branch into `main`.** GitHub only runs scheduled workflows
   (the `cron` in `.github/workflows/stock-check.yml`) from the default
   branch, so the bot won't actually run on a schedule until this is merged.

4. Optional: you can trigger a check manually any time without waiting for
   the schedule — go to the **Actions** tab → **Switch 2 Zelda Stock Check** →
   **Run workflow**.

## Known limitations (read this)

- **Walmart and Best Buy actively block automated checks** with bot-verification
  challenges (confirmed while building this). When that happens the bot logs
  it as "blocked" in the Actions run log instead of guessing — it will not
  try to disguise itself as a human to get past that, so those two retailers
  may miss restocks. Target and the Nintendo Store worked cleanly in testing.
- It checks every 5 minutes. That's intentionally not-too-aggressive so it
  behaves like a normal visitor, not a hammering bot.
- It only tells you when something is in stock — you still complete checkout
  yourself, manually, as a human.

## Files

- `check.js` — the checker script.
- `state.json` — remembers the last known status per retailer so you don't
  get repeat alerts (committed back to the repo automatically by the workflow).
- `package.json` — the one dependency (Playwright, to load pages like a real browser).
