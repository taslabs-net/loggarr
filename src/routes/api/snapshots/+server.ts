import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveSnapshot, getSnapshots } from '$lib/server/storage';
import { snapshotCount } from '$lib/server/metrics';
import type { LogEntry } from '$lib/server/docker';

export const GET: RequestHandler = async () => {
	const snapshots = getSnapshots();
	snapshotCount.set(snapshots.length);
	return json(snapshots);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { name: string; logs: LogEntry[] };
	const { name, logs } = body;

	if (!name || !logs || !Array.isArray(logs)) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const id = saveSnapshot(name, logs);
	snapshotCount.inc();

	return json({ id, name }, { status: 201 });
};
