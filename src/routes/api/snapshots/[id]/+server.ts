import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSnapshot, deleteSnapshot } from '$lib/server/storage';
import { snapshotCount } from '$lib/server/metrics';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid snapshot ID');
	}

	const snapshot = getSnapshot(id);
	if (!snapshot) {
		throw error(404, 'Snapshot not found');
	}

	return json(snapshot);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) {
		throw error(400, 'Invalid snapshot ID');
	}

	const deleted = deleteSnapshot(id);
	if (!deleted) {
		throw error(404, 'Snapshot not found');
	}

	snapshotCount.dec();
	return json({ success: true });
};
