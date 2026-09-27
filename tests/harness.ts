// Minimal test registry used by scripts/run-tests.mjs.
import assert from 'node:assert/strict';

interface Test { name: string; fn: () => void | Promise<void> }
let tests: Test[] = [];

export const test = (name: string, fn: Test['fn']) => { tests.push({ name, fn }); };
export const reset = () => { tests = []; };
export const registered = () => tests;
export const eq = <T,>(actual: T, expected: T, msg?: string) => assert.deepStrictEqual(actual, expected, msg);
export const ok = (v: unknown, msg?: string) => assert.ok(v, msg);
