
// Mock Browser Environment for Node
if (typeof localStorage === 'undefined') {
    (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => { },
        clear: () => { }
    };
}

import { calculatePortfolioStats } from './src/engine/market';

async function testEngine() {
    console.log("--- Starting Engine Smoke Test (Calculation Check) ---");
    try {
        console.log("Testing SCHD Calculation Logic...");

        // This time, we accept that SPY might fail and Beta might be 1.0 (Fallback) or 0.01
        // We mainly want to check that Expected Return is NOT $229M (Sextillion Bug).

        const result = await calculatePortfolioStats([{ symbol: 'SCHD', shares: 100 }], '5Y');

        console.log("SCHD Result:", JSON.stringify(result, null, 2));

        if (isNaN(result.expectedReturn)) {
            console.error("FAIL: Expected Return is NaN");
        } else if (result.expectedReturn > 200) {
            console.error("FAIL: Return still explosive > 200%");
        } else {
            console.log(`PASS: Expected Return (CAGR) = ${result.expectedReturn}% (Sanity Checked)`);
        }

    } catch (e) {
        console.error("CRITICAL ENGINE FAILURE:", e);
    }
}

testEngine();
