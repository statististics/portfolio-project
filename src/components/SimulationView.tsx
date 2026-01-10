import React from 'react';
import { Trash2 } from 'lucide-react';
import { SimulationResult, SimulationStats } from '../hooks/useSimulation';
import { ComposedChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Legend } from 'recharts';

// Update Props to include history actions
interface SimulationViewProps {
    results: SimulationResult[];
    distribution: { range: string; count: number }[];
    stats: SimulationStats | null;
    history?: any[]; // Avoiding circular import of SimulationRun for now, or just use any
    onSave?: (name: string) => void;
    onDelete?: (id: string) => void;
}

const StatCard = ({ label, value, subtext, color = 'var(--text-primary)' }: { label: string, value: string, subtext?: string, color?: string }) => (
    <div style={{
        flex: 1,
        padding: '24px',
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
        backdropFilter: 'blur(10px)'
    }}>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {label}
        </div>
        <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px', color: color }}>
            {value}
        </div>
        {subtext && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{subtext}</div>}
    </div>
);

const ComparisonTable = ({ history, onDelete }: { history: any[], onDelete: (id: string) => void }) => {
    if (!history || history.length === 0) return null;

    return (
        <div style={{
            marginTop: '48px',
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Simulation History
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '500' }}>
                    {history.length} run{history.length !== 1 ? 's' : ''} stored
                </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio Name</th>
                            <th style={{ textAlign: 'center', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success Rate</th>
                            <th style={{ textAlign: 'right', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Median Result</th>
                            <th style={{ textAlign: 'right', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Year</th>
                            <th style={{ textAlign: 'right', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Drawdown</th>
                            <th style={{ textAlign: 'right', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sharpe</th>
                            <th style={{ textAlign: 'right', padding: '0 16px 8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((run: any) => {
                            const isHighSuccess = run.stats.successRate >= 80;
                            const isMedSuccess = run.stats.successRate >= 50 && run.stats.successRate < 80;

                            return (
                                <tr key={run.id} style={{
                                    backgroundColor: 'rgba(255,255,255,0.5)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    cursor: 'default'
                                }}>
                                    <td style={{ padding: '16px', borderRadius: '12px 0 0 12px', fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>
                                        {run.name}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            backgroundColor: isHighSuccess ? 'rgba(52, 211, 153, 0.15)' : isMedSuccess ? 'rgba(251, 191, 36, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                                            color: isHighSuccess ? '#059669' : isMedSuccess ? '#d97706' : '#dc2626'
                                        }}>
                                            {run.stats.successRate.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>
                                        ${run.stats.median.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: (run.stats.riskStats?.bestYear ?? 0) >= 0 ? 'var(--accent-green)' : '#e53e3e', fontWeight: '600' }}>
                                        {(run.stats.riskStats?.bestYear ?? 0) > 0 ? '+' : ''}{run.stats.riskStats?.bestYear?.toFixed(1) ?? 0}%
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: '#e53e3e', fontWeight: '500' }}>
                                        {run.stats.riskStats?.maxDrawdown.toFixed(2)}%
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                                        {run.stats.riskStats?.sharpeRatio.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right', borderRadius: '0 12px 12px 0' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(run.id);
                                            }}
                                            title="Delete Result"
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                cursor: 'pointer',
                                                color: 'var(--text-tertiary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                opacity: 0.6
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                                e.currentTarget.style.opacity = '1';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = 'var(--text-tertiary)';
                                                e.currentTarget.style.opacity = '0.6';
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CustomScenarioTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    // Filter, Sort Descending
    const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
    if (sorted.length === 0) return null;

    const max = sorted[0];
    const p75 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p25 = sorted[Math.floor(sorted.length * 0.75)];
    const min = sorted[sorted.length - 1];

    // Unique set of items to display (in case low N)
    const displayItems = [
        { label: "Max (Best Case)", val: max.value, color: 'var(--accent-green)' },
        { label: "75th Percentile", val: p75.value, color: 'var(--text-secondary)' },
        { label: "Median", val: median.value, color: 'var(--text-primary)', bold: true },
        { label: "25th Percentile", val: p25.value, color: 'var(--text-secondary)' },
        { label: "Min (Worst Case)", val: min.value, color: 'var(--accent-red)' }
    ];

    // Deduplicate based on value if N is small
    // Actually for monte carlo they are likely distinct or distinct enough. 
    // If N < 5, just show all? The chart has 50 lines.

    return (
        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', minWidth: '140px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                Year {label} Distribution
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {displayItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: item.color, fontWeight: item.bold ? '700' : '500' }}>
                        <span>{item.label}:</span>
                        <span style={{ marginLeft: '12px' }}>${item.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const SimulationView: React.FC<SimulationViewProps> = ({ results, distribution, stats, history = [], onSave, onDelete }) => {

    if (!results || results.length === 0) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '40px', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: '16px', fontWeight: '500' }}>No simulation data yet.</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>Adjust parameters in the sidebar and click "Run Simulation".</div>

                {/* Show history even if empty current result, maybe? No, usually empty start. */}
                {history.length > 0 && <ComparisonTable history={history} onDelete={onDelete!} />}
            </div>
        );
    }

    // Get keys for line chart (sim0, sim1...)
    const keys = Object.keys(results[0]).filter(k => k.startsWith('sim'));

    return (
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

            {/* Header / Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button
                    onClick={() => {
                        const name = prompt("Enter a name for this simulation run (e.g., 'Aggressive Growth')");
                        if (name && onSave) onSave(name);
                    }}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    + Save Result to Compare
                </button>
            </div>

            {/* Stats Row */}
            {stats && (
                <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
                    <StatCard
                        label="Success Probability"
                        value={`${stats.successRate.toFixed(1)}%`}
                        subtext={stats.targetGoal ? `Chance of reaching > $${stats.targetGoal.toLocaleString()}` : "Chance of Profit"}
                        color={stats.successRate > 80 ? 'var(--accent-green)' : stats.successRate > 50 ? 'var(--accent-orange)' : 'var(--accent-red)'}
                    />
                    <StatCard
                        label="Median Outcome"
                        value={`$${stats.median.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        subtext="Expected Portfolio Value"
                    />
                    <StatCard
                        label="Worst Case (5%)"
                        value={`$${stats.worstCase.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        subtext="95% confident it handles better"
                        color={stats.worstCase >= stats.initialValue ? 'var(--accent-green)' : 'var(--accent-red)'}
                    />
                </div>
            )}

            {/* Risk Analysis Section (Switchable) */}
            {stats && (
                stats.isDca ? (
                    // 1. DCA Active: Show Projected Risk Metrics (Simulated)
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Projected Portfolio Risk (DCA Adjusted)
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: '600' }}>
                                *Reflects Cost Averaging Effect
                            </div>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '12px'
                        }}>
                            {/* MDD */}
                            <div style={{ padding: '16px', backgroundColor: '#fff5f5', borderRadius: '12px', border: '1px solid #fed7d7' }}>
                                <div style={{ fontSize: '12px', color: '#e53e3e', fontWeight: '600', marginBottom: '4px' }}>Max Drawdown</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#c53030' }}>
                                    {(stats.portfolioMDD! * 100).toFixed(2)}%
                                </div>
                                <div style={{ fontSize: '10px', color: '#e53e3e', opacity: 0.8 }}>Projected Peak-to-Trough</div>
                            </div>

                            {/* Sharpe */}
                            <div style={{ padding: '16px', backgroundColor: '#f0fff4', borderRadius: '12px', border: '1px solid #c6f6d5' }}>
                                <div style={{ fontSize: '12px', color: '#2f855a', fontWeight: '600', marginBottom: '4px' }}>Sharpe Ratio</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#22543d' }}>
                                    {stats.portfolioSharpe!.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '10px', color: '#2f855a', opacity: 0.8 }}>DCA Adjusted</div>
                            </div>

                            {/* Beta */}
                            <div style={{ padding: '16px', backgroundColor: '#ebf8ff', borderRadius: '12px', border: '1px solid #bee3f8' }}>
                                <div style={{ fontSize: '12px', color: '#3182ce', fontWeight: '600', marginBottom: '4px' }}>Beta (vs SPY)</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#2b6cb0' }}>
                                    {stats.portfolioBeta!.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '10px', color: '#3182ce', opacity: 0.8 }}>Weighted Avg</div>
                            </div>

                            {/* Best Year */}
                            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>Best Year</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-green)' }}>
                                    +{(stats.portfolioBestYear! * 100).toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Rolling 12M</div>
                            </div>

                            {/* Worst Year */}
                            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>Worst Year</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: stats.portfolioWorstYear! >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    {(stats.portfolioWorstYear! * 100).toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Rolling 12M</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // 2. Lump Sum Only: Show Historical Risk Metrics (Original Logic)
                    stats.riskStats && (
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Historical Portfolio Risk (Assets)
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '500' }}>
                                    *Based on actual historical performance of these assets
                                </div>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: '12px'
                            }}>
                                {/* MDD */}
                                <div style={{ padding: '16px', backgroundColor: '#fff5f5', borderRadius: '12px', border: '1px solid #fed7d7' }}>
                                    <div style={{ fontSize: '12px', color: '#e53e3e', fontWeight: '600', marginBottom: '4px' }}>Max Drawdown</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#c53030' }}>
                                        {stats.riskStats.maxDrawdown.toFixed(2)}%
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#e53e3e', opacity: 0.8 }}>Historical Peak-to-Trough</div>
                                </div>

                                {/* Sharpe */}
                                <div style={{ padding: '16px', backgroundColor: '#f0fff4', borderRadius: '12px', border: '1px solid #c6f6d5' }}>
                                    <div style={{ fontSize: '12px', color: '#2f855a', fontWeight: '600', marginBottom: '4px' }}>Sharpe Ratio</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#22543d' }}>
                                        {stats.riskStats.sharpeRatio?.toFixed(2) ?? 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#2f855a', opacity: 0.8 }}>Risk-adj. Return</div>
                                </div>

                                {/* Beta */}
                                <div style={{ padding: '16px', backgroundColor: '#ebf8ff', borderRadius: '12px', border: '1px solid #bee3f8' }}>
                                    <div style={{ fontSize: '12px', color: '#3182ce', fontWeight: '600', marginBottom: '4px' }}>Beta (vs SPY)</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#2b6cb0' }}>
                                        {stats.riskStats.beta?.toFixed(2) ?? '1.00'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#3182ce', opacity: 0.8 }}>Market correlation</div>
                                </div>

                                {/* Best Year */}
                                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>Best Year</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-green)' }}>
                                        {stats.riskStats.bestYear > 0 ? '+' : ''}{stats.riskStats.bestYear.toFixed(1)}%
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Hist. Best 12M</div>
                                </div>

                                {/* Worst Year */}
                                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>Worst Year</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: stats.riskStats.worstYear >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                        {stats.riskStats.worstYear > 0 ? '+' : ''}{stats.riskStats.worstYear.toFixed(1)}%
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Hist. Worst 12M</div>
                                </div>
                            </div>
                        </div>
                    )
                )
            )}

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', height: '400px' }}>

                {/* Line Chart */}
                <div style={{
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Growth Scenarios</h3>
                        {stats?.targetGoal && (
                            <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: '600' }}>
                                --- Target: ${stats.targetGoal.toLocaleString()}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={results}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="year"
                                    stroke="var(--text-tertiary)"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="var(--text-tertiary)"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                    width={40}
                                />
                                <Tooltip content={<CustomScenarioTooltip />} />
                                {keys.map((key) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke="#3b82f6"
                                        strokeWidth={1}
                                        dot={false}
                                        strokeOpacity={0.15}
                                        activeDot={{ r: 4 }}
                                    />
                                ))}
                                {stats?.targetGoal && (
                                    <ReferenceLine
                                        y={stats.targetGoal}
                                        stroke="var(--accent-green)"
                                        strokeDasharray="4 4"
                                        strokeWidth={2}
                                        label={{
                                            value: 'GOAL',
                                            position: 'right',
                                            fill: 'var(--accent-green)',
                                            fontSize: 10,
                                            fontWeight: 700
                                        }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Histogram */}
                <div style={{
                    backgroundColor: 'rgba(255,255,255,0.4)',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>Final Value Distribution</h3>
                    <div style={{ flex: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distribution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="range"
                                    type="category"
                                    width={80}
                                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                                    interval={0}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                                <Bar dataKey="count" fill="var(--text-primary)" radius={[0, 4, 4, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Market Comparison Chart (New) */}
            <div style={{
                marginTop: '24px',
                backgroundColor: 'rgba(255,255,255,0.4)',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                height: '350px'
            }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>Performance vs Market</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Comparing your portfolio's expected median outcome against the S&P 500 benchmark.
                </p>
                <div style={{ flex: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={results}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                            <XAxis
                                dataKey="year"
                                stroke="var(--text-tertiary)"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="var(--text-tertiary)"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `$${val / 1000}k`}
                                width={40}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(val: number, name: string) => {
                                    const label = name === 'totalInvested' ? 'Total Invested' : name;
                                    return [`$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, label];
                                }}
                                labelFormatter={(label) => `Year ${label}`}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: '600' }} iconType="circle" />

                            <Area
                                type="monotone"
                                dataKey="totalInvested"
                                fill="var(--text-tertiary)"
                                stroke="none"
                                fillOpacity={0.1}
                                name="totalInvested"
                            />

                            <Line
                                type="monotone"
                                dataKey="medianInfo"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={false}
                                name="My Portfolio (Median)"
                            />
                            <Line
                                type="monotone"
                                dataKey="benchmark"
                                stroke="#9ca3af"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                name="S&P 500 (Median)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Comparison Table */}
            {history.length > 0 && <ComparisonTable history={history} onDelete={onDelete!} />}

        </div>
    );
};
