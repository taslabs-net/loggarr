import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSnapshot, deleteSnapshot } from '$lib/server/storage';
import { snapshotCount } from '$lib/server/metrics';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid snapshot ID' }, { status: 400 });
	}

	const snapshot = getSnapshot(id);
	if (!snapshot) {
		return json({ error: 'Snapshot not found' }, { status: 404 });
	}

	return json(snapshot);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid snapshot ID' }, { status: 400 });
	}

	const deleted = deleteSnapshot(id);
	if (!deleted) {
		return json({ error: 'Snapshot not found' }, { status: 404 });
	}

	snapshotCount.dec();
	return json({ success: true });
};
