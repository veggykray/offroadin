class_name BillSilhouette
extends Node2D
## Placeholder Bill: a small elderly man in a flat cap, standing on the beast
## at the bottom of the screen. Sways with the hide, braces against thumps,
## struggles as things escalate, and finally sits down.
##
## Replace by setting `custom_texture` (drawn with its bottom-centre at the
## node origin) or by swapping this node for an AnimatedSprite2D that exposes
## the same methods: brace(), startle(), sit().

@export var custom_texture: Texture2D
@export var height := 165.0

var t := 0.0
var sway := 0.0
var brace_k := 0.0
var startle_k := 0.0
var sit_k := 0.0
var sitting := false
var struggle := 0.0
var hat_lift := 0.0


func _ready() -> void:
	Game.bill = self


func brace(strength: float) -> void:
	brace_k = clampf(brace_k + 0.5 * strength, 0.0, 1.0)


func startle() -> void:
	startle_k = 1.0
	hat_lift = 1.0


func sit() -> void:
	sitting = true


func reset() -> void:
	sitting = false
	sit_k = 0.0


func _process(delta: float) -> void:
	t += delta
	var e := Game.escalation()
	brace_k = Game.damp(brace_k, 0.0, 3.0, delta)
	startle_k = Game.damp(startle_k, 0.0, 2.5, delta)
	hat_lift = Game.damp(hat_lift, 0.0, 2.0, delta)
	sit_k = Game.damp(sit_k, 1.0 if sitting else 0.0, 1.2, delta)
	struggle = Game.damp(struggle, clampf((e - 0.62) / 0.35, 0.0, 1.0) * (1.0 - sit_k), 2.0, delta)
	var heave: Vector2 = Game.body.heave_offset if Game.body else Vector2.ZERO
	var breath: float = Game.body.breath if Game.body else 0.0
	sway = Game.damp(sway, heave.x * 0.004 + sin(t * 0.7) * 0.02 + sin(t * 6.0) * struggle * 0.12, 6.0, delta)
	position.y = Game.SCREEN.y - 34.0 + breath * 3.0 + heave.y * 0.3
	queue_redraw()


func _draw() -> void:
	# Warm haze behind him so the silhouette reads, and the hide he stands on.
	Paint.soft_ellipse(self, Vector2(0, -80), Vector2(150, 150), Color(1.0, 0.55, 0.35, 0.22))
	Paint.soft_ellipse(self, Vector2(0, -70), Vector2(80, 100), Color(1.0, 0.7, 0.5, 0.18))
	Paint.soft_ellipse(self, Vector2(0, 10), Vector2(140, 34), Color(0, 0, 0, 0.6))
	if custom_texture:
		draw_texture(custom_texture, Vector2(-custom_texture.get_width() * 0.5, -custom_texture.get_height()))
		return
	var s := height / 150.0
	var dark := Color(0.05, 0.03, 0.05)
	var rim := Color(1.0, 0.62, 0.42, 0.85)
	var crouch := brace_k * 10.0 + sit_k * 46.0 - startle_k * 12.0
	draw_set_transform(Vector2.ZERO, sway, Vector2(s, s))
	var hip := Vector2(0, -62 + crouch)
	var knee_bend := 6.0 + brace_k * 10.0 + sit_k * 30.0
	# Legs.
	for side in [-1.0, 1.0]:
		var foot := Vector2(side * 12.0 + (side * sit_k * 18.0), 0)
		var knee := Vector2(side * 9.0 + knee_bend * (0.3 + sit_k), (hip.y + foot.y) * 0.5)
		if sit_k > 0.5:
			knee = Vector2(side * 10.0 + 26.0 * sit_k, hip.y - 4.0)
			foot = Vector2(side * 10.0 + 30.0 * sit_k, 0)
		draw_line(hip + Vector2(side * 7, 0), knee, dark, 11.0)
		draw_line(knee, foot, dark, 10.0)
		draw_line(foot, foot + Vector2(10, 0), dark, 7.0)
	# Stooped torso / coat.
	var stoop := 0.25 + struggle * 0.2 - startle_k * 0.2
	var neck := hip + Vector2(sin(stoop) * 52.0, -cos(stoop) * 52.0)
	var coat := PackedVector2Array([hip + Vector2(-15, 8), hip + Vector2(15, 8), neck + Vector2(12, 2), neck + Vector2(-10, -2)])
	draw_colored_polygon(coat, dark)
	draw_line(hip + Vector2(15, 6), neck + Vector2(12, 0), rim, 2.0, true)
	# Arms: hanging, braced, or flailing.
	for side in [-1.0, 1.0]:
		var sh := neck + Vector2(side * 9.0, 6)
		var flail := struggle * (0.8 + 0.6 * sin(t * 9.0 + side))
		var a: float = PI * 0.5 + side * 0.25 - side * flail * 1.6 - startle_k * side * 1.4
		if side > 0.0 and struggle > 0.3:
			a = -PI * 0.5 + 0.2 + sin(t * 4.0) * 0.1  # holding on to his cap
		var elbow := sh + Vector2.from_angle(a) * 22.0
		var hand := elbow + Vector2.from_angle(a + side * 0.4) * 20.0
		draw_line(sh, elbow, dark, 8.0)
		draw_line(elbow, hand, dark, 7.0)
		draw_circle(hand, 4.5, dark)
	# Head, white moustache hint, cap.
	var head := neck + Vector2(5 + sin(stoop) * 8.0, -12)
	draw_circle(head, 11.0, dark)
	draw_arc(head, 11.0, -PI * 0.4, PI * 0.35, 8, rim, 2.0, true)
	draw_line(head + Vector2(6, 4), head + Vector2(13, 5), Color(0.75, 0.72, 0.68, 0.8), 2.5)
	var cap := head + Vector2(0, -8 - hat_lift * 26.0)
	var cap_rot := hat_lift * 0.6
	draw_set_transform(cap.rotated(sway) * s, sway + cap_rot, Vector2(s, s))
	draw_colored_polygon(PackedVector2Array([Vector2(-12, 2), Vector2(-9, -6), Vector2(6, -7), Vector2(18, 1), Vector2(10, 3)]), dark)
	draw_line(Vector2(-9, -6), Vector2(6, -7), rim, 1.5, true)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
