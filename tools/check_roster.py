"""Compare data/champions.js with Serebii's list of Pokémon available in Pokémon Champions.

    python tools/check_roster.py                  # report differences (exit code 1 if any)
    python tools/check_roster.py --write          # also update data/champions.js and bump sw.js VERSION
    python tools/check_roster.py --file page.html # use a saved copy of the page instead of downloading

What it updates: `species`, `megas` and the regional-form entries in `notForms`
(Alolan/Galarian/Hisuian/Paldean). It never touches `notes` or other `notForms`
entries (like Ash's Greninja); those stay hand-edited.

Exit codes: 0 = no differences (or written), 1 = differences found (report only),
2 = the page couldn't be read or looked wrong, so nothing was changed.
Standard library only, so it runs in GitHub Actions without installing anything.
"""
import argparse
import datetime
import html
import re
import sys
import urllib.request
from pathlib import Path

URL = 'https://www.serebii.net/pokemonchampions/pokemon.shtml'
ROOT = Path(__file__).resolve().parent.parent
CHAMPIONS = ROOT / 'data' / 'champions.js'
POKEMON = ROOT / 'data' / 'pokemon.js'
SW = ROOT / 'sw.js'

REGIONAL = {'a': 'Alolan', 'g': 'Galarian', 'h': 'Hisuian', 'p': 'Paldean'}
MEGA_SUFFIX = {'m': '', 'mx': ' X', 'my': ' Y', 'mz': ' Z'}
# Sprite suffixes for forms that aren't separate entries on the site (e.g. 'e' = Eternal Flower Floette).
IGNORED_SUFFIXES = {'e'}
SPRITE = re.compile(r'/pokemonhome/pokemon/small/(\d+)(?:-([a-z0-9]+))?\.png"[^>]*?alt="([^"]*?) Image"')


def fail(msg):
    print(f'Roster check failed: {msg}\nNothing was changed.', file=sys.stderr)
    sys.exit(2)


def fetch(path):
    if path:
        raw = Path(path).read_bytes()
    else:
        req = urllib.request.Request(URL, headers={'User-Agent': 'champions-battle-helper-roster-check (weekly)'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
        except Exception as e:
            fail(f"couldn't download {URL} ({e})")
    return raw.decode('iso-8859-1')


def parse_serebii(page):
    species, megas, regional, unknown = set(), set(), set(), set()
    for no, suf, alt in SPRITE.findall(page):
        no, alt = int(no), html.unescape(alt)
        if suf is None or suf == '':
            species.add(no)
        elif suf in MEGA_SUFFIX:
            megas.add(alt + MEGA_SUFFIX[suf])
        elif suf in REGIONAL:
            species.add(no)
            regional.add((no, REGIONAL[suf]))
        elif suf in IGNORED_SUFFIXES:
            species.add(no)
        else:
            unknown.add(f'{alt} (sprite suffix "-{suf}")')
    # Sanity checks: if the page layout changed, don't wipe the roster.
    if len(species) < 100 or len(megas) < 10:
        fail(f'only found {len(species)} Pokémon and {len(megas)} Megas on the page; its layout has probably changed')
    return species, megas, regional, unknown


def site_pokemon():
    text = POKEMON.read_text(encoding='utf-8')
    return [(name.replace('\\"', '"'), int(no)) for name, no in re.findall(r'\["((?:[^"\\]|\\.)*)",(\d+),', text)]


def js_list(text, key):
    m = re.search(rf'^  {key}: \[(.*?)\]', text, re.S | re.M)
    if not m:
        fail(f'no `{key}` list in data/champions.js')
    return m


def read_champions():
    text = CHAMPIONS.read_text(encoding='utf-8')
    species = {int(n) for n in re.findall(r'\d+', js_list(text, 'species').group(1))}
    megas = set(re.findall(r"'([^']*)'|\"([^\"]*)\"", js_list(text, 'megas').group(1)))
    megas = {a or b for a, b in megas}
    not_forms = re.findall(r"'([^']*)'|\"([^\"]*)\"", js_list(text, 'notForms').group(1))
    not_forms = [a or b for a, b in not_forms]
    return text, species, megas, not_forms


def quote(s):
    return f'"{s}"' if "'" in s else f"'{s}'"


def wrap(items, width=110, indent='    '):
    lines, line = [], ''
    for it in items:
        piece = it + ','
        if line and len(indent + line + piece) > width:
            lines.append(indent + line)
            line = ''
        line += piece
    if line:
        lines.append(indent + line)
    out = '\n'.join(lines)
    return out[:-1] if out.endswith(',') else out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true', help='update data/champions.js and bump sw.js VERSION')
    ap.add_argument('--file', help='read a saved copy of the Serebii page instead of downloading it')
    ap.add_argument('--summary', help='write a Markdown summary of the changes to this file')
    args = ap.parse_args()

    s_species, s_megas, s_regional, unknown = parse_serebii(fetch(args.file))
    mons = site_pokemon()
    site_names = {n for n, _ in mons}
    text, c_species, c_megas, c_not = read_champions()
    name_of = {}
    for n, no in mons:
        name_of.setdefault(no, n)

    # Regional forms on the site that Serebii doesn't list go in notForms.
    want_regional_not = sorted(
        n for n, no in mons
        if no in s_species and any(n.startswith(p + ' ') for p in REGIONAL.values())
        and not any(no == rno and n.startswith(p + ' ') for rno, p in s_regional)
    )
    keep_not = [n for n in c_not if not any(n.startswith(p + ' ') for p in REGIONAL.values())]
    new_not = keep_not + want_regional_not
    cur_regional_not = sorted(n for n in c_not if n not in keep_not)

    bad_megas = sorted(m for m in s_megas if m not in site_names)
    added = sorted(s_species - c_species)
    removed = sorted(c_species - s_species)
    megas_added = sorted(s_megas - c_megas)
    megas_removed = sorted(c_megas - s_megas)
    forms_now_in = sorted(set(cur_regional_not) - set(want_regional_not))
    forms_now_out = sorted(set(want_regional_not) - set(cur_regional_not))

    report = []
    def section(title, items):
        if items:
            report.append(f'**{title}**\n' + '\n'.join(f'- {i}' for i in items))
    section('Pokémon added', [f'{name_of.get(n, "?")} (#{n})' for n in added])
    section('Pokémon removed', [f'{name_of.get(n, "?")} (#{n})' for n in removed])
    section('Megas added', megas_added)
    section('Megas removed', megas_removed)
    section('Regional forms now available', forms_now_in)
    section('Regional forms not available', forms_now_out)
    warnings = []
    if bad_megas:
        warnings.append('These Megas on Serebii have no matching name in data/pokemon.js, so the site will show them as '
                        'not in Champions. Rename them in data/champions.js, or re-run tools/build_data.py if they are new: '
                        + ', '.join(bad_megas))
    if unknown:
        warnings.append('These forms use a sprite suffix the script doesn\'t know, so they were skipped. Check them by hand: '
                        + ', '.join(sorted(unknown)))
    changed = bool(report)

    summary = ('Serebii\'s Champions list differs from `data/champions.js`.\n\n' + '\n\n'.join(report)
               if changed else 'No roster changes.')
    if warnings:
        summary += '\n\n**Check by hand**\n' + '\n'.join(f'- {w}' for w in warnings)
    summary += f'\n\nSource: {URL}\nNotes (like the Floette one) aren\'t updated automatically; check them before merging.'
    print(summary)
    if args.summary:
        Path(args.summary).write_text(summary + '\n', encoding='utf-8')

    if not changed:
        return 0
    if not args.write:
        return 1

    today = datetime.date.today().isoformat()
    text = re.sub(r'(pokemon\.shtml\), read )\d{4}-\d{2}-\d{2}', rf'\g<1>{today}', text)
    m = js_list(text, 'species')
    text = text[:m.start(1)] + '\n' + wrap([str(n) for n in sorted(s_species)]) + '\n  ' + text[m.end(1):]
    order = {n: i for i, (n, _) in enumerate(mons)}
    m = js_list(text, 'megas')
    text = text[:m.start(1)] + '\n' + wrap([quote(x) for x in sorted(s_megas, key=lambda x: (order.get(x, 1e9), x))]) + '\n  ' + text[m.end(1):]
    m = js_list(text, 'notForms')
    text = text[:m.start(1)] + ', '.join(quote(x) for x in new_not) + text[m.end(1):]
    CHAMPIONS.write_text(text, encoding='utf-8', newline='')

    sw = SW.read_text(encoding='utf-8')
    sw = re.sub(r"const VERSION = 'cbh-v(\d+)';", lambda v: f"const VERSION = 'cbh-v{int(v.group(1)) + 1}';", sw, count=1)
    SW.write_text(sw, encoding='utf-8', newline='')
    print('\nUpdated data/champions.js and bumped VERSION in sw.js.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
