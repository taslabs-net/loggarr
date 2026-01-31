<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import LogViewer from '$lib/components/LogViewer.svelte';
	import SnapshotBrowser from '$lib/components/SnapshotBrowser.svelte';
	import type { LogEntry, ContainerSummary } from '$lib/types';
	import { env } from '$env/dynamic/public';
	import { exportLogs } from '$lib/utils/export';

	const bufferSize = parseInt(env.PUBLIC_LOG_BUFFER_SIZE || '100', 10);

	let logs = $state<LogEntry[]>([]);
	let containers = $state<ContainerSummary[]>([]);
	let selectedContainers = new SvelteSet<string>();
	let eventSource: EventSource | null = $state(null);
	let connected = $state(false);
	let error = $state<string | null>(null);
	let snapshotName = $state('');
	let showSnapshotDialog = $state(false);
	let logsToSave = $state<LogEntry[]>([]);

	// Snapshot browser state
	let showSnapshotBrowser = $state(false);
	let viewingSnapshot = $state<{ name: string; logs: LogEntry[] } | null>(null);

	// Log batching - micro-batch for performance while staying responsive
	let pendingLogs: LogEntry[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	let lastFlush = 0;
	const DEBOUNCE_MS = 50; // short debounce for snappy feel
	const MAX_WAIT_MS = 150; // force flush quickly for real-time feel

	function flushLogs() {
		if (pendingLogs.length === 0) return;

		// Batch update: add all pending logs at once
		logs = [...logs, ...pendingLogs].slice(-bufferSize);
		pendingLogs = [];
		flushTimer = null;
		lastFlush = Date.now();
	}

	function queueLog(entry: LogEntry) {
		pendingLogs.push(entry);

		// Clear existing timer
		if (flushTimer) {
			clearTimeout(flushTimer);
		}

		// Force flush if we've waited too long (maxWait)
		const timeSinceLastFlush = Date.now() - lastFlush;
		if (timeSinceLastFlush >= MAX_WAIT_MS) {
			flushLogs();
		} else {
			// Debounce: schedule flush
			flushTimer = setTimeout(flushLogs, DEBOUNCE_MS);
		}
	}

	async function fetchContainers() {
		try {
			const response = await fetch('/api/v1/containers');
			if (response.ok) {
				containers = await response.json();
				// Auto-select all running containers on first load
				if (selectedContainers.size === 0) {
					containers.filter((c) => c.state === 'running').forEach((c) => selectedContainers.add(c.id));
				}
			}
		} catch (err) {
			console.error('Failed to fetch containers:', err);
		}
	}

	function connect() {
		const containerIds = Array.from(selectedContainers);
		const queryString = containerIds.length > 0 ? `?containers=${containerIds.join(',')}` : '';
		eventSource = new EventSource(`/api/v1/logs${queryString}`);

		eventSource.onopen = () => {
			connected = true;
			error = null;
		};

		eventSource.onmessage = (event) => {
			const entry = JSON.parse(event.data) as LogEntry;
			entry.timestamp = new Date(entry.timestamp);

			queueLog(entry);
		};

		eventSource.onerror = () => {
			connected = false;
			error = 'Connection lost. Retrying...';
		};
	}

	function disconnect() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		// Clean up pending logs
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
		if (pendingLogs.length > 0) {
			flushLogs(); // Flush any remaining logs
		}
		connected = false;
	}

	async function saveSnapshot() {
		if (!snapshotName.trim()) return;

		try {
			const response = await fetch('/api/v1/snapshots', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: snapshotName.trim(), logs: logsToSave })
			});

			if (response.ok) {
				showSnapshotDialog = false;
				snapshotName = '';
				logsToSave = [];
			}
		} catch (err) {
			console.error('Failed to save snapshot:', err);
		}
	}

	function handleSaveSnapshot(pausedLogs: LogEntry[]) {
		logsToSave = pausedLogs;
		showSnapshotDialog = true;
	}

	function handleContainerFilterChange() {
		// Clear logs and reconnect with new filter
		logs = [];
		disconnect();
		connect();
	}

	function handleViewSnapshot(snapshotLogs: LogEntry[], name: string) {
		// Convert timestamp strings back to Date objects
		viewingSnapshot = {
			name,
			logs: snapshotLogs.map((log) => ({
				...log,
				timestamp: new Date(log.timestamp)
			}))
		};
		showSnapshotBrowser = false;
	}

	function closeSnapshotViewer() {
		viewingSnapshot = null;
	}

	function exportCurrentSnapshot() {
		if (!viewingSnapshot) return;
		exportLogs({
			name: viewingSnapshot.name,
			logs: viewingSnapshot.logs,
			format: 'markdown'
		});
	}

	onMount(async () => {
		await fetchContainers();
		connect();
	});

	onDestroy(() => {
		disconnect();
	});
</script>

<svelte:head>
	<title>Loggarr{viewingSnapshot ? ` - ${viewingSnapshot.name}` : ''}</title>
</svelte:head>

<div class="app">
	<header>
		<h1>Loggarr</h1>
		<div class="header-actions">
			{#if viewingSnapshot}
				<span class="viewing-snapshot">Viewing: {viewingSnapshot.name}</span>
				<button class="header-btn export" onclick={exportCurrentSnapshot}>Export MD</button>
				<button class="header-btn" onclick={closeSnapshotViewer}>Back to Live</button>
			{:else}
				<button class="header-btn" class:active={showSnapshotBrowser} onclick={() => (showSnapshotBrowser = !showSnapshotBrowser)}> Snapshots </button>
				<div class="status">
					<span class="status-indicator" class:connected></span>
					{connected ? 'Connected' : 'Disconnected'}
				</div>
			{/if}
		</div>
	</header>

	<div class="content">
		<main>
			{#if error && !viewingSnapshot}
				<div class="error-banner">{error}</div>
			{/if}
			{#if viewingSnapshot}
				<LogViewer logs={viewingSnapshot.logs} {containers} {selectedContainers} readonly />
			{:else}
				<LogViewer {logs} {containers} {selectedContainers} onSaveSnapshot={handleSaveSnapshot} onContainerFilterChange={handleContainerFilterChange} />
			{/if}
		</main>

		{#if showSnapshotBrowser && !viewingSnapshot}
			<SnapshotBrowser onViewSnapshot={handleViewSnapshot} onClose={() => (showSnapshotBrowser = false)} />
		{/if}
	</div>
</div>

{#if showSnapshotDialog}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="dialog-overlay" onclick={() => (showSnapshotDialog = false)} role="presentation">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
			<h2>Save Snapshot</h2>
			<!-- svelte-ignore a11y_autofocus -->
			<input type="text" bind:value={snapshotName} placeholder="Snapshot name" autofocus />
			<div class="dialog-actions">
				<button onclick={() => (showSnapshotDialog = false)}>Cancel</button>
				<button class="primary" onclick={saveSnapshot}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(:root) {
		--bg-primary: #0d1117;
		--bg-secondary: #161b22;
		--bg-hover: #21262d;
		--text-primary: #c9d1d9;
		--text-secondary: #8b949e;
		--border-color: #30363d;
		--color-accent: #58a6ff;
		--color-success: #3fb950;
		--color-alert: #f85149;
		--color-error: #f85149;
		--color-warning: #d29922;
		--color-info: #58a6ff;
		--color-debug: #8b949e;
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.header-btn:hover {
		background: var(--bg-hover);
	}

	.header-btn.active {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.header-btn.export {
		background: var(--color-success);
		color: white;
		border-color: var(--color-success);
	}

	.header-btn.export:hover {
		opacity: 0.9;
	}

	.viewing-snapshot {
		font-size: 0.875rem;
		color: var(--color-warning);
		font-weight: 500;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-error);
	}

	.status-indicator.connected {
		background: var(--color-success);
	}

	.content {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		background: rgba(248, 81, 73, 0.1);
		border-bottom: 1px solid var(--color-error);
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dialog {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1.5rem;
		min-width: 300px;
	}

	.dialog h2 {
		margin-bottom: 1rem;
		font-size: 1.125rem;
	}

	.dialog input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.dialog button {
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.dialog button:hover {
		background: var(--bg-hover);
	}

	.dialog button.primary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: white;
	}
</style>
