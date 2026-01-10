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
}

interface SimulationParams {
    initialValue: number;
    targetGoal?: number;
    timeHorizon: number; // years
    numSimulations: number;
    expectedReturn: number; // annual %
    volatility: number; // annual %
    dataPeriod?: string; // "1Y" | "3Y" | "5Y" | "MAX"
    riskStats?: any;
    benchmark?: { expectedReturn: number, volatility: number };
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
            const { initialValue, targetGoal, timeHorizon, numSimulations, expectedReturn, volatility, riskStats, benchmark } = params;
            const dt = 1; // Time step: 1 year

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

            // Temporary storage for benchmark paths to calculate median later
            // We need to store ALL benchmark paths to find the median path/value at each year
            // Structure: year -> [sim0_val, sim1_val, ... simN_val]
            const benchmarkPaths: number[][] = Array(timeHorizon + 1).fill(0).map(() => []);

            // Initialize Benchmark Year 0
            for (let s = 0; s < numSimulations; s++) {
                benchmarkPaths[0].push(initialValue ? initialValue : 10000);
            }

            // Simulate Steps
            for (let t = 1; t <= timeHorizon; t++) {
                const yearData: SimulationResult = { year: t };

                // We will simulate Benchmark paths independently here or strictly per-sim?
                // Independent is fine, we just want the aggregate distribution.

                for (let s = 0; s < numSimulations; s++) {
                    // --- Portfolio Simulation ---
                    const prev = newResults[t - 1][`sim${s}`] || initialValue;

                    // Random normal for Portfolio
                    const u1 = Math.random();
                    const u2 = Math.random();
                    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

                    const drift = (mu - 0.5 * sigma * sigma) * dt;
                    const diffusion = sigma * Math.sqrt(dt) * z;
                    const change = Math.exp(drift + diffusion);
                    const nextVal = prev * change;
                    yearData[`sim${s}`] = nextVal;

                    if (t === timeHorizon) {
                        finalValues.push(nextVal);
                    }

                    // --- Benchmark Simulation (Parallel) ---
                    const prevBench = benchmarkPaths[t - 1][s];

                    // Independent Random normal for Benchmark (Uncorrelated for simplicity in 1:1 median comparison)
                    // (Ideally correlate them with Beta, but for "Median vs Median", independent is sufficient and cleaner)
                    const ub1 = Math.random();
                    const ub2 = Math.random();
                    const zb = Math.sqrt(-2.0 * Math.log(ub1)) * Math.cos(2.0 * Math.PI * ub2);

                    const bDrift = (bMu - 0.5 * bSigma * bSigma) * dt;
                    const bDiffusion = bSigma * Math.sqrt(dt) * zb;
                    const bChange = Math.exp(bDrift + bDiffusion);
                    const nextBench = prevBench * bChange;

                    benchmarkPaths[t].push(nextBench);
                }
                newResults.push(yearData);
            }

            // Simplify Charts: Only take first 50 paths for Line Chart to avoid performance hit
            // BUT keep stats based on ALL finalValues
            const chartData = newResults.map(r => {
                const subset: SimulationResult = { year: r.year }; // Initialize subset
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
            setStats({ median, worstCase, successRate, targetGoal, riskStats, initialValue });
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
