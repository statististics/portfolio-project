import { useState, useCallback } from 'react';
import { RiskStats } from '../engine/market';

export interface SimulationResult {
    year: number;
    benchmark?: number; // S&P 500 equivalent path
    medianInfo?: number; // Calculated Median for this year
    [key: string]: number | undefined; // sim0, sim1, ... simN
}

export interface SimulationStats {
    median: number;
    worstCase: number; // 5th percentile
    successRate: number; // % of sims ending > target or initial if target not set
    targetGoal?: number;
    riskStats?: RiskStats;
    initialValue: number;
    // New Portfolio Risk Analysis Metrics (Median of Paths)
    portfolioMDD?: number;
    portfolioSharpe?: number;
    portfolioBeta?: number;
    portfolioBestYear?: number;
    portfolioWorstYear?: number;
    isDca?: boolean;
}

interface SimulationParams {
    initialValue: number;
    targetGoal?: number;
    timeHorizon: number; // years
    numSimulations: number;
    expectedReturn: number; // annual %
    volatility: number; // annual %
    beta?: number; // Beta of initial portfolio
    dataPeriod?: string; // "1Y" | "3Y" | "5Y" | "MAX"
    riskStats?: any;
    benchmark?: { expectedReturn: number, volatility: number };
    monthlyCost?: number; // Total monthly purchase cost at t=0
    monthlyStats?: {
        expectedReturn: number;
        volatility: number;
        beta?: number; // Beta of monthly portfolio
    }; // Separate stats for monthly contribution portfolio
}

export interface SimulationRun {
    id: string;
    name: string;
    timestamp: number;
    stats: SimulationStats;
    assets?: any[]; // Snapshot of portfolio assets
}

export const useSimulation = () => {
    const [results, setResults] = useState<SimulationResult[]>([]);
    const [finalDistribution, setFinalDistribution] = useState<{ range: string; count: number }[]>([]);
    const [stats, setStats] = useState<SimulationStats | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // History State (Persisted)
    const [history, setHistory] = useState<SimulationRun[]>(() => {
        try {
            const saved = localStorage.getItem('sim_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    // Save history to localStorage whenever it changes
    const updateHistory = (newHistory: SimulationRun[]) => {
        setHistory(newHistory);
        localStorage.setItem('sim_history', JSON.stringify(newHistory));
    };

    const saveSimulation = (name: string, currentAssets?: any[]) => {
        if (!stats) return;
        const newRun: SimulationRun = {
            id: Date.now().toString(),
            name,
            timestamp: Date.now(),
            stats,
            assets: currentAssets
        };
        updateHistory([...history, newRun]);
    };

    const deleteSimulation = (id: string) => {
        updateHistory(history.filter(h => h.id !== id));
    };

    const clearHistory = () => {
        updateHistory([]);
    };

    const runSimulation = useCallback((params: SimulationParams) => {
        setIsSimulating(true);
        setTimeout(() => { // Allow UI to render loading state
            const { initialValue, targetGoal, timeHorizon, numSimulations, expectedReturn, volatility, riskStats, benchmark, monthlyCost = 0, monthlyStats } = params;
            // We use monthly time steps for better granularity with DCA
            const stepsPerYear = 12;
            const dt = 1.0 / stepsPerYear;

            // --- SAFETY VALVE ---
            // If expectedReturn is > 200 (200%), cap it at 20 (20%).
            // Use 2.0 multiplier check.
            let mu = expectedReturn / 100;
            if (Math.abs(mu) > 2.0) {
                console.error(`Simulation Safety Valve Triggered: mu=${mu} is too high. Capping at 0.2.`);
                mu = 0.2;
            }

            let sigma = volatility / 100;
            if (sigma > 5.0) sigma = 1.0; // Cap vol at 500% -> 100%

            // Monthly Portfolio Params (fallback to Initial if not provided, though typically provided)
            let mMu = monthlyStats ? monthlyStats.expectedReturn / 100 : mu;
            if (Math.abs(mMu) > 2.0) {
                console.error(`Simulation Safety Valve Triggered: mMu=${mMu} is too high. Capping at 0.2.`);
                mMu = 0.2;
            }
            let mSigma = monthlyStats ? monthlyStats.volatility / 100 : sigma;
            if (mSigma > 5.0) mSigma = 1.0; // Cap vol at 500% -> 100%

            const newResults: SimulationResult[] = [];
            const finalValues: number[] = [];

            // Initialize Year 0
            const year0: SimulationResult = { year: 0, benchmark: initialValue ? initialValue : 10000 };
            for (let s = 0; s < numSimulations; s++) {
                year0[`sim${s}`] = initialValue;
            }
            newResults.push(year0);

            // Benchmark Params
            const bMu = benchmark ? benchmark.expectedReturn / 100 : 0.08;
            const bSigma = benchmark ? benchmark.volatility / 100 : 0.15;

            // Tracking State: 
            // We now track TWO components:
            // 1. Initial Pot: Grows with (mu, sigma)
            // 2. Monthly Pot: Grows with (mMu, mSigma) and accumulates contributions
            // The PriceIndex logic for DCA applies to the Monthly Pot mainly?
            // Actually, "Fixed Shares" implies we track the PriceIndex of the Monthly Portfolio.

            interface SimState {
                valInit: number;    // Value of Initial Lump Sum
                valMonth: number;   // Value of Monthly Contributions Pot
                priceIdxInit: number; // Price Index for Initial (starts 1.0)
                priceIdxMonth: number; // Price Index for Monthly (starts 1.0)
                invested: number;
            }

            // Tracking State for Risk Metrics (Vectors of length numSimulations)
            // MDD
            const pathMaxPeak = new Float64Array(numSimulations).fill(1.0);
            const pathMDD = new Float64Array(numSimulations).fill(0);

            // Sharpe (Simple Returns)
            const pathSumLogRet = new Float64Array(numSimulations).fill(0); // Kept for MDD
            const pathSumSimpleRet = new Float64Array(numSimulations).fill(0);
            const pathSumSqSimpleRet = new Float64Array(numSimulations).fill(0);
            const pathCount = stepsPerYear * timeHorizon;

            // Beta
            const betaInit = params.beta || 1.0;
            const betaMonth = monthlyStats?.beta || betaInit;
            const pathSumBeta = new Float64Array(numSimulations).fill(0); // Sum of monthly weighted betas

            // Best/Worst Year (Rolling 12-month returns)
            // We need a rolling buffer of last 12 log returns for EACH simulation.
            // Since storing 1000 * 12 is cheap, we do that.
            const rollingBuffers: number[][] = Array(numSimulations).fill(0).map(() => []);
            const pathBestYear = new Float64Array(numSimulations).fill(-999);
            const pathWorstYear = new Float64Array(numSimulations).fill(999);

            let currentSimState: SimState[] = [];
            let currentBenchState: { val: number; priceIdx: number }[] = [];

            // Init State
            for (let s = 0; s < numSimulations; s++) {
                currentSimState[s] = {
                    valInit: initialValue,
                    valMonth: 0,
                    priceIdxInit: 1.0,
                    priceIdxMonth: 1.0,
                    invested: initialValue
                };
                currentBenchState[s] = { val: initialValue, priceIdx: 1.0 };
            }

            // Store pure benchmark paths for median calculation
            const benchmarkPaths: number[][] = Array(timeHorizon + 1).fill(0).map(() => []);
            // Year 0 Bench
            for (let s = 0; s < numSimulations; s++) {
                benchmarkPaths[0].push(initialValue);
            }

            // Simulate Years
            for (let t = 1; t <= timeHorizon; t++) {
                const yearData: SimulationResult = { year: t };

                // Run 12 monthly steps for each simulation
                for (let s = 0; s < numSimulations; s++) {
                    let { valInit, valMonth, priceIdxInit, priceIdxMonth, invested } = currentSimState[s];
                    let { val: bVal, priceIdx: bPriceIdx } = currentBenchState[s];

                    let prevTotalVal = valInit + valMonth; // S(t-1)
                    if (prevTotalVal === 0) prevTotalVal = 0.0001; // Safety

                    // 12 Months Loop
                    for (let m = 0; m < stepsPerYear; m++) {
                        // --- Unified Market Shock ---
                        const u1 = Math.random();
                        const u2 = Math.random();
                        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

                        // --- 1. Update Initial Pot ---
                        const growthI = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
                        valInit *= growthI;
                        priceIdxInit *= growthI;

                        // --- 2. Update Monthly Pot (Only if Active) ---
                        if (monthlyCost > 0) {
                            const growthM = Math.exp((mMu - 0.5 * mSigma * mSigma) * dt + mSigma * Math.sqrt(dt) * z);
                            valMonth *= growthM;
                            priceIdxMonth *= growthM;
                        }

                        // --- CALC RISK METRICS (BEFORE Contribution) ---
                        // "Pure Asset Value" change for this month
                        const currentPreCont = valInit + valMonth;

                        // Log Return for Sharpe
                        // Log Return for MDD & BestYear
                        const logRet = Math.log(currentPreCont / prevTotalVal);
                        pathSumLogRet[s] += logRet;

                        // Simple Return for Sharpe (Arithmetic)
                        const simRet = (currentPreCont / prevTotalVal) - 1.0;
                        pathSumSimpleRet[s] += simRet;
                        pathSumSqSimpleRet[s] += simRet * simRet;

                        // MDD Logic: 
                        // Performance Index determines Peaks. 
                        // Index_t = Index_{t-1} * exp(logRet). 
                        // Peak is tracked on Index.
                        // We can just track "Cumulative Return Index" for MDD.
                        // Let's assume Index_0 = 1.0. 
                        // We don't store Index, just current Index Value.
                        // Actually we can infer Index from sumLogRet: Index = exp(sumLogRet).
                        const currentIndex = Math.exp(pathSumLogRet[s]);
                        if (currentIndex > pathMaxPeak[s]) {
                            pathMaxPeak[s] = currentIndex;
                        } else {
                            const dd = (currentIndex - pathMaxPeak[s]) / pathMaxPeak[s];
                            if (dd < pathMDD[s]) pathMDD[s] = dd;
                        }

                        // Beta Logic (Time Weighted, End of Month Weight)
                        // Beta_t = W_init * Beta_init + W_month * Beta_month
                        const totalVal = currentPreCont;
                        const wInit = valInit / totalVal;
                        const wMonth = valMonth / totalVal;
                        const currentBeta = wInit * betaInit + wMonth * betaMonth;
                        pathSumBeta[s] += currentBeta;

                        // Best/Worst Year (Rolling 12M)
                        rollingBuffers[s].push(logRet);
                        if (rollingBuffers[s].length > 12) rollingBuffers[s].shift();
                        if (rollingBuffers[s].length === 12) {
                            const rollingReturn = rollingBuffers[s].reduce((a, b) => a + b, 0); // Sum of log returns = Total Log Return
                            const rollingReturnPct = Math.exp(rollingReturn) - 1; // Convert to simple %
                            if (rollingReturnPct > pathBestYear[s]) pathBestYear[s] = rollingReturnPct;
                            if (rollingReturnPct < pathWorstYear[s]) pathWorstYear[s] = rollingReturnPct;
                        }

                        // --- 3. Add Contribution ---
                        const currentCost = monthlyCost * priceIdxMonth;
                        valMonth += currentCost;
                        invested += currentCost;

                        // Update Prev for next step
                        prevTotalVal = valInit + valMonth;

                        // --- Benchmark Step ---
                        const bu1 = Math.random();
                        const bu2 = Math.random();
                        const bz = Math.sqrt(-2.0 * Math.log(bu1)) * Math.cos(2.0 * Math.PI * bu2);
                        const bGrowth = Math.exp((bMu - 0.5 * bSigma * bSigma) * dt + bSigma * Math.sqrt(dt) * bz);
                        bPriceIdx *= bGrowth;
                        bVal *= bGrowth;
                        bVal += currentCost;
                    }

                    // Store End of Year State
                    currentSimState[s] = { valInit, valMonth, priceIdxInit, priceIdxMonth, invested };
                    currentBenchState[s] = { val: bVal, priceIdx: bPriceIdx };

                    const totalVal = valInit + valMonth;
                    yearData[`sim${s}`] = totalVal;

                    if (t === timeHorizon) {
                        finalValues.push(totalVal);
                    }

                    // Store Annual Benchmark Data
                    benchmarkPaths[t].push(bVal);
                }

                // Track total invested (Median or Mean? It behaves like a path too due to PriceIndex variance)
                // We'll approximate Total Invested using the Median Price Index path? 
                // Or just average? Let's compute average total invested for visualization.
                // Actually, just sum of contributions? NO, cost varies.
                // Let's store the median invested amount for the chart.
                const allInvested = currentSimState.map(s => s.invested);
                allInvested.sort((a, b) => a - b);
                const medianInvested = allInvested[Math.floor(allInvested.length / 2)];
                (yearData as any).totalInvested = medianInvested;

                newResults.push(yearData);
            }

            // Simplify Charts: Only take first 50 paths for Line Chart to avoid performance hit
            // BUT keep stats based on ALL finalValues
            const chartData = newResults.map(r => {
                const subset: SimulationResult = { year: r.year, totalInvested: (r as any).totalInvested }; // Preserve totalInvested

                // Add Median Path Logic
                const valuesThisYear: number[] = [];
                for (let ss = 0; ss < numSimulations; ss++) {
                    const val = r[`sim${ss}`];
                    if (val !== undefined) valuesThisYear.push(val);
                }
                valuesThisYear.sort((a, b) => a - b);
                const medianVal = valuesThisYear[Math.floor(valuesThisYear.length * 0.5)];
                subset.medianInfo = medianVal;

                // Add Benchmark Median Logic
                const benchValuesThisYear = [...benchmarkPaths[r.year]]; // Create a copy to sort
                benchValuesThisYear.sort((a, b) => a - b);
                const medianBenchVal = benchValuesThisYear[Math.floor(benchValuesThisYear.length * 0.5)];

                subset.benchmark = medianBenchVal; // Overwrite the deterministic value with MC Median

                for (let i = 0; i < Math.min(50, numSimulations); i++) {
                    subset[`sim${i}`] = r[`sim${i}`];
                }
                return subset;
            });

            // Calculate Stats (Final Year)
            finalValues.sort((a, b) => a - b);
            const median = finalValues[Math.floor(finalValues.length * 0.5)];
            const worstCase = finalValues[Math.floor(finalValues.length * 0.05)]; // 5th percentile

            // --- Calculate Risk Metrics (Median of Paths) ---
            const computeMedian = (arr: Float64Array | number[]) => {
                const sorted = arr instanceof Float64Array ? arr.sort() : arr.sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            };

            const medianMDD = computeMedian(pathMDD);

            // Sharpe Calculation
            const pathSharpe = new Float64Array(numSimulations);
            // Rf = 4%
            const r_f = 0.04;
            for (let s = 0; s < numSimulations; s++) {
                // Using Simple Arithmetic Returns
                const meanRet = pathSumSimpleRet[s] / pathCount;
                const meanSqRet = pathSumSqSimpleRet[s] / pathCount;
                const variance = meanSqRet - (meanRet * meanRet);

                // Annualize
                const annRet = meanRet * 12; // Simple sum approx or geometric compounding? 
                // Sharpe usually uses Arithmetic Mean Annual Return.
                // Monthly Mean * 12 is Arithmetic Annual Mean.

                const stdDev = Math.sqrt(variance > 0 ? variance : 0);
                const annVol = stdDev * Math.sqrt(12);

                if (annVol > 0.0001) {
                    pathSharpe[s] = (annRet - r_f) / annVol;
                } else {
                    pathSharpe[s] = 0;
                }
            }
            const medianSharpe = computeMedian(pathSharpe);

            // Beta Calculation (Average Beta per path)
            const pathAvgBeta = new Float64Array(numSimulations);
            for (let s = 0; s < numSimulations; s++) {
                pathAvgBeta[s] = pathSumBeta[s] / pathCount;
            }
            const medianBeta = computeMedian(pathAvgBeta);

            const medianBestYear = computeMedian(pathBestYear);
            const medianWorstYear = computeMedian(pathWorstYear);

            // Success Rate vs Target Goal (or Initial if not set)
            const target = targetGoal || initialValue;
            const successCount = finalValues.filter(v => v >= target).length;
            const successRate = (successCount / numSimulations) * 100;

            // Calculate Histogram logic
            const min = finalValues[0];
            const max = finalValues[finalValues.length - 1];
            // dynamic buckets, say 20
            const bucketCount = 20;
            const bucketSize = (max - min) / bucketCount;
            const distribution = Array(bucketCount).fill(0).map((_, i) => {
                const start = min + i * bucketSize;
                const end = start + bucketSize;
                const count = finalValues.filter(v => v >= start && v < end).length;
                return {
                    range: `$${(start / 1000).toFixed(0)}k`,
                    count
                };
            });

            setResults(chartData);
            setStats({
                median,
                worstCase,
                successRate,
                targetGoal,
                riskStats,
                initialValue,
                portfolioMDD: medianMDD,
                portfolioSharpe: medianSharpe,
                portfolioBeta: medianBeta,
                portfolioBestYear: medianBestYear,
                portfolioWorstYear: medianWorstYear,
                isDca: monthlyCost > 0
            });
            setFinalDistribution(distribution);
            setIsSimulating(false);
        }, 100);
    }, [history]); // Add history dependency if needed, though runSimulation doesn't use it directly.

    return {
        results, // For Line Chart
        finalDistribution, // For Bar Chart
        stats,
        runSimulation,
        isSimulating,
        history,
        saveSimulation,
        deleteSimulation,
        clearHistory
    };
};
