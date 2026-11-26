import { basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function git(args, options = {}) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    ...options,
  });
}

function fail(message) {
  console.error(`\npre-commit: ${message}`);
  process.exitCode = 1;
}

const diffCheck = git(['diff', '--cached', '--check']);

if (diffCheck.status !== 0) {
  process.stderr.write(diffCheck.stdout || diffCheck.stderr);
  fail('发现尾随空格、空白错误或未解决的冲突标记。');
}

const stagedFilesResult = git([
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACMR',
  '-z',
]);

if (stagedFilesResult.status !== 0) {
  process.stderr.write(stagedFilesResult.stderr);
  fail('无法读取暂存区文件。');
} else {
  const stagedFiles = stagedFilesResult.stdout.split('\0').filter(Boolean);

  for (const file of stagedFiles) {
    const fileName = basename(file);
    const isEnvironmentFile =
      (fileName === '.env' || fileName.startsWith('.env.')) && !fileName.endsWith('.example');
    const isPrivateKey =
      /\.(?:pem|key|p12|pfx)$/i.test(fileName) || /^(?:id_rsa|id_ed25519)$/i.test(fileName);

    if (isEnvironmentFile || isPrivateKey) {
      fail(`禁止提交疑似敏感文件：${file}`);
      continue;
    }

    const sizeResult = git(['cat-file', '-s', `:${file}`]);
    const size = Number.parseInt(sizeResult.stdout, 10);

    if (sizeResult.status === 0 && Number.isFinite(size) && size > MAX_FILE_SIZE) {
      fail(`文件超过 5 MiB，请改用对象存储或 Git LFS：${file}`);
    }
  }
}

if (process.exitCode) {
  console.error('pre-commit: 基础检查失败，修复后重新暂存再提交。');
} else {
  console.log('pre-commit: 暂存区基础检查通过。');
}
