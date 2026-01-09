import { useState } from 'react';
import { Dashboard } from './components/Dashboard';

function App() {
    const [currentView, setCurrentView] = useState<'portfolio' | 'simulation'>('portfolio');

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            paddingBottom: '128px', // Extensive bottom padding to prevent clipping
            boxSizing: 'border-box'
        }}>
            {/* Global Header Area */}
            <header style={{
                marginBottom: '24px',
                padding: '0', // Removed horizontal padding here, handled by centered container
                width: '100%',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '1600px',
                    padding: '0' // Alignment matching dashboard
                }}>
                    {/* Top Row: Title + Tabs + Date */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                            {/* H1 Title */}
                            <h1 style={{
                                margin: 0,
                                fontSize: '2rem',
                                fontWeight: '800',
                                letterSpacing: '-0.03em',
                                color: 'var(--text-primary)',
                                lineHeight: 1
                            }}>
                                Portfolio Analysis
                            </h1>

                            {/* Navigation Tabs (Pill Style) */}
                            <div style={{
                                display: 'flex',
                                gap: '4px',
                                backgroundColor: 'rgba(0,0,0,0.04)', // Very subtle gray
                                padding: '4px',
                                borderRadius: '999px',
                            }}>
                                <button
                                    onClick={() => setCurrentView('portfolio')}
                                    style={{
                                        border: 'none',
                                        background: currentView === 'portfolio' ? 'white' : 'transparent',
                                        padding: '6px 16px',
                                        borderRadius: '999px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: currentView === 'portfolio' ? 'black' : 'var(--text-tertiary)',
                                        boxShadow: currentView === 'portfolio' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    Portfolio
                                </button>
                                <button
                                    onClick={() => setCurrentView('simulation')}
                                    style={{
                                        border: 'none',
                                        background: currentView === 'simulation' ? 'white' : 'transparent',
                                        padding: '6px 16px',
                                        borderRadius: '999px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: currentView === 'simulation' ? 'black' : 'var(--text-tertiary)',
                                        boxShadow: currentView === 'simulation' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    Simulation
                                </button>
                            </div>
                        </div>

                        {/* Date (Right Aligned) */}
                        <div style={{
                            color: 'var(--text-tertiary)',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                        }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </div>

                    {/* Subtext (Below Title) */}
                    <div style={{
                        color: 'var(--text-secondary)',
                        fontWeight: '500',
                        fontSize: '0.9rem',
                        marginLeft: '2px' // Visual alignment with H1
                    }}>
                        Real-Time Wealth Tracker
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main style={{
                flex: 1,
                borderRadius: '16px',
            }}>
                <Dashboard currentView={currentView} />
            </main>
        </div>
    );
}

export default App;
