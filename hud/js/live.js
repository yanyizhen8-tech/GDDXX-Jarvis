'use strict';
/* ---- live link to the local voice service (ws://127.0.0.1:8765) ----
   When the service is running, the HUD shows what Jarvis really hears and says;
   typed input goes to the same brain. Without it, the demo replies above keep working. */
let live = null;
function localFlag(on) {
  const flag = document.getElementById('localFlag'); if (!flag) return;
  flag.textContent = on ? '● ON' : '● OFF';
  flag.classList.toggle('on', !!on); flag.classList.toggle('off', !on);
  flag.title = on ? '本机语音服务已连接。CPU、内存、网速来自 psutil 短间隔采样。' : '本机语音服务未连接。天气、路线、日程不会用示例数字。';
}
function connectVoice() {
  let ws;
  try { ws = new WebSocket('ws://127.0.0.1:8765'); } catch (_) { return setTimeout(connectVoice, 3000); }
  ws.onopen = () => { live = ws; document.body.dataset.live = '1'; localFlag(true); applyMicFace(); };
  ws.onclose = () => { if (live === ws) { live = null; delete document.body.dataset.live; localFlag(false); listenKnown = false; micState = null; try { paintLink(null); applyMicFace(); } catch (_) {} } setTimeout(connectVoice, 3000); };
  ws.onerror = () => { try { ws.close(); } catch (_) {} };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (SK.core && SK.core.msg) try { SK.core.msg(m); } catch (_) {}   /* skins: the core reacts to what Jarvis is doing */
    if (EW && EW.live() && ['machine', 'starship', 'roadster', 'optimus'].includes(m.type) && !['hide', 'pause', 'resume'].includes(m.action || 'show')) EW.hide();   /* earth: another hologram takes the stage */
    if (m.type === 'state') {
      const s = m.state === 'listening' ? 'listening' : m.state === 'thinking' ? 'thinking' : m.state === 'speaking' ? 'speaking' : 'idle';
      setState(s);
      if (s === 'listening' && !sub.textContent.trim()) sub.innerHTML = '<span class="who you">YOU</span><span style="color:var(--ink-3)">正在聆听…</span>';
      if (s === 'idle') applyMicFace();
    }
    else if (m.type === 'screen') { if (m.mode === 'awake') { dormHold = false; dormAsked = false; wakeUI(); sleepUI(30000); } else if (state === 'speaking' || state === 'thinking') dormAsked = true; else dormNow(); }
    else if (m.type === 'wake') { dormHold = false; wakeUI(); clearInterval(typeTimer); openTalk(); sub.innerHTML = '<span class="who you">YOU</span><span style="color:var(--ink-3)">正在聆听…</span>'; }
    else if (m.type === 'you') typeOut('you', m.text, 12);
    else if (m.type === 'jarvis') typeOut('jarvis', m.text, 40, null, m.zh);
    else if (m.type === 'stop' || m.type === 'barge_in') clearInterval(typeTimer);
    else if (m.type === 'level') meter(m.mic, m.wake);
    else if (m.type === 'sys') sysUpdate(m);
    else if (m.type === 'schedule') applySchedule(m.items || []);
    else if (m.type === 'weather') wxUpdate(m);
    else if (m.type === 'trip') tripUpdate(m);
    else if (m.type === 'stats') statsShow(m);
    else if (m.type === 'enroll') enrollUpdate(m);
    else if (m.type === 'not_you') notYou(m);
    else if (m.type === 'brain') brainEvent(m);
    else if (m.type === 'history') subsHistory(m.items);
    else if (m.type === 'machine') { if ((m.action || 'show') === 'show') { if (SHIP) SHIP.hide(); if (OP && OP.state.on) OP.hide(); } machineCommand(m); }
    else if (m.type === 'starship') shipCommand(m);
    else if (m.type === 'skin') skinCommand(m);
    else if (m.type === 'roadster') roadsterCommand(m);
    else if (m.type === 'optimus') optimusCommand(m);
    else if (m.type === 'earth') earthCommand(m);
    else if (m.type === 'earth_data') { if (EW) EW.data(m); }
    else if (m.type === 'holo_list') { if (window.holoLibData) holoLibData(m); }
    else if (m.type === 'em') { if (window.emMsg) emMsg(m); }
    else if (m.type === 'hand') handMsg(m);
    else if (m.type === 'hand_frame') handFrame(m);
    else if (m.type === 'heard') { meterHeard.textContent = '听到：' + (m.text || '…'); }
    else if (m.type === 'rejected') { meterHeard.textContent += '（不是唤醒词）'; }
    else if (m.type === 'listen') { document.body.dataset.listen = '1'; listenShow(m.on !== false); }   /* pause switch only; not proof the microphone is open */
    else if (m.type === 'mic') { micState = m; applyMicFace(); }
    else if (m.type === 'holo_show' && m.ok === false) { try { openTalk(); sub.innerHTML = '<span class="who">JARVIS</span>' + escapeHtml(m.error || '无法投影'); } catch (_) {} }
    else if (m.type === 'agents') agentsUpdate(m);
    else if (m.type === 'link') { if (window.paintLink) paintLink(m); }
    else if (m.type === 'llm') { if (m.name) window.JV_NAME = m.name === 'sir' ? '' : m.name; if (window.ONBOARD) ONBOARD.msg(m); }
  };
}
/* small live meter: shows the mic is picking up sound and how close it came to "Hey Jarvis" */
const meterBox = document.createElement('div');
meterBox.id = 'voiceMeter';
meterBox.innerHTML = '<span class="ml">MIC</span><span class="mbar"><i id="micBar"></i></span><span class="ml">WAKE</span><span class="mbar"><i id="wakeBar"></i></span><span id="meterHeard"></span>';
document.body.appendChild(meterBox);
const micBar = meterBox.querySelector('#micBar'), wakeBar = meterBox.querySelector('#wakeBar'), meterHeard = meterBox.querySelector('#meterHeard');
let wakeHold = 0;
function meter(mic, wake) {
  micBar.style.width = Math.min(100, Math.sqrt(mic || 0) * 140) + '%';
  if (window.JVTruth) JVTruth.pushSeries('human', Math.min(1, Math.sqrt(mic || 0) * 1.4));
  wakeHold = Math.max(wake || 0, wakeHold * 0.85);
  wakeBar.style.width = Math.min(100, wakeHold * 100) + '%';
  wakeBar.classList.toggle('hot', wakeHold >= 0.25);
}
function liveSend(obj) { if (live && live.readyState === 1) { live.send(JSON.stringify(obj)); return true; } return false; }
window.liveSend = liveSend;
const demoHandle = handle;
handle = q => {
  const d = window.JVTruth ? JVTruth.textDispatch(q) : { send: null, local: null };
  if (d.local === 'dorm') { try { dormNow(); } catch (_) {} return; }
  if (!d.send) return;
  if (liveSend(d.send)) { openTalk(); typeOut('you', d.send.text, 12); }
  else demoHandle(d.send.text);
};
addEventListener('keydown', e => { if (e.key === 'Escape') liveSend({ type: 'interrupt' }); }, true);
const demoStart = startListen, demoStop = stopListen;
/* 暂停聆听: one button (and the M key) stops Jarvis hearing anything, wake word included, until it is
   pressed again. For live streams and meetings where other people talk. Typing still works. */
const listenBtn = document.createElement('button');
listenBtn.id = 'listenToggle'; listenBtn.type = 'button';
document.body.appendChild(listenBtn);
let listening = true;
let listenKnown = false;
let micState = null;
function applyMicFace() {
  const face = window.JVTruth ? JVTruth.micFace({ socket: !!(live && live.readyState === 1), paused: listenKnown && !listening, mic: micState }) : { button: '未连接', title: '语音服务未连接', status: '语音服务未连接', detail: '', warn: false, placeholder: '可以打字', hold: '语音服务没连上，麦克风没有在听。', listening: false };
  window._micFace = face;
  document.body.classList.toggle('muted', listenKnown && !listening && !!(micState && micState.ok));
  const slash = face.listening ? '' : '<path d="M4 4l16 16"></path>';
  listenBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path>' + slash + '</svg><span>' + face.button + '</span>';
  listenBtn.title = face.title;
  listenBtn.setAttribute('aria-pressed', String(!face.listening));
  ['#mic', '#btnMic'].forEach(q => { const b = document.querySelector(q); if (b) b.setAttribute('aria-label', face.listening ? '暂停聆听' : face.button); });
  meterHeard.textContent = face.detail || '';
  meterHeard.classList.toggle('warn', !!face.warn);
  if (input) input.placeholder = face.placeholder;
  if (state === 'idle' && stateText) stateText.textContent = face.status;
  if (!face.listening) micBar.style.width = wakeBar.style.width = '0%';
}
function listenShow(on) {
  listening = !!on;
  listenKnown = true;
  applyMicFace();
}
function listenToggle() {
  if (!live) {
    meterHeard.textContent = window.JVTruth ? JVTruth.micOffline() : '语音服务未连接';
    meterHeard.classList.add('warn');
    return;
  }
  liveSend({ type: 'listen', on: !listening });
}
window.listenToggle = listenToggle;
listenBtn.addEventListener('click', e => { e.stopPropagation(); listenToggle(); });
addEventListener('keydown', e => {
  const t = document.activeElement;
  if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && live
      && !(t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable))) { e.preventDefault(); listenToggle(); }
});
applyMicFace();
startListen = () => {
  if (!live) return demoStart();
  openTalk(); clearInterval(typeTimer);
  const face = window._micFace || (window.JVTruth && JVTruth.micFace({ socket: true, paused: !listening, mic: micState }));
  sub.innerHTML = '<span class="who">JARVIS</span>' + escapeHtml(face && face.hold ? face.hold : '麦克风状态未知');
};
['#mic', '#btnMic'].forEach(q => { const b = document.querySelector(q); if (b) b.addEventListener('click', e => { if (live) { e.stopImmediatePropagation(); listenToggle(); } }, true); });
stopListen = () => { if (!live) demoStop(); };
const shieldPop = document.createElement('div');
shieldPop.id = 'shieldPop'; shieldPop.hidden = true;
shieldPop.setAttribute('role', 'dialog');
shieldPop.setAttribute('aria-label', '本机状态');
document.body.appendChild(shieldPop);
function paintLink(m) {
  const lines = window.JVTruth ? JVTruth.linkLines(m && m.type === 'link' ? m : null) : ['状态未知'];
  shieldPop.innerHTML = '<b class="sh-title">本机状态</b>' + lines.map(t => `<div>${escapeHtml(t)}</div>`).join('');
}
window.paintLink = paintLink;
paintLink(null);
const shieldBtn = document.getElementById('btnShield');
if (shieldBtn) {
  shieldBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = shieldPop.hidden;
    shieldPop.hidden = !open;
    shieldBtn.setAttribute('aria-expanded', String(open));
    if (open && !liveSend({ type: 'link' })) paintLink(null);
  });
  document.addEventListener('click', e => { if (!e.target.closest('#shieldPop') && e.target !== shieldBtn && !shieldBtn.contains(e.target)) { shieldPop.hidden = true; shieldBtn.setAttribute('aria-expanded', 'false'); } });
}
localFlag(false);
connectVoice();
