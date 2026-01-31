import { Registry, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const logsReceived = new Counter({
	name: 'loggarr_logs_received_total',
	help: 'Total number of log entries received',
	labelNames: ['container', 'level'],
	registers: [registry]
});

export const logsFiltered = new Counter({
	name: 'loggarr_logs_filtered_total',
	help: 'Total number of log entries filtered',
	labelNames: ['level'],
	registers: [registry]
});

export const activeConnections = new Gauge({
	name: 'loggarr_active_connections',
	help: 'Number of active SSE connections',
	registers: [registry]
});

export const containersMonitored = new Gauge({
	name: 'loggarr_containers_monitored',
	help: 'Number of containers being monitored',
	registers: [registry]
});

export const snapshotCount = new Gauge({
	name: 'loggarr_snapshots_total',
	help: 'Total number of saved snapshots',
	registers: [registry]
});

export const bufferSize = new Gauge({
	name: 'loggarr_buffer_size',
	help: 'Current number of logs in buffer',
	registers: [registry]
});
