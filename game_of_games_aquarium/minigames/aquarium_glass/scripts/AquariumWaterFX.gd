extends Node2D

const AqDraw = preload("AqDraw.gd")
## Water particles drawn in a single node: floating motes at several depths
## (they get shoved by vibrations - "the glass affects the water"), rising
## bubbles, bitten-off fragments, impact bursts and sand puffs.

@export var mote_count := 260
@export var ambient_bubble_rate := 1.2

var activity: Node
var motes: Array = []      # {p, v, depth, phase}
var bubbles: Array = []    # {p, v, r, life}
var bits: Array = []       # {p, v, c, life, rot, rv, s}
var bursts: Array = []     # {p, v, c, life}
var puffs: Array = []      # {p, r, life}
var _t := 0.0
var _vents: Array = []


func setup(p_activity: Node) -> void:
	activity = p_activity
	z_index = 30
	var b: Rect2 = activity.aquarium_bounds
	motes.clear()
	for i in mote_count:
		motes.append({
			"p": Vector2(randf_range(b.position.x, b.end.x), randf_range(b.position.y, b.end.y)),
			"v": Vector2.ZERO,
			"depth": pow(randf(), 1.6),
			"phase": randf() * TAU,
		})
	_vents.clear()
	for i in 4:
		_vents.append(Vector2(randf_range(b.position.x + 100, b.end.x - 100), activity.get_floor_y()))


func push(pos: Vector2, radius: float, strength: float) -> void:
	for m in motes:
		var d: Vector2 = m.p - pos
		var l := d.length()
		if l < radius and l > 0.1:
			var f = (1.0 - l / radius) * strength * (0.4 + 0.6 * (1.0 - m.depth))
			m.v += d / l * f * 260.0
	for bb in bubbles:
		var d2: Vector2 = bb.p - pos
		var l2 := d2.length()
		if l2 < radius and l2 > 0.1:
			bb.v += d2 / l2 * (1.0 - l2 / radius) * strength * 150.0


func spawn_bubbles(pos: Vector2, count: int, size := 1.0) -> void:
	for i in count:
		bubbles.append({"p": pos + Vector2(randf_range(-10, 10), randf_range(-10, 10)), "v": Vector2(randf_range(-30, 30), randf_range(-80, -20)), "r": randf_range(2.0, 6.0) * size, "life": randf_range(2.0, 5.0), "ph": randf() * TAU})


func spawn_fragments(pos: Vector2, color: Color, count: int) -> void:
	for i in count:
		bits.append({"p": pos, "v": Vector2(randf_range(-90, 90), randf_range(-110, 10)), "c": color.lightened(randf_range(-0.1, 0.15)), "life": randf_range(2.5, 4.5), "rot": randf() * TAU, "rv": randf_range(-8, 8), "s": randf_range(2.5, 6.0)})


func burst(pos: Vector2, color: Color, count: int) -> void:
	for i in count:
		var a := randf() * TAU
		bursts.append({"p": pos, "v": Vector2.from_angle(a) * randf_range(60, 260), "c": color, "life": randf_range(0.4, 0.9)})


func spawn_sand(pos: Vector2, count: int) -> void:
	for i in count:
		puffs.append({"p": pos + Vector2(randf_range(-20, 20), randf_range(-6, 2)), "r": randf_range(6, 14), "life": 1.0, "v": Vector2(randf_range(-30, 30), randf_range(-25, -5))})


func tick(delta: float) -> void:
	_t += delta
	var b: Rect2 = activity.aquarium_bounds
	var energy: float = activity.environment.chase_energy if activity.environment else 0.0
	var top: float = b.position.y + 8.0
	for m in motes:
		var drift := Vector2(sin(_t * 0.3 + m.phase) * 6.0 + 4.0 * energy, cos(_t * 0.23 + m.phase * 1.3) * 4.0)
		m.v *= exp(-2.2 * delta)
		m.p += (m.v + drift) * delta
		if m.p.x < b.position.x: m.p.x = b.end.x
		elif m.p.x > b.end.x: m.p.x = b.position.x
		if m.p.y < b.position.y: m.p.y = b.end.y
		elif m.p.y > b.end.y: m.p.y = b.position.y
	if randf() < delta * ambient_bubble_rate * (1.0 + energy * 2.0):
		var v: Vector2 = _vents[randi() % _vents.size()]
		spawn_bubbles(v + Vector2(randf_range(-6, 6), -4), randi_range(1, 3), 0.7)
	for i in range(bubbles.size() - 1, -1, -1):
		var bb = bubbles[i]
		bb.v.y = move_toward(bb.v.y, -70.0 - bb.r * 8.0, 120.0 * delta)
		bb.v.x *= exp(-1.5 * delta)
		bb.p += (bb.v + Vector2(sin(_t * 4.0 + bb.ph) * 18.0, 0)) * delta
		bb.life -= delta
		if bb.p.y < top or bb.life <= 0.0:
			bubbles.remove_at(i)
	for i in range(bits.size() - 1, -1, -1):
		var f = bits[i]
		f.v.y += 60.0 * delta
		f.v *= exp(-1.8 * delta)
		f.p += f.v * delta
		f.rot += f.rv * delta
		f.life -= delta
		if f.p.y > activity.get_floor_y():
			f.p.y = activity.get_floor_y()
			f.v = Vector2.ZERO
			f.rv = 0.0
		if f.life <= 0.0:
			bits.remove_at(i)
	for i in range(bursts.size() - 1, -1, -1):
		var bu = bursts[i]
		bu.v *= exp(-5.0 * delta)
		bu.p += bu.v * delta
		bu.life -= delta
		if bu.life <= 0.0:
			bursts.remove_at(i)
	for i in range(puffs.size() - 1, -1, -1):
		var pf = puffs[i]
		pf.life -= delta * 0.7
		pf.r += delta * 22.0
		pf.p += pf.v * delta
		if pf.life <= 0.0:
			puffs.remove_at(i)
	queue_redraw()


func _draw() -> void:
	var light: float = activity.environment.light if activity.environment else 1.0
	for m in motes:
		var depth: float = m.depth
		var s := lerpf(2.4, 0.8, depth)
		var a := lerpf(0.35, 0.1, depth) * light * (0.7 + 0.3 * sin(_t * 1.5 + m.phase))
		draw_circle(m.p, s, Color(0.75, 0.95, 0.9, a))
	for pf in puffs:
		draw_circle(pf.p, pf.r, Color(0.6, 0.55, 0.45, 0.25 * pf.life))
	for f in bits:
		var xf := Transform2D(f.rot, f.p)
		var s2: float = f.s
		AqDraw.poly(self, PackedVector2Array([xf * Vector2(-s2, -s2 * 0.5), xf * Vector2(s2, -s2 * 0.3), xf * Vector2(s2 * 0.4, s2 * 0.6)]), Color(f.c, clampf(f.life, 0.0, 1.0)))
	for bb in bubbles:
		draw_arc(bb.p, bb.r, 0, TAU, 12, Color(0.85, 1.0, 1.0, 0.55), 1.3)
		draw_circle(bb.p + Vector2(-bb.r * 0.35, -bb.r * 0.35), bb.r * 0.3, Color(1, 1, 1, 0.6))
	for bu in bursts:
		draw_circle(bu.p, 3.0 * bu.life + 1.0, Color(bu.c, clampf(bu.life * 1.5, 0.0, 1.0)))
