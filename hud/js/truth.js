'use strict';
/* Pure HUD state: what the panels may claim. No DOM, no network.
   Loaded as a classic script in the window, and runnable under node for tests. */
(function (root) {
  function rate(b) {
    if (b == null || !Number.isFinite(b)) return '--';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + 'MB/s';
    if (b >= 1e3) return Math.round(b / 1e3) + 'KB/s';
    return Math.round(b) + 'B/s';
  }
  function clock(sec) {
    if (!sec) return '';
    const d = new Date(sec * 1000), p = n => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function weatherView(m) {
    if (!m || m.ok === false) {
      const uncfg = !m || m.reason === 'unconfigured' || m.reason === 'offline';
      return {
        state: uncfg ? 'unconfigured' : 'error',
        temp: '—',
        word: uncfg ? '天气未配置' : '天气暂不可用',
        city: '',
        extra: '',
        meta: (m && m.detail) || (uncfg ? '需要本机高德密钥。界面不读取密钥，也不显示示例城市。' : '查询失败'),
        aqi: null,
        days: [],
        source: ''
      };
    }
    const city = String(m.city || '').replace(/市$/, '');
    const bits = [];
    if (m.source === 'amap' || m.source === '高德') bits.push('高德');
    else if (m.source) bits.push(String(m.source));
    if (m.report_time) bits.push('观测 ' + m.report_time);
    if (m.served_at) bits.push('送到界面 ' + clock(m.served_at));
    return {
      state: 'live',
      temp: m.temp == null ? '—' : String(m.temp),
      word: m.now || '',
      city: city,
      extra: m.humidity == null ? '' : ('湿度 ' + m.humidity + '%'),
      meta: '',
      aqi: m.aqi == null ? null : m.aqi,
      days: (m.days || []).slice(0, 3),
      source: bits.join(' · ')
    };
  }
  function tripView(m) {
    if (!m || m.ok === false) {
      const uncfg = !m || m.reason === 'unconfigured' || m.reason === 'offline';
      return {
        state: uncfg ? 'unconfigured' : 'empty',
        title: '还没有路线',
        meta: (m && m.detail) || (uncfg ? '未配置高德，不显示示例行程' : '说一个目的地后再查询'),
        eta: '—',
        path: null,
        mode: '',
        line: ''
      };
    }
    return {
      state: 'live',
      title: '去 ' + (m.to || ''),
      meta: (m.minutes == null ? '—' : m.minutes + ' 分钟') + (m.km == null ? '' : '  ' + m.km + ' km'),
      eta: m.eta || '—',
      path: m.path || null,
      mode: m.mode || '',
      line: m.line || '',
      source: m.source === 'amap' ? '高德' : (m.source || '')
    };
  }
  function sysView(m, nowSec, cpuHot) {
    if (!m || m.ok === false) {
      return {
        state: m && m.reason === 'missing' ? 'missing' : 'down',
        cpu: '--', mem: '--', net: '--',
        cpuHot: false, memHot: false,
        title: (m && m.detail) || '系统采样不可用，不显示估算数字'
      };
    }
    const age = m.sampled_at ? Math.max(0, nowSec - m.sampled_at) : 0;
    const stale = age > 15;
    const cpu = (m.cpu_ready === false || m.cpu == null) ? '--' : (m.cpu + '%');
    const mem = m.mem == null ? '--' : (m.mem + '%');
    const net = m.net_ready === false ? '--' : ('↓' + rate(m.down) + ' ↑' + rate(m.up));
    const win = m.cpu_window_s == null ? '上一间隔' : (m.cpu_window_s + ' 秒');
    let title = 'psutil · CPU 是距上次采样的占用（' + win + '），不是活动监视器的长窗口 · 内存是虚拟内存占用';
    if (m.sampled_at) title += ' · 采样 ' + clock(m.sampled_at);
    if (stale) title += ' · 已超过 15 秒没有新采样';
    return { state: stale ? 'stale' : 'live', cpu, mem, net, cpuHot: cpuHot >= 5, memHot: m.mem >= 90, title };
  }
  const series = { sys: [], human: [], agent: [] };
  function pushSeries(name, v) {
    if (!series[name]) return 0;
    const n = Math.max(0, Math.min(1, Number(v) || 0));
    series[name].push(n);
    if (series[name].length > 48) series[name].shift();
    return series[name].length;
  }
  function seriesValues(name) { return (series[name] || []).slice(); }
  function seriesLength() {
    return { sys: series.sys.length, human: series.human.length, agent: series.agent.length };
  }
  function resetSeries() { series.sys.length = series.human.length = series.agent.length = 0; }
  function agentLevel(items) {
    const w = { run: 1, warn: 0.7, done: 0.4, idle: 0.2, off: 0 };
    if (!items || !items.length) return 0;
    return items.reduce((s, it) => s + (w[it.state] == null ? 0.2 : w[it.state]), 0) / items.length;
  }
  function waveLabel(mode, lens) {
    lens = lens || seriesLength();
    if (mode === 1 && lens.sys > 1) return 'SYSTEM · CPU 采样';
    if (mode === 3 && lens.human > 1) return 'HUMAN · 麦克风电平';
    if (mode === 0 && lens.agent > 1) return 'AGENT · 状态，不是事件流';
    if (mode === 2) return 'TOOL · 示意。没有工具事件流，切换标签不会产生调用';
    return '示意波形 · 尚无采样';
  }
  function agentAction(id, state) {
    if (id === 'brain') return { type: 'open-brain' };
    if (id === 'learn') return { type: 'open-learn' };
    if (state === 'off') return { type: 'blocked', text: '这项能力当前不可用' };
    if (id === 'jobs') return { type: 'ask', text: '后台任务进行得怎么样了？' };
    if (id === 'review') return { type: 'ask', text: '昨天的复盘有什么建议？' };
    return { type: 'noop', text: '' };
  }
  function isStandby(q) {
    const s = String(q || '').trim();
    if (!s || /不要|别|取消|退出待机|醒来|awake/i.test(s)) return false;
    return /进入待机|^待机$|待机模式|^standby$|go to standby/i.test(s);
  }
  /* Explicit standby from the chip or the text box. Local panels only: send stays null
     so a connected window does not hand the phrase to the language model. */
  function textDispatch(q) {
    const text = String(q || '').trim();
    if (!text) return { send: null, local: null };
    if (isStandby(text)) return { send: null, local: 'dorm' };
    return { send: { type: 'text', text: text }, local: null };
  }
  function offlineReply(q) {
    const s = String(q || '');
    if (/安排|日程|会议|今天.*(干|做)|几点/.test(s))
      return '语音服务没连上，我不能读取今天的日程。连上后，今日安排只显示本机日程文件里的内容。';
    if (/天气|出行|下雨|温度|穿|路况|通勤/.test(s))
      return '语音服务没连上，我不能查询天气或路线。连上后如果没有配置高德密钥，面板会写明未配置，而不会显示示例城市。';
    if (/大脑|任务|学习|复盘|agent/i.test(s))
      return '语音服务没连上，左边的 Agent 状态不是实时的。';
    if (/汇报|总结|进度|工作|完成/.test(s))
      return '语音服务没连上，工作汇报还没有同步本机日程，完成数不可用。';
    if (/你好|在吗|贾维斯|jarvis/i.test(s))
      return '我在。语音服务没连上，现在只能打字，不能查天气、日程或本机状态。';
    return '语音服务没连上。我不会用示例天气或示例日程回答。可以打字，但查不到实时数据。';
  }
  function micOffline() {
    return '语音服务没连上，麦克风没有在听。按住空格不会假装识别出一句话。';
  }
  function linkLines(m) {
    if (!m || m.voice === false && m.psutil == null && m.amap == null) {
      return ['语音服务未连接', '天气、路线和日程不会用示例数字冒充', '密钥只留在本机，这个面板不显示密钥'];
    }
    return [
      '语音服务：' + (m.voice ? '已连接' : '未连接'),
      '系统采样：' + (m.psutil ? 'psutil 可用（CPU 为短间隔占用，内存为虚拟内存）' : '未安装 psutil，不估算'),
      '语言模型：' + (m.llm ? ('已配置' + (m.llm_provider ? ' · ' + m.llm_provider : '')) : '未配置'),
      '高德天气与路线：' + (m.amap ? '已配置密钥' : '未配置'),
      'DeepSeek Harness：' + (m.harness ? '已安装' : '未安装'),
      '此处不显示任何密钥或接口地址'
    ];
  }
  root.JVTruth = {
    rate, clock, weatherView, tripView, sysView, pushSeries, seriesValues, seriesLength, resetSeries,
    agentLevel, waveLabel, agentAction, isStandby, textDispatch, offlineReply, micOffline, linkLines
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
