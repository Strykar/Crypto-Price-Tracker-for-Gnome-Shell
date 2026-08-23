const cases = [];

export function test(name, fn) {
  cases.push({ name, fn });
}

export function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e)
    throw new Error(`${msg}\n    expected: ${e}\n    actual:   ${a}`);
}

export function assertClose(actual, expected, eps = 1e-9, msg = '') {
  if (!(Math.abs(actual - expected) <= eps))
    throw new Error(`${msg}\n    expected: ${expected} +/-${eps}\n    actual:   ${actual}`);
}

export async function assertRejects(fn, msg = '') {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error(`${msg}\n    expected a rejection, got none`);
}

export async function run() {
  let pass = 0, fail = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
      print(`  ok   ${name}`);
      pass++;
    } catch (e) {
      print(`  FAIL ${name}\n       ${e.message}`);
      fail++;
    }
  }
  print(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}
