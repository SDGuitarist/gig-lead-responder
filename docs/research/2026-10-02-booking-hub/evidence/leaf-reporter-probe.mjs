export default async function* (source) {
  const c = { leafPass: 0, leafFail: 0, suite: 0, fileLevel: 0, other: {} };
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue;
    const t = ev.data.details?.type; const n = ev.data.nesting;
    if (t === 'suite') c.suite++;
    else if (t === 'test' && n === 0 && /\.test\.ts$/.test(ev.data.name)) c.fileLevel++;
    else if (t === 'test') { if (ev.type === 'test:pass') c.leafPass++; else c.leafFail++; }
    else c.other[t] = (c.other[t] || 0) + 1;
  }
  yield JSON.stringify(c) + "\n";
}
