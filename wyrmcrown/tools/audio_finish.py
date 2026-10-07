"""Assemble quick eating from real ElevenLabs stems and wrap loop edges."""
import array
import hashlib
import json
import subprocess
import wave
import shutil
from audio_generate import GAME, PROD, export_manifest, ffmpeg, inspect_audio, normalize, repair_levels, write

def decode(path):
    result=subprocess.run([ffmpeg(),'-hide_banner','-loglevel','error','-i',str(path),'-ac','1','-ar','44100','-f','s16le','-'],capture_output=True,check=True)
    samples=array.array('h',result.stdout)
    return samples

def pcm_file(path,samples):
    with wave.open(str(path),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(44100);wav.writeframes(samples.tobytes())

def finish():
    # Timed stems guarantee the five-part action; prompt timestamps alone cannot.
    profiles={
        'sheep': [('bite',0,.08,1),('crunch',.08,.16,.75),('squelch',.22,.16,.8),('chew',.37,.20,.65),('swallow',.61,.28,.8)],
        'cattle': [('bite',0,.12,1),('crunch',.11,.19,1.15),('squelch',.29,.15,.85),('chew',.45,.13,.65),('swallow',.63,.26,1)],
        'goat_deer': [('bite',0,.09,.9),('crunch',.08,.13,.85),('squelch',.20,.15,.75),('chew',.36,.21,.8),('swallow',.59,.29,.9)],
        'large': [('bite',0,.13,1.15),('crunch',.11,.23,1.2),('squelch',.33,.16,1),('chew',.48,.12,.6),('swallow',.62,.27,1.1)],
    }
    for prey_index,prey in enumerate(['sheep','cattle','goat_deer','large']):
        for variant in range(1,4):
            key=f'eat_{prey}_{variant:02}_take01'
            sidecar=GAME/'audio'/'sfx'/(key+'.json')
            meta=json.loads(sidecar.read_text(encoding='utf-8'))
            if meta.get('assembly_revision')=='rapid-five-stems-2':continue
            if meta.get('assembly_revision'):
                archive=PROD/'processing-history';archive.mkdir(exist_ok=True)
                for source in [sidecar,sidecar.with_suffix('.mp3')]:
                    saved=archive/(key+'.'+meta['assembly_revision']+source.suffix)
                    if not saved.exists():shutil.copy2(source,saved)
            sequence=array.array('h',[0])*int(.9*44100)
            stages=[]
            for index,(part,start,duration,weight) in enumerate(profiles[prey]):
                take=(variant+prey_index*(index+1)+index-1)%3+1
                stem=GAME/'audio'/'sfx'/f'eat_stem_{part}_{take:02}_take01.mp3'
                samples=decode(stem)
                # Remove provider silence using short RMS windows, retaining 5 ms pre-roll.
                block=220
                active=next((i for i in range(0,len(samples),block) if sum(s*s for s in samples[i:i+block])/max(1,len(samples[i:i+block]))>200**2),0)
                onset=max(0,active-220)
                count=int(duration*44100);segment=samples[onset:onset+count]
                # Each stage gets short edge fades; overlaps are summed with headroom.
                peak=max((abs(x) for x in segment),default=1);scale=11000*weight/max(peak,1)
                at=int(start*44100)
                for i,s in enumerate(segment):
                    fade=min(1,i/130,(len(segment)-1-i)/180)
                    if at+i<len(sequence):sequence[at+i]=max(-32767,min(32767,sequence[at+i]+int(s*scale*max(0,fade))))
                stages.append({'stage':part,'at_seconds':start,'duration_seconds':duration,'relative_weight':weight,'source':str(stem.relative_to(GAME)).replace('\\','/'),'source_sha256':hashlib.sha256(stem.read_bytes()).hexdigest()})
            composed=PROD/'raw'/(key+'.assembled-v2.wav');pcm_file(composed,sequence)
            dest=sidecar.with_suffix('.mp3');normalize(composed,dest,meta['processing'])
            info=inspect_audio(dest)
            if info['peak_dbfs']>-2 or info['clipped_sample_fraction']:raise RuntimeError('Eating assembly peak guard failed: '+key)
            meta.update({'assembly_revision':'rapid-five-stems-2','prey_profile':prey,'assembly':stages,'assembled_master':str(composed.relative_to(GAME)),
                         'inspection':info,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'processing_revision':'peak-limited-3'})
            write(sidecar,meta)
    for sidecar in (GAME/'audio'/'sfx').glob('*.json'):
        meta=json.loads(sidecar.read_text(encoding='utf-8'))
        if not meta['job'].get('loop') or meta.get('loop_revision')=='wrapped-80ms-1':continue
        dest=sidecar.with_suffix('.mp3');samples=decode(dest);size=int(.08*44100)
        cross=array.array('h')
        for i in range(size):
            mix=i/(size-1)
            cross.append(int(samples[-size+i]*(1-mix)+samples[i]*mix))
        wrapped=samples[size:-size]+cross
        master=PROD/'raw'/(dest.stem+'.loop.wav');pcm_file(master,wrapped)
        subprocess.run([ffmpeg(),'-hide_banner','-loglevel','error','-y','-i',str(master),'-c:a','libmp3lame','-b:a','128k',str(dest)],capture_output=True,check=True)
        info=inspect_audio(dest)
        if info['peak_dbfs']>-2 or info['clipped_sample_fraction']:raise RuntimeError('Loop peak guard failed: '+dest.name)
        meta.update({'loop_revision':'wrapped-80ms-1','loop_crossfade_seconds':.08,'loop_master':str(master.relative_to(GAME)),
                     'inspection':info,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
        write(sidecar,meta)
    export_manifest()
    print('Finished twelve 0.9-second five-stage meals and four wrapped breath loops; listening review remains pending.')

if __name__=='__main__':
    repair_levels()
    finish()
