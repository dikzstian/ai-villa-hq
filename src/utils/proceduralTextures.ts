import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function makeTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 1;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

export function getWoodFloorTexture(repeatX = 8, repeatY = 8): THREE.CanvasTexture {
  return makeTexture(
    `wood_${repeatX}_${repeatY}`,
    512,
    512,
    (ctx, w, h) => {
      // Rich warm walnut base
      const base = ctx.createLinearGradient(0, 0, w, h);
      base.addColorStop(0, '#5a3a22');
      base.addColorStop(0.3, '#6b4830');
      base.addColorStop(0.6, '#5e3f28');
      base.addColorStop(1, '#6f4e35');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      const planks = 10;
      const plankH = h / planks;
      const tones = [
        '#7a5638', '#6b462c', '#845e3f', '#73503a', '#8a6545',
        '#6e4b32', '#7f5a3e', '#694228', '#85613d', '#775438',
      ];

      for (let row = 0; row < planks; row++) {
        const y = row * plankH;
        const offset = (row % 2) * (w * 0.5) + ((row % 3) * w * 0.12);
        for (let col = -1; col < 3; col++) {
          const x = col * (w * 0.5) + offset;
          ctx.fillStyle = tones[(row * 3 + col + 5) % tones.length];
          ctx.fillRect(x + 1, y + 1.5, w * 0.5 - 2, plankH - 3);

          // Rich wood grain with multiple passes
          for (let pass = 0; pass < 3; pass++) {
            ctx.strokeStyle = `rgba(35, 18, 8, ${0.08 + pass * 0.04})`;
            ctx.lineWidth = 1 + pass * 0.5;
            for (let g = 0; g < 8; g++) {
              const gy = y + 5 + g * (plankH / 8.5) + pass * 1.2;
              const wobble = Math.sin((g + row) * 1.7) * 2.5;
              ctx.beginPath();
              ctx.moveTo(x + 2, gy);
              ctx.bezierCurveTo(
                x + w * 0.12, gy + wobble + 1.5,
                x + w * 0.25, gy - wobble - 1,
                x + w * 0.38, gy + wobble * 0.7
              );
              ctx.bezierCurveTo(
                x + w * 0.42, gy - wobble * 0.5,
                x + w * 0.48, gy + wobble * 0.3,
                x + w * 0.5 - 2, gy
              );
              ctx.stroke();
            }
          }

          // Subtle wood knots
          if ((row * 7 + col * 13) % 11 === 0) {
            const kx = x + w * 0.15 + ((row * 31) % (w * 0.2));
            const ky = y + plankH * 0.4;
            ctx.strokeStyle = 'rgba(50, 28, 12, 0.2)';
            ctx.lineWidth = 1;
            for (let r = 2; r < 7; r++) {
              ctx.beginPath();
              ctx.ellipse(kx, ky, r * 1.5, r, (row * 0.4), 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        // Plank gap — dark grout line
        ctx.fillStyle = 'rgba(22, 12, 4, 0.65)';
        ctx.fillRect(0, y, w, 1.5);
        // Subtle highlight below gap
        ctx.fillStyle = 'rgba(140, 100, 60, 0.12)';
        ctx.fillRect(0, y + 1.5, w, 1);
      }

      // Subtle wear/patina overlay
      ctx.fillStyle = 'rgba(180, 140, 90, 0.04)';
      for (let i = 0; i < 400; i++) {
        const rx = (i * 97) % w;
        const ry = (i * 163) % h;
        ctx.fillRect(rx, ry, 3, 2);
      }
    },
    repeatX,
    repeatY
  );
}

export function getDeckTimberTexture(repeatX = 10, repeatY = 3): THREE.CanvasTexture {
  return makeTexture(
    `deck_${repeatX}_${repeatY}`,
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#7a4e2d';
      ctx.fillRect(0, 0, w, h);
      const slats = 10;
      const sh = h / slats;
      for (let i = 0; i < slats; i++) {
        const grad = ctx.createLinearGradient(0, i * sh, 0, i * sh + sh);
        grad.addColorStop(0, i % 2 === 0 ? '#8b6340' : '#7d5535');
        grad.addColorStop(0.5, i % 2 === 0 ? '#956c48' : '#885d3c');
        grad.addColorStop(1, i % 2 === 0 ? '#8b6340' : '#7d5535');
        ctx.fillStyle = grad;
        ctx.fillRect(0, i * sh + 2, w, sh - 3);

        // Wood grain on each slat
        ctx.strokeStyle = 'rgba(40, 22, 10, 0.1)';
        ctx.lineWidth = 0.8;
        for (let g = 0; g < 4; g++) {
          const gy = i * sh + 4 + g * (sh / 5);
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(w * 0.3, gy + 1.5, w * 0.7, gy - 1, w, gy + 0.5);
          ctx.stroke();
        }

        // Gap
        ctx.fillStyle = 'rgba(30, 15, 5, 0.7)';
        ctx.fillRect(0, i * sh, w, 2);
      }
    },
    repeatX,
    repeatY
  );
}

export function getMarbleTileTexture(repeatX = 4, repeatY = 4): THREE.CanvasTexture {
  return makeTexture(
    `marble_${repeatX}_${repeatY}`,
    512,
    512,
    (ctx, w, h) => {
      // Warm cream marble base
      const base = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      base.addColorStop(0, '#f0ece4');
      base.addColorStop(0.5, '#e8e2d8');
      base.addColorStop(1, '#e5dfd5');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      // Multiple layers of veining for depth
      for (let layer = 0; layer < 3; layer++) {
        ctx.strokeStyle = `rgba(${148 - layer * 20}, ${138 - layer * 15}, ${125 - layer * 10}, ${0.12 + layer * 0.06})`;
        ctx.lineWidth = 2.5 - layer * 0.5;
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          const sx = ((i * 47 + layer * 97) % w);
          const sy = ((i * 31 + layer * 53) % h);
          ctx.moveTo(sx, sy);
          for (let s = 0; s < 4; s++) {
            ctx.bezierCurveTo(
              ((sx + (s + 1) * 120 + layer * 50) % w),
              ((sy + s * 80 + layer * 30) % h),
              ((sx + (s + 2) * 90 + layer * 70) % w),
              ((sy + (s + 1) * 110 + layer * 40) % h),
              ((sx + (s + 3) * 70 + layer * 30) % w),
              ((sy + (s + 2) * 100 + layer * 60) % h)
            );
          }
          ctx.stroke();
        }
      }

      // Subtle warm speckles
      for (let i = 0; i < 600; i++) {
        const sx = (i * 97) % w;
        const sy = (i * 163) % h;
        ctx.fillStyle = `rgba(${175 + (i % 30)}, ${165 + (i % 25)}, ${150 + (i % 20)}, ${0.08 + (i % 5) * 0.02})`;
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Tile grid grout (refined)
      const step = w / 2;
      ctx.strokeStyle = 'rgba(170, 162, 152, 0.45)';
      ctx.lineWidth = 2.5;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Inner bevel highlight
      ctx.strokeStyle = 'rgba(255, 252, 248, 0.15)';
      ctx.lineWidth = 1;
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 2, 0);
        ctx.lineTo(x + 2, h);
        ctx.stroke();
      }
    },
    repeatX,
    repeatY
  );
}

export function getGrassTerrainTexture(repeatX = 28, repeatY = 28): THREE.CanvasTexture {
  return makeTexture(
    `grass_${repeatX}_${repeatY}`,
    256,
    256,
    (ctx, w, h) => {
      // Rich gradient base
      const base = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      base.addColorStop(0, '#2d6e25');
      base.addColorStop(0.5, '#286020');
      base.addColorStop(1, '#1f5018');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      // Grass blade clusters
      const greens = ['#3a7e30', '#2d6825', '#458a3c', '#347228', '#4d9442', '#275a1e'];
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = greens[i % greens.length];
        const rx = (i * 73 + (i * i) % 127) % w;
        const ry = (i * 137 + (i * i * 3) % 211) % h;
        const bw = 2 + (i % 3);
        const bh = 4 + (i % 5);
        ctx.fillRect(rx, ry, bw, bh);
      }

      // Subtle shadow patches
      ctx.fillStyle = 'rgba(15, 40, 10, 0.08)';
      for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.ellipse((i * 131) % w, (i * 179) % h, 12 + i % 8, 8 + i % 5, i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    repeatX,
    repeatY
  );
}

export function getPoolWaterTexture(repeatX = 6, repeatY = 2): THREE.CanvasTexture {
  return makeTexture(
    `pool_${repeatX}_${repeatY}`,
    256,
    256,
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      grad.addColorStop(0, '#22b8cf');
      grad.addColorStop(0.4, '#0ea5e9');
      grad.addColorStop(0.7, '#0284c7');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Realistic caustic network
      ctx.strokeStyle = 'rgba(200, 240, 255, 0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 35; i++) {
        ctx.beginPath();
        const cx = (i * 59) % w;
        const cy = (i * 83) % h;
        const r = 12 + (i % 6) * 5;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bright caustic highlights
      ctx.fillStyle = 'rgba(224, 250, 255, 0.15)';
      for (let i = 0; i < 80; i++) {
        const cx = (i * 41 + 17) % w;
        const cy = (i * 67 + 23) % h;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 3 + i % 4, 2 + i % 3, i * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    repeatX,
    repeatY
  );
}

export function getAnalyticsScreenTexture(): THREE.CanvasTexture {
  return makeTexture('screen_analytics', 512, 256, (ctx, w, h) => {
    // Dark glass-like background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0c1222');
    bg.addColorStop(1, '#111827');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Top status bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(16, 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(28, 8, 80, 8);

    // KPI Cards with glow
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];
    for (let i = 0; i < 4; i++) {
      const cx = 16 + i * 124;
      ctx.fillStyle = '#1a2332';
      ctx.beginPath();
      ctx.roundRect(cx, 36, 114, 48, 6);
      ctx.fill();

      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.roundRect(cx + 8, 42, 24, 4, 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx + 8, 54, 60, 6);
      ctx.fillStyle = colors[i] + '40';
      ctx.fillRect(cx + 8, 68, 90, 8);
      ctx.fillStyle = colors[i];
      ctx.fillRect(cx + 8, 68, 50 + (i * 11) % 40, 8);
    }

    // Bar Chart
    ctx.fillStyle = '#1a2332';
    ctx.beginPath();
    ctx.roundRect(16, 98, 290, 146, 6);
    ctx.fill();
    for (let b = 0; b < 10; b++) {
      const bh = 20 + ((b * 19) % 80);
      const bx = 32 + b * 26;
      ctx.fillStyle = b % 2 === 0 ? '#38bdf8' : '#818cf8';
      ctx.beginPath();
      ctx.roundRect(bx, 232 - bh, 16, bh, 3);
      ctx.fill();
    }

    // Donut chart
    ctx.fillStyle = '#1a2332';
    ctx.beginPath();
    ctx.roundRect(320, 98, 176, 146, 6);
    ctx.fill();
    const donutColors = ['#10b981', '#6366f1', '#f59e0b', '#64748b'];
    let startAngle = -Math.PI / 2;
    const arcs = [0.35, 0.28, 0.22, 0.15];
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = donutColors[i];
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(408, 175, 38, startAngle, startAngle + arcs[i] * Math.PI * 2);
      ctx.stroke();
      startAngle += arcs[i] * Math.PI * 2;
    }
  });
}

export function getGameScreenTexture(): THREE.CanvasTexture {
  return makeTexture('screen_game', 512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a0533');
    grad.addColorStop(0.4, '#311068');
    grad.addColorStop(0.55, '#be185d');
    grad.addColorStop(0.6, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Glowing retro sun
    const sunGrad = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, 45);
    sunGrad.addColorStop(0, '#fde68a');
    sunGrad.addColorStop(0.5, '#facc15');
    sunGrad.addColorStop(0.8, '#fb923c');
    sunGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 42, 0, Math.PI * 2);
    ctx.fill();

    // Horizon line glow
    ctx.fillStyle = 'rgba(236, 72, 153, 0.3)';
    ctx.fillRect(0, h * 0.54, w, 4);

    // Perspective grid
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 6, h * 0.56);
      ctx.lineTo(w / 2 + i * 45, h);
      ctx.stroke();
    }
    for (let y = h * 0.56; y < h; y += 9) {
      ctx.globalAlpha = 0.3 + (y / h) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

// Warm fabric / carpet texture for cozy rugs
export function getCarpetTexture(
  baseColor = '#3b2a5c',
  repeatX = 4,
  repeatY = 4
): THREE.CanvasTexture {
  return makeTexture(
    `carpet_${baseColor}_${repeatX}_${repeatY}`,
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);

      // Woven fabric pattern
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
          const bright = ((x + y) % 6 < 3) ? 15 : -10;
          ctx.fillStyle = `rgba(${128 + bright}, ${128 + bright}, ${128 + bright}, 0.06)`;
          ctx.fillRect(x, y, 2, 2);
        }
      }

      // Soft noise for texture
      for (let i = 0; i < 3000; i++) {
        const rx = (i * 67 + (i * i) % 101) % w;
        const ry = (i * 139 + (i * i * 3) % 173) % h;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + (i % 5) * 0.008})`;
        ctx.fillRect(rx, ry, 1, 1);
      }
    },
    repeatX,
    repeatY
  );
}
