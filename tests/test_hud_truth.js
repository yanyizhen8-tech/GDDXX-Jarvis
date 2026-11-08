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
assert(blocked.type === 'status', 'off jobs shows the local reason and does not ask the model');
assert(T.agentAction('brain', 'off').type === 'open-brain', 'brain still opens so the window can say it is missing');
assert(T.agentAction('review', 'off').type === 'status', 'off review shows the local reason');
assert(T.agentAction('learn', 'idle').type === 'open-learn', 'learn');
assert(T.agentAction('review', 'idle').type === 'status', 'review shows the local line');
assert(T.agentAction('jobs', 'idle').type === 'status', 'jobs does not ask the model');
assert(T.agentAction('jobs', 'run').type === 'status', 'running job stays local');
assert(T.textDispatch('拆开一台发动机给我看看').send.type === 'text', 'engine chip stays a normal chat line');

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

/* Connected standby is local only. A fake sender records every payload the dispatcher would hand it. */
function connectedHandle(q, liveSend) {
  const d = T.textDispatch(q);
  if (d.local === 'dorm') return 'dorm';
  if (!d.send) return 'drop';
  liveSend(d.send);
  return 'sent';
}
let sent = [];
const liveSend = (obj) => { sent.push(obj); };
assert(connectedHandle('进入待机', liveSend) === 'dorm' && sent.length === 0, 'chip must not send while connected');
assert(connectedHandle('进入待机模式', liveSend) === 'dorm' && sent.length === 0, 'standby phrase');
assert(connectedHandle('standby', liveSend) === 'dorm' && sent.length === 0, 'english standby');
assert(connectedHandle('明天天气怎么样？', liveSend) === 'sent' && sent.length === 1, 'other chips still send');
assert(sent[0].type === 'text' && sent[0].text === '明天天气怎么样？', JSON.stringify(sent));
sent = [];
assert(connectedHandle('不要进入待机', liveSend) === 'sent' && sent.length === 1, 'negated standby is still a chat line');
assert(T.textDispatch('进入待机').send === null, 'send field stays null');

const liveSrc = fs.readFileSync(path.join(__dirname, '..', 'hud', 'js', 'live.js'), 'utf8');
const talkSrc = fs.readFileSync(path.join(__dirname, '..', 'hud', 'js', 'talk.js'), 'utf8');
const handleAt = liveSrc.indexOf('handle = q =>');
const handleFn = liveSrc.slice(handleAt, liveSrc.indexOf('addEventListener', handleAt));
assert(!liveSrc.includes('我一直在听'), 'connected hold-space must not claim it is already hearing');
assert(handleFn.indexOf("d.local === 'dorm'") !== -1 && handleFn.indexOf("d.local === 'dorm'") < handleFn.indexOf('liveSend'), handleFn);
assert(!/type:\s*'text'/.test(handleFn), 'live handle must not build its own chat payload');
assert(liveSrc.includes('document.body.appendChild(shieldPop)'), 'status card is outside the header grid');
assert(talkSrc.includes('JVTruth.textDispatch'), 'offline path uses the same dispatcher');

const css = fs.readFileSync(path.join(__dirname, '..', 'hud', 'css', 'hud.css'), 'utf8');
const rule = (css.match(/#shieldPop\{[^}]+\}/) || [])[0] || '';
assert(rule, 'missing #shieldPop rule');
assert(/position:\s*fixed/.test(rule), rule);
const z = /z-index:\s*(\d+)/.exec(rule);
assert(z && Number(z[1]) >= 30, rule);
assert(/background-color:\s*#061018/.test(rule), rule);
assert(!/backdrop-filter/.test(rule), 'no translucent backdrop');
assert(!/rgba\(var\(--sk-pnl\)/.test(rule), 'no variable alpha fill');
assert(!css.includes('.shield-pop{position:absolute'), 'old transparent popover rule is gone');
const row = (css.match(/#shieldPop div\{[^}]+\}/) || [])[0] || '';
assert(/padding:\s*7px 0/.test(row) && /border-top:/.test(row), row);

const readyMic = { ok: true, pending: false, silent: false, text: '' };
assert(T.micFace({ socket: true, paused: false, mic: null }).listening === false, 'socket alone is not listening');
assert(!/聆听中/.test(T.micFace({ socket: true, paused: false, mic: null }).button), 'pending has no 聆听中');
assert(/尚未确认/.test(T.micFace({ socket: true, paused: false, mic: { pending: true, ok: false } }).status), 'pending copy');
const down = T.micFace({ socket: true, paused: false, mic: { ok: false, pending: false, text: '没有找到可用的麦克风或扬声器' } });
assert(down.listening === false && down.warn && /麦克风不可用/.test(down.status), JSON.stringify(down));
const silent = T.micFace({ socket: true, paused: false, mic: { ok: true, silent: true, text: '没有输入电平' } });
assert(silent.listening === false && /电平/.test(silent.hold) && !/一直在听/.test(silent.hold), silent.hold);
const paused = T.micFace({ socket: true, paused: true, mic: readyMic });
assert(/暂停/.test(paused.button) && paused.listening === false, paused.button);
const hearing = T.micFace({ socket: true, paused: false, mic: readyMic });
assert(hearing.listening === true && hearing.button === '聆听中' && /麦克风已打开/.test(hearing.hold), hearing.hold);
assert(!/一直在听/.test(hearing.hold), 'open device is not a completed wake test');
assert(/未连接/.test(T.micFace({ socket: false, paused: false, mic: readyMic }).button), 'disconnect wins');

const card = T.holoClick('raptor-engine', true);
assert(card.send.type === 'holo_show' && card.send.file === 'raptor-engine' && card.close === true, JSON.stringify(card));
const offlineCard = T.holoClick('raptor-engine', false);
assert(offlineCard.send === null && offlineCard.close === false && /不能投影/.test(offlineCard.note), offlineCard.note);
assert(T.holoClick('', true).send === null, 'empty file');
assert(T.cameraWant({ enabled: false, demo: true, machine: true }) === false, '3D view does not open the camera by itself');
assert(T.cameraWant({ enabled: true, demo: true, machine: false, earth: false }) === false, 'demo without a handled scene');
assert(T.cameraWant({ enabled: true, demo: false, machine: true }) === false, 'mesh without the demo screen');
assert(T.cameraWant({ enabled: true, demo: true, machine: true }) === true, 'explicit gestures plus a teardown');
assert(T.cameraWant({ enabled: true, demo: true, earth: true }) === true, 'explicit gestures plus earth');
const handSrc = fs.readFileSync(path.join(__dirname, '..', 'hud', 'js', 'hand.js'), 'utf8');
assert(handSrc.includes("localStorage.getItem('jarvis.hand') === 'on'"), 'gestures default off');
assert(!/jarvis\.hand'\) !== 'off'/.test(handSrc), 'old default-on check is gone');
assert(handSrc.includes('JVTruth.cameraWant'), 'hand loop uses the gate');
const demoSrc = fs.readFileSync(path.join(__dirname, '..', 'hud', 'js', 'demo-mode.js'), 'utf8');
assert(demoSrc.includes('cameraSync(true)'), 'leaving the demo asks the camera to stop');

const holoSrc = fs.readFileSync(path.join(__dirname, '..', 'hud', 'js', 'holo-lib.js'), 'utf8');
assert(holoSrc.includes('JVTruth.holoClick'), 'library uses the local projector');
assert(!/type:\s*'text'/.test(holoSrc), 'library cards do not send chat');

console.log('PASS');
