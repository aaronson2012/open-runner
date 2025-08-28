import { createNoise2D } from 'simplex-noise';

export type HeightFunction = (x: number, z: number) => number;

export interface HeightOptions {
  baseFrequency: number; // world units per cycle inverse (e.g., 1/200 => 200-unit wavelength)
  octaves: number;
  persistence: number;
  lacunarity: number;
  amplitude: number; // overall height scale
}

const defaultOptions: HeightOptions = {
  baseFrequency: 1 / 200,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  amplitude: 12,
};

export function createHeightFunction(options?: Partial<HeightOptions>): HeightFunction {
  const opts: HeightOptions = { ...defaultOptions, ...options };
  const noise2D = createNoise2D();

  return (x: number, z: number): number => {
    // Fractal Brownian Motion (fBm) over simplex noise for smooth rolling hills
    let frequency = opts.baseFrequency;
    let amplitude = 1.0;
    let sum = 0.0;
    let max = 0.0;

    for (let octave = 0; octave < opts.octaves; octave++) {
      const n = noise2D(x * frequency, z * frequency); // [-1, 1]
      sum += n * amplitude;
      max += amplitude;
      amplitude *= opts.persistence;
      frequency *= opts.lacunarity;
    }

    const normalized = sum / (max || 1); // [-1, 1]
    // Slight bias to keep terrain mostly above 0
    const elevated = normalized * 0.5 + 0.5; // [0, 1]
    return elevated * opts.amplitude;
  };
}


