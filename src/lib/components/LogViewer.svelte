<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { LogEntry, LogLevel } from '$lib/types';

	interface Props {
		logs: LogEntry[];
		onSaveSnapshot?: (logs: LogEntry[]) => void;
	}

	let { logs, onSaveSnapshot }: Props = $props();

	let paused = $state(false);
	let pausedLogs = $state<LogEntry[]>([]);
	let filterLevels = new SvelteSet<LogLevel>(['alert', 'error', 'warning', 'info', 'debug']);
	let autoScroll = $state(true);
	let logContainer: HTMLElement | null = $state(null);

	const displayLogs = $derived(paused ? pausedLogs : logs);
	const filteredLogs = $derived(displayLogs.filter((log) => filterLevels.has(log.level)));

	function togglePause() {
		if (!paused) {
			pausedLogs = [...logs];
		}
		paused = !paused;
	}

	const allLevels: LogLevel[] = ['alert', 'error', 'warning', 'info', 'debug'];

	function toggleLevel(level: LogLevel) {
		if (filterLevels.has(level)) {
			filterLevels.delete(level);
		} else {
			filterLevels.add(level);
		}
	}

	function enableAllLevels() {
		allLevels.forEach((level) => filterLevels.add(level));
	}

	function disableAllLevels() {
		filterLevels.clear();
	}

	function handleSaveSnapshot() {
		if (onSaveSnapshot && paused) {
			onSaveSnapshot(pausedLogs);
		}
	}

	function getLevelColor(level: LogLevel): string {
		switch (level) {
			case 'alert':
				return 'var(--color-alert)';
			case 'error':
				return 'var(--color-error)';
			case 'warning':
				return 'var(--color-warning)';
			case 'info':
				return 'var(--color-info)';
			case 'debug':
				return 'var(--color-debug)';
		}
	}

	$effect(() => {
		if (autoScroll && logContainer && !paused) {
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});
</script>

<div class="log-viewer">
	<div class="controls">
		<div class="control-group">
			<button class="control-btn" class:active={paused} onclick={togglePause}>
				{paused ? 'Resume' : 'Pause'}
			</button>
			{#if paused}
				<button class="control-btn save" onclick={handleSaveSnapshot}>Save Snapshot</button>
			{/if}
		</div>

		<div class="filter-group">
			<button class="filter-toggle" onclick={enableAllLevels}>All</button>
			<button class="filter-toggle" onclick={disableAllLevels}>None</button>
			{#each allLevels as level (level)}
				<button class="filter-btn" class:active={filterLevels.has(level)} style="--level-color: {getLevelColor(level)}" onclick={() => toggleLevel(level)}>
					{level}
				</button>
			{/each}
		</div>

		<label class="auto-scroll">
			<input type="checkbox" bind:checked={autoScroll} />
			Auto-scroll
		</label>
	</div>

	<div class="log-container" bind:this={logContainer}>
		{#each filteredLogs as log (log.timestamp.toString() + log.message)}
			<div class="log-entry" style="--level-color: {getLevelColor(log.level)}">
				<span class="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
				<span class="container">{log.container}</span>
				<span class="level">{log.level}</span>
				<span class="message">{log.message}</span>
			</div>
		{/each}
	</div>

	<div class="status-bar">
		<span>{filteredLogs.length} logs</span>
		{#if paused}
			<span class="paused-indicator">PAUSED</span>
		{/if}
	</div>
</div>

<style>
	.log-viewer {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: 'Fira Code', 'Consolas', monospace;
	}

	.controls {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		flex-wrap: wrap;
		align-items: center;
	}

	.control-group {
		display: flex;
		gap: 0.5rem;
	}

	.control-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.control-btn:hover {
		background: var(--bg-hover);
	}

	.control-btn.active {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}

	.control-btn.save {
		background: var(--color-success);
		color: white;
		border-color: var(--color-success);
	}

	.filter-group {
		display: flex;
		gap: 0.25rem;
	}

	.filter-btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--level-color);
		background: transparent;
		color: var(--level-color);
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.filter-btn.active {
		background: var(--level-color);
		color: white;
	}

	.filter-toggle {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.filter-toggle:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.auto-scroll {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.log-container {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.log-entry {
		display: grid;
		grid-template-columns: auto auto auto 1fr;
		gap: 1rem;
		padding: 0.25rem 0.5rem;
		border-left: 3px solid var(--level-color);
		margin-bottom: 2px;
		background: var(--bg-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.log-entry:hover {
		background: var(--bg-hover);
	}

	.timestamp {
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.container {
		color: var(--color-accent);
		white-space: nowrap;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.level {
		color: var(--level-color);
		text-transform: uppercase;
		font-weight: 600;
		font-size: 0.75rem;
		min-width: 60px;
	}

	.message {
		color: var(--text-primary);
		word-break: break-word;
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.paused-indicator {
		color: var(--color-warning);
		font-weight: 600;
	}
</style>
