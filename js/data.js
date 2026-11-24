// Static game data: types, matchups, beginner hints, glossary, ability effects, field effects.
// Pokémon and ability lists come from data/pokemon.js and data/abilities.js (generated).

const TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

// Sampled from the type icons in assets/types so chips and icons match.
const TYPE_COLOR = {
  Normal:'#8A8A8A', Fire:'#E7633F', Water:'#3399E1', Electric:'#E1BD27', Grass:'#459939', Ice:'#45C9C9',
  Fighting:'#E79321', Poison:'#9351CF', Ground:'#B07D44', Flying:'#75ABCF', Psychic:'#E76F8D', Bug:'#9F9F27',
  Rock:'#ABA581', Ghost:'#6F456F', Dragon:'#576FBD', Dark:'#5E5050', Steel:'#69ABC9', Fairy:'#E18DE1'
};

// attacker -> [super effective (2x), not very effective (0.5x), no effect (0x)]
const CHART = {
  Normal:[[],['Rock','Steel'],['Ghost']],
  Fire:[['Grass','Ice','Bug','Steel'],['Fire','Water','Rock','Dragon'],[]],
  Water:[['Fire','Ground','Rock'],['Water','Grass','Dragon'],[]],
  Electric:[['Water','Flying'],['Electric','Grass','Dragon'],['Ground']],
  Grass:[['Water','Ground','Rock'],['Fire','Grass','Poison','Flying','Bug','Dragon','Steel'],[]],
  Ice:[['Grass','Ground','Flying','Dragon'],['Fire','Water','Ice','Steel'],[]],
  Fighting:[['Normal','Ice','Rock','Dark','Steel'],['Poison','Flying','Psychic','Bug','Fairy'],['Ghost']],
  Poison:[['Grass','Fairy'],['Poison','Ground','Rock','Ghost'],['Steel']],
  Ground:[['Fire','Electric','Poison','Rock','Steel'],['Grass','Bug'],['Flying']],
  Flying:[['Grass','Fighting','Bug'],['Electric','Rock','Steel'],[]],
  Psychic:[['Fighting','Poison'],['Psychic','Steel'],['Dark']],
  Bug:[['Grass','Psychic','Dark'],['Fire','Fighting','Poison','Flying','Ghost','Steel','Fairy'],[]],
  Rock:[['Fire','Ice','Flying','Bug'],['Fighting','Ground','Steel'],[]],
  Ghost:[['Psychic','Ghost'],['Dark'],['Normal']],
  Dragon:[['Dragon'],['Steel'],['Fairy']],
  Dark:[['Psychic','Ghost'],['Fighting','Dark','Fairy'],[]],
  Steel:[['Ice','Rock','Fairy'],['Fire','Water','Electric','Steel'],[]],
  Fairy:[['Fighting','Dragon','Dark'],['Fire','Poison','Steel'],[]]
};

// Memory hooks for beginners: "attacker>defender"
const HINTS = {
  'Fire>Grass':'Fire burns plants.','Fire>Ice':'Fire melts ice.','Fire>Bug':'Bugs get burned up by flames.','Fire>Steel':'A forge fire melts metal.',
  'Water>Fire':'Water puts out fire.','Water>Ground':'Water turns ground into mud.','Water>Rock':'Water wears rock down.',
  'Electric>Water':'Water conducts electricity.','Electric>Flying':'Lightning strikes things in the sky.',
  'Grass>Water':'Plants soak up water.','Grass>Ground':'Roots break up the soil.','Grass>Rock':'Roots crack rocks apart.',
  'Ice>Grass':'Frost kills plants.','Ice>Ground':'Frozen ground cracks.','Ice>Flying':'Ice weighs down wings.','Ice>Dragon':'Dragons are like reptiles: they hate the cold.',
  'Fighting>Normal':'A trained fighter beats an ordinary opponent.','Fighting>Ice':'A karate chop breaks ice.','Fighting>Rock':'Martial artists smash rocks.','Fighting>Dark':'Discipline beats dirty tricks.','Fighting>Steel':'Strong punches dent metal.',
  'Poison>Grass':'Poison kills plants, like weed killer.','Poison>Fairy':'Pollution ruins fairy magic.',
  'Ground>Fire':'Dirt smothers fire.','Ground>Electric':'Grounding shorts out electric circuits.','Ground>Poison':'The earth breaks poison down.','Ground>Rock':'Earthquakes shatter rock.','Ground>Steel':'Earthquakes topple steel towers.',
  'Flying>Grass':'Birds eat plants and seeds.','Flying>Fighting':'A fighter can\'t punch what flies above them.','Flying>Bug':'Birds eat bugs.',
  'Psychic>Fighting':'Mind beats muscle.','Psychic>Poison':'A strong mind overcomes poison.',
  'Bug>Grass':'Bugs eat plants.','Bug>Psychic':'Bugs creep people out and break their focus.','Bug>Dark':'Bugs swarm in the dark.',
  'Rock>Fire':'Rocks smother fire.','Rock>Ice':'Rocks smash ice.','Rock>Flying':'A thrown rock knocks birds out of the sky.','Rock>Bug':'Rocks crush bugs.',
  'Ghost>Psychic':'Psychics are afraid of ghosts.','Ghost>Ghost':'Ghosts can haunt each other.',
  'Dragon>Dragon':'Dragons are weak to their own kind.',
  'Dark>Psychic':'Dirty tricks catch psychics off guard.','Dark>Ghost':'Darkness swallows spirits.',
  'Steel>Ice':'Steel picks break ice.','Steel>Rock':'Steel tools cut rock.','Steel>Fairy':'In folklore, fairies fear iron.',
  'Fairy>Fighting':'Magic beats brute force.','Fairy>Dragon':'In fairy tales, magic defeats dragons.','Fairy>Dark':'Light beats darkness.',
  'Normal>Ghost':'Normal attacks pass straight through ghosts.','Fighting>Ghost':'You can\'t punch a ghost.','Ghost>Normal':'Normal Pokémon don\'t notice ghostly attacks.',
  'Electric>Ground':'The ground soaks up electricity.','Poison>Steel':'Metal can\'t be poisoned.','Ground>Flying':'Ground moves can\'t reach Pokémon in the air.',
  'Psychic>Dark':'Psychic powers can\'t read a dark mind.','Dragon>Fairy':'Fairy magic shrugs off dragon power.'
};

const GLOSSARY = {
  'super effective':['Super effective','The move deals 2× damage. If both of a Pokémon\'s types are weak to it, it deals 4×.'],
  'not very effective':['Not very effective','The move deals half damage (½×). If both types resist it, it deals ¼×.'],
  'immune':['Immune / no effect','The move does nothing at all (0×). Some abilities, like Levitate, also give immunities.'],
  'dual type':['Dual type','A Pokémon with two types. Multiply both matchups: 2× and 2× makes 4×, while 2× and ½× cancel out to 1×.'],
  'stab':['STAB','Same-Type Attack Bonus. Moves that match the user\'s own type deal 1.5× damage, so a Fire Pokémon\'s Fire moves hit harder.'],
  'coverage':['Coverage','How many types your moves can hit for super-effective damage. More coverage means fewer Pokémon can wall you.'],
  'hidden ability':['Hidden ability','A rarer ability some Pokémon can have instead of their usual one. Wild ones usually don\'t have it.'],
  'grounded':['Grounded','On the ground: not Flying-type, no Levitate and no Air Balloon. Ground moves and terrain only affect grounded Pokémon.'],
  'priority':['Priority','Moves like Quick Attack that go first no matter how fast the Pokémon is.'],
  'resist':['Resist','Takes reduced damage from a move type: ½× normally, or ¼× when both types resist it.']
};

// Abilities that change what a defending Pokémon takes. mods multiply the type multiplier.
const ABILITY_DEF = {
  'Levitate':{mods:{Ground:0},say:'Ground moves won\'t hit it.'},
  'Earth Eater':{mods:{Ground:0},say:'Ground moves heal it instead.'},
  'Flash Fire':{mods:{Fire:0},say:'Fire moves power it up instead.'},
  'Well-Baked Body':{mods:{Fire:0},say:'Fire moves raise its Defense instead.'},
  'Water Absorb':{mods:{Water:0},say:'Water moves heal it instead.'},
  'Storm Drain':{mods:{Water:0},say:'Water moves boost it instead.'},
  'Dry Skin':{mods:{Water:0,Fire:1.25},say:'Water moves heal it, and Fire moves hurt it a bit more.'},
  'Volt Absorb':{mods:{Electric:0},say:'Electric moves heal it instead.'},
  'Lightning Rod':{mods:{Electric:0},say:'Electric moves boost it instead.'},
  'Motor Drive':{mods:{Electric:0},say:'Electric moves make it faster instead.'},
  'Sap Sipper':{mods:{Grass:0},say:'Grass moves boost its Attack instead.'},
  'Thick Fat':{mods:{Fire:.5,Ice:.5},say:'Fire and Ice moves do half damage.'},
  'Heatproof':{mods:{Fire:.5},say:'Fire moves do half damage.'},
  'Water Bubble':{mods:{Fire:.5},say:'Fire moves do half damage.'},
  'Purifying Salt':{mods:{Ghost:.5},say:'Ghost moves do half damage.'},
  'Fluffy':{mods:{Fire:2},say:'Fire moves do double damage (but contact moves do half).'},
  'Filter':{se:.75,say:'Super-effective hits do 25% less.'},
  'Solid Rock':{se:.75,say:'Super-effective hits do 25% less.'},
  'Prism Armor':{se:.75,say:'Super-effective hits do 25% less.'},
  'Wonder Guard':{wg:true,say:'Only super-effective moves can hurt it.'},
  'Tera Shell':{say:'At full HP, every hit is not very effective.'},
  'Desolate Land':{mods:{Water:0},say:'Its harsh sunlight makes Water moves fail completely.'},
  'Primordial Sea':{mods:{Fire:0},say:'Its heavy rain makes Fire moves fail completely.'},
  'Delta Stream':{ds:true,say:'Its strong winds cancel out the Flying type\'s weaknesses.'}
};

const SVG_WEATHER = {
  sun:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="16" cy="16" r="6" fill="currentColor"/><path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M6.8 25.2l2.1-2.1M23.1 8.9l2.1-2.1"/></svg>',
  rain:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19a6 6 0 1 1 2.2-11.6A7 7 0 0 1 24.6 11 4.5 4.5 0 0 1 23.5 19z" fill="currentColor" fill-opacity=".25"/><path d="M11 23l-1.5 4M17 23l-1.5 4M23 23l-1.5 4"/></svg>',
  sand:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 10h17a3.5 3.5 0 1 0-3.5-3.5M4 16h22a3.5 3.5 0 1 1-3.5 3.5M4 22h12"/><circle cx="22" cy="26" r="1.3" fill="currentColor"/><circle cx="27" cy="12" r="1.3" fill="currentColor"/></svg>',
  snow:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13M12.5 5.5L16 9l3.5-3.5M12.5 26.5L16 23l3.5 3.5"/></svg>'
};

const WEATHER = [
 {n:'Harsh sunlight',svg:'sun',c:'#E7633F',set:['Sunny Day','Drought','Orichalcum Pulse'],rock:'Heat Rock',up:['Fire'],down:['Water'],
  fx:['Fire moves deal 1.5× damage; Water moves deal 0.5× (except Hydro Steam, which is boosted).','Solar Beam and Solar Blade fire without a charge turn.','Thunder and Hurricane drop to 50% accuracy.','Morning Sun, Synthesis and Moonlight heal ⅔ HP; Growth raises Attack and Sp. Atk by 2.','No Pokémon can be frozen. Weather Ball becomes a 100-power Fire move.'],
  ab:['Drought','Orichalcum Pulse','Chlorophyll','Solar Power','Flower Gift','Leaf Guard','Harvest','Protosynthesis','Dry Skin','Forecast']},
 {n:'Rain',svg:'rain',c:'#3399E1',set:['Rain Dance','Drizzle'],rock:'Damp Rock',up:['Water'],down:['Fire'],
  fx:['Water moves deal 1.5× damage; Fire moves deal 0.5×.','Thunder and Hurricane never miss.','Solar Beam and Solar Blade have half power; Electro Shot skips its charge turn.','Morning Sun, Synthesis and Moonlight heal only ¼ HP.','Weather Ball becomes a 100-power Water move.'],
  ab:['Drizzle','Swift Swim','Rain Dish','Hydration','Dry Skin','Forecast']},
 {n:'Sandstorm',svg:'sand',c:'#A5753F',set:['Sandstorm','Sand Stream','Sand Spit'],rock:'Smooth Rock',def:['Rock'],safe:['Rock','Ground','Steel'],
  fx:['Every Pokémon that isn\'t Rock, Ground or Steel loses 1/16 of its max HP each turn.','Rock-type Pokémon get 1.5× Sp. Def.','Shore Up heals ⅔ HP. Solar Beam is halved; Morning Sun, Synthesis and Moonlight heal ¼.','Weather Ball becomes a 100-power Rock move.','Overcoat, Magic Guard, Sand Veil, Sand Rush, Sand Force and Safety Goggles prevent the damage.'],
  ab:['Sand Stream','Sand Spit','Sand Rush','Sand Veil','Sand Force','Overcoat']},
 {n:'Snow',svg:'snow',c:'#45C9C9',set:['Snowscape','Snow Warning'],rock:'Icy Rock',def:['Ice'],
  fx:['Ice-type Pokémon get 1.5× Defense.','Blizzard never misses, and Aurora Veil can be used.','Solar Beam is halved; Morning Sun, Synthesis and Moonlight heal ¼ HP.','Weather Ball becomes a 100-power Ice move.','Before Gen IX this was Hail: it hurt non-Ice Pokémon for 1/16 HP each turn and gave no Defense boost.'],
  ab:['Snow Warning','Slush Rush','Ice Body','Snow Cloak','Ice Face','Forecast']}
];
const EXTREME = [
 {n:'Extremely harsh sunlight',a:'Desolate Land',t:'Works like harsh sunlight, and Water moves fail completely.'},
 {n:'Heavy rain',a:'Primordial Sea',t:'Works like rain, and Fire moves fail completely.'},
 {n:'Strong winds',a:'Delta Stream',t:'The Flying type\'s weaknesses are ignored, so Electric, Ice and Rock moves lose their bonus against it.'}
];
const TERRAIN = [
 {n:'Electric Terrain',icon:'Electric',c:'#E1BD27',set:['Electric Terrain','Electric Surge','Hadron Engine'],up:['Electric'],
  fx:['Electric moves from grounded Pokémon deal 1.3× damage.','Grounded Pokémon can\'t fall asleep (Yawn fails too).','Rising Voltage doubles in power against a grounded target.','Terrain Pulse becomes Electric with doubled power. Electric Seed raises Defense.'],
  ab:['Electric Surge','Hadron Engine','Surge Surfer','Quark Drive','Mimicry']},
 {n:'Grassy Terrain',icon:'Grass',c:'#459939',set:['Grassy Terrain','Grassy Surge','Seed Sower'],up:['Grass'],
  fx:['Grass moves from grounded Pokémon deal 1.3× damage.','Grounded Pokémon recover 1/16 of their max HP each turn.','Earthquake, Bulldoze and Magnitude deal half damage to grounded targets.','Grassy Glide gets +1 priority. Grassy Seed raises Defense.'],
  ab:['Grassy Surge','Seed Sower','Grass Pelt','Mimicry']},
 {n:'Misty Terrain',icon:'Fairy',c:'#E18DE1',set:['Misty Terrain','Misty Surge'],half:['Dragon'],
  fx:['Dragon moves deal half damage to grounded targets.','Grounded Pokémon can\'t get status conditions or become confused.','Misty Explosion gets 1.5× power. Misty Seed raises Sp. Def.'],
  ab:['Misty Surge','Mimicry']},
 {n:'Psychic Terrain',icon:'Psychic',c:'#E76F8D',set:['Psychic Terrain','Psychic Surge'],up:['Psychic'],
  fx:['Psychic moves from grounded Pokémon deal 1.3× damage.','Grounded Pokémon can\'t be hit by the opponent\'s priority moves.','Expanding Force gets 1.5× power and hits all opponents. Psychic Seed raises Sp. Def.'],
  ab:['Psychic Surge','Mimicry']}
];

// Abilities shown under the "Changes type matchups" filter
const MATCHUP_ABILITIES = new Set([...Object.keys(ABILITY_DEF),'Scrappy',"Mind's Eye",'Tinted Lens','Normalize','Pixilate','Aerilate','Refrigerate','Galvanize','Liquid Voice','Delta Stream','Desolate Land','Primordial Sea','Protean','Libero','Color Change','Multitype','RKS System','Wind Rider','Steam Engine','Justified','Rattled','Water Compaction','Thermal Exchange']);
