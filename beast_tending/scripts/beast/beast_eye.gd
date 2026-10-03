class_name BeastEye
extends Node2D
## A blinking structure that may or may not be an eye. Watches the hand,
## glances at whatever the beast wants attended, narrows when annoyed, goes
## heavy-lidded when content, and very wide at certain moments.

@export var radius := 46.0

var look := Vector2.ZERO        ## -1..1 iris offset
var look_target := Vector2.ZERO
var open := 0.9
var open_target := 0.9
var pupil := 0.5                ## dilation 0..1
var pupil_target := 0.5
var blink := 0.0
var blink_timer := 3.0
var t := 0.0
var glance_world := Vector2.INF  ## overrides gaze while set
var glance_time := 0.0
var squint := 0.0
var hue := 0.0
var glow: GlowLayer


func _ready() -> void:
	t = randf() * 10.0
	hue = randf()
	blink_timer = randf_range(1.0, 5.0)
	glow = GlowLayer.new(_draw_glow, 1)
	add_child(glow)


func glance_at(world_pos: Vector2, duration: float) -> void:
	glance_world = world_pos
	glance_time = duration


func _process(delta: float) -> void:
	t += delta
	if absf(global_position.x - Game.camera_x()) > Game.SCREEN.x * 0.5 + 300.0:
		return
	var mood: int = Game.mind.mood if Game.mind else 0
	var e := Game.escalation()
	match mood:
		BeastMind.Mood.WARY:
			open_target = 0.95; pupil_target = 0.25; squint = 0.1
		BeastMind.Mood.CURIOUS:
			open_target = 1.0; pupil_target = 0.6; squint = 0.0
		BeastMind.Mood.RELAXED:
			open_target = 0.6; pupil_target = 0.55; squint = 0.0
		BeastMind.Mood.CONTENT:
			open_target = 0.32; pupil_target = 0.7; squint = 0.0
		BeastMind.Mood.EXCITED:
			open_target = lerpf(0.35, 1.0, absf(sin(t * 0.7))) ; pupil_target = 0.95; squint = 0.0
		BeastMind.Mood.IRRITATED:
			open_target = 0.42; pupil_target = 0.2; squint = 0.8
		BeastMind.Mood.SURPRISED:
			open_target = 1.0; pupil_target = 0.08; squint = 0.0
		BeastMind.Mood.IMPATIENT:
			open_target = 0.75; pupil_target = 0.4; squint = 0.35
		BeastMind.Mood.SPENT:
			open_target = 0.06; pupil_target = 0.9; squint = 0.0
		BeastMind.Mood.ANTICIPATING:
			open_target = 1.0; pupil_target = 0.85; squint = 0.0
	if e > 0.9 and mood != BeastMind.Mood.SPENT:
		open_target = 0.15 + 0.85 * absf(sin(t * 3.0))  # fluttering
	# Gaze.
	var target_world: Vector2
	if glance_time > 0.0:
		glance_time -= delta
		target_world = glance_world
	elif Game.hand and Game.hand.visible:
		target_world = Game.screen_to_world(Game.hand.position)
	else:
		target_world = global_position + Vector2(sin(t * 0.3) * 400.0, 100.0)
	var d := target_world - global_position
	look_target = Vector2(clampf(d.x / 900.0, -1.0, 1.0), clampf(d.y / 500.0, -1.0, 1.0))
	look = look.lerp(look_target, 1.0 - exp(-5.0 * delta))
	# Blinks.
	blink_timer -= delta
	if blink_timer <= 0.0:
		blink = 1.0
		blink_timer = randf_range(2.0, 6.0) if mood != BeastMind.Mood.IRRITATED else randf_range(0.6, 1.6)
	blink = maxf(blink - delta * 7.0, 0.0)
	open = Game.damp(open, open_target, 4.0, delta)
	pupil = Game.damp(pupil, pupil_target, 3.0, delta)
	queue_redraw()
	glow.queue_redraw()


func _draw() -> void:
	var r := radius
	var o := clampf(open * (1.0 - sin(blink * PI)), 0.0, 1.0)
	# Socket and lid folds.
	Paint.soft_ellipse(self, Vector2(0, 6), Vector2(r * 2.3, r * 1.7), Color(0.03, 0.01, 0.02, 0.8))
	Paint.ellipse(self, Vector2(0, 0), Vector2(r * 1.55, r * 1.15), Color(0.2, 0.11, 0.13), 30)
	# Eyeball.
	var ball := Paint.ellipse_points(Vector2.ZERO, Vector2(r * 1.2, r * 0.9), 30)
	draw_colored_polygon(ball, Color(0.78, 0.62, 0.32))
	Paint.soft_ellipse(self, Vector2(0, r * 0.2), Vector2(r * 1.1, r * 0.8), Color(0.45, 0.2, 0.1, 0.5))
	var ip := Vector2(look.x * r * 0.42, look.y * r * 0.22)
	var iris_col := Color.from_hsv(fposmod(0.3 + hue * 0.2 + sin(t * 0.3) * 0.03, 1.0), 0.7, 0.75)
	Paint.ellipse(self, ip, Vector2(r * 0.68, r * 0.66), iris_col.darkened(0.45), 28)
	Paint.ellipse(self, ip, Vector2(r * 0.6, r * 0.58), iris_col, 28)
	for k in range(14):
		var a := TAU * k / 14.0 + t * 0.05
		draw_line(ip + Vector2.from_angle(a) * r * 0.2, ip + Vector2.from_angle(a) * r * 0.58, iris_col.lightened(0.3) * Color(1, 1, 1, 0.5), 1.5, true)
	# Horizontal pupil.
	var pw := r * lerpf(0.35, 0.95, pupil)
	var ph := r * lerpf(0.08, 0.42, pupil)
	Paint.ellipse(self, ip, Vector2(pw * 0.5, ph * 0.5), Color(0.02, 0.01, 0.02), 20)
	draw_circle(ip + Vector2(-r * 0.22, -r * 0.2), r * 0.1, Color(1, 1, 1, 0.75))
	# Lids: close from top and bottom.
	var lid_col := Color(0.42, 0.27, 0.27)
	var lid_dark := Color(0.16, 0.08, 0.1)
	var top_y := lerpf(r * 0.05, -r * 0.95, o)
	var bot_y := lerpf(r * 0.1, r * 0.92, o)
	var up := PackedVector2Array()
	var dn := PackedVector2Array()
	var n := 20
	for i in range(n + 1):
		var x := lerpf(-r * 1.3, r * 1.3, float(i) / n)
		var k := 1.0 - pow(x / (r * 1.3), 2.0)
		var sq := squint * r * 0.25 * (1.0 - absf(x) / (r * 1.3)) * (1.0 if x < 0 else 0.4)
		up.append(Vector2(x, top_y * k + sq))
		dn.append(Vector2(x, bot_y * k))
	var up_poly := up.duplicate()
	for i in range(1, 16):
		var a := -PI * i / 16.0
		up_poly.append(Vector2(cos(a) * r * 1.3, sin(a) * r * 1.08))
	Paint.gradient_poly(self, up_poly, lid_col.darkened(0.3), lid_col)
	draw_polyline(up, lid_dark, 4.0, true)
	var dn_poly := dn.duplicate()
	for i in range(1, 16):
		var a := PI * i / 16.0
		dn_poly.append(Vector2(cos(a) * r * 1.3, sin(a) * r * 1.0))
	Paint.gradient_poly(self, dn_poly, lid_col, lid_col.darkened(0.4))
	draw_polyline(dn, lid_dark, 3.0, true)
	# Folds around the socket.
	for k in range(3):
		draw_arc(Vector2(0, -r * 0.2), r * (1.45 + k * 0.22), PI * 1.15, PI * 1.85, 18, lid_dark * Color(1, 1, 1, 0.5), 2.5, true)


func _draw_glow(layer: GlowLayer) -> void:
	var o := clampf(open * (1.0 - sin(blink * PI)), 0.0, 1.0)
	var ip := Vector2(look.x * radius * 0.42, look.y * radius * 0.22)
	layer.blob(ip, radius * 0.9, Color(0.6, 1.0, 0.6, 0.12 * o))
