Drop-in folder for recorded sound effects (optional).

Every effect is synthesized from a recipe in data/audio.js. To use a recording
instead, place it here and add `file: 'audio/sfx/<name>.ogg'` (or .mp3/.wav) to
that effect's entry. The recipe stays as the fallback if the file is missing or
the game runs from file://.
