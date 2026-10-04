class_name HumanZooMachinePuzzle
extends RefCounted
## The six selectors on the central machine, their evaluation, and the
## feedback a wrong attempt generates. The solution and every reaction are data.

var db: HumanZooDatabase
var state: HumanZooState
var rng := RandomNumberGenerator.new()
var selector_ids: Array = []
var symbols: Array = []
var solution: Dictionary = {}
var _recent_events: Array = []
var _pointed: Dictionary = {}


func _init(database: HumanZooDatabase, game_state: HumanZooState) -> void:
	db = database
	state = game_state
	rng.randomize()
	selector_ids = Array(db.puzzle.get("selectors", []))
	symbols = Array(db.puzzle.get("symbols", ["MOON", "EYE", "BIRD", "KEY", "TREE", "HAND"]))
	solution = db.puzzle.get("solution", {})
	var initial: Dictionary = db.puzzle.get("initial", {})
	for id in selector_ids:
		if not state.selectors.has(id):
			state.selectors[id] = initial.get(id, symbols[0])


func symbol_for(selector_id: String) -> String:
	return String(state.selectors.get(selector_id, symbols[0]))


func rotate(index: int, direction: int) -> String:
	var id: String = selector_ids[index]
	var i := symbols.find(symbol_for(id))
	i = wrapi(i + direction, 0, symbols.size())
	state.selectors[id] = symbols[i]
	return symbols[i]


func evaluate() -> Dictionary:
	var correct: Array = []
	var wrong: Array = []
	for id in selector_ids:
		if symbol_for(id) == String(solution.get(id, "")):
			correct.append(id)
		else:
			wrong.append(id)
	return {"correct": correct, "wrong": wrong, "count": correct.size(), "solved": wrong.is_empty()}


func short_name(id: String) -> String:
	var shorts: Dictionary = db.puzzle.get("selector_names", {})
	if shorts.has(id):
		return String(shorts[id])
	var c := db.character(id)
	return c.display_name if c else id


## Picks an absurd event and a couple of reactions that carry real information.
func build_wrong_feedback(result: Dictionary) -> Dictionary:
	state.attempts += 1
	var events: Array = db.puzzle.get("wrong_events", [])
	var event: Dictionary = {}
	if not events.is_empty():
		var choices: Array = []
		for e in events:
			if not _recent_events.has(e.get("id", "")):
				choices.append(e)
		if choices.is_empty():
			choices = events
		event = choices[rng.randi() % choices.size()]
		_recent_events.append(event.get("id", ""))
		if _recent_events.size() > 3:
			_recent_events.pop_front()
	var lines: Array = []
	lines.append_array(HumanZooLines.normalize(event.get("lines", [])))
	var rules: Array = db.puzzle.get("feedback", [])
	var always: Array = []
	var rotating: Array = []
	for r in rules:
		if not HumanZooConditions.check(r.get("if"), state):
			continue
		if bool(r.get("always", false)):
			always.append(r)
		else:
			rotating.append(r)
	var chosen: Array = always.duplicate()
	# Later attempts get more reactions: the player gets closer every time.
	var extra := 1 + int(state.attempts >= 3) + int(state.attempts >= 5)
	for k in mini(extra, rotating.size()):
		chosen.append(rotating[(state.attempts - 1 + k * 2) % rotating.size()])
	var seen := {}
	for r in chosen:
		var key := String(r.get("who", "")) + String(r.get("type", ""))
		if seen.has(key):
			continue
		seen[key] = true
		lines.append_array(_feedback_lines(r, result))
	return {"event": event, "lines": lines}


func _feedback_lines(rule: Dictionary, result: Dictionary) -> Array:
	var who := String(rule.get("who", ""))
	var t := String(rule.get("type", ""))
	var ctx := {"n": result["count"], "n_wrong": result["wrong"].size()}
	var picked: Array = []
	var prefix: Array = []
	match t:
		"count":
			var by_count: Dictionary = rule.get("lines_by_count", {})
			picked = by_count.get(str(result["count"]), rule.get("lines", ["{n} were correct."]))
		"point_wrong":
			var wrong: Array = result["wrong"]
			var target: String = wrong[0]
			for w in wrong:
				if not _pointed.has(w):
					target = w
					break
			_pointed[target] = true
			ctx["name"] = short_name(target)
			ctx["symbol"] = symbol_for(target).to_lower()
			picked = rule.get("lines", [])
			prefix.append(HumanZooLines.normalize_line({"action": "shake_selector", "args": [target]}))
		"claim_right":
			var pool: Array = result["correct"]
			var honest := rng.randf() < float(rule.get("reliability", 0.7))
			if not honest or pool.is_empty():
				pool = result["wrong"]
			var target: String = pool[rng.randi() % pool.size()]
			ctx["name"] = short_name(target)
			ctx["symbol"] = symbol_for(target).to_lower()
			picked = rule.get("lines", [])
		"own":
			var mine := String(rule.get("selector", who))
			ctx["symbol"] = symbol_for(mine).to_lower()
			picked = rule.get("lines_right", []) if result["correct"].has(mine) else rule.get("lines_wrong", [])
		"nonsense":
			picked = rule.get("lines", [])
			if rng.randf() < float(rule.get("truth_chance", 0.0)) and not result["wrong"].is_empty():
				var target: String = result["wrong"][rng.randi() % result["wrong"].size()]
				ctx["name"] = short_name(target)
				ctx["symbol"] = symbol_for(target).to_lower()
				picked = rule.get("truth_lines", picked)
	if picked.is_empty():
		return []
	# Each pool is a list of alternatives; an alternative is a line or a list of lines.
	var alt = picked[rng.randi() % picked.size()]
	var one: Array = alt if alt is Array else [alt]
	return prefix + _with_speaker(one, who, ctx)


func _with_speaker(raw: Array, who: String, ctx: Dictionary) -> Array:
	var out: Array = []
	for item in raw:
		var line := HumanZooLines.normalize_line(item)
		if line["who"] == "self":
			line["who"] = who
		line["text"] = HumanZooLines.fill(line["text"], ctx)
		out.append(line)
	return out
