"""Capture reward dialogue grounded in sites.js, faction.js and fog reveal.

Append without changing existing directed/retaken lines. Running this script
again is free and idempotent; audio_generate.py creates the paid recordings.
"""
import json
from pathlib import Path

GAME = Path(__file__).resolve().parents[1]
PROD = GAME / 'audio' / 'production'
FACTIONS = ['human', 'elf', 'ice', 'undead']

# kind | speaker | human | elf | ice | undead
# staff, crown and nest passive stats are declared in data but their aggregator
# has no gameplay callers in this version. Do not promise those unused bonuses.
ROWS = '''
goldmine|wizard|Mine captured! More gold coming home by cart. Guard the road; I've expensive habits.|The mine is ours. Gold carts will supply our treasury. Keep the road fit for civilised commerce.|Mine secured. Gold travels home by cart. Protect the deliveries.|Our mine now. Gold carts for the treasury. Even the dead have running expenses.
village|dragon|Our village. Taxes by cart, room for two more troops, and a herd for my dinner.|A village claimed. Taxes, two more places in our army, and livestock. Finally, useful neighbours.|Village secured. Taxes by cart. Capacity for two more troops. A herd to feed us.|Our village. Taxes, two more troop places, and a herd. Such generous future skeletons.
tradepost|wizard|Trade post captured! More coin comes home by caravan. Keep those merchants alive; they're carrying my wages.|Our trade post. Its caravans bring gold home. Protect them; commerce requires a little taste.|Trade post secured. Gold caravans for our town. Guard their route.|The trade post is ours. Gold caravans for home. A splendid business with unusually living staff.
wizardtower|wizard|Tower captured! It fires magic at enemies and lets us see the surrounding land. Useful neighbours, for once.|Our wizard tower. Magic to repel intruders, and a clearer view of the surrounding land. Quite acceptable.|Wizard tower secured. Magical fire against enemies. Vision across the surrounding ground.|Our tower now. It shoots magic at enemies and reveals nearby land. A delightfully hostile landlord.
magicwell|dragon|Our magic well. Stay close and it heals my wounds and restores my mana. I could get used to this.|The well is ours. Nearby, my wounds heal and my mana returns. A suitably refined drinking spot.|Well secured. Stay nearby. Wounds heal. Mana returns. Then we strike again.|Our well. It heals my wounds and restores mana nearby. Quite an improvement on swamp water.
grove|dragon|Grove claimed. My energy comes back while we're close. Let me catch my breath before your next brilliant idea.|Our enchanted grove. My energy returns nearby. Even perfection occasionally requires a rest.|Grove secured. Stay close to restore my energy. Strength before the next flight.|The grove is ours. My energy returns nearby. The trees seem surprisingly unconcerned about me.
crystal|wizard|Crystal captured! A Lightning Storm charge every hundred seconds, if we're holding no other spell. Lovely weather for our enemies.|Our crystal. A Lightning Storm charge every hundred seconds, provided we hold no different spell. Elegance from above.|Crystal secured. A Lightning Storm charge every hundred seconds. Keep the spell slot free of other spells.|Our crystal. A Lightning Storm charge every hundred seconds, if no other spell occupies the slot. A bright future for corpses.
relic|wizard|Relic captured! A Call the Host charge every hundred and ten seconds, if we're holding no other spell. More lads for the fight.|Our relic. A Call the Host charge every hundred and ten seconds, unless we hold another spell. Reinforcements, with purpose.|Relic secured. Call the Host gains a charge every hundred and ten seconds. Keep other spells out of the slot.|Our relic. A Call the Host charge every hundred and ten seconds, if no other spell fills the slot. More company for the war.
fort|wizard|Fort captured! Four guards, arrow defences, and capacity for three more troops. Finally, somewhere that shoots back for us.|Our fort. Four guards, defensive arrows, and three extra troop places. A respectable answer to unwanted guests.|Fort secured. Four guards. Arrow defences. Capacity for three more troops. Hold this ground.|Our fort. Four guards, arrow defences, and three extra troop places. A most accommodating address for violence.
castle|wizard|Castle captured! Gold carts, four guards, strong defences, and room for four more troops. That's a proper prize!|Our castle. Gold deliveries, four guards, strong defences, and four extra troop places. At last, suitable accommodation.|Castle secured. Gold carts. Four guards and strong defences. Capacity for four more troops.|Our castle. Gold carts, four guards, strong defences, and four extra troop places. Plenty of room for the departed.
bridge|wizard|Bridge captured! Enemy gold carts passing through pay us fifteen percent, and the tower shoots at foes. Lovely little earner.|Our bridge. Fifteen percent from passing enemy gold carts, with a tower to discourage complaints. A civilised toll.|Bridge secured. Fifteen percent from passing enemy gold carts. The tower covers the crossing.|Our bridge. Passing enemy gold carts pay fifteen percent. The tower shoots at foes. Death and taxes, beautifully combined.
shrine|dragon|Our shrine. Stay nearby and my wounds heal. It also reveals the surrounding land. The gods have finally made themselves useful.|Our shrine. Healing for me nearby, and a wider view of the land. A place with remarkably good manners.|Shrine secured. Healing nearby. Wider vision across the land. Rest here, and watch the approaches.|Our shrine. Nearby healing for my wounds, and a view of the surrounding land. Apparently, the gods do house calls.
cave|dragon|The cave hoard is open. Two hundred and twenty gold on the ground. Scoop it up; admiring it pays for nothing.|The cave yields two hundred and twenty gold. Collect the coins from the ground. We have standards, and expenses.|Cave cleared. Two hundred and twenty gold lies below. Collect the coins before we leave.|The cave has yielded two hundred and twenty gold. Collect the coins. Their previous owner has stopped objecting.
nest|dragon|Eyrie claimed. We can see the surrounding land from here. A proper perch for keeping an eye on trouble.|My eyrie. We gain a view of the surrounding land. At last, a perch worthy of the scenery.|Eyrie secured. The surrounding land is visible to us. Watch for movement below.|Our eyrie. The nearby land is revealed. A fine place to watch things become less alive.
watchtower|wizard|Watchtower captured! It reveals a wide stretch of land. We can spot trouble before it arrives at the bloody doorstep.|Our watchtower. A wide stretch of land revealed. We may now judge our neighbours from a sensible distance.|Watchtower secured. Wide vision across the land. See the next attack coming.|Our watchtower. A wide stretch of land revealed. So many places for future graves.
waygate|wizard|Waygate captured! Own another and we can travel between them. Press E at an owned gate. Saves my backside some flying.|Our waygate. Claim a second for travel between them. Press E at an owned gate. A more dignified journey.|Waygate secured. Own two to travel between them. Press E at an owned gate.|Our waygate. Own another to travel between them. Press E at an owned gate. Saves wear on the remaining joints.
ruins|wizard|Ruins cleared! A hundred and fifty gold to scoop up, and sometimes a magic orb. Keep your eyes on the ground.|The ruins yield a hundred and fifty gold to collect. Sometimes, a magic orb as well. Salvage can have its merits.|Ruins cleared. Collect a hundred and fifty gold. A magic orb may appear too.|Ruins cleared! A hundred and fifty gold to collect, sometimes a magic orb. The deceased have left a decent tip.
'''


def objective_jobs():
    jobs = []
    for row in ROWS.strip().splitlines():
        kind, role, *lines = row.split('|')
        assert len(lines) == 4, kind
        for faction, text in zip(FACTIONS, lines):
            tag = 'focused' if role == 'wizard' else 'deep, measured'
            jobs.append({
                'id': f'{faction}_{role}_capture_reward_{kind}_01',
                'kind': 'dialogue', 'character': f'{faction}_{role}',
                'event': f'capture_reward_{kind}', 'objective_kind': kind,
                'text': text, 'synthesis_text': f'[{tag}] {text}',
                'performance': 'Explain the benefit clearly in the established character voice. '
                    'One deliberate reading, natural pauses, no repeated words. '
                    + ('Large resonant chest; clear consonants. ' if role == 'dragon' else '')
                    + ('Restrained, precise delivery.' if faction == 'ice' else 'Let the final dry remark land naturally.'),
                'pair': None, 'review': 'pending',
                'reward_source': 'Active mechanics in sites.js, faction.js and factions.js',
            })
    return jobs


def merge_objectives(jobs):
    # Retake directions have already been edited in the production catalog.
    # Preserve them when rebuilding unchanged dialogue from the older base script.
    target = PROD / 'dialogue-jobs.json'
    saved = {j['id']: j for j in json.loads(target.read_text(encoding='utf-8'))} if target.exists() else {}
    combined = [j for j in jobs if not j['event'].startswith('capture_reward_')] + objective_jobs()
    return [saved[j['id']] if j['id'] in saved and saved[j['id']]['text'] == j['text'] else j for j in combined]


def save(jobs):
    PROD.mkdir(parents=True, exist_ok=True)
    (PROD / 'dialogue-jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (GAME / 'data' / 'dialogue.js').write_text("'use strict';\nwindow.AS.Data.dialogue = " + json.dumps(jobs, ensure_ascii=False) + ';\n', encoding='utf-8')


if __name__ == '__main__':
    current = json.loads((PROD / 'dialogue-jobs.json').read_text(encoding='utf-8'))
    merged = merge_objectives(current)
    save(merged)
    print(f'Prepared {len(objective_jobs())} objective reward lines; {len(merged)} dialogue lines total. Existing lines preserved.')
