UniMate Studio
==============

A small Windows app for UniMate (https://github.com/Friedrich-M/UniMate):
choose a rigged character, type what it should do, press Generate, and get an
animated .glb and .fbx.

WHAT YOU NEED
- Windows 10 or 11.
- An NVIDIA graphics card is strongly recommended. Without one it still runs,
  but generating is much slower.
- About 15 GB of free disk space and a good internet connection.

SETUP (once)
1. Unzip this folder anywhere.
2. Double-click "Install UniMate Studio.bat".
   It installs Git and Miniconda if you don't have them, downloads UniMate and
   its trained model, and sets up Python. Expect 20-60 minutes.
   If Windows asks "Do you want to allow this app to make changes", say Yes.
3. When it says "All done", there is a "UniMate Studio" icon on your desktop.

USING IT
1. Choose...  pick your rigged .glb or .fbx.
   The app reads its bones and fills in the right and left hip bones for you
   (it uses them to work out which way the character faces). Check they look
   right; change them if not.
2. Type what the character should do, e.g.
   "walks forward slowly with a tired, hunched posture".
3. Press Generate.
   The first time you use a character, it is prepared first (a minute or two).
   After that, only new prompts are generated.
4. Your animations appear in "UniMate Animations" on your desktop, one folder
   per prompt, with a .glb and an .fbx for each version.

TIPS
- Characters work best if the file also has at least one animation in it
  (an idle or walk from Mixamo is fine).
- UniMate's main model handles skeletons of up to about 60 bones after cleanup.
  If the app says your rig has too many bones, use a version without finger
  or face bones.
- "How closely to follow the prompt": leave it at "model default" to start.
  Higher follows the words more strictly but can look stiffer.

IF SOMETHING GOES WRONG
- The black log area at the bottom of the app shows what happened.
- Setup keeps a log in %LOCALAPPDATA%\UniMateStudio\install-log.txt
- Running the installer again is safe; it fixes or updates what's there.

Everything is installed in %LOCALAPPDATA%\UniMateStudio. To remove it, delete
that folder and the desktop icon.
