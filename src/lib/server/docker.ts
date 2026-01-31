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
}

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'alert';

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

	const streams: { container: ContainerInfo; stream: NodeJS.ReadableStream }[] = [];

	for (const containerInfo of containers) {
		const container = docker.getContainer(containerInfo.Id);
		const logStream = await container.logs({
			follow: true,
			stdout: true,
			stderr: true,
			timestamps: false,
			tail: 10
		});
		streams.push({ container: containerInfo, stream: logStream });
	}

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
				setTimeout(resolve, 1000);
			});
		}
	}

	for (const { stream } of streams) {
		(stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
	}
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
