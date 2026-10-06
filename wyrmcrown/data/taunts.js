/* WYRMCROWN — taunts. Wizards are verbally inventive and petty; dragons are
 * primal, arrogant and physically insulting, like ancient monsters who have
 * learned their insults from soldiers. Each realm has its own vocabulary:
 * humans swear like a pub, elves condescend in the language of nature, the ice
 * folk sneer at warmth and weakness, the undead talk body horror.
 *
 *   lines[role][speaker][target]  hand-written lines for every pairing
 *   gen[role][speaker]            templates + vocabulary for generated lines,
 *                                 so the same insult rarely comes round twice
 * Template slots: {adj} {noun} {part} {obj} {thing} pick from the speaker's
 * vocabulary; {foe} picks a name for the target's kind (FOE below). */
'use strict';
(function (AS) {
  const lines = {
    wizard: {
      human: {
        elf: ['Go polish a leaf, you perfumed twig-fondler.', "I've seen sturdier warriors carved into chair legs.", 'Back to your treehouse, you luminous ponce.', 'May your arrows bend and your wine turn to piss.', 'You sanctimonious woodland tart.', "I'll turn your sacred grove into affordable housing."],
        undead: ["You smell like a crypt's arsehole.", 'Stay dead this time, you mouldy bastard.', "I've met fresher corpses in a butcher's bin.", 'Back in the ground, bone-bag.', 'Your entire army looks dug up because it was.', 'Even worms rejected you.'],
        ice: ['Come down here, you frozen bell-end.', "I'll thaw you with your own burning trousers.", 'You miserable snow-shagging hermit.', "Your kingdom's just rocks with bad weather.", 'Go lick a glacier.', "I've had warmer welcomes from a grave."],
      },
      elf: {
        human: ['You brick-stacking ape.', 'Your castle smells of gravy and fear.', 'You build walls because trees refuse to speak to you.', 'May your bloodline end in a tax dispute.', 'Go shout at a turnip, iron-head.', 'I can hear your armour thinking.'],
        undead: ['The forest already composted you once.', 'Rot elsewhere, grave-louse.', 'Your aura smells like wet coffin.', 'You are an insult to mushrooms.', 'Even decay has standards.', "I'll plant flowers in your ribcage."],
        ice: ['You pale frost-prick.', 'Did winter itself abandon you?', 'Your soul has the warmth of a cellar wall.', 'Go court an icicle.', "Even moss thinks you're dull.", "I'll turn your glacier into a pond."],
      },
      undead: {
        human: ['Warm little meat parcel.', 'Your bones will look excellent in formation.', 'Keep shouting. I like knowing where the lungs are.', 'I remember being alive. Overrated.', 'Your king will make a useful coat rack.', 'Come closer, pulse-boy.'],
        elf: ['All that beauty, and still eventually compost.', "I've buried prettier things than you.", 'Your forest will make splendid coffins.', 'Sing to the trees while I salt the roots.', 'Eternal life suits me better.', 'You smell offensively alive.'],
        ice: ["Cold? Adorable. I haven't had circulation in centuries.", 'Freeze me harder, snow-priest.', 'Your dead are disappointingly well preserved.', 'You call that a wasteland?', "I've slept in colder graves.", 'Come closer. I need somewhere to store a finger.'],
      },
      ice: {
        human: ['You sweat like livestock.', 'Your kingdom smells warm.', "I'll freeze your moustache to your horse.", 'Your little fires offend me.', 'Go boil in your own soup.', 'You soft southern pudding.'],
        elf: ['Your trees scream beautifully when they freeze.', "I'll snap your forest like glass.", "Flowers are just plants that haven't met winter.", 'You smell of sap and self-importance.', 'Your woodland magic needs a coat.', "I'll make icicles from your eyebrows."],
        undead: ['At least frozen corpses know when to lie down.', "You're decomposition with opinions.", "I'll preserve you against everyone's wishes.", 'Your bones chatter too much.', 'Rot slower.', 'Even death should have standards.'],
      },
    },
    dragon: {
      human: {
        elf: ['Pretty wings. Shame about the rider.', "I'll roast your forest and piss on the ashes.", 'You smell like flowers and cowardice.', 'Come closer, leaf-lizard.', 'I eat deer tougher than you.', 'Your scales look embroidered.'],
        undead: ['You stink dead from up here.', "I'll scatter your ribs across three kingdoms.", "You're not immortal. You're badly buried.", 'Rot louder.', "I've coughed up healthier things.", 'Go haunt a ditch.'],
        ice: ["I'll melt that smug face off.", 'Snowworm.', 'Your breath tastes like a cellar.', 'Come thaw properly.', "You're a frozen sausage with wings.", "I'll warm you from the inside."],
      },
      elf: {
        human: ['Clumsy ox with wings.', 'You fly like a thrown wardrobe.', 'Your rider reeks of onions.', 'Big scales, little brain.', 'Go land on a barn.', "I've seen cows turn more gracefully."],
        undead: ['You smell like old rain in a tomb.', 'The worms want you back.', 'Your bones whistle when you turn.', 'You are ruining the sky.', 'Fall apart somewhere quieter.', 'Even vultures avoid you.'],
        ice: ['Frozen lump.', 'Your wings sound constipated.', 'Have you considered sunlight?', 'You fly like a collapsing roof.', 'Cold is not a personality.', "I'll grow moss on your corpse."],
      },
      undead: {
        human: ['Warm meat with ambitions.', 'I can smell your heart.', 'Your rider screams nicely.', 'Burn me. I enjoy nostalgia.', "You'll rot beautifully.", "I've eaten kings older than your bloodline."],
        elf: ['Pretty thing. Temporary thing.', "I'll decorate my nest with your antlers.", 'You smell like spring. Disgusting.', 'Your forest will die eventually. I can wait.', "You're one funeral away from improvement.", 'Come here, salad-wing.'],
        ice: ['You preserve meat. I improve it.', 'Cold corpse pretending to be alive.', 'Your breath tickles.', "I've been colder underground.", "You're frostbite with wings.", 'Break something useful.'],
      },
      ice: {
        human: ['Hot little sausage.', 'Your fire is embarrassingly loud.', "I'll freeze your tongue to your teeth.", 'Warm-blooded nuisance.', 'You smell cooked already.', 'Keep flapping, furnace.'],
        elf: ['Petal-wing.', "I'll frost your feathers.", 'Your forest is kindling waiting for weather.', "You're decorative.", "I've frozen prettier things.", 'Go sing at a squirrel.'],
        undead: ["You're already cold. Stop showing off.", 'Rotten scarecrow.', 'I could shatter you by sneezing.', 'Your bones sound cheap.', "You're what happens when burial goes wrong.", 'Stay down next time.'],
      },
    },
  };

  // what each realm calls the others
  const FOE = {
    wizard: {
      human: { elf: ['twig-fondler', 'leaf-licker', 'tree-botherer'], undead: ['bone-bag', 'corpse', 'grave-dodger'], ice: ['snow-goblin', 'icicle', 'frost-hermit'] },
      elf: { human: ['ape', 'mud-dweller', 'iron-head'], undead: ['grave-louse', 'carrion', 'compost'], ice: ['frost-prick', 'snow-wraith', 'ice-lump'] },
      undead: { human: ['meat parcel', 'pulse-boy', 'warm thing'], elf: ['future compost', 'pretty corpse', 'sap-blood'], ice: ['snow-priest', 'chilled meat', 'frost-mummy'] },
      ice: { human: ['southern pudding', 'sweat-sack', 'soup-drinker'], elf: ['sap-sucker', 'flower-sniffer', 'leaf-wearer'], undead: ['rot-bag', 'bone-rattler', 'grave-filth'] },
    },
    dragon: {
      human: { elf: ['leaf-lizard', 'twig'], undead: ['bone-bag', 'ditch-ghost'], ice: ['snowworm', 'frozen sausage'] },
      elf: { human: ['ox', 'wardrobe'], undead: ['tomb-rat', 'rot-wing'], ice: ['frozen lump', 'icicle'] },
      undead: { human: ['warm meat', 'heartbeat'], elf: ['salad-wing', 'pretty thing'], ice: ['ice-corpse', 'frostbite'] },
      ice: { human: ['sausage', 'furnace'], elf: ['petal-wing', 'kindling'], undead: ['scarecrow', 'bone-heap'] },
    },
  };

  const gen = {
    wizard: {
      // earthy, pub insults
      human: {
        adj: ['soggy', 'mangy', 'pickled', 'greasy', 'half-witted', 'lumpen', 'turnip-brained', 'beer-soaked', 'mouldy', 'gormless', 'bandy-legged', 'flea-bitten'],
        noun: ['pillock', 'plonker', 'numpty', 'git', 'dung-merchant', 'pudding', 'sack of turnips', 'walking hangover', 'bog-troll', 'muppet'],
        thing: ['a goat', 'a drunk badger', 'my nan', 'a wet sock', 'a turnip'],
        t: ['Oi! You {adj} {noun}!', 'Clear off, you {adj} {noun}!', 'Come here and say that, you {adj} {foe}!', "I've met {thing} with better manners than you.", 'Your mother was a {adj} {noun}!', "You couldn't hex your way out of a sack, {foe}.", 'Get back in the {obj}, {foe}!', "I've had {thing} cast better spells than that."],
        obj: ['bin', 'ditch', 'privy', 'pigsty', 'cellar'],
      },
      // condescending, in the language of nature
      elf: {
        adj: ['graceless', 'mud-footed', 'short-lived', 'unwashed', 'charmless', 'dreary', 'lumbering', 'unseasoned', 'fungal'],
        noun: ['stump', 'weed', 'toadstool', 'mayfly', 'bramble-wit', 'acorn', 'fungus', 'pond-scum', 'dandelion'],
        thing: ['a dead hedgehog', 'wet bark', 'a slug', 'last autumn'],
        t: ['How quaint. A {adj} {noun}.', 'Even the nettles pity you, {foe}.', 'Run along, little {noun}.', 'I have outlived {adj} things like you by centuries.', 'Your magic smells of {thing}.', 'Bless your {adj} little heart, {foe}.', 'The trees are laughing at you, {foe}.', 'You have all the elegance of {thing}.'],
        obj: ['bog', 'compost heap', 'stump'],
      },
      // cold, sneering at warmth and weakness
      ice: {
        adj: ['soft', 'sweaty', 'feeble', 'tepid', 'limp', 'thin-blooded', 'squishy', 'damp', 'wilting'],
        noun: ['puddle', 'candle', 'soup', 'slush-brain', 'thaw-wit', 'dripping', 'warm thing', 'wet blanket'],
        thing: ['a puddle', 'warm milk', 'a snowman in spring', 'bathwater'],
        t: ['You {adj} {noun}. A breeze would finish you.', 'Shiver for me, {foe}.', 'I have frozen braver things than you before breakfast.', 'You have the spine of {thing}.', 'Go and sit by your fire, {adj} {foe}.', 'Winter is coming for you, {noun}.', "You'd melt in a stiff look, {foe}.", 'How does it feel to be so {adj}, {foe}?'],
        obj: ['drift', 'crevasse', 'snowbank'],
      },
      // death and body horror
      undead: {
        adj: ['warm', 'squishy', 'pulsing', 'fleshy', 'breathing', 'juicy', 'pink', 'leaky'],
        noun: ['meat-sack', 'blood-bag', 'bag of giblets', 'heartbeat', 'future skeleton', 'pulse'],
        part: ['skull', 'spine', 'ribs', 'teeth', 'knuckles', 'eyeballs', 'kneecaps'],
        obj: ['doorstop', 'wind chime', 'soup bowl', 'coat hook', 'flute', 'candlestick', 'paperweight'],
        thing: ['a mortuary slab', 'a damp crypt'],
        t: ['Your {part} will make a fine {obj}.', 'Hello, {adj} {noun}.', 'I can hear your {part} rattling already.', "Keep breathing, {foe}. It won't last.", 'I shall wear your {part} to dinner.', 'Such a {adj} {noun}. I could just pickle you.', 'One day soon you will be my {obj}, {foe}.', 'Your {part} are wasted on the living.'],
      },
    },
    dragon: {
      human: {
        adj: ['small', 'crunchy', 'feeble', 'tiny', 'flimsy'], noun: ['snack', 'morsel', 'lizard', 'worm'],
        part: ['wings', 'tail', 'rider', 'bones', 'snout', 'scales'],
        t: ['I will ROAST you, {foe}!', 'Burn, {adj} {foe}!', 'Small {noun}. Crunchy {noun}.', 'I have eaten bigger things for breakfast.', 'Your {part} will taste of smoke.', 'Fly faster, {foe}. I like it warm.', 'Ash. You will be ash.'],
      },
      elf: {
        adj: ['slow', 'lumpen', 'clumsy', 'heavy', 'ugly'], noun: ['lump', 'brick', 'sack', 'cow'],
        part: ['wings', 'tail', 'belly', 'rider', 'snout'],
        t: ['Too slow, {foe}!', 'Catch me, {adj} {noun}.', 'You flap like a falling {noun}.', 'I will pluck your {part} like petals.', 'Turn, {foe}. Oh. You cannot.', 'Ugly. So ugly. Stop looking at me.'],
      },
      ice: {
        adj: ['soft', 'warm', 'weak', 'brittle', 'small'], noun: ['meat', 'morsel', 'drip', 'puddle'],
        part: ['wings', 'tail', 'bones', 'snout', 'teeth', 'heart'],
        t: ['I will crack your {part} like ice.', 'Freeze, {foe}.', 'Cold. Hungry. Coming for you.', 'Your {part} will shatter, {adj} {noun}.', 'I have frozen whole armies, {foe}.', 'Stop wriggling, {adj} {noun}.'],
      },
      undead: {
        adj: ['warm', 'fresh', 'juicy', 'soft', 'living'], noun: ['meat', 'carcass', 'pulse', 'morsel'],
        part: ['wings', 'bones', 'heart', 'ribs', 'rider', 'eyes'],
        t: ['Your {part} will join my nest.', 'Die. Then serve.', 'I smell your blood, {foe}.', 'Come closer, {adj} {noun}.', 'I will chew your {part} for a century.', 'Rot with me, {foe}.'],
      },
    },
  };

  AS.Data.taunts = { lines, gen, FOE };
})(window.AS);
