import System from 'system';
import { run } from './harness.js';

import './harness.test.js';

import './sources.test.js';

import './sourceClient.test.js';

System.exit(await run());
