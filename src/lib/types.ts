export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'alert';

export interface LogEntry {
	timestamp: Date;
	container: string;
	containerId: string;
	stream: 'stdout' | 'stderr';
	message: string;
	level: LogLevel;
}

export interface ContainerSummary {
	id: string;
	name: string;
	image: string;
	state: string;
	status: string;
}

export interface Snapshot {
	id: number;
	name: string;
	createdAt: string;
	logs?: LogEntry[];
}
