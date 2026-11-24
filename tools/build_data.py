"""Build the site's data files from PokéAPI's public CSV tables.

Usage:  python tools/build_data.py            (downloads tables into tools/.cache)
        python tools/build_data.py --offline  (reuse the cached tables)

Writes:
  data/pokemon.js    window.POKEMON   = [[name, dexNo, [types], [abilities], hiddenAbility, searchKey], ...]
  data/abilities.js  window.ABILITIES = [[name, gen, description, summary], ...]

Data: PokéAPI (https://pokeapi.co), BSD-3 licensed code / data from the games.
Plain JS files (not JSON) so the site also works when opened straight from disk.
"""
import csv, io, json, os, re, sys, unicodedata, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.cache')
BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
TABLES = ['pokemon', 'pokemon_types', 'pokemon_abilities', 'pokemon_species', 'pokemon_species_names',
          'pokemon_forms', 'pokemon_form_names', 'types', 'abilities', 'ability_names',
          'ability_flavor_text', 'ability_prose']
EN = '9'


def table(name):
    path = os.path.join(CACHE, name + '.csv')
    if '--offline' not in sys.argv or not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(BASE + name + '.csv', headers={'User-Agent': 'type-matchup-site-builder'})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(path, 'wb').write(r.read())
    with open(path, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def clean(t):
    t = (t or '').replace('’', "'").replace('­', '')
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def fold(t):
    """lowercase, strip accents and punctuation: 'Flabébé' -> 'flabebe', 'Mr. Mime' -> 'mr mime'"""
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    t = t.replace('♀', ' f').replace('♂', ' m')
    return re.sub(r'[^a-z0-9]+', ' ', t).strip()


T = {r['id']: r['identifier'].capitalize() for r in table('types')}
ab_rows = table('abilities')
ab_name = {r['ability_id']: clean(r['name']) for r in table('ability_names') if r['local_language_id'] == EN}
ab_gen = {r['id']: int(r['generation_id']) for r in ab_rows}
ab_main = {r['id'] for r in ab_rows if r['is_main_series'] == '1'}

# ---------- abilities ----------
flavor = {}
for r in table('ability_flavor_text'):
    if r['language_id'] != EN:
        continue
    vg = int(r['version_group_id'])
    if r['ability_id'] not in flavor or vg >= flavor[r['ability_id']][0]:
        flavor[r['ability_id']] = (vg, clean(r['flavor_text']))
prose = {r['ability_id']: clean(r['short_effect']) for r in table('ability_prose') if r['local_language_id'] == EN}
# PokéAPI prose uses [text]{mechanic:x} style links; keep the visible text only
prose = {k: re.sub(r'\[([^\]]*)\]\{[^}]*\}', lambda m: m.group(1) or '', v) for k, v in prose.items()}


def norm(t):
    return re.sub(r'[^a-z]', '', t.lower())


abilities = []
for aid in ab_main:
    name = ab_name.get(aid)
    if not name:
        continue
    desc = flavor.get(aid, (0, ''))[1]
    summ = prose.get(aid, '')
    if not desc:
        desc, summ = summ, ''
    if summ and (norm(summ) == norm(desc) or norm(summ) in norm(desc)):
        summ = ''
    abilities.append([name, ab_gen[aid], desc, summ])
abilities.sort(key=lambda a: a[0])

# ---------- pokémon ----------
species_name = {r['pokemon_species_id']: clean(r['name']) for r in table('pokemon_species_names') if r['local_language_id'] == EN}
types = defaultdict(list)
for r in sorted(table('pokemon_types'), key=lambda r: int(r['slot'])):
    types[r['pokemon_id']].append(T[r['type_id']])

abil = {}
for r in sorted(table('pokemon_abilities'), key=lambda r: int(r['slot'])):
    normal, hidden = abil.setdefault(r['pokemon_id'], ([], [None]))
    n = ab_name.get(r['ability_id'])
    if not n:
        continue
    if r['is_hidden'] == '1':
        hidden[0] = n
    elif n not in normal:
        normal.append(n)

forms = {}
for r in table('pokemon_forms'):
    if r['is_default'] == '1':
        forms[r['pokemon_id']] = r
form_label = {r['pokemon_form_id']: (clean(r['pokemon_name']), clean(r['form_name']))
              for r in table('pokemon_form_names') if r['local_language_id'] == EN}

SKIP = re.compile(r'(-gmax|-totem|-starter|-cap$|-cap-|-busted|-eternamax|-own-tempo|-power-construct|-battle-bond)')
out, default_sig = [], {}
rows = sorted(table('pokemon'), key=lambda r: (int(r['species_id']), int(r['is_default']) == 0, int(r['id'])))
for r in rows:
    pid, sid = r['id'], r['species_id']
    ty = types.get(pid)
    if not ty or sid not in species_name:
        continue
    normal, hidden = abil.get(pid, ([], [None]))
    sig = (tuple(ty), tuple(normal), hidden[0])
    if r['is_default'] == '1':
        default_sig[sid] = sig
        name = species_name[sid]
    else:
        if SKIP.search(r['identifier']):
            continue
        if default_sig.get(sid) == sig:      # cosmetic form: same types and abilities
            continue
        f = forms.get(pid)
        pname, fname = form_label.get(f['id'], ('', '')) if f else ('', '')
        if pname:
            name = pname
        elif fname:
            name = f"{species_name[sid]} ({fname})"
        else:
            name = species_name[sid] + ' (' + r['identifier'].split('-', 1)[-1].replace('-', ' ').title() + ')'
    key = fold(name + ' ' + r['identifier'].replace('-', ' '))
    out.append([name, int(sid), ty, normal, hidden[0], key])

# drop exact duplicate display names (keep first)
seen, final = set(), []
for p in out:
    if p[0] in seen:
        continue
    seen.add(p[0]); final.append(p)

os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
hdr = '// Generated by tools/build_data.py from PokéAPI data. Do not edit by hand.\n'
with open(os.path.join(ROOT, 'data', 'pokemon.js'), 'w', encoding='utf-8') as f:
    f.write(hdr + 'window.POKEMON=' + json.dumps(final, ensure_ascii=False, separators=(',', ':')) + ';\n')
with open(os.path.join(ROOT, 'data', 'abilities.js'), 'w', encoding='utf-8') as f:
    f.write(hdr + 'window.ABILITIES=' + json.dumps(abilities, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(final)} Pokemon entries, {len(abilities)} abilities')
