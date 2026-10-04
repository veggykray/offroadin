extends Node
## Tracks the shopping order and all the stats that end up in the result.
## Pure bookkeeping: no nodes, no physics, easy to read.

signal order_ready_changed(is_ready: bool)
signal delivered_changed(good: int, required: int)

@export var required_good := 10
@export var bonus_golden := 1

var delivered := {"normal": 0, "bouncy": 0, "golden": 0, "rotten": 0, "good": 0, "other": 0}
var stats := {
	"catches": 0,
	"golden_caught": 0,
	"rotten_caught": 0,
	"spills": 0,            # spill EVENTS (a cascade counts once)
	"mushrooms_spilled": 0,
	"largest_load": 0,
	"bashes": 0,
	"crashes": 0,
	"scan_points": 0,
}
var held_good := 0
var order_ready := false
var _last_spill_time := -10.0


func reset() -> void:
	for k in delivered.keys():
		delivered[k] = 0
	for k in stats.keys():
		stats[k] = 0
	held_good = 0
	order_ready = false
	_last_spill_time = -10.0


## How many good shrooms still need to be delivered.
func remaining() -> int:
	return maxi(0, required_good - int(delivered.good))


func update_held(cargo_counts: Dictionary) -> void:
	held_good = int(cargo_counts.get("good", 0))
	stats.largest_load = maxi(int(stats.largest_load), int(cargo_counts.get("total", 0)))
	var now_ready := held_good >= remaining() and remaining() > 0
	if now_ready != order_ready:
		order_ready = now_ready
		order_ready_changed.emit(order_ready)


func register_catch(data: Resource) -> void:
	stats.catches += 1
	if data.is_bonus():
		stats.golden_caught += 1
	if data.is_bad():
		stats.rotten_caught += 1


func register_spill(time_now: float) -> void:
	stats.mushrooms_spilled += 1
	if time_now - _last_spill_time > 0.8:
		stats.spills += 1
	_last_spill_time = time_now


func register_scan(type_id: StringName, response: Dictionary) -> void:
	var cat: StringName = response.get("category", &"none")
	stats.scan_points += int(response.get("points", 0))
	match cat:
		&"good", &"bonus":
			delivered.good += 1
			var key := String(type_id)
			if delivered.has(key):
				delivered[key] += 1
		&"bad":
			delivered.rotten += 1
		_:
			delivered.other += 1
	delivered_changed.emit(int(delivered.good), required_good)


func is_complete() -> bool:
	return int(delivered.good) >= required_good


func build_result(completion_time: float, reward_id: StringName) -> Dictionary:
	var golden := int(delivered.golden)
	var rotten := int(delivered.rotten)
	var score := int(stats.scan_points)
	score += int(maxf(0.0, 180.0 - completion_time) * 10.0)
	score -= int(stats.mushrooms_spilled) * 20
	score = maxi(0, score)
	var grade := "D"
	var bonus := golden >= bonus_golden
	if rotten == 0 and int(stats.mushrooms_spilled) == 0 and bonus and completion_time < 120.0:
		grade = "S"
	elif rotten == 0 and bonus and completion_time < 150.0:
		grade = "A"
	elif rotten <= 1 and completion_time < 180.0:
		grade = "B"
	elif rotten <= 3:
		grade = "C"
	return {
		"completed": true,
		"normal_delivered": int(delivered.normal),
		"bouncy_delivered": int(delivered.bouncy),
		"good_delivered": int(delivered.good),
		"golden_delivered": golden,
		"rotten_delivered": rotten,
		"bonus_achieved": bonus,
		"golden_caught": int(stats.golden_caught),
		"rotten_caught": int(stats.rotten_caught),
		"catches": int(stats.catches),
		"spills": int(stats.spills),
		"mushrooms_spilled": int(stats.mushrooms_spilled),
		"crashes": int(stats.crashes),
		"bashes": int(stats.bashes),
		"largest_load": int(stats.largest_load),
		"completion_time": snappedf(completion_time, 0.01),
		"score": score,
		"grade": grade,
		"reward_id": reward_id,
	}
