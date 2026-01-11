
import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { SimulationStats } from '../hooks/useSimulation';
import { calculateKaplanMeier, calculateLogRankTest, LogRankResult } from '../utils/survival';

interface SurvivalViewProps {
    statsA: SimulationStats | null;
    statsB: SimulationStats | null;
}

export const SurvivalView: React.FC<SurvivalViewProps> = ({ statsA, statsB }) => {
    // State for Sensitivity Analysis
    const [lossThreshold, setLossThreshold] = useState<number>(0.20); // Default 20%

    const { chartData, medianTimeA, medianTimeB, finalRateA, finalRateB, logRankStats, yMin } = useMemo(() => {
        // Prepare A
        const curveA = (statsA && statsA.allPaths && statsA.allPaths.length > 0)
            ? calculateKaplanMeier(statsA.allPaths, statsA.initialValue || 10000, lossThreshold)
            : [];

        // Prepare B
        const curveB = (statsB && statsB.allPaths && statsB.allPaths.length > 0)
            ? calculateKaplanMeier(statsB.allPaths, statsB.initialValue || 10000, lossThreshold)
            : [];

        // Medians
        const findMedian = (c: any[]) => {
            const pt = c.find(p => p.probability < 0.5);
            return pt ? pt.t : undefined;
        };
        const medTimeA = findMedian(curveA);
        const medTimeB = findMedian(curveB);

        // Final Rates
        const getFinal = (c: any[]) => c.length > 0 ? c[c.length - 1].probability * 100 : 0;
        const fRateA = getFinal(curveA);
        const fRateB = getFinal(curveB);

        // Formatting for Chart
        // Merge curves by index (Time t is index+1)
        const maxLen = Math.max(curveA.length, curveB.length);
        const data = [];
        for (let i = 0; i < maxLen; i++) {
            const ptA = curveA[i];
            const ptB = curveB[i];
            const t = ptA ? ptA.t : (ptB ? ptB.t : i + 1);

            data.push({
                t,
                year: (t / 12).toFixed(1),
                probA: ptA ? ptA.probability * 100 : null,
                probB: ptB ? ptB.probability * 100 : null,
            });
        }

        // Log Rank Test
        let lrStats: LogRankResult | null = null;
        if (curveA.length > 0 && curveB.length > 0) {
            lrStats = calculateLogRankTest(curveA, curveB);
        }

        // Calculate Y-Axis Domain
        let minProb = 100;
        curveA.forEach(p => { if (p.probability * 100 < minProb) minProb = p.probability * 100; });
        const hasBLocal = curveB.length > 0;
        if (hasBLocal) curveB.forEach(p => { if (p.probability * 100 < minProb) minProb = p.probability * 100; });

        // Round down to nearest 10, minus padding, clamped at 0
        const yMin = Math.max(0, Math.floor(minProb / 10) * 10 - 10);

        return {
            chartData: data,
            medianTimeA: medTimeA,
            medianTimeB: medTimeB,
            finalRateA: fRateA,
            finalRateB: fRateB,
            logRankStats: lrStats,
            yMin
        };
    }, [statsA, statsB, lossThreshold]);

    const formatTime = (simTime: number | undefined) => {
        if (simTime === undefined) return "Never (< 50% Ruin)";
        const y = Math.floor(simTime / 12);
        const m = simTime % 12;
        if (y === 0) return `${m} mo`;
        return `${y}y ${m}m`;
    };

    if (!statsA || !statsA.allPaths) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--text-tertiary)',
                gap: '16px'
            }}>
                <div style={{ fontSize: '48px', opacity: 0.2 }}>📉</div>
                <div style={{ fontWeight: 500 }}>No Simulation Path Data</div>
            </div>
        );
    }

    const hasB = statsB && statsB.allPaths && statsB.allPaths.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
            {/* Controls Section */}
            <div style={{
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '16px',
                border: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                Sensitivity Analysis
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Drawdown Threshold
                            </div>
                        </div>
                        <div style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-primary)'
                        }}>
                            -{(lossThreshold * 100).toFixed(0)}%
                        </div>
                    </div>
                    <input
                        type="range"
                        min="0.05"
                        max="0.5"
                        step="0.01"
                        value={lossThreshold}
                        onChange={(e) => setLossThreshold(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                    />
                </div>

                {/* Log Rank Stat Card */}
                {hasB && logRankStats && (
                    <div style={{
                        padding: '16px',
                        backgroundColor: logRankStats.significant ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)',
                        borderRadius: '12px',
                        border: logRankStats.significant ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)',
                        minWidth: '200px'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                            Statistical Difference
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: logRankStats.significant ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                            p = {logRankStats.pValue.toFixed(4)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {logRankStats.significant ? 'Significant Difference' : 'Statistically Similar'}
                        </div>
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Definition Card */}
                <div style={{ flex: 1, minWidth: '200px', padding: '20px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Definition of Ruin
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Drawdown &gt; <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(lossThreshold * 100).toFixed(0)}%</span> from Peak
                    </div>
                </div>

                {/* Median Time */}
                <div style={{ flex: 1, minWidth: '200px', padding: '20px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Median Survival Time
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {hasB && <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)' }}>A</span>}
                            <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatTime(medianTimeA)}</span>
                        </div>
                        {hasB && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-orange)' }}>B</span>
                                <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatTime(medianTimeB)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Final Rate */}
                <div style={{ flex: 1, minWidth: '200px', padding: '20px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Prob. of Preservation
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {hasB && <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-blue)' }}>A</span>}
                            <span style={{ fontSize: '16px', fontWeight: '700', color: finalRateA > 80 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{finalRateA.toFixed(1)}%</span>
                        </div>
                        {hasB && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-orange)' }}>B</span>
                                <span style={{ fontSize: '16px', fontWeight: '700', color: finalRateB > 80 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{finalRateB.toFixed(1)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div style={{ flex: 1, minHeight: '350px', position: 'relative', backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Kaplan-Meier Survival Estimate
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-orange)" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="var(--accent-orange)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis
                            dataKey="t"
                            tickFormatter={(value) => `${(value / 12).toFixed(0)}y`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                            dy={10}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={[yMin, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                            dx={-10}
                            unit="%"
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            labelStyle={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}
                            labelFormatter={(label) => `Month ${label} (${(label / 12).toFixed(1)} years)`}
                        />
                        <ReferenceLine y={50} stroke="var(--text-tertiary)" strokeDasharray="3 3" strokeOpacity={0.5} />

                        <Area
                            type="stepAfter"
                            dataKey="probA"
                            name="Portfolio A"
                            stroke="var(--accent-blue)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#gradA)"
                            animationDuration={500}
                        />
                        {hasB && (
                            <Area
                                type="stepAfter"
                                dataKey="probB"
                                name="Portfolio B"
                                stroke="var(--accent-orange)"
                                strokeWidth={3}
                                fillOpacity={0.6} // Slightly transparent to see overlap
                                fill="url(#gradB)"
                                animationDuration={500}
                            />
                        )}
                        <Legend />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
