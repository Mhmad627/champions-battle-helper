# Champions Battle Helper

A fast, beginner-friendly battle helper for **Pokémon Champions**. Type the name of the Pokémon you're fighting and it shows which move types hit it hardest, which to avoid, and which abilities could change the result.

It's made for phones, so you can check a matchup mid-battle without memorising the type chart.

## Features

- **Pokémon lookup:** search all 1,230 Pokémon and forms, including regional forms and Megas. Typos are fine.
- **Champions roster:** Pokémon and forms that aren't in Champions are still listed, marked "Not in Pokémon Champions yet". Special cases get a short note (for example, Floette is only allowed in its Eternal Flower form).
- **Battle plan:** "Hit it with" and "Don't bother with" lists. Tap any matchup to see the maths behind it.
- **Two views:** *I'm fighting it* shows what beats it. *I'm using it* shows what to watch out for and what its own moves are strong against.
- **Team checker:** add up to six Pokémon. *I'm using them* shows what your team is weak to, what it handles well and which types its moves can't hit. *I'm fighting them* shows the best move types against their team, what to avoid, what their moves threaten, and the best move against each of them. Both include a full move-type-by-Pokémon table.
- **Ability-aware:** abilities like Levitate, Flash Fire or Thick Fat are applied, or flagged as "might have" when the Pokémon has more than one possible ability.
- **Pick types yourself:** choose any one or two types and see every Pokémon with that typing.
- **Full type chart:** 18×18 chart with tap-to-explain squares.
- **Best and worst types:** the toughest and most fragile typings, and the best attacking pairs.
- **Abilities:** searchable list of all 314 abilities, with filters for matchups, weather and terrain.
- **Weather and terrain:** what each one does, with related abilities.
- **Beginner glossary:** tap terms like STAB, "grounded" or "super effective" for a short explanation.
- **Works offline and installs like an app** (add it to your home screen) when served over HTTPS.
- Light and dark themes, and keyboard shortcuts: `/` search, `R` random Pokémon, `B` best and worst types.

Type matchups follow the current rules (Generation VI and later). Weather, terrain and abilities follow Generation IX.

## Running it locally

It's a static site with no build step and no dependencies.

- Quick look: open `index.html` in a browser.
- Offline and install support need a web server, because service workers don't run from `file://`:
  ```sh
  python -m http.server
  ```
  Then open http://localhost:8000.

To host it, upload the folder to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). When you deploy changes, bump `VERSION` in `sw.js` so phones that have the site saved pick up the new files.

## Updating the data

- **Pokémon and abilities** (`data/pokemon.js`, `data/abilities.js`) are generated from [PokéAPI](https://pokeapi.co)'s public data. Don't edit them by hand; change `tools/build_data.py` and re-run it:
  ```sh
  python tools/build_data.py            # download the latest data and rebuild
  python tools/build_data.py --offline  # rebuild from the cached download in tools/.cache
  ```
- **Champions roster** (`data/champions.js`) is mostly kept up to date by a weekly check (below); `notes` and special cases in `notForms` are edited by hand. It has:
  - `species`: National Dex numbers of the Pokémon in the game
  - `megas`: the Mega Evolutions in the game
  - `notForms`: forms of those Pokémon that aren't in the game (like Galarian Farfetch'd)
  - `notes`: short notes shown under a Pokémon's name

  A GitHub Action (`.github/workflows/roster-check.yml`) compares this file with [Serebii's list](https://www.serebii.net/pokemonchampions/pokemon.shtml) every Monday. If anything changed, it opens a pull request listing what was added or removed. `notes` are never changed automatically. (If you fork the repo, turn on Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".) GitHub pauses scheduled runs after 60 days without commits; turn it back on from the Actions tab if that happens. You can run the same check yourself:
  ```sh
  python tools/check_roster.py           # show differences
  python tools/check_roster.py --write   # update data/champions.js and bump the sw.js VERSION
  ```
- **Pokémon icons** (`assets/pokemon/`, `data/sprites.js`) come from PokéAPI's sprite collection: `python tools/get_sprites.py` (needs Pillow; run after `build_data.py`, `--offline` reuses `tools/.cache/sprites`).
- **App icons and the link preview image** (`assets/icons/`, `assets/og-image.png`) are made with `python tools/make_icons.py` (needs Pillow).

The data files are plain JavaScript rather than JSON so the site still works when `index.html` is opened straight from disk.

## Project layout

```
index.html            the helper
about.html            about and privacy
manifest.webmanifest  install info (name, icons, colours)
sw.js                 offline cache
css/style.css         all styles (dark and light themes)
js/data.js            type chart, glossary, ability effects, weather and terrain
js/app.js             search, battle plan, chart, abilities, rankings, navigation
js/team.js            team checker
js/theme.js           light/dark button (shared by both pages)
data/                 generated Pokémon and ability data, hand-edited Champions roster
assets/pokemon/       Pokémon icons (generated)
assets/types/         type icons
assets/icons/         app icons and favicon
assets/fonts/         Bricolage Grotesque
tools/                data and icon generators, weekly roster check
.github/workflows/    the weekly roster check
```

## Found a mistake?

If the roster, a matchup or an ability is wrong, please [open an issue](../../issues). Game updates can change things before this site catches up.

## Privacy

No accounts, cookies, analytics or ads, and nothing you type leaves your device. The site only saves your theme choice and your last six lookups in your browser's local storage. See `about.html` for details.

## Credits

- Pokémon and ability data: [PokéAPI](https://pokeapi.co). Pokémon icons: [PokéAPI sprites](https://github.com/PokeAPI/sprites).
- Champions roster: based on [Serebii](https://www.serebii.net/pokemonchampions/pokemon.shtml).
- Font: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), SIL Open Font License.

This is an unofficial fan project and isn't affiliated with, endorsed by or sponsored by Nintendo, Game Freak, Creatures or The Pokémon Company. Pokémon, Pokémon Champions, the Pokémon images, the type names and the type icons are trademarks and copyrights of their respective owners.
