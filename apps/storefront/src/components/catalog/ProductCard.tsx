import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicProductCard } from '../../types/catalog';
import { ShoppingBag, Award, Star } from 'lucide-react';

interface ProductCardProps {
  product: PublicProductCard;
  currency: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, currency }) => {
  const isSoldOut = product.is_sold_out || !product.in_stock;

  const formattedPrice = `${currency} ${product.base_price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const formattedComparePrice = product.compare_at_price
    ? `${currency} ${product.compare_at_price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : null;

  return (
    <div className="group relative flex flex-col bg-white border border-slate-100 rounded-[var(--brand-radius)] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Product Image & Badges */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
        <Link href={`/product/${product.slug}`} className="block h-full w-full">
          {product.featured_image_url ? (
            <Image
              src={product.featured_image_url}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover object-center group-hover:scale-105 transition-transform duration-300 ${
                isSoldOut ? 'grayscale-[30%] opacity-90' : ''
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <ShoppingBag className="h-12 w-12" />
            </div>
          )}
        </Link>

        {/* Badges Container */}
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex flex-col gap-1 z-10">
          {product.is_featured && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase shadow-xs flex items-center gap-1">
              <Star className="h-2.5 w-2.5 fill-white" />
              <span>Featured</span>
            </span>
          )}

          {product.has_discount && product.discount_percent && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] sm:text-[10px] font-bold tracking-wide uppercase shadow-xs">
              -{product.discount_percent}%
            </span>
          )}

          {isSoldOut && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-700 text-white text-[9px] sm:text-[10px] font-bold tracking-wide uppercase shadow-xs">
              Sold Out
            </span>
          )}
        </div>
      </div>

      {/* Product Metadata */}
      <div className="p-2.5 sm:p-4 flex flex-col flex-grow justify-between space-y-1.5">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
            {product.category_name && (
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {product.category_name}
              </span>
            )}
            {product.brand_name && (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-[var(--brand-primary)] bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full">
                <Award className="h-2.5 w-2.5" />
                <span className="truncate max-w-[80px] sm:max-w-none">{product.brand_name}</span>
              </span>
            )}
          </div>

          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 hover:text-[var(--brand-primary)] transition leading-snug">
            <Link href={`/product/${product.slug}`}>{product.title}</Link>
          </h3>

          {/* Honest Social Proof: Strictly rendered only if >= 1 approved reviews exist */}
          {Boolean(product.rating_count && product.rating_count > 0 && product.rating_average) && (
            <div className="flex items-center gap-1 mt-1">
              <div className="flex items-center text-amber-500">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 font-mono">
                {product.rating_average?.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({product.rating_count})
              </span>
            </div>
          )}
        </div>

        <div className="pt-1.5 flex items-baseline space-x-1.5 sm:space-x-2">
          <span className="text-sm sm:text-base font-bold text-slate-950 font-mono">
            {formattedPrice}
          </span>
          {formattedComparePrice && (
            <span className="text-[11px] sm:text-xs text-slate-400 line-through font-mono">
              {formattedComparePrice}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
