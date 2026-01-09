import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SimulationSidebar } from './SimulationSidebar';
import { PortfolioTable } from './PortfolioTable';
import { SimulationView } from './SimulationView';
import { usePortfolio } from '../hooks/usePortfolio';
import { useSimulation } from '../hooks/useSimulation';

interface DashboardProps {
    currentView: 'portfolio' | 'simulation';
}

export const Dashboard: React.FC<DashboardProps> = ({ currentView }) => {
    const {
        assets,
        totalPortfolioValue,
        totalDayChange,
        totalDayChangePercent,
        totalProfit,
        totalReturnPercent,
        addAsset,
        removeAsset,
        refreshPortfolio,
        reorderAssets,
        loading,
        isAdding,
        isRefreshing,
        error,
        lastUpdated,
        timeLeft
    } = usePortfolio();

    // Simulation Hook
    const { results, finalDistribution, stats, runSimulation, isSimulating, history, saveSimulation, deleteSimulation } = useSimulation();

    const handleRefresh = () => {
        refreshPortfolio(true);
    };

    const isRateLimited = timeLeft > 0;

    return (
        <div style={{
            display: 'flex',
            gap: '48px', // Significant gap as requested
            // No fixed heights!
            minHeight: '200px',
            height: 'fit-content',
            width: '100%',
            maxWidth: '1600px',
            margin: '0 auto', // Center layout
            position: 'relative',
            overflow: 'visible'
        }}>

            {/* Sidebar Logic (Sticky Wrapper) */}
            <div style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', height: 'fit-content', zIndex: 20 }}>
                {currentView === 'portfolio' ? (
                    <Sidebar onAdd={addAsset} isDisabled={isAdding || isRateLimited} error={error} />
                ) : (
                    <SimulationSidebar
                        totalPortfolioValue={totalPortfolioValue}
                        onRun={runSimulation}
                        isSimulating={isSimulating}
                    />
                )}
            </div>

            {/* Main Content Area - Now its own Card */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(255, 255, 255, 0.45)', // Moved Glass styles here
                backdropFilter: 'blur(40px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.4) inset',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: '24px',
                padding: '32px',
                position: 'relative'
            }}>

                {currentView === 'portfolio' ? (
                    <>
                        {/* Refresh Button (Floating Top Right of Content) */}
                        <div style={{ position: 'absolute', top: '32px', right: '32px', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: isRefreshing ? 'var(--accent-blue)' : error ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                                    {isRefreshing ? 'SYNCING...' : error ? 'ERROR' : 'LIVE'}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}
                                </div>
                            </div>
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing || isRateLimited}
                                style={{
                                    padding: '10px',
                                    borderRadius: '50%',
                                    border: '1px solid rgba(0,0,0,0.05)',
                                    backgroundColor: isRateLimited ? 'rgba(239, 68, 68, 0.1)' : 'white',
                                    cursor: loading || isRateLimited ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s',
                                    color: isRateLimited ? 'var(--accent-red)' : 'var(--text-primary)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title={isRateLimited ? `Wait ${timeLeft}s` : "Refresh Prices"}
                            >
                                <RefreshCw size={18} className={loading ? 'spin' : ''} style={{ opacity: loading ? 0.5 : 1 }} />
                                {isRateLimited && (
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                        color: 'var(--accent-red)'
                                    }}>
                                        {timeLeft}s
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* Metrics Section */}
                        <div style={{ display: 'flex', gap: '48px', alignItems: 'center', marginBottom: '32px' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                    Total Value
                                </div>
                                <span style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                                    ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                        Day Change
                                    </span>
                                    <div style={{
                                        fontWeight: '600',
                                        fontSize: '20px',
                                        color: totalDayChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                                    }}>
                                        {totalDayChange >= 0 ? '+' : ''}${Math.abs(totalDayChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span style={{ marginLeft: '6px', opacity: 0.8, fontSize: '16px' }}>({totalDayChangePercent.toFixed(2)}%)</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                        Total Profit
                                    </span>
                                    <div style={{
                                        fontWeight: '600',
                                        fontSize: '20px',
                                        color: totalProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                                    }}>
                                        {totalProfit >= 0 ? '+' : ''}${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span style={{ marginLeft: '6px', opacity: 0.8, fontSize: '16px' }}>({totalReturnPercent.toFixed(2)}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <PortfolioTable assets={assets} totalValue={totalPortfolioValue} onRemoveAsset={removeAsset} onReorder={reorderAssets} />
                    </>
                ) : (
                    <SimulationView
                        results={results}
                        distribution={finalDistribution}
                        stats={stats}
                        history={history}
                        onSave={saveSimulation}
                        onDelete={deleteSimulation}
                    />
                )}
            </div>
        </div>
    );
};
