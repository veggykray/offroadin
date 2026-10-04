class_name HumanZooGuidanceController
extends Node
## Keeps the player on track without ever solving the puzzle for them.
##
## Level 0 — natural:   a character with something new to say about a freshly
##                       learned topic physically reacts (looks over, holds a prop).
## Level 1 — behaviour: after a few dead ends / some idle time, the character who
##                       holds the next lead gets noticeably restless and their
##                       microphone lamp flickers.
## Level 2 — thought:   one short Bill thought recalling an unresolved connection.
## Level 3 — nudge:     "NEED A NUDGE?" is offered; accepting gives one
##                       contextual suggestion, never the whole chain.
##
## Leads are authored per stage in the content file. If the authored leads ever
## run dry, the controller falls back to any productive (character, topic) pair
## computed from the data, so the player can never become permanently stuck.

signal character_notice(character_id: String)
signal character_attention(character_id: String, behaviour: String)
signal bill_thought(text: String)
signal nudge_available(available: bool)
signal nudge_delivered(text: String)
signal level_changed(level: int)

@export var level1_dead_ends := 3
@export var level1_seconds := 50.0
@export var level2_dead_ends := 5
@export var level2_seconds := 95.0
@export var level3_dead_ends := 8
@export var level3_seconds := 160.0
@export var attention_repeat_seconds := 15.0
## Multiplies elapsed time (debug: speed guidance up to test it).
@export var time_scale := 1.0

var db: HumanZooDatabase
var state: HumanZooState
var conversation: HumanZooConversation

# --- Tracked state (public for debugging / integration) ---
var time_since_discovery := 0.0
var dead_ends := 0
var repeated_conversations := 0
var conversations := 0
var machine_attempts := 0
var level := 0
var suspended := false

var _attention_timer := 0.0
var _thoughts_given: Dictionary = {}
var _nudge_offered := false
var _nudges_given: Dictionary = {}


func setup(database: HumanZooDatabase, game_state: HumanZooState, conv: HumanZooConversation) -> void:
	db = database
	state = game_state
	conversation = conv


# ---------------------------------------------------------------- notifications

func notify_discovery(gained: Array, from_character := "") -> void:
	time_since_discovery = 0.0
	dead_ends = 0
	repeated_conversations = 0
	_set_level(0)
	# Level 0: natural reactions from whoever now has something to say.
	for id in gained:
		if db.topic(id) == null:
			continue
		for cid in db.character_order:
			if cid == from_character or not conversation.is_character_available(cid):
				continue
			if conversation.has_productive(cid, id):
				character_notice.emit(cid)


func notify_conversation(kind: String) -> void:
	conversations += 1
	match kind:
		"dead_end", "chatter":
			dead_ends += 1
		"repeat":
			repeated_conversations += 1
			dead_ends += 1
	_evaluate()


func notify_attempt(solved: bool) -> void:
	machine_attempts += 1
	if not solved:
		# A failed attempt still produces information, so it's not a full dead end.
		dead_ends += 1
		_evaluate()


# ---------------------------------------------------------------------- leads

## The lead the player should be working toward right now.
## Returns {} only when there's genuinely nothing left (puzzle solved).
func current_lead() -> Dictionary:
	if state == null or state.has_fact("puzzle_solved"):
		return {}
	var leads: Array
	if state.stage < db.stages.size():
		leads = db.stages[state.stage].get("leads", [])
	else:
		leads = db.puzzle.get("leads", [])
	for lead in leads:
		if not HumanZooConditions.check(lead.get("when"), state):
			continue
		if HumanZooConditions.check_until(lead.get("until"), state):
			continue
		var who := String(lead.get("who", ""))
		if who != "" and not conversation.is_character_available(who) and not bool(lead.get("ignore_availability", false)):
			continue
		return lead
	return _fallback_lead()


func _fallback_lead() -> Dictionary:
	var pairs := conversation.productive_pairs()
	if pairs.is_empty():
		return {}
	# Prefer the most recently learned topic: it's freshest in the player's mind.
	var best: Dictionary = pairs[0]
	var best_idx := -1
	for p in pairs:
		var idx := state.topic_order.find(p["topic"])
		if idx > best_idx:
			best_idx = idx
			best = p
	var c := db.character(best["character"])
	var name := c.display_name if state.has_fact("met_" + c.id) else c.plaque_name.capitalize()
	var td := db.topic(best["topic"])
	var noun := td.noun if td else "things"
	return {
		"id": "auto_%s_%s" % [best["character"], best["topic"]],
		"who": best["character"],
		"thought": "%s might have something to say about %s." % [name, noun],
		"nudge": "Try %s about %s." % [name, noun],
		"behaviour": c.attention_behaviour,
	}


func possible_next_characters() -> Array:
	var out: Array = []
	var lead := current_lead()
	if lead.has("who") and String(lead["who"]) != "":
		out.append(lead["who"])
	for p in conversation.productive_pairs():
		if not out.has(p["character"]):
			out.append(p["character"])
	return out


# ------------------------------------------------------------------- per-frame

func _process(delta: float) -> void:
	if state == null or suspended or state.has_fact("puzzle_solved"):
		return
	time_since_discovery += delta * time_scale
	_evaluate()
	if level >= 1:
		_attention_timer -= delta * time_scale
		if _attention_timer <= 0.0:
			_attention_timer = attention_repeat_seconds
			_emit_attention()


func _evaluate() -> void:
	var target := 0
	if dead_ends >= level1_dead_ends or time_since_discovery >= level1_seconds:
		target = 1
	if dead_ends >= level2_dead_ends or time_since_discovery >= level2_seconds:
		target = 2
	if dead_ends >= level3_dead_ends or time_since_discovery >= level3_seconds:
		target = 3
	if target > level:
		for l in range(level + 1, target + 1):
			_enter_level(l)
		_set_level(target)


func _enter_level(l: int) -> void:
	var lead := current_lead()
	if lead.is_empty():
		return
	match l:
		1:
			_attention_timer = attention_repeat_seconds
			_emit_attention()
		2:
			var key := String(lead.get("id", ""))
			if not _thoughts_given.has(key) and lead.has("thought"):
				_thoughts_given[key] = true
				bill_thought.emit(String(lead["thought"]))
		3:
			if not _nudge_offered:
				_nudge_offered = true
				nudge_available.emit(true)


func _emit_attention() -> void:
	var lead := current_lead()
	var who := String(lead.get("who", ""))
	if who == "":
		return
	var c := db.character(who)
	var behaviour := String(lead.get("behaviour", c.attention_behaviour if c else "wave"))
	character_attention.emit(who, behaviour)


func _set_level(l: int) -> void:
	if l == level:
		return
	level = l
	if l < 3 and _nudge_offered:
		_nudge_offered = false
		nudge_available.emit(false)
	level_changed.emit(level)


## Called when the player accepts NEED A NUDGE?
func request_nudge() -> String:
	var lead := current_lead()
	var text := String(lead.get("nudge", "Walk the gallery. Somebody is waiting to be asked something."))
	# A second nudge on the same lead can be a little more direct.
	var key := String(lead.get("id", ""))
	if _nudges_given.has(key) and lead.has("nudge2"):
		text = String(lead["nudge2"])
	_nudges_given[key] = true
	_nudge_offered = false
	nudge_available.emit(false)
	nudge_delivered.emit(text)
	# Keep pressure off for a while after helping.
	time_since_discovery = level2_seconds * 0.5
	dead_ends = 0
	level = 0
	level_changed.emit(level)
	return text


func is_nudge_offered() -> bool:
	return _nudge_offered


func debug_summary() -> Dictionary:
	var lead := current_lead()
	return {
		"stage": state.stage,
		"level": level,
		"since_discovery": snappedf(time_since_discovery, 0.1),
		"dead_ends": dead_ends,
		"repeats": repeated_conversations,
		"attempts": machine_attempts,
		"known_topics": state.topic_order.size(),
		"lead": lead.get("id", "-"),
		"lead_who": lead.get("who", "-"),
		"next": possible_next_characters(),
		"productive": conversation.productive_pairs().size(),
	}
