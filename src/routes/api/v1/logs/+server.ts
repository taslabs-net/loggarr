import type { RequestHandler } from './$types';
import { streamAllLogs, streamContainerEvents, type LogEntry, type LogLevel } from '$lib/server/docker';
import { logsReceived, logsFiltered, activeConnections, bufferSize } from '$lib/server/metrics';

let currentBufferSize = 0;

export const GET: RequestHandler = async ({ request }) => {
	const url = new URL(request.url);
	const levelsParam = url.searchParams.get('levels');
	const containersParam = url.searchParams.get('containers');
	const includeEvents = url.searchParams.get('events') !== 'false';
	const allowedLevels: LogLevel[] | null = levelsParam ? (levelsParam.split(',') as LogLevel[]) : null;
	const containerIds: string[] | undefined = containersParam ? containersParam.split(',') : undefined;

	const abortController = new AbortController();

	const stream = new ReadableStream({
		async start(controller) {
			activeConnections.inc();

			const encoder = new TextEncoder();
			const entryQueue: LogEntry[] = [];
			let resolveWait: (() => void) | null = null;

			const queueEntry = (entry: LogEntry) => {
				entryQueue.push(entry);
				if (resolveWait) {
					resolveWait();
					resolveWait = null;
				}
			};

			const send = (data: LogEntry) => {
				const json = JSON.stringify(data);
				controller.enqueue(encoder.encode(`data: ${json}\n\n`));
				currentBufferSize++;
				bufferSize.set(currentBufferSize);
			};

			// Start log stream in background
			const logStreamPromise = (async () => {
				try {
					for await (const entry of streamAllLogs(abortController.signal, containerIds)) {
						queueEntry(entry);
					}
				} catch (err) {
					if ((err as Error).name !== 'AbortError') {
						console.error('Log stream error:', err);
					}
				}
			})();

			// Start events stream in background (if enabled)
			const eventStreamPromise = includeEvents
				? (async () => {
						try {
							for await (const entry of streamContainerEvents(abortController.signal)) {
								// Filter events by container if specified
								if (!containerIds || containerIds.length === 0 || containerIds.includes(entry.containerId) || containerIds.includes(entry.container)) {
									queueEntry(entry);
								}
							}
						} catch (err) {
							if ((err as Error).name !== 'AbortError') {
								console.error('Events stream error:', err);
							}
						}
					})()
				: Promise.resolve();

			try {
				while (!abortController.signal.aborted) {
					if (entryQueue.length > 0) {
						const entry = entryQueue.shift()!;
						logsReceived.inc({ container: entry.container, level: entry.level });

						// Events always pass through, logs respect level filter
						if (!entry.isEvent && allowedLevels && !allowedLevels.includes(entry.level)) {
							logsFiltered.inc({ level: entry.level });
							continue;
						}

						send(entry);
					} else {
						await new Promise<void>((resolve) => {
							resolveWait = resolve;
							setTimeout(resolve, 25); // Fast poll for real-time feel
						});
					}
				}
			} finally {
				activeConnections.dec();
				await Promise.allSettled([logStreamPromise, eventStreamPromise]);
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
