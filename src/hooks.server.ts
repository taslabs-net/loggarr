import { printBanner } from '$lib/server/banner';
import { startMetricsServer } from '$lib/server/metrics-server';
import { env } from '$env/dynamic/private';
import { version } from '../package.json';

const port = env.PORT || '9797';
const metricsPort = env.METRICS_PORT || '9091';

printBanner(version, port, metricsPort);
startMetricsServer(parseInt(metricsPort, 10));
