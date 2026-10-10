/* WYRMCROWN — commanders: the people who lead armies without the dragon.
 * Temporary records for the army-command foundation (src/game/armies.js).
 *
 *   king       every Dragon Lord's realm has a royal commander: a real character
 *              with a temper, a look and things to say, and good at something
 *   champion   rare named individuals, one of each, never recruited in numbers
 *
 * A commander's numbers:
 *   leadership   the most troop leadership (Conquest troop types) the army may hold
 *   traits       multipliers used by the auto-resolve (src/game/autoresolve.js) and
 *                by army movement: attack, defence, morale (added to the army's
 *                morale, 0–100 scale), march (speed), siege (attacking a fort or
 *                town), underground (any underground fight), troops ({troopId|base
 *                troop key: attack multiplier}: troop-type advantages)
 *   field        how the commander appears on the battlefield: an existing troop
 *                record (`base`), a model (`gen`, an existing AS.Models key), hp
 *                multiplier and a scale; no new artwork
 *   remarks      lines for battlefield events (shown as text; there are no
 *                recordings for them)
 *
 * The look is borrowed from existing troop models for now (`gen`); a crown or a
 * pennant and the name are drawn over them (src/game/troops.js). */
'use strict';
(function (AS) {
  const list = [
    /* ---------------- kings ---------------- */
    {
      id: 'k_osric', kind: 'king', realm: 'human', name: 'King Osric', title: 'the Ample',
      blurb: 'Aldermere\'s king: round, vain, brave at dinner and, to everyone\'s surprise, on the field. Footmen adore him because he marches with them and complains louder than they do.',
      personality: 'Pompous, greedy, secretly competent with infantry.',
      leadership: 220,
      traits: { attack: 1.05, defence: 1.1, morale: 15, march: 0.9, siege: 1.0, underground: 0.85, troops: { h_soldier: 1.2, soldier: 1.2 } },
      field: { base: 'elite', gen: 'ppl_knight', hp: 3.2, scale: 1.15, crest: '#e8c050' },
      remarks: {
        assigned: ['"At last, a command worthy of my waistline."', '"Bring the good saddle. And the other good saddle."'],
        march: ['"Forward! At a dignified pace."', '"Do we pass any inns on the way? Strategically speaking."'],
        defend: ['"Nobody touches Hollowford. Its pies are a national treasure."', '"We hold here. I have already sat down."'],
        attack: ['"Charge! I shall supervise from slightly behind."'],
        follow: ['"Follow the dragon? Again? Very well, but it is showing off."'],
        enter: ['"Underground? Kings do not do tunnels. Kings do banquet halls."'],
        won: ['"Victory! Someone write that I was magnificent."', '"Ha! They should have surrendered to my reputation."'],
        lost: ['"A tactical retreat. Towards lunch."'],
        retreat: ['"Back! Back! Not because I am afraid. Because I am hungry."'],
        idle: ['"Is it supper yet? It feels like supper."', '"I have decided the weather is too windy for heroics."'],
        down: ['"Tell the chroniclers I fell gloriously. Embellish the falling part."'],
      },
    },
    {
      id: 'k_thalanor', kind: 'king', realm: 'elf', name: 'Prince-Regent Thalanor', title: 'the Unhurried',
      blurb: 'Rules Sylvara while the Archmage rides the dragon. Six hundred years old and in no hurry about anything, least of all battle, which he wins anyway with archers.',
      personality: 'Languid, sarcastic, deadly with bowmen.',
      leadership: 200,
      traits: { attack: 1.0, defence: 1.05, morale: 10, march: 0.85, siege: 0.9, underground: 0.8, troops: { e_archer: 1.25, archer: 1.2 } },
      field: { base: 'elite', gen: 'trp_elf_warden', hp: 3, scale: 1.15, crest: '#3a9a5a' },
      remarks: {
        assigned: ['"An army. How quaint. Very well."'],
        march: ['"We shall arrive when we arrive. Elves are never late; the world is early."'],
        defend: ['"We stay. The trees here have better manners than most visitors."'],
        attack: ['"Loose, and try to look bored. It unsettles them."'],
        follow: ['"Following a dragon is undignified. Following it slowly is acceptable."'],
        enter: ['"Under the ground? I have spent centuries avoiding exactly this."'],
        won: ['"Predictable. Wake me if anything interesting happens."'],
        lost: ['"We are withdrawing. Elegantly."'],
        retreat: ['"Fall back. Do not run — running is for humans."'],
        idle: ['"I have counted every leaf on that oak. Twice."'],
        down: ['"How… inconvenient."'],
      },
    },
    {
      id: 'k_bjarngrim', kind: 'king', realm: 'ice', name: 'Jarl-King Bjarngrim', title: 'Half-Beard',
      blurb: 'The king of Hrimgard lost half his beard to a frost troll and the other half of his patience at the same moment. Loud, cheerful and alarmingly fond of charging uphill.',
      personality: 'Boisterous, reckless, beloved by berserkers.',
      leadership: 210,
      traits: { attack: 1.15, defence: 0.95, morale: 20, march: 1.0, siege: 0.9, underground: 1.0, troops: { i_berserker: 1.25 } },
      field: { base: 'elite', gen: 'trp_ice_berserker', hp: 3.4, scale: 1.2, crest: '#5a8ad0' },
      remarks: {
        assigned: ['"HA! An army! I will try not to lose it before breakfast."'],
        march: ['"March! Sing! Sing louder, they cannot hear us in the next valley!"'],
        defend: ['"We hold. Let them come uphill. I love it when they come uphill."'],
        attack: ['"CHARGE! Wait — which way is the enemy? CHARGE THAT WAY!"'],
        follow: ['"Follow the big lizard! Last one there carries the ale!"'],
        enter: ['"A tunnel! Mind your heads. Mind MY head."'],
        won: ['"Another one for the songs! Someone write a song! A long one!"'],
        lost: ['"We are not losing. We are advancing in the other direction."'],
        retreat: ['"Back to the hall! There is ale there, and walls!"'],
        idle: ['"My beard itches. The half that is left."'],
        down: ['"Tell them… I was taller."'],
      },
    },
    {
      id: 'k_vescar', kind: 'king', realm: 'undead', name: 'The Hollow King Vescar', title: 'Twice-Buried',
      blurb: 'Morgrave\'s king died in the fourth century and has not let it slow him down. His jaw falls off when he shouts orders, so his orders are short.',
      personality: 'Gloomy, deadpan, fearless, prone to losing bits.',
      leadership: 230,
      traits: { attack: 1.0, defence: 1.0, morale: 25, march: 0.95, siege: 1.1, underground: 1.15, troops: { u_skeleton: 1.15, skeleton: 1.15 } },
      field: { base: 'elite', gen: 'trp_undead_skeleton', hp: 3, scale: 1.25, crest: '#93ff6a' },
      remarks: {
        assigned: ['"Another army. Another eternity. Fine."'],
        march: ['"Onward. Slowly. Something has fallen off."'],
        defend: ['"We stand here. We are very good at standing still."'],
        attack: ['"Kill them. Then they can join us. Everybody wins."'],
        follow: ['"Follow the dragon. It is warm. I remember warm."'],
        enter: ['"Underground. Finally, somewhere that feels like home."'],
        won: ['"Victory. Bring me the jaw. No — MY jaw."'],
        lost: ['"Defeat is temporary. So, I found, is death."'],
        retreat: ['"Withdraw. Pick up the pieces. Literally."'],
        idle: ['"I have been dead for six hundred years and this is still boring."'],
        down: ['"Again? Very well."'],
      },
    },
    /* ---------------- champions (unique) ---------------- */
    {
      id: 'c_brannoc', kind: 'champion', realm: 'neutral', name: 'Brannoc Deepdelver', title: 'the Mole of Aldermere',
      blurb: 'A miner turned captain who has fought in every tunnel under the hills. Underground he is worth a whole company; above ground he squints at the sun like it owes him money.',
      personality: 'Grumpy, practical, at home in the dark.',
      leadership: 150,
      traits: { attack: 1.0, defence: 1.05, morale: 5, march: 1.0, siege: 1.1, underground: 1.4, troops: {} },
      field: { base: 'elite', gen: 'ppl_soldier', hp: 2.6, scale: 1.1, crest: '#c88a3a' },
      remarks: {
        assigned: ['"Right. Lamps, ropes, and nobody whistles in the tunnels."'],
        march: ['"Up top again. Too much sky."'],
        enter: ['"Down we go. Mind the third step, it\'s not a step."', '"Lovely. Smell that? That\'s rock, that is."'],
        won: ['"Told you. Fight in the dark, fight like you mean it."'],
        lost: ['"Out! Everybody out! Count heads on the way!"'],
        retreat: ['"Back to daylight. Hate to say it."'],
        idle: ['"Could be digging. Just saying."'],
        down: ['"Somebody… fetch my lamp…"'],
      },
    },
    {
      id: 'c_wenna', kind: 'champion', realm: 'neutral', name: 'Dame Wenna Hartsbane', title: 'the Unbroken',
      blurb: 'A knight who once held a bridge alone for a day and a night. Troops under her do not run.',
      personality: 'Stern, kind, impossible to impress.',
      leadership: 170,
      traits: { attack: 1.0, defence: 1.15, morale: 30, march: 1.0, siege: 1.0, underground: 1.0, troops: { h_knight: 1.15, elite: 1.1 } },
      field: { base: 'elite', gen: 'ppl_knight', hp: 3.2, scale: 1.1, crest: '#d0d8e8' },
      remarks: {
        assigned: ['"Shields up. Chins up. We begin."'],
        defend: ['"Here we stand. Nobody passes."'],
        won: ['"Well held. Tend the wounded first."'],
        lost: ['"Fall back in order. In ORDER."'],
        down: ['"Hold… the line…"'],
      },
    },
    {
      id: 'c_tamsin', kind: 'champion', realm: 'neutral', name: 'Old Tamsin', title: 'Quickboots',
      blurb: 'A road-wise scout who knows every shortcut. Armies under her march as if the roads were downhill both ways.',
      personality: 'Chatty, impatient, always already there.',
      leadership: 120,
      traits: { attack: 0.95, defence: 0.95, morale: 5, march: 1.35, siege: 0.8, underground: 1.0, troops: { archer: 1.1 } },
      field: { base: 'elite', gen: 'ppl_archer', hp: 2.2, scale: 1.05, crest: '#7ac04a' },
      remarks: {
        assigned: ['"Boots laced? Good. Keep up."'],
        march: ['"Shortcut through here. Trust me. Mostly."'],
        won: ['"Quick and done. Next!"'],
        lost: ['"Run! I know a quicker way out."'],
        down: ['"Ow. Ow. Ow."'],
      },
    },
    {
      id: 'c_gorm', kind: 'champion', realm: 'neutral', name: 'Gorm the Sapper', title: 'Wallbreaker',
      blurb: 'An engineer who believes every wall is a suggestion. Deadly at a siege, unremarkable in the open.',
      personality: 'Cheerful pyromaniac.',
      leadership: 140,
      traits: { attack: 0.95, defence: 1.0, morale: 0, march: 0.9, siege: 1.5, underground: 1.1, troops: { h_siege: 1.3, siege: 1.3 } },
      field: { base: 'elite', gen: 'ppl_soldier', hp: 2.4, scale: 1.05, crest: '#e85a3a' },
      remarks: {
        assigned: ['"Lovely walls they\'ve got. Shame about them."'],
        attack: ['"Light the fuses! Figuratively! Mostly!"'],
        won: ['"See? Walls are just slow rubble."'],
        down: ['"Too much powder. Noted."'],
      },
    },
  ];
  const byId = {};
  for (const c of list) byId[c.id] = c;
  AS.Data.commanders = byId;
  AS.Data.commanderList = list;
  // the royal commander of each Dragon Lord's realm
  AS.Data.kingOf = { human: 'k_osric', elf: 'k_thalanor', ice: 'k_bjarngrim', undead: 'k_vescar' };
})(window.AS);
