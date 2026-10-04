extends Node2D
## TEST-ONLY scene glue. This is roughly what the real Shroom Mart scene will
## do: listen for Bill wanting the trolley, call start_activity(bill), and react
## to activity_completed(result).
##
## Command-line options for automated testing (after a "--" separator):
##   --autoplay           a bot drives the trolley (see ShroomAutoPilot.gd)
##   --bot-style=careful|reckless
##   --shots=DIR          save screenshots to DIR every --shot-every seconds
##   --shot-every=SEC
##   --shot-start=SEC
##   --quit-after=SEC     quit (prints a summary)
##   --seed=N
##   --probe[=3,8,12]     run scripted spill-tuning manoeuvres (ShroomProbe.gd)
##   --events=id@sec,...  force random events (giant_shroom, shelf_burst, midair_collision, checkout_spit)
##   --apitest            exercise start/cancel/stop/complete + adapter restore, then quit
##   --prefill=N          drop N mushrooms straight into the trolley at start

@onready var activity: Node2D = $ShroomTrolleyActivity
@onready var bill: CharacterBody2D = $TestBill
@onready var camera: Camera2D = $TestCamera
@onready var prompt: Label = $UI/Prompt

var _args := {}
var _shot_dir := ""
var _shot_every := 1.0
var _shot_timer := 0.0
var _shot_n := 0
var _quit_after := -1.0
var _time := 0.0
var _bot: Node


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		_args[kv[0]] = kv[1] if kv.size() > 1 else "true"
	if _args.has("seed"):
		seed(int(_args.seed))
	bill.grab_requested.connect(_on_bill_grab)
	activity.activity_started.connect(func(): print("[test] activity_started"))
	activity.activity_completed.connect(_on_completed)
	activity.activity_cancelled.connect(func(): print("[test] activity_cancelled"))
	activity.phase_changed.connect(func(i, n): print("[test] phase %d %s  t=%.1f" % [i, n, activity.round_time]))
	# The mini-game's camera interface -> our test camera.
	activity.camera_impulse_requested.connect(camera.request_camera_impulse)
	if _args.has("shots"):
		_shot_dir = _args.shots
		DirAccess.make_dir_recursive_absolute(_shot_dir)
		_shot_every = float(_args.get("shot-every", "1.0"))
	_quit_after = float(_args.get("quit-after", "-1"))
	if _args.has("events"):
		# e.g. --events=giant_shroom@5,shelf_burst@9  (seconds after start)
		for spec in String(_args.events).split(","):
			var parts := spec.split("@")
			var id := StringName(parts[0])
			get_tree().create_timer(float(parts[1]) if parts.size() > 1 else 5.0).timeout.connect(func(): activity.events.trigger(id))
	if _args.has("apitest"):
		_run_api_test.call_deferred()
		return
	if _args.has("probe"):
		activity.start_activity(bill)
		var probe: Node = preload("ShroomProbe.gd").new()
		add_child(probe)
		var loads := [3, 8, 10, 12, 14]
		if _args.probe != "true":
			loads = Array(_args.probe.split(",")).map(func(x): return int(x))
		probe.setup.call_deferred(activity, loads)
		return
	if _args.has("autoplay"):
		_bot = preload("ShroomAutoPilot.gd").new()
		_bot.style = _args.get("bot-style", "careful")
		add_child(_bot)
		_bot.setup(activity)
		activity.audio.muted = true
		activity.start_activity(bill)
		if _args.has("prefill"):
			get_tree().create_timer(1.2).timeout.connect(func(): activity.debug_fill(int(_args.prefill)))


func _on_bill_grab() -> void:
	if activity.is_running():
		return
	# Only when Bill is next to the trolley handle.
	var d: float = absf(bill.global_position.x - activity.trolley.get_handle_global_position().x)
	if d < 110.0:
		activity.start_activity(bill)
		if _args.has("prefill"):
			get_tree().create_timer(1.2).timeout.connect(func(): activity.debug_fill(int(_args.prefill)))


func _on_completed(result: Dictionary) -> void:
	print("[test] activity_completed: ", JSON.stringify(result))
	print("[test] reward: ", result.reward_id)


func _process(delta: float) -> void:
	_time += delta
	var near: bool = absf(bill.global_position.x - activity.trolley.get_handle_global_position().x) < 110.0
	if activity.is_running():
		prompt.text = "A/D or ←/→ push   SPACE bash   S/↓ dump at checkout   Esc quit   F1 debug"
	elif not activity.get_result().is_empty():
		prompt.text = "Order complete!  Press E at the trolley to play again   (F5 reset)"
	elif near:
		prompt.text = "Press E to grab the trolley"
	else:
		prompt.text = "Walk to the trolley (A/D)"
	if _shot_dir != "" and _time >= float(_args.get("shot-start", "0")):
		_shot_timer += delta
		if _shot_timer >= _shot_every:
			_shot_timer = 0.0
			_save_shot()
	if _quit_after > 0.0 and _time >= _quit_after:
		if _bot:
			_bot.print_summary()
		get_tree().quit()


func _save_shot() -> void:
	var img := get_viewport().get_texture().get_image()
	if img:
		img.save_png("%s/shot_%04d.png" % [_shot_dir, _shot_n])
		_shot_n += 1


# --- API smoke test (-- --apitest) ---------------------------------------------

func _run_api_test() -> void:
	var log := []
	var ok := true
	var seen := {}
	activity.activity_started.connect(func(): seen.started = int(seen.get("started", 0)) + 1)
	activity.activity_cancelled.connect(func(): seen.cancelled = int(seen.get("cancelled", 0)) + 1)
	activity.activity_stopped.connect(func(): seen.stopped = int(seen.get("stopped", 0)) + 1)
	activity.activity_completed.connect(func(r): seen.completed = r)
	var layer_before := bill.collision_layer
	activity.audio.muted = true
	# 1. start -> Bill is taken over
	activity.start_activity(bill)
	await get_tree().create_timer(1.5).timeout
	ok = _check(log, ok, "started signal", seen.get("started", 0) == 1)
	ok = _check(log, ok, "bill collision off while pushing", bill.collision_layer == 0)
	ok = _check(log, ok, "bill glued to handle", absf(bill.global_position.x - activity.trolley.get_handle_global_position().x) < 40.0)
	ok = _check(log, ok, "running", activity.is_running())
	# 2. cancel -> Bill given back
	activity.cancel_activity()
	ok = _check(log, ok, "cancelled signal", seen.get("cancelled", 0) == 1)
	ok = _check(log, ok, "bill collision restored", bill.collision_layer == layer_before)
	ok = _check(log, ok, "bill not pushing", not bill.pushing)
	ok = _check(log, ok, "not running", not activity.is_running())
	# 3. start again, stop
	activity.start_activity(bill)
	await get_tree().create_timer(1.2).timeout
	activity.stop_activity()
	ok = _check(log, ok, "stopped signal", seen.get("stopped", 0) == 1)
	ok = _check(log, ok, "bill restored after stop", bill.collision_layer == layer_before and not bill.pushing)
	# 4. start, cheat the order, drive to checkout, dump -> completed with reward
	activity.start_activity(bill)
	await get_tree().create_timer(1.2).timeout
	activity.debug_fill(activity.required_good + 1)
	activity.adapter.use_virtual_input = true
	var t := 0.0
	while not seen.has("completed") and t < 25.0:
		var dock: float = activity.checkout.get_dock_x()
		var x: float = activity.trolley.global_position.x
		activity.adapter.virtual_axis = clampf((dock - x) / 150.0, -1.0, 1.0) * (0.0 if absf(dock - x) < 25.0 else 1.0)
		if activity.checkout.is_docked(x, activity.trolley.velocity):
			activity.adapter.virtual_dump = true
		await get_tree().physics_frame
		t += get_physics_process_delta_time()
	ok = _check(log, ok, "completed signal", seen.has("completed"))
	if seen.has("completed"):
		var r: Dictionary = seen.completed
		ok = _check(log, ok, "reward id", r.get("reward_id") == &"perfect_little_shroom")
		ok = _check(log, ok, "result has fields", r.has("good_delivered") and r.has("completion_time") and r.has("largest_load") and r.has("spills"))
		ok = _check(log, ok, "delivered >= required", int(r.good_delivered) >= activity.required_good)
		print("[apitest] result: ", JSON.stringify(r))
	ok = _check(log, ok, "bill released after completion", not bill.pushing and bill.collision_layer == layer_before)
	# 5. a player with NO hook functions at all (adapter fallback path)
	var plain := CharacterBody2D.new()
	plain.collision_layer = 3
	add_child(plain)
	plain.set_physics_process(true)
	activity.adapter.use_virtual_input = false
	activity.start_activity(plain)
	await get_tree().create_timer(0.5).timeout
	ok = _check(log, ok, "plain player: processing paused", not plain.is_physics_processing() and plain.collision_layer == 0)
	ok = _check(log, ok, "plain player: glued to trolley", absf(plain.global_position.x - activity.trolley.get_handle_global_position().x) < 40.0)
	activity.cancel_activity()
	ok = _check(log, ok, "plain player: processing restored", plain.is_physics_processing() and plain.collision_layer == 3)
	for l in log:
		print("[apitest] ", l)
	print("[apitest] ", "ALL PASSED" if ok else "FAILED")
	get_tree().quit(0 if ok else 1)


func _check(log: Array, ok: bool, name: String, cond: bool) -> bool:
	log.append(("PASS  " if cond else "FAIL  ") + name)
	return ok and cond
