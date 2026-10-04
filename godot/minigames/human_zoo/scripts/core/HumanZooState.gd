class_name HumanZooState
extends RefCounted
## Everything the player has learned or done. Pure data: no nodes, no visuals.
## Serialise with to_dict()/from_dict() to save mid-puzzle.

signal fact_added(id: String)

## Topics and flags. Topics are facts that also appear as conversation options.
var facts: Dictionary = {}
## Topics in the order they were learned (newest last).
var topic_order: Array = []
## Messages that have been delivered and should no longer be offered.
var consumed: Dictionary = {}
## "character|topic" -> number of times raised.
var asked: Dictionary = {}
## Response entry ids that have already played.
var used_entries: Dictionary = {}
## Topics never yet raised with anyone (drives the NEW badge).
var unasked_topics: Dictionary = {}
## Number of completed progress stages.
var stage: int = 0
## Final puzzle: selector id -> symbol id.
var selectors: Dictionary = {}
var attempts: int = 0
## Rotating indices so chatter / fallbacks don't repeat back to back.
var rotation: Dictionary = {}


func has_fact(id) -> bool:
	return facts.has(String(id))


func add_fact(id) -> bool:
	var key := String(id)
	if key == "" or facts.has(key):
		return false
	facts[key] = true
	fact_added.emit(key)
	return true


func learn_topic(id) -> bool:
	var key := String(id)
	if facts.has(key):
		return false
	topic_order.append(key)
	unasked_topics[key] = true
	add_fact(key)
	return true


func holds_topic(id) -> bool:
	return has_fact(id) and not consumed.has(String(id))


func consume(id) -> void:
	consumed[String(id)] = true


func mark_asked(character_id: String, topic_id: String) -> void:
	var key := character_id + "|" + topic_id
	asked[key] = int(asked.get(key, 0)) + 1
	unasked_topics.erase(topic_id)


func times_asked(character_id: String, topic_id: String) -> int:
	return int(asked.get(character_id + "|" + topic_id, 0))


func next_rotation(key: String, size: int) -> int:
	if size <= 0:
		return 0
	var i := int(rotation.get(key, 0))
	rotation[key] = i + 1
	return i % size


func to_dict() -> Dictionary:
	return {
		"facts": facts.keys(),
		"topic_order": topic_order.duplicate(),
		"consumed": consumed.keys(),
		"asked": asked.duplicate(),
		"used_entries": used_entries.keys(),
		"unasked_topics": unasked_topics.keys(),
		"stage": stage,
		"selectors": selectors.duplicate(),
		"attempts": attempts,
		"rotation": rotation.duplicate(),
	}


func from_dict(d: Dictionary) -> void:
	facts.clear()
	for f in d.get("facts", []):
		facts[String(f)] = true
	topic_order = Array(d.get("topic_order", [])).duplicate()
	consumed.clear()
	for c in d.get("consumed", []):
		consumed[String(c)] = true
	asked = Dictionary(d.get("asked", {})).duplicate()
	used_entries.clear()
	for u in d.get("used_entries", []):
		used_entries[String(u)] = true
	unasked_topics.clear()
	for t in d.get("unasked_topics", []):
		unasked_topics[String(t)] = true
	stage = int(d.get("stage", 0))
	selectors = Dictionary(d.get("selectors", {})).duplicate()
	attempts = int(d.get("attempts", 0))
	rotation = Dictionary(d.get("rotation", {})).duplicate()
