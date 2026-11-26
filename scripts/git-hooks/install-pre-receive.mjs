import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const source = resolve(scriptDirectory, 'pre-receive');
const argumentsWithoutFlags = process.argv
  .slice(2)
  .filter((argument) => argument !== '--' && argument !== '--force');
const remotePathArgument = argumentsWithoutFlags[0];
const force = process.argv.includes('--force');

if (!remotePathArgument || argumentsWithoutFlags.length !== 1) {
  console.error('用法：pnpm hooks:install:server -- /path/to/repository.git [--force]');
  process.exit(1);
}

const remotePath = resolve(remotePathArgument);
const repositoryCheck = spawnSync(
  'git',
  ['--git-dir', remotePath, 'rev-parse', '--is-bare-repository'],
  { encoding: 'utf8' },
);

if (repositoryCheck.status !== 0 || repositoryCheck.stdout.trim() !== 'true') {
  console.error(`目标不是 bare Git 仓库：${remotePath}`);
  process.exit(1);
}

const destinationDirectory = resolve(remotePath, 'hooks');
const destination = resolve(destinationDirectory, 'pre-receive');

mkdirSync(destinationDirectory, { recursive: true });

if (existsSync(destination) && !force) {
  console.error(`目标 hook 已存在：${destination}`);
  console.error('请先人工合并现有逻辑，或确认后添加 --force 覆盖。');
  process.exit(1);
}

copyFileSync(source, destination);
chmodSync(destination, 0o755);
console.log(`pre-receive 已安装到：${destination}`);
