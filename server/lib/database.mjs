import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDirectory, '../..');
const runtimeDirectory = resolve(projectRoot, 'data/runtime');
const databasePath = process.env.DATABASE_PATH || resolve(runtimeDirectory, 'premium.db');

mkdirSync(runtimeDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON;');
database.exec('PRAGMA journal_mode = WAL;');
database.exec(readFileSync(resolve(projectRoot, 'db/schema.sql'), 'utf8'));
database.exec(readFileSync(resolve(projectRoot, 'db/seed.sql'), 'utf8'));

export function getDatabase() {
  return database;
}

export function closeDatabase() {
  database.close();
}

