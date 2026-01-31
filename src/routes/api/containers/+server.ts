import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listContainers } from '$lib/server/docker';

export const GET: RequestHandler = async () => {
	const containers = await listContainers();
	return json(containers);
};
