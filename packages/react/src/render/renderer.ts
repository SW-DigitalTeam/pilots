import type { GestureId, RenderState, ShowConfig } from "@sw/arcade-engine";
import type { MouthShape } from "./mouth.js";

export interface RenderDims {
  width: number;
  height: number;
}

export interface RenderOptions {
  mouth: MouthShape;
  voiceAmp: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  radius: number;
  color: string;
}

let particles: Particle[] = [];
let stars: Array<{ x: number; y: number; radius: number; alpha: number; speed: number }> = [];
let starsInit = false;
let lastBeat = -1;
let beatFlash = 0;

function initStars(w: number, h: number) {
  if (starsInit) return;
  starsInit = true;
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      radius: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.3 + 0.1,
    });
  }
}

function spawnBurst(cx: number, cy: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 3 + 2;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0, maxLife: 30 + Math.random() * 20,
      radius: Math.random() * 4 + 2,
      color,
    });
  }
}

function updateParticles() {
  particles = particles.filter((p) => {
    p.life++;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy *= 0.94;
    return p.life < p.maxLife;
  });
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  dims: RenderDims,
  state: RenderState,
  show: ShowConfig,
  opts: RenderOptions,
): void {
  const { width: w, height: h } = dims;
  const p = show.palette;

  initStars(w, h);
  updateParticles();

  // Background
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, w, h);

  // Beat flash
  const currentBeat = Math.floor(state.beat);
  if (currentBeat !== lastBeat) {
    lastBeat = currentBeat;
    beatFlash = 1;
  }
  beatFlash *= 0.88;
  if (beatFlash > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${beatFlash * 0.04})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Starfield
  for (const star of stars) {
    star.y -= star.speed;
    if (star.y < -5) { star.y = h + 5; star.x = Math.random() * w; }
    ctx.save();
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBeatBar(ctx, dims, state, p.accent, show.music.beatsPerBar);

  // Active call with glow
  if (state.activeCall) {
    const g = state.activeCall.gesture;
    const cs = p.gesture[g];
    const cx = w * 0.5;
    const cy = h * 0.46;
    const beatsToWindow = state.activeCall.windowStartBeat - state.beat;
    const inWindow = state.beat >= state.activeCall.windowStartBeat;
    const size = Math.min(w, h) * (inWindow ? 0.34 : 0.26);

    // Glow
    ctx.save();
    ctx.shadowColor = cs.color;
    ctx.shadowBlur = inWindow ? 40 : 20;
    drawShape(ctx, cs.shape, cx, cy, size, cs.color, p.ink, inWindow ? 14 : 8);
    ctx.restore();

    if (!inWindow && beatsToWindow > 0) {
      drawCountdown(ctx, cx, cy, size * 1.25, beatsToWindow, show.modes.follow?.leadBars ?? 1, p.ink);
    }
    drawGestureGlyph(ctx, g, cx, cy + size * 1.5, p.ink);
  }

  // Recent fires as particle bursts
  const now = state.clockSeconds;
  for (const f of state.recentFires) {
    const age = now - f.atSeconds;
    if (age >= 0 && age < 0.5) {
      const cs = p.gesture[f.gesture];
      const fx = w * (0.2 + 0.6 * (((f.playerId % 4) + 0.5) / 4));
      const fy = h * 0.28;
      drawShape(ctx, cs.shape, fx, fy, Math.min(w, h) * 0.08, cs.color, p.ink, 8);
      if (age < 0.1) {
        spawnBurst(fx, fy, cs.color, 8);
      }
    }
  }

  // Character or pulse
  if (show.character) {
    drawCharacter(ctx, w * 0.5, h * 0.72, Math.min(w, h) * 0.16, show, opts);
  } else {
    drawPulseGlyph(ctx, w * 0.5, h * 0.72, Math.min(w, h) * 0.14, state, p);
  }

  drawParticles(ctx);
  drawHUD(ctx, dims, state, p);
}

function drawBeatBar(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h }: RenderDims,
  state: RenderState,
  accent: string,
  beatsPerBar: number,
): void {
  const beatInBar = ((state.beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  const cell = w / beatsPerBar;
  for (let i = 0; i < beatsPerBar; i++) {
    const active = Math.floor(beatInBar) === i;
    const barFrac = active ? beatInBar - Math.floor(beatInBar) : 0;
    const mh = active ? 28 : 10;
    const y = h - mh - 12;
    if (active) {
      // Glow fill
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    const r = 6;
    const x = i * cell + 16;
    const bw = active ? cell - 32 + barFrac * 4 : cell - 32;
    ctx.roundRect(x, y, bw, mh, r);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  stroke: string,
  lineWidth: number,
): void {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.beginPath();
  const r = size / 2;
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.roundRect(cx - r, cy - r, size, size, 12);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.7);
      ctx.lineTo(cx - r, cy + r * 0.7);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    case "chevron":
      ctx.moveTo(cx - r, cy + r * 0.3);
      ctx.lineTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.3);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.3);
      ctx.closePath();
      break;
    case "bar":
      ctx.roundRect(cx - r, cy - r * 0.4, size, r * 0.8, 8);
      break;
    case "cross":
      ctx.roundRect(cx - r * 0.25, cy - r, r * 0.5, size, 6);
      ctx.roundRect(cx - r, cy - r * 0.25, size, r * 0.5, 6);
      break;
    default:
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  beatsToWindow: number,
  leadBeats: number,
  ink: string,
): void {
  const frac = Math.max(0, Math.min(1, 1 - beatsToWindow / Math.max(1, leadBeats * 4)));
  ctx.save();
  ctx.lineWidth = 10;
  ctx.strokeStyle = ink;
  ctx.shadowColor = ink;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGestureGlyph(ctx: CanvasRenderingContext2D, g: GestureId, cx: number, cy: number, ink: string): void {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.shadowColor = ink;
  ctx.shadowBlur = 10;
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  const word: Record<GestureId, string> = { jump: "JUMP", sidestep: "STEP", duck: "DUCK", reach: "REACH" };
  ctx.fillText(word[g], cx, cy);
  ctx.restore();
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  show: ShowConfig,
  opts: RenderOptions,
): void {
  const c = show.character!;
  const bob = 1 + opts.voiceAmp * 0.08;
  const bx = cx - size * 0.55;
  const by = cy - size * bob;
  const bw = size * 1.1;
  const bh = size * 1.7 * bob;

  // Outer glow
  ctx.save();
  ctx.shadowColor = c.accentColor;
  ctx.shadowBlur = 25;
  ctx.fillStyle = c.bodyColor;
  ctx.strokeStyle = show.palette.ink;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 16);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Eyes
  const eyeY = by + bh * 0.28;
  const eyeSize = size * 0.12;
  ctx.fillStyle = show.palette.ink;
  ctx.beginPath();
  ctx.arc(cx - size * 0.18, eyeY, eyeSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + size * 0.18, eyeY, eyeSize, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - size * 0.15, eyeY - eyeSize * 0.3, eyeSize * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + size * 0.21, eyeY - eyeSize * 0.3, eyeSize * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.fillStyle = c.accentColor;
  const my = cy + size * 0.15;
  ctx.beginPath();
  if (opts.mouth === "closed") {
    ctx.roundRect(cx - size * 0.22, my, size * 0.44, 10, 5);
  } else if (opts.mouth === "mid") {
    ctx.ellipse(cx, my, size * 0.22, size * 0.12, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(cx, my, size * 0.28, size * 0.28, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  // Arms - stick out when speaking
  const armWave = opts.voiceAmp * size * 0.3;
  ctx.strokeStyle = c.bodyColor;
  ctx.lineWidth = size * 0.14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bx, by + bh * 0.35);
  ctx.lineTo(bx - size * 0.35 - armWave, by + bh * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.55, by + bh * 0.35);
  ctx.lineTo(cx + size * 0.55 + size * 0.35 + armWave, by + bh * 0.2);
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawPulseGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  state: RenderState,
  p: ShowConfig["palette"],
): void {
  const beatFrac = state.beat - Math.floor(state.beat);
  const pulse = beatFrac < 0.15 ? 1.3 : 1;
  ctx.save();
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = pulse > 1.1 ? 30 : 15;
  drawShape(ctx, "diamond", cx, cy, size * pulse, p.accent, p.ink, 14);
  ctx.restore();
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  { width: w }: RenderDims,
  state: RenderState,
  p: ShowConfig["palette"],
): void {
  // Score with glow
  ctx.save();
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 12;
  ctx.fillStyle = p.ink;
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(String(state.teamScore), 28, 76);
  ctx.shadowBlur = 0;

  // Player count
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`${state.playersTracked} player${state.playersTracked !== 1 ? "s" : ""}`, 28, 108);

  // Timer
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`${Math.round(state.activeSeconds)}s`, w - 28, 64);

  ctx.restore();
}
