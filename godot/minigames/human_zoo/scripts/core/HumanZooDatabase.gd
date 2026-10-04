class_name HumanZooDatabase
extends RefCounted
## Loads the Human Zoo content file into typed resources.
## All puzzle content — characters, topics, stages, leads, solution, wrong-answer
## events and ledger layout — lives in data/human_zoo_content.json.

var topics: Dictionary = {}       # id -> HumanZooTopicData
var characters: Dictionary = {}   # id -> HumanZooCharacterData
var character_order: Array = []
var initial_topics: Array = []
var stages: Array = []            # Array[Dictionary]
var puzzle: Dictionary = {}
var ledger: Dictionary = {}
var observations: Array = []
var world: Dictionary = {}
var bill: Dictionary = {}
var finale: Dictionary = {}
var meta: Dictionary = {}
var raw: Dictionary = {}


func load_file(path: String) -> bool:
	if not FileAccess.file_exists(path):
		push_error("HumanZoo: content file not found: %s" % path)
		return false
	var text := FileAccess.get_file_as_string(path)
	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		push_error("HumanZoo: JSON error in %s line %d: %s" % [path, json.get_error_line(), json.get_error_message()])
		return false
	return load_dict(json.data)


func load_dict(d: Dictionary) -> bool:
	raw = d
	meta = d.get("meta", {})
	initial_topics = Array(d.get("initial_topics", []))
	topics.clear()
	var tdict: Dictionary = d.get("topics", {})
	for tid in tdict.keys():
		topics[tid] = HumanZooTopicData.from_dict(tid, tdict[tid])
	characters.clear()
	character_order.clear()
	var cdict: Dictionary = d.get("characters", {})
	for cid in cdict.keys():
		characters[cid] = HumanZooCharacterData.from_dict(cid, cdict[cid])
		character_order.append(cid)
	stages = Array(d.get("stages", []))
	puzzle = d.get("puzzle", {})
	ledger = d.get("ledger", {})
	observations = Array(d.get("observations", []))
	world = d.get("world", {})
	bill = d.get("bill", {})
	finale = d.get("finale", {})
	return true


func character(id: String) -> HumanZooCharacterData:
	return characters.get(id, null)


func topic(id: String) -> HumanZooTopicData:
	return topics.get(id, null)


## Every fact that the content can ever produce (initial topics + effects).
func obtainable_facts() -> Dictionary:
	var out := {}
	for t in initial_topics:
		out[t] = true
	for i in stages.size():
		out["stage_%d" % (i + 1)] = true
	for c in characters.values():
		var entry_lists: Array = [c.greeting]
		for k in c.responses.keys():
			entry_lists.append(c.responses[k])
		for list in entry_lists:
			for e in list:
				_collect_effects(e.get("do", {}), out)
	for o in observations:
		_collect_effects(o.get("do", {}), out)
	for f in puzzle.get("extra_facts", []):
		out[f] = true
	return out


func _collect_effects(d: Dictionary, out: Dictionary) -> void:
	for t in d.get("unlock", []):
		out[t] = true
	for f in d.get("set", []):
		out[f] = true


## Returns a list of human-readable problems. Empty list == content is sound.
func validate() -> Array:
	var problems: Array = []
	var obtainable := obtainable_facts()
	# Unlocks must name real topics.
	for c in characters.values():
		for k in c.responses.keys():
			if k != "chat" and not topics.has(k):
				problems.append("%s responds to unknown topic '%s'" % [c.id, k])
			for e in c.responses[k]:
				for t in e.get("do", {}).get("unlock", []):
					if not topics.has(t):
						problems.append("%s/%s unlocks unknown topic '%s'" % [c.id, k, t])
				for id in HumanZooConditions.referenced_ids(e.get("if")):
					if not obtainable.has(id) and not id.begins_with("met_"):
						problems.append("%s/%s condition uses unobtainable fact '%s'" % [c.id, k, id])
	# Every topic should be obtainable.
	for tid in topics.keys():
		if not obtainable.has(tid):
			problems.append("topic '%s' can never be learned" % tid)
		var t: HumanZooTopicData = topics[tid]
		if t.kind == "message":
			if not characters.has(t.to_character):
				problems.append("message '%s' addressed to unknown '%s'" % [tid, t.to_character])
	# Stage conditions must be reachable.
	for i in stages.size():
		for id in HumanZooConditions.referenced_ids(stages[i].get("complete_when")):
			if not obtainable.has(id):
				problems.append("stage %d needs unobtainable fact '%s'" % [i + 1, id])
		for lead in stages[i].get("leads", []):
			var who := String(lead.get("who", ""))
			if who != "" and not characters.has(who):
				problems.append("stage %d lead points at unknown character '%s'" % [i + 1, who])
	# Puzzle solution must use real selectors and symbols.
	var symbols: Array = puzzle.get("symbols", [])
	var solution: Dictionary = puzzle.get("solution", {})
	for sel in puzzle.get("selectors", []):
		if not solution.has(sel):
			problems.append("puzzle selector '%s' has no solution" % sel)
		elif not symbols.has(solution[sel]):
			problems.append("puzzle solution for '%s' uses unknown symbol" % sel)
	return problems
