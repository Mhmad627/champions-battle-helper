"""Build the site's data files from PokéAPI's public CSV tables.

Usage:  python tools/build_data.py            (downloads tables into tools/.cache)
        python tools/build_data.py --offline  (reuse the cached tables)

Writes:
  data/pokemon.js    window.POKEMON   = [[name, dexNo, [types], [abilities], hiddenAbility, searchKey, pokeapiId], ...]
                     (pokeapiId names the sprite file: see tools/get_sprites.py)
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
for aid in sorted(ab_main, key=int):   # fixed order, so re-running gives the same file
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
# Two abilities share a name (Calyrex's riders each have their own As One). The site looks abilities up
# by name, so keep one entry that describes both.
MERGED = {'As One': ("This Ability combines the effects of Calyrex's Unnerve Ability with its steed's: "
                     "Chilling Neigh for Ice Rider Calyrex, Grim Neigh for Shadow Rider Calyrex.",
                     'Combines Unnerve with Chilling Neigh (Ice Rider) or Grim Neigh (Shadow Rider).')}
by_name = {}
for a in abilities:
    if a[0] in by_name:
        if a[0] not in MERGED:
            sys.exit(f'Two abilities are called {a[0]}: add it to MERGED in build_data.py.')
        continue
    by_name[a[0]] = a
for n, (desc, summ) in MERGED.items():
    if n in by_name:
        by_name[n][2:4] = [desc, summ]
abilities = sorted(by_name.values(), key=lambda a: a[0])

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
    out.append([name, int(sid), ty, normal, hidden[0], key, int(pid)])

# drop exact duplicate display names (keep first)
seen, final = set(), []
for p in out:
    if p[0] in seen:
        continue
    seen.add(p[0]); final.append(p)

os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
hdr = '// Generated by tools/build_data.py from PokéAPI data. Do not edit by hand.\n'
changed = False
for name, var, data in (('pokemon.js', 'POKEMON', final), ('abilities.js', 'ABILITIES', abilities)):
    path = os.path.join(ROOT, 'data', name)
    text = hdr + f'window.{var}=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    old_text = open(path, encoding='utf-8').read() if os.path.exists(path) else None
    if text != old_text:
        open(path, 'w', encoding='utf-8', newline='\n').write(text); changed = True
print(f'{len(final)} Pokemon entries, {len(abilities)} abilities')
if changed:
    # The service worker serves the site from its cache, so phones only get new data when VERSION goes up.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    sw, n = re.subn(r"const VERSION = 'cbh-v(\d+)';", lambda v: f"const VERSION = 'cbh-v{int(v.group(1)) + 1}';", sw, count=1)
    if not n:
        sys.exit("Data updated, but couldn't find the VERSION line in sw.js. Bump it by hand.")
    open(sw_path, 'w', encoding='utf-8', newline='').write(sw)
    print('Data changed: bumped VERSION in sw.js.')
else:
    print('Data unchanged.')
