'use strict';

let voiceOn = true;
$('#btnVoice').addEventListener('click', e => { voiceOn = !voiceOn; e.currentTarget.setAttribute('aria-pressed', String(voiceOn)); e.currentTarget.querySelector('b').textContent = voiceOn ? '开' : '关'; if (!voiceOn) try { speechSynthesis.cancel(); } catch (_) {} });
function speak(text, onEnd) {
  setState('speaking');
  let ended = false; const finish = () => { if (ended) return; ended = true; if (state === 'speaking') setState('idle'); onEnd && onEnd(); };
  typeOut('jarvis', text, 55);
  const fallback = setTimeout(finish, Math.max(2600, text.length * 190));
  if (voiceOn && 'speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 1.05; u.pitch = 0.85;
      const v = speechSynthesis.getVoices().find(v => /zh/i.test(v.lang)); if (v) u.voice = v;
      u.onend = () => { clearTimeout(fallback); setTimeout(finish, 200); };
      speechSynthesis.speak(u);
    } catch (_) {}
  }
}

const focusTimers = {};
function focusPanel(id) { const el = document.getElementById(id); if (!el) return; el.classList.remove('is-focus'); void el.offsetWidth; el.classList.add('is-focus'); clearTimeout(focusTimers[id]); focusTimers[id] = setTimeout(() => el.classList.remove('is-focus'), 6000); if (innerWidth < 900) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

let approvalBox = null;

function respond(q) {
  if (/安排|日程|会议|今天.*(干|做)|几点/.test(q)) focusPanel('pSched');
  else if (/天气|出行|下雨|温度|穿|路况|通勤/.test(q)) focusPanel('pWeather');
  else if (/大脑|任务|学习|复盘|agent/i.test(q)) focusPanel('pAgents');
  else if (/汇报|总结|进度|工作|完成/.test(q)) focusPanel('pReport');
  return window.JVTruth ? JVTruth.offlineReply(q) : '语音服务没连上。我不会用示例天气或示例日程回答。';
}

let busy = false;
let handle = function (q) {
  q = q.trim(); if (!q) return;
  if (window.JVTruth && JVTruth.isStandby(q)) { try { dormNow(); } catch (_) {} return; }
  try { speechSynthesis.cancel(); } catch (_) {}
  busy = true;
  typeOut('you', q, 18, () => {
    setState('thinking');
    setTimeout(() => { const ans = respond(q); speak(ans, () => { busy = false; }); }, 1100 + Math.random() * 500);
  });
};

const SAMPLES = ['今天有什么安排？', '明天天气怎么样？', '拆开一台发动机给我看看', '进入待机'];
$('#chips').innerHTML = SAMPLES.map(s => `<button type="button" class="chip">${s}</button>`).join('');
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => handle(c.textContent)));
$('#form').addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; handle(v); });
$('#btnSearch').addEventListener('click', () => { openTalk(); input.focus(); });
$('#knob').addEventListener('click', () => { openTalk(); input.focus(); });
input.addEventListener('focus', openTalk); input.addEventListener('blur', () => scheduleClose(4000));
$('#btnMic').addEventListener('click', () => toggleListen());
$('#btnMenu').addEventListener('click', e => { const pop = $('#menuPop'); pop.hidden = !pop.hidden; e.currentTarget.setAttribute('aria-expanded', String(!pop.hidden)); });
document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) { $('#menuPop').hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); } });

let listenTimer = null;
function startListen() {
  if (state === 'listening') return;
  try { speechSynthesis.cancel(); } catch (_) {}
  clearInterval(typeTimer); clearInterval(listenTimer); setState('listening');
  sub.innerHTML = '<span class="who">JARVIS</span>' + escapeHtml(window.JVTruth ? JVTruth.micOffline() : '语音服务没连上，麦克风没有在听。');
}
function stopListen() {
  if (state !== 'listening') return; clearInterval(listenTimer);
  setState('idle');
}
let clickListen = null;
function toggleListen() { if (state === 'listening') { clearTimeout(clickListen); stopListen(); } else { startListen(); clearTimeout(clickListen); clickListen = setTimeout(stopListen, 3200); } }
$('#mic').addEventListener('click', toggleListen);
addEventListener('keydown', e => {
  const typing = document.activeElement === input;
  if (e.code === 'Space' && !typing && !e.repeat && !(document.activeElement && /BUTTON/.test(document.activeElement.tagName))) { e.preventDefault(); clearTimeout(clickListen); startListen(); }
  else if (e.key === 'Escape') { try { speechSynthesis.cancel(); } catch (_) {} clearInterval(typeTimer); clearInterval(listenTimer); clearTimeout(clickListen); if (approvalBox && approvalBox.isConnected) approvalBox.querySelector('.no').click(); setState('idle'); sub.innerHTML = '<span class="who">JARVIS</span>好的，已停止。'; }
  else if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openTalk(); input.focus(); }
});
addEventListener('keyup', e => { if (e.code === 'Space' && state === 'listening' && document.activeElement !== input) stopListen(); });
/* while a machine hologram is live, a click on the core belongs to the hologram (machine.js) */
const machListen = toggleListen;
toggleListen = (...a) => { if (machLive()) return; return machListen(...a); };
