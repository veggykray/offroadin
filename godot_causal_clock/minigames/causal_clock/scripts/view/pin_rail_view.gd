class_name CausalClockPinRailView
extends Node2D
## The fixed lock rail: one socket per pinnable ring, an engraved plate with
## the ring's letter, and the brass locking pins that drop in and out.

var layout: CausalClockLayout
var geo: CausalClockGeometry
var pinned: PackedByteArray = PackedByteArray()
var _drop: PackedFloat32Array = PackedFloat32Array()  # 0 = out, 1 = seated
var _flash: PackedFloat32Array = PackedFloat32Array()
var _hint: int = -1
var _time: float = 0.0
var _iron := CausalClockPalette.material("iron")
var _brass := CausalClockPalette.material("brass")
var _fx: Node2D


func setup(p_layout: CausalClockLayout, p_geo: CausalClockGeometry) -> void:
	layout = p_layout
	geo = p_geo
	var n := layout.element_count()
	pinned.resize(n)
	pinned.fill(0)
	_drop.resize(n)
	_drop.fill(0.0)
	_flash.resize(n)
	_flash.fill(0.0)
	_fx = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_fx.material = m
	_fx.draw.connect(_draw_fx)
	add_child(_fx)


func socket_pos(element: int) -> Vector2:
	return CausalClockGeometry.point(layout.elements[element].pin_angle_deg, geo.mid(element))


func set_pinned(element: int, value: bool, instant: bool = false) -> void:
	pinned[element] = 1 if value else 0
	if instant:
		_drop[element] = 1.0 if value else 0.0
	queue_redraw()


func flash(element: int) -> void:
	if element >= 0 and element < _flash.size():
		_flash[element] = 1.0


func set_hint(element: int) -> void:
	_hint = element


func socket_at(local: Vector2) -> int:
	for e in layout.elements:
		if e.pinnable and local.distance_to(socket_pos(e.index)) < 14.0:
			return e.index
	return -1


func _process(dt: float) -> void:
	_time += dt
	var busy := _hint >= 0
	for i in _drop.size():
		var goal := float(pinned[i])
		if _drop[i] != goal:
			_drop[i] = move_toward(_drop[i], goal, dt * (2.6 if goal > 0.5 else 5.0))
			busy = true
		if _flash[i] > 0.0:
			_flash[i] = maxf(0.0, _flash[i] - dt * 1.8)
			busy = true
	if busy:
		queue_redraw()
		_fx.queue_redraw()


static func _bounce(t: float) -> float:
	# Ease-out bounce: the pin lands, hops once, and seats.
	if t < 0.6:
		var u := t / 0.6
		return u * u
	var v := (t - 0.8) / 0.2
	return 1.0 - 0.12 * (1.0 - v * v) if t < 1.0 else 1.0


func _draw() -> void:
	# Rail bars for groups of sockets that share an angle.
	var angles := {}
	for e in layout.elements:
		if e.pinnable:
			angles[e.pin_angle_deg] = true
	for a in angles.keys():
		var r0 := geo.bezel_inner + 10.0
		var r1 := geo.hub_radius + 4.0
		var p0 := CausalClockGeometry.point(a, r0)
		var p1 := CausalClockGeometry.point(a, r1)
		draw_line(p0 + Vector2(3, 5), p1 + Vector2(3, 5), Color(0, 0, 0, 0.5), 12.0, true)
		draw_line(p0, p1, _iron["dark"], 11.0, true)
		draw_line(p0, p1, _iron["base"], 8.0, true)
		var n := Vector2(-CausalClockGeometry.dir(a).y, CausalClockGeometry.dir(a).x)
		draw_line(p0 - n * 2.5, p1 - n * 2.5, _iron["edge"] * Color(1, 1, 1, 0.45), 1.2, true)
	for e in layout.elements:
		if e.is_hub:
			continue
		var at := CausalClockGeometry.point(e.pin_angle_deg, geo.mid(e.index))
		var t := CausalClockGeometry.dir(e.pin_angle_deg)
		var n2 := Vector2(-t.y, t.x)
		_draw_plate(at + n2 * 26.0, e.id, e.pinnable)
		if e.pinnable:
			_draw_socket(e.index, at)


func _draw_plate(at: Vector2, label: String, active: bool) -> void:
	var r := Rect2(at - Vector2(14, 13), Vector2(28, 26))
	draw_rect(Rect2(r.position + Vector2(2, 3), r.size), Color(0, 0, 0, 0.5))
	draw_rect(r, _brass["dark"] if active else _iron["dark"])
	draw_rect(r.grow(-2), _brass["light"] if active else _iron["light"])
	draw_rect(r.grow(-4), _brass["base"] if active else _iron["base"], false, 1.0)
	CausalClockDraw.text(self, at + Vector2(0, 0.5), label, 19, Color(0.16, 0.09, 0.02) if active else Color(0.08, 0.08, 0.08))


func _draw_socket(i: int, at: Vector2) -> void:
	draw_circle(at, 11.0, _iron["dark"])
	draw_arc(at, 11.0, 0, TAU, 20, _iron["edge"] * Color(1, 1, 1, 0.6), 1.4, true)
	draw_circle(at, 6.0, Color(0.02, 0.02, 0.03))
	var d := _drop[i]
	if d <= 0.001:
		return
	var seat := _bounce(d)
	var lift := (1.0 - seat) * 30.0
	var scale_f := 1.0 + (1.0 - seat) * 0.5
	var alpha := clampf(d * 3.0, 0.0, 1.0)
	# Shadow tightens as the pin seats.
	draw_circle(at + Vector2(3, 4) * (1.0 + lift * 0.08), 10.0 * scale_f, Color(0, 0, 0, 0.45 * alpha))
	var head := at - Vector2(0, lift)
	var r := 10.0 * scale_f
	draw_circle(head, r, Color(_brass["dark"], alpha))
	draw_circle(head, r * 0.86, Color(_brass["base"], alpha))
	draw_circle(head, r * 0.55, Color(CausalClockPalette.PIN, alpha))
	draw_circle(head, r * 0.3, Color(CausalClockPalette.PIN.lightened(0.35), alpha))
	draw_circle(head - Vector2(r, r) * 0.32, r * 0.22, Color(1, 1, 1, 0.65 * alpha))
	draw_arc(head, r * 0.93, -2.6, -0.8, 8, Color(_brass["edge"], alpha), 1.4, true)


func _draw_fx() -> void:
	for i in _flash.size():
		if _flash[i] > 0.0:
			CausalClockDraw.glow(_fx, socket_pos(i), 34.0, Color(1.0, 0.2, 0.15, _flash[i] * 0.8))
		if pinned[i] == 1 and _drop[i] >= 1.0:
			CausalClockDraw.glow(_fx, socket_pos(i), 18.0, Color(1.0, 0.35, 0.25, 0.18))
	if _hint >= 0 and _hint < _flash.size():
		var b := 0.5 + 0.5 * sin(_time * 5.0)
		CausalClockDraw.glow(_fx, socket_pos(_hint), 30.0 + 8.0 * b, Color(0.55, 0.85, 1.0, 0.35 + 0.3 * b))
