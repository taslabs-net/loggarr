import { z } from 'zod';

export const ErrorResponseSchema = z.object({
	error: z.string()
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
