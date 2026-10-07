"""Verify real production files and locked cast identity; never certify acting quality."""
import argparse
import collections
import hashlib
import json
from audio_generate import GAME, PROD, inspect_audio, read, write

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--decode',action='store_true',help='Decode every final asset to remeasure peaks')
    parser.add_argument('--complete',action='store_true',help='Require every dialogue job to have a generated take')
    args=parser.parse_args()
    cast=read('cast.json')['characters'];errors=[];counts=collections.Counter();generated=set();durations={};by_character=collections.Counter()
    selected=[c.get('voice_id') for c in cast.values()];meal_hashes=[]
    if len(set(selected))!=8 or not all(selected):errors.append('Eight distinct locked voice IDs required')
    for folder in ['auditions','sfx','voice']:
        for sidecar in sorted((GAME/'audio'/folder).glob('*.json')):
            meta=json.loads(sidecar.read_text(encoding='utf-8'));job=meta['job'];dest=sidecar.with_suffix('.mp3')
            try:
                if hashlib.sha256(dest.read_bytes()).hexdigest()!=meta['sha256']:raise ValueError('Final checksum mismatch')
                if not (GAME/meta['raw_file']).is_file():raise ValueError('Original provider take missing')
                if hashlib.sha256(json.dumps(meta['request'],sort_keys=True).encode()).hexdigest()!=meta['request_sha256']:raise ValueError('Request checksum mismatch')
                info=inspect_audio(dest) if args.decode else meta['inspection']
                if info['peak_dbfs']>-2 or info['clipped_sample_fraction']>0:raise ValueError('Clipping or insufficient peak headroom')
                if info['duration_seconds']<.1:raise ValueError('Implausibly short recording')
                if job['kind']=='dialogue':
                    char=cast[job['character']]
                    if meta['voice_id']!=char['voice_id'] or meta['request']['voice_settings']!=char['voice_settings'] or meta['request']['model_id']!=char['model_id']:raise ValueError('Voice identity/settings differ from approved cast')
                    if not job['performance'] or not job['synthesis_text'].startswith('['):raise ValueError('Missing performance direction')
                    if not meta.get('pronunciation_snapshot'):raise ValueError('Missing exact pronunciation snapshot')
                    generated.add(job['id']);by_character[job['character']]+=1
                if job.get('event') in ['eat_sheep','eat_cattle','eat_goat_deer','eat_large']:
                    if not .85<=info['duration_seconds']<=.95:raise ValueError('Meal should fit the rapid 0.9-second sequence')
                    meal_hashes.append(meta['sha256'])
                counts[job['kind']]+=1;durations[job['kind']]=durations.get(job['kind'],0)+info['duration_seconds']
            except Exception as error:errors.append(sidecar.name+': '+str(error))
    expected={j['id'] for j in read('dialogue-jobs.json')};missing=sorted(expected-generated)
    if len(meal_hashes)!=12 or len(set(meal_hashes))!=12:errors.append('Twelve distinct rapid meals required')
    if args.complete and missing:errors.append(str(len(missing))+' dialogue jobs lack generated audio')
    report={'counts':dict(counts),'duration_seconds':{k:round(v,2) for k,v in durations.items()},'dialogue_characters':dict(by_character),
            'dialogue_jobs_generated':len(generated),'dialogue_jobs_expected':len(expected),'missing_dialogue':missing,'errors':errors,
            'verification':'Fresh decoded measurements' if args.decode else 'Generation-time measurements and fresh checksum checks',
            'listening_status':'Casting approved by user. Production acting, name pronunciation and SFX listening review pending.'}
    write(PROD/'audit.json',report)
    print(json.dumps({k:v for k,v in report.items() if k!='missing_dialogue'},indent=2))
    if errors:raise SystemExit(1)

if __name__=='__main__':main()
