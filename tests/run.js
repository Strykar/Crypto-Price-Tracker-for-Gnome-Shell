import System from 'system';
import { run } from './harness.js';

import './harness.test.js';

import './sources.test.js';

import './sourceClient.test.js';

import './migrate.test.js';

import './duplicateCoin.test.js';

import './format.test.js';

import './priceService.test.js';

import './renderers.test.js';

import './portfolio.test.js';

import './history.test.js';

System.exit(await run());
