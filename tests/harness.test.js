import { test, assertEqual, assertClose, assertRejects } from './harness.js';

test('assertEqual passes on deep equality', () => {
  assertEqual({ a: [1, 2] }, { a: [1, 2] });
});

test('assertEqual fails on inequality', async () => {
  await assertRejects(async () => assertEqual(1, 2));
});

test('assertRejects catches an async throw', async () => {
  const e = await assertRejects(async () => {
    throw new Error('boom');
  });
  assertEqual(e.message, 'boom');
});

test('assertClose fails when the gap exceeds eps', async () => {
  const e = await assertRejects(async () => assertClose(1.0, 1.5, 1e-9));
  assertEqual(e.message.includes('expected'), true, `wrong error: ${e.message}`);
});
