import System from 'system';
import { run } from './harness.js';

import './harness.test.js';

System.exit(await run());
