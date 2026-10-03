extends BodyRegion
## THE GREAT FLAP — somewhere between an ear, a fin and a leaf. Starts curled
## shut. Likes rubbing near its base, hates being poked. Once it unfolds it
## reveals a pale, downy underside.

const LENGTH := 640.0
const SPINE_SEGS := 22

var unfold := 0.0          ## animated 0 curled .. 1 open
var unfold_target := 0.0   ## set by the sequence
var swing := 0.0           ## spring offset in radians
var swing_v := 0.0
var flutter := 0.0         ## membrane ripple amount
var recoil := 0.0          ## pulled-in after a poke
var outline := PackedVector2Array()
var spine := PackedVector2Array()
var normals := PackedVector2Array()
var widths := PackedFloat32Array()
var down: Array = []
var blob_r: Array = []
var under_layer: GlowLayer

const UNDERSIDE := Vector2(130, -70)
const UNDERSIDE_R := Vector2(175, 105)


func _setup() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 202
	for i in range(300):
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf())
		down.append({"o": Vector2(cos(a) * r, sin(a) * r) * 0.92,
			"l": rng.randf_range(7, 16), "a": a * 0.15 + rng.randf_range(-0.5, 0.5), "ph": rng.randf() * TAU,
			"c": rng.randf_range(0.0, 1.0)})
	for i in range(40):
		var a := TAU * i / 40.0
		blob_r.append(1.0 + 0.07 * sin(a * 3.0 + 1.0) + 0.05 * sin(a * 5.0 + 2.0))
	under_layer = GlowLayer.new(_draw_under, -1, false)
	add_child(under_layer)


func revealed() -> float:
	return clampf((unfold - 0.45) / 0.45, 0.0, 1.0)


func zone_at(world_pos: Vector2) -> StringName:
	var lp := to_local(world_pos)
	if revealed() > 0.6 and ((lp - UNDERSIDE) / UNDERSIDE_R).length() <= 1.05:
		return &"underside"
	if lp.distance_to(Vector2(0, -30)) < 120.0:
		return &"base"
	if outline.size() > 2 and Geometry2D.is_point_in_polygon(lp, outline):
		return &"blade"
	return &""


func contains(world_pos: Vector2) -> bool:
	return accessible and zone_at(world_pos) != &""


func focus_point() -> Vector2:
	if revealed() > 0.5:
		return to_global(UNDERSIDE)
	return to_global(Vector2(0, -160))


func _update(delta: float) -> void:
	recoil = Game.damp(recoil, 0.0, 1.2, delta)
	var target := clampf(unfold_target - recoil * 0.55, 0.0, 1.0)
	unfold = Game.damp(unfold, target, 0.9, delta)
	flutter = Game.damp(flutter, clampf(excitement + attention * 0.7, 0.0, 1.0), 2.5, delta)
	var e := Game.escalation()
	var breath: float = Game.body.breath if Game.body else 0.0
	var idle := sin(t * 0.7) * 0.03 + breath * 0.02 + sin(t * 9.0) * attention * 0.05
	idle += sin(t * 5.5) * maxf(e - 0.5, 0.0) * 0.08
	swing_v += (-(swing - idle) * 30.0 - swing_v * 5.0) * delta
	swing += swing_v * delta
	_build_shape()
	under_layer.queue_redraw()


func _build_shape() -> void:
	var u := unfold
	var base_angle := lerpf(-PI * 0.5 + 0.28, -PI * 0.5 - 0.62, u) + swing - recoil * 0.25
	var curl := lerpf(2.6, 0.35, u) + recoil * 1.2
	var max_w := lerpf(70.0, 270.0, u)
	spine.clear()
	normals.clear()
	widths.clear()
	var p := Vector2(0, -10)
	var ang := base_angle
	var seg := LENGTH / SPINE_SEGS * lerpf(0.82, 1.0, u)
	for i in range(SPINE_SEGS + 1):
		var s := float(i) / SPINE_SEGS
		spine.append(p)
		normals.append(Vector2.from_angle(ang).orthogonal())
		var w := pow(sin(PI * clampf(s * 0.95 + 0.04, 0.0, 1.0)), 0.75) * max_w
		w *= 1.0 + 0.08 * sin(s * 14.0 + t * 3.0) * flutter
		widths.append(w)
		ang += curl * pow(s, 1.6) / SPINE_SEGS * 2.2 + sin(t * 1.3 + s * 4.0) * 0.004
		p += Vector2.from_angle(ang) * seg
	outline = PackedVector2Array()
	for i in range(spine.size()):
		var s := float(i) / SPINE_SEGS
		var ripple := sin(s * 22.0 - t * 6.0) * 7.0 * flutter * s
		outline.append(spine[i] + normals[i] * (widths[i] * 0.55 + ripple))
	for i in range(spine.size() - 1, -1, -1):
		var s := float(i) / SPINE_SEGS
		var ripple := sin(s * 19.0 - t * 5.0 + 1.0) * 7.0 * flutter * s
		outline.append(spine[i] - normals[i] * (widths[i] * 0.45 + ripple))


func _on_reaction(level: int, _lp: Vector2, g: Gesture) -> void:
	if g != null and g.type == Gesture.Type.POKE:
		recoil = 1.0
		swing_v += 3.5
		if Game.voice:
			Game.voice.play_at(&"rustle", global_position + Vector2(0, -200), -2.0, 0.7)
		return
	match level:
		Game.Level.GOOD:
			swing_v += randf_range(-0.6, 0.6)
		Game.Level.VERY_GOOD:
			swing_v += randf_range(-1.4, 1.4)
		Game.Level.WRONG:
			swing_v += 2.0
			recoil = maxf(recoil, 0.5)


func body_jolt(strength: float) -> void:
	swing_v += randf_range(-2.0, 2.0) * strength


func _draw_under(layer: GlowLayer) -> void:
	var rev := revealed()
	# Root shadow.
	Paint.soft_ellipse(layer, Vector2(40, 0), Vector2(330, 150), Color(0.02, 0.01, 0.02, 0.75))
	# The downy underside pocket.
	if rev > 0.01:
		var sc := lerpf(0.55, 1.0, rev)
		var outline_pts := PackedVector2Array()
		var cols := PackedColorArray()
		var n := blob_r.size()
		for i in range(n):
			var ang := TAU * i / n
			var wob: float = blob_r[i] + sin(t * 1.5 + i) * 0.02 * excitement
			outline_pts.append(UNDERSIDE + Vector2(cos(ang) * UNDERSIDE_R.x, sin(ang) * UNDERSIDE_R.y) * sc * wob)
			cols.append(Color(0.36, 0.22, 0.3).lerp(Color(0.58, 0.4, 0.46), rev))
		layer.draw_polygon(outline_pts, cols)
		Paint.soft_ellipse(layer, UNDERSIDE + Vector2(-10, -12), UNDERSIDE_R * 0.8 * sc, Color(0.86, 0.68, 0.7, 0.45 * rev))
		Paint.soft_ellipse(layer, UNDERSIDE + Vector2(-30, -30), UNDERSIDE_R * 0.4 * sc, Color(1.0, 0.9, 0.85, 0.25 * rev))
		for d in down:
			var root: Vector2 = UNDERSIDE + d.o * UNDERSIDE_R * sc
			var a: float = -PI * 0.5 + d.a + sin(t * 2.0 + d.ph) * 0.15 + sin(t * 18.0 + d.ph) * excitement * 0.25
			var tip: Vector2 = root + Vector2.from_angle(a) * d.l * rev
			var mid: Vector2 = root.lerp(tip, 0.5) + Vector2.from_angle(a).orthogonal() * 2.0
			var col := Color(0.95, 0.85, 0.82).lerp(Color(0.8, 0.62, 0.7), d.c)
			col.a = 0.55 * rev
			layer.draw_polyline(PackedVector2Array([root, mid, tip]), col, 1.6, true)



func _draw() -> void:
	var rev := revealed()
	# Root sheath: folded lobes of skin covering the underside while curled.
	var sheath_k := 1.0 - rev
	if sheath_k > 0.01:
		for k in range(3):
			var c := UNDERSIDE + Vector2(-20.0 + k * 30.0, 10.0 + k * 22.0) - Vector2(60, -40) * rev
			var rr := UNDERSIDE_R * Vector2(1.0 - k * 0.18, 0.75 - k * 0.12) * lerpf(1.0, 0.5, rev)
			var lobe := Paint.ellipse_points(c, rr, 28, -0.15)
			var top_c := Color(0.44, 0.28, 0.31)
			var bot_c := Color(0.2, 0.1, 0.14)
			top_c.a = sheath_k
			bot_c.a = sheath_k
			Paint.gradient_poly(self, lobe, top_c, bot_c)
			draw_arc(c + Vector2(0, rr.y * 0.1), rr.x * 0.9, PI * 1.12, PI * 1.88, 18, Color(0.62, 0.42, 0.42, 0.5 * sheath_k), 3.0, true)
			draw_arc(c, rr.x * 1.0, PI * 0.1, PI * 0.9, 18, Color(0.06, 0.02, 0.04, 0.7 * sheath_k), 4.0, true)

	# Blade.
	if outline.size() > 2:
		var cols := PackedColorArray()
		var n := spine.size()
		for i in range(outline.size()):
			var si := i if i < n else (2 * n - 1 - i)
			var s := float(si) / SPINE_SEGS
			cols.append(Color(0.28, 0.12, 0.2).lerp(Color(0.62, 0.3, 0.32), s * 0.9))
		if Geometry2D.triangulate_polygon(outline).size() > 0:
			draw_polygon(outline, cols)
		else:
			var widest := 0.0
			for w in widths:
				widest = maxf(widest, w)
			draw_polyline(spine, Color(0.45, 0.2, 0.26), maxf(widest * 0.8, 8.0), true)
		draw_polyline(outline + PackedVector2Array([outline[0]]), Color(0.16, 0.05, 0.1), 4.0, true)
		# Veins.
		draw_polyline(spine, Color(0.18, 0.07, 0.12), 9.0, true)
		draw_polyline(spine, Color(0.55, 0.3, 0.32), 3.0, true)
		for i in range(2, n - 2, 2):
			var s := float(i) / SPINE_SEGS
			for side in [1.0, -1.0]:
				var w: float = widths[i] * (0.55 if side > 0 else 0.45)
				var a: Vector2 = spine[i]
				var tip: Vector2 = spine[mini(i + 3, n - 1)] + normals[mini(i + 3, n - 1)] * w * side * 0.92
				var mid: Vector2 = a.lerp(tip, 0.5) + normals[i] * side * 8.0
				draw_polyline(PackedVector2Array([a, mid, tip]), Color(0.2, 0.08, 0.13, 0.75), 2.5 - s, true)


func _draw_glow(layer: GlowLayer) -> void:
	if outline.size() < 3:
		return
	var e := Game.escalation()
	var n := spine.size()
	# Back-lit translucent membrane: thin edges glow amber.
	for i in range(1, n - 1, 2):
		var s := float(i) / SPINE_SEGS
		var k := 0.18 + 0.25 * s + flutter * 0.2 + e * 0.15
		layer.blob(spine[i] + normals[i] * widths[i] * 0.3, widths[i] * 0.7 + 20.0, Color(1.0, 0.45, 0.25, k * 0.25))
		layer.blob(spine[i] - normals[i] * widths[i] * 0.25, widths[i] * 0.5 + 16.0, Color(1.0, 0.3, 0.35, k * 0.18))
	var rev := revealed()
	if rev > 0.05:
		layer.blob(UNDERSIDE, UNDERSIDE_R.x * 1.1, Color(0.9, 0.7, 1.0, (0.1 + excitement * 0.25 + attention * 0.25) * rev))
	if attention > 0.02:
		layer.blob(Vector2(0, -60), 160.0, Color(1, 0.6, 0.4, attention * 0.25))
