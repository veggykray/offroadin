@tool
extends Node2D
## Placeholder trolley art, drawn with code (no image files needed).
## Two instances are used: "back" (behind the cargo) and "front" (wire mesh in
## front of the cargo) so mushrooms look like they sit INSIDE the basket.
## Replace with sprites later if you like. Nothing else depends on this script.

@export_enum("back", "front") var layer := "back"
@export var metal := Color(0.78, 0.82, 0.86)
@export var metal_dark := Color(0.45, 0.5, 0.56)
@export var grip := Color(0.85, 0.15, 0.2)

const T := preload("Trolley.gd")


func refresh() -> void:
	queue_redraw()


func _process(_d: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()


func _trolley() -> Node:
	if Engine.is_editor_hint():
		return null
	var p := get_parent()
	if p != null and p.has_method("basket_transform"):
		return p
	return null


func _draw() -> void:
	var tr := _trolley()
	var xf := Transform2D.IDENTITY
	var wheel_angle := 0.0
	var wobble := 0.0
	var rattle := 0.0
	var tt := Time.get_ticks_msec() / 1000.0
	var skid := false
	if tr:
		xf = tr.basket_transform()
		wheel_angle = tr.wheel_angle
		wobble = tr.wobble
		rattle = tr.rattle
		skid = tr.skidding
	if layer == "back":
		_draw_wheels(wheel_angle, wobble, rattle, tt, skid)
		draw_set_transform_matrix(xf)
		_draw_back()
	else:
		draw_set_transform_matrix(xf)
		_draw_front()
	draw_set_transform_matrix(Transform2D.IDENTITY)


func _draw_wheels(angle: float, wobble: float, rattle: float, tt: float, skid: bool) -> void:
	for side in [-1.0, 1.0]:
		var jitter := Vector2(0, sin(tt * 53.0 + side * 2.0) * rattle * 1.5)
		var swing := sin(tt * 38.0 + side) * wobble * 4.0
		var c := Vector2(side * T.WHEEL_X + swing, -T.WHEEL_R) + jitter
		# caster fork
		draw_line(c, c + Vector2(-swing * 0.6, -14.0 * T.S), metal_dark, 3.0)
		draw_circle(c, T.WHEEL_R, Color(0.12, 0.12, 0.14))
		draw_circle(c, T.WHEEL_R * 0.45, Color(0.6, 0.62, 0.66))
		for k in 3:
			var a := angle + k * TAU / 3.0
			draw_line(c, c + Vector2(cos(a), sin(a)) * T.WHEEL_R * 0.85, Color(0.35, 0.35, 0.38), 1.5)
		if skid:
			draw_line(c + Vector2(-14 * T.S, T.WHEEL_R - 1), c + Vector2(14 * T.S, T.WHEEL_R - 1), Color(0.1, 0.1, 0.1, 0.5), 2.0)


func _basket_poly(inset: float) -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(-T.INNER_HALF_BOTTOM - inset, T.FLOOR_Y + 6.0 * T.S),
		Vector2(T.INNER_HALF_BOTTOM + inset, T.FLOOR_Y + 6.0 * T.S),
		Vector2(T.INNER_HALF_TOP + inset, T.RIM_Y),
		Vector2(-T.INNER_HALF_TOP - inset, T.RIM_Y),
	])


func _draw_back() -> void:
	# chassis legs down to the wheel axles (legs are drawn in basket space and
	# stretch with the suspension, which reads nicely as springy)
	var k := T.S
	var fy := T.FLOOR_Y + 6.0 * k
	draw_line(Vector2(-T.INNER_HALF_BOTTOM + 4 * k, fy), Vector2(-T.WHEEL_X, -T.WHEEL_R - 12 * k), metal_dark, 4.0)
	draw_line(Vector2(T.INNER_HALF_BOTTOM - 4 * k, fy), Vector2(T.WHEEL_X, -T.WHEEL_R - 12 * k), metal_dark, 4.0)
	draw_line(Vector2(-T.WHEEL_X - 4 * k, -24 * k), Vector2(T.WHEEL_X + 4 * k, -24 * k), metal_dark, 3.0)
	# back panel of the basket
	draw_colored_polygon(_basket_poly(4.0 * k), Color(0.2, 0.24, 0.3, 0.55))
	var n := 9
	for i in n + 1:
		var f := float(i) / n
		var a := Vector2(lerpf(-T.INNER_HALF_BOTTOM, T.INNER_HALF_BOTTOM, f), fy)
		var b := Vector2(lerpf(-T.INNER_HALF_TOP, T.INNER_HALF_TOP, f), T.RIM_Y)
		draw_line(a, b, Color(metal_dark, 0.8), 1.5)
	for j in 4:
		var y := lerpf(fy, T.RIM_Y, float(j) / 4.0)
		var hw: float = lerpf(T.INNER_HALF_BOTTOM, T.INNER_HALF_TOP, float(j) / 4.0)
		draw_line(Vector2(-hw, y), Vector2(hw, y), Color(metal_dark, 0.8), 1.5)
	# handle
	draw_line(Vector2(-T.INNER_HALF_TOP, T.RIM_Y), Vector2(-84, -116) * k, metal, 4.0)
	draw_line(Vector2(-T.INNER_HALF_TOP + 4 * k, T.RIM_Y + 16 * k), Vector2(-80, -112) * k, metal_dark, 3.0)
	draw_line(T.HANDLE_GRIP + Vector2(0, -7), T.HANDLE_GRIP + Vector2(0, 7), grip, 11.0)


func _draw_front() -> void:
	var k := T.S
	var fy := T.FLOOR_Y + 6.0 * k
	var poly := _basket_poly(6.0 * k)
	# front wire mesh (thin, see-through so the pile is visible)
	var n := 7
	for i in n + 1:
		var f := float(i) / n
		var a := Vector2(lerpf(-T.INNER_HALF_BOTTOM - 6 * k, T.INNER_HALF_BOTTOM + 6 * k, f), fy)
		var b := Vector2(lerpf(-T.INNER_HALF_TOP - 6 * k, T.INNER_HALF_TOP + 6 * k, f), T.RIM_Y)
		draw_line(a, b, Color(metal, 0.35), 1.2)
	var y := lerpf(fy, T.RIM_Y, 0.5)
	var hw: float = lerpf(T.INNER_HALF_BOTTOM, T.INNER_HALF_TOP, 0.5) + 6 * k
	draw_line(Vector2(-hw, y), Vector2(hw, y), Color(metal, 0.35), 1.2)
	# frame
	draw_line(poly[0], poly[1], metal, 4.0)
	draw_line(poly[1], poly[2], metal, 4.0)
	draw_line(poly[3], poly[0], metal, 4.0)
	draw_line(poly[3] + Vector2(-2, 0), poly[2] + Vector2(2, 0), metal, 5.0)  # rim
	# Shroom Mart badge
	var badge := Rect2(Vector2(-16, T.FLOOR_Y - 24 * k), Vector2(32, 18))
	draw_rect(badge, Color(0.85, 0.2, 0.2))
	draw_rect(badge, Color(1, 0.95, 0.85), false, 1.5)
	draw_circle(badge.get_center() + Vector2(0, -1), 5.0, Color(1, 0.95, 0.85))
	draw_rect(Rect2(badge.get_center() + Vector2(-1.5, 1), Vector2(3, 5)), Color(1, 0.95, 0.85))
