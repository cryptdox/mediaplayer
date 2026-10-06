import { useEffect, useRef } from 'react';
import type { Particle } from '../lib/music';

type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; spin: number; glyph: string };

const NOTE_GLYPHS = ['♪', '♫', '♩', '♬'];

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Canvas particles behind the player. `kind` picks the effect (from the
 * song's genre), `color` tints it, and `level()` (0..1 loudness) drives speed
 * and size, so it moves with the music. Paused → it drifts slowly.
 */
export const Particles = ({ kind, color, playing, level, className = '' }: {
  kind: Particle;
  color: string;
  playing: boolean;
  level: () => number;
  className?: string;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Latest props for the animation loop, without restarting it.
  const state = useRef({ kind, color, playing, level });
  useEffect(() => { state.current = { kind, color, playing, level }; }, [kind, color, playing, level]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, t = 0, smooth = 0;
    let parts: P[] = [];
    let lastKind = '';

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = el.clientWidth; h = el.clientHeight;
      el.width = w * dpr; el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const spawn = (k: Particle, anywhere: boolean): P => {
      const p: P = { x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, r: 2, life: Math.random(), spin: Math.random() * Math.PI * 2, glyph: NOTE_GLYPHS[Math.floor(Math.random() * 4)] };
      switch (k) {
        case 'sparks': p.vx = (Math.random() - 0.5) * 1.6; p.vy = -1 - Math.random() * 2.5; p.r = 1 + Math.random() * 1.8; if (!anywhere) p.y = h + 4; break;
        case 'embers': p.vx = (Math.random() - 0.5) * 0.6; p.vy = -0.4 - Math.random() * 1.2; p.r = 1.5 + Math.random() * 2.5; if (!anywhere) p.y = h + 4; break;
        case 'bubbles': p.vx = 0; p.vy = -0.3 - Math.random() * 0.9; p.r = 3 + Math.random() * 9; if (!anywhere) p.y = h + 12; break;
        case 'notes': p.vx = (Math.random() - 0.5) * 0.4; p.vy = -0.4 - Math.random() * 0.8; p.r = 12 + Math.random() * 12; if (!anywhere) p.y = h + 20; break;
        case 'snow': p.vx = (Math.random() - 0.5) * 0.4; p.vy = 0.3 + Math.random() * 0.8; p.r = 1 + Math.random() * 2.5; if (!anywhere) p.y = -4; break;
        case 'petals': p.vx = 0.2 + Math.random() * 0.6; p.vy = 0.4 + Math.random() * 0.8; p.r = 3 + Math.random() * 4; if (!anywhere) p.y = -8; break;
        case 'stars': p.r = 0.6 + Math.random() * 1.8; break;
        case 'waves': break;
      }
      return p;
    };

    const draw = () => {
      const { kind: k, color: c, playing: on, level: lv } = state.current;
      const [r, g, b] = hexToRgb(c);
      const target = on ? Math.min(1, lv() * 2.2 + 0.15) : 0.08;
      smooth += (target - smooth) * 0.12;
      const speed = 0.25 + smooth * 2.6;
      t += 0.016 * speed;

      if (k !== lastKind) { lastKind = k; parts = Array.from({ length: reduced ? 18 : k === 'stars' ? 110 : 70 }, () => spawn(k, true)); }
      ctx.clearRect(0, 0, w, h);

      if (k === 'waves') {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          const amp = (10 + i * 6) * (0.4 + smooth * 1.8);
          for (let x = 0; x <= w; x += 6) {
            const y = h * (0.35 + i * 0.12) + Math.sin(x * 0.012 + t * (1.4 + i * 0.3) + i) * amp;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.18 + 0.12 * (3 - i) / 3 + smooth * 0.25})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          p.life += 0.004 * speed;
          if (k === 'stars') {
            const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + p.spin));
            ctx.fillStyle = `rgba(${r},${g},${b},${tw * (0.35 + smooth * 0.65)})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + smooth * 1.4), 0, Math.PI * 2); ctx.fill();
            continue;
          }
          const wobble = k === 'bubbles' || k === 'snow' || k === 'petals' ? Math.sin(t * 2 + p.spin) * 0.6 : 0;
          p.x += (p.vx + wobble) * speed;
          p.y += p.vy * speed;
          p.spin += 0.02 * speed;
          const out = p.y < -30 || p.y > h + 30 || p.x < -30 || p.x > w + 30;
          if (out) { parts[i] = spawn(k, false); continue; }
          const size = p.r * (1 + smooth * 0.9);
          const fade = k === 'sparks' || k === 'embers' ? Math.max(0, 1 - (h - p.y) / h) * 0.6 + 0.25 : 0.6;
          ctx.save();
          if (k === 'embers' || k === 'sparks') {
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
            grad.addColorStop(0, `rgba(${r},${g},${b},${fade})`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2); ctx.fill();
          } else if (k === 'bubbles') {
            ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.stroke();
          } else if (k === 'petals') {
            ctx.translate(p.x, p.y); ctx.rotate(p.spin);
            ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
            ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          } else if (k === 'notes') {
            ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + smooth * 0.4})`;
            ctx.font = `${size}px serif`;
            ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.spin) * 0.3);
            ctx.fillText(p.glyph, 0, 0);
          } else {
            ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
            ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={canvas} className={`pointer-events-none ${className}`} aria-hidden="true" />;
};
