/**
 * Provisions the hermetic integration-test database.
 *
 * Derives the test URL from DATABASE_URL (or the same localhost default
 * src/lib/prisma.ts falls back to) by swapping the database name to
 * `veganmealplanner_test`, then drops and recreates it so every
 * check-integration run starts from a clean, migration-built schema.
 * The dev database is never modified — only connected to for admin statements.
 *
 * Prints the test database URL on the last line for the calling script to use.
 */
import { SQL } from 'bun';

const TEST_DB_NAME = 'veganmealplanner_test';

const source = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/veganmealplanner';
const url = new URL(source);
url.pathname = `/${TEST_DB_NAME}`;
if (url.pathname !== `/${TEST_DB_NAME}`) throw new Error('failed to derive test database URL');

const admin = new SQL(source);
await admin`DROP DATABASE IF EXISTS veganmealplanner_test WITH (FORCE)`;
await admin`CREATE DATABASE veganmealplanner_test`;
await admin.end();

console.log(`provisioned ${TEST_DB_NAME} (dropped and recreated)`);
console.log(url.toString());
