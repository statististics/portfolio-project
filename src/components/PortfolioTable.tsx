import React, { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, GripVertical } from 'lucide-react'; // Added GripVertical
import { PortfolioAsset } from '../hooks/usePortfolio';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PortfolioTableProps {
    assets: PortfolioAsset[];
    totalValue: number;
    onRemoveAsset: (id: string) => void;
    onReorder: (newAssets: PortfolioAsset[]) => void;
}

type SortKey = keyof PortfolioAsset;
type SortDirection = 'ascending' | 'descending' | null;

interface SortConfig {
    key: SortKey | null;
    direction: SortDirection;
}



// Sortable Row Component
const SortableTableRow = ({ asset, onRemoveAsset, isDragging }: { asset: PortfolioAsset, onRemoveAsset: (id: string) => void, isDragging?: boolean }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isRowDragging
    } = useSortable({ id: asset.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isRowDragging ? 100 : 'auto',
        position: 'relative' as const,
        opacity: isRowDragging ? 0.5 : 1,
    };

    const cellPadding = '16px';
    const tickerDisplayName = asset.name === asset.symbol ? null : (asset.name?.length > 12 ? asset.name.substring(0, 12) + '...' : asset.name);

    return (
        <tr ref={setNodeRef} style={style} className={`${isDragging ? '' : 'hover:bg-gray-50'} transition-colors border-b border-gray-100 last:border-0 bg-white`}>
            {/* Ticker w/ Drag Grip */}
            <td style={{ padding: cellPadding, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-tertiary)' }} className="drag-handle hover:text-gray-600">
                        <GripVertical size={16} />
                    </div>
                    {/* Removed single letter circle badge as requested */}
                    <div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>{asset.symbol}</div>
                        {tickerDisplayName && (
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                {tickerDisplayName}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            {/* Shares */}
            <td style={{ padding: cellPadding, textAlign: 'right', color: 'var(--text-primary)', fontWeight: '500' }}>
                {asset.shares.toLocaleString()}
            </td>

            {/* Avg Cost */}
            <td style={{ padding: cellPadding, textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>
                ${asset.avgPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>

            {/* Price */}
            <td style={{ padding: cellPadding, paddingRight: '24px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    ${asset.price.toFixed(2)}
                    {/* Removed SourceBadge ('LIVE') as requested */}
                </div>
            </td>

            {/* Day Change */}
            <td style={{
                padding: cellPadding, textAlign: 'right', fontWeight: '600',
                color: (asset.change || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                whiteSpace: 'nowrap'
            }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>{asset.changePercent > 0 ? '+' : ''}{(asset.changePercent || 0).toFixed(2)}%</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>
                        ({asset.change > 0 ? '+' : ''}{asset.change?.toFixed(2)})
                    </span>
                </div>
            </td>

            {/* Return % */}
            <td style={{
                padding: cellPadding, textAlign: 'right', fontWeight: '700',
                color: (asset.returnPercent || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
            }}>
                {(asset.returnPercent || 0) > 0 ? '+' : ''}{(asset.returnPercent || 0).toFixed(2)}%
            </td>

            {/* P/L $ */}
            <td style={{
                padding: cellPadding, textAlign: 'right', fontWeight: '600',
                color: (asset.profit || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
            }}>
                {(asset.profit || 0) >= 0 ? '+' : ''}
                ${Math.abs(asset.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>

            {/* Value */}
            <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                ${asset.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>

            {/* Weight */}
            <td style={{ padding: cellPadding, textAlign: 'center' }}>
                <div style={{
                    padding: '2px 6px', borderRadius: '4px',
                    backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                    fontSize: '11px', display: 'inline-block'
                }}>
                    {(asset.weight || 0).toFixed(1)}%
                </div>
            </td>

            {/* Actions */}
            <td style={{ padding: cellPadding, textAlign: 'center' }}>
                <button
                    onClick={() => onRemoveAsset(asset.id)}
                    style={{
                        padding: '6px', borderRadius: '6px',
                        color: 'var(--text-tertiary)', transition: 'all 0.2s',
                        cursor: 'pointer', border: 'none', background: 'transparent'
                    }}
                    className="hover:bg-red-50 hover:text-red-500"
                >
                    <Trash2 size={14} />
                </button>
            </td>
        </tr>
    );
};

export const PortfolioTable: React.FC<PortfolioTableProps> = ({ assets, onRemoveAsset, onReorder }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Ensure sloppy clicks aren't drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const sortedAssets = useMemo(() => {
        // If no sort key, return original order
        if (!sortConfig.key || !sortConfig.direction) return assets;

        const sortableAssets = [...assets];
        sortableAssets.sort((a, b) => {
            const config = sortConfig;
            if (!config.key) return 0;

            const rawA = a as any;
            const rawB = b as any;
            let valA = rawA[config.key];
            let valB = rawB[config.key];

            if (valA === undefined || valA === null) valA = 0;
            if (valB === undefined || valB === null) valB = 0;

            // Simple comparison
            if (valA < valB) return config.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return config.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return sortableAssets;
    }, [assets, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';

        // Cycle: Asc -> Desc -> Null
        if (sortConfig.key === key) {
            if (sortConfig.direction === 'ascending') {
                direction = 'descending';
            } else if (sortConfig.direction === 'descending') {
                direction = null;
            }
        }

        setSortConfig({ key: direction ? key : null, direction });
    };

    const getSortIndicator = (name: SortKey) => {
        // Reserved space for icon to prevent layout shift
        const iconContainer = (icon: React.ReactNode | null) => (
            <span style={{ display: 'inline-block', width: '16px', textAlign: 'center', marginLeft: '2px', verticalAlign: 'middle' }}>
                {icon}
            </span>
        );

        if (sortConfig.key === name && sortConfig.direction) {
            return iconContainer(sortConfig.direction === 'ascending' ? <ArrowUp size={12} /> : <ArrowDown size={12} />);
        }
        // Return empty placeholder of same width
        return iconContainer(null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = assets.findIndex((a) => a.id === active.id);
            const newIndex = assets.findIndex((a) => a.id === over.id);
            onReorder(arrayMove(assets, oldIndex, newIndex));
        }
    };

    const headerStyle = (width: string, align: 'left' | 'right' | 'center' = 'right') => ({
        width,
        textAlign: align,
        padding: '12px 16px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase' as const,
        color: 'var(--text-tertiary)',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        userSelect: 'none' as const,
        whiteSpace: 'nowrap' as const // Prevent wrapping
    });

    if (assets.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                Your portfolio is empty. Add assets to begin tracking.
            </div>
        );
    }

    const isSortingActive = sortConfig.key !== null;
    const isDragEnabled = !isSortingActive; // Disable drag when sorted

    return (
        <div style={{ overflowX: 'auto' }}>
            {/* Context must wrap table or tbody. Note: table elements cannot be direct children of DndContext due to DOM rules, 
                but we can use it around logic. Best ref is standard lists. 
                For table, implementation is careful. */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={headerStyle('10%', 'left')} onClick={() => requestSort('symbol')}>Ticker{getSortIndicator('symbol')}</th>
                            <th style={headerStyle('9%')} onClick={() => requestSort('shares')}>Shares{getSortIndicator('shares')}</th>
                            <th style={headerStyle('11%')} onClick={() => requestSort('avgPrice')}>Avg Cost{getSortIndicator('avgPrice')}</th>
                            <th style={{ ...headerStyle('11%'), paddingRight: '24px' }} onClick={() => requestSort('price')}>Price{getSortIndicator('price')}</th>
                            <th style={headerStyle('15%')} onClick={() => requestSort('change')}>Day Chg{getSortIndicator('change')}</th>
                            <th style={headerStyle('10%')} onClick={() => requestSort('returnPercent')}>Return %{getSortIndicator('returnPercent')}</th>
                            <th style={headerStyle('11%')} onClick={() => requestSort('profit')}>P/L ($){getSortIndicator('profit')}</th>
                            <th style={headerStyle('13%')} onClick={() => requestSort('totalValue')}>Value{getSortIndicator('totalValue')}</th>
                            <th style={headerStyle('7%', 'center')} onClick={() => requestSort('weight')}>Wgt{getSortIndicator('weight')}</th>
                            <th style={{ ...headerStyle('3%', 'center'), cursor: 'default' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isDragEnabled ? (
                            <SortableContext items={sortedAssets} strategy={verticalListSortingStrategy}>
                                {sortedAssets.map((asset) => (
                                    <SortableTableRow key={asset.id} asset={asset} onRemoveAsset={onRemoveAsset} />
                                ))}
                            </SortableContext>
                        ) : (
                            // When sorting, just render rows without Drag functionality visual cues
                            sortedAssets.map((asset) => (
                                <SortableTableRow key={asset.id} asset={asset} onRemoveAsset={onRemoveAsset} isDragging={false} />
                            ))
                        )}
                    </tbody>
                </table>
            </DndContext>

            {/* Visual Hint for Sort vs Drag */}
            {isSortingActive && (
                <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-tertiary)', padding: '8px' }}>
                    Drag and drop disabled while sorting. Click headers to reset.
                </div>
            )}
        </div>
    );
};
