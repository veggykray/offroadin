class_name CausalClockHubView
extends CausalClockElementView
## The heart of the clock: a layered gold rosette with the socket(s) the chain
## must reach. It turns only when couplings drive it. When the puzzle is
## solved its petals open and the core blooms with light.

var mat: Dictionary
var linked_socket: int = -1
var bloom: float = 0.0  # 0..1, animated on completion
var _time: float = 0.0
var _glow: Node2D


func setup(p_layout: CausalClockLayout, p_index: int, p_geo: CausalClockGeometry) -> void:
	super.setup(p_layout, p_index, p_geo)
	mat = CausalClockPalette.material(element.material)
	_glow = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_glow.material = m
	_glow.draw.connect(_draw_glow)
	add_child(_glow)


func set_linked_socket(s: int) -> void:
	if s != linked_socket:
		linked_socket = s
		queue_redraw()


func _animate(dt: float) -> void:
	_time += dt
	_glow.queue_redraw()
	if bloom > 0.0 and bloom < 1.0:
		queue_redraw()


func _draw() -> void:
	var r := geo.hub_radius
	draw_circle(Vector2(3, 5), r, Color(0, 0, 0, 0.45))
	CausalClockDraw.band(self, r * 0.18, r, mat, 12)
	var dark: Color = mat["dark"]
	var light: Color = mat["light"]
	# Engraved minute track.
	for k in 48:
		var a := k * 7.5
		draw_line(CausalClockGeometry.point(a, r - 2), CausalClockGeometry.point(a, r - (7.0 if k % 6 == 0 else 4.0)), mat["engrave"], 1.0, true)
	# Two layers of petals; they swing open with `bloom`.
	for layer in 2:
		var count := 8
		var rr := r * (0.78 if layer == 0 else 0.56)
		var spread := 1.0 + bloom * 0.35
		for k in count:
			var a := (k + 0.5 * layer) * 360.0 / count + bloom * 18.0 * (1 - 2 * layer)
			var tip := CausalClockGeometry.point(a, rr * spread)
			var l := CausalClockGeometry.point(a - 14.0, rr * 0.45)
			var rgt := CausalClockGeometry.point(a + 14.0, rr * 0.45)
			var base := CausalClockGeometry.point(a, rr * 0.25)
			var poly := PackedVector2Array([base, l, tip, rgt])
			draw_colored_polygon(poly, (dark if layer == 0 else mat["base"]).lerp(light, 0.15 * layer))
			poly.append(base)
			draw_polyline(poly, light * Color(1, 1, 1, 0.55), 1.0, true)
	# Core jewel.
	var core := Color(0.55, 0.12, 0.08).lerp(Color(1.0, 0.75, 0.4), bloom)
	draw_circle(Vector2.ZERO, r * 0.26, dark)
	draw_circle(Vector2.ZERO, r * 0.21, core)
	draw_circle(Vector2(-r * 0.06, -r * 0.07), r * 0.07, Color(1, 1, 1, 0.55))
	# Sockets: a keyhole notch on the rim, and the chain end when linked.
	var step := element.step_degrees()
	for si in element.sockets.size():
		var a2 := element.sockets[si] * step
		var p := CausalClockGeometry.point(a2, r - 9)
		draw_circle(p, 7.5, Color(0, 0, 0, 0.75))
		draw_arc(p, 7.5, 0, TAU, 16, light, 1.6, true)
		var lit := si == linked_socket
		draw_circle(p, 3.6, CausalClockPalette.INLAY_LIT if lit else Color(0.3, 0.12, 0.06))
		if lit:
			var pts := PackedVector2Array([CausalClockGeometry.point(a2, r + 2), CausalClockGeometry.point(a2, r * 0.3)])
			CausalClockDraw.chain(self, pts, 8.0, CausalClockPalette.CHAIN_LIT, 1.0)


func _draw_glow() -> void:
	var r := geo.hub_radius
	var beat := 0.5 + 0.5 * sin(_time * 2.2)
	CausalClockDraw.glow(_glow, Vector2.ZERO, r * (0.5 + bloom * 1.6), Color(1.0, 0.45, 0.25, 0.12 + 0.06 * beat + bloom * 0.6))
	if linked_socket >= 0:
		var a := element.sockets[linked_socket] * element.step_degrees()
		CausalClockDraw.glow(_glow, CausalClockGeometry.point(a, r - 9), 20.0, CausalClockPalette.GLOW * Color(1, 1, 1, 0.35 + 0.2 * beat))
