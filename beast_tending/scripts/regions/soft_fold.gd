extends BodyRegion
## THE SOFT FOLD — heavy, warm rolls of leathery skin stacked over each other.
## Wants slow, even strokes along its length. Warms in colour as it relaxes;
## the rolls bunch up and creak when handled roughly.

const SEGS := 40
## Each roll: x offset, half width, centre y, thickness.
const ROLLS := [
	[-40.0, 370.0, -95.0, 135.0],
	[15.0, 430.0, -10.0, 150.0],
	[45.0, 380.0, 78.0, 130.0],
]

var wave := 0.0       ## travelling undulation amplitude
var clench := 0.0     ## 0..1 tightening
var flush := 0.0      ## 0..1 warm colour shift
var dents: Array = [] ## pressure dents from the hand {pos, k}
var bristles: Array = []


func _setup() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 991
	for i in range(46):
		bristles.append({"roll": rng.randi() % ROLLS.size(), "u": rng.randf_range(-0.85, 0.85),
			"f": rng.randf_range(0.15, 0.7), "l": rng.randf_range(8, 18), "ph": rng.randf() * TAU})


func _update(delta: float) -> void:
	clench = Game.damp(clench, tension, 4.0, delta)
	var stage_warm: float = Game.sequence.fold_warmth() if Game.sequence else 0.0
	flush = Game.damp(flush, clampf(relax * 1.4 + stage_warm, 0.0, 1.0), 0.8, delta)
	wave = Game.damp(wave, clampf(excitement * 1.2 + attention * 0.8, 0.0, 1.5), 2.0, delta)
	for d in dents:
		d.k = Game.damp(d.k, 0.0, 3.0, delta)
	dents = dents.filter(func(d): return d.k > 0.02)


func _on_pointer(_prev: Vector2, lp: Vector2, pressed: bool, _vel: Vector2) -> void:
	if pressed and _ellipse_dist(lp) < 1.1:
		if dents.size() > 0 and dents[dents.size() - 1].pos.distance_to(lp) < 30.0:
			dents[dents.size() - 1].k = 1.0
			dents[dents.size() - 1].pos = lp
		else:
			dents.append({"pos": lp, "k": 1.0})
			if dents.size() > 12:
				dents.pop_front()


func _on_reaction(level: int, _lp: Vector2, _g: Gesture) -> void:
	if level == Game.Level.WRONG and Game.voice and randf() < 0.5:
		Game.voice.play_at(&"creak", global_position, -6.0, randf_range(0.8, 1.2))


func body_jolt(strength: float) -> void:
	excitement = minf(excitement + 0.3 * strength, 1.0)


func _dent(p: Vector2) -> float:
	var s := 0.0
	for d in dents:
		var dd: float = p.distance_to(d.pos)
		s += exp(-dd * dd / 3000.0) * d.k * 9.0
	return s


## Top and bottom edge of roll `i` at normalised position u (-1..1).
func _roll_edges(i: int, u: float) -> Vector2:
	var r: Array = ROLLS[i]
	var breath: float = Game.body.breath if Game.body else 0.0
	var x: float = r[0] + u * r[1]
	var prof := sqrt(maxf(1.0 - u * u, 0.0))
	prof = pow(prof, 0.55)
	var cy: float = r[2] * (1.0 - clench * 0.22)
	cy += sin(x * 0.016 - t * 2.4 + i * 1.3) * wave * 8.0
	cy += sin(x * 0.007 + t * 0.35 + i) * 6.0
	var th: float = r[3] * (1.0 - clench * 0.18) + breath * 4.0
	var top := cy - th * 0.58 * prof
	var bot := cy + th * 0.42 * prof
	return Vector2(top, bot)


func _draw() -> void:
	var cool := Color(0.4, 0.26, 0.26)
	var warm := Color(0.72, 0.42, 0.29)
	var base := cool.lerp(warm, flush)
	var lit := base.lightened(0.2)
	var dark := base.darkened(0.6 + clench * 0.25)

	Paint.soft_ellipse(self, Vector2(10, 30), Vector2(560, 250), Color(0.03, 0.01, 0.02, 0.75))

	for i in range(ROLLS.size()):
		var r: Array = ROLLS[i]
		var top := PackedVector2Array()
		var bot := PackedVector2Array()
		for k in range(SEGS + 1):
			var u := lerpf(-1.0, 1.0, float(k) / SEGS)
			var x: float = r[0] + u * r[1]
			var e := _roll_edges(i, u)
			var tp := Vector2(x, e.x)
			tp.y += _dent(tp)
			tp.y = minf(tp.y, e.y - 2.0)
			top.append(tp)
			bot.append(Vector2(x, e.y))
		# Shadow this roll casts on whatever is beneath it.
		var shadow := PackedVector2Array()
		for k in range(SEGS + 1):
			shadow.append(bot[k] + Vector2(0, 4))
		draw_polyline(shadow, Color(0.02, 0.0, 0.01, 0.55), 22.0 + clench * 10.0, true)
		# Body of the roll: lit on top, shadowed underneath.
		Paint.band(self, top, bot, lit, dark)
		# Rounded mid-tone band to sell the volume.
		var mid := PackedVector2Array()
		var hi := PackedVector2Array()
		for k in range(2, SEGS - 1):
			mid.append(top[k].lerp(bot[k], 0.45))
			hi.append(top[k].lerp(bot[k], 0.16))
		draw_polyline(mid, base * Color(1, 1, 1, 0.5), 18.0, true)
		draw_polyline(hi, lit.lightened(0.25) * Color(1, 1, 1, 0.45), 5.0, true)
		# Wrinkles along the roll; more when clenched.
		var wc := 2 + int(clench * 3.0)
		for w in range(wc):
			var f := 0.3 + 0.5 * float(w) / maxf(wc - 1, 1)
			var line := PackedVector2Array()
			for k in range(6, SEGS - 5):
				var p := top[k].lerp(bot[k], f)
				line.append(p + Vector2(0, sin(p.x * 0.05 + w * 2.0 + i) * 2.5))
			draw_polyline(line, dark * Color(1, 1, 1, 0.3 + clench * 0.4), 1.6 + clench * 1.6, true)
		# Crease where the roll tucks under.
		draw_polyline(bot, Color(0.05, 0.015, 0.02), 4.0 + clench * 4.0, true)

	for b in bristles:
		var e := _roll_edges(b.roll, b.u)
		var r: Array = ROLLS[b.roll]
		var p := Vector2(r[0] + b.u * r[1], lerpf(e.x, e.y, b.f))
		var tip := p + Vector2(sin(t * 1.3 + b.ph) * 3.0, -b.l * (1.0 + excitement * 0.6 - clench * 0.4))
		draw_circle(p, 2.2, dark)
		draw_line(p, tip, Color(0.12, 0.07, 0.06), 1.5, true)


func _draw_glow(layer: GlowLayer) -> void:
	var e := Game.escalation()
	var k := flush * 0.3 + excitement * 0.25 + attention * 0.3
	for i in range(ROLLS.size()):
		var r: Array = ROLLS[i]
		for s in range(7):
			var u := lerpf(-0.75, 0.75, s / 6.0)
			var ed := _roll_edges(i, u)
			var pulse := 0.6 + 0.4 * sin(t * 1.4 + s * 0.7 + i)
			layer.blob(Vector2(r[0] + u * r[1], ed.y), 70.0, Color(1.0, 0.5, 0.25, k * 0.16 * pulse))
	if e > 0.4:
		layer.blob(Vector2(0, 0), 460.0, Color(1.0, 0.45, 0.3, (e - 0.4) * 0.12))
	for d in dents:
		layer.blob(d.pos, 50.0, Color(1, 0.6, 0.35, d.k * 0.16))
