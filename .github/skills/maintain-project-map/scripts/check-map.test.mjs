import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkMap, isProjectFile } from './check-map.mjs';

test('完整清单接受中文职责和 CRLF', () => {
  const result = checkMap('| `src/main.ts` | 应用入口 |\r\n', ['src/main.ts']);
  assert.deepEqual(result, { errors: [], count: 1 });
});

test('报告遗漏、陈旧条目、重复和空职责', () => {
  const result = checkMap('| `old.ts` | 旧文件 |\n| `old.ts` | 重复 |\n| `empty.ts` | |\n', [
    'new.ts',
    'empty.ts',
  ]);
  assert.ok(result.errors.some((error) => error.includes('未登记：new.ts')));
  assert.ok(result.errors.some((error) => error.includes('实际不存在或不应登记：old.ts')));
  assert.ok(result.errors.some((error) => error.includes('重复登记：old.ts')));
  assert.ok(result.errors.some((error) => error.includes('缺少职责说明：empty.ts')));
});

test('拒绝越界、绝对路径和反斜杠登记', () => {
  for (const file of ['../secret', '/tmp/main.ts', 'C:/main.ts', 'src\\main.ts', './main.ts']) {
    const result = checkMap(`| \`${file}\` | 测试 |\n`, []);
    assert.ok(result.errors.some((error) => error.includes('路径不是规范仓库相对路径')));
  }
});

test('只排除真实环境文件和运行产物，保留示例与源码', () => {
  for (const file of [
    '.env',
    'apps/api/.env.local',
    'node_modules/pkg/a.js',
    'apps/web/dist/a.js',
  ]) {
    assert.equal(isProjectFile(file), false);
  }
  for (const file of [
    '.env.example',
    'apps/api/.env.example',
    'pnpm-lock.yaml',
    '.github/a.md',
    'apps/api/src/storage/local-storage.ts',
  ]) {
    assert.equal(isProjectFile(file), true);
  }
});
