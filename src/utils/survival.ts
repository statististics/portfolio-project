
/**
 * Interface representing a single point on the survival curve
 */
export interface SurvivalPoint {
    t: number;          // Time index (e.g., month)
    probability: number; // Survival probability S(t) (0 to 1)
    n: number;          // Number at risk
    d: number;          // Number of events (failures)
}

/**
 * Calculates the Kaplan-Meier survival estimate.
 * 
 * @param simulationPaths 2D array where paths[simIdx] is an array of portfolio values over time.
 * @param initialValue The starting value of the portfolio (used to calculate threshold).
 * @param thresholdPct The percentage loss to treat as an event (e.g., 0.20 for 20%).
 * @returns Array of SurvivalPoint objects.
 */
export const calculateKaplanMeier = (
    simulationPaths: number[][],
    initialValue: number,
    thresholdPct: number
): SurvivalPoint[] => {
    const numSims = simulationPaths.length;
    if (numSims === 0) return [];

    const timeSteps = simulationPaths[0].length;
    // const failureThreshold = initialValue * (1 - thresholdPct); // OLD LOGIC

    // 1. Identify Event Times for each path
    // failureTime[s] = time index of first failure, or -1 if censored (survived)
    const failureTimes = new Int32Array(numSims).fill(-1);

    for (let s = 0; s < numSims; s++) {
        const path = simulationPaths[s];
        let runningMax = initialValue; // Start with initial value as max

        for (let t = 0; t < path.length; t++) {
            const currentVal = path[t];

            // Allow runningMax to grow if current value is higher
            if (currentVal > runningMax) {
                runningMax = currentVal;
            }

            // Drawdown check: Have we dropped X% from the peak?
            // Threshold is e.g. 0.20 (20%).
            // Failure if Current < Peak * (1 - 0.20)
            const drawdownThreshold = runningMax * (1 - thresholdPct);

            if (currentVal <= drawdownThreshold) {
                failureTimes[s] = t;
                break; // First event rule
            }
        }
    }

    // 2. Group events by time
    // events[t] = count of failures at time t
    const eventsAtTime = new Int32Array(timeSteps).fill(0);

    let totalFailures = 0;
    for (let s = 0; s < numSims; s++) {
        if (failureTimes[s] !== -1) {
            eventsAtTime[failureTimes[s]]++;
            totalFailures++;
        }
    }

    // 3. Compute S(t)
    const curve: SurvivalPoint[] = [];

    // Initial State: t=0, S(0)=1.0
    curve.push({ t: 0, probability: 1.0, n: numSims, d: 0 });

    let s_prev = 1.0;
    let n_current = numSims; // Everyone is at risk initially

    for (let t = 0; t < timeSteps; t++) {
        const d_t = eventsAtTime[t];

        if (n_current === 0) {
            curve.push({ t: t + 1, probability: 0, n: 0, d: 0 });
            continue;
        }

        const s_t = s_prev * (1 - d_t / n_current);

        curve.push({ t: t + 1, probability: s_t, n: n_current, d: d_t });

        // Update state for next step
        s_prev = s_t;
        n_current -= d_t; // Remove those who failed
    }

    return curve;
};

/**
 * Interface representing the result of a Log-rank test
 */
export interface LogRankResult {
    chiSquare: number;
    pValue: number;
    significant: boolean; // p < 0.05
}

/**
 * Performs the Log-rank test to compare two survival curves.
 * 
 * @param curveA Step-by-step survival data for Group A
 * @param curveB Step-by-step survival data for Group B
 * @returns LogRankResult with chi-square statistic and p-value
 */
export const calculateLogRankTest = (
    curveA: SurvivalPoint[],
    curveB: SurvivalPoint[]
): LogRankResult => {
    // We assume time steps are aligned or we iterate through union of times.
    // Since simulation runs on fixed monthly steps, we can iterate from t=0 to maxT.

    let sumObservedA = 0;
    let sumExpectedA = 0;
    let sumVariance = 0;

    const maxLen = Math.max(curveA.length, curveB.length);

    for (let i = 0; i < maxLen; i++) {
        const ptA = curveA[i]; // May be undefined if shorter
        const ptB = curveB[i]; // May be undefined

        // n = at risk, d = failures
        const n1 = ptA ? ptA.n : 0;
        const d1 = ptA ? ptA.d : 0;

        const n2 = ptB ? ptB.n : 0;
        const d2 = ptB ? ptB.d : 0;

        // Only consider times where there is at least one accumulated event across both groups
        const dTotal = d1 + d2;
        const nTotal = n1 + n2;

        if (dTotal === 0 || nTotal === 0) continue;

        // Expected events for A
        const e1 = (n1 / nTotal) * dTotal;

        // Variance contribution
        let v = 0;
        if (nTotal > 1) {
            v = (e1 * (n2 / nTotal) * (nTotal - dTotal)) / (nTotal - 1);
        }

        sumObservedA += d1;
        sumExpectedA += e1;
        sumVariance += v;
    }

    // Z statistic
    let z = 0;
    if (sumVariance > 0) {
        z = (sumObservedA - sumExpectedA) / Math.sqrt(sumVariance);
    }

    const chiSquare = z * z;
    const pValue = chiSquareToPValue(chiSquare);

    return {
        chiSquare,
        pValue,
        significant: pValue < 0.05
    };
};

function chiSquareToPValue(x: number): number {
    if (x <= 0 || !isFinite(x)) return 1;
    const z = Math.sqrt(x);
    return 2 * (1 - standardNormalCDF(z));
}

function standardNormalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) prob = 1 - prob;
    return prob;
}
