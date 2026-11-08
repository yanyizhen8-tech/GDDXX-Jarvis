'use strict';
/* ---- creator data hologram: numbers from the backend screenshots, counted up on screen ---- */
const fmtInt = v => Math.round(v).toLocaleString('en-US');
function countUp(el, to, ms, fmt) {
  if (reduced) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function statsShow(m) {
  const box = $('#statsHolo'), mt = m.metrics || {}, val = k => mt[k] ? mt[k].value : null;
  try { dormHold = false; wakeUI(); } catch (_) {}
  $('#shWhen').textContent = m.posted ? '发布于 ' + m.posted : '';
  $('#shCap').textContent = (m.title || '').replace(/\s*#\S+/g, '').trim() || '最新作品';
  countUp($('#shPlays'), val('plays') || 0, 2200, fmtInt);
  countUp($('#shFans'), val('new_fans') || 0, 2200, v => '+' + fmtInt(v));
  $('#shBoostBox').hidden = val('boost') == null;
  if (val('boost') != null) countUp($('#shBoost'), val('boost'), 2200, fmtInt);
  const chg = c => c == null ? '' : `<em class="chg${c < 0 ? ' dn' : ''}">比往期 ${c > 0 ? '+' : ''}${c}%</em>`;
  const tiles = [['likes', '点赞'], ['comments', '评论'], ['shares', '分享'], ['saves', '收藏'], ['completion', '完播率'], ['retain_5s', '5s完播率'], ['avg_watch', '平均播放时长'], ['lost_fans', '脱粉']]
    .filter(([k]) => mt[k]).slice(0, 6);
  $('#shGrid').innerHTML = tiles.map(([k, label], i) =>
    `<div style="transition-delay:${0.35 + i * 0.08}s"><span>${label}</span><b data-k="${k}">0</b>${chg(mt[k].change)}</div>`).join('');
  tiles.forEach(([k]) => {
    const el = $(`#shGrid b[data-k="${k}"]`), v = mt[k].value, pct = /%/.test(mt[k].text), sec = k === 'avg_watch';
    countUp(el, v, 1800, x => pct ? x.toFixed(2) + '%' : sec ? x.toFixed(1) + 's' : fmtInt(x));
  });
  const bars = [['src_feed', '推荐页流量', false], ['avg_ratio', '平均播放占比', false], ['bounce_2s', '2s跳出率', true], ['fan_view_ratio', '粉丝播放占比', false]]
    .filter(([k]) => mt[k]).slice(0, 3);
  $('#shBars').innerHTML = bars.map(([k, label, warn]) =>
    `<div class="bar${warn ? ' warn' : ''}"><span>${label}<b>${mt[k].value}%</b></span><i style="--w:${Math.min(100, mt[k].value)}%"></i></div>`).join('');
  const d = m.derived || {};
  $('#shRatio').textContent = d.new_fans_per_10k_views != null ? `每万播放涨粉 ${d.new_fans_per_10k_views}` : '';
  box.hidden = false; box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  clearTimeout(box._t); box._t = setTimeout(statsHide, 60000);
}
function statsHide() { const box = $('#statsHolo'); box.classList.remove('on'); clearTimeout(box._h); box._h = setTimeout(() => { box.hidden = true; }, 900); }
$('#statsHolo').addEventListener('click', statsHide);
addEventListener('keydown', e => { if (e.key === 'Escape') statsHide(); });
addEventListener('keydown', e => { if (e.key === 'Escape') machineEscape(); });
const MODE_WORD = { car: '开车', transit: '公交地铁', walk: '步行', bike: '骑行' };
let routeShown = false, lastSys = null;
function tripUpdate(m) {
  const view = window.JVTruth ? JVTruth.tripView(m) : null;
  const box = $('#pWeather .trip > div');
  const route = $('#route');
  if (!view || view.state !== 'live') {
    tripLive = false;
    routeShown = false;
    if (box) box.innerHTML = `<b>${escapeHtml(view ? view.title : '还没有路线')}</b><span>${escapeHtml(view ? view.meta : '不显示示例行程')}</span>`;
    $('#eta').textContent = '—';
    const pop = $('#qrPop'); if (pop) pop.hidden = true;
    if (route) route.setAttribute('aria-label', '没有路线。底图是装饰，不是导航。');
    return;
  }
  tripLive = true;
  const prev = box.querySelector('b') ? box.querySelector('b').textContent : '';
  box.innerHTML = `<b>${escapeHtml(view.title)}</b><span>${escapeHtml(view.meta)}<em></em>${escapeHtml(MODE_WORD[view.mode] || '')}${view.source ? ' · ' + escapeHtml(view.source) : ''}</span>` + (view.line ? `<span style="display:block;font-size:12px;color:var(--ink-2)">${escapeHtml(view.line)}</span>` : '');
  $('#eta').textContent = view.eta;
  routeShown = !!(view.path && view.path.length > 1);
  if (routeShown) { routePts.length = 0; view.path.forEach(p => routePts.push(p)); }
  if (route) route.setAttribute('aria-label', routeShown ? '已查询的路线' : '路线没有坐标，不画假路径');
  let pop = $('#qrPop');
  if (!pop) { pop = document.createElement('div'); pop.id = 'qrPop'; pop.className = 'qr-pop'; pop.title = '点击收起'; $('#pWeather').appendChild(pop); pop.addEventListener('click', () => { pop.hidden = true; }); }
  if (m.qr) { pop.innerHTML = m.qr + '<span>手机扫码<br>用高德导航</span>'; pop.hidden = false; clearTimeout(pop._t); pop._t = setTimeout(() => { pop.hidden = true; }, 120000); }
  else pop.hidden = true;
  if (m.holo) holoShow(m.holo, m);
  if (prev !== view.title && focusPanel) focusPanel('pWeather');
}
function applySysView(view) {
  const set = (id, text, hot, stale) => {
    const el = $(id); if (!el) return;
    el.textContent = text;
    el.classList.toggle('hot', !!hot);
    el.classList.toggle('stale', !!stale);
    el.title = view.title || '';
  };
  const stale = view.state === 'stale';
  set('#cpu', view.cpu, view.cpuHot, stale);
  set('#mem', view.mem, view.memHot, stale);
  const net = $('#net');
  if (net) {
    if (net.previousSibling) net.previousSibling.textContent = '';
    net.textContent = view.net;
    net.classList.toggle('stale', stale);
    net.title = view.title || '';
  }
}
function sysUpdate(m) {
  lastSys = m;
  if (!m || m.ok === false) { sysLive = false; cpuHot = 0; }
  else sysLive = true;
  cpuHot = m && m.cpu >= 90 ? cpuHot + 1 : 0;          // amber only when a real reading stays high (~10 s)
  const view = window.JVTruth ? JVTruth.sysView(m, Date.now() / 1000, cpuHot) : { cpu: '--', mem: '--', net: '--', title: '', cpuHot: false, memHot: false, state: 'down' };
  applySysView(view);
  if (m && m.ok !== false && m.cpu_ready !== false && m.cpu != null && window.JVTruth) JVTruth.pushSeries('sys', m.cpu / 100);
  if (m && m.battery != null) { $('#batBox').hidden = false; const set = (id, text, hot) => { const el = $(id); el.textContent = text; el.classList.toggle('hot', !!hot); }; set('#bat', m.battery + '%' + (m.charging ? '⚡' : ''), !m.charging && m.battery <= 15); }
}
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function tick() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  $('#clock').textContent = `${p(d.getHours())}:${p(d.getMinutes())}`;
  $('#date').textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${WD[d.getDay()]}`;
  if (lastSys && window.JVTruth) applySysView(JVTruth.sysView(lastSys, Date.now() / 1000, cpuHot));
}
tick(); setInterval(tick, 5000); setInterval(renderSched, 60000);

/* small canvases */
function fit(cv) { const r = cv.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return cv.getContext('2d'); }
let waveMode = 1;
document.querySelectorAll('.wave-tabs button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.wave-tabs button').forEach(x => x.setAttribute('aria-selected', 'false')); b.setAttribute('aria-selected', 'true'); waveMode = +b.dataset.w; }));
const METERS = ['DATA', 'MODEL', 'AGENT', 'KNOWLEDGE', 'WORLD'];
$('#meters').innerHTML = METERS.map(m => `<div class="meter" title="示意动画，不是实时指标">${m}<canvas></canvas></div>`).join('');
const meterCvs = [...document.querySelectorAll('.meter canvas')];
const ROADS = (() => { let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const out = [];
  for (let i = 0; i < 64; i++) { const horiz = rnd() < 0.5; const p = []; let x = horiz ? -0.05 : rnd(), y = horiz ? rnd() : -0.05; for (let k = 0; k < 6; k++) { p.push([x, y]); if (horiz) { x += 0.22; y += (rnd() - 0.5) * 0.25; } else { y += 0.24; x += (rnd() - 0.5) * 0.12; } } out.push({ p, o: 0.04 + rnd() * (rnd() < 0.2 ? 0.2 : 0.08) }); }
  return out; })();
function drawSmall(t) {
  const act = state === 'thinking' ? 2.2 : state === 'speaking' ? 1.5 : 1;
  AGENTS.forEach((a, i) => {
    const c = fit(a.cv), w = c.canvas.width, h = c.canvas.height; c.clearRect(0, 0, w, h);
    const run = a.el.classList.contains('run');
    const N = 64, bw = w / N, sp = t * (run ? 2.4 : 0.5);
    const ys = []; for (let x = 0; x < N; x++) { const u = x / (N - 1);
      const env = 0.12 + 0.55 * Math.exp(-Math.pow((u - 0.55 - Math.sin(a.ph) * 0.12) / 0.16, 2)) + 0.3 * Math.exp(-Math.pow((u - 0.3 - Math.cos(a.ph) * 0.1) / 0.1, 2));
      const n = 0.82 + 0.18 * Math.sin(u * 40 + sp * 3 + a.ph) * Math.sin(u * 13 - sp + a.ph * 2);
      ys.push(Math.min(1, env * n * (run ? 1.1 : 0.9)) * h * 0.92); }
    c.fillStyle = a.c; for (let x = 0; x < N; x++) { c.globalAlpha = 0.28 + 0.4 * ys[x] / h; c.fillRect(x * bw, h - ys[x], Math.max(DPR * 0.8, bw * 0.4), ys[x]); }
    c.globalAlpha = 0.9; c.strokeStyle = a.c; c.lineWidth = DPR; c.beginPath(); ys.forEach((y, x) => x ? c.lineTo(x * bw, h - y) : c.moveTo(0, h - y)); c.stroke();
    c.globalAlpha = 1;
  });
  { const c = fit($('#wave')), w = c.canvas.width, h = c.canvas.height; c.clearRect(0, 0, w, h);
    c.strokeStyle = `rgba(${SKC.line},.08)`; c.lineWidth = 1; for (let g = 1; g < 4; g++) { c.beginPath(); c.moveTo(0, h * g / 4); c.lineTo(w, h * g / 4); c.stroke(); }
    c.strokeStyle = `rgba(${SKC.line},.06)`; for (let g = 1; g < 10; g++) { c.beginPath(); c.moveTo(w * g / 10, 0); c.lineTo(w * g / 10, h); c.stroke(); }
    const note = $('#waveNote');
    const seriesName = ['agent', 'sys', 'tool', 'human'][waveMode];
    const vals = (window.JVTruth && seriesName !== 'tool') ? JVTruth.seriesValues(seriesName) : [];
    if (note && window.JVTruth) note.textContent = JVTruth.waveLabel(waveMode);
    if (vals.length > 1) {
      c.beginPath();
      vals.forEach((v, i) => { const x = (vals.length === 1 ? 0 : i / (vals.length - 1)) * w, y = h * 0.88 - v * h * 0.72; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.strokeStyle = `rgba(${SKC.hi},.9)`; c.lineWidth = 1.4 * DPR; c.shadowColor = `rgb(${SKC.pri})`; c.shadowBlur = 6 * DPR; c.stroke(); c.shadowBlur = 0;
    } else {
      const fr = [1.0, 1.4, 2.2, 0.7][waveMode];
      const wy = (u, L) => { const env = 0.35 + 0.65 * Math.sin(u * Math.PI); return h * 0.55 + env * h * 0.3 * Math.min(1.4, act) * (Math.sin(u * 7 * fr + t * (0.5 + L * 0.05) * act + L * 0.35) * 0.75 + 0.25 * Math.sin(u * 17 * fr - t * 0.8 + L)); };
      { const gr = c.createLinearGradient(0, h * 0.3, 0, h); gr.addColorStop(0, `rgba(${SKC.pri},.16)`); gr.addColorStop(1, `rgba(${SKC.pri},0)`); c.beginPath(); for (let x = 0; x <= 120; x++) { const u = x / 120; x ? c.lineTo(u * w, wy(u, 0)) : c.moveTo(0, wy(0, 0)); } c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fillStyle = gr; c.fill(); }
      for (let L = 0; L < 14; L++) { c.beginPath(); for (let x = 0; x <= 120; x++) { const u = x / 120; x ? c.lineTo(u * w, wy(u, L)) : c.moveTo(0, wy(0, L)); } c.strokeStyle = L === 0 ? `rgba(${SKC.hi},.35)` : L % 4 === 0 ? 'rgba(200,232,245,.2)' : `rgba(${SKC.pri},.1)`; c.lineWidth = DPR * (L === 0 ? 1.4 : 0.8); c.stroke(); }
    } }
  meterCvs.forEach((cv, i) => { const c = fit(cv), w = c.canvas.width, h = c.canvas.height; c.clearRect(0, 0, w, h);
    if (i === 0) { for (let j = 0; j < 7; j++) { c.fillStyle = `rgba(${SKC.soft},${0.35 + 0.35 * Math.abs(Math.sin(t * 0.7 * act + j))})`; c.fillRect(0, h * 0.25 + j * h * 0.11, w * 0.85, DPR); } return; }
    const N = 14; for (let j = 0; j < N; j++) { const v = 0.12 + 0.6 * Math.pow(Math.abs(Math.sin(t * (0.5 + i * 0.15) * act + j * 1.9 + i * 3)), 2) + (j === N - 2 ? 0.3 : 0); c.fillStyle = j === N - 2 ? `rgb(${SKC.ink})` : `rgba(${SKC.soft},.5)`; c.fillRect(j * w / N, h - Math.min(1, v) * h, DPR, Math.min(1, v) * h); } });
  { const c = fit(routeCv), w = c.canvas.width, h = c.canvas.height; c.clearRect(0, 0, w, h);
    c.lineWidth = DPR; ROADS.forEach(r => { c.strokeStyle = `rgba(${SKC.line},${routeShown ? r.o : r.o * 0.45})`; c.beginPath(); r.p.forEach(([x, y], i) => i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)); c.stroke(); });
    if (routeShown && routePts.length > 1) {
      c.beginPath(); routePts.forEach(([x, y], i) => i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)); { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, `rgb(${SKC.pri})`); gr.addColorStop(0.45, `rgb(${SKC.accp})`); gr.addColorStop(1, `rgb(${SKC.acc})`); c.strokeStyle = gr; } c.lineWidth = 1.6 * DPR; c.shadowColor = '#9fdcff'; c.shadowBlur = 6 * DPR; c.stroke(); c.shadowBlur = 0;
      routePts.slice(2, -1).forEach(([x, y], k) => { if (k % 2) return; c.fillStyle = `rgb(${SKC.accp})`; c.beginPath(); c.arc(x * w, y * h, 2.2 * DPR, 0, 7); c.fill(); });
      const seg = routePts.length - 1, pos = (t * 0.05) % 1 * seg, i0 = Math.floor(pos), fr2 = pos - i0; const [ax, ay] = routePts[i0], [bx, by] = routePts[Math.min(seg, i0 + 1)];
      c.fillStyle = `rgb(${SKC.pri})`; c.beginPath(); c.arc((ax + (bx - ax) * fr2) * w, (ay + (by - ay) * fr2) * h, 4 * DPR, 0, 7); c.fill();
      c.fillStyle = `rgb(${SKC.pri})`; c.shadowColor = `rgb(${SKC.pri})`; c.shadowBlur = 14 * DPR; c.beginPath(); c.arc(routePts[0][0] * w, routePts[0][1] * h, 5.5 * DPR, 0, 7); c.fill(); c.shadowBlur = 0;
      c.strokeStyle = `rgba(${SKC.pri},.5)`; c.beginPath(); c.arc(routePts[0][0] * w, routePts[0][1] * h, 10 * DPR, 0, 7); c.stroke();
      { const px = routePts[seg][0] * w, py = routePts[seg][1] * h, r = 6 * DPR; c.fillStyle = `rgb(${SKC.acc})`; c.shadowColor = `rgb(${SKC.acc})`; c.shadowBlur = 10 * DPR; c.beginPath(); c.arc(px, py - r * 1.4, r, Math.PI * 0.85, Math.PI * 0.15); c.lineTo(px, py); c.closePath(); c.fill(); c.shadowBlur = 0; c.fillStyle = '#1a0e03'; c.beginPath(); c.arc(px, py - r * 1.4, r * 0.4, 0, 7); c.fill(); }
    } }
}
(function loop2() { drawSmall(simT); setTimeout(() => requestAnimationFrame(loop2), 33); })();
