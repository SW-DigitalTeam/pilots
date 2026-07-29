import type { GestureId, RenderState, ShowConfig } from "@pwa/arcade-engine";
import type { MouthShape } from "./mouth.js";

export interface RenderDims {
  width: number;
  height: number;
}

export interface RenderOptions {
  mouth: MouthShape;
  /** 0..1 amplitude for subtle character scale on speech. */
  voiceAmp: number;
}

/**
 * Canvas-2D renderer tuned for a gym wall at five metres, lights on: very high
 * contrast, enormous elements, saturated hard-edged fills, no gradients or soft
 * shadows, nothing under 8px. Every colour cue is paired with a shape cue
 * because projector colour is unreliable. Motion snaps rather than eases.
 *
 * Pure function of (state, show): the same inputs always draw the same frame,
 * which is what lets the visual critic screenshot shows deterministically.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  dims: RenderDims,
  state: RenderState,
  show: ShowConfig,
  opts: RenderOptions,
): void {
  const { width: w, height: h } = dims;
  const p = show.palette;

  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, w, h);

  drawBeatBar(ctx, dims, state, p.accent, show.music.beatsPerBar);

  // Active call: a huge shape + colour, with a window countdown wedge.
  if (state.activeCall) {
    const g = state.activeCall.gesture;
    const cs = p.gesture[g];
    const cx = w * 0.5;
    const cy = h * 0.46;
    const beatsToWindow = state.activeCall.windowStartBeat - state.beat;
    const inWindow = state.beat >= state.activeCall.windowStartBeat;
    // Snap scale: big when the window is open, stepwise otherwise (no easing).
    const size = Math.min(w, h) * (inWindow ? 0.34 : 0.26);
    drawShape(ctx, cs.shape, cx, cy, size, cs.color, p.ink, inWindow ? 12 : 8);
    if (!inWindow && beatsToWindow > 0) {
      drawCountdown(ctx, cx, cy, size * 1.25, beatsToWindow, show.modes.follow?.leadBars ?? 1, p.ink);
    }
    drawGestureGlyph(ctx, g, cx, cy + size * 1.5, p.ink);
  }

  // Character (or an abstract pulse shape for the character-free show).
  if (show.character) {
    drawCharacter(ctx, w * 0.5, h * 0.72, Math.min(w, h) * 0.16, show, opts);
  } else {
    drawPulseGlyph(ctx, w * 0.5, h * 0.72, Math.min(w, h) * 0.14, state, p);
  }

  // Recent fires pop as a hard flash of their shape.
  const now = state.clockSeconds;
  for (const f of state.recentFires) {
    const age = now - f.atSeconds; // both in audio-clock seconds
    if (age >= 0 && age < 0.5) {
      const cs = p.gesture[f.gesture];
      drawShape(ctx, cs.shape, w * (0.2 + 0.6 * (((f.playerId % 4) + 0.5) / 4)), h * 0.28, Math.min(w, h) * 0.08, cs.color, p.ink, 8);
    }
  }

  drawScore(ctx, dims, state, p);
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
    ctx.fillStyle = active ? accent : "#ffffff22";
    const mh = active ? 24 : 12;
    ctx.fillRect(i * cell + 8, h - mh - 8, cell - 16, mh);
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
      ctx.rect(cx - r, cy - r, size, size);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
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
      ctx.moveTo(cx - r, cy + r * 0.2);
      ctx.lineTo(cx, cy - r * 0.6);
      ctx.lineTo(cx + r, cy + r * 0.2);
      ctx.lineTo(cx + r, cy + r * 0.7);
      ctx.lineTo(cx, cy - r * 0.1);
      ctx.lineTo(cx - r, cy + r * 0.7);
      ctx.closePath();
      break;
    case "bar":
      ctx.rect(cx - r, cy - r * 0.35, size, r * 0.7);
      break;
    case "cross":
      ctx.rect(cx - r * 0.25, cy - r, r * 0.5, size);
      ctx.rect(cx - r, cy - r * 0.25, size, r * 0.5);
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
  ctx.lineWidth = 10;
  ctx.strokeStyle = ink;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
}

function drawGestureGlyph(ctx: CanvasRenderingContext2D, g: GestureId, cx: number, cy: number, ink: string): void {
  ctx.fillStyle = ink;
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  const word: Record<GestureId, string> = { jump: "JUMP", sidestep: "STEP", duck: "DUCK", reach: "REACH" };
  ctx.fillText(word[g], cx, cy);
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
  const bob = 1 + opts.voiceAmp * 0.06;
  ctx.fillStyle = c.bodyColor;
  ctx.strokeStyle = show.palette.ink;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.rect(cx - size * 0.6, cy - size * bob, size * 1.2, size * 1.6 * bob);
  ctx.fill();
  ctx.stroke();
  // Mouth: three shapes.
  ctx.fillStyle = c.accentColor;
  const my = cy - size * 0.2;
  ctx.beginPath();
  if (opts.mouth === "closed") ctx.rect(cx - size * 0.25, my, size * 0.5, 12);
  else if (opts.mouth === "mid") ctx.ellipse(cx, my, size * 0.25, size * 0.14, 0, 0, Math.PI * 2);
  else ctx.ellipse(cx, my, size * 0.3, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawPulseGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  state: RenderState,
  p: ShowConfig["palette"],
): void {
  // Character-free show: an abstract shape that pulses hard on the beat.
  const beatFrac = state.beat - Math.floor(state.beat);
  const pulse = beatFrac < 0.15 ? 1.25 : 1;
  drawShape(ctx, "diamond", cx, cy, size * pulse, p.accent, p.ink, 12);
}

function drawScore(
  ctx: CanvasRenderingContext2D,
  { width: w }: RenderDims,
  state: RenderState,
  p: ShowConfig["palette"],
): void {
  ctx.fillStyle = p.ink;
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(String(state.teamScore), 24, 72);
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(state.activeSeconds)}s`, w - 24, 60);
}
