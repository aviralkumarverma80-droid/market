"use strict";

const INITIAL_WATCHLIST = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology", price: 231.78, change: 1.07, seed: 5, logo: "A" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Semiconductors", price: 142.62, change: 2.84, seed: 12, logo: "N" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology", price: 415.32, change: 0.63, seed: 21, logo: "M" },
  { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", sector: "Technology", price: 171.94, change: -0.41, seed: 36, logo: "G" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", sector: "Consumer cyclical", price: 196.42, change: 1.22, seed: 48, logo: "a" },
  { symbol: "META", name: "Meta Platforms, Inc.", exchange: "NASDAQ", sector: "Communication", price: 612.77, change: -0.76, seed: 55, logo: "M" },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", sector: "Automotive", price: 338.11, change: 3.18, seed: 69, logo: "T" },
  { symbol: "AMD", name: "Advanced Micro Devices", exchange: "NASDAQ", sector: "Semiconductors", price: 118.45, change: -1.32, seed: 83, logo: "A" }
];

const RANGE_COUNT = { "1D": 7, "1W": 7, "1M": 22, "3M": 66, "6M": 132, "1Y": 250 };
const RANGE_LABEL = { "1D": "1 DAY", "1W": "1 WEEK", "1M": "1 MONTH", "3M": "3 MONTHS", "6M": "6 MONTHS", "1Y": "1 YEAR" };
const LABEL_PERIOD = { "1D": "today", "1W": "past week", "1M": "past month", "3M": "past 3 months", "6M": "past 6 months", "1Y": "past year" };
const COLORS = ["#b6ec81", "#d0b779", "#9dbaef", "#d88c84", "#b8a4d6", "#85c7bd", "#dfaa70", "#a4c5a5"];
const DAY_MS = 86_400_000;
const QUICK_ACTIONS = [
  { type: "range", value: "1D", title: "View one-day chart", detail: "Switch to intraday price action", icon: "◷", meta: "1D", featured: true },
  { type: "range", value: "1M", title: "View one-month chart", detail: "Switch to one month of history", icon: "◷", meta: "1M", featured: true },
  { type: "refresh", title: "Refresh market data", detail: "Fetch the latest quote and price history", icon: "↻", meta: "UPDATE", featured: true },
  { type: "export", title: "Export chart to CSV", detail: "Download prices and calculated indicators", icon: "↓", meta: "CSV", featured: true },
  { type: "connect", title: "Connect a data provider", detail: "Set up your Twelve Data API key", icon: "◈", meta: "SETUP" },
  { type: "chart", title: "Switch chart style", detail: "Toggle between area and line", icon: "⌁", meta: "CHART" },
  { type: "indicator", value: "sma20", title: "Toggle SMA 20", detail: "Show or hide the 20-period average", icon: "∿", meta: "SMA" },
  { type: "indicator", value: "sma50", title: "Toggle SMA 50", detail: "Show or hide the 50-period average", icon: "∿", meta: "SMA" }
];

const elements = Object.fromEntries(
  [
    "market-status", "today-date", "company-logo", "company-name", "company-caption",
    "favorite-button", "main-price", "price-change", "chart-period-label", "chart-source",
    "chart-updated", "price-chart", "chart-wrap", "chart-tooltip", "sma20-value",
    "sma20-label", "sma50-value", "sma50-label", "volatility-value", "return-value", "return-label", "sentiment-label", "sentiment-badge",
    "sentiment-track-mark", "volatility-info", "volatility-period-start", "volatility-description-label", "volatility-chart", "volatility-chip", "volatility-ticker",
    "watchlist-body", "watchlist-count", "search-input", "empty-state", "api-key-form",
    "api-key-input", "connect-button", "connect-status", "connect-summary",
    "disconnect-button", "connect-details", "refresh-button", "chart-mode-button", "export-button", "toast",
    "signout-button",
    "command-open", "command-shortcut", "command-dialog", "command-input",
    "command-results", "command-empty", "command-close"
  ].map(id => [id, document.getElementById(id)])
);

let watchlist = structuredCopy(INITIAL_WATCHLIST);
let selectedSymbol = "AAPL";
let selectedRange = "1M";
let chartType = "area";
let chartData = [];
let sampleSeries = [];
let favoriteSymbols = new Set();
let activeIndicators = { sma20: true, sma50: true };
let hoverIndex = -1;
let requestVersion = 0;
let dataIsLive = false;
let activeRequestController = null;
let refreshTimer = null;
let quotePercentChange = null;
let quoteTimestamp = null;
let toastTimer;
let currentFilter = "";
let commandItems = [];
let selectedCommandIndex = 0;

function structuredCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function mulberry32(seed) {
  return function nextRandom() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function generateSampleSeries(stock) {
  const random = mulberry32(stock.seed);
  const count = 250;
  const values = [];
  let price = stock.price * (0.79 + random() * 0.34);
  const drift = (stock.price - price) / count;
  const dailyVolatility = stock.symbol === "TSLA" || stock.symbol === "AMD" ? 0.021 : 0.011;

  for (let index = 0; index < count; index += 1) {
    price = Math.max(stock.price * 0.5, price + drift + (random() - 0.49) * stock.price * dailyVolatility);
    values.push({ date: recentTradingDate(count - index - 1), value: price });
  }
  values[values.length - 1] = { date: recentTradingDate(0), value: stock.price };
  return values;
}

function generateIntradaySampleSeries(stock) {
  const random = mulberry32(stock.seed + 197);
  const count = 51;
  const volatility = stock.price * 0.0016;
  const values = [];
  let price = stock.price * 0.98;
  for (let index = 0; index < count; index += 1) {
    price = Math.max(stock.price * 0.96, price + (random() - 0.47) * volatility);
    const lastSessionStart = count - RANGE_COUNT["1D"];
    const sessionOffset = index >= lastSessionStart
      ? 0
      : Math.floor((lastSessionStart - index - 1) / RANGE_COUNT["1D"]) + 1;
    const intradayBar = index >= lastSessionStart ? index - lastSessionStart : index % RANGE_COUNT["1D"];
    const date = recentTradingDate(sessionOffset);
    date.setHours(9, 30 + intradayBar * 65, 0, 0);
    values.push({ date, value: price });
  }
  values[values.length - 1] = {
    date: recentTradingDate(0),
    value: stock.price
  };
  values[values.length - 1].date.setHours(16, 0, 0, 0);
  return values;
}

function recentTradingDate(offset) {
  const date = new Date();
  date.setHours(16, 0, 0, 0);
  if (date.getDay() === 6) date.setDate(date.getDate() - 1);
  if (date.getDay() === 0) date.setDate(date.getDate() - 2);
  let daysToSubtract = 0;
  let counted = 0;
  while (counted < offset) {
    daysToSubtract += 1;
    const weekday = (date.getDay() - daysToSubtract % 7 + 7) % 7;
    if (weekday !== 0 && weekday !== 6) counted += 1;
  }
  date.setDate(date.getDate() - daysToSubtract);
  return date;
}

function dollars(value, decimals = 2) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
    : "—";
}

function signedPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function selectedStock() {
  return watchlist.find(stock => stock.symbol === selectedSymbol) || INITIAL_WATCHLIST.find(stock => stock.symbol === selectedSymbol);
}

function movingAverage(values, period) {
  return values.map((point, index) => {
    const beginning = Math.max(0, index - period + 1);
    if (index - beginning + 1 < period) return null;
    const window = values.slice(beginning, index + 1);
    return window.reduce((sum, item) => sum + item.value, 0) / window.length;
  });
}

function historicalVolatility(values, windowSize = 20) {
  const returns = [];
  for (let index = 1; index < values.length; index += 1) {
    returns.push((values[index].value - values[index - 1].value) / values[index - 1].value);
  }
  return returns.map((_, index) => {
    const window = returns.slice(Math.max(0, index - windowSize + 1), index + 1);
    if (window.length < 2) return 0;
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (window.length - 1);
    return Math.sqrt(variance * 252) * 100;
  });
}

function formatChartDate(date, range = selectedRange) {
  const value = date instanceof Date ? date : new Date(date);
  const options = range === "1D"
    ? { hour: "numeric", minute: "2-digit" }
    : range === "1Y" || range === "6M" || range === "3M"
      ? { month: "short", year: "2-digit" }
      : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-US", options).format(value);
}

function svgPath(values, xAt, yAt) {
  let started = false;
  return values.map((value, index) => {
    if (!Number.isFinite(value)) {
      started = false;
      return "";
    }
    const command = started ? "L" : "M";
    started = true;
    return `${command}${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`;
  }).join(" ");
}

function renderChart() {
  const rangeValues = chartData.slice(-RANGE_COUNT[selectedRange]);
  const values = rangeValues.map(point => point.value);
  const svg = elements["price-chart"];

  if (rangeValues.length < 2) {
    svg.innerHTML = '<text class="chart-axis-label" x="380" y="130" text-anchor="middle">Not enough price history for this chart.</text>';
    return;
  }

  const width = 760;
  const height = 265;
  const plot = { left: 8, right: 720, top: 15, bottom: 224 };
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max((rawMax - rawMin) * 0.2, rawMax * 0.006);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const xAt = index => plot.left + index / (values.length - 1) * (plot.right - plot.left);
  const yAt = value => plot.bottom - (value - min) / (max - min) * (plot.bottom - plot.top);
  const points = values.map((value, index) => `${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).join(" ");
  const line = chartType === "line"
    ? `<path class="chart-line" d="${svgPath(values, xAt, yAt)}"/>`
    : `<polygon class="chart-area" points="${plot.left},${plot.bottom} ${points} ${plot.right},${plot.bottom}"/><polyline class="chart-line" points="${points}"/>`;
  const sma20 = movingAverage(chartData.map(point => ({ ...point, value: point.value })), 20).slice(-rangeValues.length);
  const sma50 = movingAverage(chartData.map(point => ({ ...point, value: point.value })), 50).slice(-rangeValues.length);
  const path20 = activeIndicators.sma20 ? `<path class="sma-line sma20-line" d="${svgPath(sma20, xAt, yAt)}"/>` : "";
  const path50 = activeIndicators.sma50 ? `<path class="sma-line sma50-line" d="${svgPath(sma50, xAt, yAt)}"/>` : "";
  const gridLines = [0, 1, 2, 3].map(index => {
    const y = plot.top + index / 3 * (plot.bottom - plot.top);
    const price = max - index / 3 * (max - min);
    return `<line class="chart-grid" x1="${plot.left}" x2="${plot.right}" y1="${y}" y2="${y}"/><text class="chart-axis-label" x="${width - 1}" y="${y - 4}" text-anchor="end">${dollars(price)}</text>`;
  }).join("");
  const dates = [0, Math.floor((rangeValues.length - 1) / 3), Math.floor(2 * (rangeValues.length - 1) / 3), rangeValues.length - 1];
  const dateLabels = [...new Set(dates)].map(index => {
    const anchor = index === 0 ? "start" : index === rangeValues.length - 1 ? "end" : "middle";
    return `<text class="chart-axis-label" x="${xAt(index)}" y="249" text-anchor="${anchor}">${formatChartDate(rangeValues[index].date)}</text>`;
  }).join("");
  const hoverMarkup = hoverIndex >= 0 && hoverIndex < rangeValues.length
    ? `<line class="chart-hover-line" x1="${xAt(hoverIndex)}" x2="${xAt(hoverIndex)}" y1="${plot.top}" y2="${plot.bottom}"/><circle class="chart-hover-point" cx="${xAt(hoverIndex)}" cy="${yAt(values[hoverIndex])}" r="4"/>`
    : "";
  const description = `${selectedStock().symbol} historical price chart, ${RANGE_LABEL[selectedRange].toLowerCase()}. Last price ${dollars(values[values.length - 1])}.`;
  svg.setAttribute("aria-label", description);
  svg.innerHTML = `<defs><linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#b6ec81" stop-opacity=".20"/><stop offset="90%" stop-color="#b6ec81" stop-opacity=".006"/></linearGradient></defs>${gridLines}${line}${path50}${path20}${hoverMarkup}${dateLabels}`;
}

function renderVolatilityChart() {
  const range = historicalVolatility(chartData);
  const recent = range.slice(-20);
  const svg = elements["volatility-chart"];

  if (recent.length < 2) {
    svg.innerHTML = '<text class="chart-axis-label" x="145" y="46" text-anchor="middle">More history needed</text>';
    return;
  }

  const width = 290;
  const height = 94;
  const left = 2;
  const right = 286;
  const top = 7;
  const bottom = 79;
  const max = Math.max(35, ...recent) * 1.12;
  const xAt = index => left + index / (recent.length - 1) * (right - left);
  const yAt = value => bottom - value / max * (bottom - top);
  const points = recent.map((value, index) => `${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).join(" ");
  const line = svgPath(recent, xAt, yAt);
  svg.innerHTML = `<defs><linearGradient id="vol-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#d0b779" stop-opacity=".22"/><stop offset="100%" stop-color="#d0b779" stop-opacity=".01"/></linearGradient></defs><line class="vol-grid" x1="${left}" x2="${right}" y1="24" y2="24"/><line class="vol-grid" x1="${left}" x2="${right}" y1="52" y2="52"/><polygon class="vol-area" points="${left},${bottom} ${points} ${right},${bottom}"/><path class="vol-line" d="${line}"/>`;
}

function chartPeriods() {
  const values = chartData.slice(-RANGE_COUNT[selectedRange]);
  if (values.length < 2) return { change: 0, return20: 0 };
  const first = values[0].value;
  const latest = values[values.length - 1].value;
  const returnStart = selectedRange === "1D" ? first : chartData[Math.max(0, chartData.length - 21)].value;
  return {
    change: (latest - first) / first * 100,
    return20: (latest - returnStart) / returnStart * 100
  };
}

function renderIndicators() {
  if (chartData.length === 0) return;

  const stock = selectedStock();
  const latest = chartData[chartData.length - 1].value;
  const sma20 = movingAverage(chartData, 20).at(-1) ?? latest;
  const sma50 = movingAverage(chartData, 50).at(-1) ?? latest;
  const volatilityHistory = historicalVolatility(chartData);
  const hourlyData = selectedRange === "1D";
  const annualizationFactor = hourlyData ? 252 * 6.5 : 252;
  const latestVolatility = volatilityHistory.at(-1) || 0;
  const volatility = latestVolatility * Math.sqrt(annualizationFactor / 252);
  const { change, return20 } = chartPeriods();
  const momentum = Math.max(-1, Math.min(1, return20 / 8 + (latest - sma20) / latest * 3));
  const isPositive = momentum > 0.08;
  const isNegative = momentum < -0.08;
  const badge = isPositive ? "BULLISH" : isNegative ? "BEARISH" : "NEUTRAL";

  elements["company-logo"].textContent = stock.logo;
  elements["company-name"].textContent = stock.name;
  elements["company-caption"].innerHTML = `${stock.symbol} <span class="caption-dot">·</span> ${stock.sector}`;
  elements["main-price"].textContent = dollars(latest);
  elements["price-change"].innerHTML = `<span class="${change >= 0 ? "positive" : "negative"}">${signedPercent(change)} <span class="change-period">${LABEL_PERIOD[selectedRange]}</span></span>`;
  elements["chart-period-label"].textContent = RANGE_LABEL[selectedRange];
  elements["sma20-label"].textContent = hourlyData ? "20-hour average" : "20-day average";
  elements["sma50-label"].textContent = hourlyData ? "50-hour average" : "50-day average";
  elements["return-label"].textContent = hourlyData ? "Session return" : "20-day return";
  elements["sma20-value"].innerHTML = `${dollars(sma20)} <span class="mini-tag ${latest >= sma20 ? "above-tag" : "below-tag"}">${latest >= sma20 ? "ABOVE" : "BELOW"}</span>`;
  elements["sma50-value"].innerHTML = `${dollars(sma50)} <span class="mini-tag ${latest >= sma50 ? "above-tag" : "below-tag"}">${latest >= sma50 ? "ABOVE" : "BELOW"}</span>`;
  elements["volatility-value"].innerHTML = `${volatility.toFixed(1)}% <span class="vol-chip">${volatility < 20 ? "LOW" : volatility > 40 ? "HIGH" : "MODERATE"}</span>`;
  elements["return-value"].textContent = signedPercent(return20);
  elements["return-value"].className = `metric-value ${return20 >= 0 ? "positive" : "negative"}`;
  elements["sentiment-label"].textContent = isPositive ? "Positive momentum" : isNegative ? "Cooling momentum" : "Finding direction";
  elements["sentiment-badge"].textContent = badge;
  elements["sentiment-badge"].className = `sentiment-badge${isNegative ? " bearish" : isPositive ? "" : " neutral"}`;
  elements["sentiment-track-mark"].style.left = `${Math.max(3, Math.min(97, (momentum + 1) / 2 * 100))}%`;
  elements["volatility-chip"].textContent = `${volatility.toFixed(1)}%`;
  elements["volatility-info"].title = hourlyData
    ? "20-observation standard deviation of hourly returns, annualized assuming 6.5 trading hours per session."
    : "20-observation standard deviation of daily returns, annualized using 252 trading sessions.";
  elements["volatility-period-start"].textContent = hourlyData ? "20 HOURS AGO" : "20 SESSIONS AGO";
  elements["volatility-description-label"].textContent = hourlyData ? "over the past session." : "day to day.";
  elements["volatility-ticker"].textContent = stock.symbol;
  elements["favorite-button"].textContent = favoriteSymbols.has(stock.symbol) ? "★" : "☆";
  elements["favorite-button"].classList.toggle("favorited", favoriteSymbols.has(stock.symbol));
  elements["favorite-button"].setAttribute("aria-pressed", String(favoriteSymbols.has(stock.symbol)));
  elements["favorite-button"].setAttribute("aria-label", `${favoriteSymbols.has(stock.symbol) ? "Remove" : "Add"} ${stock.name} ${favoriteSymbols.has(stock.symbol) ? "from" : "to"} favorites`);
  const percent = ((latest - stock.price) / stock.price) * 100;
  const row = watchlist.find(item => item.symbol === selectedSymbol);
  if (row && dataIsLive) {
    row.price = latest;
    row.change = quotePercentChange ?? (selectedRange === "1D"
      ? percent
      : ((latest - chartData[chartData.length - 2].value) / chartData[chartData.length - 2].value) * 100);
  }
}

function compactChart(values, color, negative = false) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${(index / (values.length - 1) * 76).toFixed(1)},${(25 - (value - min) / span * 21).toFixed(1)}`).join(" ");
  return `<svg class="table-spark" viewBox="0 0 76 29" aria-hidden="true"><path d="${path}" fill="none" stroke="${negative ? "#d28175" : color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderWatchlist() {
  const search = currentFilter.trim().toLowerCase();
  const filtered = watchlist.filter(stock =>
    stock.symbol.toLowerCase().includes(search) || stock.name.toLowerCase().includes(search)
  );
  elements["watchlist-count"].textContent = String(filtered.length).padStart(2, "0");
  elements["empty-state"].hidden = filtered.length !== 0;

  elements["watchlist-body"].innerHTML = filtered.map(stock => {
    const points = stock.symbol === selectedSymbol && chartData.length > 1
      ? chartData.slice(-22).map(point => point.value)
      : generateSampleSeries(stock).slice(-22).map(point => point.value);
    const colorIndex = INITIAL_WATCHLIST.findIndex(item => item.symbol === stock.symbol);
    const negative = stock.change < 0;
    return `<tr data-symbol="${stock.symbol}" class="${stock.symbol === selectedSymbol ? "selected-row" : ""}" tabindex="0" aria-label="View ${stock.name} (${stock.symbol})">
      <td><div class="stock-company"><span class="stock-icon" style="color:${COLORS[colorIndex % COLORS.length]}">${stock.logo}</span><span class="stock-identity"><span class="stock-name">${stock.name}</span><span class="stock-symbol">${stock.symbol} · ${stock.exchange}</span></span></div></td>
      <td class="stock-price">${dollars(stock.price)}</td><td class="stock-change ${negative ? "negative" : "positive"}">${negative ? "↘" : "↗"} ${Math.abs(stock.change).toFixed(2)}%</td>
      <td>${compactChart(points, COLORS[colorIndex % COLORS.length], negative)}</td><td class="row-arrow">↗</td>
    </tr>`;
  }).join("");
}

function matchesCommand(text, query) {
  return text.toLowerCase().includes(query);
}

function renderCommandItem(item, index) {
  const isStock = item.type === "stock";
  const icon = isStock ? item.logo : item.icon;
  const accent = isStock ? "" : " command-action-icon";
  return `<button class="command-item" id="command-result-${index}" type="button" role="option" aria-selected="${index === selectedCommandIndex}" data-command-index="${index}">
    <span class="command-item-icon${accent}">${icon}</span>
    <span class="command-item-copy"><span class="command-item-title">${item.title}</span><span class="command-item-detail">${item.detail}</span></span>
    <span class="command-item-meta">${item.meta}</span>
  </button>`;
}

function renderCommandResults(value = "") {
  const query = value.trim().toLowerCase();
  const actions = QUICK_ACTIONS.filter(action =>
    (!query && action.featured) || (query && matchesCommand(`${action.title} ${action.detail} ${action.meta}`, query))
  );
  const stocks = watchlist.filter(stock =>
    !query || matchesCommand(`${stock.symbol} ${stock.name} ${stock.sector}`, query)
  ).map(stock => ({
    type: "stock",
    symbol: stock.symbol,
    title: stock.name,
    detail: `${stock.symbol} · ${stock.exchange} · ${stock.sector}`,
    logo: stock.logo,
    meta: "OPEN"
  }));
  commandItems = [...actions, ...stocks];
  selectedCommandIndex = 0;
  const groups = [
    { title: "QUICK ACTIONS", items: actions },
    { title: "SYMBOLS", items: stocks }
  ].filter(group => group.items.length > 0);

  elements["command-results"].innerHTML = groups.map(group => {
    const firstItemIndex = commandItems.indexOf(group.items[0]);
    return `<section class="command-group" role="group" aria-label="${group.title}"><div class="command-group-heading">${group.title}</div>${group.items.map((item, index) => renderCommandItem(item, firstItemIndex + index)).join("")}</section>`;
  }).join("");
  elements["command-empty"].hidden = commandItems.length > 0;
  if (commandItems.length > 0) setActiveCommand(0, false);
  else elements["command-input"].removeAttribute("aria-activedescendant");
}

function setActiveCommand(index, scroll = true) {
  const options = elements["command-results"].querySelectorAll(".command-item");
  if (options.length === 0) return;
  selectedCommandIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const active = optionIndex === selectedCommandIndex;
    option.setAttribute("aria-selected", String(active));
    if (active && scroll) option.scrollIntoView({ block: "nearest" });
  });
  elements["command-input"].setAttribute("aria-activedescendant", `command-result-${selectedCommandIndex}`);
}

function openCommandPalette(query = "") {
  if (!elements["command-dialog"].open) elements["command-dialog"].showModal();
  elements["command-open"].setAttribute("aria-expanded", "true");
  elements["command-input"].value = query;
  renderCommandResults(query);
  requestAnimationFrame(() => elements["command-input"].focus());
}

function runCommand(item) {
  elements["command-dialog"].close();
  if (item.type === "stock") {
    selectStock(item.symbol);
    return;
  }
  if (item.type === "range") {
    document.querySelector(`.range-button[data-range="${item.value}"]`).click();
  } else if (item.type === "refresh") {
    elements["refresh-button"].click();
  } else if (item.type === "export") {
    elements["export-button"].click();
  } else if (item.type === "connect") {
    elements["connect-details"].open = true;
    requestAnimationFrame(() => elements["api-key-input"].focus());
  } else if (item.type === "chart") {
    elements["chart-mode-button"].click();
  } else if (item.type === "indicator") {
    document.querySelector(`.legend-toggle[data-indicator="${item.value}"]`).click();
  }
}

elements["command-open"].addEventListener("click", () => openCommandPalette());
elements["command-close"].addEventListener("click", () => elements["command-dialog"].close());
elements["command-input"].addEventListener("input", event => renderCommandResults(event.currentTarget.value));
elements["command-input"].addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    elements["command-dialog"].close();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    setActiveCommand(selectedCommandIndex + direction);
  } else if (event.key === "Enter" && commandItems.length > 0) {
    event.preventDefault();
    runCommand(commandItems[selectedCommandIndex]);
  }
});
elements["command-results"].addEventListener("click", event => {
  const option = event.target.closest(".command-item[data-command-index]");
  if (option) runCommand(commandItems[Number(option.dataset.commandIndex)]);
});
elements["command-results"].addEventListener("pointerover", event => {
  const option = event.target.closest(".command-item[data-command-index]");
  if (option) setActiveCommand(Number(option.dataset.commandIndex), false);
});
elements["command-dialog"].addEventListener("close", () => {
  elements["command-open"].setAttribute("aria-expanded", "false");
  elements["command-input"].value = "";
  elements["command-open"].focus();
});
elements["command-dialog"].addEventListener("click", event => {
  if (event.target === elements["command-dialog"]) elements["command-dialog"].close();
});
elements["command-open"].setAttribute("aria-expanded", "false");
elements["command-shortcut"].textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
  }
});

function renderAll() {
  renderIndicators();
  renderChart();
  renderVolatilityChart();
  renderWatchlist();
}

function renderMode() {
  const isConnected = Boolean(sessionStorage.getItem("twelvedata-api-key")) && dataIsLive;
  const stock = selectedStock();
  elements["chart-source"].textContent = dataIsLive ? "LIVE QUOTE · TWELVE DATA" : "SAMPLE DATA";
  elements["chart-updated"].textContent = dataIsLive
    ? `Quote ${quoteTimestamp ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(quoteTimestamp) : "updated"} · refreshes every minute`
    : "Sample market history · not live";
  document.querySelector(".snapshot-note").firstChild.textContent = isConnected
    ? `INDEX SNAPSHOT · ONLY ${stock.symbol} USES YOUR API `
    : "ILLUSTRATIVE SNAPSHOT ";
  document.querySelector(".watchlist-footnote .footnote-dot").nextSibling.textContent = isConnected
    ? ` ${stock.symbol} API PRICE · OTHER PRICES ILLUSTRATIVE`
    : " ILLUSTRATIVE PRICES · MARKET DATA REQUIRES API CONNECTION";
  elements["connect-summary"].innerHTML = isConnected
    ? 'API connected in this tab <span aria-hidden="true">✓</span>'
    : sessionStorage.getItem("twelvedata-api-key")
      ? 'API key saved in this tab <span aria-hidden="true">↗</span>'
      : 'Set up connection <span aria-hidden="true">↗</span>';
  elements["disconnect-button"].hidden = !sessionStorage.getItem("twelvedata-api-key");
}

async function fetchProviderJSON(url, signal, kind) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Twelve Data ${kind} returned HTTP ${response.status}.`);
  return response.json();
}

async function loadMarketData() {
  window.clearTimeout(refreshTimer);
  refreshTimer = null;
  if (activeRequestController) {
    activeRequestController.abort();
    activeRequestController = null;
  }
  const stock = selectedStock();
  if (!stock) return;

  const currentVersion = ++requestVersion;
  const key = sessionStorage.getItem("twelvedata-api-key");
  hoverIndex = -1;
  elements["connect-status"].classList.remove("error");

  if (!key) {
    sampleSeries = selectedRange === "1D" ? generateIntradaySampleSeries(stock) : generateSampleSeries(stock);
    chartData = sampleSeries;
    dataIsLive = false;
    quotePercentChange = null;
    quoteTimestamp = null;
    elements["refresh-button"].disabled = false;
    elements["connect-status"].textContent = "";
    renderMode();
    renderAll();
    return;
  }

  sampleSeries = selectedRange === "1D" ? generateIntradaySampleSeries(stock) : generateSampleSeries(stock);
  chartData = sampleSeries;
  dataIsLive = false;
  quotePercentChange = null;
  quoteTimestamp = null;
  elements["refresh-button"].disabled = true;
  renderMode();
  renderAll();
  elements["connect-status"].textContent = `Loading ${stock.symbol} from Twelve Data…`;
  try {
    const isIntraday = selectedRange === "1D";
    const interval = isIntraday ? "1h" : "1day";
    const outputsize = String(Math.max(RANGE_COUNT[selectedRange] + 1, 51));
    const query = new URLSearchParams({ symbol: stock.symbol, interval, outputsize, format: "JSON", apikey: key });
    const quoteQuery = new URLSearchParams({ symbol: stock.symbol, format: "JSON", apikey: key });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    activeRequestController = controller;
    let payload;
    let quote;
    try {
      [payload, quote] = await Promise.all([
        fetchProviderJSON(`https://api.twelvedata.com/time_series?${query}`, controller.signal, "history"),
        fetchProviderJSON(`https://api.twelvedata.com/quote?${quoteQuery}`, controller.signal, "quote")
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequestController === controller) activeRequestController = null;
    }
    if (payload.status === "error" || payload.code) {
      const message = String(payload.message || "The provider rejected the request.");
      const error = new Error(message);
      error.apiError = true;
      throw error;
    }
    if (quote.status === "error" || quote.code) {
      const error = new Error(String(quote.message || "The provider could not return a current quote."));
      error.apiError = true;
      throw error;
    }
    if (!Array.isArray(payload.values) || payload.values.length < 2) {
      throw new Error("The provider returned fewer than two price points. Check the symbol, interval, and your API plan.");
    }
    const liveData = payload.values.map(point => ({
      date: new Date(`${point.datetime}${point.datetime.length === 10 ? "T16:00:00Z" : ""}`),
      value: Number(point.close)
    })).filter(point => Number.isFinite(point.date.getTime()) && Number.isFinite(point.value) && point.value > 0).reverse();
    if (liveData.length < 2) throw new Error("The provider returned unusable price history.");
    const quotePrice = Number(quote.close);
    if (!Number.isFinite(quotePrice) || quotePrice <= 0) throw new Error("The provider returned an invalid current quote.");
    liveData[liveData.length - 1].value = quotePrice;
    quotePercentChange = Number.isFinite(Number(quote.percent_change)) ? Number(quote.percent_change) : null;
    const parsedQuoteTime = quote.datetime ? new Date(String(quote.datetime).replace(" ", "T")) : new Date();
    quoteTimestamp = Number.isFinite(parsedQuoteTime.getTime()) ? parsedQuoteTime : new Date();
    liveData[liveData.length - 1].date = quoteTimestamp;
    if (currentVersion !== requestVersion) return;

    chartData = liveData;
    dataIsLive = true;
    elements["connect-status"].textContent = `Live quote and ${liveData.length} ${interval === "1h" ? "hourly" : "daily"} price points loaded for ${stock.symbol}. Other watchlist prices are sample data.`;
    renderMode();
    renderAll();
    scheduleAutoRefresh();
  } catch (error) {
    if (currentVersion !== requestVersion) return;
    chartData = sampleSeries;
    dataIsLive = false;
    quotePercentChange = null;
    quoteTimestamp = null;
    elements["refresh-button"].disabled = false;
    elements["connect-status"].textContent = `${error.apiError ? `Twelve Data: ${error.message}` : `${error.message} Check your network and API key.`} Showing clearly labeled sample data for ${stock.symbol}.`;
    elements["connect-status"].classList.add("error");
    renderMode();
    renderAll();
    scheduleAutoRefresh();
  } finally {
    if (currentVersion === requestVersion) elements["refresh-button"].disabled = false;
  }
}

function scheduleAutoRefresh() {
  window.clearTimeout(refreshTimer);
  if (!sessionStorage.getItem("twelvedata-api-key")) return;
  refreshTimer = window.setTimeout(() => {
    if (document.visibilityState === "visible") loadMarketData();
    else scheduleAutoRefresh();
  }, 60_000);
}

function selectStock(symbol) {
  if (!watchlist.some(stock => stock.symbol === symbol)) return;
  if (selectedSymbol === symbol) return;
  selectedSymbol = symbol;
  renderWatchlist();
  loadMarketData();
}

function showToast(message) {
  elements["toast"].textContent = message;
  elements["toast"].classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements["toast"].classList.remove("visible"), 2800);
}

function handleChartPointer(event) {
  const range = chartData.slice(-RANGE_COUNT[selectedRange]);
  if (range.length < 2) return;
  const rect = elements["price-chart"].getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  hoverIndex = Math.round(ratio * (range.length - 1));
  renderChart();

  const selected = range[hoverIndex];
  const tooltip = elements["chart-tooltip"];
  const bounds = elements["chart-wrap"].getBoundingClientRect();
  const horizontal = Math.max(60, Math.min(bounds.width - 60, event.clientX - bounds.left));
  const vertical = 45 + (1 - selected.value / Math.max(...range.map(point => point.value))) * 70;
  tooltip.hidden = false;
  tooltip.style.left = `${horizontal}px`;
  tooltip.style.top = `${vertical}px`;
  tooltip.innerHTML = `<span class="tooltip-date">${formatChartDate(selected.date)}</span>${dollars(selected.value)}`;
}

function downloadCSV() {
  if (!chartData.length) {
    showToast("There is no chart data to export yet.");
    return;
  }
  const sma20 = movingAverage(chartData, 20);
  const sma50 = movingAverage(chartData, 50);
  const volatility = historicalVolatility(chartData);
  const annualizationFactor = selectedRange === "1D" ? Math.sqrt(6.5) : 1;
  const csv = ["date,close,sma_20,sma_50,annualized_volatility_20obs"]
    .concat(chartData.map((point, index) => {
      const currentSma20 = sma20[index];
      const currentSma50 = sma50[index];
      const currentVolatility = volatility[index];
      const timestamp = point.date.toISOString();
      return `${selectedRange === "1D" ? timestamp : timestamp.slice(0, 10)},${point.value.toFixed(4)},${currentSma20 == null ? "" : currentSma20.toFixed(4)},${currentSma50 == null ? "" : currentSma50.toFixed(4)},${currentVolatility ? (currentVolatility * annualizationFactor).toFixed(4) : ""}`;
    }))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${selectedSymbol.toLowerCase()}-market-history-${selectedRange.toLowerCase()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${chartData.length} price points for ${selectedSymbol}.`);
}

elements["watchlist-body"].addEventListener("click", event => {
  const row = event.target.closest("tr[data-symbol]");
  if (row) selectStock(row.dataset.symbol);
});

elements["watchlist-body"].addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("tr[data-symbol]");
  if (!row) return;
  event.preventDefault();
  selectStock(row.dataset.symbol);
});

elements["search-input"].addEventListener("input", event => {
  currentFilter = event.target.value;
  renderWatchlist();
});

document.querySelectorAll(".range-button").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.range === selectedRange) return;
    selectedRange = button.dataset.range;
    document.querySelectorAll(".range-button").forEach(item => {
      const isActive = item.dataset.range === selectedRange;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    loadMarketData();
  });
});

document.querySelectorAll(".legend-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const indicator = button.dataset.indicator;
    activeIndicators[indicator] = !activeIndicators[indicator];
    button.classList.toggle("enabled", activeIndicators[indicator]);
    button.setAttribute("aria-pressed", String(activeIndicators[indicator]));
    renderChart();
  });
});

elements["favorite-button"].addEventListener("click", () => {
  if (favoriteSymbols.has(selectedSymbol)) favoriteSymbols.delete(selectedSymbol);
  else favoriteSymbols.add(selectedSymbol);
  renderIndicators();
});

elements["chart-mode-button"].addEventListener("click", () => {
  chartType = chartType === "area" ? "line" : "area";
  elements["chart-mode-button"].classList.toggle("is-active", chartType === "line");
  elements["chart-mode-button"].setAttribute("aria-pressed", String(chartType === "line"));
  renderChart();
});

elements["export-button"].addEventListener("click", downloadCSV);
elements["refresh-button"].addEventListener("click", () => {
  if (!sessionStorage.getItem("twelvedata-api-key")) {
    elements["connect-details"].open = true;
    elements["api-key-input"].focus();
    showToast("Connect your Twelve Data API key to refresh live quotes.");
    return;
  }
  loadMarketData();
});
elements["chart-wrap"].addEventListener("pointermove", handleChartPointer);
elements["chart-wrap"].addEventListener("pointerleave", () => {
  hoverIndex = -1;
  elements["chart-tooltip"].hidden = true;
  renderChart();
});

elements["api-key-form"].addEventListener("submit", async event => {
  event.preventDefault();
  const key = elements["api-key-input"].value.trim();
  if (!key) {
    elements["connect-status"].textContent = "Enter your Twelve Data API key to connect.";
    elements["connect-status"].classList.add("error");
    elements["api-key-input"].focus();
    return;
  }
  sessionStorage.setItem("twelvedata-api-key", key);
  elements["connect-button"].disabled = true;
  elements["connect-button"].textContent = "Connecting…";
  renderMode();
  await loadMarketData();
  elements["connect-button"].disabled = false;
  elements["connect-button"].textContent = "Connect";
  if (!elements["connect-status"].classList.contains("error")) elements["api-key-input"].value = "";
});

elements["disconnect-button"].addEventListener("click", () => {
  window.clearTimeout(refreshTimer);
  refreshTimer = null;
  requestVersion += 1;
  if (activeRequestController) {
    activeRequestController.abort();
    activeRequestController = null;
  }
  sessionStorage.removeItem("twelvedata-api-key");
  elements["api-key-input"].value = "";
  elements["connect-status"].textContent = "API key cleared from this tab. The dashboard now shows sample data.";
  elements["connect-status"].classList.remove("error");
  dataIsLive = false;
  quotePercentChange = null;
  quoteTimestamp = null;
  elements["connect-button"].disabled = false;
  elements["connect-button"].textContent = "Connect";
  sampleSeries = selectedRange === "1D"
    ? generateIntradaySampleSeries(selectedStock())
    : generateSampleSeries(selectedStock());
  chartData = sampleSeries;
  renderMode();
  renderAll();
});

function initializePage() {
  function updateMarketClock() {
    const now = new Date();
    elements["today-date"].textContent = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(now);
    const marketTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const marketParts = Object.fromEntries(marketTime.map(part => [part.type, part.value]));
    const isWeekday = !["Sun", "Sat"].includes(marketParts.weekday);
    const minute = Number(marketParts.hour) * 60 + Number(marketParts.minute);
    const session = !isWeekday
      ? "closed"
      : minute >= 570 && minute < 960
        ? "regular"
        : minute >= 240 && minute < 570
          ? "pre-market"
          : minute >= 960 && minute < 1200
            ? "after-hours"
            : "closed";
    const sessionLabel = {
      "pre-market": "Pre-market",
      regular: "Regular session",
      "after-hours": "After hours",
      closed: "Market closed"
    };
    elements["market-status"].textContent = sessionLabel[session];
    elements["market-status"].parentElement.dataset.session = session;
  }
  updateMarketClock();
  window.setInterval(updateMarketClock, 60_000);
  document.querySelectorAll(".range-button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.range === selectedRange)));
  document.querySelectorAll(".legend-toggle").forEach(button => button.setAttribute("aria-pressed", String(activeIndicators[button.dataset.indicator])));
  elements["chart-mode-button"].setAttribute("aria-pressed", "false");
  renderMode();
  loadMarketData();
}

function clearMarketDataSession() {
  window.clearTimeout(refreshTimer);
  refreshTimer = null;
  requestVersion += 1;
  if (activeRequestController) {
    activeRequestController.abort();
    activeRequestController = null;
  }
  sessionStorage.removeItem("twelvedata-api-key");
}

async function startDashboard() {
  const dashboard = document.getElementById("dashboard");
  const loadingMessage = document.getElementById("auth-loading");
  const authClient = await window.marketfieldAuth.getClient();

  if (!authClient) {
    loadingMessage.hidden = true;
    dashboard.hidden = false;
    elements["signout-button"].hidden = true;
    initializePage();
    return;
  }

  const { data, error } = await authClient.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    clearMarketDataSession();
    window.location.replace("/login.html");
    return;
  }

  dashboard.hidden = false;
  loadingMessage.hidden = true;
  elements["signout-button"].textContent = (data.session.user.email || "M").slice(0, 1).toUpperCase();
  elements["signout-button"].addEventListener("click", async () => {
    elements["signout-button"].disabled = true;
    try {
      const { error: signOutError } = await authClient.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.replace("/login.html");
    } catch {
      elements["signout-button"].disabled = false;
      showToast("Could not sign out. Please try again.");
    }
  });
  authClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      clearMarketDataSession();
      window.location.replace("/login.html");
    }
  });
  initializePage();
}

startDashboard().catch(error => {
  const loadingMessage = document.getElementById("auth-loading");
  loadingMessage.textContent = "Could not verify your session. Check your connection and reload.";
  loadingMessage.classList.add("auth-loading-error");
  console.error("Marketfield authentication initialization failed.", error);
});
