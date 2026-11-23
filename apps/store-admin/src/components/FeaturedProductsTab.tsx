import React, { useState } from 'react';
import { GripVertical, ImageOff, Eye, Pencil, StarOff, ArrowUp, ArrowDown } from 'lucide-react';
import { CatalogProduct } from '../lib/catalog-api';
import { formatMoney } from '../lib/format';
import { EmptyState } from './StoreStatusNotices';

interface FeaturedProductsTabProps {
  featured: CatalogProduct[];
  currency: string;
  categoryNames?: Map<string, string>;
  storeSlug: string;
  busy: boolean;
  onReorder: (next: CatalogProduct[]) => void;
  onUnfeature: (product: CatalogProduct) => void;
  onEditProduct?: (product: CatalogProduct) => void;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

export const FeaturedProductsTab: React.FC<FeaturedProductsTabProps> = ({
  featured,
  currency,
  categoryNames,
  storeSlug,
  busy,
  onReorder,
  onUnfeature,
  onEditProduct,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (featured.length === 0) {
    return (
      <div className="card" style={{ padding: 0 }}>
        <EmptyState message="No products are featured yet. Pin items to Featured from the Products tab to configure homepage drop sequence." />
      </div>
    );
  }

  const move = (from: number, to: number) => {
    const next = moveItem(featured, from, to);
    if (next !== featured) onReorder(next);
  };

  const hidden = featured.filter((p) => p.status !== 'ACTIVE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Informative Guidance Banner */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Homepage Featured Drops Sequencing Engine</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: '#f59e0b',
                color: '#000000',
                padding: '2px 8px',
                borderRadius: '12px',
                letterSpacing: '0.04em',
              }}
            >
              LIVE ORDER
            </span>
          </h2>
          <p style={{ fontSize: '0.76rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
            Drag using the dedicated <strong>(⋮⋮) handle</strong> to position flagship drops.
            Rank #1 controls the Primary Hero Spotlight; Ranks #2 & #3 anchor secondary carousels; Ranks #4+ drive supporting lookbook feeds.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Total Featured Drops: <strong style={{ color: '#fff' }}>{featured.length}</strong>
          </span>
        </div>
      </div>

      {hidden.length > 0 && (
        <div className="notice notice-warning" role="status" style={{ margin: 0 }}>
          {hidden.length === 1 ? '1 featured drop is' : `${hidden.length} featured drops are`} currently inactive or sold out (
          {hidden.map((p) => p.title).join(', ')}). The storefront carousel dynamically skips inactive items and surfaces the next ranked drop.
        </div>
      )}

      {/* Grid of Sortable Featured Product Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {featured.map((product, index) => {
          const rank = index + 1;
          const isTopSpotlight = rank === 1;
          const isSecondarySpotlight = rank === 2 || rank === 3;
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          const isSoldOut = product.status !== 'ACTIVE';
          const categoryTitle = product.categoryId ? (categoryNames?.get(product.categoryId) || 'Streetwear') : 'Streetwear';

          return (
            <div
              key={product.id}
              draggable={!busy}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData('text/plain'));
                setDragIndex(null);
                setOverIndex(null);
                if (Number.isInteger(from)) move(from, index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
                border: isTopSpotlight
                  ? '2px solid #f59e0b'
                  : isOver
                  ? '2px dashed var(--primary)'
                  : '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: isTopSpotlight
                  ? '0 10px 25px -5px rgba(245, 158, 11, 0.25)'
                  : '0 2px 8px rgba(0,0,0,0.04)',
                opacity: isDragging ? 0.4 : 1,
                transform: isOver ? 'scale(1.02)' : 'none',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {/* Top Bar: Mouse Grip Handle + Serial Rank Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isTopSpotlight ? '#fffbeb' : '#f8fafc',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--text-muted)',
                    cursor: busy ? 'not-allowed' : 'grab',
                    userSelect: 'none',
                  }}
                  title="Click and drag to re-order sequence rank"
                >
                  <GripVertical size={16} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Drag
                  </span>
                </div>

                {/* Serial Rank Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => move(index, index - 1)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        padding: '2px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                      }}
                      title="Move rank up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === featured.length - 1}
                      onClick={() => move(index, index + 1)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: index === featured.length - 1 ? 'not-allowed' : 'pointer',
                        padding: '2px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                      }}
                      title="Move rank down"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: isTopSpotlight
                        ? '#f59e0b'
                        : isSecondarySpotlight
                        ? 'var(--primary)'
                        : '#0f172a',
                      color: isTopSpotlight ? '#000' : '#fff',
                    }}
                  >
                    #{rank} {isTopSpotlight ? 'HERO' : isSecondarySpotlight ? 'SPOTLIGHT' : ''}
                  </span>
                </div>
              </div>

              {/* 1:1 Aspect Ratio Square Viewport with Direct WebP Render */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '100%',
                  backgroundColor: '#0f172a',
                  overflow: 'hidden',
                }}
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                    }}
                  >
                    <ImageOff size={32} />
                  </div>
                )}

                {/* Bottom Overlays: Product Type & Stock State */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    right: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 2,
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {product.optionLayout === 'variants' ? 'VARIABLE' : 'SIMPLE'}
                  </span>

                  {isSoldOut && (
                    <span
                      style={{
                        background: 'rgba(239, 68, 68, 0.95)',
                        color: '#ffffff',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      SOLD OUT
                    </span>
                  )}
                </div>
              </div>

              {/* Information & Identification Block */}
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {/* Product Title: 2-Line Clamp with Tooltip */}
                <div
                  title={product.title}
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.35,
                    minHeight: '2.3em',
                  }}
                >
                  {product.title}
                </div>

                {/* SKU Code */}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  SKU: <span className="mono" style={{ fontWeight: 600 }}>{product.sku || 'UNASSIGNED'}</span>
                </div>

                {/* Categorization */}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Collection: <span style={{ fontWeight: 600 }}>{categoryTitle}</span>
                </div>

                {/* Financial Economics */}
                <div
                  style={{
                    marginTop: '4px',
                    paddingTop: '6px',
                    borderTop: '1px dashed var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {formatMoney(currency, product.basePrice)}
                  </span>
                  {typeof product.costPrice === 'number' && product.costPrice > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                      Cost: {formatMoney(currency, product.costPrice)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Dock: Preview, Edit, and Instant Unfeature */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  borderTop: '1px solid var(--border)',
                  background: '#f8fafc',
                }}
              >
                <button
                  type="button"
                  title="Storefront Live Preview"
                  onClick={() => window.open(`http://${storeSlug}.dropiobd.localhost:5200/product/${product.slug}`, '_blank')}
                  style={{
                    padding: '8px 0',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <Eye size={13} /> Preview
                </button>

                <button
                  type="button"
                  title="Edit Product Details"
                  onClick={() => onEditProduct && onEditProduct(product)}
                  style={{
                    padding: '8px 0',
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <Pencil size={13} /> Edit
                </button>

                <button
                  type="button"
                  title="Remove from Homepage Featured Sequence"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove "${product.title}" from the featured homepage sequence?`)) {
                      onUnfeature(product);
                    }
                  }}
                  style={{
                    padding: '8px 0',
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    background: 'transparent',
                    color: '#dc2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  <StarOff size={13} /> Unfeature
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
