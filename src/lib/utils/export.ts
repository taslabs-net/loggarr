import type { LogEntry } from '$lib/types';

export type ExportFormat = 'markdown' | 'json' | 'text';

interface ExportOptions {
	name: string;
	logs: LogEntry[];
	format: ExportFormat;
	createdAt?: string;
}

/**
 * Format logs as Markdown - optimized for LLM context
 */
function toMarkdown(name: string, logs: LogEntry[], createdAt?: string): string {
	const lines: string[] = [];

	lines.push(`# Log Snapshot: ${name}`);
	lines.push('');
	if (createdAt) {
		lines.push(`**Created:** ${new Date(createdAt).toLocaleString()}`);
	}
	lines.push(`**Total Entries:** ${logs.length}`);
	lines.push('');

	// Group by container for better context
	const byContainer = new Map<string, LogEntry[]>();
	for (const log of logs) {
		const existing = byContainer.get(log.container) || [];
		existing.push(log);
		byContainer.set(log.container, existing);
	}

	lines.push('## Summary');
	lines.push('');
	lines.push('| Container | Entries | Errors | Warnings |');
	lines.push('|-----------|---------|--------|----------|');
	for (const [container, entries] of byContainer) {
		const errors = entries.filter((e) => e.level === 'error' || e.level === 'alert').length;
		const warnings = entries.filter((e) => e.level === 'warning').length;
		lines.push(`| ${container} | ${entries.length} | ${errors} | ${warnings} |`);
	}
	lines.push('');

	lines.push('## Logs');
	lines.push('');
	lines.push('```');
	for (const log of logs) {
		const time = new Date(log.timestamp).toISOString();
		const level = log.level.toUpperCase().padEnd(7);
		lines.push(`[${time}] [${level}] [${log.container}] ${log.message}`);
	}
	lines.push('```');

	return lines.join('\n');
}

/**
 * Format logs as JSON
 */
function toJSON(name: string, logs: LogEntry[], createdAt?: string): string {
	return JSON.stringify(
		{
			name,
			createdAt,
			exportedAt: new Date().toISOString(),
			count: logs.length,
			logs: logs.map((log) => ({
				timestamp: log.timestamp,
				container: log.container,
				level: log.level,
				stream: log.stream,
				message: log.message
			}))
		},
		null,
		2
	);
}

/**
 * Format logs as plain text
 */
function toText(name: string, logs: LogEntry[], createdAt?: string): string {
	const lines: string[] = [];

	lines.push(`Log Snapshot: ${name}`);
	if (createdAt) {
		lines.push(`Created: ${new Date(createdAt).toLocaleString()}`);
	}
	lines.push(`Total Entries: ${logs.length}`);
	lines.push('');
	lines.push('='.repeat(80));
	lines.push('');

	for (const log of logs) {
		const time = new Date(log.timestamp).toISOString();
		const level = log.level.toUpperCase().padEnd(7);
		lines.push(`[${time}] [${level}] [${log.container}] ${log.message}`);
	}

	return lines.join('\n');
}

/**
 * Export logs to specified format and trigger download
 */
export function exportLogs({ name, logs, format, createdAt }: ExportOptions): void {
	let content: string;
	let mimeType: string;
	let extension: string;

	switch (format) {
		case 'markdown':
			content = toMarkdown(name, logs, createdAt);
			mimeType = 'text/markdown';
			extension = 'md';
			break;
		case 'json':
			content = toJSON(name, logs, createdAt);
			mimeType = 'application/json';
			extension = 'json';
			break;
		case 'text':
			content = toText(name, logs, createdAt);
			mimeType = 'text/plain';
			extension = 'txt';
			break;
	}

	// Create blob and trigger download
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.${extension}`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
