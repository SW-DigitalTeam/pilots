import type { GestureId, RenderState, ShowConfig } from "@sw/arcade-engine";
import type { MouthShape } from "./mouth.js";

export interface RenderDims {
  width: number;
  height: number;
}

export interface RenderOptions {
  mouth: MouthShape;
  voiceAmp: number;
  /** Optional AI-generated background art; darkened so gameplay pops. */
  backgroundImage?: HTMLImageElement | null;
}

// ── Stage environment ──────────────────────────────────────────────
const STAGE_CENTER_X = 0.5;
const STAGE_FLOOR_Y = 0.75; // fraction of height
const GRID_LINES = 12;

interface Orb {
  x: number; y: number; radius: number;
  speed: number; phase: number;
  color: string;
}
let orbs: Orb[] = [];
let orbsInit = false;

function initOrbs(w: number, h: number, accent: string) {
  if (orbsInit) return;
  orbsInit = true;
  const colors = [accent, "#ffd700", "#ff6b6b", "#4ecdc4", "#95e1d3"];
  for (let i = 0; i < 20; i++) {
    orbs.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.6,
      radius: Math.random() * 12 + 4,
      speed: Math.random() * 0.4 + 0.15,
      phase: Math.random() * Math.PI * 2,
      color: colors[i % colors.length]!,
    });
  }
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  radius: number;
  color: string;
}
let particles: Particle[] = [];

function spawnBurst(cx: number, cy: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = Math.random() * 4 + 2;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 0, maxLife: 40 + Math.random() * 25,
      radius: Math.random() * 5 + 2,
      color,
    });
  }
}

function updateParticles() {
  particles = particles.filter((p) => {
    p.life++;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12; // gravity
    p.vx *= 0.96;
    return p.life < p.maxLife;
  });
}

let lastBeat = -1;
let beatFlash = 0;
let danceCycle = 0;

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  dims: RenderDims,
  state: RenderState,
  show: ShowConfig,
  opts: RenderOptions,
): void {
  const { width: w, height: h } = dims;
  const p = show.palette;

  initOrbs(w, h, p.accent);
  updateParticles();

  const currentBeat = Math.floor(state.beat);
  if (currentBeat !== lastBeat) {
    lastBeat = currentBeat;
    beatFlash = 1;
  }
  beatFlash *= 0.9;
  danceCycle = state.beat % 1;

  drawBackground(ctx, dims, p, state, beatFlash, opts.backgroundImage ?? null);
  drawStageFloor(ctx, dims, p);
  drawOrbs(ctx, dims, beatFlash);
  drawBeatBar(ctx, dims, state, p.accent, show.music.beatsPerBar);

  // Active gesture call with 3D-ish glow
  if (state.activeCall) {
    const g = state.activeCall.gesture;
    const cs = p.gesture[g];
    const cx = w * 0.5;
    const cy = h * 0.42;
    const inWindow = state.beat >= state.activeCall.windowStartBeat;
    const size = Math.min(w, h) * (inWindow ? 0.32 : 0.24);

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.55, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glow behind shape
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = cs.color;
    ctx.shadowColor = cs.color;
    ctx.shadowBlur = 60;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawShape(ctx, cs.shape, cx, cy, size, cs.color, p.ink, inWindow ? 14 : 10);

    if (!inWindow) {
      const beatsToWindow = state.activeCall.windowStartBeat - state.beat;
      drawCountdown(ctx, cx, cy, size * 1.3, beatsToWindow, show.modes.follow?.leadBars ?? 1, p.ink);
    }
    drawGestureLabel(ctx, g, cx, cy + size * 1.4, p.ink);
  }

  // Character
  if (show.character) {
    drawCharacter(ctx, w * 0.5, h * STAGE_FLOOR_Y, Math.min(w, h) * 0.14, show, opts, state, beatFlash, danceCycle);
  } else {
    drawPulseShape(ctx, w * 0.5, h * 0.72, Math.min(w, h) * 0.12, state, p, beatFlash);
  }

  // Particle bursts on gesture hits
  const now = state.clockSeconds;
  for (const f of state.recentFires) {
    const age = now - f.atSeconds;
    if (age >= 0 && age < 0.4) {
      const cs = p.gesture[f.gesture];
      const fx = w * (0.25 + 0.5 * (((f.playerId % 4) + 0.5) / 4));
      const fy = h * 0.35;
      drawShape(ctx, cs.shape, fx, fy, Math.min(w, h) * 0.07, cs.color, p.ink, 8);
      if (age < 0.08) spawnBurst(fx, fy, cs.color, 10);
    }
  }

  drawParticles(ctx);
  drawHUD(ctx, dims, state, p, beatFlash);
}

// ── Background & Stage ─────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h }: RenderDims,
  p: ShowConfig["palette"],
  state: RenderState,
  beatFlash: number,
  backgroundImage: HTMLImageElement | null,
): void {
  // AI background art, drawn cover-fit and darkened so gameplay elements pop.
  if (backgroundImage) {
    const scale = Math.max(w / backgroundImage.width, h / backgroundImage.height);
    const iw = backgroundImage.width * scale;
    const ih = backgroundImage.height * scale;
    ctx.drawImage(backgroundImage, (w - iw) / 2, (h - ih) / 2, iw, ih);
    // darken for contrast + keep the show's identity tint
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, w, h);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, p.background);
    grad.addColorStop(0.5, darken(p.background, 0.15));
    grad.addColorStop(1, darken(p.background, 0.4));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Spotlights
  for (const x of [w * 0.2, w * 0.8]) {
    const spot = ctx.createRadialGradient(x, h * 0.2, 0, x, h * 0.2, h * 0.35);
    spot.addColorStop(0, `rgba(255,255,255,${0.06 + beatFlash * 0.02})`);
    spot.addColorStop(1, "transparent");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, w, h);
  }

  // Beat flash vignette
  if (beatFlash > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${beatFlash * 0.03})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawStageFloor(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h }: RenderDims,
  p: ShowConfig["palette"],
): void {
  const floorTop = h * STAGE_FLOOR_Y;
  const floorBottom = h;
  const horizonY = floorTop - h * 0.08;

  // Floor gradient
  const grad = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
  grad.addColorStop(0, darken(p.background, 0.1));
  grad.addColorStop(1, darken(p.background, 0.5));
  ctx.fillStyle = grad;
  ctx.fillRect(0, floorTop, w, floorBottom - floorTop);

  // Grid lines (perspective)
  const cx = w * STAGE_CENTER_X;
  const vp = { x: cx, y: horizonY };
  const alpha = 0.12;
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1;

  for (let i = 0; i <= GRID_LINES; i++) {
    const frac = i / GRID_LINES;
    const y = floorTop + frac * (floorBottom - floorTop);
    const scale = 1 + frac * 0.8;
    const left = cx - w * 0.45 * scale;
    const right = cx + w * 0.45 * scale;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  // Vertical grid lines
  for (let i = 0; i <= 8; i++) {
    const frac = i / 8;
    const x = cx + (frac - 0.5) * w * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, floorTop);
    ctx.lineTo(cx + (frac - 0.5) * w * 0.5, floorBottom);
    ctx.stroke();
  }

  // Horizon glow
  const glow = ctx.createLinearGradient(0, horizonY - 20, 0, floorTop);
  glow.addColorStop(0, "transparent");
  glow.addColorStop(1, `rgba(255,255,255,0.08)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizonY - 20, w, floorTop - (horizonY - 20));
}

function drawOrbs(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h }: RenderDims,
  beatFlash: number,
): void {
  for (const orb of orbs) {
    orb.y -= orb.speed;
    if (orb.y < -20) { orb.y = h * 0.6 + 20; orb.x = Math.random() * w; }

    const pulse = Math.sin(orb.phase + beatFlash * Math.PI * 2) * 0.15 + 1;
    const r = orb.radius * pulse;

    ctx.save();
    ctx.globalAlpha = 0.35 + beatFlash * 0.15;
    ctx.fillStyle = orb.color;
    ctx.shadowColor = orb.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Character (DannyGo-style blob) ─────────────────────────────────

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  floorY: number,
  size: number,
  show: ShowConfig,
  opts: RenderOptions,
  state: RenderState,
  beatFlash: number,
  danceCycle: number,
): void {
  const c = show.character!;
  const s = size;

  // Body position with dance bounce
  const bounce = Math.abs(Math.sin(danceCycle * Math.PI)) * s * 0.12 * (1 + beatFlash * 0.5);
  const sway = Math.sin(danceCycle * Math.PI * 2) * s * 0.04;
  const cy = floorY - s * 0.9 - bounce;

  // Shadow on floor
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, floorY + s * 0.08, s * 0.45 - bounce * 0.3, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sway * 0.3);

  // Legs (stick limbs, bounce with dance)
  const legLength = s * 0.7;
  const legSpread = s * 0.35;
  const legBounce = Math.abs(Math.sin(danceCycle * Math.PI)) * s * 0.15;
  const legSwing = Math.sin(danceCycle * Math.PI * 2) * s * 0.1;

  ctx.strokeStyle = c.bodyColor;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = "round";

  // Left leg
  ctx.beginPath();
  ctx.moveTo(-legSpread * 0.5, -legLength * 0.3);
  ctx.lineTo(-legSpread - legSwing * 0.3, legLength * 0.6 - legBounce * 0.5);
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(legSpread * 0.5, -legLength * 0.3);
  ctx.lineTo(legSpread + legSwing * 0.3, legLength * 0.6 - legBounce * 0.5);
  ctx.stroke();

  // Arms (stick limbs, swing with dance)
  const armSwing = Math.sin(danceCycle * Math.PI * 2 + Math.PI / 2) * s * 0.25;
  const armRaise = opts.voiceAmp * s * 0.3 + beatFlash * s * 0.1;

  ctx.lineWidth = s * 0.1;
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.3);
  ctx.lineTo(-s * 0.65 - armSwing, -s * 0.05 - armRaise);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(s * 0.45, -s * 0.3);
  ctx.lineTo(s * 0.65 + armSwing, -s * 0.05 - armRaise);
  ctx.stroke();

  // Hand dots
  ctx.fillStyle = c.bodyColor;
  ctx.beginPath();
  ctx.arc(-s * 0.65 - armSwing, -s * 0.05 - armRaise, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.65 + armSwing, -s * 0.05 - armRaise, s * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Body (round blob)
  const bodySquash = 1 - beatFlash * 0.06;
  ctx.fillStyle = c.bodyColor;
  ctx.strokeStyle = show.palette.ink;
  ctx.lineWidth = s * 0.08;
  ctx.shadowColor = c.accentColor;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.55, s * 0.55 * bodySquash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Eyes (big and expressive, look direction with sway)
  const eyeLook = sway * 2;
  const eyeSize = s * 0.14;
  const eyeY = -s * 0.15;
  const eyeSpread = s * 0.22;

  // Eye whites
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-eyeSpread + eyeLook, eyeY, eyeSize, eyeSize * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(eyeSpread + eyeLook, eyeY, eyeSize, eyeSize * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(-eyeSpread + eyeLook + sway * s * 0.08, eyeY + sway * s * 0.04, eyeSize * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeSpread + eyeLook + sway * s * 0.08, eyeY + sway * s * 0.04, eyeSize * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-eyeSpread + eyeLook + eyeSize * 0.2, eyeY - eyeSize * 0.2, eyeSize * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeSpread + eyeLook + eyeSize * 0.2, eyeY - eyeSize * 0.2, eyeSize * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.fillStyle = c.accentColor;
  const my = s * 0.2;
  ctx.beginPath();
  if (opts.mouth === "closed") {
    ctx.roundRect(-s * 0.15, my, s * 0.3, s * 0.05, s * 0.03);
  } else if (opts.mouth === "mid") {
    ctx.ellipse(0, my + s * 0.02, s * 0.18, s * 0.1, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(0, my + s * 0.05, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.restore();
}

// ── Pulse shape (character-free shows) ─────────────────────────────

function drawPulseShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  state: RenderState,
  p: ShowConfig["palette"],
  beatFlash: number,
): void {
  const pulse = 1 + beatFlash * 0.3;
  ctx.save();
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 30;
  drawShape(ctx, "diamond", cx, cy, size * pulse, p.accent, p.ink, 14);
  ctx.restore();
}

// ── Gesture shapes ─────────────────────────────────────────────────

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

function drawGestureLabel(ctx: CanvasRenderingContext2D, g: GestureId, cx: number, cy: number, ink: string): void {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.shadowColor = ink;
  ctx.shadowBlur = 12;
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  const word: Record<GestureId, string> = { jump: "JUMP", sidestep: "STEP", duck: "DUCK", reach: "REACH" };
  ctx.fillText(word[g], cx, cy);
  ctx.restore();
}

// ── Beat bar ───────────────────────────────────────────────────────

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
    const mh = active ? 30 : 12;
    const y = h - mh - 14;
    if (active) {
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    const r = 8;
    const x = i * cell + 20;
    const bw = active ? cell - 40 + barFrac * 5 : cell - 40;
    ctx.roundRect(x, y, bw, mh, r);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ── HUD ────────────────────────────────────────────────────────────

function drawHUD(
  ctx: CanvasRenderingContext2D,
  { width: w }: RenderDims,
  state: RenderState,
  p: ShowConfig["palette"],
  beatFlash: number,
): void {
  ctx.save();

  // Score with animated pulse
  const scoreScale = 1 + beatFlash * 0.06;
  ctx.font = `bold ${Math.round(72 * scoreScale)}px system-ui, sans-serif`;
  ctx.fillStyle = p.ink;
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 15;
  ctx.textAlign = "left";
  ctx.fillText(String(state.teamScore), 32, 80);
  ctx.shadowBlur = 0;

  // Player count
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`${state.playersTracked} player${state.playersTracked !== 1 ? "s" : ""}`, 32, 110);

  // Timer
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`${Math.round(state.activeSeconds)}s`, w - 32, 68);

  ctx.restore();
}

// ── Particles ──────────────────────────────────────────────────────

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * (1 - amount))));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
