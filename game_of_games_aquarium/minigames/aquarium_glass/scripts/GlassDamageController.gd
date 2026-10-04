extends Node2D
## Glass damage from HARD KNOCKS. No health bar: only cracks.
##
##   1st knock(s)  : tiny white stress mark
##   then          : small crack
##   then          : branching crack
##   later         : big spidered crack + ominous creaking (sound + crack shimmer)
##
## The glass never actually breaks: damage caps at 1.0 and further knocks just
## groan. `damage` (0..1) is reported in the result data.

## Damage added per hard knock (8 knocks = maximum).
@export var damage_per_knock := 0.125
## Knocks closer than this to an existing crack grow that crack.
@export var merge_radius := 150.0
## Damage above which the glass starts creaking on its own.
@export var creak_threshold := 0.6

var activity: Node
var damage := 0.0
var cracks: Array = []   # {pos, level, seed, lines: Array[PackedVector2Array], shimmer, finale}
var _creak_timer := 8.0
var _t := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity
	z_index = 61


func reset_damage() -> void:
	damage = 0.0
	cracks.clear()
	_creak_timer = 8.0
	queue_redraw()


func on_hard_knock(pos: Vector2) -> void:
	var was_max := damage >= 1.0
	damage = minf(1.0, damage + damage_per_knock)
	var target_level := clampi(int(damage * 4.0), 0, 3)
	var nearest = null
	var nd := merge_radius
	for c in cracks:
		if c.finale:
			continue
		var d: float = (c.pos as Vector2).distance_to(pos)
		if d < nd:
			nd = d
			nearest = c
	if nearest != null:
		nearest.level = mini(3, maxi(nearest.level + 1, target_level))
		_build(nearest)
		nearest.shimmer = 1.0
	else:
		var c2 := {"pos": pos, "level": maxi(0, target_level - 1), "seed": randi(), "lines": [], "shimmer": 1.0, "finale": false}
		_build(c2)
		cracks.append(c2)
	if was_max:
		activity.audio.play("glass_stress", 2.0, 0.6)
		activity.glass_fx.set_tremble(1.0)
	elif damage >= 0.25:
		activity.audio.play("glass_crack", -2.0 + damage * 4.0, randf_range(0.9, 1.1))
	else:
		activity.audio.play("glass_crack", -12.0, 1.4)
	if damage >= creak_threshold:
		_creak_timer = minf(_creak_timer, 1.2)
	queue_redraw()


func debug_reduce() -> void:
	damage = maxf(0.0, damage - damage_per_knock)
	for i in range(cracks.size() - 1, -1, -1):
		if cracks[i].finale:
			continue
		cracks[i].level -= 1
		if cracks[i].level < 0:
			cracks.remove_at(i)
		else:
			_build(cracks[i])
		break
	queue_redraw()


## The enormous answering tap leaves its own mark (not counted as player damage).
func giant_crack(pos: Vector2) -> void:
	var c := {"pos": pos, "level": 3, "seed": randi(), "lines": [], "shimmer": 1.5, "finale": true}
	_build(c, 1.6)
	cracks.append(c)
	queue_redraw()


func tick(delta: float) -> void:
	_t += delta
	var dirty := false
	for c in cracks:
		if c.shimmer > 0.0:
			c.shimmer = maxf(0.0, c.shimmer - delta * 0.8)
			dirty = true
	if damage >= creak_threshold and activity.is_running():
		_creak_timer -= delta
		if _creak_timer <= 0.0:
			_creak_timer = randf_range(7.0, 13.0) * lerpf(1.0, 0.5, (damage - creak_threshold) / (1.0 - creak_threshold))
			activity.audio.play("glass_stress", -4.0 + damage * 4.0, randf_range(0.85, 1.05))
			activity.glass_fx.set_tremble(0.5)
			if cracks.size() > 0:
				var c2 = cracks[randi() % cracks.size()]
				c2.shimmer = 1.0
				# The crack creeps a tiny bit further.
				if c2.lines.size() > 0:
					var li = randi() % c2.lines.size()
					var line: PackedVector2Array = c2.lines[li]
					if line.size() >= 2:
						var dir := (line[-1] - line[-2]).normalized()
						line.append(line[-1] + dir.rotated(randf_range(-0.5, 0.5)) * randf_range(4, 10))
						c2.lines[li] = line
			dirty = true
	activity.glass_fx.set_tremble(move_toward(activity.glass_fx._tremble, 0.0, delta * 1.5))
	if dirty:
		queue_redraw()


func _build(c: Dictionary, size_mul := 1.0) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = c.seed
	var lines: Array = []
	var level: int = c.level
	var origin: Vector2 = c.pos
	match level:
		0:
			for i in 4:
				var a := rng.randf() * TAU
				lines.append(PackedVector2Array([origin, origin + Vector2.from_angle(a) * rng.randf_range(4, 9)]))
		_:
			var count := 4 + level * 2
			var max_len: float = [0.0, 45.0, 110.0, 210.0][level] * size_mul
			var spokes: Array = []
			for i in count:
				var a2 := TAU * float(i) / count + rng.randf_range(-0.3, 0.3)
				var pts := PackedVector2Array([origin])
				var p := origin
				var dir := Vector2.from_angle(a2)
				var seg_total := rng.randf_range(0.5, 1.0) * max_len
				var steps := 3 + level * 2
				for s in steps:
					dir = dir.rotated(rng.randf_range(-0.35, 0.35))
					p += dir * seg_total / steps
					pts.append(p)
					# Branches.
					if level >= 2 and s > 1 and rng.randf() < 0.3:
						var bp := PackedVector2Array([p])
						var bd := dir.rotated(rng.randf_range(0.5, 1.0) * (1.0 if rng.randf() > 0.5 else -1.0))
						var q := p
						for k in 3:
							bd = bd.rotated(rng.randf_range(-0.3, 0.3))
							q += bd * seg_total / steps * 0.7
							bp.append(q)
						lines.append(bp)
				lines.append(pts)
				spokes.append(pts)
			# Spider-web rings.
			if level >= 3:
				for ring in [0.35, 0.65]:
					for i in spokes.size():
						var s1: PackedVector2Array = spokes[i]
						var s2: PackedVector2Array = spokes[(i + 1) % spokes.size()]
						var i1 := int(ring * (s1.size() - 1))
						var i2 := int(ring * (s2.size() - 1))
						var mid := (s1[i1] + s2[i2]) * 0.5 + (s1[i1] + s2[i2] - origin * 2.0).normalized() * -4.0
						lines.append(PackedVector2Array([s1[i1], mid, s2[i2]]))
	c.lines = lines


func _draw() -> void:
	for c in cracks:
		var sh: float = c.shimmer
		var bright := Color(1, 1, 1, 0.7 + 0.3 * sh)
		var shadow := Color(0, 0.02, 0.05, 0.35)
		var w := 1.4 if c.level < 2 else 1.8
		for line in c.lines:
			var pl: PackedVector2Array = line
			if pl.size() < 2:
				continue
			var off := PackedVector2Array()
			for p in pl:
				off.append(p + Vector2(1.2, 1.5))
			draw_polyline(off, shadow, w + 0.8)
			draw_polyline(pl, bright, w)
			if sh > 0.0:
				draw_polyline(pl, Color(0.8, 1.0, 1.0, 0.4 * sh), w + 3.0)
		# Impact point: frosted bruise.
		var r = 5.0 + c.level * 4.0
		draw_circle(c.pos, r, Color(1, 1, 1, 0.12 + 0.05 * c.level))
		draw_circle(c.pos, r * 0.4, Color(1, 1, 1, 0.35))
		# Glint.
		var g := 0.5 + 0.5 * sin(_t * 1.5 + float(c.seed % 100))
		draw_line(c.pos + Vector2(-r * 1.5, 0), c.pos + Vector2(r * 1.5, 0), Color(1, 1, 1, 0.15 * g), 1.0)
