"""Directed, faction-specific lines for systems verified in the imported game."""
import json
from pathlib import Path
from objective_dialogue import merge_objectives

GAME = Path(__file__).resolve().parents[1]
PROD = GAME / 'audio' / 'production'
FACTIONS = ['human', 'elf', 'ice', 'undead']

# event | human | elf | ice | undead. No unimplemented wizard health or night cycle.
ROWS = '''
home_early|Enemy over our fields. Keep an eye on HOME.|An intruder beneath our canopy. Attend to it.|An enemy crosses our border. Watch the walls.|Visitors in the graveyard. They seem distressingly ALIVE.
home_serious|That's OUR smoke! They're ATTACKING the TOWN!|Our grove is BURNING. Turn us HOME!|They strike our walls. Return. NOW.|They're burning the CRYPTS! Those are our PEOPLE!
home_critical|Forget the gold! We're losing HOME!|The heart of our realm is FALLING. Home. NOW!|The keep will not hold. HOME. Now!|Our stronghold is DYING. That was supposed to be THEIR job!
home_farms|They're burning the FARMS! We eat from those!|Our orchards are burning. I will take this personally.|They burn our winter stores. Make them stop.|The farms are burning. Even the dead need an economy.
home_wall|They've breached the bloody WALL!|Our walls are BROKEN. An intolerable invitation.|The wall has BROKEN. Close the breach.|A hole in the wall. A rather poor place for an open grave.
home_livestock|Not the CATTLE, you grave-rotting bastard!|They are stealing our herd. How astonishingly common.|Our cattle. Our winter. Stop the thief.|They're eating our livestock. I had plans for those BONES.
enemy_dragon|Dragon ahead. Lovely. Another enormous problem.|A rival dragon. Try to look more dignified than it.|Dragon ahead. Keep outside its breath.|A rival dragon. Such a healthy specimen. For NOW.
rival_wizard|There's the bastard in the pointy hat.|A rival mage. Proof that education has limits.|Their seer watches us. Do not drift into range.|Another wizard. Shall we compare expiry dates?
giant_spotted|Oh, for fuck's sake. A GIANT.|An unreasonable quantity of bad manners.|Giant ahead. Stay clear of its hands.|A giant. Imagine the size of the coffin.
troll_spotted|Oh Christ, I can SMELL it from here.|A troll. The landscape has made a regrettable choice.|Troll ahead. Do not let it close.|A troll. Smells almost as bad as the living.
army_approaching|That's an army. They look terribly committed.|A procession of poor decisions approaches.|Warband ahead. Strike their siege engines first.|An army approaches. A recruitment opportunity.
village_found|Village below. Roofs, taxes, and probably a pub.|A village. We may have to improve it considerably.|A village. Food and shelter, if it survives.|A village. They seem to have buried hardly anyone.
treasure_found|Treasure! At last, a sensible reason to risk my neck.|A hoard. Perhaps something here will have taste.|Treasure below. Take it, then leave.|A hoard. Wealth ages rather better than its owners.
gold_found|Gold! That's going straight towards a softer saddle.|Gold. A crude metal, but a useful argument.|Gold secured. Spend it on walls.|Gold. Still accepted after death, happily.
mine_captured|Mine's OURS. Tell the lads to watch the carts.|The mine is ours. Let others do the digging.|Mine secured. Guard the road home.|Our mine now. The skeletons will appreciate the shift work.
mine_lost|We've lost the MINE. There goes the saddle fund.|They have taken our mine. Correct this vulgarity.|Our mine is lost. Recover it.|Our mine, stolen. I shall send a strongly worded curse.
objective_found|There's something worth taking down there.|A place of power. Finally, interesting architecture.|A useful position. Clear its guardians.|An unclaimed prize. How uncharacteristically thoughtful.
objective_captured|That's OUR flag. Try not to burn it.|Our banner suits it far better.|Position secured. Hold it.|Ours. Possession is nine tenths of necromancy.
objective_stolen|They've taken our LAND. I was using that!|They have stolen our holding. The nerve.|We lost a position. Take it back.|They stole our land. Some of my favourite graves were there.
shrine_found|A shrine! Maybe the gods have finally noticed.|A shrine. At last, someone built with grace.|A shrine. We may heal beneath its ward.|A shrine. Do try not to mention my employment.
magic_nearby|Magic orb ahead. Low and slow, if you please.|A rune is waking. Approach with some elegance.|A rune ahead. Fly low to claim it.|A floating spell. Someone left the magic unattended.
powerup_collected|Oh, that's better. I can feel my eyebrows again.|A welcome improvement to an already excellent mage.|Power secured. Use it carefully.|Marvellous. I feel almost offensively vital.
health_low|We're HURT. Back to the roost before we fall off!|We are badly wounded. This is becoming inelegant.|Wounded. Return to the roost.|We're coming apart. More rapidly than usual.
energy_low|You're flagging. Let's find something with legs.|Our mount requires food. Preferably discreetly.|Energy low. Find a herd.|You need dinner. Before dinner becomes US.
starving|You're STARVING. Eat before your wings give out!|You are starving. I refuse to be stranded by appetite.|Starving. Land and feed. NOW.|Eat something! We have enough skeletons already!
breath_ready|Breath's ready. Try pointing the hot end away from me.|Your breath is ready. Make it count.|Breath restored. Choose the moment.|Breath restored. Such a charming threat to public health.
breath_empty|Nothing left in the tank. Give it a moment.|Your breath is spent. A brief silence, how refreshing.|Breath exhausted. Wait.|No breath left. Finally, something we have in common.
spell_ready|Spell ready. For once, I remembered the words.|A spell prepared. Do try to provide a worthy audience.|Spell held. Await the right moment.|A spell ready. The dead love a little surprise.
spell_failure|No spell stored. I can't cast POCKET LINT.|No spell prepared. Even brilliance requires ingredients.|No spell held. Find a rune.|No spell. I distinctly remember packing one last century.
mana_low|I'm out of MANA. Waving harder won't help.|My mana is spent. A humiliating administrative detail.|Mana spent. Allow it to return.|No mana. I shall have to be unpleasant manually.
successful_hit|Got you! That'll teach you to be over THERE.|A direct hit. Quite predictable, really.|Hit confirmed. Again.|A fine hit. Shall I reserve a grave?
huge_hit|Oh, that was a BEAUTY!|A devastating demonstration of taste.|A hard strike. Finish them.|Splendid. That rearranged several important organs.
missed_shot|Missed. The wind clearly has a grudge.|A warning shot. Obviously.|Missed. Correct your aim.|Missed. A temporary extension of their lease.
enemy_troops_killed|That's their lot sorted.|Their soldiers have been excused from further embarrassment.|Enemy soldiers down.|More volunteers for the night shift.
defence_destroyed|Tower's down. Mind the falling bits!|A defence removed. The skyline improves.|Defence destroyed. Press forward.|Their defences have joined the departed.
catapult_destroyed|Catapult's gone. No more bloody flying masonry!|The catapult is ruined. An overdue architectural correction.|Siege engine destroyed.|Their catapult is dead. A surprisingly large corpse.
castle_wall_broken|Wall's OPEN! Get through before they notice!|A breach. Enter before they recover their manners.|Wall breached. Advance.|An opening in the wall. How hospitable.
enemy_retreating|They're running! I knew they had sense somewhere.|They retreat. At last, an intelligent decision.|They withdraw. Watch for a trap.|They're leaving. Some people never stay for the funeral.
player_retreating|We're leaving. Call it a tactical appointment elsewhere.|We withdraw. Dignity requires occasional distance.|Withdraw. Live to strike again.|A tactical retreat. Being dead once was quite sufficient.
returning_home|Home ahead. Please land like you MEAN it.|Home. Let us arrive with a little grace.|Home in sight. Rest at the roost.|Home. The old familiar absence of a pulse.
enemy_territory|Enemy land. Nobody here likes our faces.|Their territory. This explains the appalling scenery.|Enemy ground. Stay alert.|Foreign graves. Best not disturb them. Yet.
leaving_territory|Across the border. Mind whose sheep you eat.|Beyond our realm. The standards fall immediately.|We cross the border. Keep your bearing.|Leaving home. I do hope the corpses behave.
storm|Storm coming. LOW, before the sky cooks us!|Thunderheads. Fly low; lightning has no respect for breeding.|Storm overhead. Below the clouds. NOW.|Lightning. A dreadful way to become briefly illuminated.
victory|The crown's OURS! Someone find me a DRINK!|The Wyrmcrown is ours. A natural conclusion.|The crown is won. Let the realm rest.|Victory! I knew patience would outlive the competition.
near_defeat|We're nearly finished. HOME, before we're homeless!|We stand near ruin. I will not end as a footnote.|Defeat approaches. Defend the keep.|Defeat is close. I am not ready for a second obituary.
faction_eliminated|One realm down. Three fewer people shouting at me.|A rival realm has fallen. Order gradually returns.|A rival falls. The war is not over.|Another realm deceased. I shall send flowers. Dead ones.
ward_down|Their WARD is down! Hit the keep while we can!|Their ward has fallen. An exquisitely brief opportunity.|Ward broken. Strike the stronghold.|Their ward is dead. Go and introduce the keep.
cart_lost|They've smashed our GOLD CART!|Our gold cart is lost. An expensive lapse in etiquette.|Cart destroyed. The road is not safe.|A gold cart lost. Even death is cheaper than this.
waygate|Hold tight. I hate the bit where my stomach arrives last.|A waygate. Try to keep your luggage and limbs together.|Through the gate. Hold steady.|A waygate. Last time it left my jaw in the other realm.
roost_recovery|Back in the air! This time, less falling.|We take wing again. Let us erase the previous impression.|Recovered. Take wing.|Back again. Death remains disappointingly temporary.
raised_dead|Those troops are getting back UP. That's cheating!|The fallen rise. A vulgar disregard for the conclusion.|The dead rise. Burn them again.|Up you get, everyone. Retirement is CANCELLED.
'''

TRAVEL = {
    'human': ["Was that cow judging my hat?", "My arse has sent a formal complaint.", "If we go much higher, I'm charging the clouds rent.", "That village smells of bread. Don't you dare set it on fire.", "The forest looks peaceful. Suspicious, isn't it?", "I packed a sandwich. You ate the BAG.", "I became a wizard to avoid walking. Nobody mentioned this.", "Lovely mountains. Horrible place to drop a boot.", "You smell of smoke and questionable decisions.", "I could murder a pint. Preferably without actual murder."],
    'elf': ["The clouds have arranged themselves rather poorly.", "That village is entirely the wrong shade of brown.", "Do stop flapping so loudly. I am thinking.", "The view improves when one ignores the inhabitants.", "There is mud on my robe. From the SKY.", "A forest with no discernible symmetry. How provincial.", "I have seen more graceful landings from acorns.", "The saddle was clearly designed by someone with no spine.", "Our enemies have confused quantity with civilisation.", "I do hope that smell belongs to someone beneath us."],
    'ice': ["Snow ahead. Familiar ground.", "The mountains were here before their kingdoms.", "A quiet sky. Keep it that way.", "I can no longer feel my fingers. This is acceptable.", "The southern air is offensively warm.", "Do not waste strength fighting the wind.", "The cattle look well fed. A sound strategic resource.", "They built their village in a floodplain. A short history awaits.", "Clouds above. Stones below. Mind both.", "If you shed frost on my collar again, I will walk."],
    'undead': ["That graveyard looks positively overcrowded. Lovely.", "A beautiful day to have no circulation.", "I miss being hungry. It made the evenings simpler.", "Those villagers wave so cheerfully. They have time yet.", "I once owned a forest like that. Then it caught mortality.", "If my leg falls off, circle back. It's the good one.", "The smell of spring. Distressingly biological.", "I remember this road. Several of its travellers owe me bones.", "Do we have to fly? My knees were buried very comfortably.", "Another ruined tower. Property prices never recover."],
}
GIANTS = {
    'human': ["Don't fly near his HANDS!", "He's throwing ROCKS!", "Hit the KNEES. They're practically a postcode.", "I think he's looking at us. I wish he wouldn't.", "That is an unreasonable amount of man."],
    'elf': ["A giant. Nature has confused scale with quality.", "Avoid those HANDS. They have never seen soap.", "He's throwing rocks. An unimaginative conversationalist.", "Strike the knees. We can lower his expectations.", "He appears to be thinking. We have several minutes."],
    'ice': ["Hands wide. Keep above the reach.", "Rock incoming. BANK.", "Strike the knees. Weight is his weakness.", "A giant blocks the pass. Make room.", "Large lungs. Small judgment."],
    'undead': ["Look at those bones. It's practically a cathedral.", "Mind his hands. I only recently reattached mine.", "A flying rock. How delightfully prehistoric.", "Break the knees. I shall inventory the rest.", "Does he know he's mortal? Best remind him."],
}
TROLLS = {
    'human': ["Don't let it LICK you.", "It's eating the fence. We paid for that fence.", "That's either a troll or a catastrophic cheese.", "Why does it have TWO clubs? One looked quite sufficient."],
    'elf': ["A troll. Even the flies appear offended.", "Keep its saliva off my dragon.", "It has eaten the fence. At least the view is consistent.", "Two clubs. A redundant substitute for one thought."],
    'ice': ["Wet tracks. Troll close.", "Keep beyond the club. Do not hover.", "Its stench carries on the wind. Approach from above.", "It ate the fence. Perhaps the gate will distract it."],
    'undead': ["The smell! And I share a crypt with six uncles.", "Do not let it lick me. I am not a preserved delicacy.", "It eats wood. At last, someone with a worse diet.", "Two clubs. A remarkably ambitious idiot."],
}
DRAGONS = {
    'human': [('travel',"The little village smells of DINNER."),('travel',"More fire. Fewer instructions."),('eating_reaction',"That bull had OPINIONS."),('eating_reaction',"A snack. Bring me the herd."),('health_low',"My blood belongs INSIDE me."),('enemy_dragon',"Come closer. I prefer my rivals ROASTED."),('victory',"MY crown. MY sky. Where is dinner?"),('breath_ready',"Let them see what FIRE means.")],
    'elf': [('travel',"The view would improve without the screaming."),('travel',"Try to sit as elegantly as I fly."),('eating_reaction',"Acceptable. For livestock."),('eating_reaction',"An unfortunate vintage."),('health_low',"That was my FAVOURITE scale."),('enemy_dragon',"Such noisy wings. Such little consequence."),('victory',"The crown finally has a suitable owner."),('breath_ready',"I can make this forest their LAST sight.")],
    'ice': [('travel',"This mountain was SMALL when I hatched."),('travel',"The wind remembers me."),('eating_reaction',"Brief... but adequate."),('eating_reaction',"A warm morsel. A rare kindness."),('health_low',"Even glaciers... can BREAK."),('enemy_dragon',"I have outlived... louder creatures."),('victory',"Let the long winter... end."),('breath_ready',"Their blood... will grow STILL.")],
    'undead': [('travel',"The dead below... recognise my shadow."),('travel',"You breathe rather loudly, for a rider."),('eating_reaction',"Fresh meat. A SHORT appointment."),('eating_reaction',"It tasted... almost alive."),('health_low',"That rib... was structural."),('enemy_dragon',"I wonder... which bones you will leave me."),('victory',"All their kingdoms... fit beneath the earth."),('breath_ready',"Let them borrow... my last breath.")],
}
BANTER = {
    'human': [("Did you have to do that BESIDE me?","You were beside DINNER."),("Please stop burning the signposts.","Then stop asking for DIRECTIONS.")],
    'elf': [("You have drooled on my robe.","Then your robe has finally acquired CHARACTER."),("Try to look a little less pleased.","Try to be a little less EDIBLE.")],
    'ice': [("That was our last cow.","Then it was... a historic meal."),("You are shedding frost on me.","You wished... to remain COOL.")],
    'undead': [("You swallowed the bell as well.","I prefer... a ringing endorsement."),("Those bones were part of the scenery.","Then the scenery... has improved.")],
}
HOME_VARIATIONS = {
 'home_early': [
  ["Enemy dragon near HOME. Keep watching those walls.","There are strangers over our lands. Uninvited ones.","Our border is crossed. Prepare to return.","Someone alive is lurking near home. A worrying development."],
  ["Something's moving over our farms. That had better be a bird.","An enemy beneath our branches. Their final poor decision, perhaps.","A shadow near the keep. Watch it.","Intruders among our graves. I haven't even set the table."]],
 'home_serious': [
  ["The bastards are in the TOWN! Turn us around!","They're striking our HOME! Attend to the intrusion!","Our town is under attack. Return before it breaks.","They're attacking our HOME! How unnecessarily lively!"],
  ["Those are OUR roofs burning! HOME. Now!","Our people are beneath those flames. Fly HOME!","Our defences are taking blows. We are needed.","Our crypts are under attack! I have FAMILY in there!"]],
 'home_critical': [
  ["The KEEP is nearly gone! HOME. NOW!","Our stronghold is failing! There is no time for elegance!","The keep is breaking. TURN. NOW.","They're about to finish our stronghold! I want them DEAD first!"],
  ["We're about to lose the whole bloody TOWN!","The realm is on the edge of RUIN. Get us home!","One more assault may end the realm. HOME.","If that keep falls, we're all HISTORY. Again!"]],
 'home_livestock': [
  ["They're eating OUR dinner!","Our cattle are being stolen. Such tiresome greed.","They steal our winter herd. Stop them.","Those bones belong to US! Get the livestock thief!"],
  ["Leave our bloody SHEEP alone!","Our herd is under attack. Attend to it.","Our food is being taken. Defend the pasture.","They're stealing the cattle. That is an unlicensed exhumation!"]],
}

def build():
    jobs=[]
    urgent={'home_early','home_serious','home_critical','home_farms','home_wall','home_livestock','health_low','starving','storm','near_defeat'}
    styles={'human':'earthy conversational British voice','elf':'refined articulate dry voice','ice':'low restrained severe voice','undead':'ancient dry rasp, oddly cheerful'}
    def add(faction,role,event,line,number=1,pair=None):
        if faction=='ice' and role=='wizard' and event=='raised_dead':line='The dead rise. BREAK them again.'
        danger=event in urgent
        tag=('urgent' if danger else 'dry, sarcastic' if event in {'travel','troll_spotted','giant_spotted','banter','eating_reaction'} else 'focused')
        if role=='dragon': tag+='; huge resonant chest, clear consonants, physical breath'
        else: tag+='; '+styles[faction]
        if faction=='ice' and not danger: tag+='; measured, controlled breath'
        emphasis=[w for w in line.split() if len(w.strip('.,!?'))>1 and w.strip('.,!?').isupper()]
        synthesis='['+tag+'] '+line
        if faction=='human' and role=='wizard' and event=='home_livestock' and number==1:
            synthesis='[shocked] Not the [angry, shouting] CATTLE... [furious] you grave-rotting bastard!'
            tag+='; shocked opening, stress CATTLE, short incredulous pause, furious insult'
        if faction=='elf' and role=='dragon' and event=='eating_reaction' and number==1:
            synthesis='[disdainful, dry] Acceptable... [dry] For LIVESTOCK.'
            tag+='; say Acceptable once, brief pause, contempt lands on livestock'
        if faction=='ice' and role=='dragon' and event not in {'health_low','breath_ready'}:
            synthesis='[deep, measured] '+line.replace('... ', ', ').replace('...', '')
            tag+='; one deliberate reading, controlled pauses, no repeated phrase'
        if faction=='undead' and role=='dragon' and (event=='travel' and number==1 or event in {'eating_reaction','banter'} and number==2):
            synthesis='[deep, dry] '+line.replace('... ', ', ').replace('...', '')
            tag+='; one dry reading, end cleanly without a repeated phrase'
        if faction=='ice' and role=='wizard' and event=='giant_spotted' and number==3:
            synthesis='[urgent] Rock incoming. [shouting] BANK!'
            tag+='; sharp warning, say each phrase once, stress BANK'
        jobs.append({'id':f'{faction}_{role}_{event}_{number:02}', 'kind':'dialogue','character':f'{faction}_{role}','event':event,'text':line,
                     'synthesis_text':synthesis,'performance':f'{tag}. '+('Stress '+', '.join(emphasis)+'. ' if emphasis else 'Natural phrase stress. ')+
                     ('Warning takes priority; speak promptly, urgency grows without losing diction.' if danger else 'Keep punctuation pauses; let the last comic word land dryly. Do not overplay.'),
                     'pair':pair,'review':'pending'})
    for row in ROWS.strip().splitlines():
        event,*lines=row.split('|')
        for fk,line in zip(FACTIONS,lines): add(fk,'wizard',event,line)
    for event,variations in HOME_VARIATIONS.items():
        for number,lines in enumerate(variations,2):
            for fk,line in zip(FACTIONS,lines):add(fk,'wizard',event,line,number)
    for fk in FACTIONS:
        for event,extra in [('travel',TRAVEL[fk]),('giant_spotted',GIANTS[fk]),('troll_spotted',TROLLS[fk])]:
            for i,line in enumerate(extra,2): add(fk,'wizard',event,line,i)
        counts={}
        for event,line in DRAGONS[fk]:
            counts[event]=counts.get(event,0)+1
            add(fk,'dragon',event,line,counts[event])
        for i,(wizard,dragon) in enumerate(BANTER[fk],1):
            pair=f'{fk}_banter_{i}'
            add(fk,'wizard','banter',wizard,i,pair)
            add(fk,'dragon','banter',dragon,i,pair)
    jobs=merge_objectives(jobs)
    PROD.mkdir(parents=True,exist_ok=True)
    (PROD/'dialogue-jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (GAME/'data'/'dialogue.js').write_text("'use strict';\nwindow.AS.Data.dialogue = "+json.dumps(jobs,ensure_ascii=False)+";\n",encoding='utf-8')
    print(f'Prepared {len(jobs)} directed dialogue lines; bulk generation remains gated on casting.')

if __name__=='__main__': build()
