import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { SimulationConfigModal } from './SimulationConfigModal';

interface SimulationSidebarProps {
    totalPortfolioValue: number;
    onRun: (params: {
        initialValue: number;
        timeHorizon: number;
        numSimulations: number;
        expectedReturn: number;
        volatility: number;
        beta?: number;
        riskStats?: any;
        dataPeriod?: string;
        benchmark?: { expectedReturn: number, volatility: number };
        monthlyCost?: number;
        monthlyStats?: { expectedReturn: number; volatility: number; beta?: number };
    }, target?: 'A' | 'B') => void;
    isSimulating: boolean;
    mode: 'simulation' | 'survival';
    isComparisonMode?: boolean;
    onToggleComparison?: (isEnabled: boolean) => void;
}

export const SimulationSidebar: React.FC<SimulationSidebarProps> = ({
    totalPortfolioValue,
    onRun,
    isSimulating,
    mode,
    isComparisonMode = false,
    onToggleComparison
}) => {
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeConfig, setActiveConfig] = useState<'A' | 'B'>('A');

    // Comparison Mode State (Moved to Parent)

    // Calculated Stats State (Read Only)
    // Split into Simulation and Survival
    const [simStatsA, setSimStatsA] = useState<any>(null);
    const [simStatsB, setSimStatsB] = useState<any>(null);
    const [survStatsA, setSurvStatsA] = useState<any>(null);
    const [survStatsB, setSurvStatsB] = useState<any>(null);

    // Configuration State for Persistence
    const [simConfigA, setSimConfigA] = useState<any>(null);
    const [simConfigB, setSimConfigB] = useState<any>(null);
    const [survConfigA, setSurvConfigA] = useState<any>(null);
    const [survConfigB, setSurvConfigB] = useState<any>(null);

    // Dynamic getters based on mode
    const statsA = mode === 'survival' ? survStatsA : simStatsA;
    const statsB = mode === 'survival' ? survStatsB : simStatsB;
    const configA = mode === 'survival' ? survConfigA : simConfigA;
    const configB = mode === 'survival' ? survConfigB : simConfigB;

    const setStatsA = (val: any) => mode === 'survival' ? setSurvStatsA(val) : setSimStatsA(val);
    const setStatsB = (val: any) => mode === 'survival' ? setSurvStatsB(val) : setSimStatsB(val);
    const setConfigA = (val: any) => mode === 'survival' ? setSurvConfigA(val) : setSimConfigA(val);
    const setConfigB = (val: any) => mode === 'survival' ? setSurvConfigB(val) : setSimConfigB(val);
    const [timeHorizon, setTimeHorizon] = useState(10);
    const [numSimulations] = useState(1000); // Fixed or could be configurable
    const handleRunFromModal = (data: {
        expectedReturn: number;
        volatility: number;
        beta?: number;
        initialValue: number;
        monthlyCost: number;
        runStats?: any;
        dataPeriod?: string;
        benchmark?: { expectedReturn: number, volatility: number };
        monthlyStats?: { expectedReturn: number, volatility: number; beta?: number };
    }, updatedConfig: any) => {
        console.log(`DEBUG: Sidebar received runStats for ${activeConfig}:`, data.runStats);

        const newStats = {
            expectedReturn: data.expectedReturn,
            volatility: data.volatility,
            monthlyStats: data.monthlyStats,
            dataPeriod: data.dataPeriod,
            dataPoints: data.runStats?.commonDataPoints
        };

        if (activeConfig === 'A') {
            setStatsA(newStats);
            setConfigA(updatedConfig);
        } else {
            setStatsB(newStats);
            setConfigB(updatedConfig);
        }

        // Trigger the simulation immediately
        onRun({
            initialValue: data.initialValue,
            timeHorizon,
            numSimulations,
            expectedReturn: data.expectedReturn,
            volatility: data.volatility,
            beta: data.beta,
            riskStats: data.runStats,
            dataPeriod: data.dataPeriod,
            benchmark: data.benchmark,
            monthlyCost: data.monthlyCost,
            monthlyStats: data.monthlyStats
        }, activeConfig);
    };

    const openConfig = (config: 'A' | 'B') => {
        setActiveConfig(config);
        setIsModalOpen(true);
    };

    const renderPortfolioCard = (id: 'A' | 'B', stats: any) => {
        const isSurvival = mode === 'survival';

        let color = 'var(--text-primary)';
        let label = 'Portfolio Configuration';
        let subLabel = 'Settings';
        let borderStyle = '1px solid rgba(0,0,0,0.05)';

        if (isSurvival) {
            color = id === 'A' ? 'var(--accent-blue)' : 'var(--accent-orange)';
            // FIX: Only show (A) or A/B distinction if comparison is active
            label = isComparisonMode
                ? (id === 'A' ? 'Primary Portfolio (A)' : 'Comparison Portfolio (B)')
                : 'Primary Portfolio';
            subLabel = id === 'A' ? 'Blue Team' : 'Red Team'; // Keep sublabel or hide? keeping for now as requested just name.
            if (!isComparisonMode) subLabel = 'Survival Settings';
            borderStyle = id === 'A' ? '1px solid rgba(0,0,0,0.05)' : '1px dashed rgba(0,0,0,0.1)';
        }

        const hasMonthly = stats?.monthlyStats && (stats.monthlyStats.expectedReturn !== 0 || stats.monthlyStats.volatility !== 0);

        // If in standard simulation mode, simplify the card look
        if (!isSurvival) {
            const configLabel = isComparisonMode
                ? (id === 'A' ? 'Configuration A' : 'Configuration B')
                : 'Portfolio Configuration';

            return (
                <div style={{
                    padding: '20px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                }}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {configLabel}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Configure your asset allocation
                        </div>
                    </div>

                    <button
                        onClick={() => openConfig(id)}
                        disabled={isSimulating}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'var(--text-primary)',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: isSimulating ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            marginBottom: '12px',
                            opacity: isSimulating ? 0.7 : 1,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Settings2 size={14} /> {hasMonthly ? 'Edit Configuration' : (isComparisonMode ? `Configure ${id}` : 'Configure Portfolio')}
                    </button>

                    {stats ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Initial Portfolio Stats */}
                            <div>
                                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Initial Portfolio
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Exp. Return</span>
                                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.expectedReturn.toFixed(2)}%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Volatility</span>
                                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.volatility.toFixed(2)}%</span>
                                </div>
                            </div>

                            {/* Monthly Portfolio Stats (DCA) */}
                            {hasMonthly && (
                                <div style={{ paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Monthly Investment
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Exp. Return</span>
                                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.monthlyStats.expectedReturn.toFixed(2)}%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Volatility</span>
                                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.monthlyStats.volatility.toFixed(2)}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', fontStyle: 'italic' }}>
                            No config set
                        </div>
                    )}
                </div>
            );
        }

        // Survival Mode Card (Team Colors)
        return (
            <div style={{
                padding: '20px',
                backgroundColor: 'white',
                borderRadius: '16px',
                border: borderStyle,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: color }} />

                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: color, textTransform: 'uppercase', marginBottom: '4px' }}>
                        {subLabel}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {label}
                    </div>
                </div>

                <button
                    onClick={() => openConfig(id)}
                    disabled={isSimulating}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'white', // Outline style
                        border: `1px solid ${color}`,
                        color: color,
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: isSimulating ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        marginBottom: '12px',
                        opacity: isSimulating ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = color;
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.color = color;
                    }}
                >
                    <Settings2 size={14} /> {isComparisonMode ? `Configure ${id}` : 'Configure Portfolio'}
                </button>

                {stats ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Initial Stats */}
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Initial
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Exp. Return</span>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.expectedReturn.toFixed(2)}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Volatility</span>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.volatility.toFixed(2)}%</span>
                            </div>
                        </div>

                        {/* Monthly Stats */}
                        {hasMonthly && (
                            <div style={{ paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Monthly DCA
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Exp. Return</span>
                                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.monthlyStats.expectedReturn.toFixed(2)}%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Volatility</span>
                                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{stats.monthlyStats.volatility.toFixed(2)}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', fontStyle: 'italic' }}>
                        No config
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            width: '320px',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRight: '1px solid rgba(255,255,255,0.6)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
        }}>
            <div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>
                    {mode === 'simulation' ? 'Monte Carlo' : 'Survival Analysis'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                        {mode === 'simulation' ? 'Forecast portfolio growth.' : 'Compare survival strategies.'}
                    </p>

                    {/* Toggle - Show in both Simulation and Survival Modes */}
                    {(mode === 'survival' || mode === 'simulation') && (
                        <button
                            onClick={() => onToggleComparison?.(!isComparisonMode)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                borderRadius: '100px',
                                backgroundColor: isComparisonMode ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '10px', fontWeight: '700', color: isComparisonMode ? 'white' : 'var(--text-tertiary)' }}>
                                COMPARE
                            </span>
                            <div style={{
                                width: '12px', height: '12px', borderRadius: '50%',
                                backgroundColor: isComparisonMode ? 'var(--accent-green)' : 'var(--text-tertiary)'
                            }} />
                        </button>
                    )}
                </div>
            </div>

            {/* Portfolios */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {renderPortfolioCard('A', statsA)}

                {isComparisonMode && (
                    <>
                        <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: '800', color: 'var(--text-tertiary)', letterSpacing: '2px' }}>VS</div>
                        {renderPortfolioCard('B', statsB)}
                    </>
                )}
            </div>

            {/* Configs (Read Only / Minimal) */}
            <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Global Parameters
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Time Horizon</label>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{timeHorizon} Years</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={timeHorizon}
                            onChange={(e) => setTimeHorizon(Number(e.target.value))}
                            style={{
                                width: '100%',
                                accentColor: 'var(--text-primary)',
                                height: '4px',
                                background: '#e2e8f0',
                                borderRadius: '2px',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>
            </div>

            <SimulationConfigModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onRun={handleRunFromModal}
                initialTotalValue={totalPortfolioValue}
                currentConfig={activeConfig === 'A' ? configA : configB}
            />
        </div>
    );
};
