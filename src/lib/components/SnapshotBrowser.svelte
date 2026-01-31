<script lang="ts">
	import type { Snapshot, LogEntry } from '$lib/types';

	interface Props {
		onViewSnapshot: (logs: LogEntry[], name: string) => void;
		onClose: () => void;
	}

	let { onViewSnapshot, onClose }: Props = $props();

	let snapshots = $state<Snapshot[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let deletingId = $state<number | null>(null);

	async function fetchSnapshots() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/v1/snapshots');
			if (response.ok) {
				snapshots = await response.json();
			} else {
				error = 'Failed to load snapshots';
			}
		} catch (err) {
			error = 'Failed to load snapshots';
			console.error('Failed to fetch snapshots:', err);
		} finally {
			loading = false;
		}
	}

	async function viewSnapshot(id: number) {
		try {
			const response = await fetch(`/api/v1/snapshots/${id}`);
			if (response.ok) {
				const snapshot: Snapshot = await response.json();
				if (snapshot.logs) {
					onViewSnapshot(snapshot.logs, snapshot.name);
				}
			}
		} catch (err) {
			console.error('Failed to load snapshot:', err);
		}
	}

	async function deleteSnapshot(id: number) {
		if (!confirm('Delete this snapshot?')) return;

		deletingId = id;
		try {
			const response = await fetch(`/api/v1/snapshots/${id}`, { method: 'DELETE' });
			if (response.ok) {
				snapshots = snapshots.filter((s) => s.id !== id);
			}
		} catch (err) {
			console.error('Failed to delete snapshot:', err);
		} finally {
			deletingId = null;
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleString();
	}

	$effect(() => {
		fetchSnapshots();
	});
</script>

<div class="snapshot-browser">
	<div class="header">
		<h2>Saved Snapshots</h2>
		<button class="close-btn" onclick={onClose}>X</button>
	</div>

	<div class="content">
		{#if loading}
			<div class="loading">Loading snapshots...</div>
		{:else if error}
			<div class="error">{error}</div>
		{:else if snapshots.length === 0}
			<div class="empty">No snapshots saved yet. Pause logs and click "Save Snapshot" to create one.</div>
		{:else}
			<div class="snapshot-list">
				{#each snapshots as snapshot (snapshot.id)}
					<div class="snapshot-item">
						<div class="snapshot-info">
							<span class="snapshot-name">{snapshot.name}</span>
							<span class="snapshot-date">{formatDate(snapshot.createdAt)}</span>
						</div>
						<div class="snapshot-actions">
							<button class="view-btn" onclick={() => viewSnapshot(snapshot.id)}>View</button>
							<button class="delete-btn" onclick={() => deleteSnapshot(snapshot.id)} disabled={deletingId === snapshot.id}>
								{deletingId === snapshot.id ? '...' : 'Delete'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.snapshot-browser {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-color);
		min-width: 300px;
		max-width: 400px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.header h2 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 1rem;
		padding: 0.25rem 0.5rem;
	}

	.close-btn:hover {
		color: var(--text-primary);
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.loading,
	.error,
	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.error {
		color: var(--color-error);
	}

	.snapshot-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.snapshot-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
	}

	.snapshot-item:hover {
		border-color: var(--color-accent);
	}

	.snapshot-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.snapshot-name {
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.snapshot-date {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.snapshot-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.view-btn,
	.delete-btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.view-btn {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.view-btn:hover {
		opacity: 0.9;
	}

	.delete-btn {
		background: var(--bg-secondary);
		color: var(--text-secondary);
	}

	.delete-btn:hover {
		background: var(--color-error);
		color: white;
		border-color: var(--color-error);
	}

	.delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
