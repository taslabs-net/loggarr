import { z } from 'zod';

export const HealthResponseSchema = z.object({
	status: z.enum(['healthy', 'unhealthy']),
	docker: z.boolean()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
