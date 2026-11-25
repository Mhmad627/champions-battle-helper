'use strict';
/* Champions Battle Helper — app logic. Data lives in js/data.js and data/*.js */

const $ = id => document.getElementById(id);
const T = TYPES;
const idx = n => T.indexOf(n);
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const fold = t => t.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/♀/g,' f').replace(/♂/g,' m').replace(/[^a-z0-9]+/g,' ').trim();
const joinList = (a, w = 'and') => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + w + ' ' + a[a.length - 1];
const store = {
  get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

/* ---------- Type helpers ---------- */
function lum(hex){const v=[1,3,5].map(i=>parseInt(hex.substr(i,2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]}
const ON = Object.fromEntries(T.map(t => [t, lum(TYPE_COLOR[t]) > .18 ? '#161A2E' : '#FFFFFF']));
const icon = (t, size) => `<img class="ti" src="assets/types/${t.toLowerCase()}.webp" alt="" width="${size||20}" height="${size||20}" decoding="async">`;
const chip = (t, cls='') => `<span class="chip ${cls}" style="--tc:${TYPE_COLOR[t]}">${icon(t)}${t}</span>`;
const mult = (a, d) => { const m = CHART[a]; return m[0].includes(d) ? 2 : m[1].includes(d) ? .5 : m[2].includes(d) ? 0 : 1 };
const vs = (a, defs) => defs.reduce((p, d) => p * mult(a, d), 1);
const NICE = {4:'4×',2:'2×',1:'1×',.5:'½×',.25:'¼×',0:'0×'};
const fmt = x => NICE[x] ?? (+x.toFixed(2)) + '×';
const short = x => ({4:'4',2:'2',1:'',.5:'½',.25:'¼',0:'0'})[x];
const mcls = x => x === 0 ? 'm0' : x >= 4 ? 'm4' : x > 1 ? 'm2' : x === 1 ? 'm1' : x <= .25 ? 'mq' : 'mh';
const WORD = x => x === 0 ? 'No effect' : x > 1 ? 'Super effective' : x < 1 ? 'Not very effective' : 'Normal damage';

/* ---------- Data ---------- */
const SPR = new Set(window.SPRITES || []);
const MON = window.POKEMON.map(([name, no, types, abil, hidden, key, pid], i) => ({ i, name, no, types, abil, hidden, key, f: fold(name), slug: fold(name).replace(/ /g, '-'), spr: SPR.has(pid) ? pid : 0 }));
// Pokémon icon (PokéAPI sprite, see tools/get_sprites.py); empty when there's no sprite for that form.
// If the image can't load (e.g. offline and never seen before), it's removed, or swapped for type icons (monFace).
const monImg = (m, size, cls = '', fallback = '') => m && m.spr ? `<img class="mi ${cls}" src="assets/pokemon/${m.spr}.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onerror="${fallback ? `this.outerHTML=this.dataset.fb" data-fb="${esc(fallback)}` : 'this.remove()'}">` : '';
// Pokémon icon, or its type icons when there's no sprite (or it fails to load).
const monFace = (m, size, tsize) => { const ts = `<span class="ts">${m.types.map(t => icon(t, tsize || 22)).join('')}</span>`; return m.spr ? monImg(m, size, '', ts) : ts };
const CH_SPECIES = new Set((window.CHAMPIONS || {}).species || []), CH_MEGAS = new Set((window.CHAMPIONS || {}).megas || []);
const CH_NOT = new Set((window.CHAMPIONS || {}).notForms || []), CH_NOTES = (window.CHAMPIONS || {}).notes || {};
// Label for Pokémon and forms outside the roster. "Yet" because the roster changes with game updates.
// `short` is the compact version for the search list.
const notIn = (m, short) => short ? 'Not in Champions' : 'Not in Pokémon Champions yet';
MON.forEach(m => m.champ = m.name.startsWith('Mega ') ? CH_MEGAS.has(m.name) : CH_SPECIES.has(m.no) && !CH_NOT.has(m.name));
const BY_SLUG = new Map(MON.map(m => [m.slug, m]));
const AB = window.ABILITIES.map(([name, gen, desc, sum]) => ({ name, gen, desc, sum }));
const AB_BY = new Map(AB.map(a => [a.name, a]));
const sameTypes = (a, b) => a.length === b.length && a.every(t => b.includes(t));

/* ---------- State ---------- */
let sel = [];          // selected types
let mon = null;        // selected Pokémon (or null when types were picked by hand)
let mode = 'fight';    // 'fight' = I'm fighting it, 'use' = I'm using it
let recent = store.get('tcs-recent', []); if (!Array.isArray(recent)) recent = [];

let push = false;
function setMon(m){
  mon = m; sel = [...m.types]; push = true;
  recent = [m.slug, ...recent.filter(s => s !== m.slug)].slice(0, 6);
  store.set('tcs-recent', recent);
  render();
}
function setTypes(arr){ mon = null; sel = arr; push = true; render() }
function toggleType(t){
  const s = mon ? [] : [...sel];
  const i = s.indexOf(t);
  if (i > -1) s.splice(i, 1); else { s.push(t); if (s.length > 2) s.shift() }
  setTypes(s);
}

/* ---------- Search ---------- */
function lev(a, b){
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for (let i = 1; i <= m; i++){
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function search(q, monsOnly){
  const f = fold(q); if (!f) return [];
  const out = [];
  if (!monsOnly) T.forEach(t => { const tl = t.toLowerCase(); if (tl.startsWith(f)) out.push({ kind:'type', t, s: tl === f ? 0 : 1 }) });
  for (const m of MON){
    let s = null;
    if (m.f === f) s = 0;
    else if (m.f.startsWith(f)) s = 1;
    else if (m.f.split(' ').some(w => w.startsWith(f))) s = 2;
    else if (m.key.includes(f)) s = 3;
    if (s !== null) out.push({ kind:'mon', m, s });
  }
  if (!out.some(r => r.kind === 'mon') && f.length >= 3){
    const lim = f.length <= 5 ? 1 : 2;
    for (const m of MON){
      const d = Math.min(lev(f, m.f), lev(f, m.f.slice(0, f.length)));
      if (d <= lim) out.push({ kind:'mon', m, s: 4 + d });
    }
  }
  return out.sort((a, b) => a.s - b.s || (a.kind === 'type' ? -1 : b.kind === 'type' ? 1 : a.m.i - b.m.i)).slice(0, 8);
}

const q = $('q'), sug = $('sug');
let sugItems = [], sugActive = -1;
function renderSug(){
  const v = q.value;
  $('qClear').hidden = !v;
  if (!v.trim()){ closeSug(); return }
  sugItems = search(v); sugActive = sugItems.length ? 0 : -1;
  sug.innerHTML = sugItems.length ? sugItems.map((r, k) => r.kind === 'type'
    ? `<li role="option" id="o${k}" data-k="${k}"><span class="mi-box"></span><span class="ts">${icon(r.t, 24)}</span><span class="nm">${r.t}</span><span class="kind">type</span></li>`
    : `<li role="option" id="o${k}" data-k="${k}"><span class="mi-box">${monImg(r.m, 40)}</span><span class="ts">${r.m.types.map(t => icon(t, 24)).join('')}</span><span class="nm">${esc(r.m.name)}</span><span class="sr">, ${r.m.types.join(' and ')}</span>${r.m.champ ? '' : `<span class="nic">${notIn(r.m, true)}</span>`}<span class="no">#${r.m.no}</span></li>`).join('')
    : `<li class="empty">No Pokémon or type called “${esc(v.trim())}”. Check the spelling?</li>`;
  sug.hidden = false; q.setAttribute('aria-expanded', 'true');
  markActive();
}
function markActive(){
  [...sug.querySelectorAll('[role=option]')].forEach((li, k) => li.setAttribute('aria-selected', k === sugActive));
  if (sugActive > -1){ q.setAttribute('aria-activedescendant', 'o' + sugActive); $('o' + sugActive)?.scrollIntoView({block:'nearest'}) }
  else q.removeAttribute('aria-activedescendant');
}
function closeSug(){ sugItems = []; sugActive = -1; sug.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant') }
function pick(k){
  const r = sugItems[k]; if (!r) return;
  closeSug(); q.value = ''; $('qClear').hidden = true;
  if (r.kind === 'type') setTypes([r.t]); else setMon(r.m);
  if (matchMedia('(max-width:700px)').matches) q.blur();
  $('plan').scrollIntoView({ behavior:'smooth', block:'nearest' });
}
q.addEventListener('input', renderSug);
q.addEventListener('focus', () => { if (q.value.trim()) renderSug() });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' && sugItems.length){ e.preventDefault(); sugActive = (sugActive + 1) % sugItems.length; markActive() }
  else if (e.key === 'ArrowUp' && sugItems.length){ e.preventDefault(); sugActive = (sugActive - 1 + sugItems.length) % sugItems.length; markActive() }
  else if (e.key === 'Enter'){ e.preventDefault(); if (!q.value.trim()) return; if (sug.hidden) renderSug(); pick(Math.max(sugActive, 0)) }
  else if (e.key === 'Escape'){ if (!sug.hidden){ closeSug(); e.stopPropagation() } else if (q.value){ q.value = ''; $('qClear').hidden = true; e.stopPropagation() } }
});
sug.addEventListener('mousedown', e => e.preventDefault());
sug.addEventListener('click', e => { const li = e.target.closest('[data-k]'); if (li) pick(+li.dataset.k) });
$('qClear').addEventListener('click', () => { q.value = ''; closeSug(); $('qClear').hidden = true; q.focus() });
document.addEventListener('click', e => { if (!e.target.closest('.search-box')) closeSug() });

function renderRecent(){
  const list = recent.map(s => BY_SLUG.get(s)).filter(Boolean);
  $('recent').innerHTML = list.length
    ? 'Recent: ' + list.map(m => `<button class="rchip" data-mon="${m.slug}">${monFace(m, 30)}${esc(m.name)}</button>`).join('')
    : '';
}

/* ---------- Abilities that change matchups ---------- */
function abilitiesOf(m){
  if (!m) return [];
  const all = [...new Set([...m.abil, ...(m.hidden ? [m.hidden] : [])])];
  return all.map(a => ({ name: a, hidden: a === m.hidden && !m.abil.includes(a), def: ABILITY_DEF[a], sure: all.length === 1 }));
}
function applyAb(x, atk, def, types = sel){
  if (!def) return x;
  if (def.mods && atk in def.mods) x *= def.mods[atk];
  if (def.se && x > 1) x *= def.se;
  if (def.wg && x <= 1) x = 0;
  if (def.ds && types.includes('Flying') && mult(atk, 'Flying') === 2) x /= 2;
  return x;
}
// Defensive profile of a typing (and Pokémon, for abilities): every attacking type -> {x, base, warn:[{ab, x}]}
function profileOf(types, m){
  const abs = abilitiesOf(m);
  const sure = abs.filter(a => a.sure && a.def && (a.def.mods || a.def.se || a.def.wg || a.def.ds));
  const maybe = abs.filter(a => !a.sure && a.def && (a.def.mods || a.def.se || a.def.wg || a.def.ds));
  return T.map(a => {
    const base = vs(a, types);
    let x = base; sure.forEach(s => x = applyAb(x, a, s.def, types));
    const warn = [];
    maybe.forEach(s => { const y = applyAb(x, a, s.def, types); if (y !== x) warn.push({ ab: s.name, x: y }) });
    return { t: a, x, base, warn };
  });
}
const profile = () => profileOf(sel, mon);

/* ---------- Battle plan ---------- */
const WARN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>';
const term = (key, text) => `<button class="term" data-term="${key}">${text || GLOSSARY[key][0].toLowerCase()}</button>`;

function tiles(list, kind, empty){
  if (!list.length) return `<p class="none">${empty || (kind === 'good' ? 'Nothing. No move type is super effective here.' : 'Nothing. Every move type does at least normal damage.')}</p>`;
  return `<div class="tiles${kind === 'small' ? ' small' : ''}">` + list.map(p => {
    const cls = p.x === 0 ? 'zero' : p.x < 1 ? 'bad' : p.x >= 4 ? 'x4' : '';
    const w = p.warn && p.warn.length ? ' warn' : '';
    const note = w ? `<span class="tx">unless it has ${joinList(p.warn.map(x => x.ab), 'or')}</span>` : '';
    return `<button class="tile ${cls}${w}" data-why="${p.t}" aria-label="${p.t}: ${fmt(p.x)}${w ? ', unless it has ' + p.warn.map(x => x.ab).join(' or ') : ''}. Show why.">${icon(p.t, 40)}<span><span class="tn">${p.t}</span>${note}</span><span class="big">${fmt(p.x)}</span></button>`;
  }).join('') + '</div>';
}

function renderPlan(){
  const el = $('plan');
  el.style.removeProperty('--c1'); el.style.removeProperty('--c2');
  if (!sel.length){
    el.innerHTML = `<div class="welcome">
      <h2>Look up the Pokémon you're up against</h2>
      <p>You'll get the move types that hit it hardest, the ones to avoid, and why.</p>
      <div class="tries">${['Garchomp','Gyarados','Gengar','Charizard','Pikachu','Snorlax'].map(n => BY_SLUG.get(fold(n))).filter(Boolean).map(m => `<button class="rchip" data-mon="${m.slug}">${monFace(m, 30)}${esc(m.name)}</button>`).join('')}</div>
      <ol>
        <li>Every Pokémon has one or two types, like Fire or Water/Ground.</li>
        <li>Every move has a type too.</li>
        <li>Some move types are ${term('super effective')} against some Pokémon types and deal double damage. Others are ${term('not very effective')}, or have no effect at all.</li>
      </ol>
    </div>`;
    return;
  }
  el.style.setProperty('--c1', TYPE_COLOR[sel[0]]);
  el.style.setProperty('--c2', TYPE_COLOR[sel[1] || sel[0]]);
  const name = mon ? mon.name : sel.join(' / ');
  const P = profile();
  const hit = P.filter(p => p.x > 1).sort((a, b) => b.x - a.x || idx(a.t) - idx(b.t));
  const skip = P.filter(p => p.x < 1).sort((a, b) => a.x - b.x || idx(a.t) - idx(b.t));
  const neutral = P.filter(p => p.x === 1);
  const abs = abilitiesOf(mon);

  let h = `<div class="plan-head"><div class="plan-id">${mon ? monImg(mon, 96, 'plan-mi') : ''}<div>
      ${mon ? `<span class="plan-no">#${String(mon.no).padStart(4, '0')}${mon.champ ? '' : `<span class="nic">${notIn(mon)}</span>`}</span>` : ''}
      <h2 class="plan-name" tabindex="-1">${esc(name)}</h2>
      <div class="plan-types">${sel.map(t => chip(t, 'lg')).join('')}</div>
      ${mon && typeof teamButton === 'function' ? teamButton(mon) : ''}
      ${mon && CH_NOTES[mon.name] ? `<p class="plan-note">${esc(CH_NOTES[mon.name])}</p>` : ''}
    </div></div>
    <div class="mode" role="group" aria-label="View">
      <button data-mode="fight" aria-pressed="${mode === 'fight'}">I'm fighting it</button>
      <button data-mode="use" aria-pressed="${mode === 'use'}">I'm using it</button>
    </div></div>`;

  if (mon && !abs.length) h += `<div class="abil">Ability: not listed yet for this form.</div>`;
  if (abs.length){
    h += `<div class="abil">${abs.length > 1 ? 'Possible abilities:' : 'Ability:'} ${abs.map(a => `<button class="abtn" data-ab="${esc(a.name)}">${esc(a.name)}${a.hidden ? ' <i>hidden</i><span class="sr"> ability</span>' : ''}</button>`).join('')}</div>`;
  }

  if (mode === 'fight'){
    h += `<div class="plan-sec"><h3>Hit it with <small>${term('super effective', 'super effective')} moves</small></h3>${tiles(hit, 'good')}</div>`;
    h += `<div class="plan-sec"><h3>Don't bother with <small>${term('resist', 'resisted')} or blocked</small></h3>${tiles(skip, 'small')}</div>`;
  } else {
    const cov = T.map(d => ({ t: d, x: Math.max(...sel.map(s => mult(s, d))) }));
    h += `<div class="plan-sec"><h3>Watch out for <small>moves that hit it hard</small></h3>${tiles(hit, 'good')}</div>`;
    h += `<div class="plan-sec"><h3>Its moves are strong against <small>using its own types, with the ${term('stab', 'STAB')} bonus</small></h3>${tiles(cov.filter(c => c.x > 1), 'small', "Nothing. Its own types aren't super effective against anything.")}</div>`;
    h += `<div class="plan-sec"><h3>It takes less damage from</h3>${tiles(skip, 'small')}</div>`;
  }

  // Ability notes
  const notes = abs.filter(a => a.def);
  if (notes.length){
    h += `<ul class="notes">${notes.map(a => `<li>${WARN_SVG}<span>${a.sure ? `It has <b>${esc(a.name)}</b>: ${a.def.say}${a.def.mods || a.def.se || a.def.wg || a.def.ds ? ' This is already counted above.' : ''}` : `It might have <b>${esc(a.name)}</b>${a.hidden ? ' (its ' + term('hidden ability') + ')' : ''}: ${a.def.say}`}</span></li>`).join('')}</ul>`;
  }

  // Mega Evolution / Primal Reversion: team preview shows the normal form, but its types and ability can change
  if (mon) h += megaSec(mon);
  // Status and effects its types make it immune to
  const imm = immunities(sel);
  if (imm.length) h += `<div class="plan-sec"><h3>${mode === 'fight' ? 'Its types protect it from' : "It's safe from"} <small>because of its ${sel.length > 1 ? 'types' : 'type'}</small></h3><ul class="imm">${imm.map(i => `<li>${chip(i.t)}<span>${i.say}</span></li>`).join('')}</ul></div>`;

  h += `<details class="more"><summary>Normal damage (1×) from ${neutral.length} types</summary>${tiles(neutral, 'small')}</details>`;

  const same = MON.filter(m => sameTypes(m.types, sel) && m !== mon);
  h += `<div class="same">${same.length ? `${mon ? 'Same typing:' : 'Pokémon with this typing:'} ${same.map(m => `<button data-mon="${m.slug}"${m.champ ? '' : ` class="out" title="${notIn(m)}"`}>${monImg(m, 26)}${esc(m.name)}${m.champ ? '' : `<span class="sr"> (${notIn(m).replace('Not in', 'not in')})</span>`}</button>`).join('')}` : (mon ? '' : 'No Pokémon has this exact typing.')}</div>`;
  el.innerHTML = h;
}

/* ---------- Mega Evolution and type immunities (lookup card) ---------- */
const REGIONAL = /^(Alolan|Galarian|Hisuian|Paldean) /;
const MEGA_RE = /^(Mega|Primal) /;
const NO_MEGA = new Set(["Ash's Greninja"]);   // other forms that can't Mega Evolve
// Megas that come from a form other than the usual one. Original Color Magearna isn't in the data, so that
// Mega simply shows no base form (rather than claiming plain Magearna can become it).
const MEGA_FROM = { 'Mega Zygarde': 'Complete Zygarde', 'Mega Original Magearna': 'Original Color Magearna' };
const canMega = x => !MEGA_RE.test(x.name) && !REGIONAL.test(x.name) && !NO_MEGA.has(x.name);
// The forms a Mega (or Primal) can come from (both Meowstic, for example).
const megaBases = x => MEGA_FROM[x.name] ? [BY_SLUG.get(fold(MEGA_FROM[x.name]).replace(/ /g, '-'))].filter(Boolean)
  : MON.filter(y => y.no === x.no && canMega(y) && !Object.values(MEGA_FROM).includes(y.name));
// A Pokémon button like the ones in "Same typing": dimmed and labelled when it isn't in Champions.
const monBtn = (x, size) => `<button class="rchip${x.champ ? '' : ' out'}" data-mon="${x.slug}"${x.champ ? '' : ` title="${notIn(x)}"`}>${monImg(x, size)}${esc(x.name)}${x.champ ? '' : `<span class="sr"> (${notIn(x).replace('Not in', 'not in')})</span>`}</button>`;
// What it becomes when it Mega Evolves: types and ability.
function megaSec(m){
  if (MEGA_RE.test(m.name)){
    // Looking at the Mega itself: point back to the normal form.
    const from = megaBases(m);
    return from.length ? `<p class="mega-from">${m.name.startsWith('Primal') ? 'Before Primal Reversion' : 'Before Mega Evolving'}, it's ${from.map(f => monBtn(f, 26)).join(' or ')}</p>` : '';
  }
  if (!canMega(m)) return '';
  const into = MON.filter(x => x.no === m.no && MEGA_RE.test(x.name) && megaBases(x).includes(m));
  if (!into.length) return '';
  const primal = into.every(x => x.name.startsWith('Primal'));
  // Kept short on purpose: new types and ability. Tapping the Mega opens its own card with the full matchups.
  const rows = into.map(x => {
    const types = sameTypes(x.types, m.types) ? 'Same types' : `Becomes ${x.types.map(t => chip(t)).join(' ')}`;
    const ab = `<span class="mega-ab">Ability: ${x.abil[0] ? `<button class="abtn" data-ab="${esc(x.abil[0])}">${esc(x.abil[0])}</button>` : 'not listed yet'}</span>`;
    return `<li>${monBtn(x, 30)}<div class="mega-fx"><span>${types}</span>${ab}</div></li>`;
  }).join('');
  const verb = primal ? 'Primal Revert' : 'Mega Evolve';
  const when = primal ? (mode === 'fight' ? 'as soon as it comes out holding its orb, which changes what hits it' : 'by itself when it comes out holding its orb')
    : (mode === 'fight' ? 'mid-battle, which can change what hits it' : 'once per battle, for one Pokémon on your team');
  return `<div class="plan-sec mega"><h3>It can ${verb} <small>${when}</small></h3><ul class="mega-list">${rows}</ul></div>`;
}
// Status conditions and effects a Pokémon's types make it immune to (Gen IX rules).
const TYPE_IMMUNE = {
  Fire: ["Can't be burned (Will-O-Wisp fails)."],
  Electric: ["Can't be paralyzed (Thunder Wave fails)."],
  Ice: ["Can't be frozen."],
  Poison: ["Can't be poisoned, unless the attacker has Corrosion."],
  Steel: ["Can't be poisoned, unless the attacker has Corrosion.", 'Takes no sandstorm damage.'],
  Rock: ['Takes no sandstorm damage.'],
  Ground: ['Takes no sandstorm damage.'],
  Grass: ['Powder and spore moves (Spore, Sleep Powder, Stun Spore, Rage Powder) and Leech Seed don\'t affect it.'],
  Ghost: ["Can't be trapped (Mean Look, Block, Shadow Tag, Arena Trap): it can always switch out."],
  Dark: ["An opponent's status moves sped up by Prankster fail against it (an ally's still work)."],
  Flying: ["Spikes, Toxic Spikes, Sticky Web and Arena Trap don't affect it, unless something grounds it (Smack Down, Gravity, Roost)."],
};
function immunities(types){
  const seen = new Set(), out = [];
  types.forEach(t => (TYPE_IMMUNE[t] || []).forEach(say => { if (!seen.has(say)){ seen.add(say); out.push({ t, say }) } }));
  return out;
}

/* ---------- Manual type picker ---------- */
$('types').innerHTML = T.map(t => `<button class="type" data-t="${t}" style="--tc:${TYPE_COLOR[t]};--on:${ON[t]}" aria-pressed="false">${icon(t, 28)}${t}<span class="badge"></span></button>`).join('');
$('types').addEventListener('click', e => { const b = e.target.closest('.type'); if (b) toggleType(b.dataset.t) });
$('clear').addEventListener('click', () => setTypes([]));
$('rand').addEventListener('click', randomMon);
function randomMon(){ setMon(MON[Math.random() * MON.length | 0]) }

/* ---------- Chart ---------- */
const g = $('grid');
(function buildGrid(){
  let h = '<div class="corner">Move type ↓</div>';
  T.forEach(t => h += `<button class="ch" data-t="${t}" title="${t}" aria-label="${t}">${icon(t, 34)}</button>`);
  h += '<div></div><div class="combo-h" id="comboH" title="What you looked up"></div>';
  T.forEach((a, r) => {
    h += `<button class="rh" data-t="${a}">${icon(a, 28)}${a}</button>`;
    T.forEach((d, c) => { const x = mult(a, d); h += `<div class="cell ${x === 2 ? 's' : x === .5 ? 'r' : x === 0 ? 'z' : ''}" data-r="${r}" data-c="${c}" tabindex="${r || c ? -1 : 0}" role="img" aria-label="${a} move against ${d}: ${fmt(x)}, ${WORD(x).toLowerCase()}">${short(x)}</div>` });
    h += `<div></div><div class="combo" data-r="${r}"></div>`;
  });
  g.innerHTML = h;
})();
const cells = [...g.querySelectorAll('.cell')];
const combos = [...g.querySelectorAll('.combo')];
let focused = null;
function focusCell(el){
  if (el === focused) return;
  focused = el;
  const r = +el.dataset.r, isCombo = el.classList.contains('combo'), col = isCombo ? null : +el.dataset.c;
  g.classList.add('hovering');
  cells.forEach(x => { const c = +x.dataset.c; const on = +x.dataset.r === r || (isCombo ? sel.includes(T[c]) : c === col); x.classList.toggle('dim', !on); x.classList.toggle('focus', x === el) });
  combos.forEach(x => x.classList.toggle('focus', x === el));
  showReadout(T[r], isCombo ? sel : [T[col]]);
}
function clearFocus(){ focused = null; g.classList.remove('hovering'); cells.forEach(x => x.classList.remove('dim', 'focus')); combos.forEach(x => x.classList.remove('focus')); showReadout(null) }
g.addEventListener('mouseover', e => { const c = e.target.closest('.cell,.combo'); if (c) focusCell(c) });
g.addEventListener('mouseleave', clearFocus);
g.addEventListener('click', e => {
  const b = e.target.closest('.ch,.rh'); if (b){
    toggleType(b.dataset.t);
    $('readout').innerHTML = sel.length ? `Now showing ${sel.map(t => chip(t)).join(' ')} in the last column and in the lookup at the top.` : 'Selection cleared.';
    centerChart();
    return }
  const c = e.target.closest('.cell,.combo'); if (c) focusCell(c);
});
// Picking a type from the chart changes the lookup at the top of the page, which pushes the chart
// up or down. Instead, centre the chart (axis label to readout) in the visible area, between the
// sticky header and the phone tab bar.
// Scroll so the span from a to z (viewport y positions) is centred in the visible area, between the
// sticky header and the phone tab bar. With topIfTall, a span taller than the screen is lined up
// with its top just under the header instead, so its start (e.g. the Pokémon's name) stays in view.
function centerSpan(a, z, topIfTall){
  const top = document.querySelector('.top')?.getBoundingClientRect().bottom || 0;
  const bar = $('tabbar'), barH = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0;
  const room = innerHeight - barH - top;
  scrollBy({ top: topIfTall && z - a > room ? a - top - 12 : (a + z) / 2 - (top + room / 2), behavior: 'instant' });
}
function centerChart(){
  centerSpan(g.closest('.chart-inner').getBoundingClientRect().top, $('readout').getBoundingClientRect().bottom);
}
// Centre the lookup card (after picking a Pokémon from anywhere on the page).
function showPlan(){ const r = $('plan').getBoundingClientRect(); centerSpan(r.top, r.bottom, true) }
function showReadout(atk, defs){
  const el = $('readout');
  if (!atk){ el.innerHTML = 'Hover or tap a square to read it.'; return }
  if (!defs.length){ el.innerHTML = `${chip(atk)} <span>Look up a Pokémon first to fill the last column.</span>`; return }
  const x = vs(atk, defs);
  el.innerHTML = `${chip(atk)} move against ${defs.map(d => chip(d)).join(' ')} <span class="mult ${mcls(x)}">${fmt(x)}</span><strong>${WORD(x)}</strong>`;
}
function renderChart(){
  const any = sel.length > 0;
  cells.forEach(x => x.classList.toggle('colsel', sel.includes(T[+x.dataset.c])));
  g.querySelectorAll('.ch,.rh').forEach(b => b.classList.toggle('on', sel.includes(b.dataset.t)));
  $('comboH').innerHTML = any ? sel.map(t => icon(t, 26)).join('') : 'YOU';
  T.forEach((a, r) => {
    const x = any ? vs(a, sel) : 1;
    combos[r].className = 'combo ' + (any ? ({4:'x4',2:'x2',.5:'xh',.25:'xq',0:'x0'}[x] || '') : '');
    combos[r].textContent = any ? (short(x) || '·') : '';
  });
  if (focused){ const f = focused; focused = null; focusCell(f) } else showReadout(null);
}

g.addEventListener('focusin', e => { const c = e.target.closest('.cell'); if (c) focusCell(c) });
g.addEventListener('keydown', e => {
  const c = e.target.closest('.cell'); if (!c) return;
  let r = +c.dataset.r, col = +c.dataset.c;
  if (e.key === 'ArrowRight') col = Math.min(17, col + 1); else if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
  else if (e.key === 'ArrowDown') r = Math.min(17, r + 1); else if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
  else if (e.key === 'Home') col = 0; else if (e.key === 'End') col = 17; else return;
  e.preventDefault();
  const next = cells[r * 18 + col]; c.tabIndex = -1; next.tabIndex = 0; next.focus();
});

/* ---------- Screen reader summary ---------- */
function announce(){
  const el = $('announce'); if (!el) return;
  if (!sel.length){ el.textContent = ''; return }
  const P = profile(), hit = P.filter(p => p.x > 1).sort((a, b) => b.x - a.x), imm = P.filter(p => p.x === 0);
  el.textContent = `${mon ? mon.name + ', ' : ''}${sel.join(' and ')} type. ` +
    (hit.length ? `Hit it with ${hit.map(p => p.t + ' ' + fmt(p.x)).join(', ')}.` : 'Nothing is super effective.') +
    (imm.length ? ` No effect: ${imm.map(p => p.t).join(', ')}.` : '');
}

/* ---------- Abilities ---------- */
const WX = /\b(sun|sunny|sunlight|rain|rainy|sandstorms?|hail|snow|weather)\b/i, TR = /terrain/i;
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX'];
const TAGN = { match:'Matchups', weather:'Weather', terrain:'Terrain' };
AB.forEach(a => {
  const t = a.name + ' ' + a.desc + ' ' + a.sum;
  a.tags = [];
  if (MATCHUP_ABILITIES.has(a.name)) a.tags.push('match');
  if (WX.test(t)) a.tags.push('weather');
  if (TR.test(t)) a.tags.push('terrain');
  a.hay = t.toLowerCase();
});
const TYPE_RE = new RegExp('\\b(' + T.join('|') + ')\\b(-type)?', 'g');
function rich(text, qq, plain){
  let h = esc(text);
  if (qq){ const re = new RegExp('(' + qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); h = h.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(re, '<mark>$1</mark>')) }
  if (plain) return h;
  return h.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => tag || txt.replace(TYPE_RE, (mm, w, suf) => `<span class="tword" style="color:color-mix(in srgb,${TYPE_COLOR[w]} 75%,var(--text))">${icon(w, 16)}${w}${suf || ''}</span>`));
}
let abFilter = 'all';
// Which Pokémon can have each ability: Champions Pokémon first, then the rest (dimmed, like "Same typing").
const AB_MONS = new Map();
MON.forEach(m => [...new Set([...m.abil, ...(m.hidden ? [m.hidden] : [])])].forEach(a => {
  if (!AB_MONS.has(a)) AB_MONS.set(a, []);
  AB_MONS.get(a).push({ m, hidden: a === m.hidden && !m.abil.includes(a) });
}));
AB_MONS.forEach(l => l.sort((a, b) => b.m.champ - a.m.champ || a.m.no - b.m.no || a.m.i - b.m.i));
function abMons(name){
  return (AB_MONS.get(name) || []).map(({ m, hidden }) => `<button data-mon="${m.slug}"${m.champ ? '' : ` class="out" title="${notIn(m)}"`}>${monImg(m, 26)}${esc(m.name)}${hidden ? ' <small>hidden</small><span class="sr"> ability</span>' : ''}${m.champ ? '' : `<span class="sr"> (${notIn(m).replace('Not in', 'not in')})</span>`}</button>`).join('');
}
// Phones show the list a few at a time; computers have a scroll box.
const AB_STEP = () => matchMedia('(max-width:640px)').matches ? 15 : 160;   // same width as the CSS that drops the box
let abShown = 0, abStep = 160;   // abStep: the batch size the "Show N more" button promised
function abCard(a, qq, open){
  const n = (AB_MONS.get(a.name) || []).length, ql = qq.toLowerCase();
  return `<article class="ab${ql && a.name.toLowerCase() === ql ? ' hit' : ''}">
      <div class="ab-top"><span class="ab-name">${rich(a.name, qq, 1)}</span>${a.tags.map(t => `<span class="tag ${t}">${TAGN[t]}</span>`).join('')}<span class="tag gen">Gen ${ROMAN[a.gen]}</span></div>
      <p>${rich(a.desc, qq)}</p>${a.sum ? `<p class="sum">${rich(a.sum, qq)}</p>` : ''}${ABILITY_DEF[a.name] ? `<p class="fx">In battle: ${esc(ABILITY_DEF[a.name].say)}</p>` : ''}
      ${n ? `<details class="ab-mons" data-abmons="${esc(a.name)}"${open ? ' open' : ''}><summary>Pokémon with this ability (${n})</summary><div class="same">${open ? abMons(a.name) : ''}</div></details>` : ''}
    </article>`;
}
function renderAbilities(more){
  const qq = $('abQ').value.trim(), ql = qq.toLowerCase(), gen = +$('abGen').value;
  let list = AB.filter(a => (abFilter === 'all' || a.tags.includes(abFilter)) && (!gen || a.gen === gen) && (!ql || a.hay.includes(ql)));
  if (ql){ const rank = n => { n = n.toLowerCase(); return n === ql ? 0 : n.startsWith(ql) ? 1 : n.includes(ql) ? 2 : 3 }; list.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)) }
  $('abCount').textContent = `${list.length} of ${AB.length} abilities`;
  const el = $('abList');
  if (!list.length){ el.innerHTML = `<div class="ab-empty">No ability matches “${esc(qq)}”. Try a shorter word.</div>`; return }
  const from = more ? abShown : 0;
  if (!more) abStep = AB_STEP();
  abShown = Math.min(list.length, from + abStep);
  // A search that names one ability exactly (or finds just one) opens its Pokémon list.
  const cards = list.slice(from, abShown).map(a => abCard(a, qq, list.length === 1 || (ql && a.name.toLowerCase() === ql))).join('');
  const left = list.length - abShown;
  const tail = left > 0 ? `<div class="ab-more"><button class="btn" data-abmore>Show ${Math.min(left, abStep)} more</button><span>${left} not shown. Type to narrow it down.</span></div>` : '';
  if (more){
    el.querySelector('.ab-more')?.remove();
    el.insertAdjacentHTML('beforeend', cards + tail);
    $('announce').textContent = `Showing ${abShown} of ${list.length} abilities.`;
  } else { el.innerHTML = cards + tail; el.scrollTop = 0 }
}
// Fill a Pokémon list the first time it's opened.
$('abList').addEventListener('toggle', e => {
  const d = e.target; if (!d.matches || !d.matches('details[data-abmons]') || !d.open) return;
  const box = d.querySelector('.same'); if (!box.children.length) box.innerHTML = abMons(d.dataset.abmons);
}, true);
$('abList').addEventListener('click', e => {
  if (!e.target.closest('[data-abmore]')) return;
  const first = $('abList').querySelectorAll('.ab').length;
  renderAbilities(true);
  // Keep keyboard focus in place: move it to the first new card's Pokémon list (or the next button).
  const next = $('abList').querySelectorAll('.ab')[first];
  if (!next) return;
  // The first new card's Pokémon list, or the card itself if it has none.
  const to = next.querySelector('summary') || (next.tabIndex = -1, next);
  to.focus({ preventScroll: true });
});
$('abQ').addEventListener('input', () => renderAbilities());
$('abGen').addEventListener('change', () => renderAbilities());
$('abF').addEventListener('click', e => { const b = e.target.closest('.fchip'); if (!b) return; abFilter = b.dataset.f; $('abF').querySelectorAll('.fchip').forEach(x => x.setAttribute('aria-pressed', x === b)); renderAbilities() });
function showAbilityInList(name){
  closePop();
  $('abQ').value = name; abFilter = 'all'; $('abGen').value = '0';
  $('abF').querySelectorAll('.fchip').forEach(x => x.setAttribute('aria-pressed', x.dataset.f === 'all'));
  renderAbilities(); goTo('sec-abilities'); $('abQ').focus({ preventScroll: true });
}

/* ---------- Weather & terrain ---------- */
function fcard(f){
  const isT = f.n.includes('Terrain');
  let boost = '';
  (f.up || []).forEach(t => boost += `<span class="pair">${chip(t)}<span class="mult m2">${isT ? '1.3×' : '1.5×'}</span></span>`);
  (f.down || []).forEach(t => boost += `<span class="pair">${chip(t)}<span class="mult mh">0.5×</span></span>`);
  (f.half || []).forEach(t => boost += `<span class="pair">${chip(t)}<span class="mult mh">0.5× vs grounded</span></span>`);
  (f.def || []).forEach(t => boost += `<span class="pair">${chip(t)}<span class="mult m2">${f.n === 'Snow' ? 'Defense' : 'Sp. Def'} 1.5×</span></span>`);
  const ic = f.svg ? SVG_WEATHER[f.svg] : icon(f.icon, 48);
  return `<article class="fcard" data-field="${f.n}">
    <span class="yours" hidden></span>
    <div class="fcard-top"><span class="ficon" style="--fc:${f.c}" aria-hidden="true">${ic}</span><div><h3>${f.n}</h3><p class="set">Set by ${f.set.join(', ')}${f.rock ? `. A held ${f.rock} makes it last 8 turns.` : ''}</p></div></div>
    <div class="fboost">${boost}</div>
    <ul>${f.fx.map(x => `<li>${rich(x)}</li>`).join('')}</ul>
    <div class="frel">Related abilities: ${f.ab.filter(a => AB_BY.has(a)).map(a => `<button class="abtn" data-ab="${a}">${a}</button>`).join('')}</div>
  </article>`;
}
$('weatherGrid').innerHTML = WEATHER.map(fcard).join('');
$('terrainGrid').innerHTML = TERRAIN.map(fcard).join('');
$('xGrid').innerHTML = EXTREME.map(x => `<div class="xcard"><h4>${x.n}</h4><p>${rich(x.t)}</p><div class="frel"><button class="abtn" data-ab="${x.a}">${x.a}</button></div></div>`).join('');
function renderField(){
  [...WEATHER, ...TERRAIN].forEach(f => {
    const el = document.querySelector(`[data-field="${f.n}"] .yours`);
    const good = [...(f.up || []), ...(f.def || [])].filter(t => sel.includes(t));
    let txt = good.length ? 'Helps ' + (mon ? mon.name : 'your ' + good.join(' & ')) : '';
    if (!txt && f.safe && sel.some(t => f.safe.includes(t))) txt = 'No damage to ' + (mon ? mon.name : 'your pick');
    el.hidden = !txt; el.textContent = txt;
    el.parentNode.classList.toggle('helps', !!txt);
  });
}

/* ---------- Popover: glossary, abilities, "why" ---------- */
const pop = $('pop');
let popFrom = null;
const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function openPop(anchor, title, body){
  if (!anchor.closest('#pop')) popFrom = anchor;
  pop.innerHTML = `<button class="x" aria-label="Close">${X_SVG}</button><h4 id="popTitle">${title}</h4>${body}`;
  pop.hidden = false;
  if (!matchMedia('(max-width:640px)').matches){
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.left), innerWidth - w - 12);
    let top = r.bottom + 8; if (top + hgt > innerHeight - 12) top = Math.max(12, r.top - hgt - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  } else { pop.style.left = ''; pop.style.top = '' }
  pop.querySelector('.x').focus({ preventScroll: true });
}
function closePop(restore){ if (pop.hidden) return; pop.hidden = true; if (restore && popFrom && document.contains(popFrom)) popFrom.focus({ preventScroll: true }); popFrom = null }
function abilityPop(anchor, name){
  const a = AB_BY.get(name);
  const d = ABILITY_DEF[name];
  openPop(anchor, esc(name), (a ? `<p>${rich(a.desc)}</p>${a.sum ? `<p>${rich(a.sum)}</p>` : ''}` : '<p>No description available.</p>') +
    (d ? `<p class="fx">In battle: ${esc(d.say)}</p>` : '') + `<button class="more-link" data-ablist="${esc(name)}">Open in the abilities list</button>`);
}
function whyPop(anchor, atk){
  const parts = sel.map(d => ({ d, x: mult(atk, d) }));
  const P = profile().find(p => p.t === atk);
  let body = `<p>${parts.map(p => `${atk} vs ${p.d}: <b>${fmt(p.x)}</b>`).join('<br>')}</p>`;
  if (parts.length > 1) body += `<p>Multiply them: ${parts.map(p => fmt(p.x).replace('×', '')).join(' × ')} = <b>${fmt(P.base)}</b>. That's how ${term('dual type', 'dual types')} work.</p>`;
  if (P.x !== P.base) body += `<p>Its ability changes this to <b>${fmt(P.x)}</b>.</p>`;
  if (P.warn.length) body += `<p>If it has ${P.warn.map(w => `<b>${esc(w.ab)}</b> it becomes <b>${fmt(w.x)}</b>`).join(', and if it has ')}.</p>`;
  openPop(anchor, `${atk} moves: ${fmt(P.x)}`, body);
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('.pop .x')){ closePop(true); return }
  const ml = t.closest('[data-ablist]'); if (ml){ showAbilityInList(ml.dataset.ablist); return }
  const tm = t.closest('[data-term]'); if (tm){ const [ti, tx] = GLOSSARY[tm.dataset.term]; openPop(tm, ti, `<p>${tx}</p>`); return }
  const ab = t.closest('[data-ab]'); if (ab){ abilityPop(ab, ab.dataset.ab); return }
  const why = t.closest('[data-why]'); if (why){ whyPop(why, why.dataset.why); return }
  if (!t.closest('.pop')) closePop();
  const mb = t.closest('[data-mode]'); if (mb){ mode = mb.dataset.mode; renderPlan(); announce(); $('plan').querySelector(`[data-mode="${mode}"]`)?.focus(); return }
  // Any Pokémon button (recent, examples, same typing, team): open it and centre the lookup card.
  const mn = t.closest('[data-mon]'); if (mn){ const m = BY_SLUG.get(mn.dataset.mon); if (m){
    setMon(m); showPlan(); $('plan').querySelector('.plan-name')?.focus({ preventScroll: true });
  } return }
  if (!t.closest('#grid') && focused) clearFocus();
});

/* ---------- Rankings ---------- */
const DW = {4:-2, 2:-1, 1:0, .5:1, .25:2, 0:3};
const COMBOS = [];
T.forEach((a, i) => { COMBOS.push([a]); T.slice(i + 1).forEach(b => COMBOS.push([a, b])) });
const PROFILES = COMBOS.map(c => {
  const m = T.map(a => vs(a, c));
  return { c, def: m.reduce((p, x) => p + DW[x], 0), weak: m.filter(x => x > 1).length, x4: m.filter(x => x === 4).length,
    res: m.filter(x => x > 0 && x < 1).length, imm: m.filter(x => x === 0).length,
    cov: T.filter(d => Math.max(...c.map(s => mult(s, d))) === 2).length,
    ex: MON.filter(p => sameTypes(p.types, c)).slice(0, 2).map(p => p.name) };
});
const NOTES = {
  best: 'Each move type adds points: +1 if it\'s resisted, +2 if it\'s resisted twice, +3 if it does nothing. Weaknesses take away 1, or 2 for a 4× weakness.',
  worst: 'Same score, lowest first. These types get hit super effectively by lots of moves and resist very little.',
  off: 'How many of the 18 types this pair\'s own moves can hit for 2×. Ties go to the tougher typing.'
};
let rankTab = 'best';
function renderRank(){
  const singles = $('rankSingles').checked;
  const list = PROFILES.filter(p => singles || p.c.length === 2);
  if (rankTab === 'best') list.sort((a, b) => b.def - a.def || a.weak - b.weak);
  if (rankTab === 'worst') list.sort((a, b) => a.def - b.def || b.weak - a.weak);
  if (rankTab === 'off') list.sort((a, b) => b.cov - a.cov || b.def - a.def);
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-pressed', t.dataset.tab === rankTab));
  $('rankNote').textContent = NOTES[rankTab];
  const off = rankTab === 'off';
  $('rankList').innerHTML = list.slice(0, 20).map((p, i) => {
    const val = off ? p.cov : p.def, cls = off || val > 0 ? 'pos' : val < 0 ? 'neg' : '';
    return `<li><button class="rank-item${sameTypes(p.c, sel) ? ' cur' : ''}" data-combo="${p.c.join('+')}">
      <span class="rank-n">${i + 1}</span>
      <span class="rank-types">${p.c.map(t => chip(t)).join('')}
        <span class="rank-meta"><span class="w">${p.weak} weak</span>${p.x4 ? ` (${p.x4} at 4×)` : ''}, <span class="r">${p.res} resisted</span>, ${p.imm} immune${p.ex.length ? `. Like ${p.ex.map(esc).join(', ')}` : '. No Pokémon has this yet'}</span></span>
      <span class="rank-score ${cls}">${!off && val > 0 ? '+' : ''}${val}<small>${off ? 'of 18' : 'score'}</small></span>
    </button></li>`;
  }).join('');
  $('rankList').scrollTop = 0;
}
function openRank(){ renderRank(); $('rank').showModal() }
$('rankBtn').addEventListener('click', openRank);
$('rankClose').addEventListener('click', () => $('rank').close());
$('rank').addEventListener('click', e => {
  if (e.target === $('rank')){ $('rank').close(); return }
  const tab = e.target.closest('.tab'); if (tab){ rankTab = tab.dataset.tab; renderRank(); return }
  const it = e.target.closest('.rank-item');
  if (it){ setTypes(it.dataset.combo.split('+')); $('rank').close(); showPlan() }
});
$('rankSingles').addEventListener('change', renderRank);

/* ---------- Navigation ---------- */
const navLinks = [...document.querySelectorAll('.secnav a, .tabbar a')];
const SECS = ['sec-match', 'sec-team', 'sec-chart', 'sec-abilities', 'sec-field'];
function goTo(id){ document.getElementById(id).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
document.querySelectorAll('.secnav a, .tabbar a, .brand').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goTo(a.getAttribute('href').slice(1)) }));
function updateNav(){
  $('top').classList.toggle('stuck', scrollY > 10);
  let cur = 0; SECS.forEach((id, i) => { if (document.getElementById(id).getBoundingClientRect().top < innerHeight * .35) cur = i });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = SECS.length - 1;
  navLinks.forEach(a => { const on = a.getAttribute('href') === '#' + SECS[cur]; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current') });
}
addEventListener('scroll', updateNav, { passive: true });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !pop.hidden){ closePop(true); return }
  if (e.metaKey || e.ctrlKey || e.altKey || $('rank').open) return;
  if (e.target.closest('input,select,textarea')){ if (e.key === 'Escape') e.target.blur(); return }
  const k = e.key.toLowerCase();
  if (k === '/'){ e.preventDefault(); goTo('sec-match'); q.focus({ preventScroll: true }) }
  else if (k === 'r') randomMon();
  else if (k === 'b'){ e.preventDefault(); openRank() }
});

/* Theme button: see js/theme.js */

/* ---------- Render + URL ---------- */
function render(){
  $('types').querySelectorAll('.type').forEach(b => {
    const k = mon ? -1 : sel.indexOf(b.dataset.t);
    b.setAttribute('aria-pressed', k > -1);
    b.querySelector('.badge').textContent = k > -1 ? k + 1 : '';
  });
  $('clear').disabled = !sel.length;
  renderPlan(); renderChart(); renderField(); renderRecent();
  const hash = mon ? '#p=' + mon.slug : sel.length ? '#t=' + sel.map(t => t.toLowerCase()).join('+') : '';
  const url = hash || location.pathname + location.search;
  if (push && url !== location.hash) history.pushState(null, '', url); else history.replaceState(null, '', url);
  push = false;
  announce();
  document.title = mon ? `${mon.name} weaknesses and counters · Champions Battle Helper` : 'Champions Battle Helper: what beats any Pokémon';
}
function fromHash(){
  let h = ''; try { h = decodeURIComponent(location.hash.slice(1)) } catch {}
  if (!h){ mon = null; sel = []; return }
  if (h.startsWith('p=')){ const m = BY_SLUG.get(h.slice(2)); if (m){ mon = m; sel = [...m.types] } }
  else if (h.startsWith('t=')){
    const list = h.slice(2).split('+').map(s => T.find(t => t.toLowerCase() === s)).filter(Boolean);
    mon = null; sel = [...new Set(list)].slice(0, 2);
  }
}
addEventListener('popstate', () => { fromHash(); render() });
fromHash();
renderAbilities();
render();
updateNav();

/* Offline support and the update banner live in js/update.js (shared with about.html). */
