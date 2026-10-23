'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { sym: 'start fails', hue: 'rose', check: 'last line of the start log', page: '2.2 out of memory at start' },
  { sym: 'first token slow', hue: 'amber', check: 'prefix cache hit rate, queue', page: '3.2 the prefix cache' },
  { sym: 'stream stutters', hue: 'amber', check: 'P99 ITL against users', page: '3.3 long prompts' },
  { sym: 'output too low', hue: 'amber', check: 'preemptions, KV usage', page: '3.1 chat for many users' },
  { sym: 'output wrong', hue: 'rose', check: 'cache, spec decoding, seed', page: '3.8 reproducible outputs' },
];

module.exports = figure('fig-7-1', {
  height: 300,
  title: 'Start from the symptom, check one number, then go to one page',
  desc: 'Five symptoms, each with the first number or log line to check and the page that fixes it: a failed start, a slow first token, a stuttering stream, low output, and wrong output.',
}, f => {
  f.kicker(20, 18, 'what you see');
  f.kicker(200, 18, 'check first');
  f.kicker(430, 18, 'then read');
  rows.forEach((r, index) => {
    const y = 30 + index * 52;
    f.box({ x: 20, y, w: 160, h: 40, hue: r.hue, title: r.sym });
    f.arrow([180, y + 20], [199, y + 20], { style: 'call' });
    f.text(204, y + 25, r.check, { size: 11.5, serif: true });
    f.text(430, y + 25, r.page, { size: 11.5, hue: 'blue' });
  });
});
