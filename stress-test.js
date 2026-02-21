function chooseOpponentFromCandidates(candidates, selfName, lastOpponent) {
  const uniq = [...new Set((candidates || []).filter(Boolean))];
  if (!uniq.length) return null;
  if (selfName) {
    const nonSelf = uniq.filter(n => n !== selfName);
    if (nonSelf.length === 1) return nonSelf[0];
    if (nonSelf.length > 1 && lastOpponent && nonSelf.includes(lastOpponent)) return lastOpponent;
    if (nonSelf.length > 1) return nonSelf[0];
    return null;
  }
  if (uniq.length === 1) return uniq[0];
  if (lastOpponent && uniq.includes(lastOpponent)) return lastOpponent;
  return null;
}

const tests = [
  { c:['me'], self:'me', last:null, want:null, name:'only self -> null' },
  { c:['me','opp'], self:'me', last:null, want:'opp', name:'self+opp -> opp' },
  { c:['opp','me'], self:'me', last:null, want:'opp', name:'order irrelevant' },
  { c:['opp1','opp2','me'], self:'me', last:'opp2', want:'opp2', name:'prefer last opponent when ambiguous' },
  { c:['opp1','opp2'], self:null, last:null, want:null, name:'ambiguous no self -> null' },
  { c:['opp1','opp2'], self:null, last:'opp2', want:'opp2', name:'ambiguous no self but last -> last' },
  { c:['opp'], self:null, last:null, want:'opp', name:'single candidate no self -> use it' },
];

let pass = 0;
for (const t of tests) {
  const got = chooseOpponentFromCandidates(t.c, t.self, t.last);
  const ok = got === t.want;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${t.name} | got=${got} want=${t.want}`);
}

if (pass !== tests.length) process.exit(1);
console.log(`\n${pass}/${tests.length} tests passed`);
