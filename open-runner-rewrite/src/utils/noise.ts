// Simple 2D Perlin noise implementation for terrain generation
class PerlinNoise {
  private permutation: number[];

  constructor(seed = 12345) {
    // Generate permutation table based on seed
    this.permutation = this.generatePermutation(seed);
  }

  private generatePermutation(seed: number): number[] {
    const p = [];
    
    // Simple PRNG based on seed
    let random = seed;
    const rng = () => {
      random = (random * 9301 + 49297) % 233280;
      return random / 233280;
    };

    // Generate base permutation
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using seeded random
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for easy access
    for (let i = 0; i < 256; i++) {
      p[256 + i] = p[i];
    }

    return p;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const A = this.permutation[X] + Y;
    const AA = this.permutation[A];
    const AB = this.permutation[A + 1];
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B];
    const BB = this.permutation[B + 1];

    return this.lerp(
      this.lerp(
        this.grad(this.permutation[AA], x, y),
        this.grad(this.permutation[BA], x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.permutation[AB], x, y - 1),
        this.grad(this.permutation[BB], x - 1, y - 1),
        u
      ),
      v
    );
  }
}

// Export a default instance
export const noise = new PerlinNoise();

// Also export the class for custom instances
export { PerlinNoise };