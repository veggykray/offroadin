class_name HumanZooConversation
extends RefCounted
## Works out what Bill can say at a microphone and what comes back.
##
## A response is "productive" when its effects would teach the player something
## they don't already know. This is computed from the data, never hand-marked,
## so authors only ever write conditions and effects.

const CHAT := "chat"
const LEAVE := "__leave"

var db: HumanZooDatabase
var state: HumanZooState
## Maximum topic options shown at once (plus Leave).
var max_options: int = 4


func _init(database: HumanZooDatabase, game_state: HumanZooState) -> void:
	db = database
	state = game_state


func _entries(character_id: String, topic_id: String) -> Array:
	var c := db.character(character_id)
	if c == null:
		return []
	return c.responses.get(topic_id, [])


## First unused entry whose condition currently holds.
func find_entry(character_id: String, topic_id: String) -> Dictionary:
	var list := _entries(character_id, topic_id)
	for i in list.size():
		var e: Dictionary = list[i]
		var uid := "%s|%s|%d" % [character_id, topic_id, i]
		if state.used_entries.has(uid) and not bool(e.get("repeatable", false)):
			continue
		if not HumanZooConditions.check(e.get("if"), state):
			continue
		return {"entry": e, "uid": uid}
	return {}


func is_productive_entry(e: Dictionary) -> bool:
	var d: Dictionary = e.get("do", {})
	for t in d.get("unlock", []):
		if not state.has_fact(t):
			return true
	for f in d.get("set", []):
		if not state.has_fact(f):
			return true
	return false


## "productive" | "fresh" | "exhausted"
func topic_status(character_id: String, topic_id: String) -> String:
	var found := find_entry(character_id, topic_id)
	if not found.is_empty():
		return "productive" if is_productive_entry(found["entry"]) else "fresh"
	if state.times_asked(character_id, topic_id) == 0:
		return "fresh"
	return "exhausted"


func has_productive(character_id: String, topic_id: String) -> bool:
	return topic_status(character_id, topic_id) == "productive"


## All (character, topic) pairs that would currently move the game forward.
func productive_pairs(include_optional := false) -> Array:
	var out: Array = []
	for cid in db.character_order:
		if not is_character_available(cid):
			continue
		for t in state.topic_order:
			if state.consumed.has(t):
				continue
			var td := db.topic(t)
			if td == null or not td.askable:
				continue
			if td.optional and not include_optional:
				continue
			if has_productive(cid, t):
				out.append({"character": cid, "topic": t})
		var chat := find_entry(cid, CHAT)
		if not chat.is_empty() and is_productive_entry(chat["entry"]):
			if include_optional or not bool(chat["entry"].get("optional", false)):
				out.append({"character": cid, "topic": CHAT})
	return out


## Characters behind a condition (the empty cage) aren't reachable until awake/tuned.
func is_character_available(character_id: String) -> bool:
	var c := db.character(character_id)
	if c == null:
		return false
	if c.awake_when != null and not HumanZooConditions.check(c.awake_when, state):
		return false
	if c.tuned_flag != "" and not state.has_fact(c.tuned_flag):
		return false
	return true


## The handful of options to show at a microphone.
func get_options(character_id: String) -> Array:
	var c := db.character(character_id)
	var opts: Array = []
	for idx in state.topic_order.size():
		var t: String = state.topic_order[idx]
		if state.consumed.has(t):
			continue
		var td := db.topic(t)
		if td == null or not td.askable:
			continue
		if td.kind == "message" and td.from_character == character_id:
			continue
		var st := topic_status(character_id, t)
		if st == "exhausted":
			continue
		var pr := 40.0
		var style := "normal"
		var label := td.label
		if td.kind == "message":
			if td.to_character == character_id:
				pr = 100.0
				style = "message"
			else:
				pr = 15.0
				var to_c := db.character(td.to_character)
				if to_c:
					label += "  (meant for %s)" % _short_name(to_c)
		elif st == "productive":
			pr = 80.0
		if style == "normal" and state.unasked_topics.has(t):
			style = "new"
		opts.append({"topic": t, "label": label, "style": style, "priority": pr, "recency": idx})
	# Small talk: productive chat (e.g. someone wants to send a message) ranks high.
	var chat := find_entry(character_id, CHAT)
	if not chat.is_empty():
		var productive := is_productive_entry(chat["entry"])
		opts.append({"topic": CHAT, "label": c.chat_label, "style": "normal",
			"priority": 90.0 if productive else 30.0, "recency": -1})
	opts.sort_custom(func(a, b): return a["priority"] > b["priority"])
	if opts.size() > max_options:
		opts.resize(max_options)
	if opts.size() < 2 and c != null and not c.chatter.is_empty() and chat.is_empty():
		opts.append({"topic": CHAT, "label": c.chat_label, "style": "subdued", "priority": 0.0, "recency": -1})
	# Display order: messages first, then newest learned first. Display order
	# deliberately doesn't reveal which options are productive.
	opts.sort_custom(func(a, b):
		var am: bool = a["style"] == "message"
		var bm: bool = b["style"] == "message"
		if am != bm:
			return am
		return a["recency"] > b["recency"])
	opts.append({"topic": LEAVE, "label": "Leave", "style": "leave", "priority": -1.0, "recency": -2})
	return opts


func _short_name(c: HumanZooCharacterData) -> String:
	return c.display_name if state.has_fact("met_" + c.id) else c.plaque_name.capitalize()


## Pick what the character says. Doesn't change state; call commit() after.
func resolve(character_id: String, topic_id: String) -> Dictionary:
	var c := db.character(character_id)
	var res := {"character": character_id, "topic": topic_id, "lines": [], "do": {},
		"uid": "", "kind": "dead_end"}
	var found := find_entry(character_id, topic_id)
	if not found.is_empty():
		var e: Dictionary = found["entry"]
		res["lines"] = e["lines"]
		res["do"] = e.get("do", {})
		res["uid"] = found["uid"]
		res["kind"] = "productive" if is_productive_entry(e) else "comedy"
	elif c != null:
		var pool: Array = c.chatter if topic_id == CHAT else c.fallback
		if pool.is_empty():
			pool = [HumanZooLines.normalize(["..."])]
		var i := state.next_rotation(character_id + "|" + ("chatter" if topic_id == CHAT else "fallback"), pool.size())
		res["lines"] = pool[i]
		res["kind"] = "chatter" if topic_id == CHAT else "dead_end"
	return res


func greeting(character_id: String) -> Dictionary:
	var c := db.character(character_id)
	var res := {"character": character_id, "topic": "", "lines": [], "do": {}, "uid": "", "kind": "greeting"}
	if c == null:
		return res
	for i in c.greeting.size():
		var e: Dictionary = c.greeting[i]
		if HumanZooConditions.check(e.get("if"), state):
			res["lines"] = e["lines"]
			res["do"] = e.get("do", {})
			res["uid"] = "%s|greeting|%d" % [character_id, i]
			break
	return res


## Record that the exchange happened. Returns the effects dict to apply.
func commit(res: Dictionary) -> Dictionary:
	var cid: String = res["character"]
	var tid: String = res["topic"]
	if tid != "":
		state.mark_asked(cid, tid)
	if res["uid"] != "":
		state.used_entries[res["uid"]] = true
	var effects: Dictionary = res["do"].duplicate(true)
	# Delivering a message to its recipient uses it up automatically.
	var td := db.topic(tid)
	if td != null and td.kind == "message" and td.to_character == cid and res["kind"] == "productive":
		var consume: Array = effects.get("consume", [])
		if not consume.has(tid):
			consume.append(tid)
		effects["consume"] = consume
	return effects
