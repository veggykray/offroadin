"""Build the one-file launcher: batch header + studio.py, with Windows line endings."""
import os
here = os.path.dirname(os.path.abspath(__file__))
head = open(os.path.join(here, "launcher_header.bat"), encoding="utf-8").read()
py = open(os.path.join(here, "studio.py"), encoding="utf-8").read()
text = (head + py).replace("\r\n", "\n").replace("\n", "\r\n")
with open(os.path.join(here, "UniMate Studio.bat"), "w", encoding="utf-8", newline="") as f:
    f.write(text)
print("wrote UniMate Studio.bat", len(text), "chars")
