extends BodyRegion
## THE LUMINOUS NODULES — glowing bumps beneath a translucent membrane.
## Each reacts on its own when poked. Once awake they pulse together, and
## enjoy being tapped in time with that pulse.

const NOTES := [1.0, 1.122, 1.335, 1.498, 1.682, 2.0, 2.245]  # pentatonic-ish

var nodes: Array = []
var awake := 0.0  ## 0..1, set by the sequence when the rhythm stage begins
var veins: Array = []
var last_hit := -1


func _setup() -> void:
	var layout := [
		Vector2(-230, 20), Vector2(-140, -60), Vector2(-40, 30), Vector2(60, -70),
		Vector2(150, 25), Vector2(245, -40), Vector2(20, 105),
	]
	var radii := [40.0, 48.0, 58.0, 44.0, 52.0, 36.0, 34.0]
	for i in range(layout.size()):
		nodes.append({"pos": layout[i], "r": radii[i], "flash": 0.0, "squish": 0.0, "sv": 0.0,
			"phase": randf() * TAU, "note": NOTES[i], "hue": 0.45 + i * 0.03, "beat": 0.0})
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	for i in range(14):
		var a := rng.randf() * TAU
		var pts := PackedVector2Array()
		var p := Vector2(cos(a), sin(a)) * rng.randf_range(20, 90)
		var dir := a + rng.randf_range(-0.5, 0.5)
		for k in range(7):
			pts.append(p)
			dir += rng.randf_range(-0.5, 0.5)
			p += Vector2.from_angle(dir) * rng.randf_range(25, 45)
		veins.append(pts)


func nearest_node(lp: Vector2) -> int:
	var best := -1
	var bd := INF
	for i in range(nodes.size()):
		var d: float = lp.distance_to(nodes[i].pos) / nodes[i].r
		if d < bd:
			bd = d
			best = i
	return best if bd < 2.2 else -1


func _update(delta: float) -> void:
	var beat: float = Game.sequence.beat_pulse() if Game.sequence else 0.0
	for n in nodes:
		n.flash = Game.damp(n.flash, 0.0, 3.5, delta)
		n.sv += (-n.squish * 160.0 - n.sv * 9.0) * delta
		n.squish += n.sv * delta
		n.beat = beat


func _on_reaction(level: int, lp: Vector2, g: Gesture) -> void:
	if g != null and g.type == Gesture.Type.RHYTHM:
		return
	var i := nearest_node(lp)
	if i < 0:
		return
	last_hit = i
	var n: Dictionary = nodes[i]
	match level:
		Game.Level.WRONG:
			n.sv += 6.0
			n.flash = maxf(n.flash, 0.25)
		Game.Level.NEUTRAL, Game.Level.CLOSE:
			n.sv += 4.0
			n.flash = maxf(n.flash, 0.55)
		_:
			n.sv += 5.0
			n.flash = 1.0
	if g != null and g.type == Gesture.Type.POKE and Game.voice:
		var vol := -4.0 if level >= Game.Level.GOOD else -10.0
		var detune := 1.0 if level >= Game.Level.GOOD else randf_range(0.94, 0.97)
		Game.voice.play_at(&"chime", to_global(n.pos), vol, n.note * detune)


func body_jolt(strength: float) -> void:
	for n in nodes:
		n.sv += randf_range(1.0, 3.0) * strength


func _draw() -> void:
	# Membrane dome.
	Paint.soft_ellipse(self, Vector2(0, 20), Vector2(420, 230), Color(0.02, 0.02, 0.05, 0.75))
	Paint.ellipse(self, Vector2(0, 15), Vector2(330, 165), Color(0.14, 0.13, 0.2), 40)
	Paint.ellipse(self, Vector2(0, 5), Vector2(310, 145), Color(0.2, 0.2, 0.28), 40)
	for v in veins:
		draw_polyline(v, Color(0.35, 0.22, 0.36, 0.7), 3.0, true)
	for n in nodes:
		var s: float = 1.0 - n.squish * 0.06
		var r: float = n.r
		var p: Vector2 = n.pos
		Paint.ellipse(self, p + Vector2(0, r * 0.25), Vector2(r * 1.15, r * 0.8) * Vector2(1.0 / s, s), Color(0.08, 0.06, 0.12), 24)
		Paint.ellipse(self, p, Vector2(r, r * 0.85) * Vector2(1.0 / s, s), Color(0.22, 0.32, 0.38), 24)
		Paint.ellipse(self, p - Vector2(r * 0.25, r * 0.3), Vector2(r * 0.45, r * 0.3), Color(0.55, 0.7, 0.75, 0.35), 16)
	# Membrane sheen across the top.
	draw_arc(Vector2(0, 30), 300.0, PI * 1.12, PI * 1.88, 40, Color(0.8, 0.85, 1.0, 0.12), 18.0, true)


func _draw_glow(layer: GlowLayer) -> void:
	var e := Game.escalation()
	for i in range(nodes.size()):
		var n: Dictionary = nodes[i]
		var idle := 0.18 + 0.12 * sin(t * (0.6 + i * 0.13) + n.phase)
		var b: float = n.get("beat", 0.0) * awake
		var k: float = clampf(idle * (1.0 - awake * 0.5) + b * 0.75 + n.flash * 0.9 + attention * 0.3 + e * 0.15, 0.0, 1.6)
		var col := Color.from_hsv(lerpf(0.47, 0.13, clampf(b * 0.5 + n.flash * 0.6, 0.0, 1.0)), 0.75, 1.0)
		var r: float = n.r
		layer.blob(n.pos, r * (1.1 + k * 0.6), col * Color(1, 1, 1, 0.55 * k))
		layer.blob(n.pos, r * 0.45, Color(1, 1, 0.9, 0.5 * k))
		if n.flash > 0.05:
			layer.ring(n.pos, r * (1.4 + (1.0 - n.flash) * 1.5), col * Color(1, 1, 1, n.flash * 0.6))
	if awake > 0.0:
		var b: float = Game.sequence.beat_pulse() if Game.sequence else 0.0
		layer.blob(Vector2(0, 10), 380.0, Color(0.3, 0.9, 0.8, 0.12 * b * awake))
