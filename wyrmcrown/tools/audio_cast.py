"""Apply human listening choices to the exact existing audition candidates."""
import argparse
import json
from pathlib import Path
from audio_generate import PROD, export_manifest, read, write

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('review',type=Path,help='Review JSON exported from the local audition page')
    args=parser.parse_args()
    review=json.loads(args.review.read_text(encoding='utf-8-sig'))
    cast=read('cast.json')
    chosen=[]
    for key, character in cast['characters'].items():
        choice=review.get('choices',{}).get(key,{})
        candidate=next((c for c in character['candidates'] if c['key']==choice.get('candidate')),None)
        if not candidate:
            raise ValueError(f'{key}: select a candidate after listening')
        chosen.append(candidate['voice_id'])
    if len(set(chosen))!=8: raise ValueError('Eight distinct voice IDs are required')
    for key, character in cast['characters'].items():
        choice=review['choices'][key]
        candidate=next(c for c in character['candidates'] if c['key']==choice['candidate'])
        character.update({'selected_candidate':candidate['key'],'voice_id':candidate['voice_id'],'approved':True,
                          'audition_review':{'notes':choice.get('notes','').strip() or 'User selected this candidate after audition review; no correction notes supplied.',
                                            'reviewed_at':review.get('reviewed_at'),'source':'human listening review'}})
    cast['status']='casting_approved'
    write(PROD/'cast.json',cast)
    export_manifest()
    print('Locked eight reviewed voice IDs and their existing settings. Bulk dialogue is now available.')

if __name__=='__main__': main()
