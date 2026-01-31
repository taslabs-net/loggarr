import type { RequestHandler } from './$types';
import { registry } from '$lib/server/metrics';

export const GET: RequestHandler = async () => {
	const metrics = await registry.metrics();

	return new Response(metrics, {
		headers: {
			'Content-Type': registry.contentType
		}
	});
};
