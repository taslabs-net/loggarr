import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveSnapshot, getSnapshots } from '$lib/server/storage';
import { snapshotCount } from '$lib/server/metrics';
import { CreateSnapshotRequestSchema } from '$lib/schemas/snapshot';

export const GET: RequestHandler = async () => {
	const snapshots = getSnapshots();
	snapshotCount.set(snapshots.length);
	return json(snapshots);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const result = CreateSnapshotRequestSchema.safeParse(body);
	if (!result.success) {
		return json({ error: result.error.issues[0]?.message || 'Invalid request body' }, { status: 400 });
	}

	const { name, logs } = result.data;
	const id = saveSnapshot(name, logs);
	snapshotCount.inc();

	return json({ id, name }, { status: 201 });
};
