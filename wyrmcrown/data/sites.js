/* WYRMCROWN — neutral objective sites (data only).
 * Sites start unaligned, often guarded. Clear the guardians, then hold the
 * site — circle low over it with your dragon, or march troops onto it — to
 * capture it. Owned sites pay out (gold carts that must reach your town),
 * strengthen your dragon or wizard, reveal the land, defend themselves, store
 * spells or open waygates for fast travel. Rivals can take them back the same
 * way, so the map is always in play.
 *   r      footprint (keeps decor clear)        capR  capture radius
 *   income gold per second, stockpiled and carted home (cart: true)
 *   shoots site defence when owned               reveal  war-map vision when owned */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  AS.Data.sites = {
    goldmine: { name: 'Gold Mine', gen: 'site_goldmine', r: 70, capR: 150, income: 1.5, cart: true, reveal: 600, icon: 'mine', desc: 'Digs gold that rolls home by cart. Guard the carts!' },
    village: { name: 'Village', gen: 'site_cottage', r: 150, capR: 210, income: 0.75, cart: true, troopCap: 2, reveal: 700, icon: 'village', desc: 'Taxes by cart, +2 troop capacity, and a herd for your dragon.' },
    tradepost: { name: 'Trade Post', gen: 'site_tradepost', r: 70, capR: 150, income: 1.1, cart: true, reveal: 600, icon: 'trade', desc: 'Caravans of coin bound for your town.' },
    wizardtower: { name: 'Wizard Tower', gen: 'site_wizardtower', r: 30, capR: 130, staff: 0.15, shoots: { kind: 'magic', range: 520, rate: 0.5 }, reveal: 900, icon: 'tower', desc: '+15% bolt damage and faster mana for its owner; casts at enemies.' },
    magicwell: { name: 'Magic Well', gen: 'site_magicwell', r: 44, capR: 130, well: true, reveal: 500, icon: 'well', desc: 'Its owner\'s dragon heals and regains mana when flying close.' },
    grove: { name: 'Enchanted Grove', gen: 'site_grove', r: 44, capR: 130, grove: true, reveal: 500, icon: 'grove', desc: 'Its owner\'s dragon regains energy near the grove.' },
    crystal: { name: 'Mana Crystal', gen: 'site_crystal', r: 40, capR: 130, spell: 'storm', spellT: 100, reveal: 500, icon: 'crystal', desc: 'Grants a Lightning Storm spell to its owner every 100 seconds.' },
    relic: { name: 'Relic Site', gen: 'site_relic', r: 44, capR: 130, spell: 'summon', spellT: 110, reveal: 500, icon: 'relic', desc: 'Grants a Call the Host spell to its owner every 110 seconds.' },
    fort: { name: 'Abandoned Fort', gen: 'site_fort', r: 120, capR: 200, garrison: 4, troopCap: 3, shoots: { kind: 'arrow', range: 380, rate: 1, volley: 2 }, reveal: 900, icon: 'fort', desc: 'A defensive stronghold: archers on the walls and a garrison.' },
    castle: { name: 'Old Castle', gen: 'site_castle', r: 140, capR: 230, income: 1.0, cart: true, garrison: 4, troopCap: 4, crown: 0.1, shoots: { kind: 'arrow', range: 420, rate: 1.2, volley: 3, ballista: true }, reveal: 1100, icon: 'castle', desc: 'The great prize: gold, troops, strong defences and +10% to all income.' },
    bridge: { name: 'Bridge', gen: 'site_bridge', r: 0, capR: 140, toll: 0.15, shoots: { kind: 'arrow', range: 340, rate: 0.7 }, reveal: 600, icon: 'bridge', desc: 'Takes a toll from every rival cart that crosses; its tower shoots at foes.' },
    shrine: { name: 'Shrine', gen: 'site_shrine', r: 50, capR: 130, blessing: true, reveal: 1200, icon: 'shrine', desc: 'Heals its owner\'s dragon nearby and reveals the land around it.' },
    cave: { name: 'Cave', gen: 'site_cave', r: 60, capR: 140, treasure: 220, respawn: 240, icon: 'cave', desc: 'A monster\'s hoard. Slay the guardian and land to claim the treasure.' },
    nest: { name: 'Dragon Eyrie', gen: 'site_nest', r: 50, capR: 130, nest: 0.12, reveal: 700, icon: 'nest', desc: 'An ancient eyrie: +12% dragon health and quicker recovery for its owner.' },
    watchtower: { name: 'Watchtower', gen: 'site_oldwatch', r: 18, capR: 110, reveal: 1700, icon: 'eye', desc: 'Watches a wide stretch of the realm for its owner.' },
    waygate: { name: 'Waygate', gen: 'site_waygate', r: 36, capR: 110, travel: true, reveal: 500, icon: 'gate', desc: 'Ancient portal: from any waygate you own, travel to another you own (E).' },
    ruins: { name: 'Ruins', gen: 'site_ruins', r: 80, capR: 150, treasure: 150, respawn: 260, icon: 'ruins', desc: 'Forgotten treasure guarded by squatters. Clear them and land to claim it.' },
  };
})(window.AS);
