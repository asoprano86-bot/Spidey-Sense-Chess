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

function inferOpponentFromScriptPlayers(scriptedPlayers, profileNames) {
  if (!scriptedPlayers || scriptedPlayers.length < 2) return null;
  const inferredSelf = scriptedPlayers.find(n => profileNames.includes(n));
  if (!inferredSelf) return null;
  return scriptedPlayers.find(n => n !== inferredSelf) || null;
}

const tests = [
  { got: chooseOpponentFromCandidates(['me'], 'me', null), want: null, name: 'only self -> null' },
  { got: chooseOpponentFromCandidates(['me','opp'], 'me', null), want: 'opp', name: 'self+opp -> opp' },
  { got: chooseOpponentFromCandidates(['opp','me'], 'me', null), want: 'opp', name: 'order irrelevant' },
  { got: chooseOpponentFromCandidates(['opp1','opp2','me'], 'me', 'opp2'), want: 'opp2', name: 'prefer last opponent when ambiguous' },
  { got: chooseOpponentFromCandidates(['opp1','opp2'], null, null), want: null, name: 'ambiguous no self -> null' },
  { got: chooseOpponentFromCandidates(['opp1','opp2'], null, 'opp2'), want: 'opp2', name: 'ambiguous no self but last -> last' },
  { got: chooseOpponentFromCandidates(['opp'], null, null), want: 'opp', name: 'single candidate no self -> use it' },
  { got: inferOpponentFromScriptPlayers(['az','enemy'], ['az']), want: 'enemy', name: 'infer self from profile links' },
  { got: inferOpponentFromScriptPlayers(['enemy','az'], ['az']), want: 'enemy', name: 'infer order reversed' },
  { got: inferOpponentFromScriptPlayers(['a','b'], ['x']), want: null, name: 'no profile match -> null' },
];

let pass = 0;
for (const t of tests) {
  const ok = t.got === t.want;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${t.name} | got=${t.got} want=${t.want}`);
}

if (pass !== tests.length) process.exit(1);
console.log(`\n${pass}/${tests.length} tests passed`);
