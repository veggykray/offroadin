Drop-in folder for recorded music (optional).

The game ships with a procedural, per-world layered score (src/audio/music.js).
To replace it for a world, put loops here and add a `files` entry to that world's
`music` block in data/worlds.js, for example:

  music: { root: 50, scale: 'dorian', tempo: 92, ...,
           files: { explore: 'audio/music/w1_explore.ogg',
                    combat:  'audio/music/w1_combat.ogg',
                    battle:  'audio/music/w1_battle.ogg',
                    boss:    'audio/music/w1_boss.ogg',
                    victory: 'audio/music/victory.ogg',
                    fail:    'audio/music/fail.ogg' } }

explore/combat/battle/boss are looping stems of equal length. They start together
and crossfade with combat intensity. victory/fail are one-shot stingers. Any key
you leave out keeps the procedural version. Files load only when the game is
served over http(s).
