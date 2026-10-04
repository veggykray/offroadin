extends Node
## TEST-ONLY tuning probe (run with:  -- --probe ). Drives scripted manoeuvres
## with different load sizes and prints how much spilled, so trolley/spill
## tuning can be checked against the design goals with numbers, e.g.
##   "3 shrooms + sharp turn = safe", "12 shrooms + full-speed reversal = disaster".

var activity: Node
var _queue: Array = []
var _cur: Dictionary = {}
var _t := 0.0
var _spilled := 0
var _max_ratio := 0.0
var _max_speed := 0.0
var _stop_dist := 0.0
var _start_x := 0.0
var _phase_start_x := 0.0
var _peak_a := 0.0
var _peak_sway := 0.0

const SCENARIOS := {
	# name: list of [axis, seconds] steps (axis 9 = bash, 0 = coast)
	"push_from_rest": [[1, 0.9]],
	"push_then_coast": [[1, 0.9], [0, 1.2]],
	"push_then_tap_brake": [[1, 0.9], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 0.1], [-1, 0.06], [0, 1.0]],
	"push_then_hold_brake": [[1, 0.9], [-1, 0.4], [0, 1.0]],
	"full_reversal": [[1, 0.9], [-1, 1.2]],
	"half_speed_reversal": [[1, 0.45], [-1, 0.8]],
	"zigzag_short": [[1, 0.3], [-1, 0.3], [1, 0.3], [-1, 0.3], [0, 1.0]],
	"bash_from_rest": [[9, 0.02], [0, 1.2]],
	"bash_at_speed": [[1, 0.6], [9, 0.02], [0, 1.0]],
	"crash_into_wall": [[1, 3.0]],
}


func setup(a: Node, loads: Array) -> void:
	activity = a
	activity.adapter.use_virtual_input = true
	activity.audio.muted = true
	activity.cargo.spilled.connect(func(_m): _spilled += 1)
	for n in loads:
		for sname in SCENARIOS.keys():
			_queue.append({"name": sname, "load": n})
	print("probe: %-22s load  spilled  max_force/threshold  top_speed  start_x->end_x" % "scenario")
	_next()


func _next() -> void:
	if _queue.is_empty():
		print("probe: done")
		get_tree().quit()
		return
	_cur = _queue.pop_front()
	_cur.steps = SCENARIOS[_cur.name].duplicate(true)
	activity.reset_round()
	activity.events.enabled = false
	var tr: Node2D = activity.trolley
	# start on the left so there's room (crash test starts closer to the wall)
	var start_offset := 40.0
	if _cur.name == "crash_into_wall":
		start_offset = 500.0
	elif _cur.name in ["zigzag_short", "half_speed_reversal", "bash_from_rest"]:
		start_offset = 330.0
	tr.position.x = tr.min_x + start_offset
	activity.debug_fill(int(_cur.load))
	_spilled = 0
	_max_ratio = 0.0
	_max_speed = 0.0
	_peak_a = 0.0
	_peak_sway = 0.0
	_t = -0.6  # let the load settle first
	_start_x = tr.position.x


func _physics_process(delta: float) -> void:
	if activity == null or _cur.is_empty():
		return
	activity.spawner.running = false
	var ad: Node = activity.adapter
	_t += delta
	var c: Node = activity.cargo
	if _t > 0.0 and c.spill_threshold < 1e6:
		_max_ratio = maxf(_max_ratio, c.spill_force / c.spill_threshold)
	_max_speed = maxf(_max_speed, absf(activity.trolley.velocity))
	if _t > 0.0:
		_peak_a = maxf(_peak_a, absf(activity.trolley.last_dv) / delta)
		_peak_sway = maxf(_peak_sway, absf(c.sway))
	if _t < 0.0:
		ad.virtual_axis = 0.0
		return
	if _cur.steps.is_empty():
		print("probe: %-22s %4d  %7d  %19.2f  %9.0f  %.0f->%.0f   peak_a=%.0f peak_sway=%.1f" % [_cur.name, _cur.load, _spilled, _max_ratio, _max_speed, _start_x, activity.trolley.position.x, _peak_a, _peak_sway])
		_next()
		return
	var step: Array = _cur.steps[0]
	if step[0] == 9:
		ad.virtual_bash = true
		ad.virtual_axis = 0.0
	else:
		ad.virtual_axis = float(step[0])
	step[1] -= delta
	if step[1] <= 0.0:
		_cur.steps.pop_front()
