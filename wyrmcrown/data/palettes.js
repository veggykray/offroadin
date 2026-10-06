/* WYRMCROWN — faction and region palettes (data only).
 * Shared by the art models, the terrain and the UI so every faction reads the
 * same everywhere. Palette keys follow the engine convention (see
 * alien-strike/tools/ART_GUIDE.md): a = dark base, b = light base, t = trim /
 * roof, g = glow, d = darkest. Fantasy extras: k = banner, k2 = banner accent,
 * w = wood / timber, s = secondary stone or ice, skin = default skin tone. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  AS.Data.pal = {
    // Kingdom of Aldermere — warm stone, timber framing, terracotta roofs, crimson and gold
    human: { a: '#8a7f74', b: '#d2c7b4', t: '#b0482c', g: '#ffcf6a', d: '#3e3028', k: '#b8262a', k2: '#e8b84a', w: '#5a3a24', s: '#e6dac0', skin: '#e8c4a0' },
    // Sylvaran Realm — ivory stone, copper-teal roofs, living wood, emerald and pale gold
    elf: { a: '#97a690', b: '#efe9d6', t: '#2f8a6a', g: '#7affd8', d: '#2e3d30', k: '#23794a', k2: '#e3eaa8', w: '#6a5236', s: '#cfe0c0', skin: '#f2dcc4' },
    // Hrimgard — blue-grey stone, ice, snow-laden roofs, frost blue and white
    ice: { a: '#71849a', b: '#dbe6f2', t: '#eef5fb', g: '#8ad8ff', d: '#253650', k: '#3567b4', k2: '#e2f1ff', w: '#5a4a3e', s: '#a9dcf3', skin: '#efd8c8' },
    // Dominion of Morgrave — black stone, bone, sickly green glow, deep purple
    undead: { a: '#3b3741', b: '#6d6773', t: '#2b2532', g: '#93ff6a', d: '#141219', k: '#5c2a6c', k2: '#b0ff8a', w: '#3a3028', s: '#d8cfb6', skin: '#b8c4a8' },
    // unaligned villages, ruins and wilds — weathered stone, thatch, oak
    neutral: { a: '#7c6c5a', b: '#bcac8c', t: '#c79e52', g: '#ffcf6a', d: '#3a2b1f', k: '#8a8070', k2: '#d8ccb0', w: '#5e4430', s: '#a89a80', skin: '#e2bc98' },
  };
  // ground colours of each region (used by previews, the terrain and FX dust)
  AS.Data.ground = {
    human: '#6f8a3e', elf: '#4b6c34', ice: '#dfe8f0', undead: '#4b4640', neutral: '#7a8a46',
  };
})(window.AS = window.AS || {});
