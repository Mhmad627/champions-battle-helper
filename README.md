# Type Cheat Sheet

A Pokémon type matchup helper for players who can't remember every matchup. Type the name of the Pokémon you're fighting and it shows which move types hit it hardest, which to avoid, and why.

## Features

- **Pokémon lookup:** search all 1,230 Pokémon and forms (regional forms and Megas included). Typos are fine.
- **Battle plan:** "Hit it with" and "Don't bother with" lists, with tap-to-explain maths for each matchup.
- **Two views:** *I'm fighting it* (what beats it) and *I'm using it* (what to watch out for, and what its own moves are strong against).
- **Ability-aware:** abilities like Levitate, Flash Fire or Thick Fat are applied or flagged as "might have".
- **Pick types yourself:** choose any one or two types, and see Pokémon with that typing.
- **Full type chart:** 18×18 chart with tap-to-explain squares and a column for the current lookup.
- **Best and worst types:** rankings of the toughest and most fragile typings and the best attacking pairs.
- **Abilities:** searchable list of all 314 abilities, with filters for matchups, weather and terrain.
- **Weather and terrain:** what each one does, with related abilities.
- **Beginner glossary:** tap terms like STAB, "grounded" or "super effective" for a short explanation.
- Light and dark themes, works on phones, and keyboard shortcuts: `/` search, `R` random Pokémon, `B` best and worst types.

## Running it

It's a static site with no build step. Open `index.html` in a browser, or serve the folder with any static host.

## Updating the data

`data/pokemon.js` and `data/abilities.js` are generated from [PokéAPI](https://pokeapi.co)'s public CSV tables:

```sh
python tools/build_data.py            # download the latest tables and rebuild
python tools/build_data.py --offline  # rebuild from the cached tables in tools/.cache
```

## Project layout

```
index.html          page structure
css/style.css       all styles (dark and light themes)
js/data.js          type chart, hints, glossary, ability effects, weather and terrain
js/app.js           search, battle plan, chart, abilities, rankings, navigation
data/*.js           generated Pokémon and ability data
assets/types/       type icons (WebP)
assets/fonts/       Bricolage Grotesque (SIL Open Font License)
tools/build_data.py data generator
```

## Credits

- Pokémon and ability data: [PokéAPI](https://pokeapi.co).
- Font: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), SIL Open Font License.

This is an unofficial fan project and isn't affiliated with Nintendo, Game Freak or The Pokémon Company. Pokémon, the type names and the type icons are trademarks of their respective owners.
