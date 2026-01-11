
import { calculateLogRankTest, SurvivalPoint } from './src/utils/survival';

// Mock Survival Point Factory
const createPoint = (t: number, prob: number, n: number, d: number): SurvivalPoint => ({ t, probability: prob, n, d });

const runTest = () => {
    console.log("--- TEST 1: Identical Curves ---");
    const curveA_1: SurvivalPoint[] = [
        createPoint(0, 1.0, 100, 0),
        createPoint(1, 0.9, 100, 10),
        createPoint(2, 0.8, 90, 10),
    ];
    const curveB_1: SurvivalPoint[] = [
        createPoint(0, 1.0, 100, 0),
        createPoint(1, 0.9, 100, 10),
        createPoint(2, 0.8, 90, 10),
    ];
    const res1 = calculateLogRankTest(curveA_1, curveB_1);
    console.log("Identical:", res1); // Should be p=1.0, chiSq=0

    console.log("\n--- TEST 2: Slightly Different (N=100) ---");
    // Curve A: 10 failures at t=1
    // Curve B: 20 failures at t=1 (Worse)
    const curveA_2: SurvivalPoint[] = [
        createPoint(0, 1.0, 100, 0),
        createPoint(1, 0.9, 100, 10),
        createPoint(2, 0.9, 90, 0), // No more failures
    ];
    const curveB_2: SurvivalPoint[] = [
        createPoint(0, 1.0, 100, 0),
        createPoint(1, 0.8, 100, 20), // More failures
        createPoint(2, 0.8, 80, 0),
    ];
    const res2 = calculateLogRankTest(curveA_2, curveB_2);
    console.log("Different (10 vs 20 events):", res2);

    console.log("\n--- TEST 3: Very Different (N=100) ---");
    const curveA_3: SurvivalPoint[] = [
        createPoint(0, 1.0, 100, 0),
        createPoint(1, 1.0, 100, 0), // No failures
    ];
    const curveB_3: SurvivalPoint[] = [
        createPoint(0, 1.0, 100, 0),
        createPoint(1, 0.5, 100, 50), // 50 failures
    ];
    const res3 = calculateLogRankTest(curveA_3, curveB_3);
    console.log("Very Different:", res3);

    console.log("\n--- TEST 4: Large N (Sensitivity Check, N=1000) ---");
    // 1% difference: 10/1000 vs 20/1000
    const curveA_4: SurvivalPoint[] = [
        createPoint(0, 1.0, 1000, 0),
        createPoint(1, 0.99, 1000, 10),
    ];
    const curveB_4: SurvivalPoint[] = [
        createPoint(0, 1.0, 1000, 0),
        createPoint(1, 0.98, 1000, 20),
    ];
    const res4 = calculateLogRankTest(curveA_4, curveB_4);
    console.log("Large N (1% diff):", res4);

    console.log("\n--- TEST 5: Visible Difference (50 events vs 150 events, N=1000) ---");
    // Curve A: 95% survival (50 fails)
    // Curve B: 85% survival (150 fails)
    const curveA_5: SurvivalPoint[] = [
        createPoint(0, 1.0, 1000, 0),
        createPoint(1, 0.95, 1000, 50),
    ];
    const curveB_5: SurvivalPoint[] = [
        createPoint(0, 1.0, 1000, 0),
        createPoint(1, 0.85, 1000, 150),
    ];
    const res5 = calculateLogRankTest(curveA_5, curveB_5);
    // Calculated Z approx: (50 - 100) / sqrt(V). 
    // E_A = 1000/2000 * 200 = 100.
    // O_A = 50. Diff = -50.
    // V approx 1000*1000*200*1800 / (2000^2 * 1999) approx 1/4 * 200 * 0.9 = 45.
    // Z = -50 / 6.7 = -7.4. P almost 0.
    console.log("Visible Diff (5% vs 15%):", res5);
};

runTest();
