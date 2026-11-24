// Launches Vitest with a normalized working directory.
//
// Windows workaround: when the process starts in a directory with a lowercase
// drive letter (e.g. `c:\...`, as some editors launch terminals), Vitest loads
// its runner twice and every test file fails with
// "Cannot read properties of undefined (reading 'config')".
// Running Vitest from the same directory with an uppercase drive letter avoids it.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** @param {string} path */
const upperDrive = (path) => path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

const cwd = upperDrive(process.cwd());
const vitestCli = upperDrive(
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
);

const result = spawnSync(process.execPath, [vitestCli, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
