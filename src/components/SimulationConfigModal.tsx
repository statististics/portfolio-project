import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, Calculator } from 'lucide-react';
import { calculatePortfolioStats, fetchQuote } from '../engine/market';

interface SimulationConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRun: (data: {
        expectedReturn: number;
        volatility: number;
        beta?: number;
        initialValue: number;
        monthlyCost: number;
        runStats?: any;
        dataPeriod?: string;
        benchmark?: { expectedReturn: number, volatility: number };
        monthlyStats?: { expectedReturn: number, volatility: number; beta?: number };
    }) => void;
    initialTotalValue: number;
    currentPortfolio?: { symbol: string; quantity: number }[];
}

interface ConfigItem {
    id: string;
    symbol: string;
    shares: number;
    price: number;
    value: number;
    loading?: boolean;
}

export const SimulationConfigModal: React.FC<SimulationConfigModalProps> = ({
    isOpen,
    onClose,
    onRun
}) => {
    // Mode: Initial vs Monthly
    const [activeTab, setActiveTab] = useState<'initial' | 'monthly'>('initial');

    // Two separate lists
    const [initialItems, setInitialItems] = useState<ConfigItem[]>([]);
    const [monthlyItems, setMonthlyItems] = useState<ConfigItem[]>([]);

    const [newSymbol, setNewSymbol] = useState('');
    const [newShares, setNewShares] = useState(0);
    const [calculating, setCalculating] = useState(false);
    const [addingTicker, setAddingTicker] = useState(false);

    const [dataPeriod, setDataPeriod] = useState<'1Y' | '3Y' | '5Y' | 'MAX'>('MAX');

    // Live Preview Stats
    const [previewInitial, setPreviewInitial] = useState<{ ret: number, vol: number } | null>(null);
    const [previewMonthly, setPreviewMonthly] = useState<{ ret: number, vol: number } | null>(null);

    // Effect: Recalculate Stats on change
    React.useEffect(() => {
        const calc = async () => {
            if (initialItems.length > 0) {
                const valid = initialItems.map(i => ({ symbol: i.symbol, shares: i.shares }));
                const s = await calculatePortfolioStats(valid, dataPeriod);
                setPreviewInitial({ ret: s.expectedReturn, vol: s.volatility });
            } else {
                setPreviewInitial(null);
            }

            if (monthlyItems.length > 0) {
                const valid = monthlyItems.map(i => ({ symbol: i.symbol, shares: i.shares }));
                const s = await calculatePortfolioStats(valid, dataPeriod);
                setPreviewMonthly({ ret: s.expectedReturn, vol: s.volatility });
            } else {
                setPreviewMonthly(null);
            }
        };
        calc();
    }, [initialItems, monthlyItems, dataPeriod]);

    const handleAddItem = async () => {
        if (!newSymbol || newShares <= 0) return;
        setAddingTicker(true);

        try {
            const sym = newSymbol.toUpperCase();
            const quote = await fetchQuote(sym);
            if (!quote) throw new Error("Quote not found");
            const price = quote.price;

            const newItem: ConfigItem = {
                id: Date.now().toString(),
                symbol: sym,
                shares: newShares,
                price: price,
                value: price * newShares,
                loading: false
            };

            if (activeTab === 'initial') {
                setInitialItems(prev => [...prev, newItem]);
            } else {
                setMonthlyItems(prev => [...prev, newItem]);
            }

            setNewSymbol('');
            setNewShares(0);
        } catch (e) {
            console.error("Failed to fetch price", e);
            alert("Could not fetch price for " + newSymbol);
        } finally {
            setAddingTicker(false);
        }
    };

    const handleRemoveItem = (id: string) => {
        if (activeTab === 'initial') {
            setInitialItems(initialItems.filter(i => i.id !== id));
        } else {
            setMonthlyItems(monthlyItems.filter(i => i.id !== id));
        }
    };

    const handleSync = () => {
        // Copy Initial -> Monthly
        // We need deep copy of items with new IDs
        const copied = initialItems.map(item => ({
            ...item,
            id: Date.now() + Math.random().toString()
        }));
        setMonthlyItems(copied);
        alert("Synced! Monthly purchases now match initial holdings.");
    };

    const getInitialTotal = () => initialItems.reduce((sum, i) => sum + i.value, 0);
    const getMonthlyTotal = () => monthlyItems.reduce((sum, i) => sum + i.value, 0);

    const runSimulation = async (shouldClose: boolean = false) => {


        if (initialItems.length === 0 && monthlyItems.length === 0) {
            alert("Please configure either an Initial Portfolio OR Monthly Contributions.");
            return;
        }

        setCalculating(true);
        try {
            const totalInitial = getInitialTotal();
            const totalMonthly = getMonthlyTotal();

            // Calculate Stats based on INITIAL Portfolio mixing
            // 1. Initial Portfolio Stats
            const validInitial = initialItems.map(i => ({ symbol: i.symbol, shares: i.shares }));
            const statsInitial = await calculatePortfolioStats(validInitial, dataPeriod);

            // 2. Monthly Portfolio Stats
            // If empty, default to 0 to clearly indicate "No Active Strategy"
            let statsMonthly: any = { expectedReturn: 0, volatility: 0, beta: 0 };
            if (monthlyItems.length > 0) {
                const validMonthly = monthlyItems.map(i => ({ symbol: i.symbol, shares: i.shares }));
                statsMonthly = await calculatePortfolioStats(validMonthly, dataPeriod);
            }

            onRun({
                expectedReturn: statsInitial.expectedReturn,
                volatility: statsInitial.volatility,
                beta: statsInitial.beta,
                runStats: statsInitial,

                // New: Explicit stats for monthly portion
                monthlyStats: {
                    expectedReturn: statsMonthly.expectedReturn,
                    volatility: statsMonthly.volatility,
                    beta: statsMonthly.beta
                },

                initialValue: totalInitial,
                monthlyCost: totalMonthly,
                dataPeriod: dataPeriod,
                benchmark: (statsInitial.benchmarkReturn && statsInitial.benchmarkVolatility) ? {
                    expectedReturn: statsInitial.benchmarkReturn,
                    volatility: statsInitial.benchmarkVolatility
                } : undefined
            });

            if (shouldClose) onClose();

        } catch (e: any) {
            console.warn("Calculation failed:", e);
            if (shouldClose) alert(`Analysis failed: ${e.message}`);
        } finally {
            setCalculating(false);
        }
    };

    // Render Helper
    const currentItems = activeTab === 'initial' ? initialItems : monthlyItems;

    // Reactive Update: Recalculate whenever Period or Items change
    React.useEffect(() => {
        if (initialItems.length > 0) {
            runSimulation(false);
        }
    }, [dataPeriod, initialItems, monthlyItems]);

    const handleRun = () => {
        if (initialItems.length === 0 && monthlyItems.length === 0) {
            alert("Please add assets to the Portfolio.");
            return;
        }
        runSimulation(true);
    };

    if (!isOpen) return null;

    const totalInitial = getInitialTotal();
    const totalMonthly = getMonthlyTotal();

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
            transition: 'opacity 0.2s'
        }}>
            <div style={{
                width: '600px',
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.4)',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}>
                            <Calculator size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                                Portfolio Config
                            </h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                                Configure Initial Seed & Monthly Contributions
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* TABS */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.1)', gap: '24px' }}>
                    <button
                        onClick={() => setActiveTab('initial')}
                        style={{
                            padding: '12px 0',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'initial' ? '2px solid var(--text-primary)' : '2px solid transparent',
                            color: activeTab === 'initial' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Initial Seed
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        style={{
                            padding: '12px 0',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'monthly' ? '2px solid var(--text-primary)' : '2px solid transparent',
                            color: activeTab === 'monthly' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Monthly Purchase
                    </button>
                </div>

                {/* SUMMARY HEADER based on Active Tab */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                            {activeTab === 'initial' ? 'Total Initial Capital' : 'Est. Monthly Cost'}
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                            ${(activeTab === 'initial' ? totalInitial : totalMonthly).toLocaleString()}
                        </div>

                        {/* Live Stats Preview */}
                        <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '12px' }}>
                            {activeTab === 'initial' && previewInitial && (
                                <>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Exp. Return:</span>
                                        <span style={{ fontWeight: '700', color: 'var(--accent-green)' }}>{previewInitial.ret.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Volatility:</span>
                                        <span style={{ fontWeight: '700', color: 'var(--accent-orange)' }}>{previewInitial.vol.toFixed(1)}%</span>
                                    </div>
                                </>
                            )}
                            {activeTab === 'monthly' && previewMonthly && (
                                <>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Exp. Return:</span>
                                        <span style={{ fontWeight: '700', color: 'var(--accent-green)' }}>{previewMonthly.ret.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Volatility:</span>
                                        <span style={{ fontWeight: '700', color: 'var(--accent-orange)' }}>{previewMonthly.vol.toFixed(1)}%</span>
                                    </div>
                                </>
                            )}
                            {((activeTab === 'initial' && !previewInitial && initialItems.length > 0) || (activeTab === 'monthly' && !previewMonthly && monthlyItems.length > 0)) && (
                                <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Calculating stats...</div>
                            )}
                        </div>
                    </div>

                    {activeTab === 'monthly' && (
                        <button
                            onClick={handleSync}
                            style={{
                                padding: '8px 12px',
                                fontSize: '12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                background: 'white',
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            Sync from Initial
                        </button>
                    )}
                </div>

                {/* ADD ASSET FORM */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Symbol (e.g. SPY)"
                            value={newSymbol}
                            onChange={e => setNewSymbol(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.1)', outline: 'none',
                                fontSize: '14px', fontWeight: '600',
                                textTransform: 'uppercase',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ width: '120px' }}>
                        <input
                            type="number"
                            placeholder="Shares"
                            value={newShares || ''}
                            onChange={e => setNewShares(parseFloat(e.target.value))}
                            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.1)', outline: 'none',
                                fontSize: '14px', fontWeight: '600',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <button
                        onClick={handleAddItem}
                        disabled={addingTicker}
                        style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: 'var(--text-primary)', color: 'white',
                            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        {addingTicker ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                {/* CURRENT ITEMS LIST */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                            No assets configured for {activeTab === 'initial' ? 'Initial Seed' : 'Monthly Purchase'}.
                        </div>
                    ) : (
                        currentItems.map(item => (
                            <div key={item.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', backgroundColor: 'rgba(0,0,0,0.02)',
                                borderRadius: '12px', border: '1px solid rgba(0,0,0,0.03)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: '800', fontSize: '11px', color: 'var(--text-primary)',
                                        border: '1px solid rgba(0,0,0,0.05)'
                                    }}>
                                        {item.symbol}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {item.shares} shares
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                            @ ${item.price.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                            Current Value
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            border: 'none', background: 'rgba(0,0,0,0.05)',
                                            color: 'var(--text-tertiary)', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {['1Y', '3Y', '5Y', 'MAX'].map(p => (
                            <button
                                key={p}
                                onClick={() => setDataPeriod(p as any)}
                                style={{
                                    padding: '6px 12px', borderRadius: '8px',
                                    border: dataPeriod === p ? '1px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.1)',
                                    background: dataPeriod === p ? 'var(--text-primary)' : 'transparent',
                                    color: dataPeriod === p ? 'white' : 'var(--text-tertiary)',
                                    fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleRun}
                        disabled={calculating}
                        style={{
                            padding: '12px 32px', borderRadius: '12px',
                            background: 'var(--text-primary)', color: 'white',
                            border: 'none', fontWeight: '700', fontSize: '14px',
                            cursor: calculating ? 'not-allowed' : 'pointer',
                            opacity: calculating ? 0.8 : 1,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        {calculating ? 'Analyzing...' : 'Run Simulation'}
                    </button>
                </div>
            </div>
        </div>
    );
};
