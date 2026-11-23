import React from 'react';
import { buildFontsUrl, buildThemeCss, ThemeConfig } from '../../lib/theme';

interface ThemeInjectorProps {
  /** Resolved, validated theme configuration for the request's store. */
  theme: ThemeConfig;
  /** Fields whose stored value was invalid. Each one is logged with console.error on every render. */
  invalidFields?: readonly string[];
}

/**
 * ThemeInjector loads the theme's Google Fonts and writes the :root custom properties for colours,
 * fonts, radius and density. Values are validated by resolveTheme before they reach this component.
 * Invalid stored values fall back to the variant default and are reported here, and rendering continues.
 * The variant-specific layout and decoration live in globals.css under [data-theme] selectors.
 */
export const ThemeInjector: React.FC<ThemeInjectorProps> = ({ theme, invalidFields = [] }) => {
  for (const field of invalidFields) {
    console.error(
      `[storefront theme] Invalid theme value for "${field}". The variant default is used instead.`,
    );
  }
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={buildFontsUrl(theme.fonts)} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: buildThemeCss(theme) }} />
    </>
  );
};
