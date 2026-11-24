# Champions Battle Helper

A fast, beginner-friendly battle helper for **Pokémon Champions**. Type the name of the Pokémon you're fighting and it shows which move types hit it hardest, which to avoid, and which abilities could change the result.

## Features

- **Pokémon lookup:** search all 1,230 Pokémon and forms (regional forms and Megas included). Typos are fine. Pokémon that aren't in Champions yet are still listed, marked "Not in Champions".
- **Battle plan:** "Hit it with" and "Don't bother with" lists, with tap-to-explain maths for each matchup.
- **Two views:** *I'm fighting it* (what beats it) and *I'm using it* (what to watch out for, and what its own moves are strong against).
- **Ability-aware:** abilities like Levitate, Flash Fire or Thick Fat are applied or flagged as "might have".
- **Pick types yourself:** choose any one or two types, and see every Pokémon with that typing.
- **Full type chart:** 18×18 chart with tap-to-explain squares and a column for the current lookup.
- **Best and worst types:** rankings of the toughest and most fragile typings and the best attacking pairs.
- **Abilities:** searchable list of all 314 abilities, with filters for matchups, weather and terrain.
- **Weather and terrain:** what each one does, with related abilities.
- **Beginner glossary:** tap terms like STAB, "grounded" or "super effective" for a short explanation.
- **Works offline and installs like an app** (add it to your home screen) once it's served over HTTPS.
- Light and dark themes, phone-first layout, and keyboard shortcuts: `/` search, `R` random Pokémon, `B` best and worst types.

## Running it

It's a static site with no build step.

- Quick look: open `index.html` in a browser.
- Offline and install support need a real web server (service workers don't run from `file://`). For local testing: `python -m http.server`, then open http://localhost:8000.
- To publish, upload the folder to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

When you deploy changes, bump `VERSION` in `sw.js` so phones that have the site cached pick up the new files.

## Updating the data

- **Pokémon and abilities** (`data/pokemon.js`, `data/abilities.js`) are generated from [PokéAPI](https://pokeapi.co)'s public CSV tables:
  ```sh
  python tools/build_data.py            # download the latest tables and rebuild
  python tools/build_data.py --offline  # rebuild from the cached tables in tools/.cache
  ```
- **Champions roster** (`data/champions.js`) is edited by hand: a list of National Dex numbers plus the Mega Evolutions that are available.
- **Icons and the link preview image** (`assets/icons/`, `assets/og-image.png`): `python tools/make_icons.py`.

## Project layout

```
index.html            the helper
about.html            about and privacy
manifest.webmanifest  install info (name, icons, colours)
sw.js                 offline cache
robots.txt
css/style.css         all styles (dark and light themes)
js/data.js            type chart, glossary, ability effects, weather and terrain
js/app.js             search, battle plan, chart, abilities, rankings, navigation
data/                 generated Pokémon and ability data, hand-edited Champions roster
assets/types/         type icons (WebP)
assets/icons/         app icons and favicon
assets/fonts/         Bricolage Grotesque (SIL Open Font License)
tools/                data and icon generators
```

## Before launch

Once the site has a domain, make the `og:image` URL in `index.html` absolute (link previews need a full URL), and add a sitemap line to `robots.txt`.

## Credits

- Pokémon and ability data: [PokéAPI](https://pokeapi.co).
- Champions roster: based on [Serebii](https://www.serebii.net/pokemonchampions/pokemon.shtml).
- Font: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), SIL Open Font License.

This is an unofficial fan project and isn't affiliated with Nintendo, Game Freak or The Pokémon Company. Pokémon, Pokémon Champions, the type names and the type icons are trademarks of their respective owners.
