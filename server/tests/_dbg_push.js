const { test } = require('node:test');
// kf/dnd mock BEFORE models
const kfPath = require.resolve('../src/services/keywordFilter.service');
require.cache[kfPath] = { id: kfPath, filename: kfPath, loaded: true, exports: { check: () => ({ blocked: false }) } };
const dndPath = require.resolve('../src/services/doNotDisturb.service');
require.cache[dndPath] = { id: dndPath, filename: dndPath, loaded: true, exports: { shouldMute: () => false } };
const modelsPath = require.resolve('../src/models');
const fakeStore = { endpoints: new Map(), channels: new Map(), logs: new Map(), settings: new Map() };
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: {
  UserModel: {}, RefreshTokenModel: {},
  SettingsModel: { getBoolean: (k, d) => fakeStore.settings.has(k) ? fakeStore.settings.get(k) === 'true' : d },
  ChannelModel: { findById: async (id) => fakeStore.channels.get(Number(id)) || null },
  EndpointModel: { findByToken: async (t) => fakeStore.endpoints.get(t) || null, findById: async (id) => { for (const ep of fakeStore.endpoints.values()) if (ep.id === Number(id)) return ep; return null; }, updateLastUsed: async () => {}, getChannels: async (id) => { const ep = [...fakeStore.endpoints.values()].find(e => e.id === Number(id)); return ep ? ep._channels || [] : []; } },
  PushLogModel: { create: async (d) => ({ id: 1, ...d }), updateStatus: async () => {} },
} };
const axiosPath = require.resolve('axios');
delete require.cache[axiosPath];
require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: Object.assign((...a) => Promise.resolve({ data: { ok: true, result: { message_id: 'm' } }, status: 200, statusText: 'OK', headers: { 'x-request-id': 'r' } }), { post: (...a) => Promise.resolve({ data: { ok: true, result: { message_id: 'm' } }, status: 200, statusText: 'OK', headers: { 'x-request-id': 'r' } }) }) };
console.log('kf mock?', require('../src/services/keywordFilter.service').check().blocked);
console.log('dnd mock?', require('../src/services/doNotDisturb.service').shouldMute());
const PushService = require('../src/services/push.service');
test('dbg', async () => {
  const ch = { id: 1, name: 'WH', channel_type: 'webhook', config: { url: 'https://hook.test/x' }, is_active: true };
  const res = await PushService.pushToChannel(1, 10, ch, { title: 'T', content: 'C' }, '1.2.3.4');
  console.log('RES', JSON.stringify(res));
});
