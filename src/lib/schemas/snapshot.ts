import { z } from 'zod';
import { LogEntrySchema } from './log';

export const SnapshotSummarySchema = z.object({
	id: z.number(),
	name: z.string(),
	createdAt: z.string()
});

export const SnapshotSchema = SnapshotSummarySchema.extend({
	logs: z.array(LogEntrySchema)
});

export const SnapshotListResponseSchema = z.array(SnapshotSummarySchema);

export const CreateSnapshotRequestSchema = z.object({
	name: z.string().min(1).max(255),
	logs: z.array(LogEntrySchema)
});

export const CreateSnapshotResponseSchema = z.object({
	id: z.number(),
	name: z.string()
});

export const DeleteSnapshotResponseSchema = z.object({
	success: z.boolean()
});

export type SnapshotSummary = z.infer<typeof SnapshotSummarySchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type CreateSnapshotRequest = z.infer<typeof CreateSnapshotRequestSchema>;
