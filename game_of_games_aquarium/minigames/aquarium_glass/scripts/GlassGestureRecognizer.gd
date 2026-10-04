extends Node
## Turns raw pointer contact with the glass into gestures:
## SINGLE TAP, DOUBLE TAP, RUB, SCRATCH and HARD KNOCK.
##
## It knows nothing about mice, screens or creatures. Something (normally
## GlassInteractionSurface) feeds it press / move / release / knock calls in
## aquarium-local coordinates and it emits signals.
##
## Detection is deliberately forgiving:
##  * a tap is any short press that barely moves;
##  * a double tap is a second press shortly after a tap, near it;
##  * any press that moves becomes a stroke; a stroke is a SCRATCH while it
##    zig-zags quickly in a small area, otherwise it is a RUB.
##
## All thresholds are exported so they can be tuned in the Inspector.

const Stim = preload("GlassStimulus.gd")

## Emitted when a gesture is recognised. `info` contains "radius", "strength",
## "stroke_id" and "continuous" (true for the repeated rub/scratch reports).
signal gesture_recognized(kind: int, pos: Vector2, info: Dictionary)
## Emitted the instant a finger/mouse touches the glass (before we know which
## gesture it will become). Use it for immediate "TOK" feedback.
signal contact(pos: Vector2, is_knock: bool)
## Emitted when a stroke (rub/scratch) ends.
signal stroke_ended(kind: int, pos: Vector2)

@export_group("Taps")
## A press shorter than this (seconds) can count as a tap.
@export var tap_max_duration := 0.32
## A press that moves less than this (pixels) can count as a tap.
@export var tap_max_movement := 24.0
## Max gap (seconds) between releasing the first tap and pressing the second.
@export var double_tap_window := 0.30
## Max distance (pixels) between the two taps of a double tap.
@export var double_tap_max_distance := 110.0

@export_group("Strokes (rub / scratch)")
## Pointer must move this far from where it was pressed before a stroke starts.
@export var stroke_start_distance := 16.0
## How much recent movement (seconds) is analysed to classify the stroke.
@export var motion_window := 0.32
## A new stroke is watched this long before it reports anything, so the start
## of a scratch is never mistaken for a rub.
@export var stroke_classify_delay := 0.14
## Direction reversals needed inside the window for a SCRATCH.
@export var scratch_min_reversals := 2
## Average pointer speed (px/s) needed for a SCRATCH (rubbing is slower).
@export var scratch_min_speed := 340.0
## A scratch must stay inside a blob of roughly this radius (px).
@export var scratch_max_spread := 150.0
## Once scratching, keep reporting SCRATCH for this long even if the motion
## briefly looks like a rub (hysteresis = less flicker).
@export var scratch_hold_time := 0.28
## How often (seconds) continuous rub/scratch reports are emitted.
@export var continuous_interval := 0.08
## A rub pointer that has been still for this long stops emitting.
@export var rub_idle_timeout := 0.35

@export_group("Gesture radii (how far the vibration reaches)")
@export var single_tap_radius := 150.0
@export var double_tap_radius := 200.0
@export var rub_radius := 110.0
@export var scratch_radius := 160.0
@export var hard_knock_radius := 460.0

## Read-only state for debug displays.
var current_gesture: int = Stim.Kind.NONE
var current_gesture_pos := Vector2.ZERO
var last_gesture: int = Stim.Kind.NONE
var last_gesture_pos := Vector2.ZERO
var last_gesture_time := -100.0

var clock := 0.0

var _pressed := false
var _press_pos := Vector2.ZERO
var _press_time := 0.0
var _pointer := Vector2.ZERO
var _max_move := 0.0
var _stroking := false
var _stroke_kind: int = Stim.Kind.NONE
var _stroke_id := 0
var _consumed_by_double := false
var _samples: Array = []   # [time, Vector2]
var _last_emit := 0.0
var _last_scratch_time := -100.0
var _last_motion_time := 0.0
var _stroke_start := 0.0

# Pending single tap (waiting to see whether a second tap follows).
var _pending_tap := false
var _pending_pos := Vector2.ZERO
var _pending_release_time := 0.0


func _process(delta: float) -> void:
	advance(delta)


## Advances the internal clock (called automatically by _process; tests may call it directly).
func advance(delta: float) -> void:
	clock += delta
	if _pending_tap and clock - _pending_release_time > double_tap_window:
		_pending_tap = false
		_emit(Stim.Kind.SINGLE_TAP, _pending_pos, single_tap_radius, 1.0, false)
	if _pressed and _stroking:
		_update_stroke()
	if current_gesture != Stim.Kind.NONE and clock - last_gesture_time > 0.45 and not _stroking:
		current_gesture = Stim.Kind.NONE


func press(pos: Vector2) -> void:
	_pressed = true
	_press_pos = pos
	_pointer = pos
	_press_time = clock
	_max_move = 0.0
	_stroking = false
	_stroke_kind = Stim.Kind.NONE
	_consumed_by_double = false
	_samples = [[clock, pos]]
	_last_motion_time = clock
	contact.emit(pos, false)
	# Second press of a double tap fires immediately on press-down: snappier.
	if _pending_tap and clock - _pending_release_time <= double_tap_window \
			and pos.distance_to(_pending_pos) <= double_tap_max_distance:
		_pending_tap = false
		_consumed_by_double = true
		_emit(Stim.Kind.DOUBLE_TAP, (pos + _pending_pos) * 0.5, double_tap_radius, 1.0, false)


func move(pos: Vector2) -> void:
	if not _pressed:
		_pointer = pos
		return
	if pos.distance_to(_pointer) > 0.5:
		_last_motion_time = clock
	_pointer = pos
	_max_move = maxf(_max_move, pos.distance_to(_press_pos))
	_samples.append([clock, pos])
	if not _stroking and not _consumed_by_double and _max_move > stroke_start_distance:
		_stroking = true
		_stroke_start = clock
		_stroke_id += 1
		_last_emit = -100.0
		# A pending single tap followed by a stroke is still a single tap.
		if _pending_tap:
			_pending_tap = false
			_emit(Stim.Kind.SINGLE_TAP, _pending_pos, single_tap_radius, 1.0, false)
	if _stroking:
		_update_stroke()


func release(pos: Vector2) -> void:
	if not _pressed:
		return
	_pressed = false
	_pointer = pos
	if _stroking:
		_stroking = false
		stroke_ended.emit(_stroke_kind, pos)
		current_gesture = Stim.Kind.NONE
		return
	if _consumed_by_double:
		return
	var held := clock - _press_time
	if held <= tap_max_duration and _max_move <= tap_max_movement:
		_pending_tap = true
		_pending_pos = _press_pos
		_pending_release_time = clock


## Hard knock (right mouse button, or the configurable input action).
func knock(pos: Vector2) -> void:
	contact.emit(pos, true)
	_emit(Stim.Kind.HARD_KNOCK, pos, hard_knock_radius, 1.0, false)


func cancel() -> void:
	_pressed = false
	_stroking = false
	_pending_tap = false
	current_gesture = Stim.Kind.NONE


func is_pressed() -> bool:
	return _pressed


func get_pointer() -> Vector2:
	return _pointer


func _update_stroke() -> void:
	# Drop old samples.
	while _samples.size() > 2 and clock - float(_samples[0][0]) > motion_window:
		_samples.pop_front()
	var path := 0.0
	var reversals := 0
	var prev_dir := Vector2.ZERO
	var centroid := Vector2.ZERO
	for i in _samples.size():
		var p: Vector2 = _samples[i][1]
		centroid += p
		if i == 0:
			continue
		var seg: Vector2 = p - (_samples[i - 1][1] as Vector2)
		var l := seg.length()
		path += l
		if l > 2.5:
			var d := seg / l
			if prev_dir != Vector2.ZERO and d.dot(prev_dir) < -0.35:
				reversals += 1
			prev_dir = d
	centroid /= float(_samples.size())
	var span := maxf(0.05, clock - float(_samples[0][0]))
	var speed := path / maxf(span, motion_window * 0.5)
	var spread := 0.0
	for s in _samples:
		spread = maxf(spread, (s[1] as Vector2).distance_to(centroid))

	var kind: int = Stim.Kind.RUB
	if reversals >= scratch_min_reversals and speed >= scratch_min_speed and spread <= scratch_max_spread:
		kind = Stim.Kind.SCRATCH
		_last_scratch_time = clock
	elif clock - _last_scratch_time < scratch_hold_time and spread <= scratch_max_spread * 1.4:
		kind = Stim.Kind.SCRATCH
	_stroke_kind = kind

	if clock - _last_emit < continuous_interval or clock - _stroke_start < stroke_classify_delay:
		return
	if kind == Stim.Kind.RUB and clock - _last_motion_time > rub_idle_timeout:
		return   # Finger resting on the glass: no stimulation.
	_last_emit = clock
	if kind == Stim.Kind.SCRATCH:
		var st := clampf(speed / (scratch_min_speed * 2.0), 0.5, 1.5)
		_emit(kind, centroid, scratch_radius, st, true)
	else:
		var st2 := clampf(speed / 400.0, 0.3, 1.2)
		_emit(kind, _pointer, rub_radius, st2, true)


func _emit(kind: int, pos: Vector2, radius: float, strength: float, continuous: bool) -> void:
	current_gesture = kind
	current_gesture_pos = pos
	last_gesture = kind
	last_gesture_pos = pos
	last_gesture_time = clock
	gesture_recognized.emit(kind, pos, {
		"radius": radius,
		"strength": strength,
		"stroke_id": _stroke_id,
		"continuous": continuous,
	})
