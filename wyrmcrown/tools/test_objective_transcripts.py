"""Verify cached objective transcripts, including mechanically significant quantities."""
import json
from audio_generate import PROD
from audio_transcribe import tokens

report = json.loads((PROD / 'dialogue-transcript-review-capture_reward_.json').read_text(encoding='utf-8'))
checks = {
    'village': ['two'], 'crystal': ['hundred'], 'relic': ['hundred ten'],
    'fort': ['four', 'three'], 'castle': ['four'], 'bridge': ['fifteen percent'],
    'cave': ['two hundred twenty'], 'ruins': ['hundred fifty'],
}
assert len(report) == 68
assert len({v['id'] for v in report}) == 68
for entry in report:
    assert entry['status'] == 'text_consistency_check_passed', entry
    kind = entry['id'].split('capture_reward_')[1].rsplit('_', 1)[0]
    heard = ' '.join(tokens(entry['transcript']))
    for phrase in checks.get(kind, []):
        assert phrase in heard, (entry['id'], phrase, entry['transcript'])
print(f'PASS {len(report)} objective transcripts and reward quantities; minimum word similarity {min(v["word_similarity"] for v in report)}. Listening review remains separate.')
