extends "res://minigames/polarity_machine/scripts/continuum_control.gd"
## AGE — a clock-like dial wound by a crank, wrapped in carved rings that turn faster the older
## the room becomes. Its five stations are carved pictograms: seed, shoot, plant, bent tree, dead tree.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const SWEEP := 2.0944  # ±120°
const FACE_R := 112.0
const RING_IN := 116.0
const RING_OUT := 156.0
const CRANK_R := 178.0

var _ring_a := 0.0
var _ring_b := 0.0


func _process(delta: float) -> void:
	# Time flows faster the older the field is set — a constant tell, even in the dark.
	_ring_a += delta * (0.05 + display * 0.09)
	_ring_b -= delta * (0.03 + display * 0.05)
	super._process(delta)


func _hit_test(p: Vector2) -> bool:
	if p.length() < RING_OUT + 8.0:
		return true
	return p.distance_to(dir_from_up(_angle_for(display)) * CRANK_R) < 34.0


func _value_from_point(p: Vector2) -> float:
	var a := angle_from_up(p)
	if absf(a) > SWEEP + 0.5:
		return display
	return remap(a, -SWEEP, SWEEP, 0.0, float(MAX_VALUE))


func _angle_for(v: float) -> float:
	return remap(v, 0.0, float(MAX_VALUE), -SWEEP, SWEEP)


func _draw() -> void:
	var kick := Vector2(sin(_time * 50.0), 0) * _jolt * 2.0
	draw_set_transform(kick)

	# Outer carved ring: strange glyphs.
	draw_circle(Vector2.ZERO, RING_OUT + 8.0, sh(Color(0.04, 0.03, 0.04)))
	U.ring(self, Vector2.ZERO, RING_IN + 18.0, RING_OUT, 0.0, TAU, sh(Color(0.36, 0.24, 0.18)), 56)
	for k in 18:
		var a := _ring_a + float(k) * TAU / 18.0
		var d := Vector2(cos(a), sin(a))
		var t := d.orthogonal()
		var c := (RING_IN + RING_OUT + 18.0) * 0.5
		var col := sh(Color(0.75, 0.6, 0.42))
		match k % 3:
			0:
				draw_line(d * (c - 8.0), d * (c + 8.0), col, 2.0)
				draw_line(d * c - t * 5.0, d * c + t * 5.0, col, 2.0)
			1:
				draw_arc(d * c, 5.0, 0.0, TAU, 10, col, 1.5)
			2:
				draw_polyline(PackedVector2Array([d * (c - 7.0) - t * 4.0, d * (c + 7.0), d * (c - 7.0) + t * 4.0]), col, 1.5)
	draw_arc(Vector2.ZERO, RING_OUT, 0.0, TAU, 64, brass(), 3.0, true)
	# Inner counter-rotating tick ring.
	U.ring(self, Vector2.ZERO, RING_IN, RING_IN + 18.0, 0.0, TAU, brass(0.7), 56)
	for k in 60:
		var a := _ring_b + float(k) * TAU / 60.0
		var d := Vector2(cos(a), sin(a))
		var ln := 9.0 if k % 5 == 0 else 4.0
		draw_line(d * (RING_IN + 2.0), d * (RING_IN + 2.0 + ln), sh(Color(0.2, 0.13, 0.08)), 1.5)

	# Bone-white face that yellows and crazes with age (the machine keeps working regardless).
	var face := Color(0.92, 0.87, 0.74).lerp(Color(0.72, 0.62, 0.42), smoothstep(1.5, 4.0, wear))
	draw_circle(Vector2.ZERO, FACE_R, sh(face))
	U.radial(self, Vector2.ZERO, FACE_R, U.CLEAR, sh(Color(0.3, 0.2, 0.1, 0.35)), 32)
	if wear > 2.8:
		var cr := clampf((wear - 2.8) / 1.2, 0.0, 1.0)
		var cc := Color(0.25, 0.17, 0.1, 0.7 * cr)
		draw_polyline(PackedVector2Array([Vector2(-80, -40), Vector2(-50, -30), Vector2(-38, -5), Vector2(-10, 4)]), cc, 1.5)
		draw_polyline(PackedVector2Array([Vector2(60, 70), Vector2(40, 45), Vector2(48, 20)]), cc, 1.5)

	# Pictogram stations.
	for i in MAX_VALUE + 1:
		var a := _angle_for(float(i))
		var gp := dir_from_up(a) * 76.0
		var lit := clampf(1.0 - absf(display - float(i)) * 1.5, 0.0, 1.0)
		if lit > 0.05:
			U.radial(self, gp, 26.0, Color(0.95, 0.75, 0.3, 0.45 * lit), U.CLEAR, 14)
		_draw_station(i, gp, sh(Color(0.22, 0.14, 0.08)).lerp(Color(0.55, 0.25, 0.05), lit))

	# Crank: the arm reaches from the hub, past the rim, to a turned wooden handle.
	var ang := _angle_for(display)
	var d0 := dir_from_up(ang)
	var s0 := d0.orthogonal()
	var hand_tip := d0 * 96.0
	U.quad(self, s0 * 7.0, hand_tip + s0 * 2.0, hand_tip - s0 * 2.0, -s0 * 7.0, sh(Color(0.12, 0.08, 0.06)))
	U.tri(self, hand_tip + s0 * 7.0, hand_tip + d0 * 14.0, hand_tip - s0 * 7.0, sh(Color(0.12, 0.08, 0.06)))
	var crank_end := d0 * CRANK_R
	var bend := crank_end + s0 * 0.0
	U.quad(self, -d0 * 18.0 + s0 * 6.0, bend + s0 * 6.0, bend - s0 * 6.0, -d0 * 18.0 - s0 * 6.0, brass(0.75))
	draw_line(-d0 * 16.0 + s0 * 2.0, bend + s0 * 2.0, brass(1.3), 1.5)
	if hovered or dragging:
		U.radial(self, crank_end, 50.0, Color(1.0, 0.9, 0.6, 0.3), U.CLEAR, 18)
	draw_circle(crank_end, 22.0 + _jolt * 2.0, sh(Color(0.05, 0.03, 0.02)))
	draw_circle(crank_end, 18.0, sh(Color(0.42, 0.24, 0.12)))
	draw_arc(crank_end, 12.0, 0.0, TAU, 16, sh(Color(0.3, 0.16, 0.08)), 2.0)
	draw_circle(crank_end + Vector2(-5, -6), 6.0, sh(Color(1, 1, 1, 0.22)))

	# Hub with an hourglass sigil.
	draw_circle(Vector2.ZERO, 24.0, sh(Color(0.05, 0.03, 0.03)))
	draw_circle(Vector2.ZERO, 20.0, brass())
	var hg := sh(Color(0.25, 0.16, 0.08))
	U.tri(self, Vector2(-9, -11), Vector2(9, -11), Vector2(0, 0), hg)
	U.tri(self, Vector2(-9, 11), Vector2(9, 11), Vector2(0, 0), hg)
	draw_set_transform(Vector2.ZERO)


func _draw_station(i: int, p: Vector2, c: Color) -> void:
	match i:
		0:  # seed
			U.ellipse(self, p, 6.0, 8.0, c, 14)
			draw_line(p + Vector2(0, -8), p + Vector2(2, -12), c, 1.5)
		1:  # shoot
			draw_line(p + Vector2(0, 10), p + Vector2(0, -6), c, 2.0)
			U.ellipse(self, p + Vector2(-5, -6), 5.0, 2.5, c, 10)
			U.ellipse(self, p + Vector2(5, -8), 5.0, 2.5, c, 10)
		2:  # full plant with crown
			draw_line(p + Vector2(0, 12), p + Vector2(0, -2), c, 2.5)
			draw_circle(p + Vector2(0, -6), 9.0, c)
		3:  # bent, gnarled tree
			draw_polyline(PackedVector2Array([p + Vector2(-2, 12), p + Vector2(3, 4), p + Vector2(-2, -2), p + Vector2(4, -8)]), c, 2.5)
			draw_arc(p + Vector2(4, -9), 7.0, PI, TAU, 10, c, 3.0)
		4:  # dead, bare branches
			draw_line(p + Vector2(0, 12), p + Vector2(0, -4), c, 2.0)
			draw_line(p + Vector2(0, -1), p + Vector2(-8, -10), c, 1.5)
			draw_line(p + Vector2(0, 2), p + Vector2(8, -8), c, 1.5)
			draw_line(p + Vector2(-5, -7), p + Vector2(-9, -5), c, 1.0)
