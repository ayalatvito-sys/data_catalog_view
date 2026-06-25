// Design tokens for the Data Profiling feature.
// Matched to the host app's existing design language (see DatasetCard):
// Google-Material-inspired palette, soft borders over heavy shadows,
// Heebo typography, and an accent edge that appears on hover.

export const profileTokens = {
  color: {
    ink: '#202124',        // primary text / headings (matches Google-grey-900 vibe)
    inkSoft: 'text.secondary', // secondary text / labels — inherit MUI theme
    inkFaint: 'text.disabled',
    surface: '#ffffff',    // card background
    canvas: '#f8f9fa',     // page background
    border: '#dadce0',     // hairline borders, same as DatasetCard
    accent: 'primary.main', // inherit theme primary instead of a hardcoded hex
    accentSoft: '#e8f0fe', // light tint of primary, Google-style chip background
    danger: '#d93025',
    dangerSoft: '#fce8e6',
    warning: '#e37400',
    warningSoft: '#fef7e0',
    healthy: '#188038',
    healthySoft: '#e6f4ea',
    track: '#f1f3f4',      // progress bar track
  },
  font: {
    ui: '"Heebo", "Roboto", "Arial", sans-serif',
  },
  radius: {
    card: 2, // MUI spacing-based radius, ~12px — matches DatasetCard's borderRadius: 2
  },
} as const;

// Returns a semantic color token for a null-percentage value.
// Drives the hover accent edge + label color consistently.
export const getNullnessTone = (percent: number) => {
  if (percent > 50) {
    return { main: profileTokens.color.danger, soft: profileTokens.color.dangerSoft, label: 'קריטי' };
  }
  if (percent > 10) {
    return { main: profileTokens.color.warning, soft: profileTokens.color.warningSoft, label: 'לתשומת לב' };
  }
  return { main: profileTokens.color.healthy, soft: profileTokens.color.healthySoft, label: 'תקין' };
};