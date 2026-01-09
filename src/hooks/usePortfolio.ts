import { useState, useEffect, useCallback } from 'react';
import { fetchQuote } from '../engine/market';

export interface Asset {
    id: string;
    symbol: string;
    shares: number;
    avgPrice: number;
    price: number;
    value: number;
    gain: number;
    gainPercent: number;
    // UI Display Props
    name: string;
    change: number;
    changePercent: number;
    profit: number;
    returnPercent: number;
    totalValue: number;
    weight: number;
    source?: string;
}

export const usePortfolio = () => {
    const [portfolio, setPortfolio] = useState<Asset[]>(() => {
        const saved = localStorage.getItem('portfolio_v1');
        return saved ? JSON.parse(saved) : [];
    });
    const [totalValue, setTotalValue] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Legacy loading prop for backward compatibility if needed, but we should switch
    const loading = isRefreshing || isAdding;

    useEffect(() => {
        localStorage.setItem('portfolio_v1', JSON.stringify(portfolio));
        const total = portfolio.reduce((sum, item) => sum + item.value, 0);
        setTotalValue(total);
    }, [portfolio]);

    // Helper: Recalculate weights for a given portfolio
    const recalculateWeights = (currentAssets: Asset[]): Asset[] => {
        const total = currentAssets.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return currentAssets;
        return currentAssets.map(asset => ({
            ...asset,
            weight: (asset.value / total) * 100
        }));
    };

    const addAsset = async (symbol: string, shares: number, userAvgPrice?: number) => {
        // 1. Initialize and prevent empty submissions
        if (!symbol) return;
        setIsAdding(true);

        const cleanSymbol = symbol.trim().toUpperCase();

        try {
            // 2. Fetch price with a safety fallback
            let quoteData = null;
            let currentPrice = 100.00; // Default safe fallback

            try {
                // Attempt to fetch real-time data
                quoteData = await fetchQuote(cleanSymbol);
                if (quoteData) {
                    currentPrice = quoteData.price;
                }
            } catch (apiError) {
                // Fallback to prevent the "Please Wait" hang if API fails
                console.warn("API failed, using fallback price.");
            }

            // Fallback object if quote is null (e.g. from market.ts fallback failure)
            if (!quoteData) {
                quoteData = {
                    symbol: cleanSymbol,
                    name: cleanSymbol,
                    price: currentPrice,
                    change: 0,
                    changePercent: 0,
                    source: 'ERROR'
                };
            }

            // 3. Create asset object with strict numeric casting
            const numShares = Number(shares);
            const costBasis = Number(userAvgPrice || currentPrice);
            const val = currentPrice * numShares;

            const newAsset: Asset = {
                id: Date.now().toString(),
                symbol: cleanSymbol,
                shares: numShares,
                avgPrice: costBasis,
                price: currentPrice,
                value: val,
                // Calculations
                gain: val - (costBasis * numShares),
                gainPercent: costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0,
                // Metadata
                name: quoteData.name || cleanSymbol,
                change: quoteData.change || 0,
                changePercent: quoteData.changePercent || 0,
                // Metrics
                profit: val - (costBasis * numShares),
                returnPercent: costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0,
                totalValue: val,
                weight: 0, // Will be calculated next
                source: quoteData.source || 'ERROR'
            };

            // 4. Update state with recalculated weights
            setPortfolio(prev => {
                const updated = [...prev, newAsset];
                return recalculateWeights(updated);
            });

        } catch (criticalError) {
            console.error("Critical Error Adding Asset:", criticalError);
            alert("Error adding asset. System restored to stable state.");
        } finally {
            // 5. ESSENTIAL: Always reset loading state to unlock the button
            setIsAdding(false);
        }
    };

    const removeAsset = (id: string) => {
        setPortfolio(prev => {
            const remaining = prev.filter(a => a.id !== id);
            return recalculateWeights(remaining);
        });
    };

    const refreshPortfolio = useCallback(async (_force: boolean = false) => {
        setIsRefreshing(true);
        // Add artificial delay for UX feel if too fast
        setTimeout(async () => {
            try {
                let totalVal = 0;
                const updated = await Promise.all(
                    portfolio.map(async (s) => {
                        try {
                            const quote = await fetchQuote(s.symbol);
                            if (quote) {
                                const val = s.shares * quote.price;
                                totalVal += val;

                                return {
                                    ...s,
                                    price: quote.price,
                                    value: val,
                                    gain: val - (s.avgPrice * s.shares),
                                    gainPercent: ((quote.price - s.avgPrice) / s.avgPrice) * 100
                                };
                            }
                            return s;
                        } catch (e) {
                            return s;
                        }
                    })
                );

                // Recalculate weights after price updates
                setPortfolio(recalculateWeights(updated));
                setTotalValue(totalVal);
            } catch (e) {
                console.error("Manual refresh failed", e);
            } finally {
                setIsRefreshing(false);
            }
        }, 500);
    }, [portfolio]);

    // Background Update every 60s
    useEffect(() => {
        const interval = setInterval(async () => {
            refreshPortfolio(false);
        }, 60000);
        return () => clearInterval(interval);
    }, [refreshPortfolio]);

    // Computed Portfolio Metrics
    const totalPortfolioValue = totalValue; // Alias
    const totalDayChange = portfolio.reduce((sum, item) => sum + (item.price * item.shares * (item.changePercent || 0) / 100), 0);
    const totalDayChangePercent = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;
    const totalProfit = portfolio.reduce((sum, item) => sum + item.gain, 0);
    const totalReturnPercent = totalValue > 0 ? (totalProfit / (totalValue - totalProfit)) * 100 : 0;

    const reorderAssets = (newPortfolio: Asset[]) => {
        // Just save the new order (weights shouldn't receive major changes from reorder, but good to ensure consistency)
        setPortfolio(recalculateWeights(newPortfolio));
    };

    return {
        portfolio,
        totalValue,
        // Metrics expected by Dashboard
        assets: portfolio, // Alias
        totalPortfolioValue,
        totalDayChange,
        totalDayChangePercent,
        totalProfit,
        totalReturnPercent,

        loading, // For backward compatibility
        isAdding,
        isRefreshing,
        error: null, // Placeholder
        lastUpdated: new Date(), // Placeholder
        timeLeft: 0, // FIXED: Was hardcoded to 60, causing permanent disable

        addAsset,
        removeAsset,
        reorderAssets,
        refreshPortfolio
    };
};
// Export alias expected by Table
export type PortfolioAsset = Asset;
