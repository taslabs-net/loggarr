import Docker from 'dockerode';
import type { ContainerInfo } from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export interface ContainerSummary {
	id: string;
	name: string;
	image: string;
	state: string;
	status: string;
}

export interface LogEntry {
	timestamp: Date;
	container: string;
	containerId: string;
	stream: 'stdout' | 'stderr';
	message: string;
	level: LogLevel;
	isEvent?: boolean;
	eventType?: ContainerEventType;
}

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'alert';
export type ContainerEventType = 'start' | 'stop' | 'restart' | 'die' | 'health_status' | 'create' | 'destroy';

const LOG_LEVEL_PATTERNS: Record<LogLevel, RegExp[]> = {
	alert: [/\balert\b/i, /\bcritical\b/i, /\bfatal\b/i, /\bemergency\b/i],
	error: [/\berror\b/i, /\bexception\b/i, /\bfailed\b/i, /\bfailure\b/i],
	warning: [/\bwarn(ing)?\b/i, /\bcaution\b/i],
	info: [/\binfo\b/i, /\bnotice\b/i],
	debug: [/\bdebug\b/i, /\btrace\b/i, /\bverbose\b/i]
};

function detectLogLevel(message: string, stream: 'stdout' | 'stderr'): LogLevel {
	for (const [level, patterns] of Object.entries(LOG_LEVEL_PATTERNS) as [LogLevel, RegExp[]][]) {
		if (patterns.some((pattern) => pattern.test(message))) {
			return level;
		}
	}
	return stream === 'stderr' ? 'error' : 'info';
}

function parseDockerLogLine(data: Buffer, container: ContainerInfo): LogEntry | null {
	if (data.length < 8) return null;

	const header = data.subarray(0, 8);
	const streamType = header[0];
	const size = header.readUInt32BE(4);
	const payload = data
		.subarray(8, 8 + size)
		.toString('utf8')
		.trim();

	if (!payload) return null;

	const stream: 'stdout' | 'stderr' = streamType === 2 ? 'stderr' : 'stdout';
	const containerName = container.Names[0]?.replace(/^\//, '') || container.Id.slice(0, 12);

	return {
		timestamp: new Date(),
		container: containerName,
		containerId: container.Id,
		stream,
		message: payload,
		level: detectLogLevel(payload, stream)
	};
}

export async function listContainers(): Promise<ContainerSummary[]> {
	const containers = await docker.listContainers({ all: true });
	return containers.map((c) => ({
		id: c.Id,
		name: c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12),
		image: c.Image,
		state: c.State,
		status: c.Status
	}));
}

export async function getRunningContainers(): Promise<ContainerInfo[]> {
	return docker.listContainers({ filters: { status: ['running'] } });
}

export async function* streamAllLogs(signal?: AbortSignal, containerIds?: string[]): AsyncGenerator<LogEntry> {
	let containers = await getRunningContainers();

	if (containerIds && containerIds.length > 0) {
		containers = containers.filter((c) => containerIds.includes(c.Id) || containerIds.includes(c.Names[0]?.replace(/^\//, '') || ''));
	}

	// Establish all log streams in parallel for faster startup
	// Use Promise.allSettled to handle partial failures gracefully
	const streamResults = await Promise.allSettled(
		containers.map(async (containerInfo) => {
			const container = docker.getContainer(containerInfo.Id);
			const logStream = await container.logs({
				follow: true,
				stdout: true,
				stderr: true,
				timestamps: false,
				tail: 5
			});
			return { container: containerInfo, stream: logStream };
		})
	);

	// Filter out failed streams and log errors
	const streams = streamResults
		.filter((result): result is PromiseFulfilledResult<{ container: ContainerInfo; stream: NodeJS.ReadableStream }> => {
			if (result.status === 'rejected') {
				console.error('Failed to connect to container log stream:', result.reason);
				return false;
			}
			return true;
		})
		.map((result) => result.value);

	const logQueue: LogEntry[] = [];
	let resolveWait: (() => void) | null = null;

	for (const { container, stream } of streams) {
		let buffer = Buffer.alloc(0);

		stream.on('data', (chunk: Buffer) => {
			buffer = Buffer.concat([buffer, chunk]);

			while (buffer.length >= 8) {
				const size = buffer.readUInt32BE(4);
				const totalSize = 8 + size;

				if (buffer.length < totalSize) break;

				const frame = buffer.subarray(0, totalSize);
				buffer = buffer.subarray(totalSize);

				const entry = parseDockerLogLine(frame, container);
				if (entry) {
					logQueue.push(entry);
					if (resolveWait) {
						resolveWait();
						resolveWait = null;
					}
				}
			}
		});

		stream.on('error', (err) => {
			console.error(`Log stream error for ${container.Names[0]}:`, err);
		});
	}

	while (!signal?.aborted) {
		if (logQueue.length > 0) {
			yield logQueue.shift()!;
		} else {
			await new Promise<void>((resolve) => {
				resolveWait = resolve;
				setTimeout(resolve, 50); // Fast poll for responsive streaming
			});
		}
	}

	for (const { stream } of streams) {
		(stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
	}
}

const CONTAINER_EVENT_TYPES = new Set(['start', 'stop', 'restart', 'die', 'health_status', 'create', 'destroy']);

function formatEventMessage(action: string, containerName: string, attributes: Record<string, string>): string {
	switch (action) {
		case 'start':
			return `Container started`;
		case 'stop':
			return `Container stopped`;
		case 'restart':
			return `Container restarted`;
		case 'die':
			return `Container exited with code ${attributes.exitCode || 'unknown'}`;
		case 'health_status':
			return `Health status: ${attributes.health_status || 'unknown'}`;
		case 'create':
			return `Container created`;
		case 'destroy':
			return `Container destroyed`;
		default:
			return `Container event: ${action}`;
	}
}

function getEventLevel(action: string, attributes: Record<string, string>): LogLevel {
	switch (action) {
		case 'die':
			return attributes.exitCode === '0' ? 'info' : 'error';
		case 'health_status':
			return attributes.health_status === 'healthy' ? 'info' : 'warning';
		case 'stop':
		case 'destroy':
			return 'warning';
		case 'start':
		case 'restart':
		case 'create':
			return 'info';
		default:
			return 'info';
	}
}

export async function* streamContainerEvents(signal?: AbortSignal): AsyncGenerator<LogEntry> {
	const eventStream = await docker.getEvents({
		filters: {
			type: ['container'],
			event: Array.from(CONTAINER_EVENT_TYPES)
		}
	});

	const eventQueue: LogEntry[] = [];
	let resolveWait: (() => void) | null = null;

	eventStream.on('data', (chunk: Buffer) => {
		try {
			const event = JSON.parse(chunk.toString());
			if (event.Type === 'container' && CONTAINER_EVENT_TYPES.has(event.Action)) {
				const containerName = event.Actor?.Attributes?.name || event.Actor?.ID?.slice(0, 12) || 'unknown';
				const entry: LogEntry = {
					timestamp: new Date(event.time * 1000),
					container: containerName,
					containerId: event.Actor?.ID || '',
					stream: 'stdout',
					message: formatEventMessage(event.Action, containerName, event.Actor?.Attributes || {}),
					level: getEventLevel(event.Action, event.Actor?.Attributes || {}),
					isEvent: true,
					eventType: event.Action as ContainerEventType
				};
				eventQueue.push(entry);
				if (resolveWait) {
					resolveWait();
					resolveWait = null;
				}
			}
		} catch (err) {
			console.error('Failed to parse Docker event:', err);
		}
	});

	eventStream.on('error', (err) => {
		console.error('Docker events stream error:', err);
	});

	while (!signal?.aborted) {
		if (eventQueue.length > 0) {
			yield eventQueue.shift()!;
		} else {
			await new Promise<void>((resolve) => {
				resolveWait = resolve;
				setTimeout(resolve, 50); // Fast poll for responsive streaming
			});
		}
	}

	(eventStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
}

export async function ping(): Promise<boolean> {
	try {
		await docker.ping();
		return true;
	} catch {
		return false;
	}
}

export { docker };
