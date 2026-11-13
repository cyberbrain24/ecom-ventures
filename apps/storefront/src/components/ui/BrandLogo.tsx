import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface BrandLogoProps {
  name: string;
  logoUrl?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ name, logoUrl }) => {
  if (logoUrl) {
    return (
      <Link href="/" className="inline-block focus:outline-none">
        <Image
          src={logoUrl}
          alt={name}
          width={140}
          height={36}
          priority
          className="h-9 w-auto object-contain"
        />
      </Link>
    );
  }

  return (
    <Link href="/" className="inline-flex items-center space-x-2 focus:outline-none">
      <div className="h-9 w-9 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center text-white font-black text-lg shadow-sm">
        {name.charAt(0).toUpperCase()}
      </div>
      <span className="text-xl font-bold tracking-tight text-slate-900 font-[var(--brand-font-heading)]">
        {name}
      </span>
    </Link>
  );
};
