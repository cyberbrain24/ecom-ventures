import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PublicProductCard } from '../../types/catalog';
import { ShoppingBag, Award, Star } from 'lucide-react';
import { WishlistButton } from './WishlistButton';

interface ProductCardProps {
  product: PublicProductCard;
  currency: string;
  /**
   * Shape of the image area. "default" is square. "hero" fills the height of a tile that spans two rows,
   * and "wide" is a landscape image for a tile that spans two columns; both only change from the square
   * shape on medium screens and wider.
   */
  variant?: 'default' | 'hero' | 'wide';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, currency, variant = 'default' }) => {
  const isSoldOut = product.is_sold_out || !product.in_stock;
  const imageShape =
    variant === 'hero'
      ? 'aspect-[4/3] md:aspect-auto md:flex-1 md:min-h-[320px]'
      : variant === 'wide'
        ? 'aspect-square md:aspect-[2/1]'
        : 'aspect-square';

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
    <div className="sf-card group relative flex h-full flex-col overflow-hidden">
      {/* Product Image & Badges */}
      <div className={`sf-card-media relative w-full overflow-hidden ${imageShape}`}>
        <Link href={`/product/${product.slug}`} className="block h-full w-full">
          {product.featured_image_url ? (
            <Image
              src={product.featured_image_url}
              alt={product.title}
              fill
              sizes={variant === 'default' ? '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw' : '(max-width: 768px) 100vw, 50vw'}
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

        {/* Wishlist Action Button */}
        <WishlistButton
          item={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            price: product.base_price,
            featured_image_url: product.featured_image_url,
            category_name: product.category_name,
            brand_name: product.brand_name,
          }}
          className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10"
        />
      </div>

      {/* Product Metadata */}
      <div className="sf-card-body flex flex-col flex-grow justify-between space-y-1.5">
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

          <h3 className="sf-card-title text-xs sm:text-sm font-semibold line-clamp-2 transition leading-snug">
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

        <div className="pt-1.5 flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 sm:space-x-2">
          <span className="sf-card-price text-sm sm:text-base font-bold font-mono">
            {formattedPrice}
          </span>
          {formattedComparePrice && (
            <span className="sf-card-compare text-[11px] sm:text-xs line-through font-mono">
              {formattedComparePrice}
            </span>
          )}
        </div>

        {/* Quick view: a link to the product page, where the shopper chooses options and adds to cart */}
        <div className="sf-card-actions">
          <Link href={`/product/${product.slug}`} className="sf-quick">
            <span>Quick view</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
