import cairo from 'gi://cairo';
import GLib from 'gi://GLib';
import { test, assertEqual } from './harness.js';
import { RENDERERS, getRenderer, DEFAULT_RENDERER_ID } from '../lib/renderers/index.js';
import { direction } from '../lib/renderers/gradientFill.js';

const CTX = { up: [0.18, 0.76, 0.44], down: [0.91, 0.30, 0.33], flat: [0.58, 0.60, 0.63] };
const PRICE = { rising: [1, 2, 3, 4, 5, 6, 7, 8], falling: [8, 7, 6, 5, 4, 3, 2, 1], flat: [5, 5, 5, 5] };
const FLOW  = { rising: [30, 40, 50, 60, 70, 75, 78, 80], falling: [80, 75, 70, 60, 50, 40, 35, 30], flat: [50, 50, 50, 50] };
const sample = r => (r.series === 'flow' ? FLOW : PRICE);

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
    assertEqual(drew(r, sample(r).rising), true, 'nothing was drawn');
  });

  test(`${r.id}: survives a flat series without dividing by zero`, () => {
    assertEqual(drew(r, sample(r).flat), true);
  });

  test(`${r.id}: draws nothing for an empty or single-point series`, () => {
    assertEqual(drew(r, []), false);
    assertEqual(drew(r, [1]), false);
  });

  test(`${r.id}: rising and falling render differently`, () => {
    assertEqual(
      sameBytes(renderBytes(r, sample(r).rising), renderBytes(r, sample(r).falling)), false,
      'a rising and a falling series must not produce identical pixels'
    );
  });

  test(`${r.id}: rendering is deterministic`, () => {
    assertEqual(
      sameBytes(renderBytes(r, sample(r).rising), renderBytes(r, sample(r).rising)), true,
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

test('direction: a real 48-minute move is coloured, not flat', () => {
  const ctx = { up: 'UP', down: 'DOWN', flat: 'FLAT' };
  assertEqual(direction([100, 100.2], ctx), 'UP', '+0.2% must read as up');
  assertEqual(direction([100, 99.8], ctx), 'DOWN', '-0.2% must read as down');
});

test('direction: flat means genuinely unmoved', () => {
  const ctx = { up: 'UP', down: 'DOWN', flat: 'FLAT' };
  assertEqual(direction([100, 100], ctx), 'FLAT');
  assertEqual(direction([100, 100.01], ctx), 'FLAT', '0.01% is noise, not a move');
});

test('buy-sell declares that it plots flow, not price', () => {
  assertEqual(getRenderer('buy-sell').series, 'flow');
});

test('price renderers do not declare a series kind, so they default to price', () => {
  for (const id of ['gradient-fill', 'plain-line', 'split-at-open'])
    assertEqual(getRenderer(id).series ?? 'price', 'price', id);
});
