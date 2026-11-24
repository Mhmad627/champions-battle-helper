// Pokémon available in Pokémon Champions.
// Source: Serebii's "Available Pokémon" page (serebii.net/pokemonchampions/pokemon.shtml), read 2026-11-24.
// Pokémon not listed here still appear on the site, marked "Not in Pokémon Champions yet".
//
// tools/check_roster.py (run weekly by GitHub Actions) rewrites species, megas, and the notForms
// entries for Pokémon that have regional forms (Alolan, Galarian, Hisuian, Paldean). notes and the
// notForms entries for other Pokémon (like Ash's Greninja) are hand-edited.
//
// species: National Dex numbers. Every non-Mega form of a listed species counts as available
//          (regional forms included), except the forms named in notForms.
// notes:   short availability notes shown under a Pokémon's name, keyed by name.
// notForms: forms of listed species that aren't in the game (names must match data/pokemon.js).
// megas:  Mega Evolutions are only available if named here (names must match data/pokemon.js).
window.CHAMPIONS = {
  species: [
    3,6,9,15,18,24,25,26,36,38,40,45,53,59,65,68,71,80,83,94,115,121,122,127,128,130,132,134,135,136,142,143,149,
    154,157,160,168,181,184,186,196,197,199,205,208,211,212,214,227,229,248,
    254,257,260,279,282,302,303,306,308,310,317,319,323,324,334,350,351,354,358,359,362,373,376,
    389,392,395,398,405,407,409,411,428,442,445,448,450,454,460,461,464,470,471,472,473,475,478,479,
    497,500,503,505,510,512,514,516,518,530,531,534,545,547,553,560,563,569,571,579,584,587,604,609,614,618,623,635,637,
    652,655,658,660,663,666,668,670,671,673,675,676,678,681,683,685,687,689,691,693,695,697,699,700,701,702,706,707,709,711,713,715,
    724,727,730,733,740,745,748,750,752,758,763,765,766,768,778,780,784,
    812,815,818,823,828,841,842,844,849,853,855,858,861,863,865,866,867,869,870,871,876,877,887,899,900,902,903,904,
    908,911,914,923,925,930,931,934,936,937,939,943,952,956,959,964,968,970,972,979,981,983,998,1000,1013,1018,1019
  ],
  notes: {
    'Floette': 'Only Eternal Flower Floette is allowed, and it must be transferred from Legends: Z-A through Pokémon HOME.',
    'Mega Floette': 'Mega Evolves from Eternal Flower Floette, which must be transferred from Legends: Z-A through Pokémon HOME.'
  },
  notForms: ["Galarian Farfetch'd", 'Galarian Mr. Mime', 'Hisuian Qwilfish', "Ash's Greninja"],
  megas: [
    'Mega Venusaur','Mega Charizard X','Mega Charizard Y','Mega Blastoise','Mega Beedrill','Mega Pidgeot',
    'Mega Raichu X','Mega Raichu Y','Mega Clefable','Mega Alakazam','Mega Victreebel','Mega Slowbro','Mega Gengar',
    'Mega Kangaskhan','Mega Starmie','Mega Pinsir','Mega Gyarados','Mega Aerodactyl','Mega Dragonite','Mega Meganium',
    'Mega Feraligatr','Mega Ampharos','Mega Steelix','Mega Scizor','Mega Heracross','Mega Skarmory','Mega Houndoom',
    'Mega Tyranitar','Mega Sceptile','Mega Blaziken','Mega Swampert','Mega Gardevoir','Mega Sableye','Mega Mawile',
    'Mega Aggron','Mega Medicham','Mega Manectric','Mega Sharpedo','Mega Camerupt','Mega Altaria','Mega Banette',
    'Mega Chimecho','Mega Absol','Mega Absol Z','Mega Glalie','Mega Salamence','Mega Metagross','Mega Staraptor',
    'Mega Lopunny','Mega Garchomp','Mega Garchomp Z','Mega Lucario','Mega Lucario Z','Mega Abomasnow','Mega Gallade',
    'Mega Froslass','Mega Emboar','Mega Excadrill','Mega Audino','Mega Scolipede','Mega Scrafty','Mega Eelektross',
    'Mega Chandelure','Mega Golurk','Mega Chesnaught','Mega Delphox','Mega Greninja','Mega Pyroar','Mega Floette',
    'Mega Meowstic','Mega Malamar','Mega Barbaracle','Mega Dragalge','Mega Hawlucha','Mega Crabominable',
    'Mega Golisopod','Mega Drampa','Mega Falinks','Mega Scovillain','Mega Glimmora','Mega Baxcalibur'
  ]
};
