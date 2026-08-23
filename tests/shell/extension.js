// Probe extension, loaded beside the real one by tests/shell.sh.
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { CASES, seedPrices } from './cases.js';

const TARGET = 'crypto@alipirpiran.github';
const SETTLE_SECONDS = 12;

export default class ShellTests {
  enable() {
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, SETTLE_SECONDS, () => {
      const ext = Main.extensionManager.lookup(TARGET)?.stateObj;
      if (!ext?._indicator) {
        console.log('SHELLTEST FAIL | the extension under test never built an indicator');
        console.log('SHELLTEST DONE 0 1');
        return GLib.SOURCE_REMOVE;
      }
      seedPrices(ext);
      let passed = 0, failed = 0;
      for (const [name, fn] of CASES) {
        try {
          fn(ext);
          passed++;
          console.log(`SHELLTEST ok   | ${name}`);
        } catch (e) {
          failed++;
          console.log(`SHELLTEST FAIL | ${name}`);
          console.log(`SHELLTEST      |   ${e.message}`);
        }
      }
      console.log(`SHELLTEST DONE ${passed} ${failed}`);
      return GLib.SOURCE_REMOVE;
    });
  }

  disable() {}
}
