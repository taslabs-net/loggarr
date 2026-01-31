import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import type { LogEntry } from './docker';
import fs from 'fs';
import path from 'path';

const DATA_DIR = env.DATA_DIR || './data';

if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'loggarr.db'));

db.exec(`
	CREATE TABLE IF NOT EXISTS snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		logs TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS config (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
`);

export interface Snapshot {
	id: number;
	name: string;
	createdAt: string;
	logs: LogEntry[];
}

export function saveSnapshot(name: string, logs: LogEntry[]): number {
	const stmt = db.prepare('INSERT INTO snapshots (name, logs) VALUES (?, ?)');
	const result = stmt.run(name, JSON.stringify(logs));
	return result.lastInsertRowid as number;
}

export function getSnapshots(): Omit<Snapshot, 'logs'>[] {
	const stmt = db.prepare('SELECT id, name, created_at as createdAt FROM snapshots ORDER BY created_at DESC');
	return stmt.all() as Omit<Snapshot, 'logs'>[];
}

export function getSnapshot(id: number): Snapshot | null {
	const stmt = db.prepare('SELECT id, name, created_at as createdAt, logs FROM snapshots WHERE id = ?');
	const row = stmt.get(id) as { id: number; name: string; createdAt: string; logs: string } | undefined;
	if (!row) return null;
	return {
		...row,
		logs: JSON.parse(row.logs)
	};
}

export function deleteSnapshot(id: number): boolean {
	const stmt = db.prepare('DELETE FROM snapshots WHERE id = ?');
	const result = stmt.run(id);
	return result.changes > 0;
}

export function getConfig(key: string, defaultValue?: string): string | undefined {
	const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
	const row = stmt.get(key) as { value: string } | undefined;
	return row?.value ?? defaultValue;
}

export function setConfig(key: string, value: string): void {
	const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
	stmt.run(key, value);
}

export { db };
