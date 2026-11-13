import React from 'react';
import { ThemeCustomConfig } from '../../types/storefront';

interface ThemeInjectorProps {
  themeConfig: ThemeCustomConfig;
}

/**
 * ThemeInjector generates inline CSS custom properties based on dynamic backend theme overrides.
 * This allows all shared storefront components to immediately inherit store-specific colors,
 * border radiuses, and font families without rebuilding frontend bundles.
 */
export const ThemeInjector: React.FC<ThemeInjectorProps> = ({ themeConfig }) => {
  const cfg = themeConfig || ({} as Partial<ThemeCustomConfig>);
  const primaryColor = cfg.primary_color || '#0f766e'; // Default Teal
  const secondaryColor = cfg.secondary_color || '#0284c7'; // Default Sky
  const headingFont = cfg.heading_font || 'Inter';
  const bodyFont = cfg.body_font || 'Inter';

  // Radius mappings
  const radiusMap: Record<string, string> = {
    none: '0px',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  };
  const borderRadius = radiusMap[cfg.border_radius || 'md'] || '0.5rem';

  const cssVariables = `
    :root {
      --brand-primary: ${primaryColor};
      --brand-secondary: ${secondaryColor};
      --brand-font-heading: "${headingFont}", sans-serif;
      --brand-font-body: "${bodyFont}", sans-serif;
      --brand-radius: ${borderRadius};
    }
  `;

  return (
    <>
      {/* Dynamic Google Fonts Link */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
          headingFont
        )}:wght@400;600;700;800&family=${encodeURIComponent(
          bodyFont
        )}:wght@300;400;500;600;700&display=swap`}
        rel="stylesheet"
      />
      {/* Root Theme Style Variables */}
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
    </>
  );
};
