"""UniMate Studio: a small desktop window around UniMate (text-to-motion for any rig).

Pick a rigged character, type what it should do, press Generate. Behind the
scenes this runs UniMate's own pipeline:

  1. preprocess_char  - read the rig once and build its skeleton description
                        (cached per character, so later prompts skip it)
  2. sample           - generate motion from the prompt with the trained model
  3. animate_motion   - put that motion back on your character, export GLB + FBX

It uses the UniMate you already installed: start it with that environment's
Python ("Start UniMate Studio.bat" does this) and point it at your UniMate
folder and model folder the first time. Its own settings and scratch files live
in %LOCALAPPDATA%\\UniMateStudio. Finished animations go to a folder on your desktop.
"""
import datetime
import glob
import hashlib
import json
import os
import queue
import random
import re
import shutil
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

APP = "UniMate Studio"
BASE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "UniMateStudio")
WORK = os.path.join(BASE, "work")
SETTINGS = os.path.join(BASE, "settings.json")
PATHS = os.path.join(BASE, "paths.json")
ENGINE = ""        # your UniMate folder (the one containing unimate/ and data_process/)
CHECKPOINTS = ""   # the folder the trained model was downloaded to
PY = sys.executable.replace("pythonw.exe", "python.exe")
NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def desktop_dir():
    if os.name == "nt":
        try:
            import ctypes.wintypes
            buf = ctypes.create_unicode_buffer(260)
            ctypes.windll.shell32.SHGetFolderPathW(None, 0x0010, None, 0, buf)  # CSIDL_DESKTOPDIRECTORY
            if buf.value:
                return buf.value
        except Exception:
            pass
    return os.path.join(os.path.expanduser("~"), "Desktop")


DEFAULT_OUT = os.path.join(desktop_dir(), "UniMate Animations")


class StepFailed(Exception):
    pass


# --------------------------------------------------------------------------- helpers

def load_settings():
    try:
        with open(SETTINGS, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_settings(data):
    try:
        os.makedirs(BASE, exist_ok=True)
        with open(SETTINGS, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def is_engine(d):
    return bool(d) and os.path.isfile(os.path.join(d, "unimate", "inference", "sample.py")) \
        and os.path.isdir(os.path.join(d, "data_process"))


def guess_engine():
    home = os.path.expanduser("~")
    roots = [home, desktop_dir(), os.path.join(home, "Desktop"), os.path.join(home, "OneDrive", "Desktop"),
             os.path.join(home, "Documents"), os.path.join(home, "OneDrive", "Documents"),
             os.path.join(home, "Downloads"), "C:\\", "D:\\"]
    for r in roots:
        for name in ("UniMate", "unimate", "UniMate-main", "unimate-main"):
            d = os.path.join(r, name)
            if is_engine(d):
                return d
            if is_engine(os.path.join(d, name)):
                return os.path.join(d, name)
    return ""


SKIP_DIRS = {".git", "dataset", "node_modules", "__pycache__", "samples", "motions", "animations", "debug", "logs"}


def find_models(root=None, depth=7):
    """Every trained run under a folder: a dir with config.json + checkpoints/*.pt."""
    root = root or CHECKPOINTS
    models = []
    if not root or not os.path.isdir(root):
        return models
    base_depth = root.rstrip("\\/").count(os.sep)
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".")]
        if d.count(os.sep) - base_depth >= depth:
            dirs[:] = []
        if "config.json" in files and glob.glob(os.path.join(d, "checkpoints", "*.pt")):
            models.append(d)
    # the full-data graph model first: it's the one the paper leads with
    models.sort(key=lambda d: (0 if "uniml3d" in d and "graph" in d else 1 if "uniml3d" in d else 2, d))
    return models


def latest_checkpoint(exp_dir):
    pts = glob.glob(os.path.join(exp_dir, "checkpoints", "*.pt"))
    def step(p):
        m = re.search(r"(\d+)", os.path.basename(p))
        return int(m.group(1)) if m else -1
    return max(pts, key=step) if pts else None


def safe_name(path):
    """UniMate splits names on '-', so the character name must be plain letters/digits/_."""
    stem = os.path.splitext(os.path.basename(path))[0]
    s = re.sub(r"_+", "_", re.sub(r"[^A-Za-z0-9_]", "_", stem)).strip("_") or "character"
    if not s[0].isalpha():
        s = "c_" + s
    return s[:40]


def file_hash(path, extra=""):
    h = hashlib.sha1(extra.encode())
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:8]


def friendly(text, n=48):
    t = re.sub(r'[\\/:*?"<>|\r\n\t]+', " ", text).strip()
    t = re.sub(r"\s+", " ", t)
    return (t[:n].rstrip() + "…") if len(t) > n else t


LIST_BONES = r"""
import sys, json, bpy
path = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
if path.lower().endswith(".fbx"):
    bpy.ops.import_scene.fbx(filepath=path)
else:
    bpy.ops.import_scene.gltf(filepath=path)
names = []
for ob in bpy.data.objects:
    if ob.type == "ARMATURE":
        names += [b.name for b in ob.data.bones]
actions = len(bpy.data.actions)
print("@@BONES@@" + json.dumps({"bones": names, "actions": actions}))
"""


def guess_hips(bones):
    """Pick the right/left hip (upper-leg) bones, used to work out which way the character faces."""
    def side(n):
        l = n.lower()
        if re.search(r"(^|[^a-z])(right|r)([^a-z]|$)", l) or "right" in l or l.endswith((".r", "_r")) or l.startswith(("r_", "r.")):
            return "R"
        if re.search(r"(^|[^a-z])(left|l)([^a-z]|$)", l) or "left" in l or l.endswith((".l", "_l")) or l.startswith(("l_", "l.")):
            return "L"
        return None
    for key in ("upleg", "thigh", "upperleg", "hip", "leg"):
        r = [b for b in bones if key in b.lower() and side(b) == "R"]
        l = [b for b in bones if key in b.lower() and side(b) == "L"]
        if r and l:
            return min(r, key=len), min(l, key=len)
    return "", ""


# --------------------------------------------------------------------------- the window

class Studio(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP)
        self.geometry("820x720")
        self.minsize(640, 560)
        self.q = queue.Queue()
        self.busy = False
        self.proc = None
        self.cancelled = False
        self.gpu = None
        self.settings = load_settings()
        self._load_paths()
        self.models = find_models()
        self._build()
        self.after(100, self._drain)
        threading.Thread(target=self._check_gpu, daemon=True).start()
        self.after(400, self.ensure_paths)

    # ---- where UniMate and the model live
    def _load_paths(self):
        global ENGINE, CHECKPOINTS
        try:
            with open(PATHS, encoding="utf-8") as f:
                p = json.load(f)
        except Exception:
            p = {}
        ENGINE = p.get("engine", "") if is_engine(p.get("engine", "")) else guess_engine()
        CHECKPOINTS = p.get("checkpoints", "") or ENGINE
        if not find_models(CHECKPOINTS) and ENGINE and find_models(ENGINE):
            CHECKPOINTS = ENGINE

    def _save_paths(self):
        os.makedirs(BASE, exist_ok=True)
        with open(PATHS, "w", encoding="utf-8") as f:
            json.dump({"engine": ENGINE, "checkpoints": CHECKPOINTS}, f, indent=2)

    def ensure_paths(self, force=False):
        global ENGINE, CHECKPOINTS
        if force or not is_engine(ENGINE):
            if not force:
                messagebox.showinfo(APP, "Show me your UniMate folder: the one you downloaded from GitHub, "
                                         "with folders called 'unimate' and 'data_process' inside it.")
            while True:
                d = filedialog.askdirectory(title="Your UniMate folder", initialdir=ENGINE or os.path.expanduser("~"))
                if not d:
                    break
                d = os.path.normpath(d)
                if is_engine(d):
                    ENGINE = d
                    break
                if is_engine(os.path.join(d, "UniMate")):
                    ENGINE = os.path.join(d, "UniMate")
                    break
                messagebox.showwarning(APP, "That folder doesn't look like UniMate (no 'unimate' and 'data_process' "
                                            "folders inside). Pick the folder that has them.")
        models = find_models(CHECKPOINTS) or (find_models(ENGINE) if ENGINE else [])
        if models and not force:
            CHECKPOINTS = CHECKPOINTS if find_models(CHECKPOINTS) else ENGINE
        else:
            if not models:
                messagebox.showinfo(APP, "Now show me where the trained model is: the folder you downloaded "
                                         "from Hugging Face (Linzhan/UniMate). Any folder above it is fine too.")
            d = filedialog.askdirectory(title="Folder with the downloaded UniMate model",
                                        initialdir=CHECKPOINTS or ENGINE or os.path.expanduser("~"))
            if d:
                found = find_models(os.path.normpath(d))
                if found:
                    CHECKPOINTS = os.path.normpath(d)
                else:
                    messagebox.showwarning(APP, "I couldn't find a model in that folder. A model folder has a "
                                                "config.json and a 'checkpoints' folder with a .pt file in it.")
        self.models = find_models()
        names = [os.path.relpath(m, CHECKPOINTS) for m in self.models]
        self.cb_model["values"] = names
        if names and self.model.get() not in names:
            self.model.set(self.settings.get("model") if self.settings.get("model") in names else names[0])
        if is_engine(ENGINE):
            self._save_paths()
            self.log(f"UniMate folder: {ENGINE}")
        else:
            self.log("No UniMate folder chosen yet. Press 'Folders…' to pick it.")
        self.log(f"Models found: {len(self.models)}" + (f" (in {CHECKPOINTS})" if self.models else
                 ". Press 'Folders…' and pick the folder with the downloaded model."))

    # ---- layout
    def _build(self):
        pad = {"padx": 12, "pady": 6}
        style = ttk.Style(self)
        try:
            style.theme_use("vista" if os.name == "nt" else "clam")
        except tk.TclError:
            pass
        style.configure("Big.TButton", font=("Segoe UI", 12, "bold"), padding=8)
        style.configure("H.TLabel", font=("Segoe UI", 10, "bold"))

        root = ttk.Frame(self, padding=8)
        root.pack(fill="both", expand=True)
        root.columnconfigure(1, weight=1)

        # 1 character
        ttk.Label(root, text="1. Character", style="H.TLabel").grid(row=0, column=0, sticky="w", **pad)
        self.char = tk.StringVar(value=self.settings.get("char", ""))
        ttk.Entry(root, textvariable=self.char).grid(row=0, column=1, sticky="ew", **pad)
        ttk.Button(root, text="Choose…", command=self.choose_char).grid(row=0, column=2, **pad)
        ttk.Label(root, text="A rigged .glb or .fbx. It works best if the file also contains at least one animation "
                             "(any idle or walk).", foreground="#555", wraplength=560).grid(row=1, column=1, columnspan=2, sticky="w", padx=12)

        hips = ttk.Frame(root)
        hips.grid(row=2, column=1, columnspan=2, sticky="w", padx=12, pady=(2, 6))
        ttk.Label(hips, text="Hip bones, so it knows which way is forward (filled in for you):").grid(row=0, column=0, columnspan=4, sticky="w")
        self.face_r = tk.StringVar(value=self.settings.get("face_r", ""))
        self.face_l = tk.StringVar(value=self.settings.get("face_l", ""))
        ttk.Label(hips, text="Right").grid(row=1, column=0, sticky="w", pady=(4, 0))
        self.cb_r = ttk.Combobox(hips, textvariable=self.face_r, width=22)
        self.cb_r.grid(row=1, column=1, padx=(4, 16), pady=(4, 0))
        ttk.Label(hips, text="Left").grid(row=1, column=2, sticky="w", pady=(4, 0))
        self.cb_l = ttk.Combobox(hips, textvariable=self.face_l, width=22)
        self.cb_l.grid(row=1, column=3, padx=4, pady=(4, 0))

        # 2 prompt
        ttk.Label(root, text="2. What should it do?", style="H.TLabel").grid(row=3, column=0, sticky="nw", **pad)
        self.prompt = tk.Text(root, height=4, wrap="word", font=("Segoe UI", 11))
        self.prompt.grid(row=3, column=1, columnspan=2, sticky="ew", **pad)
        self.prompt.insert("1.0", self.settings.get("prompt", "walks forward slowly with a tired, hunched posture"))

        # 3 options
        ttk.Label(root, text="3. Options", style="H.TLabel").grid(row=4, column=0, sticky="nw", **pad)
        opts = ttk.Frame(root)
        opts.grid(row=4, column=1, columnspan=2, sticky="ew", **pad)
        opts.columnconfigure(1, weight=1)
        ttk.Label(opts, text="Versions to make").grid(row=0, column=0, sticky="w")
        self.reps = tk.IntVar(value=int(self.settings.get("reps", 2)))
        ttk.Spinbox(opts, from_=1, to=6, textvariable=self.reps, width=4).grid(row=0, column=1, sticky="w", padx=6)
        ttk.Label(opts, text="How closely to follow the prompt").grid(row=1, column=0, sticky="w", pady=(6, 0))
        self.cfg = tk.DoubleVar(value=float(self.settings.get("cfg", 0)))
        cfgrow = ttk.Frame(opts)
        cfgrow.grid(row=1, column=1, sticky="w", padx=6, pady=(6, 0))
        self.cfg_label = ttk.Label(cfgrow, width=14)
        ttk.Scale(cfgrow, from_=0, to=6, variable=self.cfg, length=180,
                  command=lambda _=None: self._cfg_text()).pack(side="left")
        self.cfg_label.pack(side="left", padx=6)
        self._cfg_text()
        ttk.Label(opts, text="Model").grid(row=2, column=0, sticky="w", pady=(6, 0))
        self.model = tk.StringVar()
        names = [os.path.relpath(m, CHECKPOINTS) for m in self.models]
        self.cb_model = ttk.Combobox(opts, textvariable=self.model, values=names, state="readonly")
        self.cb_model.grid(row=2, column=1, sticky="ew", padx=6, pady=(6, 0))
        if names:
            self.model.set(self.settings.get("model") if self.settings.get("model") in names else names[0])
        ttk.Label(opts, text="Save to").grid(row=3, column=0, sticky="w", pady=(6, 0))
        self.out = tk.StringVar(value=self.settings.get("out", DEFAULT_OUT))
        outrow = ttk.Frame(opts)
        outrow.grid(row=3, column=1, sticky="ew", padx=6, pady=(6, 0))
        ttk.Button(outrow, text="Change…", command=self.choose_out).pack(side="right", padx=(4, 0))
        ttk.Entry(outrow, textvariable=self.out).pack(side="left", fill="x", expand=True)
        self.previews = tk.BooleanVar(value=bool(self.settings.get("previews", False)))
        ttk.Checkbutton(opts, text="Also make skeleton preview videos (slower)", variable=self.previews).grid(row=4, column=0, columnspan=2, sticky="w", pady=(6, 0))

        # buttons
        btns = ttk.Frame(root)
        btns.grid(row=5, column=0, columnspan=3, sticky="ew", padx=12, pady=10)
        self.go = ttk.Button(btns, text="▶  Generate", style="Big.TButton", command=self.generate)
        self.go.pack(side="left")
        self.stop = ttk.Button(btns, text="Stop", command=self.cancel, state="disabled")
        self.stop.pack(side="left", padx=8)
        ttk.Button(btns, text="Open output folder", command=self.open_out).pack(side="left", padx=8)
        ttk.Button(btns, text="Folders…", command=lambda: self.ensure_paths(force=True)).pack(side="left")
        self.status = ttk.Label(btns, text="Ready.")
        self.status.pack(side="right")

        self.bar = ttk.Progressbar(root, mode="determinate", maximum=100)
        self.bar.grid(row=6, column=0, columnspan=3, sticky="ew", padx=12)

        # log
        logf = ttk.Frame(root)
        logf.grid(row=7, column=0, columnspan=3, sticky="nsew", padx=12, pady=(8, 4))
        root.rowconfigure(7, weight=1)
        self.logbox = tk.Text(logf, height=12, wrap="word", font=("Consolas", 9), bg="#10161f", fg="#cfd8e3",
                              insertbackground="#cfd8e3", state="disabled")
        sb = ttk.Scrollbar(logf, command=self.logbox.yview)
        self.logbox.configure(yscrollcommand=sb.set)
        self.logbox.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        if self.char.get() and os.path.exists(self.char.get()):
            self.after(300, lambda: self.read_bones(self.char.get(), keep=True))

    def _cfg_text(self):
        v = self.cfg.get()
        self.cfg_label.config(text="model default" if v < 1.0 else f"{v:.1f}×")

    # ---- small actions
    def choose_char(self):
        p = filedialog.askopenfilename(title="Choose a rigged character",
                                       filetypes=[("3D character", "*.glb *.gltf *.fbx"), ("All files", "*.*")])
        if p:
            self.char.set(os.path.normpath(p))
            self.read_bones(p)

    def choose_out(self):
        p = filedialog.askdirectory(title="Where should animations be saved?", initialdir=self.out.get())
        if p:
            self.out.set(os.path.normpath(p))

    def open_out(self):
        os.makedirs(self.out.get(), exist_ok=True)
        os.startfile(self.out.get()) if os.name == "nt" else subprocess.Popen(["xdg-open", self.out.get()])

    def log(self, text):
        self.q.put(("log", text))

    def set_status(self, text, pct=None):
        self.q.put(("status", (text, pct)))

    def _drain(self):
        try:
            while True:
                kind, val = self.q.get_nowait()
                if kind == "log":
                    self.logbox.configure(state="normal")
                    self.logbox.insert("end", val.rstrip() + "\n")
                    lines = int(self.logbox.index("end-1c").split(".")[0])
                    if lines > 4000:
                        self.logbox.delete("1.0", f"{lines-3000}.0")
                    self.logbox.see("end")
                    self.logbox.configure(state="disabled")
                elif kind == "status":
                    text, pct = val
                    self.status.config(text=text)
                    if pct is not None:
                        self.bar["value"] = pct
                elif kind == "bones":
                    bones, actions, keep = val
                    self.cb_r["values"] = bones
                    self.cb_l["values"] = bones
                    if not keep or not (self.face_r.get() in bones and self.face_l.get() in bones):
                        r, l = guess_hips(bones)
                        self.face_r.set(r)
                        self.face_l.set(l)
                    msg = f"Found {len(bones)} bones and {actions} animation(s) in the character."
                    if not actions:
                        msg += " It has no animation, so UniMate will use its rest pose only (usually still fine)."
                    self.log(msg)
                elif kind == "done":
                    self._idle()
                    ok, info = val
                    if ok:
                        if messagebox.askyesno(APP, info + "\n\nOpen the folder now?"):
                            os.startfile(ok) if os.name == "nt" else None
                    elif info:
                        messagebox.showerror(APP, info)
        except queue.Empty:
            pass
        self.after(100, self._drain)

    def _check_gpu(self):
        try:
            out = subprocess.run([PY, "-c", "import torch;print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"],
                                 capture_output=True, text=True, timeout=180, creationflags=NO_WINDOW)
            ok, _, name = out.stdout.strip().partition(" ")
            self.gpu = ok == "True"
            self.log(f"Graphics card: {name}" if self.gpu else
                     "No NVIDIA graphics card found: generating will run on the processor and be much slower.")
        except Exception as e:
            self.gpu = False
            self.log(f"Couldn't check the graphics card ({e}).")

    def read_bones(self, path, keep=False):
        def work():
            try:
                r = subprocess.run([PY, "-c", LIST_BONES, path], capture_output=True, text=True, timeout=300,
                                   creationflags=NO_WINDOW, cwd=BASE)
                m = re.search(r"@@BONES@@(.*)", r.stdout)
                if not m:
                    self.log("Couldn't read the bones from that file:\n" + (r.stderr or r.stdout)[-1500:])
                    return
                info = json.loads(m.group(1))
                self.q.put(("bones", (info["bones"], info["actions"], keep)))
            except Exception as e:
                self.log(f"Couldn't read the bones: {e}")
        self.log("Reading the character's bones…")
        threading.Thread(target=work, daemon=True).start()

    def _idle(self):
        self.busy = False
        self.proc = None
        self.go.config(state="normal")
        self.stop.config(state="disabled")

    def cancel(self):
        self.cancelled = True
        if self.proc and self.proc.poll() is None:
            self.proc.kill()
        self.set_status("Stopping…")

    # ---- the pipeline
    def generate(self):
        if self.busy:
            return
        char = self.char.get().strip().strip('"')
        prompt = " ".join(self.prompt.get("1.0", "end").split())
        if not os.path.isfile(char):
            messagebox.showwarning(APP, "Choose your character file first (step 1).")
            return
        if not prompt:
            messagebox.showwarning(APP, "Type what the character should do (step 2).")
            return
        if not is_engine(ENGINE) or not self.models:
            messagebox.showerror(APP, "I don't know where your UniMate folder or model is yet. Press 'Folders…' to show me.")
            return
        exp = os.path.join(CHECKPOINTS, self.model.get())
        opts = dict(char=char, prompt=prompt, reps=max(1, min(6, int(self.reps.get() or 1))),
                    cfg=self.cfg.get(), exp=exp, out=self.out.get().strip() or DEFAULT_OUT,
                    face_r=self.face_r.get().strip(), face_l=self.face_l.get().strip(),
                    previews=self.previews.get())
        save_settings({"char": char, "prompt": prompt, "reps": opts["reps"], "cfg": opts["cfg"],
                       "model": self.model.get(), "out": opts["out"], "face_r": opts["face_r"],
                       "face_l": opts["face_l"], "previews": opts["previews"]})
        self.busy = True
        self.cancelled = False
        self.go.config(state="disabled")
        self.stop.config(state="normal")
        self.bar["value"] = 0
        threading.Thread(target=self._run, args=(opts,), daemon=True).start()

    def run_cmd(self, args, what):
        if self.cancelled:
            raise StepFailed("")
        self.log("\n$ " + " ".join(f'"{a}"' if " " in a else a for a in args))
        env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8", KMP_DUPLICATE_LIB_OK="TRUE",
                   PYTHONPATH=ENGINE + os.pathsep + os.environ.get("PYTHONPATH", ""))
        self.proc = subprocess.Popen(args, cwd=ENGINE, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                     text=True, encoding="utf-8", errors="replace", creationflags=NO_WINDOW)
        tail = []
        for line in self.proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            tail = (tail + [line])[-40:]
            self.log(line)
        code = self.proc.wait()
        if self.cancelled:
            raise StepFailed("")
        if code != 0:
            raise StepFailed(f"{what} failed.\n\nLast lines of the log:\n" + "\n".join(tail[-12:]))

    def _run(self, o):
        try:
            result = self._pipeline(o)
            self.q.put(("done", result))
        except StepFailed as e:
            self.set_status("Stopped." if self.cancelled else "Something went wrong.", 0)
            self.q.put(("done", (None, None if self.cancelled else str(e))))
        except Exception as e:
            self.set_status("Something went wrong.", 0)
            self.log(repr(e))
            self.q.put(("done", (None, f"Unexpected error: {e}")))

    def _pipeline(self, o):
        with open(os.path.join(o["exp"], "config.json"), encoding="utf-8") as f:
            cfg = json.load(f)
        ds = cfg.get("dataset", {})
        dlist = ds.get("dataset_list") or ["objaverse"]
        # borrow the layout of a dataset the model was trained on; objaverse is the pipeline's "custom" layout
        dtype = "objaverse" if "objaverse" in dlist else next((d for d in dlist if d != "mixamo"), dlist[0])

        # 1. prepare the character (cached per file + hip choice)
        name = safe_name(o["char"])
        key = file_hash(o["char"], o["face_r"] + "|" + o["face_l"])
        rigdir = os.path.join(WORK, "rigs", f"{name}_{key}")
        ext = os.path.splitext(o["char"])[1].lower()
        src = os.path.join(rigdir, "src", name + ext)
        cond = os.path.join(rigdir, "cond.npy")
        if not os.path.exists(cond):
            self.set_status("Step 1 of 3: reading your character (first time only)…", 5)
            os.makedirs(os.path.dirname(src), exist_ok=True)
            shutil.copy2(o["char"], src)
            args = [PY, "-m", "data_process.mesh_animation.preprocess_char", "--char_path", src,
                    "--output_dir", rigdir, "--formats", "glb,fbx"]
            if o["face_r"] and o["face_l"]:
                args += ["--face_r", o["face_r"], "--face_l", o["face_l"]]
            try:
                self.run_cmd(args, "Reading the character")
            except StepFailed:
                if os.path.exists(cond):
                    os.remove(cond)
                raise
        else:
            self.log(f"Using the saved preparation of {name} (step 1 skipped).")

        njoints = self._count_joints(cond)
        lo, hi = int(ds.get("min_joints", 5)), int(ds.get("max_joints", 0) or 10**6)
        if njoints and not lo <= njoints <= hi:
            raise StepFailed(
                f"After cleanup your character has {njoints} bones, but this model handles {lo} to {hi}.\n\n"
                "Try a version of the rig without finger, face or twist bones, or pick another model in Options.")

        # the model reads a character from a dataset-shaped folder: cond.npy + motions/
        feat = os.path.join(rigdir, "features")
        os.makedirs(os.path.join(feat, "motions"), exist_ok=True)
        shutil.copy2(cond, os.path.join(feat, "cond.npy"))
        for npz in glob.glob(os.path.join(rigdir, "motions", "*.npz")):
            dst = os.path.join(feat, "motions", os.path.basename(npz))
            if not os.path.exists(dst):
                shutil.copy2(npz, dst)

        # a copy of the model's run folder pointed at this character (checkpoint stays where it is)
        run_exp = os.path.join(WORK, "runs", f"{os.path.basename(o['exp'])}__{name}_{key}")
        os.makedirs(run_exp, exist_ok=True)
        pcfg = json.loads(json.dumps(cfg))
        pcfg.setdefault("dataset", {})["dataset_list"] = [dtype]
        sub = pcfg.setdefault(dtype, {})
        sub["path"] = feat
        sub.setdefault("type", dtype)
        if dtype == "objaverse":
            sub["objects_num"] = -1
            sub["filter_object"] = False
        if dtype == "truebones":
            sub["objects_subset"] = "all"
        pcfg.setdefault("sampling", {})["device"] = "cuda" if self.gpu else "cpu"
        with open(os.path.join(run_exp, "config.json"), "w", encoding="utf-8") as f:
            json.dump(pcfg, f, indent=2)
        for extra in ("dataset_stats.npy",):
            p = os.path.join(o["exp"], extra)
            if os.path.exists(p):
                shutil.copy2(p, os.path.join(run_exp, extra))
        ckpt = latest_checkpoint(o["exp"])

        # 2. generate
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H.%M.%S")
        outdir = os.path.join(o["out"], f"{stamp} - {name} - {friendly(o['prompt'])}")
        raw = os.path.join(WORK, "samples", f"{name}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{random.randint(1000, 9999)}")
        os.makedirs(raw, exist_ok=True)
        if os.path.exists(outdir):
            outdir += f" ({random.randint(2, 999)})"
        cases = os.path.join(raw, "prompt.json")
        with open(cases, "w", encoding="utf-8") as f:
            json.dump({f"{name}-take": o["prompt"]}, f)
        self.set_status("Step 2 of 3: generating the motion…", 35)
        args = [PY, "-m", "unimate.inference.sample", "--exp_dir", run_exp, "--model_path", ckpt,
                "--test_cases_json", cases, "--num_repetitions", str(o["reps"]),
                "--output_dir", raw, "--seed", str(random.randint(0, 2**31 - 1)), "--batch_size", "8"]
        if o["cfg"] >= 1.0:
            args += ["--cfg_scale", f"{o['cfg']:.2f}"]
        if not o["previews"]:
            args += ["--only_save_motion"]
        self.run_cmd(args, "Generating the motion")
        motions = sorted(glob.glob(os.path.join(raw, "motions", "*.npy")))
        if not motions:
            raise StepFailed("UniMate finished but didn't write any motion. The log above says why.")

        # 3. put it on the character
        os.makedirs(outdir, exist_ok=True)
        for i, m in enumerate(motions, 1):
            self.set_status(f"Step 3 of 3: putting motion {i} of {len(motions)} on your character…",
                            60 + 38 * (i - 1) / len(motions))
            one = os.path.join(raw, f"animated_{i}")
            self.run_cmd([PY, "-m", "data_process.mesh_animation.animate_motion", "--dataset_type", dtype,
                          "--anim_path", m, "--char_path", src, "--cond_path", cond, "--output_dir", one],
                         "Putting the motion on the character")
            for f in glob.glob(os.path.join(one, "**", "*.*"), recursive=True):
                fext = os.path.splitext(f)[1].lower()
                if fext in (".glb", ".fbx"):
                    shutil.copy2(f, os.path.join(outdir, f"{name} - version {i}{fext}"))
        for mp4 in glob.glob(os.path.join(raw, "animations", "*.mp4")):
            shutil.copy2(mp4, os.path.join(outdir, "preview - " + os.path.basename(mp4)))
        with open(os.path.join(outdir, "prompt.txt"), "w", encoding="utf-8") as f:
            f.write(f"Prompt: {o['prompt']}\nCharacter: {o['char']}\nModel: {o['exp']}\n")
        made = [f for f in os.listdir(outdir) if f.lower().endswith((".glb", ".fbx"))]
        if not made:
            raise StepFailed("The motion was generated but no .glb/.fbx came out. The log above says why.")
        self.set_status(f"Done: {len(made)} file(s) saved.", 100)
        return outdir, f"Done! {len(made)} animated file(s) saved in:\n{outdir}"

    def _count_joints(self, cond):
        try:
            r = subprocess.run([PY, "-c", "import sys,numpy as np;d=np.load(sys.argv[1],allow_pickle=True).item();"
                                "print(len(next(iter(d.values()))['parents']))", cond],
                               capture_output=True, text=True, timeout=120, creationflags=NO_WINDOW)
            return int(r.stdout.strip())
        except Exception:
            return 0


if __name__ == "__main__":
    Studio().mainloop()
