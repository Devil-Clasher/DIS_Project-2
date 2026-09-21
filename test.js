'use strict';
const E = require('./euler.js');
const tests = [
  ['triangle', 'A-B,B-C,C-A', 'circuit'],
  ['K5', 'A-B, A-C, A-D, A-E, B-C, B-D, B-E, C-D, C-E, D-E', 'circuit'],
  ['house', 'A-B, B-C, C-D, D-A, B-E, C-E', 'trail'],
  ['star', 'A-B, A-C, A-D, A-E', 'none'],
  ['disconnected', 'A-B, C-D', 'none'],
  ['digits label', '1-2, 2-3, 3-1', 'circuit'],
  ['empty', '', 'none'],
];
let fail = 0;
for (const [name, input, expect] of tests) {
  const g = E.parseGraph(input);
  const a = E.analyze(g);
  if (!a.valid) {
    console.log(name.padEnd(14), '-> invalid :', a.msg, expect === 'none' ? '' : '<-- UNEXPECTED');
    if (expect !== 'none') fail++;
    continue;
  }
  const { steps, final } = E.computeSteps(g, a.start);
  const cover = final.length === g.edges.length + 1;
  const closed = final[0] === final[final.length - 1];
  const kind = closed ? 'CIRCUIT' : 'TRAIL';
  const mismatch = (expect === 'circuit' && !closed) || (expect === 'trail' && closed);
  console.log(
    name.padEnd(14), '->', kind,
    '| tour:', final.map((i) => g.labels[i]).join('-'),
    '| steps:', steps.length, '| cover-all:', cover,
    mismatch || !cover ? '<-- MISMATCH' : ''
  );
  if (mismatch || !cover) fail++;
  if (expect === 'none') fail++;
}
console.log(fail ? fail + ' FAILURES' : 'all OK');