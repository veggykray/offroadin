@tool
class_name ProceduralMouth
extends MouthRig
## Placeholder mouth drawn from code. Any MouthPose blends smoothly into any
## other, which makes it a good stand-in until real mouth artwork exists.
##
## To replace it with drawings, delete this node from TalkingDoorFace.tscn and add
## a SpriteMouth (or your own MouthRig) named "Mouth" in the same place.

@export_group("Size")
@export var half_width := 70.0
@export var max_open := 40.0
@export var upper_lip_thickness := 9.0
@export var lower_lip_thickness := 15.0
@export var smile_height := 17.0

@export_group("Colours")
@export var lip_color := Color(0.74, 0.55, 0.22)
@export var lip_shadow_color := Color(0.3, 0.19, 0.05)
@export var cavity_color := Color(0.09, 0.05, 0.02)
@export var teeth_color := Color(0.62, 0.47, 0.2)
@export var tongue_color := Color(0.24, 0.13, 0.04)
@export var crease_color := Color(0.2, 0.12, 0.02)

@export_group("Cheek folds")
@export var draw_folds := true
## Where the smile lines start, relative to the mouth centre (the left one; mirrored).
@export var fold_top := Vector2(-52, -64)

## Preview pose in the editor.
@export_group("Editor preview")
@export_range(0, 1) var preview_open := 0.0:
	set(v):
		preview_open = v
		if Engine.is_editor_hint():
			apply_pose(MouthPose.make(preview_open, 1.0, preview_smile))
@export_range(-1, 1) var preview_smile := 0.0:
	set(v):
		preview_smile = v
		if Engine.is_editor_hint():
			apply_pose(MouthPose.make(preview_open, 1.0, preview_smile))

const SAMPLES := 26

var _pose := MouthPose.new()


func apply_pose(pose: MouthPose) -> void:
	_pose = pose
	queue_redraw()


func _draw() -> void:
	var p := _pose
	var hw := half_width * p.width * (1.0 - 0.3 * p.pucker)
	var open_px := maxf(p.open, 0.0) * max_open
	var press := clampf(p.press, 0.0, 1.0)
	var lip_mul := (1.0 + 0.45 * p.pucker) * (1.0 - 0.65 * press)
	var ut := upper_lip_thickness * lip_mul * (1.0 - 0.25 * p.teeth)
	var lt := lower_lip_thickness * lip_mul * (1.0 - 0.2 * p.teeth)
	var up_raise := open_px * 0.2 + p.teeth * 2.5 * minf(p.open * 4.0, 1.0)
	var low_drop := open_px * 0.8
	var corner_l := -p.smile * smile_height - p.asym * 7.0
	var corner_r := -p.smile * smile_height + p.asym * 7.0
	var round_exp := lerpf(0.42, 0.62, p.pucker)

	var upper_inner := PackedVector2Array()
	var lower_inner := PackedVector2Array()
	var upper_outer := PackedVector2Array()
	var lower_outer := PackedVector2Array()
	for i in SAMPLES + 1:
		var u := -1.0 + 2.0 * float(i) / SAMPLES
		var x := u * hw
		var corner := corner_l if u < 0.0 else corner_r
		var cy := corner * u * u
		var f := maxf(1.0 - u * u, 0.0)
		var ui := cy - up_raise * pow(f, round_exp)
		var li := cy + low_drop * pow(f, round_exp)
		# Cupid's bow: a small dip in the middle of the upper lip.
		var bow := 1.0 - 0.3 * exp(-pow(u / 0.14, 2.0))
		upper_inner.append(Vector2(x, ui))
		lower_inner.append(Vector2(x, li))
		upper_outer.append(Vector2(x, ui - ut * pow(f, 0.32) * bow))
		lower_outer.append(Vector2(x, li + lt * pow(f, 0.42)))

	# Nasolabial folds (deepen when smiling).
	if draw_folds:
		for side in [-1.0, 1.0]:
			var top := Vector2(absf(fold_top.x) * side, fold_top.y)
			var corner_pt := Vector2((hw + 9.0) * side, (corner_r if side > 0 else corner_l) + 3.0)
			var mid := (top + corner_pt) * 0.5 + Vector2(7.0 * side, 0) * (1.0 + 0.5 * p.smile)
			var fold := PackedVector2Array()
			for i in 9:
				var t := float(i) / 8.0
				fold.append(top.lerp(mid, t).lerp(mid.lerp(corner_pt, t), t))
			var a := clampf(0.4 + 0.35 * p.smile + 0.1 * p.press, 0.15, 0.85)
			draw_polyline(fold, Color(crease_color, a), 4.0, true)
			draw_polyline(fold, Color(1.0, 0.88, 0.55, a * 0.35), 1.5, true)

	# Shadow under the lower lip.
	var shadow := PackedVector2Array()
	for i in range(2, SAMPLES - 1):
		shadow.append(lower_outer[i] + Vector2(0, 3))
	draw_polyline(shadow, Color(crease_color, 0.2), 5.0, true)

	var is_open := open_px > 1.5
	if is_open:
		var cavity := upper_inner.duplicate()
		var li_rev := lower_inner.duplicate()
		li_rev.reverse()
		cavity.append_array(li_rev)
		_poly(cavity, cavity_color)
		# Tongue.
		if open_px > 12.0:
			var tc := Vector2(0, lower_inner[SAMPLES / 2].y - minf(open_px * 0.16, 7.0))
			var tongue := PackedVector2Array()
			for i in 20:
				var a := PI + PI * float(i) / 19.0
				tongue.append(tc + Vector2(cos(a) * hw * 0.42, sin(a) * minf(open_px * 0.2, 9.0)))
			for i in range(SAMPLES * 4 / 5, SAMPLES / 5 - 1, -1):
				var v := lower_inner[i]
				if absf(v.x) <= hw * 0.42:
					tongue.append(v + Vector2(0, -1))
			_poly(tongue, tongue_color)
		# Upper teeth.
		var teeth_h := 6.0 + 5.0 * p.teeth
		var teeth := PackedVector2Array()
		var bottom := PackedVector2Array()
		var lo := int(SAMPLES * 0.14)
		var hi := SAMPLES - lo
		for i in range(lo, hi + 1):
			teeth.append(upper_inner[i] + Vector2(0, -0.5))
			bottom.append(Vector2(upper_inner[i].x, minf(upper_inner[i].y + teeth_h, lower_inner[i].y - 0.5)))
		bottom.reverse()
		teeth.append_array(bottom)
		_poly(teeth, teeth_color)
		# Lower teeth when lips are pulled back.
		if p.teeth > 0.3 and open_px > 4.0:
			var lt_poly := PackedVector2Array()
			var top_row := PackedVector2Array()
			for i in range(lo + 2, hi - 1):
				lt_poly.append(lower_inner[i] + Vector2(0, 0.5))
				top_row.append(Vector2(lower_inner[i].x, maxf(lower_inner[i].y - 4.0 * p.teeth, upper_inner[i].y + teeth_h)))
			top_row.reverse()
			lt_poly.append_array(top_row)
			_poly(lt_poly, teeth_color.darkened(0.12))

	# Lips.
	var upper := upper_outer.duplicate()
	var ui_rev := upper_inner.duplicate()
	ui_rev.reverse()
	upper.append_array(ui_rev)
	_poly(upper, lip_color.darkened(0.1))
	var lower := lower_inner.duplicate()
	var lo_rev := lower_outer.duplicate()
	lo_rev.reverse()
	lower.append_array(lo_rev)
	_poly(lower, lip_color)

	# Sculpted outer edges of the lips.
	draw_polyline(upper_outer, Color(crease_color, 0.75), 2.0, true)
	draw_polyline(lower_outer, Color(crease_color, 0.6), 2.5, true)

	# Lip line / inner edges.
	if is_open:
		draw_polyline(upper_inner, lip_shadow_color, 1.6, true)
		draw_polyline(lower_inner, lip_shadow_color, 1.2, true)
	else:
		draw_polyline(upper_inner, crease_color, 2.6, true)
	# Highlight on the lower lip.
	var hl := PackedVector2Array()
	for i in range(int(SAMPLES * 0.3), int(SAMPLES * 0.7) + 1):
		hl.append(lower_inner[i].lerp(lower_outer[i], 0.45))
	draw_polyline(hl, Color(1, 0.92, 0.65, 0.4), 2.5, true)
	# Corner creases.
	for side in [0, SAMPLES]:
		var c := upper_inner[side]
		var s := -1.0 if side == 0 else 1.0
		var dimple := PackedVector2Array([c + Vector2(-2 * s, -2), c + Vector2(3 * s, 0), c + Vector2(-1 * s, 4)])
		draw_polyline(dimple, Color(crease_color, 0.5 + 0.3 * press), 2.0, true)


func _poly(raw: PackedVector2Array, color: Color) -> void:
	# Drop duplicate neighbours (the triangulator rejects them).
	var points := PackedVector2Array()
	for v in raw:
		if points.is_empty() or points[-1].distance_squared_to(v) > 0.01:
			points.append(v)
	if points.size() > 1 and points[0].distance_squared_to(points[-1]) <= 0.01:
		points.remove_at(points.size() - 1)
	if points.size() < 3:
		return
	# Skip degenerate polygons (they make the triangulator complain).
	var area := 0.0
	for i in points.size():
		var a := points[i]
		var b := points[(i + 1) % points.size()]
		area += a.x * b.y - b.x * a.y
	if absf(area) < 2.0:
		return
	if Geometry2D.triangulate_polygon(points).is_empty():
		return  # self-intersecting at some extreme pose; skip this frame
	draw_colored_polygon(points, color)
	var outline := points.duplicate()
	outline.append(points[0])
	draw_polyline(outline, color, 1.0, true)

