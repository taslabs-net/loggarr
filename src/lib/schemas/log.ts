import { z } from 'zod';

export const LogLevelSchema = z.enum(['debug', 'info', 'warning', 'error', 'alert']);

export const LogEntrySchema = z.object({
	timestamp: z.coerce.date(),
	container: z.string(),
	containerId: z.string(),
	stream: z.enum(['stdout', 'stderr']),
	message: z.string(),
	level: LogLevelSchema
});

export type LogLevel = z.infer<typeof LogLevelSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
