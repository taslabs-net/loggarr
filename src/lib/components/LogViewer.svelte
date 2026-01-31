<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { LogEntry, LogLevel, ContainerSummary } from '$lib/types';

	interface Props {
		logs: LogEntry[];
		containers: ContainerSummary[];
		selectedContainers: SvelteSet<string>;
		onSaveSnapshot?: (logs: LogEntry[]) => void;
		onContainerFilterChange?: () => void;
		readonly?: boolean;
	}

	let { logs, containers, selectedContainers, onSaveSnapshot, onContainerFilterChange, readonly = false }: Props = $props();

	let paused = $state(false);
	let pausedLogs = $state<LogEntry[]>([]);
	let filterLevels = new SvelteSet<LogLevel>(['alert', 'error', 'warning', 'info', 'debug']);
	let autoScroll = $state(true);
	let logContainer: HTMLElement | null = $state(null);
	let showContainerDropdown = $state(false);
	let searchQuery = $state('');
	let searchRegex = $state<RegExp | null>(null);
	let searchError = $state<string | null>(null);
	let searchInput: HTMLInputElement | null = $state(null);
	let showHelp = $state(false);
	let lastKey = $state('');
	let lastKeyTime = $state(0);
	let selectedLog = $state<LogEntry | null>(null);
	let copyFeedback = $state(false);

	// Update regex when search query changes
	$effect(() => {
		if (!searchQuery.trim()) {
			searchRegex = null;
			searchError = null;
			return;
		}
		try {
			searchRegex = new RegExp(searchQuery, 'i');
			searchError = null;
		} catch {
			searchRegex = null;
			searchError = 'Invalid regex';
		}
	});

	const displayLogs = $derived(paused ? pausedLogs : logs);
	const levelFilteredLogs = $derived(displayLogs.filter((log) => filterLevels.has(log.level)));
	const filteredLogs = $derived(searchRegex ? levelFilteredLogs.filter((log) => searchRegex!.test(log.message)) : levelFilteredLogs);

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

	function toggleContainer(containerId: string) {
		if (selectedContainers.has(containerId)) {
			selectedContainers.delete(containerId);
		} else {
			selectedContainers.add(containerId);
		}
		onContainerFilterChange?.();
	}

	function selectAllContainers() {
		containers.forEach((c) => selectedContainers.add(c.id));
		onContainerFilterChange?.();
	}

	function deselectAllContainers() {
		selectedContainers.clear();
		onContainerFilterChange?.();
	}

	const runningContainers = $derived(containers.filter((c) => c.state === 'running'));

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

	function tryParseJson(str: string): { isJson: boolean; parsed: unknown; formatted: string } {
		try {
			const parsed = JSON.parse(str);
			return { isJson: true, parsed, formatted: JSON.stringify(parsed, null, 2) };
		} catch {
			return { isJson: false, parsed: null, formatted: str };
		}
	}

	function selectLog(log: LogEntry) {
		selectedLog = selectedLog === log ? null : log;
	}

	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
		copyFeedback = true;
		setTimeout(() => (copyFeedback = false), 1500);
	}

	function filterByContainer(containerId: string) {
		// Deselect all, then select only this container
		selectedContainers.clear();
		selectedContainers.add(containerId);
		onContainerFilterChange?.();
		selectedLog = null;
	}

	function getEventIcon(eventType: string | undefined): string {
		switch (eventType) {
			case 'start':
				return '▶';
			case 'stop':
				return '◼';
			case 'restart':
				return '↻';
			case 'die':
				return '✕';
			case 'health_status':
				return '♥';
			case 'create':
				return '+';
			case 'destroy':
				return '−';
			default:
				return '●';
		}
	}

	$effect(() => {
		if (autoScroll && logContainer && !paused) {
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

		// Always allow Escape to close panels
		if (e.key === 'Escape') {
			if (showHelp) {
				showHelp = false;
				e.preventDefault();
			} else if (selectedLog) {
				selectedLog = null;
				e.preventDefault();
			}
			return;
		}

		// Skip shortcuts when typing in inputs (except Escape)
		if (isInput) return;

		const now = Date.now();
		const isSequence = now - lastKeyTime < 500;

		switch (e.key) {
			case ' ':
				if (!readonly) {
					e.preventDefault();
					togglePause();
				}
				break;
			case '/':
				e.preventDefault();
				searchInput?.focus();
				break;
			case 'j':
				if (logContainer) {
					logContainer.scrollBy({ top: 100, behavior: 'smooth' });
				}
				break;
			case 'k':
				if (logContainer) {
					logContainer.scrollBy({ top: -100, behavior: 'smooth' });
				}
				break;
			case 'g':
				if (isSequence && lastKey === 'g' && logContainer) {
					logContainer.scrollTo({ top: 0, behavior: 'smooth' });
					autoScroll = false;
				}
				break;
			case 'G':
				if (logContainer) {
					logContainer.scrollTo({ top: logContainer.scrollHeight, behavior: 'smooth' });
					autoScroll = true;
				}
				break;
			case 's':
				if (!readonly && paused && onSaveSnapshot) {
					handleSaveSnapshot();
				}
				break;
			case '?':
				e.preventDefault();
				showHelp = !showHelp;
				break;
		}

		lastKey = e.key;
		lastKeyTime = now;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="log-viewer">
	{#if showHelp}
		<div class="help-overlay" onclick={() => (showHelp = false)} onkeydown={(e) => e.key === 'Escape' && (showHelp = false)} role="button" tabindex="-1">
			<div class="help-modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
				<h2>Keyboard Shortcuts</h2>
				<div class="shortcut-list">
					<div class="shortcut"><kbd>Space</kbd><span>Pause / Resume</span></div>
					<div class="shortcut"><kbd>/</kbd><span>Focus search</span></div>
					<div class="shortcut"><kbd>j</kbd><span>Scroll down</span></div>
					<div class="shortcut"><kbd>k</kbd><span>Scroll up</span></div>
					<div class="shortcut"><kbd>g g</kbd><span>Go to top</span></div>
					<div class="shortcut"><kbd>G</kbd><span>Go to bottom</span></div>
					<div class="shortcut"><kbd>s</kbd><span>Save snapshot (when paused)</span></div>
					<div class="shortcut"><kbd>?</kbd><span>Toggle this help</span></div>
					<div class="shortcut"><kbd>Esc</kbd><span>Close help / Clear focus</span></div>
				</div>
				<button class="help-close" onclick={() => (showHelp = false)}>Close</button>
			</div>
		</div>
	{/if}

	<div class="controls">
		{#if !readonly}
			<div class="control-group">
				<button class="control-btn" class:active={paused} onclick={togglePause}>
					{paused ? 'Resume' : 'Pause'}
				</button>
				{#if paused}
					<button class="control-btn save" onclick={handleSaveSnapshot}>Save Snapshot</button>
				{/if}
			</div>

			<div class="container-filter">
				<button class="control-btn dropdown-toggle" onclick={() => (showContainerDropdown = !showContainerDropdown)}>
					Containers ({selectedContainers.size}/{runningContainers.length})
					<span class="dropdown-arrow">{showContainerDropdown ? '▲' : '▼'}</span>
				</button>
				{#if showContainerDropdown}
					<div class="dropdown-menu">
						<div class="dropdown-header">
							<button class="dropdown-action" onclick={selectAllContainers}>All</button>
							<button class="dropdown-action" onclick={deselectAllContainers}>None</button>
						</div>
						<div class="dropdown-list">
							{#each runningContainers as container (container.id)}
								<label class="dropdown-item">
									<input type="checkbox" checked={selectedContainers.has(container.id)} onchange={() => toggleContainer(container.id)} />
									<span class="container-name" title={container.name}>{container.name}</span>
									<span class="container-image" title={container.image}>{container.image}</span>
								</label>
							{/each}
							{#if runningContainers.length === 0}
								<div class="dropdown-empty">No running containers</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<div class="filter-group">
			<button class="filter-toggle" onclick={enableAllLevels}>All</button>
			<button class="filter-toggle" onclick={disableAllLevels}>None</button>
			{#each allLevels as level (level)}
				<button class="filter-btn" class:active={filterLevels.has(level)} style="--level-color: {getLevelColor(level)}" onclick={() => toggleLevel(level)}>
					{level}
				</button>
			{/each}
		</div>

		<div class="search-group">
			<input type="text" class="search-input" class:error={searchError} placeholder="Search (regex)" bind:value={searchQuery} bind:this={searchInput} />
			{#if searchQuery}
				<button class="search-clear" onclick={() => (searchQuery = '')}>x</button>
			{/if}
			{#if searchError}
				<span class="search-error">{searchError}</span>
			{/if}
		</div>

		<label class="auto-scroll">
			<input type="checkbox" bind:checked={autoScroll} />
			Auto-scroll
		</label>
	</div>

	<div class="log-area">
		<div class="log-container" bind:this={logContainer}>
			{#each filteredLogs as log (log.timestamp.toString() + log.message + log.containerId)}
				<button class="log-entry" class:event={log.isEvent} class:selected={selectedLog === log} style="--level-color: {getLevelColor(log.level)}" onclick={() => selectLog(log)}>
					<span class="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
					<span class="container">{log.container}</span>
					{#if log.isEvent}
						<span class="event-badge">{getEventIcon(log.eventType)} {log.eventType}</span>
					{:else}
						<span class="level">{log.level}</span>
					{/if}
					<span class="message">{log.message}</span>
				</button>
			{/each}
		</div>

		{#if selectedLog}
			{@const jsonResult = tryParseJson(selectedLog.message)}
			<div class="details-panel">
				<div class="details-header">
					<h3>Log Details</h3>
					<button class="details-close" onclick={() => (selectedLog = null)}>x</button>
				</div>
				<div class="details-content">
					<div class="details-meta">
						<div class="meta-row">
							<span class="meta-label">Time</span>
							<span class="meta-value">{new Date(selectedLog.timestamp).toLocaleString()}</span>
						</div>
						<div class="meta-row">
							<span class="meta-label">Container</span>
							<span class="meta-value container-value">{selectedLog.container}</span>
						</div>
						<div class="meta-row">
							<span class="meta-label">Level</span>
							<span class="meta-value level-value" style="--level-color: {getLevelColor(selectedLog.level)}">{selectedLog.level}</span>
						</div>
						<div class="meta-row">
							<span class="meta-label">Stream</span>
							<span class="meta-value">{selectedLog.stream}</span>
						</div>
						{#if selectedLog.isEvent}
							<div class="meta-row">
								<span class="meta-label">Event</span>
								<span class="meta-value">{selectedLog.eventType}</span>
							</div>
						{/if}
					</div>
					<div class="details-message">
						<div class="message-header">
							<span>{jsonResult.isJson ? 'JSON' : 'Message'}</span>
							<button class="copy-btn" class:copied={copyFeedback} onclick={() => copyToClipboard(jsonResult.isJson ? jsonResult.formatted : selectedLog!.message)}>
								{copyFeedback ? 'Copied!' : 'Copy'}
							</button>
						</div>
						<pre class="message-content" class:json={jsonResult.isJson}>{jsonResult.isJson ? jsonResult.formatted : selectedLog.message}</pre>
					</div>
					<div class="details-actions">
						<button class="action-btn" onclick={() => filterByContainer(selectedLog!.containerId)}>Filter by this container</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="status-bar">
		<span
			>{filteredLogs.length} logs{#if searchQuery && !searchError}
				(filtered from {levelFilteredLogs.length}){/if}</span
		>
		<span class="help-hint">Press <kbd>?</kbd> for shortcuts</span>
		{#if paused}
			<span class="paused-indicator">PAUSED</span>
		{/if}
		<span class="version">v{__APP_VERSION__}</span>
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

	.container-filter {
		position: relative;
	}

	.dropdown-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dropdown-arrow {
		font-size: 0.6rem;
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 0.25rem;
		min-width: 280px;
		max-height: 300px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 50;
		display: flex;
		flex-direction: column;
	}

	.dropdown-header {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.dropdown-action {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.dropdown-action:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.dropdown-list {
		overflow-y: auto;
		flex: 1;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.dropdown-item:hover {
		background: var(--bg-hover);
	}

	.dropdown-item input[type='checkbox'] {
		cursor: pointer;
	}

	.container-name {
		color: var(--color-accent);
		flex-shrink: 0;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.container-image {
		color: var(--text-secondary);
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dropdown-empty {
		padding: 1rem;
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.8125rem;
	}

	.search-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: relative;
	}

	.search-input {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		border-radius: 4px;
		font-size: 0.8125rem;
		font-family: inherit;
		width: 160px;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.search-input.error {
		border-color: var(--color-error);
	}

	.search-clear {
		position: absolute;
		right: 0.5rem;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0.25rem;
		line-height: 1;
	}

	.search-clear:hover {
		color: var(--text-primary);
	}

	.search-error {
		color: var(--color-error);
		font-size: 0.75rem;
	}

	.auto-scroll {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.log-area {
		flex: 1;
		display: flex;
		overflow: hidden;
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
		border: none;
		border-left: 3px solid var(--level-color);
		margin-bottom: 2px;
		background: var(--bg-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
		width: 100%;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
		color: inherit;
	}

	.log-entry:hover {
		background: var(--bg-hover);
	}

	.log-entry.selected {
		background: var(--bg-hover);
		outline: 1px solid var(--color-accent);
	}

	.log-entry.event {
		background: linear-gradient(90deg, var(--bg-secondary) 0%, rgba(var(--color-accent-rgb, 99, 102, 241), 0.1) 100%);
		border-left-color: var(--color-accent);
	}

	.event-badge {
		color: var(--color-accent);
		text-transform: uppercase;
		font-weight: 600;
		font-size: 0.75rem;
		min-width: 80px;
		display: flex;
		align-items: center;
		gap: 0.25rem;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Details Panel */
	.details-panel {
		width: 400px;
		min-width: 300px;
		max-width: 50%;
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.details-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.details-header h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.details-close {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 1.25rem;
		padding: 0.25rem;
		line-height: 1;
	}

	.details-close:hover {
		color: var(--text-primary);
	}

	.details-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.details-meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meta-row {
		display: flex;
		gap: 1rem;
		font-size: 0.8125rem;
	}

	.meta-label {
		color: var(--text-secondary);
		min-width: 80px;
	}

	.meta-value {
		color: var(--text-primary);
	}

	.meta-value.container-value {
		color: var(--color-accent);
	}

	.meta-value.level-value {
		color: var(--level-color);
		text-transform: uppercase;
		font-weight: 600;
	}

	.details-message {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.copy-btn {
		padding: 0.25rem 0.5rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.7rem;
	}

	.copy-btn:hover {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.copy-btn.copied {
		color: var(--color-success);
		border-color: var(--color-success);
	}

	.message-content {
		flex: 1;
		margin: 0;
		padding: 0.75rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 0.75rem;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.message-content.json {
		color: var(--color-accent);
	}

	.details-actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		flex: 1;
		padding: 0.5rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.action-btn:hover {
		background: var(--bg-hover);
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

	.version {
		margin-left: auto;
	}

	.help-hint {
		color: var(--text-secondary);
		font-size: 0.7rem;
	}

	.help-hint kbd {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 3px;
		padding: 0.1rem 0.3rem;
		font-family: inherit;
		font-size: 0.65rem;
	}

	.help-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.help-modal {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1.5rem;
		min-width: 320px;
		max-width: 90vw;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.help-modal h2 {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.shortcut-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shortcut {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.8125rem;
	}

	.shortcut kbd {
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		font-family: inherit;
		font-size: 0.75rem;
		min-width: 60px;
		text-align: center;
		color: var(--color-accent);
	}

	.shortcut span {
		color: var(--text-secondary);
	}

	.help-close {
		margin-top: 1.5rem;
		width: 100%;
		padding: 0.5rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 4px;
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.help-close:hover {
		background: var(--bg-hover);
	}
</style>
