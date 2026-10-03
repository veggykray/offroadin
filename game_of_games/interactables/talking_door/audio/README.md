# Voice lines

One folder per door character. The files in `weary_door/` are robot text-to-speech
placeholders (made with espeak-ng). Replace them with real recordings, either by:

* overwriting a file and keeping the same name (nothing else to change), or
* dropping new files here and dragging them into the **Audio** slot of a line in
  `characters/<door>.tres` (Inspector → Dialogue → Greeting / Interact Responses …).

WAV or OGG both work. For the best lip sync, select a WAV, open the **Import** tab,
set **Compress → Mode** to **Disabled** and press **Reimport**.
