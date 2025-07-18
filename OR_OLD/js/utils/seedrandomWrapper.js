// Simple wrapper for seedrandom alea algorithm
// Simplified implementation based on seedrandom/alea

function mash() {
    let n = 0xefc8249d;
    return function(data) {
        data = String(data);
        for (let i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            let h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000; // 2^32
        }
        return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };
}

function alea(seed) {
    const mashInstance = mash();
    
    let s0 = mashInstance(' ');
    let s1 = mashInstance(' ');
    let s2 = mashInstance(' ');
    let c = 1;
    
    if (seed) {
        s0 -= mashInstance(seed);
        if (s0 < 0) s0 += 1;
        s1 -= mashInstance(seed);
        if (s1 < 0) s1 += 1;
        s2 -= mashInstance(seed);
        if (s2 < 0) s2 += 1;
    }
    
    return function() {
        const t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
        s0 = s1;
        s1 = s2;
        s2 = t - (c = t | 0);
        return s2;
    };
}

export const prng_alea = alea;