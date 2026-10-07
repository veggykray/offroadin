"""ElevenLabs transcript checks assist intelligibility review; they do not hear acting."""
import argparse
import difflib
import json
import os
import re
import time
import urllib.error
import urllib.request
import uuid
import sys
from audio_generate import GAME, PROD, read, write

def transcribe(path):
    boundary='dragon-wars-'+uuid.uuid4().hex
    fields={'model_id':'scribe_v2','language_code':'eng','tag_audio_events':'true','diarize':'false'}
    pieces=[]
    for name,value in fields.items():
        pieces.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    pieces.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode()+path.read_bytes()+b'\r\n')
    pieces.append(f'--{boundary}--\r\n'.encode())
    req=urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text',data=b''.join(pieces),headers={'xi-api-key':os.environ['ELEVENLABS_API_KEY'],'Content-Type':'multipart/form-data; boundary='+boundary})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req,timeout=120) as response:return json.loads(response.read())
        except urllib.error.HTTPError as error:
            if error.code==429 and attempt<3:time.sleep(15*(attempt+1));continue
            raise RuntimeError(f'Transcription HTTP {error.code}: '+error.read().decode()[:400]) from None

def tokens(text):
    text=re.sub(r'\[[^]]*\]','',text.lower()).replace('’',"'")
    contractions={"we're":"we are","they're":"they are","you're":"you are","that's":"that is","it's":"it is","i'm":"i am","i've":"i have","don't":"do not","can't":"cannot","won't":"will not","we'll":"we will","they'll":"they will"}
    for phrase,expanded in contractions.items():text=text.replace(phrase,expanded)
    text=text.replace('cannot','can not')
    text=re.sub(r"([a-z])'s\b",r'\1s',text)
    numbers=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty']
    def number_words(value):
        n=int(value)
        if n<=20:return numbers[n]
        if n<100:
            tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
            return tens[n//10]+(' '+numbers[n%10] if n%10 else '')
        if n<1000:return numbers[n//100]+' hundred'+(' and '+number_words(n%100) if n%100 else '')
        return value
    text=text.replace('%',' percent ')
    text=re.sub(r'\b\d+\b',lambda m:number_words(m[0]),text)
    # Transcribers freely alternate "150", "a hundred and fifty" and
    # "one hundred fifty". Compare the quantity rather than its typography.
    text=re.sub(r'\b(?:a|one) hundred\b','hundred',text)
    text=re.sub(r'\bhundred and\b','hundred',text)
    variants={'defence':'defense','defences':'defenses','favourite':'favorite','judgement':'judgment','grey':'gray','recognise':'recognize','realise':'realize','colour':'color','honour':'honor','marvellous':'marvelous','cancelled':'canceled','arse':'ass','hoard':'horde'}
    variants.update(civilisation='civilization',travellers='travelers')
    return [variants.get(word,word) for word in re.findall(r'[a-z]+',text)]

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--names-only',action='store_true')
    parser.add_argument('--kind',choices=['audition','dialogue'],default='audition')
    parser.add_argument('--only',help='ID substring')
    parser.add_argument('--limit',type=int)
    parser.add_argument('--quiet',action='store_true',help='Print only flags and completion')
    args=parser.parse_args()
    dictionary=read('pronunciation.json')
    excluded=set(w for entry in dictionary['entries'] for w in tokens(entry['term'])+tokens(entry['spoken_alias']))
    results=[]
    folder='auditions' if args.kind=='audition' else 'voice'
    count=0
    for sidecar in sorted((GAME/'audio'/folder).glob('*.json')):
        if args.names_only and '_3_take' not in sidecar.stem:continue
        if args.only and args.only not in sidecar.stem:continue
        if args.limit and count>=args.limit:break
        count+=1
        meta=json.loads(sidecar.read_text(encoding='utf-8'));dest=PROD/'transcripts'/(sidecar.stem+'.json')
        response=json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else transcribe(sidecar.with_suffix('.mp3'))
        write(dest,response)
        expected=[t for t in tokens(meta['job']['text']) if t not in excluded]
        heard=[t for t in tokens(response.get('text','')) if t not in excluded]
        score=round(difflib.SequenceMatcher(None,expected,heard).ratio(),3)
        status='text_consistency_check_passed' if score>=.9 else 'manual_review_required'
        meta['transcript_check']={'model_id':'scribe_v2','file':str(dest.relative_to(GAME)).replace('\\','/'),'word_similarity_excluding_names':score,'status':status,
                                  'limitation':'Transcripts do not establish pronunciation, accent, emotion, comic timing or physical scale.'}
        write(sidecar,meta)
        results.append({'id':meta['job']['id'],'take':sidecar.stem,'expected':meta['job']['text'],'transcript':response.get('text',''),'word_similarity':score,'status':status})
        if not args.quiet or status=='manual_review_required':print(sidecar.stem+' '+str(score)+' '+response.get('text',''),flush=True)
    report='transcript-review.json' if args.kind=='audition' else 'dialogue-transcript-review'+('-'+args.only if args.only else '')+'.json'
    write(PROD/report,results)
    print(f'Inspected {len(results)} {args.kind} transcripts. Acting and pronunciation listening review still pending.',flush=True)

if __name__=='__main__':main()
