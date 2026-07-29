import type { Landmark } from "./types.js";

export interface Vec2 {
  x: number;
  y: number;
}

export function midpoint(a: Landmark, b: Landmark): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Interior angle at vertex `b` formed by a-b-c, in radians (0..pi).
 * Used for knee angle: hip-knee-ankle. Straight leg ~= pi, deep bend -> small.
 */
export function angle(a: Vec2, b: Vec2, c: Vec2): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);
  if (magA === 0 || magC === 0) return Math.PI;
  const cos = clamp(dot / (magA * magC), -1, 1);
  return Math.acos(cos);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Exponential moving average helper — one-pole low-pass. */
export function ema(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}
