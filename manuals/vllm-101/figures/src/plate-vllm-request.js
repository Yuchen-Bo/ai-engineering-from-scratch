'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const prefix = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).prefix;
const at = (key, x) => prefix[key].points.find(p => p.x === x).median_ttft_ms.median;
const PAIRS = [256, 1024, 2048].map(x => ({ x, on: at('vllm', x), off: at('vllm-no-prefix-cache', x) }));
const ms = v => `${Math.round(v).toLocaleString('en-US')} ms`;

module.exports = figure('plate-vllm-request', {
  height: 560,
  title: 'One request, three processes, one block pool',
  desc: 'A chat request crosses the API server, the engine core, and a GPU worker, drawn as machines on one bench. On our L4 with Qwen3-8B, 87.2 percent of the prompt tokens came from the prefix cache. Below, towers show the median time to first token with the cache on and off at 256, 1,024, and 2,048 shared tokens.',
}, f => {
  const bench = f.isoView({ ox: 0, oy: 168, angle: 'true' });
  const unit = (view, cx, cc, size, h, hue) => {
    const [xc, yc] = view.at(cx, cc);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue });
  };

  f.kicker(20, 18, 'one request through vLLM 0.31.0');
  f.isoBeam(bench, { sx0: 14, sx1: 626, c: 60, back: 120, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const stations = [
    { cx: 70, w: 100, hue: 'olive', title: 'client', sub: 'chat request' },
    { cx: 220, w: 150, hue: 'blue', title: 'API server', sub: 'text to ids' },
    { cx: 390, w: 150, hue: 'blue', title: 'engine core', sub: 'Scheduler' },
    { cx: 555, w: 130, hue: 'violet', title: 'GPU worker', sub: 'forward pass' },
  ];
  const machines = stations.map(station => {
    f.box({ x: station.cx - station.w / 2, y: 32, w: station.w, h: 52, hue: station.hue, title: station.title, sub: [station.sub] });
    return unit(bench, station.cx, 0, 46, 30, station.hue);
  });
  const drum = f.isoDrum(bench, { x: machines[2].box.x + 23, y: machines[2].box.y + 23, z: 30, r: 13, h: 12, hue: 'green' });
  machines.forEach((machine, index) => {
    const target = index === 2 ? drum.top : machine.top;
    f.leader([stations[index].cx, 86], target, { hue: stations[index].hue });
  });
  const styles = ['call', 'event', 'call'];
  for (let i = 0; i < 3; i += 1) {
    f.beat(i + 1);
    const from = machines[i].P(46, 0, 15);
    const to = machines[i + 1].P(0, 46, 15);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style: styles[i] });
  }

  f.beat(4);
  const prompt = f.isoView({ ox: 0, oy: 292, angle: 'true' });
  f.kicker(20, 234, 'prompt tokens as the prefix cache saw them, 8 users');
  f.text(20, 254, '87.2 percent from the cache, in 16-token blocks', { size: 12, weight: 700, hue: 'green' });
  const split = 20 + 586 * 0.872;
  f.isoBeam(prompt, { sx0: 20, sx1: split, c: 0, back: 30, h: 14, hue: 'green' });
  f.beat(5);
  f.isoBeam(prompt, { sx0: split, sx1: 606, c: 0, back: 30, h: 14, hue: 'plum', shadow: false });
  f.text(606, 316, '12.8 percent computed', { size: 11, anchor: 'end', hue: 'plum' });

  f.beat(0);
  f.kicker(20, 356, 'median time to first token, cache on and off');
  const yard = f.isoView({ ox: 0, oy: 516, angle: 'true' });
  f.isoBeam(yard, { sx0: 150, sx1: 626, c: 30, back: 60, h: 5, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const scale = 120 / 2550;
  PAIRS.forEach((pair, index) => {
    f.beat(6 + index);
    const base = 220 + index * 150;
    const on = unit(yard, base, 0, 24, Math.max(4, pair.on * scale), 'green');
    const off = unit(yard, base + 54, 0, 24, Math.max(4, pair.off * scale), 'rose');
    f.text(base, on.top[1] - 16, ms(pair.on), { size: 11.5, weight: 700, anchor: 'middle', hue: 'green' });
    f.text(base + 54, off.top[1] - 16, ms(pair.off), { size: 11.5, weight: 700, anchor: 'middle', hue: 'rose' });
    f.text(base + 27, 548, `${pair.x.toLocaleString('en-US')} tokens`, { size: 11.5, anchor: 'middle', hue: 'ink-soft' });
  });
  f.beat(0);
  f.rect(20, 410, 12, 12, { hue: 'green' });
  f.text(40, 420, 'cache on', { size: 11.5, hue: 'green' });
  f.rect(20, 432, 12, 12, { hue: 'rose' });
  f.text(40, 442, 'cache off', { size: 11.5, hue: 'rose' });
  f.text(20, 470, 'NVIDIA L4', { size: 11, serif: true, hue: 'ink-mute' });
  f.text(20, 486, 'Qwen3-8B', { size: 11, serif: true, hue: 'ink-mute' });
});
