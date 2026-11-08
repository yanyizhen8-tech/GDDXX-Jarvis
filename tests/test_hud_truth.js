'use strict';
/* Node test for hud/js/truth.js. No browser, no voice service, no network.
   node tests/test_hud_truth.js
   Passing here does not mean the Mac installation was tested. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'hud', 'js', 'truth.js'), 'utf8');
const ctx = { globalThis: {}, console };
ctx.globalThis = ctx;
vm.runInNewContext(code, ctx);
const T = ctx.JVTruth;
if (!T) throw new Error('JVTruth missing');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }

const offlineWx = T.offlineReply('明天天气怎么样？');
assert(!/18|张江|AQI|空气优/.test(offlineWx), offlineWx);
assert(/未配置|没连上/.test(offlineWx), offlineWx);
assert(/日程/.test(T.offlineReply('今天有什么安排？')) && !/站会|方案评审/.test(T.offlineReply('今天有什么安排？')), 'schedule');
assert(/完成数不可用/.test(T.offlineReply('工作进度怎么样')), 'report');
assert(T.micOffline().includes('不会假装'), 'mic');

assert(T.isStandby('进入待机') === true, 'standby chip');
assert(T.isStandby('不要进入待机') === false, 'negated');
assert(T.isStandby('退出待机') === false, 'exit');
assert(T.isStandby('明天天气怎么样？') === false, 'weather');

const blocked = T.agentAction('jobs', 'off');
assert(blocked.type === 'blocked', 'off jobs must not ask the brain');
assert(T.agentAction('brain', 'off').type === 'open-brain', 'brain still opens so the window can say it is missing');
assert(T.agentAction('review', 'off').type === 'blocked', 'off review must not ask the model');
assert(T.agentAction('learn', 'idle').type === 'open-learn', 'learn');
assert(T.agentAction('review', 'idle').type === 'ask', 'review');
assert(T.agentAction('jobs', 'idle').text.includes('后台任务'), 'jobs ask');

const uncfg = T.weatherView({ type: 'weather', ok: false, reason: 'unconfigured', detail: '未配置高德' });
assert(uncfg.state === 'unconfigured' && uncfg.temp === '—' && uncfg.aqi == null, 'wx unconfigured');
assert(!/上海|18/.test(JSON.stringify(uncfg)), 'no sample city');
const live = T.weatherView({ ok: true, source: 'amap', city: '上海市', now: '多云', temp: '18', humidity: '40',
  report_time: '2026-11-08 14:00:00', served_at: 1760000000, days: [{ day: '晴', low: '10', high: '20' }] });
assert(live.state === 'live' && live.city === '上海' && live.aqi == null, 'no invented aqi');
assert(live.source.includes('高德') && live.source.includes('观测'), live.source);
const withAqi = T.weatherView({ ok: true, temp: '1', now: '晴', aqi: 36 });
assert(withAqi.aqi === 36, 'aqi only when provided');

const tripOff = T.tripView({ ok: false, reason: 'unconfigured', detail: '未配置高德，不显示示例行程' });
assert(tripOff.state === 'unconfigured' && tripOff.eta === '—' && tripOff.path == null, 'trip');
assert(!/张江|32/.test(JSON.stringify(tripOff)), 'no sample route');
const tripOn = T.tripView({ ok: true, to: '张江科学城', minutes: 32, km: 24, eta: '23:10', source: 'amap', path: [[0, 0], [1, 1]] });
assert(tripOn.state === 'live' && tripOn.title === '去 张江科学城' && tripOn.path.length === 2, 'real trip kept');

const now = 1_700_000_000;
const first = T.sysView({ ok: true, source: 'psutil', cpu: null, cpu_ready: false, mem: 64, net_ready: false, sampled_at: now, mem_kind: 'virtual_percent' }, now, 0);
assert(first.cpu === '--' && first.net === '--' && first.mem === '64%' && first.state === 'live', JSON.stringify(first));
assert(first.title.includes('psutil') && first.title.includes('虚拟内存'), first.title);
const hot = T.sysView({ ok: true, cpu: 95, cpu_ready: true, cpu_window_s: 2, mem: 91, up: 19000, down: 49000, net_ready: true, sampled_at: now - 20 }, now, 5);
assert(hot.state === 'stale' && hot.cpuHot === true && hot.memHot === true, JSON.stringify(hot));
assert(hot.net === '↓49KB/s ↑19KB/s', hot.net);
const missing = T.sysView({ ok: false, reason: 'missing', detail: '未安装 psutil' }, now, 0);
assert(missing.cpu === '--' && missing.state === 'missing', 'missing psutil');

T.resetSeries();
assert(T.waveLabel(2, T.seriesLength()).includes('没有工具事件流'), 'tool tab');
assert(T.waveLabel(1, { sys: 0, human: 0, agent: 0 }).includes('示意'), 'no samples');
T.pushSeries('sys', 0.2); T.pushSeries('sys', 0.4);
assert(T.waveLabel(1).includes('CPU 采样'), 'sys wave');
T.pushSeries('human', 0.1); T.pushSeries('human', 0.2);
assert(T.waveLabel(3).includes('麦克风'), 'human wave');
const level = T.agentLevel([{ state: 'off' }, { state: 'run' }]);
assert(level === 0.5, level);
for (let i = 0; i < 60; i++) T.pushSeries('agent', 1);
assert(T.seriesValues('agent').length === 48, 'cap');

const lines = T.linkLines(null);
assert(lines.some(l => l.includes('未连接')) && lines.some(l => l.includes('不显示密钥')), lines.join('|'));
const liveLines = T.linkLines({ voice: true, psutil: true, llm: false, amap: false, harness: false });
assert(liveLines.some(l => l.includes('高德') && l.includes('未配置')), liveLines.join('|'));
assert(liveLines.some(l => l.includes('未安装')), 'harness');
assert(!liveLines.some(l => /key|token|http/i.test(l)), liveLines.join('|'));

console.log('PASS');
