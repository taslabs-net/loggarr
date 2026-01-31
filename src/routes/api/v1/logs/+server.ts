import type { RequestHandler } from './$types';
import { streamAllLogs, type LogEntry, type LogLevel } from '$lib/server/docker';
import { logsReceived, logsFiltered, activeConnections, bufferSize } from '$lib/server/metrics';

let currentBufferSize = 0;

export const GET: RequestHandler = async ({ request }) => {
	const url = new URL(request.url);
	const levelsParam = url.searchParams.get('levels');
	const containersParam = url.searchParams.get('containers');
	const allowedLevels: LogLevel[] | null = levelsParam ? (levelsParam.split(',') as LogLevel[]) : null;
	const containerIds: string[] | undefined = containersParam ? containersParam.split(',') : undefined;

	const abortController = new AbortController();

	const stream = new ReadableStream({
		async start(controller) {
			activeConnections.inc();

			const encoder = new TextEncoder();

			const send = (data: LogEntry) => {
				const json = JSON.stringify(data);
				controller.enqueue(encoder.encode(`data: ${json}\n\n`));
				currentBufferSize++;
				bufferSize.set(currentBufferSize);
			};

			try {
				for await (const entry of streamAllLogs(abortController.signal, containerIds)) {
					logsReceived.inc({ container: entry.container, level: entry.level });

					if (allowedLevels && !allowedLevels.includes(entry.level)) {
						logsFiltered.inc({ level: entry.level });
						continue;
					}

					send(entry);
				}
			} catch (err) {
				if ((err as Error).name !== 'AbortError') {
					console.error('Log stream error:', err);
				}
			} finally {
				activeConnections.dec();
				controller.close();
			}
		},
		cancel() {
			abortController.abort();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
