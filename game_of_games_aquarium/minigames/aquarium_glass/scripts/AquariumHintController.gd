extends Node
## Adaptive, escalating, mostly wordless hints.
##
## It watches what the player has actually learned and what keeps failing,
## works out the most likely MISUNDERSTANDING for the current puzzle stage
## ("diagnosis") and then, only while no meaningful progress is being made,
## escalates:
##
##   LEVEL 0  natural learning   - the aquarium demonstrates undiscovered
##                                 behaviours by itself now and then
##   LEVEL 1  creature nudge     - the relevant creature draws attention
##   LEVEL 2  80% demonstration  - the environment nearly does it
##   LEVEL 3  information panel  - the plaque by the tank starts glowing
##   LEVEL 4  "Need a hint?"     - optional; one short line about the
##                                 current misunderstanding
##
## Any meaningful progress resets/decreases the escalation.
## Delays are exported below; hint lines live in data/hint_texts.json.

const Stim = preload("GlassStimulus.gd")

signal hint_given(level: int, diagnosis: String)

@export var enabled := true
@export_group("Delays (seconds without meaningful progress)")
@export var level1_delay := 25.0
@export var level2_delay := 45.0
@export var level3_delay := 65.0
## Only offered when stuck on the SAME stage at least this long.
@export var level4_delay := 90.0
## Extra time to just play with the aquarium at the very beginning.
@export var first_stage_extra := 15.0
## Never two hints closer together than this.
@export var min_gap_between_hints := 14.0
## Re-run the current level's demonstration this often while still stuck.
@export var repeat_interval := 24.0
@export_group("Natural learning (level 0)")
## Average seconds between natural demonstrations of undiscovered behaviours.
@export var natural_demo_interval := 22.0
@export_group("Text")
@export_file("*.json") var hint_texts_path := "res://minigames/aquarium_glass/data/hint_texts.json"

var activity: Node
var stage := 0
var time_in_stage := 0.0
var time_since_progress := 0.0
var hint_level := 0
var hints_used := 0
var direct_hints_used := 0
var last_hint_time := -100.0
var last_hint_desc := ""
var diagnosis := ""

var gestures_discovered := {}
var responses := {}        # creature_id -> count (player caused, debounced)
var failed := {}           # kind -> count
var coward_player_bolts := 0
var coward_good_aims := 0
var coward_misses := 0
var shell_left_drift := 0.0
var offer_visible := false

var _resp_time := {}
var _level_done := {}
var _ambient_timer := 10.0
var _demo := ""
var _demo_t := 0.0
var _demo_step := 0
var _texts := {}
var _parasite: Node2D = null
var _offer_cooldown := 0.0


class Parasite:
	extends Node2D
	var activity: Node
	var health := 1.0
	var _t := 0.0
	var alive := false

	func can_be_bitten() -> bool:
		return alive and health > 0.0

	func bite_priority() -> float:
		return 8.0

	func bite_point() -> Vector2:
		return position + Vector2(0, -22)

	func take_bite(_from, _amount: float) -> bool:
		if not alive:
			return false
		health -= 0.12
		activity.water_fx.spawn_fragments(bite_point(), Color(0.95, 0.5, 0.6), 1)
		# Overenthusiastic: some bites land on the restraint next to it.
		if randf() < 0.35 and activity.shell.restraint_hp > 12.0:
			activity.shell.take_bite(null, 0.8)
		if health <= 0.0:
			alive = false
		return true

	func _process(delta: float) -> void:
		_t += delta
		visible = alive or health > -0.5
		if not alive:
			health -= delta
		queue_redraw()

	func _draw() -> void:
		if not alive:
			return
		var pts := PackedVector2Array()
		var h := 36.0 * clampf(health, 0.2, 1.0)
		for i in 9:
			var t := float(i) / 8.0
			pts.append(Vector2(sin(_t * 9.0 + t * 5.0) * 6.0 * t, -t * h))
		draw_polyline(pts, Color(0.95, 0.5, 0.6), 6.0)
		draw_circle(pts[8], 5.0, Color(1.0, 0.6, 0.7))
		draw_circle(pts[8] + Vector2(2, -1), 1.5, Color(0, 0, 0))


func setup(p_activity: Node) -> void:
	activity = p_activity
	_load_texts()
	_parasite = Parasite.new()
	_parasite.activity = activity
	_parasite.z_index = 1
	activity.add_child.call_deferred(_parasite)
	activity.shell.pushed.connect(_on_shell_pushed)
	activity.info_panel.opened.connect(_on_panel_opened)


func reset_hints() -> void:
	stage = 0
	time_in_stage = 0.0
	time_since_progress = 0.0
	hint_level = 0
	hints_used = 0
	direct_hints_used = 0
	last_hint_time = -100.0
	last_hint_desc = ""
	gestures_discovered = {}
	responses = {}
	failed = {}
	coward_player_bolts = 0
	coward_good_aims = 0
	coward_misses = 0
	shell_left_drift = 0.0
	_level_done = {}
	_demo = ""
	_ambient_timer = 10.0
	_set_offer(false)
	if _parasite:
		_parasite.alive = false


func get_bitables() -> Array:
	return [_parasite] if _parasite and _parasite.alive else []


# ================================================================ inputs

func notify_stage(s: int) -> void:
	stage = s
	time_in_stage = 0.0
	_major_progress()


func notify_progress(_kind: String, major: bool) -> void:
	if major:
		_major_progress()
	else:
		time_since_progress = 0.0
		if hint_level > 0:
			hint_level -= 1
		_clear_levels_above(hint_level)
		_set_offer(false)


func _major_progress() -> void:
	time_since_progress = 0.0
	hint_level = 0
	_level_done = {}
	_demo = ""
	_set_offer(false)
	activity.outside.set_panel_attention(false)


func record_gesture(kind: int) -> void:
	if not gestures_discovered.has(kind):
		gestures_discovered[kind] = true


func record_response(creature_id: String, kind: int) -> void:
	var now: float = activity.activity_time
	if now - float(_resp_time.get(creature_id, -10.0)) < 1.0:
		return
	_resp_time[creature_id] = now
	var first := not responses.has(creature_id)
	responses[creature_id] = int(responses.get(creature_id, 0)) + 1
	if creature_id == "coward" and kind == Stim.Kind.DOUBLE_TAP:
		coward_player_bolts += 1
	# Discovering how a creature reacts IS progress while exploring.
	if first and stage <= activity.Stage.CRACK_SHELL:
		notify_progress("discovered_" + creature_id, false)


func record_failed(kind: String) -> void:
	failed[kind] = int(failed.get(kind, 0)) + 1


func record_creature_event(_kind: String, _creature: Node, _data: Dictionary) -> void:
	pass


func record_coward_bolt_result(hit_shell: bool, min_dist: float) -> void:
	if hit_shell or min_dist < 150.0:
		coward_good_aims += 1
	else:
		coward_misses += 1
		if stage == activity.Stage.CRACK_SHELL:
			record_failed("coward_miss")


func _on_shell_pushed(dx: float) -> void:
	if stage == activity.Stage.PUSH_SHELL and dx < 0.0:
		shell_left_drift += -dx
		if shell_left_drift > 50.0:
			shell_left_drift = 0.0
			record_failed("blimp_wrong_way")


func _on_panel_opened() -> void:
	if hint_level >= 3:
		hints_used += 1


# ================================================================ understanding

func knows(what: String) -> bool:
	match what:
		"blimp": return int(responses.get("blimp", 0)) >= 2
		"bastards": return int(responses.get("bastards", 0)) >= 2
		"coward": return coward_player_bolts >= 1
		"coward_direction": return coward_good_aims >= 1
		"sucker": return int(responses.get("sucker", 0)) >= 1
	return false


## What is the player most likely missing right now?
func diagnose() -> String:
	var s: int = stage
	var covered: bool = not activity.shell.is_exposed()
	if s == activity.Stage.PUSH_SHELL or (covered and s <= activity.Stage.CRACK_SHELL):
		return "blimp_position" if knows("blimp") else "blimp_attract"
	if s == activity.Stage.BREAK_RESTRAINT:
		return "bastards_target" if knows("bastards") else "bastards_attract"
	if s == activity.Stage.CRACK_SHELL:
		if not knows("coward"):
			return "coward_startle"
		if not knows("coward_direction") or int(failed.get("coward_miss", 0)) >= 3 and coward_good_aims == 0:
			return "coward_direction"
		return "coward_timing"
	if s == activity.Stage.CHASE:
		return "chase_box"
	return ""


# ================================================================ update

func tick(delta: float) -> void:
	if not enabled or not activity.is_running():
		return
	time_in_stage += delta
	time_since_progress += delta
	_offer_cooldown -= delta
	diagnosis = diagnose()
	_run_demo(delta)
	var hintable: bool = stage in [activity.Stage.PUSH_SHELL, activity.Stage.BREAK_RESTRAINT, activity.Stage.CRACK_SHELL, activity.Stage.CHASE]
	if not hintable:
		_set_offer(false)
		return

	# Level 0: natural demonstrations of things not yet discovered.
	if stage != activity.Stage.CHASE:
		_ambient_timer -= delta
		if _ambient_timer <= 0.0 and _demo == "":
			_ambient_timer = randf_range(natural_demo_interval * 0.7, natural_demo_interval * 1.3)
			_natural_demo()

	var extra := first_stage_extra if stage == activity.Stage.PUSH_SHELL else 0.0
	var t := time_since_progress - extra
	var wanted := 0
	if t > level1_delay: wanted = 1
	if t > level2_delay: wanted = 2
	if t > level3_delay: wanted = 3
	if t > level4_delay and time_in_stage > level4_delay: wanted = 4
	if wanted > hint_level and activity.activity_time - last_hint_time > min_gap_between_hints:
		hint_level += 1
		_give_hint(hint_level)
	elif hint_level > 0 and activity.activity_time - last_hint_time > repeat_interval and _demo == "":
		# Still stuck: repeat the strongest demonstration we have unlocked (1 or 2).
		_give_hint(mini(hint_level, 2), true)


func debug_next_hint() -> void:
	diagnosis = diagnose()
	hint_level = mini(hint_level + 1, 4)
	_give_hint(hint_level)


func _give_hint(level: int, repeat := false) -> void:
	last_hint_time = activity.activity_time
	diagnosis = diagnose()
	if diagnosis == "":
		return
	if not repeat:
		hints_used += 1 if level >= 2 else 0
	match level:
		1:
			_level1(diagnosis)
		2:
			_level2(diagnosis)
		3:
			activity.outside.set_panel_attention(true)
			_level1(diagnosis)
		4:
			if _offer_cooldown <= 0.0:
				_set_offer(true)
	last_hint_desc = "L%d %s%s" % [level, diagnosis, " (repeat)" if repeat else ""]
	hint_given.emit(level, diagnosis)


# ================================================================ demonstrations

func _natural_demo() -> void:
	var options: Array = []
	if not knows("blimp"):
		options.append("blimp")
	if int(responses.get("coward", 0)) == 0:
		options.append("coward")
	if not knows("bastards"):
		options.append("bastards")
	if not knows("sucker"):
		options.append("sucker")
	if options.is_empty():
		return
	match options[randi() % options.size()]:
		"blimp":
			_bubble_pop_near(activity.blimp, 220.0)
		"coward":
			_bubble_startle(activity.coward, Vector2.ZERO)
		"bastards":
			var p = _nearest_puff(activity.bastards.swarm_center())
			if p:
				activity.bastards.hint_chew(p, 4.0)
		"sucker":
			var b: Rect2 = activity.aquarium_bounds
			activity.sucker.hint_attach_somewhere(activity.sucker.position.lerp(Vector2(activity.sucker.position.x, b.position.y + 140.0), 0.5))


func _level1(d: String) -> void:
	var shell: Node2D = activity.shell
	match d:
		"blimp_attract":
			# A bubble pops against the glass near the Blimp, between it and the shell. It goes to look.
			var dir = (shell.position - activity.blimp.position).normalized()
			_bubble_pop_at(activity.blimp.position + dir * 220.0)
		"blimp_position":
			activity.blimp.hint_look_towards(_behind_shell())
		"bastards_attract", "bastards_target":
			var p = _nearest_puff(shell.position)
			if p:
				activity.bastards.hint_chew(p, 5.0)
		"coward_startle":
			_bubble_startle(activity.coward, Vector2.ZERO)
		"coward_direction":
			# Demonstrate AWAY: a vibration behind it sends it straight across open water.
			var c: Node2D = activity.coward
			var to_center: Vector2 = (activity.aquarium_bounds.get_center() - c.position)
			var dir2 := to_center.normalized() if to_center.length() > 120.0 else Vector2.RIGHT
			_bubble_startle(c, dir2)
		"coward_timing":
			activity.coward.hint_drift_near(shell.position + Vector2(-60, -230), 16.0)
		"chase_box":
			activity.blimp.hint_bump_near(activity.idiot.chase_goal)


func _level2(d: String) -> void:
	match d:
		"blimp_attract", "blimp_position":
			_start_demo("blimp_push")
		"bastards_attract", "bastards_target":
			_spawn_parasite()
		"coward_startle", "coward_direction", "coward_timing":
			_start_demo("coward_near_miss")
		"chase_box":
			activity.blimp.hint_bump_near(activity.idiot.chase_goal)
			activity.idiot.velocity *= 0.3


func _start_demo(name: String) -> void:
	_demo = name
	_demo_t = 0.0
	_demo_step = 0


func _run_demo(delta: float) -> void:
	if _demo == "":
		return
	_demo_t += delta
	var shell: Node2D = activity.shell
	var blimp: Node2D = activity.blimp
	match _demo:
		"blimp_push":
			if _demo_step == 0:
				_bubble_pop_at(_behind_shell())
				_demo_step = 1
			elif _demo_step == 1:
				if blimp.position.distance_to(_behind_shell()) < 70.0 or _demo_t > 14.0:
					_demo_step = 2
					_demo_t = 0.0
			elif _demo_step == 2 and _demo_t > 0.8:
				# Pop on the far side, just past the shell edge: a small accidental nudge.
				var x: float = shell.position.x - (shell.body_radius + blimp.body_radius) + 60.0
				_bubble_pop_at(Vector2(x, shell.position.y))
				_demo = ""
		"coward_near_miss":
			var c: Node2D = activity.coward
			if _demo_step == 0:
				c.hint_drift_near(shell.position + Vector2(-80, -260), 18.0)
				_demo_step = 1
			elif _demo_step == 1:
				var to_shell: Vector2 = shell.position - c.position
				if (to_shell.length() < 560.0 and c.state == "drift") or _demo_t > 16.0:
					var dir := to_shell.normalized().rotated(0.24 * (1.0 if randf() > 0.5 else -1.0))
					_bubble_startle(c, dir)
					_demo = ""
	if _demo_t > 30.0:
		_demo = ""


func _spawn_parasite() -> void:
	var shell: Node2D = activity.shell
	if not shell.is_exposed():
		_start_demo("blimp_push")
		return
	_parasite.position = shell.position + Vector2(shell.body_radius * 0.95, activity.get_floor_y() - shell.position.y)
	_parasite.alive = true
	_parasite.health = 1.0
	activity.water_fx.spawn_sand(_parasite.position, 6)
	activity.bastards.hint_chew(_parasite, 7.0)


func _behind_shell() -> Vector2:
	var shell: Node2D = activity.shell
	var blimp: Node2D = activity.blimp
	return Vector2(shell.position.x - shell.body_radius - blimp.body_radius - 20.0, shell.position.y - 10.0)


func _bubble_pop_near(c: Node2D, dist: float) -> void:
	var p: Vector2 = c.position + Vector2.from_angle(randf() * TAU) * dist
	_bubble_pop_at(p)


func _bubble_pop_at(p: Vector2) -> void:
	var b: Rect2 = activity.aquarium_bounds.grow(-40.0)
	p = Vector2(clampf(p.x, b.position.x, b.end.x), clampf(p.y, b.position.y, b.end.y))
	activity.water_fx.spawn_bubbles(p + Vector2(0, 40), 6, 0.8)
	activity.emit_natural_stimulus(Stim.Kind.SINGLE_TAP, p, 160.0, 0.7)


## A bubble bursts right behind the Coward (opposite `dir`). dir = ZERO: random.
func _bubble_startle(c: Node2D, dir: Vector2) -> void:
	if dir == Vector2.ZERO:
		dir = Vector2.from_angle(randf() * TAU)
	var p: Vector2 = c.position - dir.normalized() * 90.0
	activity.emit_natural_stimulus(Stim.Kind.DOUBLE_TAP, p, 200.0, 0.8)


func _nearest_puff(p: Vector2):
	var best = null
	var bd := INF
	for bt in activity.environment.get_bitables():
		var d: float = bt.bite_point().distance_to(p)
		if d < bd:
			bd = d
			best = bt
	return best


func _clear_levels_above(level: int) -> void:
	for k in _level_done.keys():
		if int(k) > level:
			_level_done.erase(k)


# ================================================================ direct hint (level 4)

func _set_offer(v: bool) -> void:
	if offer_visible == v:
		return
	offer_visible = v
	if activity and activity.has_node("UI/HintUI"):
		activity.get_node("UI/HintUI").show_offer(v)


## Called by the UI when the player accepts "Need a hint?".
func accept_offer() -> void:
	_set_offer(false)
	direct_hints_used += 1
	hints_used += 1
	var d := diagnose()
	var text: String = _texts.get(d, "")
	if text != "":
		activity.get_node("UI/HintUI").show_text(text)
	_offer_cooldown = 45.0


func decline_offer() -> void:
	_set_offer(false)
	_offer_cooldown = 45.0


func _load_texts() -> void:
	_texts = {
		"blimp_attract": "The big one seems interested in vibrations.",
		"blimp_position": "To push something, the big one has to be behind it first.",
		"bastards_attract": "The little ones seem to enjoy chewing things.",
		"bastards_target": "The little ones bite whatever is near the commotion.",
		"coward_startle": "That nervous creature always flees AWAY from the noise.",
		"coward_direction": "Perhaps frightening it from the other side would help.",
		"coward_timing": "Wait until it lines up with the shell, then startle it from directly behind.",
		"chase_box": "It panics when it has nowhere left to go.",
	}
	if hint_texts_path != "" and FileAccess.file_exists(hint_texts_path):
		var data = JSON.parse_string(FileAccess.get_file_as_string(hint_texts_path))
		if data is Dictionary:
			for k in data.keys():
				if not str(k).begins_with("_"):
					_texts[k] = str(data[k])
