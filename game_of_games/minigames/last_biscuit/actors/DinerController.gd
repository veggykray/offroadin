class_name LBDiner
extends Node3D
## One silent, miserable dinner guest. Runs a learnable behaviour routine,
## reacts to noise, watches hands through LBGaze and judges them with
## LBSuspicion. Everything the diner perceives is expressed on the face and
## body (LBDinerVisual) instead of UI.

signal caught_hand(diner: LBDiner, hand: LBHand)

enum Behaviour { SLEEPER, GLASSES, TWITCH, DEAF_WATCHER, BLIND_LISTENER, CHEAT }

@export var behaviour: Behaviour = Behaviour.SLEEPER
## Plane position of the chair (x across, z along the table).
@export var seat := Vector2(-1.48, 2.4)
@export var display_name := "Diner"

@export_group("Hearing")
@export var hearing := 1.0
## Perceived loudness needed before the diner turns to look.
@export var noise_threshold := 0.14
@export var noise_look_time := 1.5
@export var reaction_delay := 0.2

@export_group("Head")
## Head turn speed in rad/s during routine looks.
@export var head_turn_speed := 2.2
@export var eye_turn_speed := 9.0
@export var eye_lead_deg := 32.0
## After the hand stops moving, how long the diner keeps staring at it.
@export var focus_hold := 1.4

@export_group("Sleeper")
@export var awake_time := Vector2(4.0, 6.0)
@export var drowsy_time := 2.2
@export var asleep_time := Vector2(7.0, 10.0)
## Chance per second (after 2 s asleep) of a sudden wake-up.
@export var sudden_wake_chance := 0.07
@export var wake_noise := 0.3

@export_group("Glasses")
@export var watch_time := Vector2(5.0, 7.0)
@export var polish_time := Vector2(4.8, 6.0)
@export var inspect_time := 1.9
@export var inspect_sensitivity := 1.3
## Readable tell: glasses travel back up to the face before she inspects.
@export var don_time := 0.55

@export_group("Twitch")
@export var twitch_cycle := Vector3(2.2, 4.0, 1.3)   # across, own plate, biscuit
@export var snap_interval := Vector2(5.0, 10.0)
@export var snap_tell := 0.35
@export var snap_hold := 0.9

@export_group("Deaf Watcher")
@export var sweep_period := 17.0
@export var sweep_near_z := 4.7
@export var sweep_far_z := -3.6

@export_group("Blind Listener")
## Suspicion gained per unit of perceived loudness made by a hand.
@export var listen_gain := 0.95
@export var fast_hand_gain := 0.25
## Cap on suspicion from any single noise.
@export var max_listen_gain := 0.25

@export_group("Cheat")
@export var mirror_scan_time := Vector2(3.0, 4.5)
@export var mirror_preen_time := 3.2
@export var mirror_range := 2.7
@export var mirror_half_angle := 15.0

@export_group("Look")
@export var palette_suit := Color(0.12, 0.12, 0.14)
@export var palette_skin := Color(0.84, 0.74, 0.7)
@export var palette_hair := Color(0.9, 0.9, 0.88)

var index := 0
var side := -1.0                  # -1 left of Bill, +1 right
var gaze: LBGaze
var mirror_gaze: LBGaze           # Cheat only: the teapot reflection
var suspicion: LBSuspicion
var visual: Node3D
var world: LBTableWorld
var manager                       # LBManager
var teapot: LBTableObject         # Cheat's mirror

# animated face / body state read by the visual
var head_dir := Vector2.RIGHT
var eye_dir := Vector2.RIGHT
var mirror_dir := Vector2(0, 1)
var mirror_open := 1.0
var lids := 0.1
var narrow := 0.0
var brow := 0.0
var brow_asym := 0.0
var lean := 0.0
var head_drop := 0.0
var glasses_off := 0.0
var pointing := 0.0
var point_at := Vector3.ZERO
var cup_ear := 0.0
var tic := 0.0
var jolt := 0.0
var mouth_open := 0.0
var head_tilt := 0.0
var teeth_out := false
var reaching := 0.0               # legit reach for the biscuit (comedy)
var sneeze_wind := 0.0
var glare := 0.0

# control
var state := ""
var state_t := 0.0
var state_dur := 1.0
var routine_target := Vector2.ZERO
var routine_speed_mult := 1.0
var focus_hand: LBHand = null
var focus_t := 0.0
var noise_target := Vector2.ZERO
var noise_until := -1.0
var _pending_noise: Array = []    # [time_due, pos, perceived]
var override_world: Variant = null  # Vector3 forced look (caught, events)
var override_until := -1.0
var override_speed := 1.0
var neutral_lock := false         # ending: stare straight ahead
var paused := false               # no judging (cutscenes)
var sensitivity_mult := 1.0
var look_dist := 2.5              # how far away the current focus is (head pitch)
var mirror_look_dist := 2.5
var _now := 0.0
var _scan_t := 0.0
var _scan_target := Vector2.ZERO
var _snap_timer := 6.0
var _snap_target := Vector2.ZERO
var _rng := RandomNumberGenerator.new()
var _last_expr_level := 0


func setup(i: int, w: LBTableWorld, m: Node) -> void:
	index = i
	world = w
	manager = m
	side = signf(seat.x)
	_rng.seed = 1000 + i * 77
	position = LBConst.p2w(seat, 0.0)
	head_dir = Vector2(-side, 0.0)
	eye_dir = head_dir
	gaze = LBGaze.new()
	gaze.name = "Gaze"
	gaze.world = w
	add_child(gaze)
	suspicion = LBSuspicion.new()
	suspicion.name = "Suspicion"
	add_child(suspicion)
	suspicion.caught.connect(func(h: LBHand): caught_hand.emit(self, h))
	suspicion.level_crossed.connect(_on_level)
	_configure_behaviour()
	visual = LBDinerVisual.new()
	visual.name = "Visual"
	add_child(visual)
	visual.setup(self)
	_enter_default_state()


func _configure_behaviour() -> void:
	gaze.peripheral_mult = 1.45
	gaze.peripheral_weight = 0.2
	match behaviour:
		Behaviour.SLEEPER:
			gaze.half_angle_deg = 19.0
			gaze.view_range = 3.2
		Behaviour.GLASSES:
			gaze.half_angle_deg = 20.0
			gaze.view_range = 3.4
		Behaviour.TWITCH:
			gaze.half_angle_deg = 17.0
			gaze.view_range = 3.3
		Behaviour.DEAF_WATCHER:
			gaze.half_angle_deg = 11.0
			gaze.view_range = 7.6
			gaze.peripheral_mult = 1.3
			hearing = 0.35
			noise_threshold = 0.42
			head_turn_speed = 0.9
		Behaviour.BLIND_LISTENER:
			gaze.sight = 0.0
			gaze.feel_radius = 0.55
			hearing = 1.8
			noise_threshold = 0.04
			head_turn_speed = 3.0
		Behaviour.CHEAT:
			gaze.half_angle_deg = 15.0
			gaze.view_range = 2.6
			gaze.peripheral_weight = 0.1
			mirror_gaze = LBGaze.new()
			mirror_gaze.name = "MirrorGaze"
			mirror_gaze.world = world
			mirror_gaze.half_angle_deg = mirror_half_angle
			mirror_gaze.view_range = mirror_range
			mirror_gaze.eye_height = 0.16
			mirror_gaze.peripheral_mult = 1.3
			mirror_gaze.peripheral_weight = 0.15
			add_child(mirror_gaze)


func eye_plane() -> Vector2:
	return seat + Vector2(-side * 0.16, 0.0)


func head_world() -> Vector3:
	return LBConst.p2w(eye_plane(), LBConst.TABLE_Y + 0.5)


func opposite_point() -> Vector2:
	return Vector2(-seat.x, seat.y)


func own_plate_point() -> Vector2:
	return Vector2(seat.x * 0.55, seat.y)


func reset_state() -> void:
	suspicion.reset()
	focus_hand = null
	noise_until = -1.0
	_pending_noise.clear()
	override_world = null
	pointing = 0.0
	lean = 0.0
	narrow = 0.0
	brow = 0.0
	glare = 0.0
	reaching = 0.0
	neutral_lock = false
	paused = false
	sensitivity_mult = 1.0
	_enter_default_state()


func _set_state(s: String, dur: float) -> void:
	state = s
	state_t = 0.0
	state_dur = dur


func _enter_default_state() -> void:
	match behaviour:
		Behaviour.SLEEPER: _set_state("awake", _rng.randf_range(awake_time.x, awake_time.y))
		Behaviour.GLASSES: _set_state("watch", _rng.randf_range(watch_time.x, watch_time.y))
		Behaviour.TWITCH: _set_state("across", twitch_cycle.x)
		Behaviour.DEAF_WATCHER: _set_state("sweep", 9999.0)
		Behaviour.BLIND_LISTENER: _set_state("listen", 9999.0)
		Behaviour.CHEAT: _set_state("scan", _rng.randf_range(mirror_scan_time.x, mirror_scan_time.y))
	routine_target = opposite_point()


# ------------------------------------------------------------------ update

func tick(dt: float, hands: Array, now: float) -> void:
	_now = now
	state_t += dt
	_process_pending_noise()
	routine_speed_mult = 1.0
	if not neutral_lock:
		_run_routine(dt)
	_choose_look(dt)
	_update_gazes()
	if not paused and not neutral_lock:
		_judge(hands, dt)
	_express(dt)


func _run_routine(dt: float) -> void:
	match behaviour:
		Behaviour.SLEEPER: _routine_sleeper(dt)
		Behaviour.GLASSES: _routine_glasses(dt)
		Behaviour.TWITCH: _routine_twitch(dt)
		Behaviour.DEAF_WATCHER: _routine_deaf(dt)
		Behaviour.BLIND_LISTENER: _routine_blind(dt)
		Behaviour.CHEAT: _routine_cheat(dt)


func _scan(dt: float, every: Vector2, choices: Array) -> void:
	_scan_t -= dt
	if _scan_t <= 0.0:
		_scan_t = _rng.randf_range(every.x, every.y)
		_scan_target = choices[_rng.randi() % choices.size()]
	routine_target = _scan_target


func _bill_hand_pos() -> Vector2:
	if manager and manager.player:
		return manager.player.plane_pos
	return LBConst.BILL_HAND_HOME


func _routine_sleeper(dt: float) -> void:
	match state:
		"awake":
			gaze.sight = 1.0
			lids = lerpf(lids, 0.22, LBConst.damp(3.0, dt))
			head_drop = lerpf(head_drop, 0.0, LBConst.damp(4.0, dt))
			_scan(dt, Vector2(1.6, 2.8), [opposite_point(), LBConst.BISCUIT_HOME, own_plate_point(),
					own_plate_point() + Vector2(0.0, 0.4), opposite_point()])
			if state_t > state_dur:
				_set_state("drowsy", drowsy_time)
		"drowsy":
			var k := state_t / state_dur
			lids = lerpf(0.3, 0.85, k)
			head_drop = 0.35 * k + 0.25 * maxf(0.0, sin(state_t * 5.0)) * k
			gaze.sight = lerpf(0.8, 0.25, k)
			routine_target = own_plate_point()
			if state_t > state_dur:
				_set_state("asleep", _rng.randf_range(asleep_time.x, asleep_time.y))
		"asleep":
			lids = lerpf(lids, 1.0, LBConst.damp(5.0, dt))
			head_drop = lerpf(head_drop, 1.0 + sin(state_t * 1.3) * 0.08, LBConst.damp(3.0, dt))
			gaze.sight = 0.0
			mouth_open = 0.3 + 0.3 * sin(state_t * 2.1)
			routine_target = own_plate_point()
			if state_t > 2.0 and _rng.randf() < sudden_wake_chance * dt:
				_wake(LBConst.BISCUIT_HOME.lerp(_bill_hand_pos(), _rng.randf_range(0.2, 0.9)))
			elif state_t > state_dur:
				_set_state("awake", _rng.randf_range(awake_time.x, awake_time.y))
				mouth_open = 0.0
		"jolt":
			lids = -0.15
			head_drop = lerpf(head_drop, 0.0, LBConst.damp(18.0, dt))
			gaze.sight = 1.0
			mouth_open = 0.0
			jolt = maxf(0.0, 1.0 - state_t * 2.0)
			routine_speed_mult = 4.0
			routine_target = _snap_target
			if state_t > state_dur:
				_set_state("awake", _rng.randf_range(awake_time.x, awake_time.y))
	if manager and manager.audio:
		manager.audio.snore(state == "asleep" and not paused, head_world())


func _wake(look_at_p: Vector2) -> void:
	_snap_target = look_at_p
	_set_state("jolt", 1.6)
	brow = 1.0
	if manager and manager.audio:
		manager.audio.play_at("gulp", head_world(), -6.0, 0.7)


func _routine_glasses(dt: float) -> void:
	if state != "don":
		head_drop = lerpf(head_drop, 0.0, LBConst.damp(4.0, dt))
	match state:
		"watch":
			glasses_off = lerpf(glasses_off, 0.0, LBConst.damp(8.0, dt))
			gaze.sight = 1.0
			sensitivity_mult = 1.0
			_scan(dt, Vector2(1.4, 2.4), [LBConst.BISCUIT_HOME, opposite_point(), Vector2(0.4, 1.0),
					Vector2(0.0, -1.2), opposite_point() + Vector2(0.0, -0.8), Vector2(0.3, -1.8)])
			if state_t > state_dur:
				_set_state("rub", 0.9)
		"rub":
			glasses_off = 0.25 + 0.1 * sin(state_t * 20.0)
			lids = 0.5
			if state_t > state_dur:
				_set_state("polish", _rng.randf_range(polish_time.x, polish_time.y))
		"polish":
			glasses_off = lerpf(glasses_off, 1.0, LBConst.damp(6.0, dt))
			gaze.sight = 0.06
			lids = 0.35
			routine_target = own_plate_point()
			if state_t > state_dur:
				_set_state("don", don_time)
		"don":
			# glasses rise back to the nose: FREEZE NOW
			glasses_off = lerpf(1.0, 0.0, clampf(state_t / state_dur, 0.0, 1.0))
			head_drop = lerpf(head_drop, -0.3, LBConst.damp(10.0, dt))   # chin up as they go on
			gaze.sight = 0.15
			lids = 0.1
			routine_target = own_plate_point() + Vector2(0.0, 0.3)
			if state_t > state_dur:
				_set_state("inspect", inspect_time)
		"inspect":
			glasses_off = lerpf(glasses_off, 0.0, LBConst.damp(14.0, dt))
			gaze.sight = 1.0
			lids = -0.1
			sensitivity_mult = inspect_sensitivity
			routine_speed_mult = 2.2
			var k := clampf(state_t / state_dur, 0.0, 1.0)
			routine_target = Vector2(0.0, 4.2).lerp(Vector2(0.0, -1.2), k)
			if state_t > state_dur:
				lids = 0.1
				_set_state("watch", _rng.randf_range(watch_time.x, watch_time.y))


func _routine_twitch(dt: float) -> void:
	_snap_timer -= dt
	match state:
		"across", "plate", "biscuit":
			tic = lerpf(tic, 0.0, LBConst.damp(10.0, dt))
			gaze.sight = 1.0 if state != "plate" else 0.6
			match state:
				"across": routine_target = opposite_point() + Vector2(0, sin(state_t) * 0.3)
				"plate": routine_target = own_plate_point() + Vector2(side * 0.1, 0.0)
				"biscuit": routine_target = LBConst.BISCUIT_HOME
			if _snap_timer <= 0.0:
				_set_state("tell", snap_tell)
			elif state_t > state_dur:
				match state:
					"across": _set_state("plate", twitch_cycle.y)
					"plate": _set_state("biscuit", twitch_cycle.z)
					"biscuit": _set_state("across", twitch_cycle.x)
		"tell":
			tic = 1.0
			if state_t > state_dur:
				var bill := _bill_hand_pos()
				if _rng.randf() < 0.4:
					_snap_target = bill + Vector2(_rng.randf_range(-0.5, 0.5), _rng.randf_range(-0.6, 0.6))
				else:
					_snap_target = Vector2(_rng.randf_range(-0.8, 0.8), _rng.randf_range(-1.0, 4.4))
				_set_state("snap", snap_hold)
		"snap":
			tic = lerpf(tic, 0.0, LBConst.damp(6.0, dt))
			routine_target = _snap_target
			routine_speed_mult = 9.0
			if state_t > state_dur:
				_snap_timer = _rng.randf_range(snap_interval.x, snap_interval.y)
				_set_state("across", twitch_cycle.x)


func _routine_deaf(_dt: float) -> void:
	gaze.sight = 1.0
	lids = -0.15
	# a slow lighthouse: lingers on the far end, sweeps down to Bill, returns
	var t := fmod(_now + float(index) * 3.0, sweep_period) / sweep_period
	var s: float
	if t < 0.35:
		s = 0.0                                   # far end (safe for Bill)
	elif t < 0.6:
		s = smoothstep(0.35, 0.6, t)              # sweeping towards Bill
	elif t < 0.72:
		s = 1.0                                   # staring down Bill's end
	else:
		s = 1.0 - smoothstep(0.72, 1.0, t)        # sweeping back
	routine_target = Vector2(sin(t * TAU * 2.0) * 0.2, lerpf(sweep_far_z, sweep_near_z, s))


func _routine_blind(dt: float) -> void:
	gaze.sight = 0.0
	lids = 0.0
	cup_ear = lerpf(cup_ear, 1.0 if _now < noise_until + 1.0 else 0.0, LBConst.damp(4.0, dt))
	head_tilt = lerpf(head_tilt, 0.25 if _now < noise_until else sin(_now * 0.4) * 0.1, LBConst.damp(3.0, dt))
	routine_target = opposite_point() + Vector2(0, sin(_now * 0.3) * 1.2)


func _routine_cheat(dt: float) -> void:
	# head always stares straight ahead; the teapot does the watching
	gaze.sight = 0.55
	match state:
		"scan":
			mirror_open = lerpf(mirror_open, 1.0, LBConst.damp(6.0, dt))
			var k := 0.5 - 0.5 * cos(state_t / state_dur * PI)
			var a := Vector2(0.15, 2.2)
			var b := Vector2(-0.35, 0.2)
			if int(_now / 9.0) % 2 == 1:
				var tmp := a
				a = b
				b = tmp
			routine_target = a.lerp(b, k)
			if state_t > state_dur:
				_set_state("preen", mirror_preen_time)
		"preen":
			mirror_open = lerpf(mirror_open, 0.0, LBConst.damp(5.0, dt))
			routine_target = Vector2(seat.x * 0.6, seat.y - 0.6)
			if state_t > state_dur:
				_set_state("scan", _rng.randf_range(mirror_scan_time.x, mirror_scan_time.y))


# ---------------------------------------------------------------- looking

func _choose_look(dt: float) -> void:
	var target := routine_target
	var turn := head_turn_speed * routine_speed_mult
	if focus_hand != null:
		focus_t -= dt
		if focus_hand.speed() > 0.25 and gaze_visibility(focus_hand) > 0.0:
			focus_t = maxf(focus_t, focus_hold + suspicion.get_value(focus_hand) * 1.5)
		if focus_t <= 0.0 or not focus_hand.active:
			focus_hand = null
		else:
			target = focus_hand.plane_pos
			turn = head_turn_speed * 1.8
	if _now < noise_until:
		target = noise_target
		turn = maxf(head_turn_speed * 2.5, 4.0)
	var desired: Vector2
	var origin := eye_plane()
	if override_world != null and (override_until < 0.0 or _now < override_until):
		var ow: Vector3 = override_world
		target = Vector2(ow.x, ow.z)
		turn = head_turn_speed * override_speed
	elif override_world != null:
		override_world = null
	if neutral_lock:
		target = opposite_point()
		turn = 6.0
	desired = (target - origin)
	if desired.length() < 0.01:
		desired = head_dir
	desired = desired.normalized()
	look_dist = lerpf(look_dist, clampf((target - origin).length(), 0.3, 9.0), LBConst.damp(turn * 1.5, dt))
	if behaviour == Behaviour.CHEAT and override_world == null and not neutral_lock:
		# the Cheat's head never moves: the mirror does
		mirror_look_dist = lerpf(mirror_look_dist, clampf((target - _mirror_origin()).length(), 0.3, 9.0), LBConst.damp(3.0, dt))
		look_dist = 2.6
		mirror_dir = _rotate_towards(mirror_dir, (target - _mirror_origin()).normalized(), turn * 1.2, dt)
		desired = Vector2(-side, 0.0)
		head_dir = _rotate_towards(head_dir, desired, 3.0, dt)
		eye_dir = _rotate_towards(eye_dir, desired, eye_turn_speed, dt)
		return
	# eyes snap ahead, head follows
	eye_dir = _rotate_towards(eye_dir, desired, eye_turn_speed * maxf(routine_speed_mult, 1.0), dt)
	head_dir = _rotate_towards(head_dir, desired, turn, dt)
	var lead := deg_to_rad(eye_lead_deg)
	var rel := head_dir.angle_to(eye_dir)
	if absf(rel) > lead:
		eye_dir = head_dir.rotated(signf(rel) * lead)


func _rotate_towards(cur: Vector2, want: Vector2, speed: float, dt: float) -> Vector2:
	var a := cur.angle_to(want)
	var step := clampf(a, -speed * dt, speed * dt)
	# ease near the end so heads settle rather than snap
	if absf(a) < 0.3:
		step = a * LBConst.damp(speed * 3.0, dt)
	return cur.rotated(step).normalized()


func _mirror_origin() -> Vector2:
	if teapot:
		return teapot.plane_pos
	return seat + Vector2(-side * 0.9, 1.4)


func _update_gazes() -> void:
	gaze.origin = eye_plane()
	gaze.dir = eye_dir
	gaze.focus_dist = look_dist
	if mirror_gaze:
		var ok := teapot != null and teapot.on_table and teapot.held_by == null and absf(teapot.wobble) < 0.2
		mirror_gaze.origin = _mirror_origin()
		mirror_gaze.dir = mirror_dir
		mirror_gaze.focus_dist = mirror_look_dist
		mirror_gaze.ignore_occluder = teapot
		mirror_gaze.sight = mirror_open if ok else 0.0


func gaze_visibility(h: LBHand) -> float:
	var v := gaze.visibility_of(h.plane_pos, 0.04 + h.height_above_table(), h.is_concealed())
	if mirror_gaze:
		v = maxf(v, mirror_gaze.visibility_of(h.plane_pos, 0.04 + h.height_above_table(), h.is_concealed()))
	return v


# ---------------------------------------------------------------- judging

func _judge(hands: Array, dt: float) -> void:
	suspicion.alertness = (manager.alertness if manager else 1.0) * sensitivity_mult
	for h: LBHand in hands:
		if not h.active or h.owner_index == index or h.reach_scale < 0.9 or h.innocent:
			continue
		var vis := gaze_visibility(h)
		var focused := focus_hand == h
		suspicion.observe(h, vis, dt, focused)
		if behaviour == Behaviour.BLIND_LISTENER:
			var d := h.plane_pos.distance_to(eye_plane())
			if h.speed() > 1.2 and d < 1.1:
				suspicion.add(h, fast_hand_gain * dt * (h.speed() - 1.2))
		var s := suspicion.get_value(h)
		if vis > 0.0 and s > LBSuspicion.LEVELS[0] and (focus_hand == null or s > suspicion.get_value(focus_hand)):
			if focus_hand != h:
				focus_hand = h
				focus_t = focus_hold + s
		if focus_hand == h and vis > 0.0 and h.speed() > suspicion.still_speed:
			focus_t = maxf(focus_t, focus_hold)


func _on_level(h: LBHand, lvl: int) -> void:
	if manager and manager.has_method("on_suspicion_level"):
		manager.on_suspicion_level(self, h, lvl)


func expression_level() -> float:
	var s: Array = suspicion.strongest()
	return s[1]


func _express(dt: float) -> void:
	var s := expression_level()
	var target_brow := 0.0
	var target_lean := 0.0
	var target_narrow := 0.0
	if s > LBSuspicion.LEVELS[1]:
		target_brow = 1.0
	if s > LBSuspicion.LEVELS[2]:
		target_lean = clampf((s - LBSuspicion.LEVELS[2]) / (1.0 - LBSuspicion.LEVELS[2]), 0.0, 1.0)
	if s > LBSuspicion.LEVELS[3]:
		target_narrow = 1.0
	if pointing > 0.0:
		target_brow = 1.0
		target_narrow = 1.0
		target_lean = 1.0
	if glare > 0.0:
		target_narrow = maxf(target_narrow, glare)
		target_brow = maxf(target_brow, glare * 0.6)
	if behaviour == Behaviour.SLEEPER and state == "jolt":
		target_brow = 1.0
	brow = lerpf(brow, target_brow, LBConst.damp(6.0, dt))
	lean = lerpf(lean, target_lean, LBConst.damp(3.0, dt))
	narrow = lerpf(narrow, target_narrow, LBConst.damp(5.0, dt))
	brow_asym = 0.6 if behaviour != Behaviour.DEAF_WATCHER else 0.0


# ---------------------------------------------------------------- noise

func on_noise(pos: Vector2, loudness: float, source: LBHand, kind: String) -> void:
	if neutral_lock or paused:
		return
	var d := pos.distance_to(eye_plane())
	var r := LBNoiseSystem.audible_radius(loudness)
	var falloff := clampf(1.0 - d / r, 0.0, 1.0)
	var perceived := loudness * hearing * falloff
	if kind == "swish" and behaviour != Behaviour.BLIND_LISTENER:
		return
	if behaviour == Behaviour.BLIND_LISTENER and source != null and source.owner_index != index:
		# one bang is "what was that?"; it takes a pattern of noises to accuse
		suspicion.add(source, minf(perceived * listen_gain, max_listen_gain))
	if perceived < noise_threshold:
		return
	if behaviour == Behaviour.SLEEPER and (state == "asleep" or state == "drowsy"):
		if perceived > wake_noise:
			_wake(pos)
		return
	if behaviour == Behaviour.GLASSES and state == "polish":
		state_dur = minf(state_dur, state_t + 0.8)   # hurries to put them back on (still via "don")
	var delay := reaction_delay * _rng.randf_range(0.7, 1.3)
	_pending_noise.append([_now + delay, pos, perceived])


func _process_pending_noise() -> void:
	var i := 0
	while i < _pending_noise.size():
		var e: Array = _pending_noise[i]
		if _now >= e[0]:
			noise_target = e[1]
			noise_until = _now + noise_look_time * (0.6 + minf(e[2], 1.5))
			_pending_noise.remove_at(i)
		else:
			i += 1


# --------------------------------------------------------------- scripted

## Force the diner to look at a world point (events, caught sequence).
func look_at_world(p: Vector3, duration := -1.0, speed := 1.0) -> void:
	override_world = p
	override_until = (_now + duration) if duration > 0.0 else -1.0
	override_speed = speed


func clear_override() -> void:
	override_world = null


func start_pointing(at: Vector3) -> void:
	point_at = at
	var tw := create_tween()
	tw.tween_property(self, "pointing", 1.0, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func stop_pointing() -> void:
	var tw := create_tween()
	tw.tween_property(self, "pointing", 0.0, 0.6)
