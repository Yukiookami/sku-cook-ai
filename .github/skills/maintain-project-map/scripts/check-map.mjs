import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function isProjectFile(file) {
  const normalized = file.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (
    parts[0] === 'storage' ||
    parts.some((part) => ['.git', 'node_modules', 'dist', 'coverage'].includes(part))
  ) {
    return false;
  }
  const name = parts.at(-1);
  return name === '.env.example' || !(name === '.env' || name.startsWith('.env.'));
}

export function checkMap(text, files) {
  const entries = new Map();
  const errors = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*$/);
    if (!match) continue;
    const [, file, description] = match;
    if (
      file.includes('\\') ||
      path.posix.isAbsolute(file) ||
      file.split('/').some((part) => part === '..' || part === '.' || part === '') ||
      /^[A-Za-z]:/.test(file)
    ) {
      errors.push(`路径不是规范仓库相对路径：${file}`);
    }
    if (entries.has(file)) errors.push(`重复登记：${file}`);
    if (!description.trim()) errors.push(`缺少职责说明：${file}`);
    entries.set(file, description);
  }
  const actual = new Set(files);
  for (const file of actual) {
    if (!entries.has(file)) errors.push(`未登记：${file}`);
  }
  for (const file of entries.keys()) {
    if (!actual.has(file)) errors.push(`实际不存在或不应登记：${file}`);
  }
  return { errors, count: actual.size };
}

function main() {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const output = execFileSync(
    'git',
    ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' },
  );
  const files = output.split('\0').filter((file) => {
    if (!file || !isProjectFile(file)) return false;
    const absolute = path.join(root, file);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  const text = readFileSync(path.join(root, 'docs', 'architecture', 'PROJECT_MAP.md'), 'utf8');
  const { errors, count } = checkMap(text, files);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.info(`项目地图检查通过：${count} 个实际文件均已登记，无重复或空职责。`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error('项目地图检查无法执行：', error);
    process.exitCode = 1;
  }
}
