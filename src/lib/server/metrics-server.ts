import { createServer } from 'http';
import { registry } from './metrics';

let server: ReturnType<typeof createServer> | null = null;

export function startMetricsServer(port: number): void {
	if (server) {
		return;
	}

	server = createServer(async (req, res) => {
		if (req.url === '/metrics' && req.method === 'GET') {
			try {
				const metrics = await registry.metrics();
				res.writeHead(200, { 'Content-Type': registry.contentType });
				res.end(metrics);
			} catch (err) {
				res.writeHead(500);
				res.end('Error collecting metrics');
				console.error('Metrics error:', err);
			}
		} else if (req.url === '/health' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('OK');
		} else {
			res.writeHead(404);
			res.end('Not found');
		}
	});

	server.listen(port, () => {
		console.log(`  Metrics server listening on port ${port}`);
	});
}

export function stopMetricsServer(): void {
	if (server) {
		server.close();
		server = null;
	}
}
