import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ping } from '$lib/server/docker';

export const GET: RequestHandler = async () => {
	const dockerConnected = await ping();

	if (!dockerConnected) {
		return json({ status: 'unhealthy', docker: false }, { status: 503 });
	}

	return json({ status: 'healthy', docker: true });
};
