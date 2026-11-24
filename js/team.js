'use strict';
/* Champions Battle Helper — team checker. Uses the helpers and data from js/app.js. */

const TEAM_MAX = 6;
const SAMPLE_TEAM = ['garchomp', 'incineroar', 'kingambit', 'primarina', 'dragonite', 'sinistcha'];
const savedTeam = store.get('tcs-team', []);   // ignore anything that isn't a list of names
let team = [...new Set(Array.isArray(savedTeam) ? savedTeam : [])].map(s => BY_SLUG.get(s)).filter(Boolean).slice(0, TEAM_MAX);
let tableOpen = true;                            // remembers if the big table was closed
let tmode = store.get('tcs-team-mode', 'use') === 'fight' ? 'fight' : 'use';

const saveTeam = () => store.set('tcs-team', team.map(m => m.slug));
const onTeam = m => team.some(x => x.slug === m.slug);
const say = text => { $('teamLive').textContent = ''; setTimeout(() => $('teamLive').textContent = text, 30) };
const count = n => `${n} Pokémon`;

function addToTeam(m){
  if (!m || onTeam(m)) return false;
  if (team.length >= TEAM_MAX){ say(`The team is full. Remove a Pokémon to add ${m.name}.`); return false }
  team.push(m); saveTeam(); renderTeam();
  say(`Added ${m.name}. ${count(team.length)} on the team.`);
  return true;
}
function removeFromTeam(i){
  const [m] = team.splice(i, 1); saveTeam(); renderTeam();
  say(`Removed ${m.name}. ${team.length ? count(team.length) + ' on the team.' : 'The team is empty.'}`);
}

/* Button on the lookup's battle plan (called from renderPlan in app.js). */
function teamButton(m){
  const on = onTeam(m), full = !on && team.length >= TEAM_MAX;
  return `<button class="btn team-add${on ? ' on' : ''}" data-addteam="${m.slug}"${full ? ' disabled title="The team is full"' : on ? ` title="Tap to take it off the team" aria-label="On the team. Remove ${esc(m.name)} from the team"` : ''}>${on ? 'On the team' : full ? 'Team is full' : 'Add to team'}</button>`;
}

/* ---------- Search box ---------- */
const tq = $('tq'), tsug = $('tsug');
let tItems = [], tActive = -1;
function renderTSug(){
  const v = tq.value;
  if (!v.trim()){ closeTSug(); return }
  tItems = search(v, true); tActive = tItems.findIndex(r => !onTeam(r.m)); if (tActive < 0) tActive = tItems.length ? 0 : -1;
  tsug.innerHTML = tItems.length ? tItems.map((r, k) => `<li role="option" id="to${k}" data-k="${k}"${onTeam(r.m) ? ' aria-disabled="true"' : ''}><span class="mi-box">${monImg(r.m, 40)}</span><span class="ts">${r.m.types.map(t => icon(t, 24)).join('')}</span><span class="nm">${esc(r.m.name)}</span><span class="sr">, ${r.m.types.join(' and ')}</span>${onTeam(r.m) ? '<span class="nic">On the team</span>' : r.m.champ ? '' : `<span class="nic">${notIn(r.m, true)}</span>`}<span class="no">#${r.m.no}</span></li>`).join('')
    : `<li class="empty">No Pokémon called “${esc(v.trim())}”. Check the spelling?</li>`;
  tsug.hidden = false; tq.setAttribute('aria-expanded', 'true');
  markTActive();
}
function markTActive(){
  [...tsug.querySelectorAll('[role=option]')].forEach((li, k) => li.setAttribute('aria-selected', k === tActive));
  if (tActive > -1){ tq.setAttribute('aria-activedescendant', 'to' + tActive); $('to' + tActive)?.scrollIntoView({ block: 'nearest' }) }
  else tq.removeAttribute('aria-activedescendant');
}
function closeTSug(){ tItems = []; tActive = -1; tsug.hidden = true; tq.setAttribute('aria-expanded', 'false'); tq.removeAttribute('aria-activedescendant') }
function pickT(k){
  const r = tItems[k]; if (!r) return;
  if (onTeam(r.m)){ say(`${r.m.name} is already on the team.`); return }
  closeTSug(); tq.value = '';
  addToTeam(r.m);
  // The box is disabled once the team is full, so move focus to the new Pokémon's remove button.
  if (!tq.disabled) tq.focus({ preventScroll: true });
  else [...$('teamSlots').querySelectorAll('[data-trm]')].pop()?.focus({ preventScroll: true });
}
tq.addEventListener('input', renderTSug);
tq.addEventListener('focus', () => { if (tq.value.trim()) renderTSug() });
tq.addEventListener('keydown', e => {
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && tItems.length){
    e.preventDefault(); const step = e.key === 'ArrowDown' ? 1 : -1;
    for (let i = 0; i < tItems.length; i++){ tActive = (tActive + step + tItems.length) % tItems.length; if (!onTeam(tItems[tActive].m)) break }
    markTActive() }
  else if (e.key === 'Enter'){ e.preventDefault(); if (!tq.value.trim()) return; if (tsug.hidden) renderTSug(); pickT(Math.max(tActive, 0)) }
  else if (e.key === 'Escape'){ if (!pop.hidden){ closePop(); e.stopPropagation(); return } if (!tsug.hidden){ closeTSug(); e.stopPropagation() } else if (tq.value){ tq.value = ''; e.stopPropagation() } }
});
tsug.addEventListener('mousedown', e => e.preventDefault());
tsug.addEventListener('click', e => { const li = e.target.closest('[data-k]'); if (li) pickT(+li.dataset.k) });
document.addEventListener('click', e => { if (!e.target.closest('.team-search')) closeTSug() });

/* ---------- Analysis ---------- */
// For every move type: how it does against each member (abilities counted like the lookup).
function analyse(){
  const profs = team.map(m => profileOf(m.types, m));
  return T.map((a, i) => {
    const per = team.map((m, k) => ({ m, ...profs[k][i] }));
    return { t: a, per,
      weak: per.filter(p => p.x > 1), res: per.filter(p => p.x < 1), rs: per.filter(p => p.x > 0 && p.x < 1), imm: per.filter(p => p.x === 0),
      warn: per.filter(p => p.warn.length) };
  });
}
// res = everything that blocks it (resists or is immune); rs = resists only (½× or ¼×); imm = immune (0×).
// Text always names resists and immunities separately so nobody is counted twice.
const stopParts = r => [r.rs.length ? `${r.rs.length} resist${r.rs.length === 1 ? 's' : ''}` : '', r.imm.length ? `${r.imm.length} immune` : ''].filter(Boolean);
const stopTile = r => [r.rs.length ? `resisted by ${r.rs.length}` : '', r.imm.length ? `${r.imm.length} immune` : ''].filter(Boolean).join(', ');
const stopWords = r => [r.rs.length ? `${r.rs.length} ${r.rs.length === 1 ? 'resists' : 'resist'}` : '', r.imm.length ? `${r.imm.length} ${r.imm.length === 1 ? 'is' : 'are'} immune` : ''].filter(Boolean).join(' and ');
// Which members' own types hit a defending type super effectively (STAB).
const stabHitters = d => team.filter(m => m.types.some(s => mult(s, d) === 2));

// With an ability warning the badge is a button that opens the type's pop-up, which names the ability (phones have no tooltips).
const who = (p, good, t) => `<${p.warn.length && t ? `button data-twhy="${t}"` : 'span'} class="who ${p.x === 0 ? 'zero' : p.x > 1 ? (good ? 'good' : 'bad') : (good ? 'bad' : 'good')}${p.x >= 4 ? ' x4' : ''}${p.warn.length ? ' warn' : ''}"${p.warn.length ? ` title="Unless it has ${esc(joinList(p.warn.map(w => w.ab), 'or'))}"` : ''}>${esc(p.m.name)} ${fmt(p.x)}${p.warn.length ? `<span class="sr">, unless it has ${esc(joinList(p.warn.map(w => w.ab), 'or'))}</span>` : ''}</${p.warn.length && t ? 'button' : 'span'}>`;
const typeBtn = t => `<button class="trow-type" data-twhy="${t}" aria-label="${t}: show the matchup against each Pokémon">${icon(t, 32)}<span>${t}</span></button>`;
const typeLabel = t => `<span class="trow-type">${icon(t, 32)}<span>${t}</span></span>`;

function rows(list, good, sumFn){
  return `<ul class="trows">${list.map(r => `<li class="trow">${typeBtn(r.t)}<span class="trow-who">${r.weak.map(p => who(p, good, r.t)).join('')}</span><span class="trow-sum">${sumFn(r)}</span></li>`).join('')}</ul>`;
}
function smallTiles(list, cls, txFn){
  return `<div class="tiles small">${list.map(r => `<button class="tile ${cls}" data-twhy="${r.t}" aria-label="${r.t}: ${esc(txFn(r))}. Show each Pokémon.">${icon(r.t, 32)}<span><span class="tn">${r.t}</span><span class="tx">${esc(txFn(r))}</span></span></button>`).join('')}</div>`;
}

function useView(A, n){
  let h = '';
  const weak = A.filter(r => r.weak.length > r.res.length)
    .sort((a, b) => (b.weak.length - b.res.length) - (a.weak.length - a.res.length) || b.weak.length - a.weak.length || b.weak.filter(p => p.x >= 4).length - a.weak.filter(p => p.x >= 4).length || idx(a.t) - idx(b.t));
  const top = weak[0];
  h += `<p class="verdict">${top
    ? `Biggest worry: <b>${top.t}</b> moves. They hit ${top.weak.length === n ? (n === 1 ? 'it' : `all ${n}`) : `${top.weak.length} of ${n}`} super effectively${top.res.length ? `. Only ${stopWords(top)}` : n > 1 ? ', and nothing on the team resists them' : ''}.`
    : `No move type hits more of your team than it's resisted by. That's a well-balanced team.`}</p>`;

  h += `<div class="plan-sec"><h3>Your team is weak to <small>move types that hit more of it than resist them</small></h3>${weak.length
    ? rows(weak, false, r => `${r.weak.length} weak · ${r.res.length ? stopParts(r).join(' · ') : '<b class="nores">nothing resists</b>'}`)
    : '<p class="none">Nothing. Every move type is resisted at least as often as it hits hard.</p>'}</div>`;

  const well = A.filter(r => !r.weak.length && r.res.length >= Math.min(2, n)).sort((a, b) => b.res.length - a.res.length || idx(a.t) - idx(b.t));
  h += `<div class="plan-sec"><h3>It handles these well <small>resisted, and nobody is weak to them</small></h3>${well.length
    ? smallTiles(well, '', stopTile)
    : '<p class="none">Nothing yet. Add Pokémon that resist different types.</p>'}</div>`;

  const gaps = T.filter(d => !stabHitters(d).length);
  h += `<div class="plan-sec"><h3>Its moves are strong against <small>using each Pokémon's own types, with the ${term('stab', 'STAB')} bonus</small></h3>
    <p class="cover">Super effective against <b>${18 - gaps.length} of 18</b> types.</p>
    ${gaps.length ? `<p class="cover-gap">Nothing on your team hits these super effectively with its own type:</p><div class="gaps">${gaps.map(t => chip(t)).join('')}</div>` : '<p class="none">Every type is covered.</p>'}</div>`;
  return h;
}

function fightView(A, n){
  let h = '';
  // Each Pokémon it hits super effectively: +2 (+1 more at 4×). Each one that resists: -1. Each immune one: -2,
  // on purpose: a move that does nothing is worse than one that's resisted.
  const score = r => r.weak.length * 2 + r.weak.filter(p => p.x >= 4).length - r.rs.length - r.imm.length * 2;
  const hit = A.filter(r => r.weak.length).sort((a, b) => score(b) - score(a) || b.weak.length - a.weak.length || idx(a.t) - idx(b.t));
  const top = hit[0];
  h += `<p class="verdict">${top
    ? `Best pick: <b>${top.t}</b> moves. They're super effective on ${top.weak.length === n ? (n === 1 ? 'it' : `all ${n}`) : `${top.weak.length} of their ${n}`}${top.res.length ? `, but ${stopWords(top)}` : ''}.`
    : 'No move type is super effective on any of them.'}</p>`;

  h += `<div class="plan-sec"><h3>Hit them with <small>${term('super effective', 'super effective')} on the most of their team</small></h3>${hit.length
    ? (() => { const sum = r => `hits ${r.weak.length}${r.res.length ? ' · ' + stopParts(r).join(' · ') : ''}`;
        return rows(hit.slice(0, 8), true, sum) + (hit.length > 8 ? `<details class="more"><summary>${hit.length - 8} more move types hit at least one of them</summary>${rows(hit.slice(8), true, sum)}</details>` : '') })()
    : '<p class="none">Nothing. No move type is super effective here.</p>'}</div>`;

  const skip = A.filter(r => !r.weak.length && r.res.length >= Math.max(1, Math.ceil(n / 2))).sort((a, b) => b.res.length - a.res.length || idx(a.t) - idx(b.t));
  h += `<div class="plan-sec"><h3>Don't bother with <small>${term('resist', 'resisted')} by most of them, super effective on none</small></h3>${skip.length
    ? smallTiles(skip, 'bad', stopTile)
    : '<p class="none">Nothing. No move type is resisted by most of them.</p>'}</div>`;

  // Types their own (STAB) moves hit super effectively: ones several of them threaten as rows, the rest as chips.
  const threats = T.map(d => ({ t: d, by: stabHitters(d) })).filter(r => r.by.length).sort((a, b) => b.by.length - a.by.length || idx(a.t) - idx(b.t));
  const cut = Math.max(2, Math.ceil(n / 2));
  const many = n > 1 ? threats.filter(r => r.by.length >= cut) : threats, one = n > 1 ? threats.filter(r => r.by.length < cut) : [];
  h += `<div class="plan-sec"><h3>Their moves are strong against <small>your Pokémon of these types, using their own types with the ${term('stab', 'STAB')} bonus</small></h3>${threats.length
    ? (many.length ? `<ul class="trows">${many.map(r => `<li class="trow">${typeLabel(r.t)}<span class="trow-who">${r.by.map(m => `<span class="who bad">${esc(m.name)}</span>`).join('')}</span><span class="trow-sum">${n > 1 ? `${r.by.length} of them` : ''}</span></li>`).join('')}</ul>` : '')
      + (one.length ? `<p class="cover-gap">${many.length ? 'Also hit' : 'Hit'} by ${cut > 2 ? 'one or two' : 'just one'} of them:</p><div class="gaps">${one.map(r => `<span class="pair">${chip(r.t)}<span class="who bad">${esc(r.by.map(m => m.name).join(', '))}</span></span>`).join('')}</div>` : '')
    : '<p class="none">Nothing. Their own types aren\'t super effective against anything.</p>'}</div>`;

  h += `<div class="plan-sec"><h3>Against each of them</h3><ul class="each">${team.map(m => {
    const best = profileOf(m.types, m).filter(p => p.x > 1).sort((a, b) => b.x - a.x || idx(a.t) - idx(b.t)).slice(0, 4);
    return `<li><button class="each-name" data-mon="${m.slug}" title="Look up ${esc(m.name)}">${monFace(m, 36)}${esc(m.name)}</button><span class="each-best">${best.length
      ? best.map(p => `<span class="pair">${chip(p.t)}<span class="mult ${mcls(p.x)}">${fmt(p.x)}</span>${p.warn.length ? `<button class="pair-warn" data-twhy="${p.t}" title="Unless it has ${esc(joinList(p.warn.map(w => w.ab), 'or'))}">!<span class="sr"> unless it has ${esc(joinList(p.warn.map(w => w.ab), 'or'))}. Show details.</span></button>` : ''}</span>`).join('')
      : '<span class="none">Nothing is super effective</span>'}</span></li>`;
  }).join('')}</ul></div>`;
  return h;
}

function table(A){
  const head = team.map((m, ci) => `<th scope="col" data-c="${ci}" title="${esc(m.name)}">${m.spr ? `<span class="th-mi">${monImg(m, 40)}</span>` : ''}<span class="th-ic">${m.types.map(t => icon(t, 18)).join('')}</span><span class="th-nm">${esc(m.name)}</span></th>`).join('');
  const body = A.map((r, ri) => `<tr><th scope="row">${icon(r.t, 22)}${r.t}</th>${r.per.map((p, ci) => {
    const c = p.x === 0 ? 'z' : p.x >= 4 ? 's4' : p.x > 1 ? 's' : p.x <= .25 ? 'r4' : p.x < 1 ? 'r' : '';
    const w = p.warn.length ? `, unless it has ${joinList(p.warn.map(x => x.ab), 'or')}` : '';
    return `<td class="tc ${c}${w ? ' warn' : ''}" data-r="${ri}" data-c="${ci}" tabindex="${ri || ci ? -1 : 0}" aria-label="${r.t} move against ${esc(p.m.name)}: ${fmt(p.x)}, ${WORD(p.x).toLowerCase()}${esc(w)}">${short(p.x) ?? fmt(p.x).replace('×', '')}</td>`;
  }).join('')}<td class="cnt cw">${r.weak.length || ''}</td><td class="cnt cr">${r.rs.length || ''}</td><td class="cnt ci">${r.imm.length || ''}</td></tr>`).join('');
  return `<details class="more team-table"${tableOpen ? ' open' : ''}><summary>Every move type against every Pokémon</summary>
    <p class="ttable-key">${tmode === 'use'
      ? `<span><i class="kb">2</i>Red: bad for your team. That Pokémon takes extra damage.</span><span><i class="kg">½</i>Green: good for your team. It resists.</span><span><i class="k0">0</i>Dark: no effect at all.</span>`
      : `<span><i class="kg">2</i>Green: good for you. That move does extra damage.</span><span><i class="kb">½</i>Red: bad for you. It's resisted.</span><span><i class="k0">0</i>Dark: no effect at all.</span>`}</p>
    <p class="ttable-hint">Hover or tap a square to read it. Use the arrow keys to move around.</p>
    <div class="scroller"><table class="ttable${tmode === 'use' ? ' mine' : ''}"><caption class="sr">Damage each move type does to each Pokémon on the team</caption>
    <thead><tr><td></td>${head}<th scope="col" class="cnt">Weak</th><th scope="col" class="cnt">Resist</th><th scope="col" class="cnt">Immune</th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="readout" id="teamReadout" aria-live="polite">Hover or tap a square to read it.</div></details>`;
}

// In "I'm using them", colours are from your team's side: taking extra damage is red, resisting is green.
const mineCls = x => x === 0 ? 'm0' : x >= 4 ? 'mq' : x > 1 ? 'mh' : x <= .25 ? 'm4' : x < 1 ? 'm2' : 'm1';

$('teamOut').addEventListener('toggle', e => { if (e.target.matches('details.team-table')) tableOpen = e.target.open }, true);

/* Table: hover, tap or arrow-key a square to highlight its row and column and explain it (like the type chart). */
let tFocus = null;
function tableCells(){ return [...$('teamOut').querySelectorAll('td.tc')] }
function focusTCell(td){
  if (td === tFocus) return;
  tFocus = td;
  const r = +td.dataset.r, c = +td.dataset.c, tbl = td.closest('table');
  tbl.classList.add('hovering');
  tableCells().forEach(x => { x.classList.toggle('dim', +x.dataset.r !== r && +x.dataset.c !== c); x.classList.toggle('focus', x === td) });
  tbl.querySelectorAll('thead th[data-c]').forEach(th => th.classList.toggle('on', +th.dataset.c === c));
  tbl.querySelectorAll('tbody th').forEach((th, i) => th.classList.toggle('on', i === r));
  const atk = T[r], m = team[c], p = profileOf(m.types, m)[r];
  let h = `${chip(atk)} move against <b>${esc(m.name)}</b> ${m.types.map(t => chip(t)).join(' ')} <span class="mult ${tmode === 'use' ? mineCls(p.x) : mcls(p.x)}">${fmt(p.x)}</span><strong>${WORD(p.x)}</strong>`;
  if (p.x !== p.base) h += `<span class="ro-math">Its ability makes it ${fmt(p.x)}.</span>`;
  if (p.warn.length) h += `<span class="ro-math">If it has ${p.warn.map(w => `${esc(w.ab)}: ${fmt(w.x)}`).join(', ')}.</span>`;
  $('teamReadout').innerHTML = h;
}
function clearTFocus(){
  if (!tFocus) return;
  tFocus = null;
  const tbl = $('teamOut').querySelector('.ttable'); if (!tbl) return;
  tbl.classList.remove('hovering');
  tableCells().forEach(x => x.classList.remove('dim', 'focus'));
  tbl.querySelectorAll('th.on').forEach(th => th.classList.remove('on'));
  $('teamReadout').textContent = 'Hover or tap a square to read it.';
}
$('teamOut').addEventListener('mouseover', e => { const td = e.target.closest('td.tc'); if (td) focusTCell(td) });
// Like the type chart: the highlight goes away as soon as the mouse leaves the table.
$('teamOut').addEventListener('mouseout', e => { const tbl = e.target.closest('.ttable'); if (tbl && !tbl.contains(e.relatedTarget)) clearTFocus() });
// Tapping a square also makes it the table's Tab stop, so keyboard focus comes back to the same place.
const setTStop = td => { $('teamOut').querySelectorAll('td.tc[tabindex="0"]').forEach(x => x.tabIndex = -1); td.tabIndex = 0 };
$('teamOut').addEventListener('click', e => { const td = e.target.closest('td.tc'); if (td){ setTStop(td); focusTCell(td) } });
$('teamOut').addEventListener('focusin', e => { const td = e.target.closest('td.tc'); if (td) focusTCell(td) });
$('teamOut').addEventListener('keydown', e => {
  const td = e.target.closest('td.tc'); if (!td) return;
  const rows = 18, cols = team.length;
  let r = +td.dataset.r, c = +td.dataset.c;
  if (e.key === 'ArrowRight') c = Math.min(cols - 1, c + 1); else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
  else if (e.key === 'ArrowDown') r = Math.min(rows - 1, r + 1); else if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
  else if (e.key === 'Home') c = 0; else if (e.key === 'End') c = cols - 1; else return;
  e.preventDefault();
  const next = $('teamOut').querySelector(`td.tc[data-r="${r}"][data-c="${c}"]`);
  td.tabIndex = -1; next.tabIndex = 0; next.focus();
});
document.addEventListener('click', e => { if (tFocus && !e.target.closest('.ttable')) clearTFocus() });

function renderTeam(){
  const n = team.length;
  tFocus = null;
  $('teamSlots').innerHTML = team.map((m, i) => `<li class="tslot">${monImg(m, 44, 'tslot-mi')}<span class="ts">${m.types.map(t => icon(t, 22)).join('')}</span><span class="tslot-nm"><button class="tslot-name" data-mon="${m.slug}" title="Look up ${esc(m.name)}">${esc(m.name)}</button>${m.champ ? '' : `<span class="nic">${notIn(m, true)}</span>`}</span><button class="tslot-x" data-trm="${i}" aria-label="Remove ${esc(m.name)}">${X_SVG}</button></li>`).join('');
  $('teamCount').textContent = `${n} of ${TEAM_MAX}`;
  tq.disabled = n >= TEAM_MAX;
  if (tq.disabled){ tq.value = ''; closeTSug() }   // e.g. filled by the sample team while something was typed
  tq.placeholder = n >= TEAM_MAX ? 'Team is full' : n ? 'Add another Pokémon' : 'Add a Pokémon, like Garchomp';
  $('teamClear').disabled = !n;
  document.querySelectorAll('[data-tmode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tmode === tmode));
  const out = $('teamOut');
  if (!n){
    out.innerHTML = `<div class="team-empty"><p>Add up to six Pokémon: your own team, or the team you're up against. Then pick a view above.</p>
      <button class="btn" id="teamSample">Try a sample team</button></div>`;
  } else {
    const A = analyse();
    out.innerHTML = (tmode === 'use' ? useView(A, n) : fightView(A, n)) + table(A);
  }
  // Keep the lookup's "Add to team" button in step.
  // Only that button is replaced, so open sections and focus elsewhere in the card are left alone.
  const old = $('plan').querySelector('[data-addteam]');
  if (old){
    const had = document.activeElement === old, m = BY_SLUG.get(old.dataset.addteam);
    old.outerHTML = teamButton(m);
    if (had) $('plan').querySelector('[data-addteam]')?.focus({ preventScroll: true });
  }
}

/* Popover: one move type against each member. */
function teamWhy(anchor, atk){
  const A = analyse().find(r => r.t === atk);
  const body = `<ul class="pop-list">${A.per.map(p => `<li><span>${esc(p.m.name)} <span class="pop-types">(${p.m.types.join('/')})</span></span><span class="mult ${tmode === 'use' ? mineCls(p.x) : mcls(p.x)}">${fmt(p.x)}</span>${p.warn.length ? `<small>${p.warn.map(w => `${esc(w.ab)}: ${fmt(w.x)}`).join(', ')}</small>` : ''}${p.x !== p.base ? '<small>its ability changes this</small>' : ''}</li>`).join('')}</ul>`;
  openPop(anchor, `${atk} moves against ${tmode === 'use' ? 'your team' : 'their team'}`, body);
}

document.addEventListener('click', e => {
  const t = e.target;
  const add = t.closest('[data-addteam]'); if (add){
    const m = BY_SLUG.get(add.dataset.addteam);
    if (onTeam(m)) removeFromTeam(team.findIndex(x => x.slug === m.slug)); else addToTeam(m);
    return;
  }
  const rm = t.closest('[data-trm]'); if (rm){
    const i = +rm.dataset.trm; removeFromTeam(i);
    const xs = $('teamSlots').querySelectorAll('[data-trm]');
    (xs[Math.min(i, xs.length - 1)] || (tq.disabled ? null : tq) || $('teamClear'))?.focus({ preventScroll: true });
    return;
  }
  const md = t.closest('[data-tmode]'); if (md){ tmode = md.dataset.tmode; store.set('tcs-team-mode', tmode); renderTeam(); return }
  if (t.closest('#teamClear')){ team = []; saveTeam(); renderTeam(); say('The team is empty.'); tq.focus({ preventScroll: true }); return }
  if (t.closest('#teamSample')){ team = SAMPLE_TEAM.map(s => BY_SLUG.get(s)).filter(Boolean); saveTeam(); renderTeam(); say(`Added a sample team: ${joinList(team.map(m => m.name))}.`); $('teamSlots').querySelector('[data-trm]')?.focus({ preventScroll: true }); return }
  const why = t.closest('[data-twhy]'); if (why){ teamWhy(why, why.dataset.twhy); return }
});

renderTeam();
if (typeof renderPlan === 'function') renderPlan(); // show the "Add to team" button on a Pokémon opened from the URL
