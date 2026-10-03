class_name BillHand
extends Node2D
## Bill's hand: the cursor. Placeholder procedural art of an elderly hand in a
## tweed sleeve. Its pose follows the recognised gesture (pointing, flat palm,
## clawed scratch, pressing). The fingertip is the hotspot.
##
## To replace with final art, assign the pose textures below; each is drawn
## with its `hotspot` pixel at the pointer.

enum Pose { POINT, FLAT, CLAW, PRESS }

@export var pose_textures: Dictionary = {}   ## Pose -> Texture2D
@export var texture_hotspot := Vector2(40, 10)
@export var hand_scale := 0.72
@export var tilt := -0.38

var pose: int = Pose.POINT
var target_pos := Vector2(960, 540)
var pressed := false
var tap_anim := 0.0
var jitter := 0.0
var t := 0.0
var _vel := Vector2.ZERO


func _ready() -> void:
	Game.hand = self
	position = target_pos
	visible = false


func show_hand(on: bool) -> void:
	visible = on
	Input.mouse_mode = Input.MOUSE_MODE_HIDDEN if on else Input.MOUSE_MODE_VISIBLE


func set_gesture(type: int, is_pressed: bool) -> void:
	pressed = is_pressed
	if not is_pressed:
		pose = Pose.POINT
		return
	match type:
		Gesture.Type.SCRATCH:
			pose = Pose.CLAW
		Gesture.Type.HOLD:
			pose = Pose.PRESS
		Gesture.Type.STROKE, Gesture.Type.RUB:
			pose = Pose.FLAT
		_:
			pose = Pose.POINT


func tap() -> void:
	tap_anim = 1.0


func _process(delta: float) -> void:
	t += delta
	var vp := get_viewport()
	if vp:
		target_pos = vp.get_mouse_position()
	tap_anim = maxf(tap_anim - delta * 6.0, 0.0)
	jitter = Game.damp(jitter, 1.0 if pose == Pose.CLAW else 0.0, 10.0, delta)
	# The hand is jostled by the beast but the hotspot stays on the pointer.
	position = target_pos
	queue_redraw()


func _draw() -> void:
	var e := Game.escalation()
	var jostle := Vector2(sin(t * 13.0), cos(t * 11.0)) * maxf(e - 0.6, 0.0) * 6.0
	jostle += Vector2(sin(t * 55.0), cos(t * 61.0)) * jitter * 3.0
	var tex: Texture2D = pose_textures.get(pose)
	if tex:
		draw_set_transform(jostle, 0.0, Vector2.ONE * hand_scale)
		draw_texture(tex, -texture_hotspot)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		return
	var sq := 1.0
	if pose == Pose.PRESS:
		sq = 0.93 + sin(t * 3.0) * 0.01
	var tap_off := Vector2(0, -6.0 * sin(tap_anim * PI))
	draw_set_transform(jostle + tap_off, tilt, Vector2(hand_scale, hand_scale * sq))
	_draw_arm()
	match pose:
		Pose.POINT:
			_draw_point()
		Pose.FLAT, Pose.PRESS:
			_draw_flat()
		Pose.CLAW:
			_draw_claw()
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


const SKIN := Color(0.87, 0.73, 0.64)
const SKIN_SHADE := Color(0.74, 0.58, 0.5)
const LINE := Color(0.36, 0.24, 0.2)
const NAIL := Color(0.95, 0.86, 0.8)


func _finger(a: Vector2, b: Vector2, r: float, nail: bool = true) -> void:
	Paint.capsule(self, a, b, r + 2.5, LINE)
	Paint.capsule(self, a, b, r, SKIN)
	draw_line(a.lerp(b, 0.5) + Vector2(-r * 0.6, 0), a.lerp(b, 0.5) + Vector2(r * 0.6, 0), SKIN_SHADE, 1.5, true)
	if nail:
		var d := (b - a).normalized()
		draw_circle(b - d * r * 0.4, r * 0.55, NAIL)


func _palm(center: Vector2, radii: Vector2) -> void:
	Paint.ellipse(self, center, radii + Vector2(2.5, 2.5), LINE, 24)
	Paint.ellipse(self, center, radii, SKIN, 24)
	Paint.ellipse(self, center + Vector2(radii.x * 0.25, radii.y * 0.2), radii * 0.6, SKIN_SHADE * Color(1, 1, 1, 0.5), 20)
	# Age spots.
	for s in [Vector2(-12, -6), Vector2(10, 8), Vector2(-4, 16), Vector2(16, -12)]:
		draw_circle(center + s, 2.6, Color(0.66, 0.48, 0.38, 0.6))


func _draw_arm() -> void:
	# Tweed sleeve reaching up from below, slightly tapered and creased.
	var sleeve := PackedVector2Array([Vector2(-48, 128), Vector2(46, 128), Vector2(70, 300), Vector2(84, 420), Vector2(-80, 420), Vector2(-66, 300)])
	var cols := PackedColorArray([Color(0.4, 0.33, 0.24), Color(0.36, 0.29, 0.21), Color(0.27, 0.21, 0.15),
		Color(0.2, 0.15, 0.11), Color(0.24, 0.19, 0.14), Color(0.33, 0.27, 0.2)])
	draw_polygon(sleeve, cols)
	# Herringbone weave.
	for row in range(16):
		var y := 140.0 + row * 17.0
		var half := lerpf(48.0, 80.0, (y - 128.0) / 292.0)
		var x := -half + 6.0
		var flip := 1.0 if row % 2 == 0 else -1.0
		while x < half - 6.0:
			draw_line(Vector2(x, y), Vector2(x + 7.0, y + 6.0 * flip), Color(0.5, 0.42, 0.3, 0.35), 1.6)
			x += 9.0
	# Creases at the elbow end and a shadowed edge.
	for k in range(3):
		draw_arc(Vector2(10, 250 + k * 40), 60.0, PI * 0.15, PI * 0.85, 10, Color(0.12, 0.09, 0.06, 0.5), 2.5, true)
	draw_line(Vector2(46, 130), Vector2(84, 420), Color(0.1, 0.07, 0.05, 0.6), 6.0)
	draw_polyline(sleeve + PackedVector2Array([sleeve[0]]), Color(0.12, 0.09, 0.06), 3.0, true)
	# Shirt cuff.
	draw_colored_polygon(PackedVector2Array([Vector2(-44, 116), Vector2(44, 116), Vector2(48, 134), Vector2(-48, 134)]), Color(0.9, 0.88, 0.82))
	draw_line(Vector2(-46, 134), Vector2(46, 134), Color(0.6, 0.58, 0.52), 2.0)
	draw_circle(Vector2(30, 126), 3.0, Color(0.7, 0.66, 0.6))
	# Wrist.
	Paint.capsule(self, Vector2(0, 104), Vector2(0, 116), 32.0, LINE)
	Paint.capsule(self, Vector2(0, 104), Vector2(0, 116), 29.5, SKIN)
	draw_arc(Vector2(0, 112), 22.0, PI * 0.2, PI * 0.8, 8, SKIN_SHADE, 1.5)


func _draw_point() -> void:
	_palm(Vector2(4, 82), Vector2(40, 36))
	# Curled fingers.
	for k in [Vector2(2, 58), Vector2(18, 62), Vector2(32, 70)]:
		Paint.ellipse(self, k + Vector2(0, 2), Vector2(12, 11), LINE, 14)
		Paint.ellipse(self, k, Vector2(10, 9.5), SKIN, 14)
		draw_arc(k + Vector2(0, 3), 6.0, PI * 0.1, PI * 0.9, 6, SKIN_SHADE, 1.5)
	# Thumb tucked along.
	_finger(Vector2(-36, 92), Vector2(-26, 58), 10.0)
	# Index finger extended: tip at the hotspot.
	_finger(Vector2(-14, 58), Vector2(-3, 4), 10.0)
	for y in [40.0, 26.0]:
		draw_arc(Vector2(-14 + (58 - y) * 0.2, y), 6.0, PI * 1.15, PI * 1.85, 6, SKIN_SHADE, 1.5)


func _draw_flat() -> void:
	_palm(Vector2(0, 80), Vector2(44, 40))
	var tips := [Vector2(-30, 14), Vector2(-10, 4), Vector2(10, 6), Vector2(28, 20)]
	var knuckles := [Vector2(-28, 56), Vector2(-10, 52), Vector2(8, 54), Vector2(26, 60)]
	var wave := sin(t * 6.0) * 2.0 if pressed else 0.0
	for i in range(4):
		_finger(knuckles[i], tips[i] + Vector2(0, wave * (i % 2)), 9.0)
	_finger(Vector2(-38, 90), Vector2(-66, 58), 10.0)


func _draw_claw() -> void:
	_palm(Vector2(0, 84), Vector2(42, 36))
	var knuckles := [Vector2(-26, 56), Vector2(-9, 52), Vector2(8, 54), Vector2(24, 60)]
	for i in range(4):
		var wig := sin(t * 40.0 + i * 1.7) * 3.0
		var mid: Vector2 = knuckles[i] + Vector2(-2, -26 + wig)
		var tip: Vector2 = mid + Vector2(1, 16)
		_finger(knuckles[i], mid, 9.0, false)
		_finger(mid, tip, 8.0, true)
	_finger(Vector2(-36, 92), Vector2(-52, 64), 10.0)
