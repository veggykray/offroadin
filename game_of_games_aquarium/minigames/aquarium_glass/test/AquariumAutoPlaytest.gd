extends Node
## Automated play-tester (test scene only). Plays the whole activity through
## REAL mouse events pushed into the viewport - taps, double taps, scratches,
## rubs and knocks - like a reasonably competent player, and logs timings.
##
##   godot --path . -- --autoplay            play through
##   godot --path . -- --autoplay --shots    + screenshots to user://aquarium_shots/
##   godot --path . -- --autoplay --idle     never touch the glass: watch the hint system
##   add --fast for 3x speed

var take_screenshots := false
var fast := false
var idle_mode := false
var chase_only := false
## Human-like imprecision for the chase.
var aim_error := 70.0
var think_time := 0.35
var max_knocks := 3

var activity: Node2D
var _log: PackedStringArray = []
var _start_ms := 0
var _last_stage := ""
var _shot_n := 0
var _pressed := false


func _ready() -> void:
	activity = get_parent().get_node("AquariumActivity")
	if fast:
		Engine.time_scale = 3.0
	_start_ms = Time.get_ticks_msec()
	activity.stage_changed.connect(func(s): _note("STAGE -> " + s))
	activity.hints.hint_given.connect(func(l, d): _note("HINT level %d (%s)" % [l, d]))
	activity.activity_completed.connect(_on_done)
	if take_screenshots:
		DirAccess.make_dir_recursive_absolute(OS.get_user_data_dir() + "/aquarium_shots")
	_run.call_deferred()


func _note(msg: String) -> void:
	var line := "[%6.1fs | %2d fps] %s" % [activity.activity_time, Engine.get_frames_per_second(), msg]
	_log.append(line)
	print(line)


func _shot(name: String) -> void:
	if not take_screenshots:
		return
	await RenderingServer.frame_post_draw
	_shot_n += 1
	var img := get_viewport().get_texture().get_image()
	var path := OS.get_user_data_dir() + "/aquarium_shots/%02d_%s.png" % [_shot_n, name]
	img.save_png(path)
	print("screenshot ", path)


func _on_done(data: Dictionary) -> void:
	_note("COMPLETED " + str(data))
	await get_tree().create_timer(2.0).timeout
	await _shot("complete")
	print("AUTOPLAY SUMMARY\n" + "\n".join(_log))
	get_tree().quit()


func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


# ------------------------------------------------------------- real input

func _mouse_button(p: Vector2, pressed: bool, button := MOUSE_BUTTON_LEFT) -> void:
	var ev := InputEventMouseButton.new()
	ev.button_index = button
	ev.pressed = pressed
	ev.position = p
	ev.global_position = p
	get_viewport().push_input(ev, true)


func _mouse_move(p: Vector2) -> void:
	var ev := InputEventMouseMotion.new()
	ev.position = p
	ev.global_position = p
	ev.button_mask = MOUSE_BUTTON_MASK_LEFT if _pressed else 0
	get_viewport().push_input(ev, true)


func _g(p: Vector2) -> Vector2:
	# activity-local -> viewport (camera is centred on the test scene, zoom 1)
	return activity.get_global_transform_with_canvas() * p


func tap(p: Vector2) -> void:
	_mouse_move(_g(p))
	_mouse_button(_g(p), true)
	_pressed = true
	await _wait(0.07)
	_mouse_button(_g(p), false)
	_pressed = false
	await _wait(0.4)


func double_tap(p: Vector2) -> void:
	_mouse_button(_g(p), true)
	await _wait(0.06)
	_mouse_button(_g(p), false)
	await _wait(0.12)
	_mouse_button(_g(p + Vector2(4, 3)), true)
	await _wait(0.06)
	_mouse_button(_g(p + Vector2(4, 3)), false)
	await _wait(0.2)


func scratch(p: Vector2, duration: float) -> void:
	_mouse_move(_g(p))
	_mouse_button(_g(p), true)
	_pressed = true
	var t := 0.0
	var i := 0
	while t < duration:
		var off := Vector2(28.0 if i % 2 == 0 else -28.0, randf_range(-8, 8))
		_mouse_move(_g(p + off))
		await _wait(0.03)
		t += 0.03
		i += 1
	_mouse_button(_g(p), false)
	_pressed = false


func rub(from: Vector2, to: Vector2, duration: float) -> void:
	_mouse_move(_g(from))
	_mouse_button(_g(from), true)
	_pressed = true
	var t := 0.0
	while t < duration:
		var k := t / duration
		var p := from.lerp(to, k) + Vector2(0, sin(k * TAU * 2.0) * 20.0)
		_mouse_move(_g(p))
		await _wait(0.03)
		t += 0.03
	_mouse_button(_g(to), false)
	_pressed = false


func knock(p: Vector2) -> void:
	_mouse_move(_g(p))
	_mouse_button(_g(p), true, MOUSE_BUTTON_RIGHT)
	await _wait(0.05)
	_mouse_button(_g(p), false, MOUSE_BUTTON_RIGHT)


# ------------------------------------------------------------- the playthrough

func _run() -> void:
	await _wait(1.0)
	await _shot("start")
	if idle_mode:
		_note("IDLE MODE: not touching anything")
		await _wait(200.0)
		print("IDLE SUMMARY\n" + "\n".join(_log))
		get_tree().quit()
		return

	var shell: Node2D = activity.shell
	var blimp: Node2D = activity.blimp
	var coward: Node2D = activity.coward
	if chase_only:
		activity.debug_command("open_shell")
		await _until(func(): return activity.get_stage_name() == "chase", 15.0)
		await _chase(coward)
		print("CHASE RESULT %.1f %s" % [activity.stat_chase_time, str(activity.idiot.pressure_sources)])
		get_tree().quit()
		return

	# --- Experiment like a new player.
	_note("tap near the blimp")
	await tap(blimp.position + Vector2(220, -60))
	await _wait(2.0)
	await _shot("first_tap")
	await rub(activity.sucker.position + Vector2(-200, 80), activity.sucker.position + Vector2(-60, 120), 1.6)
	await _wait(2.5)
	await _shot("sucker_attached")
	await scratch(activity.bastards.swarm_center() + Vector2(-150, 0), 1.0)
	await _wait(1.5)

	# --- Step 1: get the Blimp behind the shell, then push.
	var tries := 0
	while activity.get_stage_name() == "push_shell" and tries < 12:
		tries += 1
		var behind := Vector2(shell.position.x - shell.body_radius - blimp.body_radius - 15.0, 745.0)
		if blimp.position.x > shell.position.x - 60.0:
			_note("route blimp up and over to the left")
			await tap(Vector2(behind.x - 40.0, 420.0))
			await _until(func(): return blimp.position.distance_to(Vector2(behind.x - 40.0, 420.0)) < 90.0, 14.0)
		await tap(behind)
		await _until(func(): return blimp.position.distance_to(behind) < 60.0, 12.0)
		if tries == 1:
			await _shot("blimp_behind")
		_note("tap beyond the shell to push (blimp at %s)" % str(blimp.position.round()))
		await tap(Vector2(shell.position.x + 300.0, 745.0))
		await _until(func(): return blimp.state != "approach", 12.0)
		if tries == 1:
			await _shot("pushed")
		await _wait(0.5)
	_note("push stage done after %d tries" % tries)

	# --- Step 2: scratch at the restraint.
	tries = 0
	while activity.get_stage_name() == "break_restraint" and tries < 20:
		tries += 1
		await scratch(shell.position + Vector2(0, -90), 1.5)
		if tries == 2:
			await _shot("bastards_biting")
		await _wait(1.0)
	_note("restraint stage done after %d scratches" % tries)

	# --- Step 3: aim the Coward.
	tries = 0
	while activity.get_stage_name() == "crack_shell" and tries < 40:
		var to: Vector2 = shell.position + Vector2(0, -20) - coward.position
		var clear := _line_clear(coward.position, shell.position)
		if to.length() < 650.0 and clear and coward.state == "drift":
			tries += 1
			var dir := to.normalized()
			_note("double tap behind coward (attempt %d, dist %d)" % [tries, int(to.length())])
			await double_tap(coward.position - dir * 70.0)
			await _wait(0.25)
			if tries == 1:
				await _shot("coward_bolt")
			await _wait(2.5)
		else:
			# Nudge it towards the shell with a gentle single tap behind it.
			if to.length() >= 650.0 and coward.state == "drift":
				await tap(coward.position - to.normalized() * 110.0)
			await _wait(0.8)
	_note("crack stage done after %d attempts" % tries)

	await _until(func(): return activity.get_stage_name() == "idiot_theft", 6.0)
	await _wait(2.5)
	await _shot("idiot_stare")
	await _until(func(): return activity.get_stage_name() == "chase", 10.0)

	await _chase(coward)
	_note("chase over: %.1fs  pressure from %s" % [activity.stat_chase_time, str(activity.idiot.pressure_sources)])
	await _finale()


func _chase(coward: Node2D) -> void:
	# --- Chase: use the ecosystem, with human-ish aim (lag + error).
	var chase_t := 0.0
	var knocked := 0
	var idiot: Node2D = activity.idiot
	var seen := idiot.position
	while activity.get_stage_name() == "chase" and chase_t < 150.0:
		var aim_err := Vector2(randf_range(-1, 1), randf_range(-1, 1)) * aim_error
		var ip: Vector2 = seen + aim_err
		seen = idiot.position   # what we react to next time = where it was ~a moment ago
		var r := randf()
		if r < 0.6:
			await scratch(ip, 0.7)
			chase_t += 0.7
		elif r < 0.85:
			await tap(ip)
			chase_t += 0.5
		else:
			var tc: Vector2 = idiot.position - coward.position
			if tc.length() < 450.0 and coward.state == "drift":
				await double_tap(coward.position - tc.normalized().rotated(randf_range(-0.3, 0.3)) * 70.0)
				chase_t += 0.5
		await _wait(think_time)
		chase_t += think_time
		if knocked < max_knocks and chase_t > 10.0 * (knocked + 1):
			knocked += 1
			await knock(idiot.position + Vector2(randf_range(-80, 80), randf_range(-60, 60)))
			if knocked == 3:
				await _shot("knock_3")
		if absf(chase_t - 10.0) < 0.7:
			await _shot("chase")


func _finale() -> void:

	await _until(func(): return activity.get_stage_name() == "calm", 30.0)
	await _until(func(): return activity.get_stage_name() == "finale_wait", 30.0)
	await _shot("giant_at_glass")
	await _wait(2.0)
	_note("tapping the glass. obviously.")
	await tap(activity.aquarium_bounds.get_center() + Vector2(80, 120))
	await _wait(4.3)
	await _shot("giant_taps_back")


func _until(cond: Callable, timeout: float) -> void:
	var t := 0.0
	while not cond.call() and t < timeout:
		await _wait(0.1)
		t += 0.1


func _line_clear(a: Vector2, b: Vector2) -> bool:
	for o in activity.obstacles:
		var ab := b - a
		var t := clampf((o.pos - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
		if (a + ab * t).distance_to(o.pos) < o.r + 15.0:
			return false
	return true
