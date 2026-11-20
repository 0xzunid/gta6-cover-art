// Colour grades for Vice City Nights. Each preset is data only: a canvas filter
// applied while the photo is drawn, plus tint overlays painted over the panel.
// No randomness anywhere — the same grade always renders the same pixels.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    // Warm golden-hour wash: a little extra saturation, then orange over pink.
    filter: 'saturate(1.25) contrast(1.06) brightness(1.03)',
    overlays: [
      { kind: 'linear', from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,154,60,0.20)'], [1, 'rgba(255,46,136,0.26)']], blend: 'overlay' },
      { kind: 'linear', from: [0, 0], to: [1, 0], stops: [[0, 'rgba(255,190,80,0.10)'], [1, 'rgba(255,120,40,0.10)']], blend: 'soft-light' },
    ],
    vignette: 0.28,
  },
  neon: {
    label: 'Neon Nights',
    // Hot night-club grade: cyan shadows, magenta highlights, pushed saturation.
    filter: 'saturate(1.55) contrast(1.12) brightness(0.98)',
    overlays: [
      { kind: 'linear', from: [0, 0], to: [1, 1], stops: [[0, 'rgba(46,230,214,0.28)'], [0.55, 'rgba(123,47,255,0.18)'], [1, 'rgba(255,46,136,0.30)']], blend: 'overlay' },
      { kind: 'linear', from: [0, 1], to: [0, 0], stops: [[0, 'rgba(20,10,60,0.22)'], [1, 'rgba(0,0,0,0)']], blend: 'multiply' },
    ],
    vignette: 0.34,
  },
  pink: {
    label: 'Vice Pink',
    // Bubblegum poster pink fading into violet.
    filter: 'saturate(1.35) contrast(1.05) brightness(1.04)',
    overlays: [
      { kind: 'linear', from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,93,162,0.30)'], [1, 'rgba(123,47,255,0.30)']], blend: 'overlay' },
      { kind: 'linear', from: [0, 0], to: [1, 0], stops: [[0, 'rgba(255,120,190,0.12)'], [1, 'rgba(140,60,255,0.12)']], blend: 'soft-light' },
    ],
    vignette: 0.26,
  },
  noir: {
    label: 'Noir',
    // Black-and-white crime-poster grade: hard contrast, deep vignette.
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    overlays: [
      { kind: 'linear', from: [0, 0], to: [0, 1], stops: [[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(0,0,0,0.18)']], blend: 'overlay' },
    ],
    vignette: 0.46,
  },
};

export const GRADE_NAMES = Object.keys(GRADES);

/** The export sizes the app offers, in pixels. */
export const SIZES = {
  square: { label: '1080 × 1080', width: 1080, height: 1080 },
  portrait: { label: '1080 × 1350', width: 1080, height: 1350 },
  landscape: { label: '1920 × 1080', width: 1920, height: 1080 },
};

export const SIZE_NAMES = Object.keys(SIZES);
