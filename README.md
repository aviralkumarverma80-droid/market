# Marketfield

Marketfield is a responsive, browser-based stock analytics dashboard. It starts with reproducible **sample data** so you can explore the chart, watchlist, CSV export, 20- and 50-session simple moving averages, annualized volatility, and 20-session returns without signing up for a service.

## Run it

With Node.js installed, serve the folder over HTTP:

```powershell
node server.js
```

Then open https://aviralkumarverma80-droid.github.io/market/login.html in your browser. No npm install or other dependencies are required.

Press **Ctrl+K** (or **Command+K** on macOS) to open the accessible quick-search palette. Search company names and symbols, move through results with the arrow keys, and press Enter to select a stock or run an action. Press Escape to return to the dashboard.

## Configure Supabase authentication

Marketfield protects the dashboard with Supabase email/password authentication. Users can create an account, sign in, reset a forgotten password, and sign out. Supabase stores the account records; the dashboard server only provides the public Supabase project URL and publishable key.

1. Create a Supabase project and enable email/password authentication.
2. In Supabase Auth URL settings, set the site URL to `http://127.0.0.1:8000` and add both `http://127.0.0.1:8000/login.html` and `http://127.0.0.1:8000/login.html?mode=recovery` to the allowed redirect URLs for email confirmation and password recovery.
3. In PowerShell, set the project URL and **publishable** key in the same terminal used to start the server:

   ```powershell
   $env:SUPABASE_URL = "https://your-project.supabase.co"
   $env:SUPABASE_PUBLISHABLE_KEY = "your-supabase-publishable-key"
   node server.js
   ```

   A legacy Supabase anon key can be supplied as `SUPABASE_ANON_KEY`. Never use or expose a Supabase `service_role` key in the browser or these settings.
4. Open Marketfield and create an account. If email confirmation is enabled, confirm the address before signing in. Signing out also clears the Twelve Data key saved in that browser tab.

The Supabase JavaScript client is loaded from jsDelivr. The redirect URL must match the address and port used to open Marketfield. For deployment, use HTTPS, set the environment variables in the hosting platform, and configure the production redirect URL in Supabase. Protect any future user-specific database tables with Supabase Row Level Security policies.

## Connect live prices

1. Get your own API key from [Twelve Data](https://twelvedata.com/pricing).
2. In Marketfield, expand **Set up connection**, paste the key, and select **Connect**.
3. Select a symbol or a chart range to request a current quote and historical prices from Twelve Data. Connected quotes refresh automatically every 60 seconds; you can also refresh them using the chart toolbar. The API tier determines the available symbols, quote delay, intervals, and request quota.
4. Select **Disconnect & clear key** to remove the key from the current browser tab's session storage.

The key is sent to Twelve Data's API and held in this tab's session storage; it is not included in the project files. Do not use a private or organization-wide API key in an untrusted browser or on a public/shared computer. In API mode, only the selected company's history and derived figures use provider data; other watchlist prices and index cards remain explicitly labeled as illustrative.

The top-bar session indicator and clock use Eastern Time and update every minute. Session states are estimated from weekday trading hours and do not account for exchange holidays.

## Indicators

- **SMA 20 / SMA 50:** arithmetic averages of the last 20 or 50 available observations.
- **Annualized volatility:** standard deviation over the latest 20 observations. Daily returns use `sqrt(252)`; hourly returns use `sqrt(252 * 6.5)` to annualize to trading hours. The result is expressed as a percentage.
- **20-session return:** percent change from the close 20 observations earlier.
- **CSV export:** exports historical closes, both averages, and annualized volatility for the selected symbol.

Prices, indexes, and company moves displayed without an API connection are deterministic illustrative examples, **not quotes, advice, or data for trading decisions**. Historical indicators describe past price movement and do not predict future performance. The browser-only Twelve Data integration is subject to that service's API plan, rate limits, symbols, and market-data terms. This prototype does not place trades or save market preferences; Supabase stores account authentication records.
