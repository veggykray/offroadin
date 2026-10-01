class_name CausalClockCouplingView
extends Node2D
## Draws one coupling as a physical part on top of the rings:
##   gear    – a two-way idler gear bridging two neighbouring rings,
##   ratchet – the same with a pawl and an arrow: drives one way only,
##   shaft   – a long rod with end gears linking non-neighbouring elements.
## A small lamp beside cam couplings shows whether the toothed arc is
## currently under the gear (lit = engaged). Little arrows on the mount say
## whether the link keeps (same) or reverses (opposite) the direction.

var layout: CausalClockLayout
var c: CausalClockLayout.CouplingDef
var geo: CausalClockGeometry
var engaged: bool = true
var spin: float = 0.0
var flash: float = 0.0
var slip: float = 0.0
var jam: float = 0.0
var highlight: float = 0.0

var gear_r: float = 15.0
var p_outer: Vector2
var p_inner: Vector2
var _outer: int
var _inner: int
var _mesh: int
var _mesh_radius: float
var _last_angle: float = 0.0
var _time: float = 0.0
var _iron := CausalClockPalette.material("iron")
var _brass := CausalClockPalette.material("brass")
var _fx: Node2D


func setup(p_layout: CausalClockLayout, p_c: CausalClockLayout.CouplingDef, p_geo: CausalClockGeometry) -> void:
	layout = p_layout
	c = p_c
	geo = p_geo
	_outer = mini(c.a, c.b)
	_inner = maxi(c.a, c.b)
	gear_r = clampf(geo.band * 0.24, 11.0, 18.0)
	p_outer = CausalClockGeometry.point(c.angle_deg, geo.seam(_outer, _outer + 1))
	p_inner = CausalClockGeometry.point(c.angle_deg, geo.seam(_inner - 1, _inner))
	# The gear always meshes with the non-cam element (a cam ring only has
	# teeth on some sectors), so it spins with that one.
	_mesh = c.a
	if c.has_cam() and c.cam_element == c.a:
		_mesh = c.b
	_mesh_radius = geo.seam(_outer, _outer + 1)
	_fx = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_fx.material = m
	_fx.draw.connect(_draw_fx)
	add_child(_fx)


func is_shaft() -> bool:
	return c.style == "shaft"


## Called every frame by the clock with the current display angles.
func follow(angles: PackedFloat32Array) -> void:
	var a := angles[_mesh]
	var d := a - _last_angle
	_last_angle = a
	if absf(d) > 0.0:
		spin -= d * _mesh_radius / gear_r
		queue_redraw()


func reset_follow(angles: PackedFloat32Array) -> void:
	_last_angle = angles[_mesh]


func _process(dt: float) -> void:
	_time += dt
	var busy := flash > 0.0 or slip > 0.0 or jam > 0.0 or highlight > 0.0
	flash = maxf(0.0, flash - dt * 1.6)
	slip = maxf(0.0, slip - dt * 1.4)
	jam = maxf(0.0, jam - dt * 1.1)
	if busy or (c.has_cam() and engaged):
		_fx.queue_redraw()
	if busy:
		queue_redraw()


func _draw() -> void:
	var t := CausalClockGeometry.dir(c.angle_deg)
	var n := Vector2(-t.y, t.x)
	if is_shaft():
		# Rod with brackets across the intermediate rings.
		draw_line(p_outer + Vector2(3, 4), p_inner + Vector2(3, 4), Color(0, 0, 0, 0.45), 9.0, true)
		draw_line(p_outer, p_inner, _iron["dark"], 8.0, true)
		draw_line(p_outer, p_inner, _brass["base"], 5.0, true)
		draw_line(p_outer - n * 1.2, p_inner - n * 1.2, _brass["edge"] * Color(1, 1, 1, 0.6), 1.2, true)
		for k in range(_outer + 1, _inner):
			var bp := CausalClockGeometry.point(c.angle_deg, geo.seam(k - 1, k) - 2.0)
			draw_rect(Rect2(bp - Vector2(7, 7), Vector2(14, 14)), _iron["base"])
			CausalClockDraw.rivet(self, bp, 2.4, _brass)
		CausalClockDraw.gear(self, p_outer, gear_r, 12, spin, _brass)
		CausalClockDraw.gear(self, p_inner, gear_r * 0.8, 10, -spin * 1.25, _brass)
	else:
		# Mount plate bridging the seam.
		var plate := PackedVector2Array([
			p_outer - t * (gear_r + 8) - n * 7, p_outer + t * (gear_r + 8) - n * 7,
			p_outer + t * (gear_r + 8) + n * 7, p_outer - t * (gear_r + 8) + n * 7])
		var sh := plate.duplicate()
		for i in sh.size():
			sh[i] += Vector2(2, 3)
		draw_colored_polygon(sh, Color(0, 0, 0, 0.4))
		draw_colored_polygon(plate, _iron["base"])
		plate.append(plate[0])
		draw_polyline(plate, _iron["edge"] * Color(1, 1, 1, 0.5), 1.0, true)
		CausalClockDraw.rivet(self, p_outer - t * (gear_r + 4), 2.0, _iron)
		CausalClockDraw.rivet(self, p_outer + t * (gear_r + 4), 2.0, _iron)
		var mat := _brass if c.style != "ratchet" else CausalClockPalette.material("copper")
		CausalClockDraw.gear(self, p_outer, gear_r, 12, spin, mat)
	if c.one_way:
		_draw_pawl(t, n)
	_draw_direction_badge(t, n)
	if c.has_cam():
		var lamp := _lamp_pos()
		draw_circle(lamp, 5.5, Color(0, 0, 0, 0.7))
		draw_arc(lamp, 5.5, 0, TAU, 12, _brass["light"], 1.2, true)
		draw_circle(lamp, 3.5, Color(1.0, 0.8, 0.35) if engaged else Color(0.22, 0.16, 0.12))


func _lamp_pos() -> Vector2:
	var n := Vector2(-CausalClockGeometry.dir(c.angle_deg).y, CausalClockGeometry.dir(c.angle_deg).x)
	return p_outer + n * (gear_r + 10)


## A one-way link: pawl on the gear and an arrow from driver to follower.
func _draw_pawl(t: Vector2, n: Vector2) -> void:
	var at := p_outer
	var pivot := at - n * (gear_r + 8) + t * 4
	var tip := at - n * (gear_r * 0.75) - t * 3
	draw_line(pivot, tip, _iron["dark"], 4.0, true)
	draw_line(pivot, tip, _iron["edge"], 1.6, true)
	draw_circle(pivot, 2.6, _brass["light"])
	# Arrow: points from a towards b (radially), engraved on a small plaque.
	var towards_inner := c.b > c.a
	var arrow_dir := -t if towards_inner else t
	var base := at - n * (gear_r + 11) - arrow_dir * 7
	var head := base + arrow_dir * 14
	draw_line(base, head, _brass["light"], 2.0, true)
	draw_colored_polygon(PackedVector2Array([head + arrow_dir * 4, head - n * 3.5, head + n * 3.5]), _brass["light"])


## Two tiny arcs: same direction (+ratio) or opposite (-ratio).
func _draw_direction_badge(t: Vector2, n: Vector2) -> void:
	# Sits beside the cam lamp when there is one, else where the lamp would be.
	var at := p_outer + n * (gear_r + 10) - t * (14.0 if c.has_cam() else 0.0)
	var col: Color = _brass["edge"] * Color(1, 1, 1, 0.85)
	draw_circle(at, 7.5, Color(0, 0, 0, 0.55))
	var dirs := [1.0, 1.0 if c.ratio > 0 else -1.0]
	for k in 2:
		var center := at + Vector2(-3.0 if k == 0 else 3.0, 0)
		var s: float = dirs[k]
		var a0 := -2.4
		var a1 := 0.6
		draw_arc(center, 3.2, a0, a1, 8, col, 1.1, true)
		var end_a := a1 if s > 0 else a0
		var end_p := center + Vector2.from_angle(end_a) * 3.2
		var tang := Vector2.from_angle(end_a + PI * 0.5 * s)
		draw_line(end_p, end_p - tang * 2.2 + Vector2.from_angle(end_a) * 1.2, col, 1.1, true)


func _draw_fx() -> void:
	if flash > 0.0:
		CausalClockDraw.glow(_fx, p_outer, gear_r * 2.4, Color(1.0, 0.8, 0.45, flash * 0.55))
		if is_shaft():
			CausalClockDraw.glow(_fx, p_inner, gear_r * 2.0, Color(1.0, 0.8, 0.45, flash * 0.5))
	if slip > 0.0:
		for k in 5:
			var a := _time * 23.0 + k * 1.7
			var p := p_outer + Vector2.from_angle(a) * gear_r * (0.9 + 0.2 * sin(a * 3.0))
			CausalClockDraw.glow(_fx, p, 6.0, Color(1.0, 0.55, 0.2, slip * 0.8))
	if jam > 0.0:
		CausalClockDraw.glow(_fx, p_outer, gear_r * 3.2, Color(1.0, 0.15, 0.1, jam * 0.7))
	if highlight > 0.0:
		CausalClockDraw.glow(_fx, p_outer, gear_r * 2.2, Color(0.6, 0.85, 1.0, highlight * 0.35))
	if c.has_cam() and engaged:
		CausalClockDraw.glow(_fx, _lamp_pos(), 12.0, Color(1.0, 0.75, 0.3, 0.35 + 0.1 * sin(_time * 3.0)))
