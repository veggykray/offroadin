"""Build the source-grounded production manifest; never generate sound here."""
import json
import re
from pathlib import Path

GAME = Path(__file__).resolve().parents[1]
PROD = GAME / "audio" / "production"


def save(name, value):
    PROD.mkdir(parents=True, exist_ok=True)
    (PROD / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build():
    cast = {
        "human_wizard": ("Magister Aldric", "Earthy British tavern veteran; sarcasm, worry, heroic urgency. No grand Shakespeare delivery.", [("Julian", "7p1Ofvcwsv7UBPoFNcpI"), ("Peter", "BH9MXBxDsBzwMiouIxpj")], .45),
        "elf_wizard": ("Archmage Ilythiel", "Refined, articulate, arrogant, slightly androgynous. Dry contempt; beautiful diction.", [("Lily", "pFZP5JQG7iQjIQuC4Bku"), ("Alice", "Xb7hH8MSUJpSbSDYk0k2")], .5),
        "ice_wizard": ("Frost-Seer Ymra", "Deep, severe, restrained northern remoteness. Calm threats; fear cracks through only in real danger.", [("Ariana", "ApmTlGpFys2ypvx59okX"), ("Charlotte", "WKWX31A0Kkv2Y4CQRsll")], .65),
        "undead_wizard": ("Lich-Lord Malkhar", "Ancient dry rasp; unsettling cheer. Death is routine and funny. Every consonant remains clear.", [("Declan", "1BfrkuYXmEwp8AWqSLWk"), ("Grimblewood", "ouL9IsyrSnUkCmfnD02u")], .5),
        "human_dragon": ("Pyrrhax", "Huge booming chest, aggression, hunger, relish. Physical throat and breath, intelligible speech.", [("Smoke the Dragon", "xsiB5fGhEtknnqzudCO6"), ("Harry", "SOYHLrjzK2X1ezoPC6cr")], .5),
        "elf_dragon": ("Verdanthe", "Enormous but swift, elegant, proud and intelligent. Quick sarcastic precision; open resonant chest.", [("Callum", "N2lVS1w4EtoT3dr4eOWO"), ("River", "SAz9YHcvj6GT2YYXdXww")], .5),
        "ice_dragon": ("Skaldfrost", "Ancient glacier-scale chest resonance. Slow controlled breath; tectonic weight, clear consonants.", [("Victor", "cPoqAvGWCPfCfyPMwe4z"), ("Brian", "nPczCjzI2devNBz1zQrb")], .65),
        "undead_dragon": ("Vorthrax", "Hollow ancient creature, dry breath, sparse throat rattle, macabre wit. Speech stays intelligible.", [("Gravel Midnight", "M5E055lOUxMi0kJpGyE9"), ("Bill", "pqHfZKP75CvOlQylNhV4")], .5),
    }
    voices = {}
    for key, (name, direction, candidates, stability) in cast.items():
        voices[key] = {"character": name, "direction": direction, "approved": False, "selected_candidate": None,
                       "audition_review": None, "model_id": "eleven_v4", "output_format": "mp3_44100_128",
                       "voice_settings": {"stability": stability, "similarity_boost": .82},
                       "processing": {"highpass_hz": 55 if "wizard" in key else 35, "integrated_lufs": -18, "true_peak_db": -2,
                                      "pitch_shift": 0, "speech_rate": 1, "reverb": False,
                                      "post_limiter": {"limit": .45, "auto_level": False, "attack_ms": 5, "release_ms": 50}},
                       "candidates": [{"key": str(i + 1), "name": n, "voice_id": v} for i, (n, v) in enumerate(candidates)]}
    if not (PROD / "cast.json").exists():
        save("cast.json", {"schema_version": 1, "status": "awaiting_audition_review", "characters": voices})

    readings = {
        "Wyrmcrown": "WERM crown", "Aldermere": "AWL der meer", "Aldric": "AWL drik", "Pyrrhax": "PEER aks",
        "Sylvara": "sil VAH rah", "Sylvaran": "sil VAH ran", "Sylvari": "sil VAH ree", "Ilythiel": "ih LITH ee el",
        "Verdanthe": "ver DANTH", "Hrimgard": "HRIM gard", "Hrimfolk": "HRIM foke", "Ymra": "IM rah",
        "Skaldfrost": "SKALD frost", "Morgrave": "MOR grayv", "Malkhar": "MAL kar", "Vorthrax": "VOR thraks",
        "Magister": "MAJ iss ter", "Lich": "litch", "Eyrie": "EER ee", "Ossuary": "OSS yoo air ee",
        "Ilm": "ilm", "Frostspine": "FROST spine", "Rimecrag": "RIME crag", "Moonbower": "MOON bow er",
        "Waygate": "WAY gate", "Wardstone": "WARD stone", "Necrotic": "neh KROT ik", "Verdant": "VER dant",
    }
    names = set()
    for file in [GAME / "data" / "factions.js", GAME / "data" / "sites.js", *sorted((GAME / "maps").glob("map*.js"))]:
        names.update(re.findall(r"(?:name|title):\s*['\"]([^'\"]+)['\"]", file.read_text(encoding="utf-8")))
    pronunciation = {"revision": "dragon-wars-en-GB-1", "language": "en-GB", "status": "editorial_readings_awaiting_listening_review",
                     "source": "data/factions.js, data/sites.js and maps/map01.js through map10.js",
                     "dictionary_locators": [], "strategy": "case-insensitive whole-word respelling in synthesis text; original text retained for subtitles",
                     "entries": [{"term": term, "spoken_alias": alias, "basis": "English spelling and faction context; no canonical phonetics supplied", "reviewed": False}
                                 for term, alias in readings.items()],
                     "place_name_inventory": sorted(names)}
    if not (PROD / "pronunciation.json").exists():
        save("pronunciation.json", pronunciation)

    # Three separate takes expose quiet comedy, shouted urgency, and long phrasing/names.
    tests = {
        "human_wizard": [
            ("[quietly, dry sarcasm] Lovely view... shame about the ARROWS.", "Dry setup; 350 ms implied pause, stress arrows. Let the joke land without a chuckle."),
            ("[shocked] That's OUR smoke! [urgent, shouting] They're ATTACKING the TOWN!", "Shock first, then urgent chest delivery. Strong attacking and town; final word nearly shouted."),
            ("[conversational, irritated] Pyrrhax, I trained for forty years in Aldermere. Nobody mentioned the saddle, the sheep, or the smell of burning trousers.", "Natural longer complaint. Stress nobody and trousers, breathe at the sentence break; do not rush the last joke.")],
        "elf_wizard": [
            ("[quietly, disdainful] A troll... how terribly appropriate for this neighbourhood.", "Beautiful clear diction, dry contempt; pause before the insult, no theatrical flourish."),
            ("[shocked] Our grove is BURNING! [urgent, shouting] Verdanthe, turn us HOME!", "Composure breaks briefly. Stress burning and home, clip the command sharply."),
            ("[measured, sarcastic] Ilythiel of Sylvara does not retreat. We merely leave before the company becomes any more embarrassing.", "Maintain natural long sentence and articulated names. Pause after retreat; embarrassment is the punchline.")],
        "ice_wizard": [
            ("[low, quiet, stern] Do not mistake my silence... for MERCY.", "Deep restraint, controlled pause, mercy cold and quiet, never a growl."),
            ("[controlled urgency] The glacier wall has BROKEN. [shouting] Skaldfrost! HOME. Now!", "A genuine crack in composure on home. Preserve consonants; now short and absolute."),
            ("[low, measured] Ymra of Hrimgard has weathered longer winters than this. Keep below the storm, and let the impatient ones discover the lightning.", "Long breath groups with northern remoteness. Calm threat; no caricature accent.")],
        "undead_wizard": [
            ("[quietly, cheerfully dry] Another funeral... I do hope they have kept the receipt.", "Sparse dry rasp, amiable death joke. Receipt lands after a pause, no sinister cackle."),
            ("[shocked] They're burning the CRYPTS! [urgent, shouting] Vorthrax, those are our PEOPLE!", "Sudden possessive panic. Stress crypts and people; remains understandable through rasp."),
            ("[brightly, ancient dry voice] Malkhar of Morgrave has buried many rivals. Some were even dead at the time, which I consider a rather generous courtesy.", "Cheerful ancient character, pause before some. Natural long phrasing and clearly spoken names.")],
        "human_dragon": [
            ("[low, resonant, amused] That bull... had OPINIONS. [short pleased exhale]", "Huge chest and a tiny pause. Opinions amused, consonants firm; no pitch manipulation."),
            ("[deep, furious, shouting] MY town! MY dinner! BURN them!", "Aggression with physical breath. Three clear stress peaks; words cut through the chest resonance."),
            ("[huge chest resonance, confident] I am Pyrrhax. Aldermere is beneath my wings, the enemy is beneath my claws, and dinner is an urgent matter of state.", "Hunger and grandeur, full physical scale. Three breath groups, state is the dry punchline.")],
        "elf_dragon": [
            ("[resonant, quiet, sarcastic] I could eat him... but I have STANDARDS.", "Fast elegant setup, held pause, clipped standards. Still an enormous creature."),
            ("[large resonant chest, urgent] They're beneath our canopy! [shouting] OUT of my forest!", "Threat fast and surgical. Out and forest stressed; no thin human shout."),
            ("[large resonant chest, articulate, haughty] I am Verdanthe of Sylvara. If you insist on calling this an ambush, at least have the manners to appear surprised.", "Quick intelligent articulation, one large breath, disdain peaks on manners and surprised.")],
        "ice_dragon": [
            ("[very deep, slow, quiet] I remember this mountain... when it was SMALL.", "Glacial breath and scale; deliberate pause, small carries the age joke."),
            ("[massive chest resonance, stern] The walls are FALLING. [deep, roaring speech] RETURN.", "Clear falling, return like a glacier moving. Do not bury speech in roaring."),
            ("[ancient, very deep, measured] Skaldfrost watches over Hrimgard. I have slept beneath greater storms, and I have outlived every creature that thought me slow.", "Long controlled breaths, unhurried but not dragging. Final slow dry and threatening.")],
        "undead_dragon": [
            ("[hollow, dry, quietly amused] Fresh meat... such a SHORT appointment.", "Hollow chest, dry exhale, short amused. No rattle over consonants."),
            ("[hollow, furious, clear] They disturb MY dead! [roaring speech] TAKE their breath!", "Physical throat but clear diction. My and take sharp; breath ends the threat."),
            ("[ancient, hollow chest, macabre amusement] Vorthrax serves Morgrave. I have forgotten the taste of sleep, but I remember precisely which of you tasted of chicken.", "Sparse throat texture, long natural line. Pause before but; chicken absurdly matter-of-fact.")],
    }
    audition_jobs = []
    for character, phrases in tests.items():
        for candidate in voices[character]["candidates"]:
            for index, (text, performance) in enumerate(phrases, 1):
                audition_jobs.append({"id": f"aud_{character}_{candidate['key']}_{index}", "character": character, "candidate": candidate["key"],
                                      "text": re.sub(r"\[[^]]+\]", "", text).strip(), "synthesis_text": text, "performance": performance,
                                      "kind": "audition", "review": "pending"})
    save("auditions.json", audition_jobs)

    specs = []
    def sfx(key, description, duration=1.5, variants=2, fallback="monster_roar", loop=False, gain=.65):
        for i in range(1, variants + 1):
            specs.append({"id": f"{key}_{i:02}", "event": key, "kind": "sfx", "fallback": fallback,
                          "text": description + f" Distinct performance take {i}: vary the rhythm and texture naturally. Isolated game sound; no speech, music, crowd or unrelated ambience.",
                          "duration_seconds": duration, "loop": loop, "model_id": "eleven_text_to_sound_v2", "prompt_influence": .55,
                          "gain": gain, "review": "pending"})
    giant = {
        "roar_far": ("Distant enormous humanoid giant roar, outdoor low chest bellow with natural distance, not a dragon",2.2),
        "roar_close": ("Close giant angry roar, huge human chest and throat, heavy breath, sharply articulated onset",1.8),
        "grunt_angry": ("Enormous giant short angry exertion grunt, rough huge lungs",.8),
        "grunt_confused": ("Giant baffled questioning grunt, comical low puzzled upward inflection",1.1),
        "pain": ("Giant sudden hurt yell, huge humanoid chest, pain then breath",1.4),
        "laugh": ("Enormous giant belly laugh, three rough chest pulses, foolish delight",2.4),
        "breathing": ("Huge sleeping humanoid giant slow breathing, chest air and nostril weight, no roaring",3),
        "footstep": ("Single giant bare foot compressing soil, grounded bass weight with gravel grit and quick dirt settling; not an explosion",.8),
        "run": ("Two quick giant running footfalls, heavy heel and dirt displacement, earthy low thumps, no explosion",1.2),
        "body_fall": ("Enormous giant body falling flat onto earth, broad flesh thud and displaced soil, stone rattles then settle",2),
        "ground_impact": ("Giant fist strikes earth, compact weighty low soil thump, scattering small pebbles, not a blast",.9),
        "pickup": ("Giant hand grips and tears a boulder from ground, rock grit and enormous grip friction",1.1),
        "throw_effort": ("Giant effort grunt as throwing a boulder, forceful huge chest exhale with short stone scrape",1),
        "rock_air": ("Large uneven boulder passing through air, rapid gritty heavy whoosh, no impact",.8),
        "rock_impact": ("Heavy boulder impacts stone wall, sharp rock fracture with grounded low thud and rubble, no explosive boom",1.2),
        "eating": ("Enormous foolish giant bites and loudly chews, blunt crunchy food and big mouth sloppiness",1.8),
        "death": ("Giant long dying chest groan, enormous lungs empty then become quiet",2.4),
    }
    for key, (desc, dur) in giant.items():
        sfx("giant_" + key, desc, dur, fallback="giant_stomp" if key in ("footstep","run","ground_impact") else "stone_hit" if key == "rock_impact" else "monster_roar")
    troll = {
        "growl": ("Revolting troll wet throaty growl, sticky saliva strings and blunt nasal snarl",1.3),
        "snort": ("Stupid troll thick wet nasal snort, short and comic",.8),
        "slobber": ("Troll excessive sticky mouth slobber, disgusting tongue smack and dripping saliva",1.2),
        "roar": ("Troll angry wet roar, savage animal-human throat, nasal rasp and drool",1.8),
        "confused": ("Troll baffled burbly questioning vocal, two stupid confused mouth noises",1.1),
        "food": ("Troll excited greedy food grunts with an eager sticky lip smack",1.3),
        "club_swing": ("Heavy wooden troll club fast swing through air, thick woody whoosh, no impact",.6),
        "club_impact": ("Huge wooden club strikes a stone wall, blunt heavy wood knock, chips and grit, no explosion",.9),
        "footstep": ("Single heavy troll foot squashes mud, wet stomp with gritty grounded bass",.7),
        "scratch": ("Troll claws scratching bark, three rough wooden scrapes",1.1),
        "pain": ("Troll short pained wet howl, ugly snorting throat catch",1.2),
        "death": ("Troll collapses with a gurgling dying exhale, saliva rattle, short and revolting",1.8),
        "breathing": ("Troll disgusting congested breathing, sticky nostril whistle, thick wet chest breath",2.6),
        "chuckle": ("Troll small stupid wet chuckle, absurd giggle in a huge ugly mouth",1.2),
    }
    for key, (desc, dur) in troll.items():
        sfx("troll_" + key, desc, dur, fallback="giant_stomp" if key == "footstep" else "sword_clash" if key.startswith("club") else "monster_roar")
    for prey in ["sheep", "cattle", "goat_deer", "large"]:
        sfx("eat_" + prey, f"Enormous dragon devours {'a large prey animal' if prey == 'large' else prey.replace('_',' or ')} in one quick comic sequence. At 0.00 jaws snap BITE, 0.10 sharp bone CRUNCH, 0.22 wet meat SQUELCH, 0.38 one short CHEW, 0.62 huge throaty SWALLOW ending by 0.90 seconds. Quick satisfying physical mouth action, slightly grotesque, no long chewing.",1,3,"bone_crunch",gain=.75)
    for part, desc, fallback in [
        ('bite','One enormous dragon jaw snaps shut, compact tooth clack and a sharp meaty bite, immediate onset','snatch'),
        ('crunch','One sharp dragon bite crunches animal bones, crisp short splintering bone and compressed meat, immediate onset','bone_crunch'),
        ('squelch','One compact wet meat compression in a huge dragon mouth, thick sticky squelch, immediate onset','squelch'),
        ('chew','One short sloppy muscular dragon mouth chew, no repeated chewing, immediate onset','eat_crunch'),
        ('swallow','One huge dragon throaty swallow, deep quick liquid gulp and chest release, immediate onset','swallow'),
    ]:
        sfx('eat_stem_'+part,desc,.6,3,fallback,gain=.75)
    for key, desc, dur, loop in [
        ("breath_inhale","Huge dragon chest forcefully inhales, deep lung draw and throat charge, no flame yet",.65,False),
        ("breath_ignite","Dragon flame ignites with a sharp organic throat pop and compact fire whoosh",.5,False),
        ("breath_burst","Short forceful dragon fire burst, bright flame rush with low chest pressure and crisp crackle",.9,False),
        ("breath_fire","Continuous massive dragon fire jet, low chest pressure, rushing flame, crisp crackle, constant energy, seamless repeating texture, no onset or ending",3,True),
        ("breath_stop","Dragon fire shuts off, quick dying flame lick and breath exhaust, compact tail",.6,False),
        ("breath_frost","Continuous glacial dragon breath, dense icy rushing air, fine crystal grit, constant seamless repeating texture, no start or finish",3,True),
        ("breath_magic","Continuous enormous verdant dragon breath, organic luminous air rush, gently resonant magical pollen hiss, seamless repeating texture",3,True),
        ("breath_necro","Continuous undead dragon breath, hollow bone throat air and dark granular wind, seamless repeating texture, no voices",3,True),
    ]:
        sfx(key,desc,dur,1 if loop else 2,"breath_fire" if loop else "breath_start",loop)
    for key, desc, dur, fallback in [
        ("dragon_burp","Enormous dragon short satisfied chest burp, comedic but not human-pitched-down",1,"dragon_growl"),
        ("dragon_satisfied","Enormous dragon pleased low chest rumble with a brief nose exhale",1.4,"dragon_growl"),
        ("dragon_snort","Enormous dragon amused snort, huge nostrils and dry short breath",.8,"dragon_growl"),
        ("wing_beat","Single huge dragon wing downstroke, leathery air displacement with muscular chest weight",.65,"wing_beat"),
        ("dragon_roar","Enormous fire dragon assertive roar, physical huge chest resonance, throat grit and hot breath",2,"dragon_roar"),
        ("dragon_hurt","Dragon sudden short pained chest grunt, clear organic creature sound",.65,"dragon_hurt"),
        ("dragon_roar_pain","Dragon agony roar, huge lungs and throat breaking into rough breath",1.8,"dragon_roar_pain"),
        ("collapse","Fantasy stone castle wall collapses, masonry cracks, heavy blocks tumble, dust and small rubble settle",2.2,"collapse"),
        ("catapult","Wooden medieval catapult arm releases, taut rope twang, timber creak, heavy mechanism knock",1,"catapult"),
        ("cow","One frightened cow moo, natural farm animal close and isolated",1.2,"cow"),
        ("sheep","One startled sheep bleat, natural animal, quick comic voice",.8,"sheep"),
        ("goat","One annoyed goat bleat, natural animal nasal comic protest",.7,"goat"),
    ]:
        sfx(key,desc,dur,2,fallback)
    save("sfx-jobs.json",specs)
    print(f"Prepared {len(audition_jobs)} directed auditions and {len(specs)} SFX jobs; no paid calls made.")


if __name__ == "__main__":
    build()
