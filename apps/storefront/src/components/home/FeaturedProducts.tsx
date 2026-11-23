import React from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import { PublicProductCard } from '../../types/catalog';
import { ProductCard } from '../catalog/ProductCard';

/** Number of featured products the mosaic layout is designed for. */
export const FEATURED_SLOTS = 7;

interface FeaturedProductsProps {
  /** Featured products in the merchant's featured order. Only the first seven are shown. */
  products: PublicProductCard[];
  currency: string;
  storeName: string;
}

/** Tile wrapper classes for the mosaic: one large tile, four small tiles, two wide tiles. */
function mosaicTileClass(index: number): string {
  if (index === 0) return 'col-span-2 md:row-span-2';
  if (index >= 5) return 'md:col-span-2';
  return '';
}

/**
 * Featured products on the home page, in the order the merchant set in the store admin.
 * With all seven products it shows a mosaic: a large tile (two columns by two rows), four small tiles and two
 * wide tiles, which fills a four-column grid with no gaps. With fewer it shows a plain grid instead of a
 * mosaic with holes in it. Renders nothing when no product is featured.
 */
export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ products, currency, storeName }) => {
  const shown = products.slice(0, FEATURED_SLOTS);
  if (shown.length === 0) return null;

  const isMosaic = shown.length === FEATURED_SLOTS;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-labelledby="featured-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[var(--brand-primary)] uppercase tracking-wider mb-1">
            <Star className="h-4 w-4" />
            <span>Featured</span>
          </div>
          <h2
            id="featured-heading"
            className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight"
          >
            Featured from {storeName}
          </h2>
        </div>

        <Link
          href="/catalog"
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-[var(--brand-primary)] hover:underline space-x-1 self-start sm:self-auto min-h-[44px] sm:min-h-0 py-2 sm:py-0"
        >
          <span>Shop all products</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {shown.map((product, index) => {
          const variant = isMosaic ? (index === 0 ? 'hero' : index >= 5 ? 'wide' : 'default') : 'default';
          return (
            <div key={product.id} className={isMosaic ? mosaicTileClass(index) : ''}>
              <ProductCard product={product} currency={currency} variant={variant} />
            </div>
          );
        })}
      </div>
    </section>
  );
};
