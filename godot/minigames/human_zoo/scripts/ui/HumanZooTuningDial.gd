class_name HumanZooTuningDial
extends Control
## The small tactile tuning interaction on the empty cage's microphone.
## Turn the dial; the static changes; fragments surface; hold on the signal.

signal closeness_changed(closeness: float)
signal tuned
signal cancelled

var target := 0.73
var tolerance := 0.035
var hold_seconds := 1.2
var fragments: Array = ["...", "Hello, Bill."]
var value := 0.2
var _hold := 0.0
var _t := 0.0
var _active := false
var _dragging := false
var _font: Font


func _ready() -> void:
	_font = ThemeDB.fallback_font
	mouse_filter = Control.MOUSE_FILTER_STOP


func open(cfg: Dictionary, start_value := 0.2) -> void:
	target = float(cfg.get("target", target))
	tolerance = float(cfg.get("tolerance", tolerance))
	hold_seconds = float(cfg.get("hold_seconds", hold_seconds))
	fragments = Array(cfg.get("fragments", fragments))
	value = start_value
	_hold = 0.0
	_active = true
	visible = true


func close() -> void:
	_active = false
	visible = false


func closeness() -> float:
	return 1.0 - clampf(absf(value - target) / 0.3, 0.0, 1.0)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseMotion and _dragging:
		value = clampf(value + event.relative.x / 900.0, 0.0, 1.0)


func _unhandled_input(event: InputEvent) -> void:
	if not _active:
		return
	if event.is_action_pressed("hz_cancel"):
		get_viewport().set_input_as_handled()
		close()
		cancelled.emit()


func _process(delta: float) -> void:
	if not _active:
		return
	_t += delta
	var dir := Input.get_axis("hz_left", "hz_right")
	if dir != 0.0:
		var fine := 0.12 if closeness() > 0.7 else 0.3
		value = clampf(value + dir * fine * delta, 0.0, 1.0)
	closeness_changed.emit(closeness())
	if absf(value - target) <= tolerance:
		_hold += delta
		if _hold >= hold_seconds:
			_active = false
			tuned.emit()
	else:
		_hold = maxf(_hold - delta * 2.0, 0.0)
	queue_redraw()


func _draw() -> void:
	var c := size * 0.5 + Vector2(0, -40)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.6))
	var brass := Color(0.7, 0.53, 0.25)
	# Faceplate
	draw_circle(c, 250, brass.darkened(0.5))
	draw_circle(c, 238, Color(0.1, 0.09, 0.08))
	draw_arc(c, 250, 0, TAU, 64, brass, 6.0)
	# Frequency scale
	for i in 41:
		var a := lerpf(-PI * 0.8, -PI * 0.2, i / 40.0)
		var r0 := 196.0 if i % 5 else 184.0
		draw_line(c + Vector2(cos(a), sin(a)) * r0, c + Vector2(cos(a), sin(a)) * 214, brass.lightened(0.2), 2.0)
	var na := lerpf(-PI * 0.8, -PI * 0.2, value)
	draw_line(c, c + Vector2(cos(na), sin(na)) * 212, Color(0.9, 0.2, 0.15), 4.0)
	# Oscilloscope window: noise that resolves into a wave
	var win := Rect2(c + Vector2(-170, 10), Vector2(340, 110))
	draw_rect(win, Color(0.05, 0.12, 0.08))
	var cl := closeness()
	var pts := PackedVector2Array()
	for i in 80:
		var x := win.position.x + i * win.size.x / 79.0
		var wave := sin(i * 0.35 + _t * 8.0) * 30.0 * cl
		var noise := randf_range(-1, 1) * 45.0 * (1.0 - cl * 0.9)
		pts.append(Vector2(x, win.get_center().y + wave + noise))
	draw_polyline(pts, Color(0.5, 1.0, 0.6, 0.9), 2.0)
	draw_rect(win, brass, false, 3.0)
	# The big knob
	var knob := c + Vector2(0, 175)
	draw_circle(knob, 48, brass.darkened(0.25))
	for i in 18:
		var a := value * TAU * 2.0 + i * TAU / 18.0
		draw_line(knob + Vector2(cos(a), sin(a)) * 40, knob + Vector2(cos(a), sin(a)) * 50, brass.lightened(0.2), 4.0)
	draw_circle(knob, 30, Color(0.18, 0.14, 0.1))
	var ka := value * TAU * 2.0
	draw_line(knob, knob + Vector2(cos(ka), sin(ka)) * 28, brass.lightened(0.4), 4.0)
	# Hold progress ring
	if _hold > 0.0:
		draw_arc(knob, 60, -PI / 2, -PI / 2 + TAU * (_hold / hold_seconds), 40, Color(0.6, 1.0, 0.7), 5.0)
	# Fragments of a voice
	var idx := clampi(int(pow(cl, 2.2) * (fragments.size() - 1) + 0.001), 0, fragments.size() - 1)
	var frag := String(fragments[idx])
	if cl < 0.98 and idx == fragments.size() - 1:
		frag = String(fragments[maxi(idx - 1, 0)])
	var jitter := Vector2(randf_range(-2, 2), randf_range(-2, 2)) * (1.0 - cl)
	draw_string(_font, Vector2(0, c.y - 300) + jitter, frag, HORIZONTAL_ALIGNMENT_CENTER, size.x, 40, Color(0.85, 0.92, 1.0, 0.35 + 0.65 * cl))
	draw_string(_font, Vector2(0, size.y - 70), "A/D (or drag) to tune    ·    hold steady on the signal    ·    ESC step away", HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color(0.9, 0.85, 0.7, 0.8))
