import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listContainers } from '$lib/server/docker';
import { containersMonitored } from '$lib/server/metrics';

export const GET: RequestHandler = async () => {
	const containers = await listContainers();
	containersMonitored.set(containers.filter((c) => c.state === 'running').length);
	return json(containers);
};
