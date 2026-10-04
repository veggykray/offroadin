class_name HumanZooCharacterData
extends Resource
## A data-driven inhabitant of the Human Zoo. Nothing about any individual
## character is hard-coded in scripts: personality, lines, responses, fallbacks,
## guidance behaviours and puzzle feedback all come from the content file.

@export var id: String = ""
## Name shown in dialogue once met (e.g. "EDITH").
@export var display_name: String = ""
## Name on the brass plaque / before meeting (e.g. "THE OLD WOMAN").
@export var plaque_name: String = ""
@export_multiline var personality: String = ""
## Pitch multiplier for the dialogue "voice" blips.
@export var voice_pitch: float = 1.0
@export var color: Color = Color(0.6, 0.5, 0.4)
@export var idle_behaviours: PackedStringArray = PackedStringArray()
## Label for the small-talk option at this character's microphone.
@export var chat_label: String = "Make small talk"
## Underlying concept for the final puzzle (purely descriptive).
@export var desire_concept: String = ""
## Behaviour played when guidance wants the player's attention here.
@export var attention_behaviour: String = "wave"
## Characters that must be woken by a condition before they respond normally.
var awake_when = null
## Characters behind a tuning dial: condition after which the dial is solved.
var tuned_flag: String = ""

## Response entries: {"if": cond, "lines": [...], "do": {...}}
var greeting: Array = []
var responses: Dictionary = {}
## Pools: arrays of line-arrays.
var chatter: Array = []
var fallback: Array = []
var static_lines: Array = []
var barks: Dictionary = {}


static func from_dict(char_id: String, d: Dictionary) -> HumanZooCharacterData:
	var c := HumanZooCharacterData.new()
	c.id = char_id
	c.display_name = String(d.get("name", char_id.to_upper()))
	c.plaque_name = String(d.get("plaque", c.display_name))
	c.personality = String(d.get("personality", ""))
	c.voice_pitch = float(d.get("voice_pitch", 1.0))
	c.color = Color.html(String(d.get("color", "#8a7a66")))
	c.idle_behaviours = PackedStringArray(d.get("idle", []))
	c.chat_label = String(d.get("chat_label", "Make small talk"))
	c.desire_concept = String(d.get("desire_concept", ""))
	c.attention_behaviour = String(d.get("attention_behaviour", "wave"))
	c.awake_when = d.get("awake_when", null)
	c.tuned_flag = String(d.get("tuned_flag", ""))
	c.greeting = _entries(d.get("greeting", []))
	c.chatter = _pool(d.get("chatter", []))
	c.fallback = _pool(d.get("fallback", []))
	c.static_lines = _pool(d.get("static", []))
	c.barks = d.get("barks", {})
	var resp: Dictionary = d.get("responses", {})
	for key in resp.keys():
		# "a,b,c" lets one set of entries answer several topics.
		for topic_id in String(key).split(",", false):
			var tid := topic_id.strip_edges()
			if not c.responses.has(tid):
				c.responses[tid] = []
			c.responses[tid].append_array(_entries(resp[key]))
	return c


## Entries may be written as a bare line list (single unconditional entry),
## a single entry dict, or a list of entry dicts.
static func _entries(raw) -> Array:
	var out: Array = []
	if raw is Dictionary:
		out.append(_entry(raw))
	elif raw is Array and raw.size() > 0:
		if raw[0] is Dictionary and (raw[0].has("lines") or raw[0].has("if")):
			for e in raw:
				out.append(_entry(e))
		else:
			out.append(_entry({"lines": raw}))
	return out


static func _entry(e: Dictionary) -> Dictionary:
	var entry := e.duplicate()
	entry["lines"] = HumanZooLines.normalize(e.get("lines", []))
	if not entry.has("do"):
		entry["do"] = {}
	return entry


static func _pool(raw) -> Array:
	var out: Array = []
	for item in raw:
		if item is Array:
			out.append(HumanZooLines.normalize(item))
		else:
			out.append(HumanZooLines.normalize([item]))
	return out
