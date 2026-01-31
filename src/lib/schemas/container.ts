import { z } from 'zod';

export const ContainerSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	image: z.string(),
	state: z.string(),
	status: z.string()
});

export const ContainerListResponseSchema = z.array(ContainerSummarySchema);

export type ContainerSummary = z.infer<typeof ContainerSummarySchema>;
