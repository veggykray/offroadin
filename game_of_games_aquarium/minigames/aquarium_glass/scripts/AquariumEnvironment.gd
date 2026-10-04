extends Node2D
## Placeholder aquarium art, generated procedurally so the module needs no
## image files: deep water backdrop (shader), far silhouettes, mid scenery,
## light shafts, rocks drawn around the Layout/Obstacles, plants that sway and
## react to vibrations, soft "puffweed" the Bastards can chew, loose pebbles,
## foreground plants (hiding spots) and a darkness overlay for the finale.
##
## Gameplay never depends on any of this except:
##  * get_pebbles()   - small pushable stones (the Idiot copies the Blimp with them)
##  * get_bitables()  - puffweed plants
## Hide it (AquariumActivity.show_placeholder_environment = false) when the
## real aquarium art is in place.

const WaterShader = preload("../shaders/water_background.gdshader")
const AqDraw = preload("AqDraw.gd")

## Random seed for plant / rock placement.
@export var layout_seed := 7
@export var pebble_count := 3

class Pebble:
	extends RefCounted
	var position := Vector2.ZERO
	var velocity := Vector2.ZERO
	var body_radius := 12.0
	var body_mass := 0.7
	var body_enabled := true
	var floor_locked := true
	var collision_group := ""
	var is_pebble := true
	var color := Color.GRAY
	var rot := 0.0
	var env = null

	func on_body_collision(other, _n: Vector2, rel_speed: float) -> void:
		if rel_speed > 40.0 and env and not (other is Dictionary):
			env.activity.audio.play("shell_move", -18.0, 1.8)


class PlantBite:
	extends RefCounted
	var plant: Dictionary
	var env = null

	func can_be_bitten() -> bool:
		return plant.health > 0.25

	func bite_priority() -> float:
		return 0.5

	func bite_point() -> Vector2:
		return plant.base + Vector2(0, -plant.height * 0.6)

	func take_bite(_from, amount: float) -> bool:
		if plant.health <= 0.25:
			return false
		plant.health = maxf(0.2, plant.health - amount * 0.02)
		plant.bend_vel += randf_range(-3.0, 3.0)
		env.activity.water_fx.spawn_fragments(bite_point(), plant.color, 1)
		return true


var activity: Node
var light := 1.0
var _light_from := 1.0
var _light_to := 1.0
var _light_t := 1.0
var _light_dur := 0.0
var chase_energy := 0.0

var plants: Array = []        # play-plane plants
var fg_plants: Array = []     # foreground (in front of creatures)
var mid_items: Array = []
var far_items: Array = []
var shafts: Array = []
var rock_shapes: Array = []   # [{pts, color, node_pos}]
var pebbles: Array = []
var bitables: Array = []
var decor: Array = []         # small static floor decorations
var _t := 0.0
var _rng := RandomNumberGenerator.new()

var _bg: ColorRect
var _far: Node2D
var _mid: Node2D
var _shaft_layer: Node2D
var _play: Node2D
var _fg: Node2D
var _dark: Node2D


func setup(p_activity: Node) -> void:
	activity = p_activity
	_rng.seed = layout_seed
	var b: Rect2 = activity.aquarium_bounds
	var floor_y: float = activity.get_floor_y()

	_bg = ColorRect.new()
	_bg.position = b.position
	_bg.size = b.size
	_bg.z_index = -100
	_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mat := ShaderMaterial.new()
	mat.shader = WaterShader
	mat.set_shader_parameter("aspect", b.size.x / b.size.y)
	mat.set_shader_parameter("floor_uv", (floor_y - b.position.y) / b.size.y)
	mat.set_shader_parameter("horizon_uv", (floor_y - 85.0 - b.position.y) / b.size.y)
	_bg.material = mat
	add_child(_bg)

	_far = _make_layer(-95, _draw_far)
	_mid = _make_layer(-80, _draw_mid)
	_shaft_layer = _make_layer(-60, _draw_shafts)
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_shaft_layer.material = add
	_play = _make_layer(-5, _draw_play)
	_fg = _make_layer(25, _draw_fg)
	_dark = _make_layer(45, _draw_dark)

	_generate()


func _make_layer(z: int, cb: Callable) -> Node2D:
	var n := Node2D.new()
	n.z_index = z
	add_child(n)
	n.draw.connect(cb.bind(n))
	return n


func get_pebbles() -> Array:
	return pebbles


func get_bitables() -> Array:
	return bitables


func set_light(v: float, duration: float) -> void:
	_light_from = light
	_light_to = v
	_light_dur = duration
	_light_t = 0.0
	if duration <= 0.0:
		light = v
		_light_t = 1.0


func set_chase_energy(v: float) -> void:
	chase_energy = v


## A vibration in the water: plants bend away, tube worms retract.
func disturb(pos: Vector2, radius: float, strength: float) -> void:
	for list in [plants, fg_plants, mid_items]:
		for p in list:
			if not p.has("bend_vel"):
				continue
			var tip: Vector2 = p.base + Vector2(0, -p.height * 0.6)
			var d := tip.distance_to(pos)
			if d < radius:
				var f := (1.0 - d / radius) * strength
				p.bend_vel += signf(tip.x - pos.x + 0.01) * f * 2.5
				if p.type == "tube":
					p.retract = minf(1.0, p.retract + f * 1.5)


## Something huge moved in the deep: everything sways together (nothing visible).
func ghost_sway(x_center: float, strength: float) -> void:
	for list in [plants, fg_plants, mid_items, far_items]:
		for p in list:
			if p.has("bend_vel"):
				var f := exp(-pow((p.base.x - x_center) / 500.0, 2.0)) * strength
				p.bend_vel += f * 1.2
				if p.type == "tube":
					p.retract = minf(1.0, p.retract + f)


func tick(delta: float) -> void:
	_t += delta * (1.0 + chase_energy * 0.6)
	if _light_t < 1.0:
		_light_t = minf(1.0, _light_t + delta / maxf(_light_dur, 0.01))
		light = lerpf(_light_from, _light_to, smoothstep(0.0, 1.0, _light_t))
	var mat := _bg.material as ShaderMaterial
	mat.set_shader_parameter("light_level", light)
	mat.set_shader_parameter("chase_energy", chase_energy)
	if activity.deep:
		var dg: Dictionary = activity.deep.get_glow_info()
		var b: Rect2 = activity.aquarium_bounds
		mat.set_shader_parameter("deep_glow_uv", (dg.pos - b.position) / b.size)
		mat.set_shader_parameter("deep_glow", dg.amount)
	for list in [plants, fg_plants, mid_items, far_items]:
		for p in list:
			if p.has("bend_vel"):
				p.bend_vel += (-p.bend * 18.0) * delta
				p.bend_vel *= exp(-2.2 * delta)
				p.bend += p.bend_vel * delta
				p.bend = clampf(p.bend, -1.2, 1.2)
				if p.has("retract"):
					p.retract = move_toward(p.retract, 0.0, delta * 0.35)
				if p.has("health") and p.health < 1.0:
					p.health = minf(1.0, p.health + delta * 0.03)
	for pb in pebbles:
		pb.velocity.x *= exp(-2.5 * delta)
		pb.position.x += pb.velocity.x * delta
		pb.rot += pb.velocity.x * delta / pb.body_radius
		var b2: Rect2 = activity.aquarium_bounds
		pb.position.x = clampf(pb.position.x, b2.position.x + 20.0, b2.end.x - 20.0)
		pb.position.y = activity.get_floor_y() - pb.body_radius * 0.8
	_far.queue_redraw()
	_mid.queue_redraw()
	_shaft_layer.queue_redraw()
	_play.queue_redraw()
	_fg.queue_redraw()
	_dark.queue_redraw()


# ================================================================ generation

func _generate() -> void:
	var b: Rect2 = activity.aquarium_bounds
	var floor_y: float = activity.get_floor_y()
	var horizon := floor_y - 85.0
	plants.clear(); fg_plants.clear(); mid_items.clear(); far_items.clear()
	shafts.clear(); rock_shapes.clear(); pebbles.clear(); bitables.clear(); decor.clear()

	# Far: mountainous rock silhouettes on the horizon, giant kelp, and the
	# ribcage of something unreasonably large (foreshadowing).
	var x := b.position.x - 60.0
	while x < b.end.x + 60.0:
		var w := _rng.randf_range(160, 380)
		far_items.append({"type": "ridge", "base": Vector2(x + w * 0.5, horizon + 10.0), "w": w, "height": _rng.randf_range(90, 260), "seed": _rng.randf() * 100.0})
		x += w * 0.6
	for i in 7:
		far_items.append({"type": "kelp", "base": Vector2(_rng.randf_range(b.position.x, b.end.x), horizon + 5.0), "height": _rng.randf_range(260, 520), "phase": _rng.randf() * TAU, "bend": 0.0, "bend_vel": 0.0, "width": 10.0, "color": Color(0.05, 0.13, 0.15)})
	far_items.append({"type": "ribs", "base": Vector2(b.position.x + b.size.x * 0.72, horizon + 15.0), "height": 230.0})

	# Mid: rock spires and plant clumps, a pillar holding up the overhang.
	for i in 6:
		var mx := _rng.randf_range(b.position.x + 80, b.end.x - 80)
		mid_items.append({"type": "spire", "base": Vector2(mx, horizon + 40.0), "w": _rng.randf_range(70, 140), "height": _rng.randf_range(120, 300), "seed": _rng.randf() * 100.0})
	for i in 12:
		mid_items.append({"type": "kelp", "base": Vector2(_rng.randf_range(b.position.x, b.end.x), horizon + _rng.randf_range(30, 70)), "height": _rng.randf_range(160, 380), "phase": _rng.randf() * TAU, "bend": 0.0, "bend_vel": 0.0, "width": 9.0, "color": Color(0.08, 0.22, 0.2)})
	var cover: Rect2 = activity.get_shell_cover_rect()
	if cover.size != Vector2.ZERO:
		mid_items.append({"type": "cave", "rect": cover})

	# Light shafts (one deliberately lands on the open floor where the shell should go).
	var clear_x := cover.end.x + 260.0 if cover.size != Vector2.ZERO else b.get_center().x
	shafts.append({"x": clear_x, "w": 160.0, "phase": 0.0, "a": 0.16})
	for i in 4:
		shafts.append({"x": _rng.randf_range(b.position.x + 100, b.end.x - 100), "w": _rng.randf_range(70, 180), "phase": _rng.randf() * TAU, "a": _rng.randf_range(0.05, 0.1)})

	# Rocks around obstacle nodes.
	for o in activity.obstacles:
		if o.node and o.node.get("draw_placeholder_rock") == false:
			continue
		var pts := PackedVector2Array()
		var n := 18
		var seed := _rng.randf() * 100.0
		for i in n:
			var a := TAU * float(i) / n
			var rr: float = o.r * (1.08 + 0.12 * sin(a * 3.0 + seed) + 0.06 * sin(a * 7.0 + seed * 2.0))
			pts.append(o.pos + Vector2(cos(a) * rr * 1.1, sin(a) * rr))
		var shade := _rng.randf_range(0.0, 0.06)
		rock_shapes.append({"pts": pts, "pos": o.pos, "r": o.r, "color": Color(0.24 + shade, 0.27 + shade, 0.3 + shade), "seed": seed})

	# Play-plane plants.
	var plant_specs := [
		["kelp", 0.03], ["kelp", 0.06], ["bulb", 0.11], ["anemone", 0.33], ["tube", 0.38],
		["puff", 0.42], ["fan", 0.47], ["bulb", 0.55], ["puff", 0.6], ["tube", 0.66],
		["anemone", 0.71], ["fan", 0.78], ["kelp", 0.84], ["puff", 0.88], ["bulb", 0.93], ["kelp", 0.97],
	]
	for spec in plant_specs:
		var px: float = b.position.x + b.size.x * float(spec[1]) + _rng.randf_range(-20, 20)
		# Keep the chute and the shell's starting spot clear.
		if absf(px - activity.layout_point("Chute").x) < 90.0:
			px += 140.0
		if cover.size != Vector2.ZERO and px > cover.position.x and px < cover.end.x:
			continue
		var p := _make_plant(spec[0], Vector2(px, floor_y + _rng.randf_range(2, 8)))
		plants.append(p)
		if p.type == "puff":
			var bt := PlantBite.new()
			bt.plant = p
			bt.env = self
			bitables.append(bt)

	# Foreground plants near the glass (creatures pass behind them).
	var fg_specs := [[0.0, 520.0], [0.035, 380.0], [0.965, 470.0], [1.0, 600.0], [0.5, 120.0]]
	for spec in fg_specs:
		var fx: float = b.position.x + b.size.x * float(spec[0])
		fg_plants.append({"type": "leaf", "base": Vector2(fx, b.end.y + 10.0), "height": float(spec[1]), "phase": _rng.randf() * TAU, "bend": 0.0, "bend_vel": 0.0, "width": 34.0, "color": Color(0.03, 0.09, 0.08)})

	# Pebbles (loose, pushable).
	for i in pebble_count:
		var pb := Pebble.new()
		pb.env = self
		pb.body_radius = _rng.randf_range(10, 15)
		pb.position = Vector2(lerpf(b.position.x + b.size.x * 0.3, b.end.x - 300.0, (i + 0.5) / pebble_count), floor_y - pb.body_radius)
		pb.color = Color(0.45, 0.43, 0.4).darkened(_rng.randf_range(0.0, 0.3))
		pebbles.append(pb)

	# Static floor decoration: shells, stones, little glowing things.
	for i in 40:
		decor.append({"pos": Vector2(_rng.randf_range(b.position.x, b.end.x), floor_y + _rng.randf_range(-4, b.end.y - floor_y - 6)), "r": _rng.randf_range(2, 7), "kind": _rng.randi() % 3, "c": _rng.randf()})


func _make_plant(type: String, base: Vector2) -> Dictionary:
	var p := {"type": type, "base": base, "phase": _rng.randf() * TAU, "bend": 0.0, "bend_vel": 0.0, "health": 1.0, "retract": 0.0}
	match type:
		"kelp":
			p.height = _rng.randf_range(200, 380); p.width = 12.0; p.color = Color(0.2, 0.42, 0.22)
		"bulb":
			p.height = _rng.randf_range(90, 150); p.width = 4.0; p.color = Color(0.25, 0.5, 0.45)
		"anemone":
			p.height = 50.0; p.width = 24.0; p.color = Color(0.85, 0.35, 0.45)
		"tube":
			p.height = _rng.randf_range(50, 80); p.width = 6.0; p.color = Color(0.9, 0.85, 0.75)
		"puff":
			p.height = _rng.randf_range(60, 90); p.width = 22.0; p.color = Color(0.45, 0.62, 0.25)
		"fan":
			p.height = _rng.randf_range(90, 140); p.width = 3.0; p.color = Color(0.75, 0.4, 0.75)
	return p


# ================================================================ drawing

func _sway(p: Dictionary, k: float) -> float:
	return sin(_t * 0.8 + p.phase + k * 1.5) * 0.12 * k + p.bend * k


func _kelp_points(p: Dictionary, segs := 10) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var pos: Vector2 = p.base
	var ang := -PI * 0.5
	var seg_len: float = p.height / segs
	pts.append(pos)
	for i in segs:
		var k := float(i + 1) / segs
		ang = -PI * 0.5 + _sway(p, k) * 1.2 + sin(_t * 1.3 + p.phase + i * 0.6) * 0.05
		pos += Vector2.from_angle(ang) * seg_len
		pts.append(pos)
	return pts


func _ribbon(layer: Node2D, pts: PackedVector2Array, width: float, col: Color, taper := true) -> void:
	var left := PackedVector2Array()
	var right := PackedVector2Array()
	for i in pts.size():
		var d: Vector2 = (pts[min(i + 1, pts.size() - 1)] - pts[max(i - 1, 0)]).normalized()
		var perp := Vector2(-d.y, d.x)
		var w := width * (1.0 - float(i) / pts.size() * (0.8 if taper else 0.0))
		w *= 0.8 + 0.2 * sin(float(i) * 1.7)
		left.append(pts[i] + perp * w * 0.5)
		right.append(pts[i] - perp * w * 0.5)
	AqDraw.strip(layer, left, right, col)


func _draw_far(layer: Node2D) -> void:
	var fogc := Color(0.03, 0.09, 0.12)
	for it in far_items:
		match it.type:
			"ridge":
				var pts := PackedVector2Array()
				var w: float = it.w
				var n := 14
				for i in n + 1:
					var t := float(i) / n
					var hgt: float = it.height * sin(t * PI) * (0.75 + 0.25 * sin(t * 9.0 + it.seed))
					pts.append(it.base + Vector2((t - 0.5) * w * 1.6, -hgt))
				pts.append(it.base + Vector2(w * 0.8, 60))
				pts.append(it.base + Vector2(-w * 0.8, 60))
				AqDraw.poly(layer, pts, fogc)
			"kelp":
				_ribbon(layer, _kelp_points(it, 12), it.width, it.color)
			"ribs":
				var c: Vector2 = it.base
				var col := Color(0.06, 0.13, 0.15)
				layer.draw_line(c + Vector2(-260, -40), c + Vector2(260, -70), col, 10.0)
				for i in 9:
					var x := -220.0 + i * 55.0
					var h: float = it.height * (0.6 + 0.4 * sin(float(i) / 8.0 * PI))
					var pts2 := PackedVector2Array()
					for k in 9:
						var tt := float(k) / 8.0
						pts2.append(c + Vector2(x + sin(tt * PI) * 40.0, -40.0 - (i * 3.0) + tt * h * 0.2 - sin(tt * PI * 0.9) * h))
					layer.draw_polyline(pts2, col, 8.0 - i * 0.4)


func _draw_mid(layer: Node2D) -> void:
	for it in mid_items:
		match it.type:
			"spire":
				var pts := PackedVector2Array()
				var n := 10
				for i in n + 1:
					var t := float(i) / n
					var wv: float = it.w * (1.0 - t * 0.7) * (0.85 + 0.15 * sin(t * 11.0 + it.seed))
					pts.append(it.base + Vector2(-wv * 0.5, -t * it.height))
				for i in range(n, -1, -1):
					var t2 := float(i) / n
					var wv2: float = it.w * (1.0 - t2 * 0.7) * (0.85 + 0.15 * sin(t2 * 7.0 + it.seed * 2.0))
					pts.append(it.base + Vector2(wv2 * 0.5, -t2 * it.height))
				AqDraw.poly(layer, pts, Color(0.06, 0.15, 0.17))
			"kelp":
				_ribbon(layer, _kelp_points(it, 10), it.width, it.color)
			"cave":
				# Dark recess behind the overhang + a supporting pillar at the back.
				var r: Rect2 = it.rect
				var floor_y: float = activity.get_floor_y()
				var cave := PackedVector2Array([
					Vector2(r.position.x - 10, r.position.y - 30), Vector2(r.end.x + 10, r.position.y - 30),
					Vector2(r.end.x - 20, floor_y + 5), Vector2(r.position.x + 20, floor_y + 5)])
				AqDraw.poly(layer, cave, Color(0.02, 0.05, 0.06))
				var pc := r.get_center().x + r.size.x * 0.15
				AqDraw.poly(layer, PackedVector2Array([
					Vector2(pc - 40, r.position.y), Vector2(pc + 50, r.position.y),
					Vector2(pc + 34, floor_y - 30), Vector2(pc - 30, floor_y - 30)]), Color(0.08, 0.12, 0.13))


func _draw_shafts(layer: Node2D) -> void:
	var b: Rect2 = activity.aquarium_bounds
	var floor_y: float = activity.get_floor_y()
	for s in shafts:
		var sway := sin(_t * 0.25 + s.phase) * 40.0
		var a: float = s.a * (0.7 + 0.3 * sin(_t * 0.6 + s.phase * 2.0)) * light
		a *= 1.0 + chase_energy * 0.4 * sin(_t * 6.0 + s.phase)
		var top_x: float = s.x - 140.0 + sway
		var bot_x: float = s.x
		var w: float = s.w
		var pts := PackedVector2Array([
			Vector2(top_x - w * 0.35, b.position.y), Vector2(top_x + w * 0.35, b.position.y),
			Vector2(bot_x + w * 0.8, floor_y), Vector2(bot_x - w * 0.8, floor_y)])
		var c0 := Color(0.5, 0.8, 0.75, a)
		var c1 := Color(0.3, 0.6, 0.6, 0.0)
		layer.draw_polygon(pts, PackedColorArray([c0, c0, c1, c1]))


func _draw_play(layer: Node2D) -> void:
	var floor_y: float = activity.get_floor_y()
	var b: Rect2 = activity.aquarium_bounds
	# Floor decorations.
	for d in decor:
		match d.kind:
			0:
				layer.draw_circle(d.pos, d.r, Color(0.38, 0.35, 0.3))
			1:
				layer.draw_arc(d.pos, d.r, PI, TAU, 6, Color(0.85, 0.75, 0.7), 2.0)
			2:
				var g: float = 0.5 + 0.5 * sin(_t * 2.0 + d.c * 20.0)
				layer.draw_circle(d.pos, d.r * 0.5, Color(0.5, 1.0, 0.8, 0.3 + g * 0.4))
	# Rocks.
	for rs in rock_shapes:
		var pts: PackedVector2Array = rs.pts
		AqDraw.poly(layer, pts, rs.color)
		# Top light, bottom shadow.
		var top := PackedVector2Array()
		for i in pts.size():
			var p: Vector2 = pts[i]
			if p.y < rs.pos.y:
				top.append(rs.pos + (p - rs.pos) * 0.92 + Vector2(0, 2))
		if top.size() >= 3:
			AqDraw.poly(layer, top, rs.color.lightened(0.12))
		layer.draw_polyline(pts + PackedVector2Array([pts[0]]), rs.color.darkened(0.45), 2.0)
		# Moss and pits.
		for k in 3:
			var a: float = rs.seed + k * 2.1
			var mp: Vector2 = rs.pos + Vector2(cos(a), sin(a) * 0.6 - 0.3) * rs.r * 0.55
			layer.draw_circle(mp, rs.r * 0.13, Color(0.25, 0.42, 0.25, 0.8))
			layer.draw_circle(rs.pos + Vector2(cos(a + 1.0), sin(a + 1.0)) * rs.r * 0.4, rs.r * 0.06, rs.color.darkened(0.5))
	# Pebbles.
	for pb in pebbles:
		var pts2 := PackedVector2Array()
		for i in 10:
			var a2: float = TAU * i / 10.0 + pb.rot
			pts2.append(pb.position + Vector2(cos(a2) * pb.body_radius * 1.15, sin(a2) * pb.body_radius * 0.85))
		AqDraw.poly(layer, pts2, pb.color)
		layer.draw_circle(pb.position + Vector2(-3, -4), pb.body_radius * 0.3, pb.color.lightened(0.25))
	# Plants.
	for p in plants:
		_draw_plant(layer, p)
	# A soft line where sand meets the glass.
	layer.draw_rect(Rect2(b.position.x, floor_y + 20.0, b.size.x, b.end.y - floor_y - 20.0), Color(0, 0, 0, 0.12))


func _draw_plant(layer: Node2D, p: Dictionary) -> void:
	var col: Color = p.color
	match p.type:
		"kelp":
			var pts := _kelp_points(p, 10)
			_ribbon(layer, pts, p.width, col)
			for i in range(2, pts.size(), 2):
				var side := 1.0 if i % 4 == 0 else -1.0
				var leaf := PackedVector2Array([pts[i], pts[i] + Vector2(side * 22, -10).rotated(_sway(p, 0.5)), pts[i] + Vector2(side * 8, -20)])
				AqDraw.poly(layer, leaf, col.lightened(0.1))
		"bulb":
			var pts2 := _kelp_points(p, 6)
			layer.draw_polyline(pts2, col, 3.0)
			var tip := pts2[pts2.size() - 1]
			var g := 0.6 + 0.4 * sin(_t * 1.7 + p.phase)
			layer.draw_circle(tip, 16.0, Color(0.4, 1.0, 0.85, 0.12 * g))
			layer.draw_circle(tip, 9.0, Color(0.55, 1.0, 0.85, 0.7 * g))
			layer.draw_circle(pts2[3] + Vector2(6, 0), 5.0, Color(1.0, 0.6, 0.85, 0.6 * g))
		"anemone":
			var base: Vector2 = p.base
			AqDraw.poly(layer, PackedVector2Array([base + Vector2(-16, 0), base + Vector2(16, 0), base + Vector2(12, -26), base + Vector2(-12, -26)]), col.darkened(0.3))
			for k in 11:
				var a := lerpf(-PI * 0.95, -PI * 0.05, float(k) / 10.0)
				var tl = 34.0 * (1.0 - p.get("retract", 0.0) * 0.6)
				var pts3 := PackedVector2Array()
				for s in 5:
					var t := float(s) / 4.0
					pts3.append(base + Vector2(0, -26) + Vector2.from_angle(a + sin(_t * 2.0 + k + t * 2.0) * 0.3 * t + _sway(p, t)) * tl * t)
				layer.draw_polyline(pts3, col, 4.0)
				layer.draw_circle(pts3[4], 3.0, col.lightened(0.3))
		"tube":
			for k in 5:
				var bx: Vector2 = p.base + Vector2(-16 + k * 8, 0)
				var h: float = p.height * (0.6 + 0.4 * sin(k * 2.3 + p.phase))
				var top: Vector2 = bx + Vector2(_sway(p, 1.0) * 20.0, -h)
				layer.draw_line(bx, top, col, 6.0)
				var ext = 1.0 - p.retract
				if ext > 0.1:
					for f in 5:
						var a2 := -PI * 0.5 + (f - 2) * 0.45 + sin(_t * 3.0 + k + f) * 0.15
						layer.draw_line(top, top + Vector2.from_angle(a2) * 14.0 * ext, Color(1.0, 0.4, 0.3, 0.9), 2.0)
		"puff":
			var hscale: float = p.health
			var base2: Vector2 = p.base
			for k in 6:
				var a3 := -PI * 0.5 + (k - 2.5) * 0.35 + _sway(p, 0.8)
				var cp = base2 + Vector2.from_angle(a3) * p.height * 0.55 * hscale
				layer.draw_line(base2, cp, col.darkened(0.3), 3.0)
				layer.draw_circle(cp, p.width * 0.5 * hscale, col)
				layer.draw_circle(cp + Vector2(-3, -3), p.width * 0.18 * hscale, col.lightened(0.3))
		"fan":
			var base3: Vector2 = p.base
			for k in 7:
				var a4 := -PI * 0.5 + (k - 3) * 0.22 + _sway(p, 0.7) * 0.6
				var pts4 := PackedVector2Array([base3])
				var q := base3
				for s in 4:
					q += Vector2.from_angle(a4 + sin(s * 1.3 + k) * 0.2) * p.height / 4.0
					pts4.append(q)
				layer.draw_polyline(pts4, col, 3.0)
				layer.draw_circle(q, 3.5, col.lightened(0.3))


func _draw_fg(layer: Node2D) -> void:
	for p in fg_plants:
		var pts := _kelp_points(p, 9)
		_ribbon(layer, pts, p.width, p.color)
		for i in range(1, pts.size(), 2):
			var side := 1.0 if i % 4 == 1 else -1.0
			var leaf := PackedVector2Array([pts[i], pts[i] + Vector2(side * 70, -30).rotated(_sway(p, float(i) / pts.size())), pts[i] + Vector2(side * 20, -50)])
			AqDraw.poly(layer, leaf, p.color.lightened(0.04))


func _draw_dark(layer: Node2D) -> void:
	var a := clampf((1.0 - light) * 0.95, 0.0, 0.8)
	if a > 0.01:
		layer.draw_rect(activity.aquarium_bounds, Color(0.0, 0.01, 0.03, a))
