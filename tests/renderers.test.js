import cairo from 'gi://cairo';
import GLib from 'gi://GLib';
import { test, assertEqual } from './harness.js';
import { RENDERERS, getRenderer, DEFAULT_RENDERER_ID } from '../lib/renderers/index.js';

const CTX = { up: [0.18, 0.76, 0.44], down: [0.91, 0.30, 0.33], flat: [0.58, 0.60, 0.63] };
const RISING = [1, 2, 3, 4, 5, 6, 7, 8];
const FALLING = [8, 7, 6, 5, 4, 3, 2, 1];

let _seq = 0;
function toBytes(surface) {
  const path = `/tmp/crypto-rt-${_seq++}.png`;
  surface.flush();
  surface.writeToPNG(path);
  const [, bytes] = GLib.file_get_contents(path);
  GLib.unlink(path);
  return bytes;
}

function renderBytes(renderer, series, w = 60, h = 18) {
  const surface = new cairo.ImageSurface(cairo.Format.ARGB32, w, h);
  renderer.draw(new cairo.Context(surface), series, w, h, CTX);
  return toBytes(surface);
}

function blankBytes(w = 60, h = 18) {
  return toBytes(new cairo.ImageSurface(cairo.Format.ARGB32, w, h));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const drew = (r, series) => !sameBytes(renderBytes(r, series), blankBytes());

for (const r of RENDERERS) {
  test(`${r.id}: has the contract fields`, () => {
    assertEqual(typeof r.id, 'string');
    assertEqual(typeof r.label, 'string');
    assertEqual(typeof r.draw, 'function');
  });

  test(`${r.id}: draws something for a rising series`, () => {
    assertEqual(drew(r, RISING), true, 'nothing was drawn');
  });

  test(`${r.id}: survives a flat series without dividing by zero`, () => {
    assertEqual(drew(r, [5, 5, 5, 5]), true);
  });

  test(`${r.id}: draws nothing for an empty or single-point series`, () => {
    assertEqual(drew(r, []), false);
    assertEqual(drew(r, [1]), false);
  });

  test(`${r.id}: rising and falling render differently`, () => {
    assertEqual(
      sameBytes(renderBytes(r, RISING), renderBytes(r, FALLING)), false,
      'a rising and a falling series must not produce identical pixels'
    );
  });

  test(`${r.id}: rendering is deterministic`, () => {
    assertEqual(
      sameBytes(renderBytes(r, RISING), renderBytes(r, RISING)), true,
      'same input must render byte-identically, or this suite is useless'
    );
  });
}

test('registry: default renderer resolves', () => {
  assertEqual(getRenderer(DEFAULT_RENDERER_ID).id, DEFAULT_RENDERER_ID);
});

test('registry: unknown id falls back to the default', () => {
  assertEqual(getRenderer('nonsense').id, DEFAULT_RENDERER_ID);
});
