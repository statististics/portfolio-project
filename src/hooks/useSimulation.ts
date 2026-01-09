import { useState, useCallback } from 'react';
import { RiskStats } from '../engine/market';

export interface SimulationResult {
    year: number;
    [key: string]: number; // sim0, sim1, ... simN
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
    riskStats?: any;
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
            const { initialValue, targetGoal, timeHorizon, numSimulations, expectedReturn, volatility, riskStats } = params;
            const dt = 1; // Time step: 1 year
            const mu = expectedReturn / 100;
            const sigma = volatility / 100;

            const newResults: SimulationResult[] = [];
            const finalValues: number[] = [];

            // Initialize Year 0
            const year0: SimulationResult = { year: 0 };
            for (let s = 0; s < numSimulations; s++) {
                year0[`sim${s}`] = initialValue;
            }
            newResults.push(year0);

            // Simulate Steps
            for (let t = 1; t <= timeHorizon; t++) {
                const yearData: SimulationResult = { year: t };
                for (let s = 0; s < numSimulations; s++) {
                    const prev = newResults[t - 1][`sim${s}`];
                    // Geometric Brownian Motion: S_t = S_{t-1} * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
                    // Simplified for annual steps with normal distribution
                    // Random normal (Box-Muller transform)
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
                }
                newResults.push(yearData);
            }

            // Simplify Charts: Only take first 50 paths for Line Chart to avoid performance hit
            // BUT keep stats based on ALL finalValues
            const chartData = newResults.map(r => {
                const subset: SimulationResult = { year: r.year };
                for (let i = 0; i < Math.min(50, numSimulations); i++) {
                    subset[`sim${i}`] = r[`sim${i}`];
                }
                return subset;
            });

            // Calculate Stats
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
