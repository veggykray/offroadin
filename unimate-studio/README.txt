UniMate Studio
==============

A simple window for UniMate (https://github.com/Friedrich-M/UniMate), for the
setup you already have: choose a rigged character, type what it should do,
press Generate, and get an animated .glb and .fbx.

It doesn't install anything. It uses the UniMate folder, the conda environment
and the downloaded model you already set up.

START IT
1. Put "UniMate Studio.bat" anywhere (your Desktop is fine). It is the whole
   app in one file.
2. Double-click it. A black window opens and stays open while you use the app;
   if anything goes wrong, the reason is shown there.
   It looks for your conda environment called "unimate". If yours has a
   different name, open the .bat in Notepad and change ENVNAME near the top.
3. The first time, the app asks you to show it two folders:
   - your UniMate folder (the one with "unimate" and "data_process" inside)
   - the folder you downloaded the trained model to from Hugging Face
   It remembers them. "Folders..." in the app changes them later.

USE IT
1. Choose...  pick your rigged .glb or .fbx. The app reads its bones and fills
   in the right and left hip bones (used to work out which way is forward).
2. Type what the character should do, e.g.
   "walks forward slowly with a tired, hunched posture".
3. Press Generate. The first time you use a character it is prepared first
   (a minute or two); after that only new prompts are generated.
4. Animations appear in "UniMate Animations" on your desktop, one folder per
   prompt, with a .glb and an .fbx for each version.

TIPS
- A character with no animation of its own still works: the app gives
  UniMate a still rest-pose clip to start from.
- UniMate's main model handles skeletons of up to about 60 bones after cleanup.
  If the app says your rig has too many, use a version without finger bones.
- The black log area at the bottom of the app shows exactly what ran.

The app keeps its settings and scratch files in %LOCALAPPDATA%\UniMateStudio.

FOR DEVELOPERS
studio.py is the app; launcher_header.bat is the launcher. Run build.py to
combine them into "UniMate Studio.bat".
