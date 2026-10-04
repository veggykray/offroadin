class_name HumanZooProgress
extends RefCounted
## Applies effects and advances the (hidden) progress stages.
## Stages complete strictly in order, but the facts behind them can be found in
## any order — finishing stage 3's facts early simply cascades when stage 2 lands.

signal stage_completed(stage_number: int, stage: Dictionary)
signal facts_gained(ids: Array)

var db: HumanZooDatabase
var state: HumanZooState


func _init(database: HumanZooDatabase, game_state: HumanZooState) -> void:
	db = database
	state = game_state


func apply_effects(d: Dictionary) -> Array:
	var gained: Array = []
	for t in d.get("unlock", []):
		if state.learn_topic(t):
			gained.append(t)
	for f in d.get("set", []):
		if state.add_fact(f):
			gained.append(f)
	for c in d.get("consume", []):
		state.consume(c)
	if not gained.is_empty():
		facts_gained.emit(gained)
	return gained


## Returns the list of stage numbers that just completed.
func check_stages() -> Array:
	var done: Array = []
	while state.stage < db.stages.size() and HumanZooConditions.check(db.stages[state.stage].get("complete_when"), state):
		state.stage += 1
		state.add_fact("stage_%d" % state.stage)
		done.append(state.stage)
		stage_completed.emit(state.stage, db.stages[state.stage - 1])
	return done


func current_stage() -> Dictionary:
	if state.stage < db.stages.size():
		return db.stages[state.stage]
	return {}


func all_stages_complete() -> bool:
	return state.stage >= db.stages.size()


## For the thought board / debug: what kind of information we hold.
func classify_known() -> Dictionary:
	var out := {"confirmed": [], "misleading": [], "unconfirmed": [], "messages": []}
	for t in state.topic_order:
		var td := db.topic(t)
		if td == null:
			continue
		if td.kind == "message":
			if not state.consumed.has(t):
				out["messages"].append(t)
		elif td.kind == "claim":
			if td.confirmed_when != null and HumanZooConditions.check(td.confirmed_when, state):
				out["confirmed"].append(t)
			elif is_misleading(t):
				out["misleading"].append(t)
			else:
				out["unconfirmed"].append(t)
		else:
			out["confirmed"].append(t)
	return out


## A claim the content marks as debunked once some fact is known.
func is_misleading(topic_id: String) -> bool:
	var m: Dictionary = db.raw.get("misleading", {})
	return m.has(topic_id) and HumanZooConditions.check(m[topic_id], state)
