"""Reproducible ElevenLabs production, using only stdlib plus local FFmpeg."""
import argparse
import array
import base64
import datetime as dt
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
import uuid
from pathlib import Path

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
PROD = GAME / "audio" / "production"
sys.path.insert(0, str(ROOT / ".audio-deps"))
API = "https://api.elevenlabs.io/v1/"

class ProviderRejection(RuntimeError):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


def read(name):
    return json.loads((PROD / name).read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_text(path,json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def atomic_text(path, value):
    temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        temp.write_text(value,encoding='utf-8')
        temp.replace(path)
    finally:temp.unlink(missing_ok=True)


def request(path, data=None):
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured; never put it in the browser")
    headers = {"xi-api-key": key}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                return response.read(), dict(response.headers)
        except urllib.error.HTTPError as error:
            detail = error.read().decode()[:700]
            if error.code == 429 and attempt < 3:
                delay = min(45, 15 * (attempt + 1))
                print(f"Rate limited; waiting {delay}s before retrying the rejected request.", flush=True)
                time.sleep(delay)
                continue
            # Only explicit request rejection is safe to retry. Timeouts/5xx remain uncertain.
            if error.code in [400, 401, 403, 404, 422, 429]:
                raise ProviderRejection(error.code, f"ElevenLabs HTTP {error.code}: {detail}") from None
            raise RuntimeError(f"ElevenLabs HTTP {error.code}: {detail}") from None


def available_credits():
    raw, _ = request("user/subscription")
    account = json.loads(raw)
    return account["character_limit"] - account["character_count"]


def pronounce(text, dictionary):
    for entry in sorted(dictionary["entries"], key=lambda e: len(e["term"]), reverse=True):
        replacement = '/' + entry['ipa'] + '/' if entry.get('ipa') else entry['spoken_alias']
        text = re.sub(r"(?<!\w)" + re.escape(entry["term"]) + r"(?!\w)", lambda _: replacement, text, flags=re.I)
    return text


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def inspect_audio(path):
    wav = path.with_suffix(".inspection.wav")
    run = subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(wav)], capture_output=True)
    if run.returncode:
        raise RuntimeError("Audio decode failed: " + run.stderr.decode(errors="replace")[:400])
    try:
        with wave.open(str(wav)) as audio:
            sr = audio.getframerate()
            samples = array.array("h", audio.readframes(audio.getnframes()))
        if not samples:
            raise RuntimeError("Generated recording is empty")
        peak = max(abs(s) for s in samples) / 32768
        rms = math.sqrt(sum((s / 32768) ** 2 for s in samples) / len(samples))
        step = int(sr * .02)
        frames = [math.sqrt(sum((s / 32768) ** 2 for s in samples[i:i+step]) / max(1,len(samples[i:i+step]))) for i in range(0,len(samples),step)]
        active = [i for i, energy in enumerate(frames) if energy > .008]
        info = {"duration_seconds": round(len(samples)/sr,3), "peak_dbfs": round(20*math.log10(max(peak,1e-9)),2),
                "rms_dbfs": round(20*math.log10(max(rms,1e-9)),2), "clipped_sample_fraction": round(sum(abs(s)>=32760 for s in samples)/len(samples),6),
                "leading_quiet_seconds": round((active[0] if active else len(frames))*.02,3),
                "trailing_quiet_seconds": round((len(frames)-1-active[-1] if active else len(frames))*.02,3),
                "checks": "decode, duration, peak, RMS, clipping, edge silence; does not establish acting or pronunciation quality"}
        if rms < .0002 or info["duration_seconds"] < .1:
            raise RuntimeError("Silent or implausibly short audio")
        return info
    finally:
        wav.unlink(missing_ok=True)


def normalize(raw, dest, processing, loop=False):
    # Original provider take is preserved. Never lower dragon pitch to fake scale.
    filters = f"highpass=f={processing.get('highpass_hz',35)},loudnorm=I={processing.get('integrated_lufs',-20)}:TP={processing.get('true_peak_db',-2)}:LRA=9,alimiter=limit=0.45:level=false:attack=5:release=50"
    run = subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw), "-af", filters, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(dest)], capture_output=True)
    if run.returncode:
        raise RuntimeError("Audio normalization failed: " + run.stderr.decode(errors="replace")[:400])


def repair_levels():
    repaired=0
    for folder in ['auditions','sfx','voice']:
        for sidecar in sorted((GAME/'audio'/folder).glob('*.json')):
            meta=json.loads(sidecar.read_text(encoding='utf-8'))
            dest=sidecar.with_suffix('.mp3')
            if meta.get('processing_revision')=='peak-limited-3': continue
            normalize(GAME/meta['raw_file'],dest,meta['processing'],meta['job'].get('loop',False))
            info=inspect_audio(dest)
            if info['peak_dbfs'] > -2 or info['clipped_sample_fraction'] > 0:
                raise RuntimeError(f'Peak guard failed for {dest.name}: {info}')
            meta['inspection']=info
            meta['processing_revision']='peak-limited-3'
            meta['processing']['post_limiter']={'limit':.45,'auto_level':False,'attack_ms':5,'release_ms':50}
            meta['sha256']=hashlib.sha256(dest.read_bytes()).hexdigest()
            write(sidecar,meta)
            repaired+=1
    export_manifest()
    print(f'Level guard verified on {repaired} repaired takes; original provider takes preserved.')


def run_jobs(kind, only=None, limit=None, take=1, ids=None):
    cast = read("cast.json")
    dictionary = read("pronunciation.json")
    if kind == "dialogue":
        characters = cast["characters"]
        if len(characters) != 8 or any(not c["approved"] or not c["audition_review"] or not c["selected_candidate"] for c in characters.values()):
            raise RuntimeError("Bulk dialogue is locked: all eight characters need a recorded audition review and approved selection first")
        selected = [next(v["voice_id"] for v in c["candidates"] if v["key"] == c["selected_candidate"]) for c in characters.values()]
        if len(set(selected)) != 8:
            raise RuntimeError("Eight different voice IDs are required")
    jobs = read({"audition":"auditions.json", "sfx":"sfx-jobs.json", "dialogue":"dialogue-jobs.json"}[kind])
    if only:
        jobs = [j for j in jobs if only in j["id"]]
    if ids:
        missing=set(ids)-{j['id'] for j in jobs}
        if missing:raise ValueError('Unknown selected job IDs: '+', '.join(sorted(missing)))
        jobs=[j for j in jobs if j['id'] in ids]
    if limit:
        jobs = jobs[:limit]
    print(f"{kind}: {len(jobs)} jobs. Existing takes will be preserved.", flush=True)
    starting_credits = available_credits()
    conservative_spend = 0
    for job_number, job in enumerate(jobs, 1):
        filename = job["id"] + f"_take{take:02}.mp3"
        dest = GAME / "audio" / ("auditions" if kind == "audition" else "sfx" if kind == "sfx" else "voice") / filename
        sidecar = dest.with_suffix(".json")
        if dest.exists() and sidecar.exists():
            if kind=='dialogue':
                saved=json.loads(sidecar.read_text(encoding='utf-8'));character=cast['characters'][job['character']]
                if saved['voice_id']!=character['voice_id'] or saved['request']['model_id']!=character['model_id'] or saved['request']['voice_settings']!=character['voice_settings']:
                    raise RuntimeError(f'{filename} uses a different cast/settings; preserve it and generate an explicit new take')
            print("SKIP " + filename, flush=True)
            continue
        if dest.exists() or sidecar.exists():
            raise RuntimeError(f"Incomplete take {filename}; inspect it before regenerating with a new take number")
        if kind == "sfx":
            body = {k:job[k] for k in ["text","duration_seconds","loop","model_id","prompt_influence"]}
            endpoint = "sound-generation?output_format=mp3_44100_128"
            processing = {"integrated_lufs": -20, "true_peak_db": -2, "highpass_hz": 25}
            cost_estimate = math.ceil(body["duration_seconds"]*40)
        else:
            character = cast["characters"][job["character"]]
            candidate_key = job.get("candidate") or character["selected_candidate"]
            candidate = next(c for c in character["candidates"] if c["key"] == candidate_key)
            body = {"text": pronounce(job["synthesis_text"],dictionary), "model_id": character["model_id"],
                    "voice_settings": character["voice_settings"], "seed": int(hashlib.sha256((job["id"]+str(take)).encode()).hexdigest()[:8],16),
                    "language_code": "en", "apply_text_normalization": "off"}
            if dictionary["dictionary_locators"]:
                body["pronunciation_dictionary_locators"] = dictionary["dictionary_locators"]
            endpoint = "text-to-speech/" + candidate["voice_id"] + "?output_format=" + character["output_format"]
            processing = character["processing"]
            cost_estimate = len(body["text"])*2  # conservative reserve; never enable paid overage
        credits = min(available_credits(), starting_credits - conservative_spend)
        if credits < cost_estimate + 1500:
            raise RuntimeError(f"Stopping with {credits} credits remaining; next take needs a conservative reserve of {cost_estimate+1500}")
        dest.parent.mkdir(parents=True,exist_ok=True)
        raw_path = PROD / "raw" / filename
        raw_path.parent.mkdir(parents=True,exist_ok=True)
        pending = raw_path.with_suffix(".request.json")
        request_hash = hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest()
        raw_sidecar = raw_path.with_suffix(".json")
        if raw_path.exists() and raw_sidecar.exists():
            cached = json.loads(raw_sidecar.read_text(encoding="utf-8"))
            if cached["request_sha256"] != request_hash:
                raise RuntimeError("Settings changed for a preserved raw take; choose a new take number")
            headers = cached["response_headers"]
        else:
            if pending.exists() and json.loads(pending.read_text(encoding="utf-8")).get("status") == "provider_rejected":
                pending.unlink()
            if raw_path.exists() or pending.exists():
                raise RuntimeError(f"Uncertain generation outcome for {filename}; recover from provider history or choose a new take explicitly")
            write(pending,{"endpoint":endpoint,"request":body,"request_sha256":request_hash,"status":"request_started"})
            try:
                raw, headers = request(endpoint, body)
            except ProviderRejection as error:
                write(pending,{"endpoint":endpoint,"request":body,"request_sha256":request_hash,"status":"provider_rejected","http_status":error.status})
                raise
            raw_path.write_bytes(raw)
            # The response states the actual billed credit cost. Use it to reconcile
            # the conservative reservation while subscription counters catch up.
            charged = next((v for k,v in headers.items() if k.lower()=='character-cost'),None)
            try: charged = max(1,math.ceil(float(charged)))
            except (TypeError,ValueError): charged = cost_estimate
            conservative_spend += charged
            write(raw_sidecar,{"request_sha256":request_hash,"response_headers":{k:v for k,v in headers.items() if k.lower() in ["request-id","character-cost","history-item-id","content-type"]}})
            pending.unlink()
        info = inspect_audio(raw_path)
        normalize(raw_path,dest,processing,job.get("loop",False))
        normalized = inspect_audio(dest)
        if normalized['peak_dbfs'] > -2 or normalized['clipped_sample_fraction'] > 0:
            raise RuntimeError(f'Peak guard failed for {dest.name}; preserved raw take requires repair')
        processing = dict(processing,post_limiter={'limit':.45,'auto_level':False,'attack_ms':5,'release_ms':50})
        meta = {"job":job,"generated_utc":dt.datetime.now(dt.timezone.utc).isoformat(),"provider":"ElevenLabs", "endpoint":endpoint,
                "voice_id":candidate["voice_id"] if kind != "sfx" else None,"candidate_key":candidate_key if kind != "sfx" else None,
                "request":body,"request_sha256":request_hash,"pronunciation_revision":dictionary["revision"] if kind != "sfx" else None,
                "pronunciation_snapshot":dictionary if kind != "sfx" else None,"processing":processing,"raw_file":str(raw_path.relative_to(GAME)),
                "sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),"processing_revision":"peak-limited-3","provider_request_id":headers.get("request-id") or headers.get("Request-Id"),
                "raw_inspection":info,"inspection":normalized,"audition_review":"pending", "release_status":"technical_checks_only_listening_review_required"}
        write(sidecar,meta)
        print(f"GENERATED {filename} {normalized['duration_seconds']}s peak {normalized['peak_dbfs']}dBFS",flush=True)
        if job_number % 10 == 0:
            export_manifest()
    export_manifest()


def export_manifest():
    takes=[]
    for folder in ["auditions","sfx","voice"]:
        for sidecar in sorted((GAME/"audio"/folder).glob("*.json")):
            meta=json.loads(sidecar.read_text(encoding="utf-8"))
            takes.append({"id":meta["job"]["id"],"kind":meta["job"]["kind"],"event":meta["job"].get("event"),
                          "character":meta["job"].get("character"),"candidate":meta.get("candidate_key"),
                          "voice_id":meta.get('voice_id'),"model_id":meta['request'].get('model_id'),"voice_settings":meta['request'].get('voice_settings'),
                          "file":str(sidecar.with_suffix(".mp3").relative_to(GAME)).replace("\\","/"),
                          "metadata":str(sidecar.relative_to(GAME)).replace("\\","/"),"duration":meta["inspection"]["duration_seconds"],
                          "text":meta["job"].get("text"),"performance":meta["job"].get("performance"),
                          "fallback":meta["job"].get("fallback"),"loop":meta["job"].get("loop",False),"gain":meta["job"].get("gain",.65),
                          "review":meta["audition_review"],"release_status":meta["release_status"]})
    manifest={"schema_version":1,"takes":takes,"cast":read("cast.json"),"pronunciation_revision":read("pronunciation.json")["revision"]}
    write(PROD/"manifest.json",manifest)
    atomic_text(GAME/"data"/"recordings.js","'use strict';\nwindow.AS.Data.recordings = "+json.dumps(manifest,ensure_ascii=False)+";\n")
    print(f"Exported {len(takes)} recordings.",flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind",choices=["audition","sfx","dialogue","export","repair-levels"])
    parser.add_argument("--only",help="ID substring")
    parser.add_argument("--limit",type=int)
    parser.add_argument("--take",type=int,default=1,help="Explicit new take number; preserved takes are never overwritten")
    parser.add_argument('--ids',nargs='+',help='Exact IDs for a batch of targeted retakes')
    args=parser.parse_args()
    if args.kind=="repair-levels": repair_levels()
    elif args.kind=="export": export_manifest()
    else: run_jobs(args.kind,args.only,args.limit,args.take,args.ids)


if __name__=="__main__":
    try: main()
    except Exception as error:
        print("STOPPED: "+str(error),file=sys.stderr)
        sys.exit(1)
