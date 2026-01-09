// --- Real Historical Data Engine (Alpha Vantage) ---

// Placeholder key; replace with real one for prod.
const AV_API_KEY = import.meta.env.VITE_AV_API_KEY || 'DEMO';

interface AVMonthlyResponse {
    "Meta Data": any;
    "Monthly Adjusted Time Series": {
        [date: string]: {
            "5. adjusted close": string;
        }
    };
    "Information"?: string;
    "Note"?: string;
}

export interface QuoteData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    source: 'LIVE' | 'CACHE' | 'ERROR';
    leverage: number; // 1 = 1x (normal), 2 = 2x, 3 = 3x, etc.
}

// --- Leverage Configuration ---
export const LEVERAGE_MAP: { [symbol: string]: number } = {
    // 2x Bull
    'QLD': 2, 'SSO': 2, 'UWM': 2, 'MVV': 2, 'USD': 2,
    // 3x Bull
    'TQQQ': 3, 'UPRO': 3, 'UDOW': 3, 'TNA': 3, 'MIDU': 3,
    'FNGU': 3, 'SOXL': 3, 'TECL': 3,
    // 2x Bear (Short) - optional, treated as negative leverage or just ignored for now?
    // Let's assume user wants simple leverage ratio for volatility scaling for now.
    // 1x Inverse
    'PSQ': -1, 'SH': -1, 'DOG': -1,
    // 2x Bear
    'QID': -2, 'SDS': -2,
    // 3x Bear
    'SQQQ': -3, 'SPXU': -3,
};

export function detectLeverage(symbol: string): number {
    const clean = symbol.toUpperCase().trim();
    return LEVERAGE_MAP[clean] || 1;
}

export const UNDERLYING_MAP: { [symbol: string]: string } = {
    'QLD': 'QQQ', 'TQQQ': 'QQQ',
    'SSO': 'SPY', 'UPRO': 'SPY',
    'SOXL': 'SOXX', 'TECL': 'XLK',
    'FNGU': 'QQQ', // Approximation for FANG+
    // Bears
    'SQQQ': 'QQQ', 'PSQ': 'QQQ',
    'SPXU': 'SPY', 'SH': 'SPY', 'SDS': 'SPY'
};

const FINNHUB_API_KEY = 'd5fo8gpr01qnjhodihkgd5fo8gpr01qnjhodihl0';

// Helper: Fetch with Timeout to prevent hanging
async function fetchWithTimeout(url: string, timeoutMs: number = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

export async function fetchQuote(symbol: string): Promise<QuoteData | null> {
    const cleanSymbol = symbol.toUpperCase().trim();
    try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`;
        const res = await fetchWithTimeout(url, 4000); // 4s timeout for UI responsiveness
        const data = await res.json();

        if (data.c === 0 && data.h === 0) throw new Error("Invalid Ticker");

        return {
            symbol: cleanSymbol,
            name: cleanSymbol,
            price: data.c,
            change: data.d,
            changePercent: data.dp,
            source: 'LIVE',
            leverage: detectLeverage(cleanSymbol)
        };
    } catch (e) {
        console.warn("Quote fetch failed", e);
        return {
            symbol: cleanSymbol,
            name: cleanSymbol,
            price: 150.00,
            change: 1.5,
            changePercent: 1.0,
            source: 'ERROR',
            leverage: detectLeverage(cleanSymbol)
        };
    }
}

// --- Historical & Risk Engine ---

export interface AssetStats {
    symbol: string;
    annualReturn: number;
    annualVolatility: number;
    history: number[]; // Critical: Full price history
    leverage: number;
}

export interface RiskStats {
    maxDrawdown: number; // %
    sharpeRatio: number;
    bestYear: number; // %
    worstYear: number; // %
    beta: number;
}

// Calculate Annualized Return and Volatility from Price History
// Calculate Annualized Return and Volatility from Log Returns
function calculateStatsFromReturns(returns: number[]): { annualReturn: number; annualVolatility: number } {
    const n = returns.length;
    if (n === 0) return { annualReturn: 0, annualVolatility: 0 };

    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Annualize
    const annualizedReturn = (mean * 12) * 100;
    const annualizedVol = (stdDev * Math.sqrt(12)) * 100;

    return { annualReturn: annualizedReturn, annualVolatility: annualizedVol };
}

// Calculate Annualized Return and Volatility from Price History
function calculateStatsFromHistory(prices: number[]): { annualReturn: number; annualVolatility: number; returns: number[] } {
    if (!prices || prices.length < 12) {
        return { annualReturn: 10, annualVolatility: 15, returns: [] };
    }

    // 1. Log Returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const r = Math.log(prices[i] / (prices[i - 1] || 1));
        returns.push(r);
    }

    const stats = calculateStatsFromReturns(returns);
    return { ...stats, returns };
}

function calculateBeta(portReturns: number[], marketReturns: number[]): number {
    if (portReturns.length === 0 || marketReturns.length === 0) return 1.0;

    // Align lengths (take min)
    const len = Math.min(portReturns.length, marketReturns.length);
    if (len < 12) return 1.0;

    const p = portReturns.slice(-len);
    const m = marketReturns.slice(-len);

    const meanP = p.reduce((a, b) => a + b, 0) / len;
    const meanM = m.reduce((a, b) => a + b, 0) / len;

    let cov = 0;
    let varM = 0;

    for (let i = 0; i < len; i++) {
        cov += (p[i] - meanP) * (m[i] - meanM);
        varM += (m[i] - meanM) * (m[i] - meanM);
    }

    if (varM === 0) return 1.0;
    return cov / varM;
}

// Calculate Advanced Risk Metrics from Portfolio Value Series
function calculateRiskMetrics(values: number[], marketHistory?: number[]): RiskStats {
    if (!values || values.length < 12) return { maxDrawdown: 0, sharpeRatio: 0, bestYear: 0, worstYear: 0, beta: 1 };

    // 1. Max Drawdown
    let peak = -Infinity;
    let maxDrawdown = 0;

    for (const v of values) {
        if (v > peak) peak = v;
        const dd = peak > 0 ? (v - peak) / peak : 0;
        if (dd < maxDrawdown) maxDrawdown = dd;
    }

    // 2. Sharpe Ratio
    const { annualReturn, annualVolatility, returns: portReturns } = calculateStatsFromHistory(values);
    const riskFreeRate = 4.0;
    const sharpeRatio = annualVolatility > 0 ? (annualReturn - riskFreeRate) / annualVolatility : 0;

    // 3. Best/Worst Year
    let bestYear = -Infinity;
    let worstYear = Infinity;

    for (let i = 12; i < values.length; i++) {
        const startVal = values[i - 12];
        const endVal = values[i];
        if (startVal > 0) {
            const rollingReturn = ((endVal - startVal) / startVal) * 100;
            if (rollingReturn > bestYear) bestYear = rollingReturn;
            if (rollingReturn < worstYear) worstYear = rollingReturn;
        }
    }

    if (bestYear === -Infinity) bestYear = annualReturn;
    if (worstYear === Infinity) worstYear = annualReturn;

    // 4. Beta
    let beta = 1.0;
    if (marketHistory && marketHistory.length > 12) {
        const { returns: marketReturns } = calculateStatsFromHistory(marketHistory);
        beta = calculateBeta(portReturns, marketReturns);
    }

    return {
        maxDrawdown: maxDrawdown * 100,
        sharpeRatio,
        bestYear,
        worstYear,
        beta
    };
}

// Robust Fetch with Guaranteed Fallback
async function fetchAssetStats(symbol: string): Promise<AssetStats> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const cacheKey = `av_stats_v3_${cleanSymbol}`;

    // Check Cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const entry = JSON.parse(cached);
            if (Date.now() - entry.timestamp < 24 * 60 * 60 * 1000 && entry.data.history.length > 0) {
                return entry.data;
            }
        } catch (e) {/*ignore*/ }
    }

    try {
        const leverage = detectLeverage(cleanSymbol);
        const underlyingSymbol = UNDERLYING_MAP[cleanSymbol];

        // --- MODEL 2.0: Synthetic Leveraged Returns ---
        if (Math.abs(leverage) > 1 && underlyingSymbol) {
            console.log(`[Model 2.0] Fetching underlying ${underlyingSymbol} for ${cleanSymbol} (L=${leverage})`);
            const underlyingStats = await fetchAssetStats(underlyingSymbol);
            const uPrices = underlyingStats.history;

            if (!uPrices || uPrices.length < 12) throw new Error("Underlying data insufficient");

            // 1. Calculate Underlying Log Returns
            const uReturns: number[] = [];
            for (let i = 1; i < uPrices.length; i++) {
                uReturns.push(Math.log(uPrices[i] / (uPrices[i - 1] || 1)));
            }

            // 2. Transform to Leveraged Log Returns
            // Formula: r_L = ln(1 + L * (exp(r_u) - 1))
            const lReturns = uReturns.map(r_u => {
                const R_u = Math.exp(r_u) - 1;       // Simple Return
                const R_L = leverage * R_u;          // Leveraged Simple Return

                // Safety: Limit extreme losses to -99% (log(0.01) approx -4.6)
                // In simulation, bankruptcy is possible, but for stats calculation we clip to avoid NaN
                if (R_L <= -0.99) return -4.6;

                return Math.log(1 + R_L);            // New Log Return
            });

            // 3. Calc Stats
            const stats = calculateStatsFromReturns(lReturns);

            // 4. Construct Synthetic Price History
            // We must return a price series that Reflects the leverage so that
            // calculatePortfolioStats (which re-derives stats from history) sees the correct volatility/return.
            const syntheticHistory: number[] = [uPrices[0]];
            for (let i = 0; i < lReturns.length; i++) {
                const prev = syntheticHistory[i];
                const next = prev * Math.exp(lReturns[i]);
                syntheticHistory.push(next);
            }

            const result = {
                symbol: cleanSymbol,
                annualReturn: stats.annualReturn,
                annualVolatility: stats.annualVolatility,
                history: syntheticHistory,
                leverage: leverage
            };

            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
            return result;
        }

        console.log(`Fetching history for ${cleanSymbol}...`);
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${cleanSymbol}&apikey=${AV_API_KEY}`;
        const res = await fetchWithTimeout(url, 6000); // 6s timeout for history
        const data: AVMonthlyResponse = await res.json();

        if (!data["Monthly Adjusted Time Series"]) {
            throw new Error("AV_LIMIT_OR_ERROR");
        }

        const timeSeries = data["Monthly Adjusted Time Series"];
        const dates = Object.keys(timeSeries).sort(); // Oldest -> Newest
        const prices = dates.map(d => parseFloat(timeSeries[d]["5. adjusted close"])).filter(n => !isNaN(n));
        const recentPrices = prices.slice(-120); // Last 10y

        if (recentPrices.length < 12) throw new Error("INSUFFICIENT_DATA");

        const stats = calculateStatsFromHistory(recentPrices);

        const result = {
            symbol: cleanSymbol,
            annualReturn: stats.annualReturn,
            annualVolatility: stats.annualVolatility,
            history: recentPrices,
            leverage: detectLeverage(cleanSymbol)
        };

        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
        return result;

    } catch (e) {
        console.warn(`Fallback for ${cleanSymbol} due to:`, e);

        // --- ROBUST FALLBACK GENERATOR ---
        // --- ROBUST FALLBACK GENERATOR ---
        // Enhanced to support Leveraged ETFs even in fallback mode (e.g. QLD hits rate limit)
        const leverage = detectLeverage(cleanSymbol);
        const underlying = UNDERLYING_MAP[cleanSymbol] || cleanSymbol; // QLD -> QQQ, or just AAPL -> AAPL

        let mu = 0.10; let sigma = 0.15; // Defaults for unknown
        if (['SPY', 'QQQ', 'IVV', 'VOO', 'DIA'].includes(underlying)) { mu = 0.12; sigma = 0.18; }
        else if (['NVDA', 'TSLA', 'AMD', 'COIN'].includes(underlying)) { mu = 0.45; sigma = 0.55; }
        else if (['AAPL', 'MSFT', 'GOOG', 'META', 'AMZN'].includes(underlying)) { mu = 0.25; sigma = 0.30; }
        else if (['BTC', 'ETH'].includes(underlying)) { mu = 0.70; sigma = 0.80; }
        else if (['SOXX', 'SMH'].includes(underlying)) { mu = 0.20; sigma = 0.35; }

        const startPrice = 100;
        const fakeUnderlyingHistory = [startPrice];
        const dt = 1 / 12;

        // Generate Underlying Path
        for (let i = 0; i < 120; i++) {
            const prev = fakeUnderlyingHistory[fakeUnderlyingHistory.length - 1];
            // Random Normal
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u1 || 0.01)) * Math.cos(2.0 * Math.PI * (u2 || 0.01));

            const drift = (mu - 0.5 * sigma * sigma) * dt;
            const diffusion = sigma * Math.sqrt(dt) * z;
            const change = Math.exp(drift + diffusion);

            fakeUnderlyingHistory.push(prev * change);
        }

        // Use Underlying or Synthesize Leveraged
        let finalHistory = fakeUnderlyingHistory;

        if (Math.abs(leverage) > 1) {
            // Apply Model 2.0 Logic to the Fake History
            const uReturns: number[] = [];
            for (let i = 1; i < fakeUnderlyingHistory.length; i++) {
                uReturns.push(Math.log(fakeUnderlyingHistory[i] / (fakeUnderlyingHistory[i - 1] || 1)));
            }

            const lReturns = uReturns.map(r_u => {
                const R_u = Math.exp(r_u) - 1;
                const R_L = leverage * R_u;
                if (R_L <= -0.99) return -4.6;
                return Math.log(1 + R_L);
            });

            const syntheticHistory: number[] = [fakeUnderlyingHistory[0]];
            for (let i = 0; i < lReturns.length; i++) {
                const prev = syntheticHistory[i];
                const next = prev * Math.exp(lReturns[i]);
                syntheticHistory.push(next);
            }
            finalHistory = syntheticHistory;
        }

        const stats = calculateStatsFromHistory(finalHistory);
        return {
            symbol: cleanSymbol,
            annualReturn: stats.annualReturn,
            annualVolatility: stats.annualVolatility,
            history: finalHistory,
            leverage: leverage
        };
    }
}

export interface PortfolioConfigItem {
    symbol: string;
    shares?: number;
    weight?: number; // legacy support
}

export interface PortfolioStats extends RiskStats {
    expectedReturn: number;
    volatility: number;
    runStats?: any;
}

export async function calculatePortfolioStats(items: PortfolioConfigItem[]): Promise<PortfolioStats> {
    if (items.length === 0) return { expectedReturn: 0, volatility: 0, maxDrawdown: 0, sharpeRatio: 0, bestYear: 0, worstYear: 0, beta: 0 };

    // 1. Fetch History AND Market History (for Beta)
    const [assetStats, marketStats] = await Promise.all([
        Promise.all(items.map(item => fetchAssetStats(item.symbol))),
        fetchAssetStats('SPY') // Always fetch SPY reference
    ]);

    // 2. Construct Portfolio Value Series
    const validStats = assetStats.filter(s => s.history && s.history.length > 0);

    if (validStats.length === 0) {
        return { expectedReturn: 8, volatility: 12, maxDrawdown: -15, sharpeRatio: 0.5, bestYear: 10, worstYear: -5, beta: 1 };
    }

    const minLength = Math.min(...validStats.map(a => a.history.length));
    const portfolioHistory: number[] = [];

    // Align series
    for (let i = 0; i < minLength; i++) {
        let val = 0;
        items.forEach((item, idx) => {
            const stats = assetStats[idx];
            if (!stats.history || stats.history.length === 0) return;

            const priceIndex = stats.history.length - minLength + i;
            const price = stats.history[priceIndex];

            if (item.shares && item.shares > 0) {
                val += item.shares * price;
            } else {
                val += 100 * price;
            }
        });
        portfolioHistory.push(val);
    }

    // 3. Calc Metrics (Pass Market History for Beta)
    const riskStats = calculateRiskMetrics(portfolioHistory, marketStats.history);
    const portStats = calculateStatsFromHistory(portfolioHistory);

    return {
        expectedReturn: Number(portStats.annualReturn.toFixed(2)),
        volatility: Number(portStats.annualVolatility.toFixed(2)),
        ...riskStats
    };
}
