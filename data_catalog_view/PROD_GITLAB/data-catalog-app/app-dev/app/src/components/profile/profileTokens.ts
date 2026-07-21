// Design tokens for the Data Profiling feature.
// Mirrors the host app's design language exactly (theme.ts + DatasetCard):
//   – Google-Material-inspired palette (#1a73e8 primary, #202124 ink, #dadce0 borders)
//   – soft border-over-shadow pattern
//   – Heebo typography, borderRadius: 8 (MUI shape.borderRadius)
//   – RTL-first (logical CSS properties throughout)

export const profileTokens = {
  color: {
    ink: '#202124',           // primary text / headings (theme.palette.text.primary)
    inkSoft: 'text.secondary', // secondary text — resolved by MUI theme
    inkFaint: 'text.disabled',
    surface: '#ffffff',        // card background (theme.palette.background.paper)
    canvas: '#f8f9fa',         // page background (theme.palette.background.default)
    border: '#dadce0',         // hairline borders (same as DatasetCard, StatsBar)
    accent: 'primary.main',    // inherits theme primary (#1a73e8)
    accentSoft: '#e8f0fe',     // light primary tint — Google-style hover/chip bg
    danger: '#d93025',         // critical nullness
    dangerSoft: '#fce8e6',
    warning: '#e37400',        // moderate nullness
    warningSoft: '#fef7e0',
    healthy: '#188038',        // low nullness (good)
    healthySoft: '#e6f4ea',
    track: '#f1f3f4',          // progress-bar track
  },
  font: {
    ui: '"Heebo", "Roboto", "Arial", sans-serif',
    mono: '"Roboto Mono", "IBM Plex Mono", monospace',
  },
  radius: {
    card: 2, // MUI spacing units → 16px (matches DatasetCard borderRadius: 2)
  },
  shadow: {
    // Exactly the hover shadow used by DatasetCard and MuiCard theme override
    card: '0 4px 6px rgba(32,33,36,0.1)',
  },
} as const;

/** Returns a semantic color token based on the null percentage of a column. */
export const getNullnessTone = (percent: number) => {
  if (percent > 50) {
    return {
      main: profileTokens.color.danger,
      soft: profileTokens.color.dangerSoft,
      label: 'קריטי',
    };
  }
  if (percent > 10) {
    return {
      main: profileTokens.color.warning,
      soft: profileTokens.color.warningSoft,
      label: 'לתשומת לב',
    };
  }
  return {
    main: profileTokens.color.healthy,
    soft: profileTokens.color.healthySoft,
    label: 'תקין',
  };
};
