class_name GestureRecognizer
extends Node
## Turns raw mouse / touch input into physical gestures: poke, hold, stroke,
## rub, scratch and rhythmic tapping. Works purely in screen space so the
## thresholds below mean the same thing at any camera position.
##
## Reusable: drop it in any scene, connect `gesture_detected`. Feed it events
## automatically (it listens to _input) or manually via feed_press / feed_motion
## / feed_release / update for tests and replays.

signal gesture_detected(g: Gesture)  ## INSTANT pokes/rhythm and continuous TICKs
signal gesture_began(g: Gesture)
signal gesture_ended(g: Gesture)
signal pointer_moved(screen_pos: Vector2, pressed: bool, velocity: Vector2)
signal type_changed(type: int)

@export var enabled := true
## When true the recogniser ignores _input/_process; drive it with feed_* calls.
@export var external_clock := false

@export_group("Poke")
## Movement (px) above which a press can no longer be a poke.
@export var poke_max_movement := 16.0
## Presses shorter than this are "sharp" pokes (full intensity).
@export var poke_sharp_duration := 0.18

@export_group("Hold")
@export var hold_min_duration := 0.42
## Maximum wander (px) inside the analysis window that still counts as holding still.
@export var hold_max_drift := 26.0

@export_group("Analysis")
## Seconds of recent movement analysed to classify the gesture.
@export var analysis_window := 0.55
@export var tick_interval := 0.1
## Px of counter-movement needed to count a direction reversal (filters jitter).
@export var reversal_hysteresis := 6.0
## Seconds a different classification must persist before we switch to it.
@export var classification_hysteresis := 0.16

@export_group("Stroke")
@export var stroke_min_speed := 45.0
@export var stroke_min_straightness := 0.72
@export var stroke_min_length := 30.0

@export_group("Rub")
@export var rub_max_extent := 300.0
@export var rub_min_reversal_rate := 1.2
## Radians of turning per second that counts as circular rubbing.
@export var rub_min_turn_rate := 5.5

@export_group("Scratch")
@export var scratch_max_extent := 110.0
@export var scratch_min_reversal_rate := 4.5
@export var scratch_min_speed := 200.0

@export_group("Rhythm")
@export var rhythm_min_taps := 3
@export var rhythm_min_interval := 0.16
@export var rhythm_max_interval := 1.4
## Max coefficient of variation of tap intervals to still be "a rhythm".
@export var rhythm_max_irregularity := 0.38

var pressed := false
var current_type: int = Gesture.Type.NONE
var pointer_pos := Vector2.ZERO
var last_analysis := {}

var _samples: Array = []  # [{p: Vector2, t: float}]
var _press_time := 0.0
var _press_pos := Vector2.ZERO
var _max_drift := 0.0
var _type_since := 0.0
var _pending_type: int = Gesture.Type.NONE
var _pending_since := 0.0
var _last_tick := 0.0
var _gesture_path := 0.0
var _taps: Array = []  # tap times
var _last_motion_pos := Vector2.ZERO
var _last_motion_time := 0.0
var _velocity := Vector2.ZERO


func now() -> float:
	return Time.get_ticks_usec() / 1000000.0


func _input(event: InputEvent) -> void:
	if external_clock:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			feed_press(event.position, now())
		else:
			feed_release(event.position, now())
	elif event is InputEventMouseMotion:
		feed_motion(event.position, now())
	elif event is InputEventScreenTouch:
		if event.pressed:
			feed_press(event.position, now())
		else:
			feed_release(event.position, now())
	elif event is InputEventScreenDrag:
		feed_motion(event.position, now())


func _process(_delta: float) -> void:
	if not external_clock:
		update(now())


# --- Feeding -----------------------------------------------------------------

func feed_press(pos: Vector2, t: float) -> void:
	pointer_pos = pos
	if not enabled:
		return
	pressed = true
	_press_time = t
	_press_pos = pos
	_max_drift = 0.0
	_samples.clear()
	_samples.append({"p": pos, "t": t})
	_set_type(Gesture.Type.NONE, t)
	_pending_type = Gesture.Type.NONE
	_gesture_path = 0.0
	_last_tick = t


func feed_motion(pos: Vector2, t: float) -> void:
	var dt := t - _last_motion_time
	if dt > 0.0001:
		var v := (pos - _last_motion_pos) / dt
		_velocity = _velocity.lerp(v, clampf(dt * 20.0, 0.0, 1.0))
	_last_motion_pos = pos
	_last_motion_time = t
	if pressed:
		_gesture_path += pos.distance_to(pointer_pos)
		_max_drift = maxf(_max_drift, pos.distance_to(_press_pos))
	pointer_pos = pos
	pointer_moved.emit(pos, pressed, _velocity)


func feed_release(pos: Vector2, t: float) -> void:
	pointer_pos = pos
	if not pressed:
		return
	pressed = false
	var dur := t - _press_time
	if _max_drift <= poke_max_movement and dur < hold_min_duration and current_type == Gesture.Type.NONE:
		_register_tap(pos, t, dur)
	elif current_type != Gesture.Type.NONE:
		var g := _make(current_type, Gesture.Phase.END, t)
		gesture_ended.emit(g)
	_set_type(Gesture.Type.NONE, t)
	_samples.clear()


func update(t: float) -> void:
	if not pressed:
		# Decay hover velocity so the hand settles.
		if t - _last_motion_time > 0.05:
			_velocity = _velocity.lerp(Vector2.ZERO, 0.2)
		return
	_samples.append({"p": pointer_pos, "t": t})
	while _samples.size() > 2 and _samples[0].t < t - 1.6:
		_samples.pop_front()

	var cls := _classify(t)
	if cls != current_type and cls != Gesture.Type.NONE:
		if current_type == Gesture.Type.NONE:
			_switch(cls, t)
		elif cls == _pending_type:
			if t - _pending_since >= classification_hysteresis:
				_switch(cls, t)
		else:
			_pending_type = cls
			_pending_since = t
	else:
		_pending_type = cls

	if current_type != Gesture.Type.NONE and t - _last_tick >= tick_interval:
		var g := _make(current_type, Gesture.Phase.TICK, t)
		g.dt = clampf(t - _last_tick, 0.0, 0.25)
		_last_tick = t
		gesture_detected.emit(g)


# --- Classification ----------------------------------------------------------

func _classify(t: float) -> int:
	var dur := t - _press_time
	var a := _analyse(t)
	last_analysis = a
	if dur < hold_min_duration and _max_drift <= poke_max_movement:
		return Gesture.Type.NONE  # might still become a poke
	if a.extent <= scratch_max_extent and a.rev_rate >= scratch_min_reversal_rate and a.speed >= scratch_min_speed:
		return Gesture.Type.SCRATCH
	if a.extent < hold_max_drift:
		return Gesture.Type.HOLD if dur >= hold_min_duration else Gesture.Type.NONE
	var straight: float = a.net / maxf(a.path, 0.001)
	if straight >= stroke_min_straightness and a.speed >= stroke_min_speed and a.path >= stroke_min_length:
		return Gesture.Type.STROKE
	if a.extent <= rub_max_extent and (a.rev_rate >= rub_min_reversal_rate or a.turn_rate >= rub_min_turn_rate):
		return Gesture.Type.RUB
	if a.speed >= stroke_min_speed:
		return Gesture.Type.STROKE
	return Gesture.Type.HOLD if dur >= hold_min_duration else Gesture.Type.NONE


func _analyse(t: float) -> Dictionary:
	var start := t - analysis_window
	var pts: Array[Vector2] = []
	var t0 := t
	for i in range(_samples.size()):
		var s: Dictionary = _samples[i]
		if s.t >= start or (i + 1 < _samples.size() and _samples[i + 1].t >= start):
			pts.append(s.p)
			t0 = minf(t0, s.t)
	var res := {"path": 0.0, "net": 0.0, "extent": 0.0, "speed": 0.0, "rev_rate": 0.0,
		"turn_rate": 0.0, "dir": Vector2.ZERO, "freq": 0.0, "window": 0.0}
	if pts.size() < 2:
		return res
	var wdur := maxf(t - t0, 0.08)
	var path := 0.0
	var mn := pts[0]
	var mx := pts[0]
	for i in range(1, pts.size()):
		path += pts[i].distance_to(pts[i - 1])
		mn = mn.min(pts[i])
		mx = mx.max(pts[i])
	var size := mx - mn
	var net_v := pts[pts.size() - 1] - pts[0]
	# Reversals on both axes with hysteresis; take the busier axis.
	var rev := maxi(_count_reversals(pts, 0), _count_reversals(pts, 1))
	# Turning: accumulate heading change over resampled segments.
	var turn := 0.0
	var last_dir := Vector2.ZERO
	var anchor := pts[0]
	for i in range(1, pts.size()):
		var d := pts[i] - anchor
		if d.length() >= 5.0:
			var nd := d.normalized()
			if last_dir != Vector2.ZERO:
				turn += absf(last_dir.angle_to(nd))
			last_dir = nd
			anchor = pts[i]
	var dir := net_v.normalized() if net_v.length() > 4.0 else Vector2.ZERO
	if rev >= 1:
		dir = Vector2.RIGHT if size.x >= size.y else Vector2.DOWN
	res.path = path
	res.net = net_v.length()
	res.extent = maxf(size.x, size.y)
	res.speed = path / wdur
	res.rev_rate = rev / wdur
	res.turn_rate = turn / wdur
	res.dir = dir
	res.freq = res.rev_rate * 0.5
	res.window = wdur
	return res


func _count_reversals(pts: Array[Vector2], axis: int) -> int:
	var count := 0
	var sign := 0
	var extreme := pts[0][axis]
	for i in range(1, pts.size()):
		var v: float = pts[i][axis]
		if sign >= 0:
			if v > extreme:
				extreme = v
				if sign == 0 and v - pts[0][axis] > reversal_hysteresis:
					sign = 1
			elif extreme - v > reversal_hysteresis:
				if sign == 1:
					count += 1
				sign = -1
				extreme = v
		else:
			if v < extreme:
				extreme = v
			elif v - extreme > reversal_hysteresis:
				count += 1
				sign = 1
				extreme = v
	return count


# --- Helpers -------------------------------------------------------------------

func _switch(cls: int, t: float) -> void:
	if current_type != Gesture.Type.NONE:
		gesture_ended.emit(_make(current_type, Gesture.Phase.END, t))
	_set_type(cls, t)
	_gesture_path = 0.0
	_last_tick = t
	gesture_began.emit(_make(cls, Gesture.Phase.BEGIN, t))


func _set_type(cls: int, t: float) -> void:
	if cls != current_type:
		current_type = cls
		_type_since = t
		type_changed.emit(cls)


func _make(type: int, phase: int, t: float) -> Gesture:
	var g := Gesture.new()
	g.type = type
	g.phase = phase
	g.time = t
	g.screen_pos = pointer_pos
	var a: Dictionary = last_analysis if not last_analysis.is_empty() else _analyse(t)
	g.speed = a.get("speed", 0.0)
	g.direction = a.get("dir", Vector2.ZERO)
	g.extent = a.get("extent", 0.0)
	g.frequency = a.get("freq", 0.0)
	g.duration = t - _type_since if type != Gesture.Type.HOLD else t - _press_time
	g.path_length = _gesture_path
	match type:
		Gesture.Type.HOLD:
			g.intensity = clampf(g.duration / 2.5, 0.15, 1.0)
		Gesture.Type.STROKE:
			g.intensity = clampf(g.speed / 900.0, 0.0, 1.0)
		Gesture.Type.RUB:
			g.intensity = clampf(g.speed / 700.0 + g.frequency * 0.05, 0.0, 1.0)
		Gesture.Type.SCRATCH:
			g.intensity = clampf(g.speed / 1200.0 + g.frequency * 0.04, 0.0, 1.0)
	return g


func _register_tap(pos: Vector2, t: float, dur: float) -> void:
	if not _taps.is_empty() and t - _taps[_taps.size() - 1] > rhythm_max_interval:
		_taps.clear()
	_taps.append(t)
	while _taps.size() > 8:
		_taps.pop_front()
	var g := Gesture.new()
	g.type = Gesture.Type.POKE
	g.phase = Gesture.Phase.INSTANT
	g.time = t
	g.screen_pos = pos
	g.duration = dur
	g.intensity = clampf(1.0 - maxf(dur - poke_sharp_duration, 0.0) / hold_min_duration, 0.3, 1.0)
	g.tap_count = _taps.size()
	if _taps.size() >= 2:
		g.interval = _taps[_taps.size() - 1] - _taps[_taps.size() - 2]
	gesture_detected.emit(g)

	if _taps.size() >= rhythm_min_taps:
		var intervals: Array[float] = []
		for i in range(1, _taps.size()):
			intervals.append(_taps[i] - _taps[i - 1])
		var mean := 0.0
		for v in intervals:
			mean += v
		mean /= intervals.size()
		var var_sum := 0.0
		for v in intervals:
			var_sum += (v - mean) * (v - mean)
		var cv := sqrt(var_sum / intervals.size()) / maxf(mean, 0.001)
		if mean >= rhythm_min_interval and mean <= rhythm_max_interval and cv <= rhythm_max_irregularity:
			var r := g.duplicate_gesture()
			r.type = Gesture.Type.RHYTHM
			r.interval = mean
			r.regularity = clampf(1.0 - cv / rhythm_max_irregularity, 0.0, 1.0)
			r.intensity = r.regularity
			gesture_detected.emit(r)
