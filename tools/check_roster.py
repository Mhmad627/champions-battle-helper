"""Compare data/champions.js with Serebii's list of Pokémon available in Pokémon Champions.

    python tools/check_roster.py                  # report differences (exit code 1 if any)
    python tools/check_roster.py --write          # also update data/champions.js and bump sw.js VERSION
    python tools/check_roster.py --file page.html # use a saved copy of the page instead of downloading

What it updates: `species`, `megas`, and the `notForms` entries for every (non-Mega) form
of Pokémon that have regional variants (Alolan/Galarian/Hisuian/Paldean), e.g. all four
Darmanitan forms. It never touches `notes` or `notForms` entries for other Pokémon (like
Ash's Greninja); those stay hand-edited.

Exit codes: 0 = no differences (or written), 1 = differences found (report only),
2 = the page couldn't be read or looked wrong, so nothing was changed,
3 = something needs checking by hand (listed under "Check by hand"); with --write,
    any other changes were still written.
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
IGNORED_FORMS = {'670-e'}

# Hand-edited. Use these to settle "Check by hand" warnings so they stop coming back:
# Serebii's name for a Mega -> the name in data/pokemon.js, when the two differ.
MEGA_ALIASES = {
    # 'Mega Example': 'Mega Example Form',
}
# Form sprites ("dex-suffix") you've checked by hand. Listing one here means "this sprite shows the
# Pokémon is in the game" (e.g. '479-h' for Heat Rotom). Unknown sprites are only flagged, never counted.
KNOWN_FORMS = set()
SPRITE = re.compile(r'/pokemonhome/pokemon/small/(\d+)(?:-([a-z0-9]+))?\.png"[^>]*?alt="([^"]*?) Image"')


def region_of(name):
    """'Galarian' for 'Galarian Slowbro' and 'Standard Galarian Darmanitan'; None for regular forms and Megas."""
    if name.startswith('Mega '):
        return None
    m = re.search(r'\b(' + '|'.join(REGIONAL.values()) + r')\b', name)
    return m.group(1) if m else None


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
                charset = r.headers.get_content_charset()
        except Exception as e:
            fail(f"couldn't download {URL} ({e})")
        if charset:
            try:
                return raw.decode(charset)
            except (LookupError, UnicodeDecodeError):
                pass  # header was wrong; fall back below
    # Serebii serves ISO-8859-1; names with accents are HTML entities, so this is safe for saved copies too.
    return raw.decode('iso-8859-1')


def parse_serebii(page, mons):
    # Sprite suffixes are short codes that Serebii reuses (e.g. '-m' is Mega, but also Midnight Lycanroc;
    # '-h' is Hisuian, but also Heat Rotom). So a suffix only counts as a Mega when the name says "Mega",
    # and as a regional form only when the site really has that regional form. Anything else is flagged.
    site_regional = {(no, region_of(n)) for n, no in mons if region_of(n)}
    species, plain, megas, regional, unknown = set(), set(), set(), set(), set()
    for no, suf, alt in SPRITE.findall(page):
        no, alt = int(no), html.unescape(alt).strip()
        if not suf or f'{no}-{suf}' in IGNORED_FORMS or f'{no}-{suf}' in KNOWN_FORMS:
            species.add(no)
            plain.add(no)  # the regular form is listed
        elif suf in MEGA_SUFFIX and alt.startswith('Mega '):
            name = alt if alt.endswith(MEGA_SUFFIX[suf]) else alt + MEGA_SUFFIX[suf]
            megas.add(MEGA_ALIASES.get(name, name))
        elif suf in REGIONAL and (no, REGIONAL[suf]) in site_regional:
            # Covers every form with that prefix, e.g. all three Paldean Tauros breeds share one sprite.
            species.add(no)
            regional.add((no, REGIONAL[suf]))
        else:
            unknown.add((no, f'{alt} #{no} (sprite "{no}-{suf}")'))
    # Sanity checks: if the page layout changed, don't wipe the roster.
    if len(species) < 100 or len(megas) < 10:
        fail(f'only found {len(species)} Pokémon and {len(megas)} Megas on the page; its layout has probably changed')
    return species, plain, megas, regional, unknown


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

    mons = site_pokemon()
    s_species, s_plain, s_megas, s_regional, unknown = parse_serebii(fetch(args.file), mons)
    # A Pokémon that only shows up with an unknown sprite code keeps its current status until checked by hand.
    unknown_dex = {no for no, _ in unknown}
    unknown = {text for _, text in unknown}
    site_names = {n for n, _ in mons}
    text, c_species, c_megas, c_not = read_champions()
    name_of = {}
    for n, no in mons:
        name_of.setdefault(no, n)
    keep = (c_species & unknown_dex) - s_species
    s_species |= keep
    s_plain |= keep

    # notForms entries this script manages: every non-Mega form of Pokémon that have regional forms.
    # A regional form Serebii doesn't list, or a regular form when Serebii only lists a regional
    # one (e.g. only Hisuian Typhlosion), goes in notForms. Other entries are left alone.
    prefix = region_of
    # For Pokémon that have regional forms, the script also manages their other (non-regional) forms,
    # e.g. Darmanitan and Zen Darmanitan. Forms of other Pokémon (like Ash's Greninja) stay hand-edited.
    has_regional = {no for n, no in mons if prefix(n)}
    regular = {name_of[no] for no in has_regional}
    managed = regular | {n for n, no in mons if no in has_regional and not n.startswith('Mega ')}
    want_not = set()
    for n, no in mons:
        if no not in s_species or n.startswith('Mega '):
            continue
        if prefix(n):
            if (no, prefix(n)) not in s_regional:
                want_not.add(n)
        elif no in has_regional and no not in s_plain:
            want_not.add(n)  # only a regional form is in the game
    # Keep the existing order; drop entries that no longer apply and add new ones at the end.
    # Entries for Pokémon that left the roster entirely are kept (they don't matter until it returns).
    dex_of = dict(mons)
    gone = {n for n in c_not if dex_of.get(n) not in s_species}
    new_not = [n for n in c_not if n not in managed or n in want_not or n in gone] + sorted(want_not - set(c_not))
    forms_now_in = sorted(n for n in c_not if n in managed and n not in want_not and n not in gone)
    forms_now_out = sorted(want_not - set(c_not))

    bad_megas = sorted(m for m in s_megas if m not in site_names)
    # If most Mega names don't match the site, Serebii probably changed how it writes them: stop rather
    # than replace a good list. Otherwise leave the unmatched ones out and flag them below.
    if len(bad_megas) * 2 > len(s_megas):
        fail(f'{len(bad_megas)} of {len(s_megas)} Mega names on the page don\'t match data/pokemon.js '
             f'(e.g. {", ".join(bad_megas[:3])}); the page format has probably changed')
    s_megas -= set(bad_megas)
    # A Mega under an unknown sprite code or with an unmatched name may just have been renamed or recoded:
    # don't remove any Megas this run; the warnings ask for a check.
    if bad_megas or any('Mega' in text or '-m' in text for text in unknown):
        s_megas |= c_megas
    added = sorted(s_species - c_species)
    removed = sorted(c_species - s_species)
    megas_added = sorted(s_megas - c_megas)
    megas_removed = sorted(c_megas - s_megas)

    report = []
    def section(title, items):
        if items:
            report.append(f'**{title}**\n' + '\n'.join(f'- {i}' for i in items))
    section('Pokémon added', [f'{name_of.get(n, "?")} (#{n})' for n in added])
    section('Pokémon removed', [f'{name_of.get(n, "?")} (#{n})' for n in removed])
    section('Megas added', megas_added)
    section('Megas removed', megas_removed)
    section('Forms now available', forms_now_in)
    section('Forms not available', forms_now_out)
    warnings = []
    if bad_megas:
        warnings.append('These Megas on Serebii have no matching name in data/pokemon.js, so they were left out (and no Megas were removed this run, in case Serebii renamed some): '
                        + ', '.join(bad_megas) + '. If they are new, re-run tools/build_data.py. If the site just names '
                        'them differently, add them to MEGA_ALIASES in tools/check_roster.py.')
    typos = [n for n in c_not if n not in site_names]
    if typos:
        warnings.append('These notForms names in data/champions.js don\'t match any Pokémon in data/pokemon.js, '
                        'so they do nothing. Fix the spelling: ' + ', '.join(typos))
    if unknown:
        warnings.append('These forms use a sprite code the script doesn\'t know, so they weren\'t counted (a Pokémon already on the roster keeps its current status): '
                        + ', '.join(sorted(unknown)) + '. Check them; if they show the Pokémon is in the game, add the '
                        'codes to KNOWN_FORMS in tools/check_roster.py (and add any forms that aren\'t in the game to notForms).')
    changed = bool(report)

    summary = ('Serebii\'s Champions list differs from `data/champions.js`.\n\n' + '\n\n'.join(report)
               if changed else 'No roster changes.')
    if warnings:
        summary += '\n\n**Check by hand**\n' + '\n'.join(f'- {w}' for w in warnings)
    summary += (f'\n\nSource: {URL}\nNotes (like the Floette one) aren\'t updated automatically; check them before merging. '
                'If you changed sw.js VERSION on main since this was opened, make sure it still goes up after merging.')
    print(summary)
    if args.summary:
        Path(args.summary).write_text(summary + '\n', encoding='utf-8')

    status = 3 if warnings else 0
    if not changed:
        return status
    if not args.write:
        return status or 1

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
    return status


if __name__ == '__main__':
    sys.exit(main())
