import { GradientFill } from './gradientFill.js';
import { PlainLine } from './plainLine.js';
import { SplitAtOpen } from './splitAtOpen.js';

export const DEFAULT_RENDERER_ID = 'gradient-fill';

export const RENDERERS = [
  GradientFill,
  PlainLine,
  SplitAtOpen,
];

export function getRenderer(id) {
  return RENDERERS.find(r => r.id === id)
      ?? RENDERERS.find(r => r.id === DEFAULT_RENDERER_ID);
}
