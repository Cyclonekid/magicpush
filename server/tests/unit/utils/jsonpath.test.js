/**
 * jsonpath 工具单元测试（基于 Node 内置 node:test，无第三方依赖）
 *
 * 覆盖：getValue（路径读取）、extractFields（字段映射+字面量+默认值）、
 * getPresetTemplate / getAllPresetTemplates（预设模板）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { getValue, extractFields, getPresetTemplate, getAllPresetTemplates } =
  require('../../../src/utils/jsonpath');

test('getValue：非法路径返回 undefined', () => {
  assert.strictEqual(getValue({ a: 1 }, undefined), undefined);
  assert.strictEqual(getValue({ a: 1 }, null), undefined);
  assert.strictEqual(getValue({ a: 1 }, 123), undefined);
});

test('getValue：嵌套属性与数组索引', () => {
  const src = { alerts: [{ labels: { alertname: 'CPUHigh' }, annotations: { message: 'cpu 90%' } }] };
  assert.strictEqual(getValue(src, '$.alerts[0].labels.alertname'), 'CPUHigh');
  assert.strictEqual(getValue(src, '$.alerts[0].annotations.message'), 'cpu 90%');
});

test('getValue：路径不存在返回 undefined', () => {
  assert.strictEqual(getValue({ a: { b: 1 } }, '$.a.c.d'), undefined);
  assert.strictEqual(getValue({ a: 1 }, '$.x.y'), undefined);
});

test('getValue：数组根路径', () => {
  const src = [{ Title: 'A' }, { Title: 'B' }];
  assert.strictEqual(getValue(src, '$[0].Title'), 'A');
});

test('extractFields：JSONPath 提取动态值', () => {
  const src = { alerts: [{ labels: { alertname: 'OOM' }, annotations: { message: 'mem 99%' } }] };
  const r = extractFields(src, {
    title: '$.alerts[0].labels.alertname',
    content: '$.alerts[0].annotations.message',
  });
  assert.strictEqual(r.title, 'OOM');
  assert.strictEqual(r.content, 'mem 99%');
});

test('extractFields：单个固定值（非 $. 开头）原样当作字面量', () => {
  const r = extractFields({}, { type: 'text' });
  assert.deepStrictEqual(r, { type: 'text' });
});

test('extractFields：字面量中的转义字符被解析（\\n \\t \\\\）', () => {
  const r = extractFields({}, { content: 'line1\\nline2\\ttab\\\\slash' });
  assert.strictEqual(r.content, 'line1\nline2\ttab\\slash');
});

test('extractFields：数组混合 字面量 + JSONPath 拼接', () => {
  const src = { alerts: [{ labels: { alertname: 'CPUHigh' } }] };
  const r = extractFields(src, {
    content: ['告警: ', '$.alerts[0].labels.alertname', ' 当前状态'],
  });
  assert.strictEqual(r.content, '告警: CPUHigh 当前状态');
});

test('extractFields：缺失字段回退默认值', () => {
  const r = extractFields({}, { title: '$.missing' }, { type: 'text', title: '默认标题' });
  assert.strictEqual(r.title, '默认标题');
  assert.strictEqual(r.type, 'text');
});

test('extractFields：已有字段不被默认值覆盖', () => {
  const r = extractFields({ name: 'x' }, { name: '$.name' }, { name: 'default' });
  assert.strictEqual(r.name, 'x');
});

test('getPresetTemplate：已知/未知模板', () => {
  assert.strictEqual(getPresetTemplate('grafana').name, 'Grafana');
  assert.strictEqual(getPresetTemplate('unknown'), null);
});

test('getAllPresetTemplates：返回模板列表（含 id/name/description）', () => {
  const all = getAllPresetTemplates();
  assert.ok(Array.isArray(all));
  assert.ok(all.length >= 5);
  assert.ok(all.every((t) => t.id && t.name && t.description));
});
