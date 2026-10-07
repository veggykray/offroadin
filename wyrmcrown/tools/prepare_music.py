"""Import supplied music WAVs as level-matched stereo game assets.

Original WAVs stay in the source directory. No provider or paid API is used.
Requires imageio_ffmpeg, already used by this project's audio production tools.
"""
import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path
from audio_generate import GAME, PROD, ffmpeg, write, atomic_text

SOURCES = {
    'human_home': 'Soft Flowing Strings.wav',
    'human_fight': 'Human dragon fight.wav',
    'elf_home': 'Elf dragon home.wav',
    'elf_fight': 'Elf dragon fight.wav',
    'ice_home': 'Ice dragon home.wav',
    'ice_fight': 'Ice dragon fight.wav',
    'undead_home': 'Undead dragon home.wav',
    'undead_fight': 'Undead dragon fight.wav',
}


def run(arguments):
    result = subprocess.run([ffmpeg(), '-hide_banner', '-nostdin', *arguments], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result.stderr


def info(log):
    duration = re.search(r'Duration: (\d+):(\d+):([\d.]+)', log)
    audio = re.search(r'Audio: [^\n]*? (\d+) Hz, ([^,\n]+)', log)
    assert duration and audio, log[:1500]
    hours, minutes, seconds = map(float, duration.groups())
    return {'duration_seconds': round(hours*3600+minutes*60+seconds, 3), 'sample_rate': int(audio[1]), 'channels': audio[2]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=Path.home()/'Downloads')
    args = parser.parse_args()
    target = GAME/'audio'/'music'
    target.mkdir(parents=True, exist_ok=True)
    tracks, audit = {}, []
    for key, filename in SOURCES.items():
        source = args.source_dir/filename
        assert source.is_file(), source
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        dest = target/(key+'.mp3')
        sidecar = dest.with_suffix('.json')
        if dest.exists() and sidecar.exists():
            meta = json.loads(sidecar.read_text(encoding='utf-8'))
            assert meta['source_sha256'] == source_hash, f'Source changed: {filename}; review before replacing the prepared track'
            assert hashlib.sha256(dest.read_bytes()).hexdigest() == meta['sha256'], dest
            print('PRESERVED '+dest.name, flush=True)
        else:
            assert not dest.exists() and not sidecar.exists(), f'Incomplete prepared track: {dest}'
            measure = run(['-i', str(source), '-af', 'loudnorm=I=-22:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'])
            values = json.loads(re.search(r'\{\s*"input_i"[\s\S]*?\}', measure)[0])
            assert all(math.isfinite(float(values[k])) for k in ['input_i','input_tp','input_lra','input_thresh','target_offset']), filename
            filters = ('loudnorm=I=-22:TP=-2:LRA=11:linear=true'
                + f":measured_I={values['input_i']}:measured_TP={values['input_tp']}"
                + f":measured_LRA={values['input_lra']}:measured_thresh={values['input_thresh']}"
                + f":offset={values['target_offset']}")
            run(['-i', str(source), '-af', filters, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', '-map_metadata', '-1', '-n', str(dest)])
            meta = {'id': key, 'source_file': filename, 'source_path': str(source.resolve()), 'source_sha256': source_hash,
                'source_info': info(measure), 'source_loudness': values, 'processing': {'target_lufs': -22, 'true_peak_db': -2,
                'loudness_range': 11, 'sample_rate': 44100, 'channels': 2, 'mp3_bitrate_kbps': 192, 'speed': 1, 'pitch_shift': False},
                'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}
        # Fresh decode covers stereo, duration, audible signal and sample headroom.
        measured = run(['-i', str(dest), '-af', 'volumedetect', '-f', 'null', '-'])
        final_info = info(measured)
        peak = float(re.search(r'max_volume: ([-\d.]+) dB', measured)[1])
        assert final_info['channels'] == 'stereo' and final_info['sample_rate'] == 44100, dest
        assert abs(final_info['duration_seconds']-meta['source_info']['duration_seconds']) < .15, filename
        assert -60 < peak <= -1.5, (filename, peak)
        meta['inspection'] = {**final_info, 'peak_dbfs': peak, 'verification': 'Fresh FFmpeg decode and stereo/sample-peak checks'}
        write(sidecar, meta)
        tracks[key] = {'file': f'audio/music/{key}.mp3', 'title': source.stem, 'source_file': filename,
            'duration': final_info['duration_seconds'], 'sample_rate': 44100, 'channels': 2}
        audit.append({'id': key, 'file': tracks[key]['file'], 'sha256': meta['sha256'], **meta['inspection']})
        print(f"READY {key}: {final_info['duration_seconds']}s, stereo, peak {peak}dBFS", flush=True)
    manifest = {'schema_version': 1, 'start': 'human_home', 'tracks': tracks,
        'realms': {fk: {'home': fk+'_home', 'fight': fk+'_fight'} for fk in ['human','elf','ice','undead']}}
    write(PROD/'music-manifest.json', manifest)
    write(PROD/'music-audit.json', {'tracks': audit, 'errors': [], 'originals': 'User-supplied WAVs preserved in their source directory'})
    atomic_text(GAME/'data'/'music.js', "'use strict';\nwindow.AS.Data.music = "+json.dumps(manifest, ensure_ascii=False)+';\n')
    print('Prepared and verified all eight supplied music tracks. Soft Flowing Strings is the opening and human home theme.', flush=True)


if __name__ == '__main__':
    main()
