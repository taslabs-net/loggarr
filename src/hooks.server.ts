import { printBanner } from '$lib/server/banner';
import { env } from '$env/dynamic/private';
import { version } from '../package.json';

const port = env.PORT || '9797';
const metricsPort = env.METRICS_PORT || '9091';

printBanner(version, port, metricsPort);
