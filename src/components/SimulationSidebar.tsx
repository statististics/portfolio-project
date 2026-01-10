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
        riskStats?: any;
        dataPeriod?: string;
        benchmark?: { expectedReturn: number, volatility: number };
    }) => void;
    isSimulating: boolean;
}

export const SimulationSidebar: React.FC<SimulationSidebarProps> = ({
    totalPortfolioValue,
    onRun,
    isSimulating
}) => {
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Calculated Stats State (Read Only)
    const [stats, setStats] = useState<{ expectedReturn: number; volatility: number; dataPeriod?: string; dataPoints?: number } | null>(null);
    const [timeHorizon, setTimeHorizon] = useState(10);
    const [numSimulations] = useState(1000); // Fixed or could be configurable

    const handleRunFromModal = (data: { expectedReturn: number; volatility: number; initialValue: number; runStats?: any; dataPeriod?: string, benchmark?: { expectedReturn: number, volatility: number } }) => {
        console.log("DEBUG: Sidebar received runStats:", data.runStats);
        setStats({
            expectedReturn: data.expectedReturn,
            volatility: data.volatility,
            dataPeriod: data.dataPeriod,
            dataPoints: data.runStats?.commonDataPoints
        });

        // Trigger the simulation immediately
        onRun({
            initialValue: data.initialValue,
            timeHorizon,
            numSimulations,
            expectedReturn: data.expectedReturn,
            volatility: data.volatility,
            riskStats: data.runStats,
            dataPeriod: data.dataPeriod,
            benchmark: data.benchmark
        });
    };

    return (
        <div style={{
            width: '320px',
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRight: '1px solid rgba(255,255,255,0.6)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px'
        }}>
            <div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>
                    Monte Carlo
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Project future wealth using data-driven historical analysis.
                </p>
            </div>

            {/* Main Action */}
            <div style={{
                padding: '20px',
                backgroundColor: 'white',
                borderRadius: '16px',
                border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
            }}>
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Simulation Basis
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Virtual Configured Portfolio
                    </div>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={isSimulating}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '14px',
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
                >
                    <Settings2 size={16} /> {isSimulating ? 'Simulating...' : 'Configure Shares'}
                </button>

                {stats ? (
                    <div style={{
                        padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Hist. Return</span>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: '700', color: 'var(--accent-green)' }}>{stats.expectedReturn}%</span>
                                {stats.dataPoints && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                        (Based on last {stats.dataPoints} trading days)
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Hist. Volatility</span>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: '700', color: 'var(--accent-orange)' }}>{stats.volatility}%</span>
                                {stats.dataPoints && (
                                    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                        Records: {stats.dataPoints}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', fontStyle: 'italic' }}>
                        Configure to see historical stats
                    </div>
                )}
            </div>

            {/* Configs (Read Only / Minimal) */}
            <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Parameters
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
            />
        </div>
    );
};
