import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, Calculator } from 'lucide-react';
import { calculatePortfolioStats, fetchQuote } from '../engine/market';

interface SimulationConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRun: (data: { expectedReturn: number; volatility: number; initialValue: number; runStats?: any }) => void;
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
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [newSymbol, setNewSymbol] = useState('');
    const [newShares, setNewShares] = useState(0);
    const [calculating, setCalculating] = useState(false);
    const [addingTicker, setAddingTicker] = useState(false);

    const handleAddItem = async () => {
        if (!newSymbol || newShares <= 0) return;
        setAddingTicker(true);

        try {
            const sym = newSymbol.toUpperCase();
            // Fetch live price
            const quote = await fetchQuote(sym);
            if (!quote) throw new Error("Quote not found");

            const price = quote.price;

            setItems(prev => [...prev, {
                id: Date.now().toString(),
                symbol: sym,
                shares: newShares,
                price: price,
                value: price * newShares,
                loading: false
            }]);

            setNewSymbol('');
            setNewShares(0);
        } catch (e) {
            console.error("Failed to fetch price for simulation item", e);
            alert("Could not fetch price for " + newSymbol);
        } finally {
            setAddingTicker(false);
        }
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const getTotalValue = () => items.reduce((sum, i) => sum + i.value, 0);

    const handleRun = async () => {
        setCalculating(true);
        try {
            const totalValue = getTotalValue();
            if (totalValue === 0) {
                alert("Portfolio value is 0. Add assets.");
                setCalculating(false);
                return;
            }

            // Pass strict shares for accurate history reconstruction
            // market.ts now handles { symbol, shares }
            const validItems = items.map(i => ({
                symbol: i.symbol,
                shares: i.shares,
                weight: 0 // Unused by new engine but keeps TS happy if mixed
            }));

            // Calculate Stats (Mean Return, Volatility, Risk)
            const stats = await calculatePortfolioStats(validItems);
            console.log("DEBUG: ConfigModal Calculated Stats:", stats);

            // Run Simulation
            onRun({
                expectedReturn: stats.expectedReturn,
                volatility: stats.volatility,
                runStats: stats, // Pass full risk stats
                initialValue: totalValue
            });
            onClose();
        } catch (e) {
            console.error("Simulation Prep Failed", e);
            alert("Failed to calculate simulation parameters.");
        } finally {
            setCalculating(false);
        }
    };

    if (!isOpen) return null;

    const totalValue = getTotalValue();

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
            padding: '20px'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '24px',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                            Configure Portfolio
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                            Add assets to simulate real-world historical performance.
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        padding: '8px',
                        borderRadius: '50%',
                        border: 'none',
                        background: '#f3f4f6',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>

                    {/* Items List */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', gap: '8px',
                            fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', padding: '0 8px'
                        }}>
                            <div>Ticker</div>
                            <div>Shares</div>
                            <div>Price</div>
                            <div>Value</div>
                            <div></div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {items.map(item => (
                                <div key={item.id} style={{
                                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', gap: '8px',
                                    alignItems: 'center',
                                    padding: '12px 8px',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {item.symbol}
                                        {/* @ts-ignore - item might have leverage if extended or we can look it up live */}
                                        {((item as any).leverage && Math.abs((item as any).leverage) > 1) && (
                                            <span style={{
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: (item as any).leverage > 0 ? '#dbeafe' : '#fee2e2',
                                                color: (item as any).leverage > 0 ? '#1e40af' : '#991b1b',
                                                fontWeight: '800'
                                            }}>
                                                {(item as any).leverage}x
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '13px' }}>{item.shares}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>${item.price.toFixed(2)}</div>
                                    <div style={{ fontWeight: '600' }}>${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    <button onClick={() => handleRemoveItem(item.id)} style={{
                                        border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', justifyContent: 'center'
                                    }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '13px', border: '1px dashed #e5e7eb', borderRadius: '12px' }}>
                                    No assets added. Start by adding a ticker below.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add New */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Ticker
                            </label>
                            <input
                                placeholder="e.g. NVDA"
                                value={newSymbol}
                                onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Shares
                            </label>
                            <input
                                type="number"
                                placeholder="#"
                                value={newShares > 0 ? newShares : ''}
                                onChange={e => setNewShares(Number(e.target.value))}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleAddItem}
                            disabled={!newSymbol || newShares <= 0 || addingTicker}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: (!newSymbol || newShares <= 0) ? '#f3f4f6' : 'var(--text-primary)',
                                color: (!newSymbol || newShares <= 0) ? 'var(--text-tertiary)' : 'white',
                                fontWeight: '600',
                                cursor: (!newSymbol || newShares <= 0) ? 'not-allowed' : 'pointer',
                                height: '42px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {addingTicker ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                        </button>
                    </div>

                    {/* Summary */}
                    <div style={{
                        padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1px solid #d1fae5',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)' }}>
                            <Calculator size={20} />
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>Total Start Value</span>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-green)' }}>
                            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px',
                    borderTop: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <button onClick={onClose} style={{
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={items.length === 0 || calculating}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '12px',
                            border: 'none',
                            backgroundColor: items.length === 0 ? '#f3f4f6' : 'var(--text-primary)',
                            color: items.length === 0 ? 'var(--text-tertiary)' : 'white',
                            fontWeight: '700',
                            cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: '140px',
                            justifyContent: 'center'
                        }}
                    >
                        {calculating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" /> Calculating...
                            </>
                        ) : (
                            "Run Simulation"
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};
