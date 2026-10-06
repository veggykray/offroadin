/* WYRMCROWN — the "world" record the shared engine expects (terrain settings,
 * light, atmosphere, ambience, music), built per map. Unlike an ALIEN STRIKE
 * world the realm has several regions; region looks (air colour, light tint,
 * ambience and music) are blended in as the player flies between them
 * (see src/audio/realm_audio.js and RealmGame.updateRegion). */
'use strict';
(function (AS) {
  const REGION = {
    human: { atm: { cloud: 0.2, cloudCol: '#1a2208', wind: [16, 6], haze: '#f0e0b8', hazeA: 0.14, sun: '#fff0c0', sunA: 0.12, shade: '#283050', shadeA: 0.09 }, tint: 'rgba(255,200,120,0.035)', ambient: 1, label: 'Aldermere' },
    elf: { atm: { cloud: 0.26, cloudCol: '#061808', wind: [9, 4], haze: '#c8f0d0', hazeA: 0.13, sun: '#f0ffd0', sunA: 0.1, shade: '#0a2a30', shadeA: 0.12 }, tint: 'rgba(80,200,140,0.04)', ambient: 0.96, label: 'the Sylvaran forest' },
    ice: { atm: { cloud: 0.16, cloudCol: '#203050', wind: [24, 10], haze: '#eef6ff', hazeA: 0.22, sun: '#ffffff', sunA: 0.08, shade: '#203060', shadeA: 0.12 }, tint: 'rgba(150,200,255,0.05)', ambient: 1, label: 'Hrimgard' },
    undead: { atm: { cloud: 0.3, cloudCol: '#100818', wind: [8, -4], haze: '#9a8ab0', hazeA: 0.16, sun: '#d8c8ff', sunA: 0.05, shade: '#180a28', shadeA: 0.18 }, tint: 'rgba(80,40,110,0.05)', ambient: 0.91, label: 'the Morgrave blight' },
    neutral: { atm: { cloud: 0.2, cloudCol: '#1a1a08', wind: [14, 5], haze: '#f0e8c8', hazeA: 0.13, sun: '#fff4d0', sunA: 0.1, shade: '#283048', shadeA: 0.09 }, tint: null, ambient: 1, label: 'the heartland' },
  };

  function make(map) {
    return {
      id: 100 + (map.index || 1), key: 'realm:' + map.id + ':neutral', name: map.name, mapId: map.id,
      engine: false, // no craft engine loop: the dragon drives its own wing and wind sounds
      terrain: {
        type: 'realm', levels: 5, scale: 1 / 1500, cliff: 15, seed: (map.seed || 1) * 131 + 7,
        ramp: ['#66783a', '#7a8a46', '#8f9650', '#9c9a64', '#a09a88'], alt: '#a89a5a', altAmt: 0.3,
        face: '#857260', faceDark: '#352a20', lip: '#e8dcb0', speck: ['#4a3a20', '#d8c080'],
        water: { deep: '#1e425c', shallow: '#4a8ca0', foam: '#c8e8e8' },
      },
      light: { ambient: 1, tint: null, shadow: 0.34 },
      atm: Object.assign({}, REGION.neutral.atm),
      ambience: ['wind', 'forest', 'birds', 'village', 'cattle', 'river', 'blizzard', 'cursed', 'rain', 'icecrack', 'creatures'],
      music: AS.Data.factions.human.music,
      decor: [], props: [], propPal: AS.Data.pal.neutral,
      colony: AS.Data.pal.neutral, choir: AS.Data.pal.undead, native: AS.Data.pal.neutral,
      sky: ['#1a2a3a', '#d8c8a0'],
    };
  }

  AS.RealmWorld = { make, REGION };
})(window.AS);
