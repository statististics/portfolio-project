import React, { useState } from 'react';
import { PlusCircle, Info } from 'lucide-react';

interface SidebarProps {
    onAdd: (symbol: string, shares: number, avgPrice: number) => void;
    isDisabled: boolean;
    error: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ onAdd, isDisabled, error }) => {
    const [ticker, setTicker] = useState('');
    const [shares, setShares] = useState('');
    const [avgPrice, setAvgPrice] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (ticker && shares && avgPrice) {
            // Assuming onAdd returns a promise (async)
            await onAdd(ticker, Number(shares), Number(avgPrice));
            // Only clear if no error thrown (UI logic simplified)
            setTicker('');
            setShares('');
            setAvgPrice('');
        }
    };

    const inputStyle = {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid rgba(200, 200, 200, 0.5)',
        borderRadius: '8px',
        padding: '12px',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
        marginBottom: '16px',
        fontWeight: '500'
    };

    return (
        <div className="glass-card" style={{
            width: '320px',
            padding: '32px', // Increased padding as requested
            display: 'flex',
            flexDirection: 'column',
            height: 'fit-content', // Changed from 100% to fit content
            backgroundColor: 'rgba(255, 255, 255, 0.7)', // Slightly more opaque
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // Stronger shadow
            border: '1px solid rgba(255, 255, 255, 0.8)',
            borderRadius: '24px' // Matching main card
        }}>
            <h2 style={{
                margin: '0 0 24px 0',
                fontSize: '1.1rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <PlusCircle size={20} color="var(--accent-blue)" />
                Add Asset
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    TICKER SYMBOL
                </label>
                <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    style={{
                        ...inputStyle,
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0', // Cool gray 200
                        boxShadow: 'sm'
                    }}
                    placeholder="e.g. AAPL"
                />

                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    SHARES OWNED
                </label>
                <input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    style={{
                        ...inputStyle,
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0'
                    }}
                    placeholder="0"
                />

                <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    AVG PRICE ($)
                </label>
                <input
                    type="number"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value)}
                    style={{
                        ...inputStyle,
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0'
                    }}
                    placeholder="0.00"
                />

                <button
                    type="submit"
                    disabled={isDisabled || !ticker || !shares || !avgPrice}
                    style={{
                        backgroundColor: isDisabled ? 'var(--text-tertiary)' : '#2563eb', // Vibrant Blue (Royal Blue)
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px', // Slightly more rounded
                        padding: '16px', // Taller button
                        fontWeight: '700', // Bolder text
                        fontSize: '15px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        marginTop: '12px',
                        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)', // Blue shadow
                        width: '100%',
                        transition: 'all 0.2s ease',
                        letterSpacing: '0.01em'
                    }}
                >
                    {isDisabled ? 'Please Wait...' : 'Add to Portfolio'}
                </button>
            </form>

            {error && (
                <div style={{
                    marginTop: '20px',
                    color: 'var(--accent-red)',
                    fontSize: '13px',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    gap: '8px',
                    fontWeight: '500'
                }}>
                    <Info size={16} />
                    {error}
                </div>
            )}


        </div>
    );
};
