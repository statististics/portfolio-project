// --- Real Historical Data Engine (Alpha Vantage) ---

// Placeholder key; replace with real one for prod.
const AV_API_KEY = (import.meta as any)?.env?.VITE_AV_API_KEY || 'DEMO';

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
    leverage: number;
}

// --- Leverage Configuration ---
export const LEVERAGE_MAP: { [symbol: string]: number } = {
    'QLD': 2, 'SSO': 2, 'UWM': 2, 'MVV': 2, 'USD': 2,
    'TQQQ': 3, 'UPRO': 3, 'UDOW': 3, 'TNA': 3, 'MIDU': 3,
    'FNGU': 3, 'SOXL': 3, 'TECL': 3,
    'PSQ': -1, 'SH': -1, 'DOG': -1,
    'QID': -2, 'SDS': -2,
    'SLVR': 1, 'AGQ': 2, 'USLV': 3
};

export function detectLeverage(symbol: string): number {
    const clean = symbol.toUpperCase().trim();
    return LEVERAGE_MAP[clean] || 1;
}

export const UNDERLYING_MAP: { [symbol: string]: string } = {
    'QLD': 'QQQ', 'TQQQ': 'QQQ',
    'SSO': 'SPY', 'UPRO': 'SPY',
    'SOXL': 'SOXX', 'TECL': 'XLK',
    'FNGU': 'QQQ',
    'SQQQ': 'QQQ', 'PSQ': 'QQQ',
    'SPXU': 'SPY', 'SH': 'SPY', 'SDS': 'SPY',
    'SLVR': 'SLV', 'AGQ': 'SLV', 'USLV': 'SLV'
};

const FINNHUB_API_KEY = 'd5fo8gpr01qnjhodihkgd5fo8gpr01qnjhodihl0';

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
        const res = await fetchWithTimeout(url, 4000);
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
    history: number[];
    dates?: string[];
    leverage: number;
}

export interface RiskStats {
    maxDrawdown: number;
    sharpeRatio: number;
    bestYear: number;
    worstYear: number;
    beta: number;
    runStats?: any;
}

// Calculate Stats (Dynamic Frequency)
// Factor: 252 for Daily, 12 for Monthly.
function calculateStatsFromReturns(returns: number[], freqFactor: number): { annualReturn: number; annualVolatility: number } {
    const n = returns.length;
    if (n === 0) return { annualReturn: 0, annualVolatility: 0 };

    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Linear Annualization (Dynamic)
    const annualizedReturn = (mean * freqFactor) * 100;

    // Volatility: StdDev * sqrt(Freq)
    let annualizedVol = (stdDev * Math.sqrt(freqFactor)) * 100;

    return { annualReturn: annualizedReturn, annualVolatility: annualizedVol };
}

// True CAGR Helper (Date-Based)
function calculateCAGR(startPrice: number, endPrice: number, startDateStr: string, endDateStr: string): number {
    if (startPrice <= 0) return 0;

    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();

    // Years Difference
    const diffMs = end - start;
    const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);

    if (years < 0.05) return 0; // Too short

    // Formula: (End / Start)^(1 / Years) - 1
    const cagr = (Math.pow(endPrice / startPrice, 1 / years) - 1) * 100;

    console.log(`DEBUG CAGR: ${startDateStr}->${endDateStr} (${years.toFixed(2)}y): ${startPrice}->${endPrice}. Result=${cagr.toFixed(2)}%`);

    return cagr;
}

// Calculate Stats from Price History
function calculateStatsFromHistory(prices: number[], dates: string[]): { annualReturn: number; annualVolatility: number; returns: number[] } {
    if (!prices || prices.length < 2 || !dates || dates.length !== prices.length) {
        return { annualReturn: 0, annualVolatility: 0, returns: [] };
    }

    // 1. Detect Frequency
    const startD = new Date(dates[0]).getTime();
    const endD = new Date(dates[dates.length - 1]).getTime();
    const totalDays = (endD - startD) / (1000 * 3600 * 24);
    const avgGap = totalDays / (prices.length - 1);

    let freqFactor = 252; // Default Daily
    if (avgGap > 25) freqFactor = 12; // Monthly

    console.log(`DEBUG: Detected Avg Gap ${avgGap.toFixed(1)} days. Using Factor ${freqFactor}.`);

    // 2. Simple Returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const prev = prices[i - 1];
        const curr = prices[i];
        if (!prev || prev === 0) {
            returns.push(0);
            continue;
        }
        let r = (curr - prev) / prev;

        // Guard: Cap Monthly outlier at 100%, Daily at 20%?
        // Let's stick to 100% hard cap for safety.
        if (Math.abs(r) > 1.0) r = 0.0;

        returns.push(r);
    }

    const simpleStats = calculateStatsFromReturns(returns, freqFactor);

    // 3. CAGR Override
    const cagr = calculateCAGR(prices[0], prices[prices.length - 1], dates[0], dates[dates.length - 1]);

    return {
        annualReturn: cagr,
        annualVolatility: simpleStats.annualVolatility,
        returns
    };
}

// Beta with Inner Join
function calculateBeta(portReturns: number[], marketReturns: number[]): number {
    if (portReturns.length === 0 || marketReturns.length === 0) return 1.0;
    const len = Math.min(portReturns.length, marketReturns.length);
    if (len < 5) return 1.0;

    const meanP = portReturns.reduce((a, b) => a + b, 0) / len;
    const meanM = marketReturns.reduce((a, b) => a + b, 0) / len;

    let covariance = 0;
    let varianceM = 0;

    for (let i = 0; i < len; i++) {
        covariance += (portReturns[i] - meanP) * (marketReturns[i] - meanM);
        varianceM += Math.pow(marketReturns[i] - meanM, 2);
    }

    if (varianceM === 0) return 1.0;
    return covariance / varianceM;
}

function calculateRiskMetrics(portfolioHistory: number[], portfolioDates: string[], benchmarkHistory?: number[], benchmarkDates?: string[]): RiskStats {
    if (!portfolioHistory || portfolioHistory.length < 2) {
        return { maxDrawdown: 0, sharpeRatio: 0, bestYear: 0, worstYear: 0, beta: 0 };
    }

    // Max Drawdown
    let peak = -Infinity;
    let maxDd = 0;
    for (const val of portfolioHistory) {
        if (val > peak) peak = val;
        const dd = peak > 0 ? (peak - val) / peak : 0;
        if (dd > maxDd) maxDd = dd;
    }

    // Beta
    let beta = 0;
    const { returns: pReturns } = calculateStatsFromHistory(portfolioHistory, portfolioDates);

    if (benchmarkHistory && benchmarkHistory.length > 5 && benchmarkDates) {
        // Benchmark logic needs same frequency detection
        const { returns: mReturns } = calculateStatsFromHistory(benchmarkHistory, benchmarkDates);
        beta = calculateBeta(pReturns, mReturns);
    }

    // Sharpe
    const { annualReturn, annualVolatility } = calculateStatsFromHistory(portfolioHistory, portfolioDates);
    const riskFreeRate = 4.0;
    const sharpe = annualVolatility === 0 ? 0 : (annualReturn - riskFreeRate) / annualVolatility;

    // Best/Worst (Date-Aware Window?)
    // If Monthly, window should be 12. If Daily, 252.
    // Use heuristic again.
    const startD = new Date(portfolioDates[0]).getTime();
    const endD = new Date(portfolioDates[portfolioDates.length - 1]).getTime();
    const totalDays = (endD - startD) / (1000 * 3600 * 24);
    const avgGap = totalDays / (portfolioHistory.length - 1);

    const window = avgGap > 25 ? 12 : 252;

    let bestYear = -Infinity;
    let worstYear = Infinity;

    if (portfolioHistory.length >= window) {
        for (let i = window; i < portfolioHistory.length; i++) {
            const startPrice = portfolioHistory[i - window];
            const endPrice = portfolioHistory[i];
            if (startPrice > 0) {
                const ret = ((endPrice - startPrice) / startPrice) * 100;
                if (ret > bestYear) bestYear = ret;
                if (ret < worstYear) worstYear = ret;
            }
        }
    } else {
        bestYear = annualReturn;
        worstYear = annualReturn;
    }

    if (!isFinite(bestYear)) bestYear = annualReturn;
    if (!isFinite(worstYear)) worstYear = annualReturn;

    return {
        // Cap visual glitches
        maxDrawdown: Math.min(maxDd * 100, 100),
        sharpeRatio: sharpe,
        bestYear: Math.min(Math.max(bestYear, -99), 500),
        worstYear: Math.min(Math.max(worstYear, -99), 500),
        beta
    };
}

async function fetchAssetStats(symbol: string): Promise<AssetStats> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const cacheKey = `av_stats_v6_${cleanSymbol}`; // Bump v6

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
        // const leverage = detectLeverage(cleanSymbol);
        // const underlyingSymbol = UNDERLYING_MAP[cleanSymbol];

        // --- MODEL 2.0 (Simplified for robustness) ---
        // Just use AV directly for now to isolate CAGR issues.
        // If underlying logic is needed we can add it back, but let's prioritize correct math first.

        console.log(`Fetching history for ${cleanSymbol}...`);
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${cleanSymbol}&apikey=${AV_API_KEY}`;
        const res = await fetchWithTimeout(url, 6000);
        const data: AVMonthlyResponse = await res.json();

        if (!data["Monthly Adjusted Time Series"]) throw new Error("AV_LIMIT_OR_ERROR");

        const timeSeries = data["Monthly Adjusted Time Series"];
        const dates = Object.keys(timeSeries).sort();
        const prices = dates.map(d => parseFloat(timeSeries[d]["5. adjusted close"])).filter(n => !isNaN(n));

        const MAX_POINTS = 240; // 20 years (monthly)
        const recentPrices = prices.slice(-MAX_POINTS);
        const recentDates = dates.slice(-MAX_POINTS);

        if (recentPrices.length < 6) throw new Error("INSUFFICIENT_DATA");

        // Pre-calc stats just for cache? Not needed really.
        const stats = calculateStatsFromHistory(recentPrices, recentDates);

        const result = {
            symbol: cleanSymbol,
            annualReturn: stats.annualReturn,
            annualVolatility: stats.annualVolatility,
            history: recentPrices,
            dates: recentDates,
            leverage: detectLeverage(cleanSymbol)
        };

        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
        return result;

    } catch (e) {
        console.warn(`Fetch failed for ${cleanSymbol}:`, e);
        throw new Error(`Failed to fetch data for ${cleanSymbol}.`);
    }
}

export interface PortfolioConfigItem {
    symbol: string;
    shares?: number;
    weight?: number;
}

export interface PortfolioStats extends RiskStats {
    expectedReturn: number;
    volatility: number;
    runStats?: any;
}

export type DataPeriod = '1Y' | '3Y' | '5Y' | 'MAX';

export async function calculatePortfolioStats(items: PortfolioConfigItem[], period: DataPeriod = 'MAX'): Promise<PortfolioStats> {
    if (items.length === 0) return { expectedReturn: 0, volatility: 0, maxDrawdown: 0, sharpeRatio: 0, bestYear: 0, worstYear: 0, beta: 0 };

    const assetStatsResult = await Promise.all(items.map(async item => {
        try {
            return await fetchAssetStats(item.symbol);
        } catch (e) {
            console.error(`Failed to fetch ${item.symbol}`, e);
            return null;
        }
    }));

    const validStats = assetStatsResult.filter(s => s !== null && s.history.length > 0) as AssetStats[];

    let marketStats: AssetStats | null = null;
    try {
        marketStats = await fetchAssetStats('SPY');
    } catch (e) {
        console.warn("SPY fetch failed.");
    }

    if (validStats.length === 0) {
        return { expectedReturn: 0, volatility: 0, maxDrawdown: 0, sharpeRatio: 0, bestYear: 0, worstYear: 0, beta: 0 };
    }

    // 2. STRICT INTERSECTION
    let commonDates = new Set<string>(validStats[0].dates || []);
    for (let i = 1; i < validStats.length; i++) {
        const currentDates = new Set(validStats[i].dates || []);
        commonDates = new Set([...commonDates].filter(d => currentDates.has(d)));
    }
    if (marketStats && marketStats.dates) {
        const marketDates = new Set(marketStats.dates);
        commonDates = new Set([...commonDates].filter(d => marketDates.has(d)));
    }

    let sortedCommonDates = Array.from(commonDates).sort();

    // Slicing Logic (Approximate by count, assuming Monthly or Daily)
    // We strictly slice by COUNT now, but logic below handles freq.
    // 1Y ?
    // If Daily, 252. If Monthly, 12.
    // Need to detect freq of common dates.
    let requiredPoints = 9999;

    // Check Gap
    if (sortedCommonDates.length > 2) {
        const d1 = new Date(sortedCommonDates[0]).getTime();
        const d2 = new Date(sortedCommonDates[1]).getTime();
        const gap = (d2 - d1) / (1000 * 3600 * 24);
        const isMonthly = gap > 20;

        if (period === '1Y') requiredPoints = isMonthly ? 12 : 252;
        if (period === '3Y') requiredPoints = isMonthly ? 36 : 756;
        if (period === '5Y') requiredPoints = isMonthly ? 60 : 1260;
    }

    if (sortedCommonDates.length > requiredPoints) {
        sortedCommonDates = sortedCommonDates.slice(-requiredPoints);
    }

    const debugInfo: any = {
        commonDataPoints: sortedCommonDates.length,
        periodSelected: period
    };

    if (sortedCommonDates.length < 5) {
        console.warn("DEBUG: Insufficient overlapping history.");
        return { expectedReturn: 0, volatility: 0, maxDrawdown: 0, sharpeRatio: 0, bestYear: 0, worstYear: 0, beta: 0, runStats: debugInfo };
    }

    // 3. ALIGNED HISTORY
    const assetPriceMaps = validStats.map(stat => {
        const map = new Map<string, number>();
        stat.dates?.forEach((d, i) => map.set(d, stat.history[i]));
        return { symbol: stat.symbol, map };
    });

    const marketPriceMap = new Map<string, number>();
    if (marketStats && marketStats.dates) {
        marketStats.dates.forEach((d, i) => marketPriceMap.set(d, marketStats.history[i]));
    }

    const alignedPortfolioPrices: number[] = [];
    const alignedMarketPrices: number[] = [];

    for (const date of sortedCommonDates) {
        let dailyVal = 0;
        assetPriceMaps.forEach((am, idx) => {
            const item = items.find(imp => imp.symbol === am.symbol) || items[idx];
            const price = am.map.get(date)!;
            dailyVal += (item.shares || 1) * price;
        });
        alignedPortfolioPrices.push(dailyVal);
        if (marketStats) {
            alignedMarketPrices.push(marketPriceMap.get(date)!);
        }
    }

    // 4. METRICS
    const stats = calculateStatsFromHistory(alignedPortfolioPrices, sortedCommonDates);
    const { annualReturn, annualVolatility } = stats;

    const riskStats = calculateRiskMetrics(
        alignedPortfolioPrices,
        sortedCommonDates,
        alignedMarketPrices.length > 0 ? alignedMarketPrices : undefined,
        alignedMarketPrices.length > 0 ? sortedCommonDates : undefined
    );

    debugInfo.calculated = {
        pReturn: annualReturn, pVol: annualVolatility, beta: riskStats.beta
    };

    const sanitize = (n: number) => {
        if (isNaN(n) || !isFinite(n)) return 0;
        return n;
    };

    return {
        expectedReturn: sanitize(Number(annualReturn.toFixed(2))),
        volatility: sanitize(Number(annualVolatility.toFixed(2))),
        maxDrawdown: sanitize(riskStats.maxDrawdown),
        sharpeRatio: sanitize(riskStats.sharpeRatio),
        bestYear: sanitize(riskStats.bestYear),
        worstYear: sanitize(riskStats.worstYear),
        beta: sanitize(riskStats.beta),
        runStats: debugInfo
    };
}
