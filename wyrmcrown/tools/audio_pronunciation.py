"""Version an editorial pronunciation correction; previous takes retain their snapshot."""
import argparse
import datetime as dt
import sys
from audio_generate import PROD, read, write

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('term')
    parser.add_argument('ipa',help='IPA without surrounding slashes')
    parser.add_argument('--reason',required=True)
    args=parser.parse_args()
    dictionary=read('pronunciation.json')
    entry=next((e for e in dictionary['entries'] if e['term']==args.term),None)
    if entry is None:raise ValueError('Unknown term; add it to the source-grounded dictionary first')
    if entry.get('ipa')==args.ipa:return
    write(PROD/'pronunciation-history'/(dictionary['revision']+'.json'),dictionary)
    revision=int(dictionary['revision'].rsplit('-',1)[1])+1
    entry.update(ipa=args.ipa,reviewed=False,correction_reason=args.reason)
    dictionary.update(revision='dragon-wars-en-GB-'+str(revision),
        strategy='Eleven v4 native slash-delimited IPA for corrected names; documented respelling for other terms; original subtitles retained',
        updated_utc=dt.datetime.now(dt.timezone.utc).isoformat())
    write(PROD/'pronunciation.json',dictionary)
    print(dictionary['revision']+': '+args.term+' /'+args.ipa+'/; listening review pending')

if __name__=='__main__':main()
