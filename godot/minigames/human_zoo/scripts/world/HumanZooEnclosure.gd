class_name HumanZooEnclosure
extends Node2D
## One glass-fronted enclosure and its occupant, drawn procedurally.
##
## Origin = bottom-centre of the glass front, at the enclosure floor.
## The occupant's look, idle behaviours, guidance reactions ("notice",
## "attention") and wrong-attempt effects are all driven from outside by
## HumanZooGame; the enclosure only knows how to *show* things.
##
## Visuals are deliberately placeholder-but-charming. In the real Human Zoo
## scene, replace this node with art that implements the same public methods.

@export var character_id: String = "king"
@export var width: float = 400.0
@export var height: float = 450.0
@export var plaque_text: String = ""
@export var wall_color: Color = Color(0.25, 0.2, 0.18)

## World-space x the occupant looks toward (usually Bill).
var look_target_x: float = 0.0
var talking := false
var presence := 0.0          # empty cage: how visible the "voice" is (0..1)
var awake := false           # empty cage: has started responding

var _t := 0.0
var _rng := RandomNumberGenerator.new()
var _behaviour := ""
var _behaviour_t := 0.0
var _behaviour_len := 0.0
var _idle_timer := 3.0
var _idle_list: PackedStringArray = PackedStringArray()
var _lights_out := 0.0
var _bird := 0.0
var _flicker := 0.0
var _bark_text := ""
var _bark_t := 0.0
var _x_offset := 0.0
var _x_target := 0.0

# Child
var _tower := 4
var _tower_fallen := 0.0
var _showcase: Array = []        # symbols displayed prominently on the blocks shelf
var _showcase_t := 0.0
var _holding_block := ""
var _edith_figure := false
var _door_open := false

# Effects
var _bubbles: Array = []
var _balls: Array = []
var _nightclub := 0.0
var _chair_spin := 0.0
var _arm := 0.0
var _notes: Array = []
var _loud := 0.0
var _glow := 0.0             # finale glow

# Static decoration (generated once)
var _tallies: Array = []
var _dust: Array = []


func _ready() -> void:
	_rng.seed = hash(character_id)
	_tower = 3 + _rng.randi() % 3
	for i in 140:
		_tallies.append(Vector3(_rng.randf_range(-width * 0.47, width * 0.47), _rng.randf_range(-height * 0.95, -70.0), _rng.randi() % 5 + 1))
	for i in 18:
		_dust.append(Vector3(_rng.randf_range(-width * 0.45, width * 0.45), _rng.randf_range(-height * 0.9, -20.0), _rng.randf()))
	_idle_timer = _rng.randf_range(1.5, 5.0)


func set_idle_behaviours(list: PackedStringArray) -> void:
	_idle_list = list


# ------------------------------------------------------------------ public API

func play_behaviour(behaviour_name: String, duration := 2.6) -> void:
	_behaviour = behaviour_name
	_behaviour_t = 0.0
	_behaviour_len = duration
	if behaviour_name == "static_flicker" or behaviour_name == "flicker":
		_flicker = duration
	if behaviour_name == "pace":
		_x_target = _rng.randf_range(-width * 0.25, width * 0.25)


## Level-0 guidance: stop, look toward Bill, show something relevant.
func notice() -> void:
	match character_id:
		"child":
			play_behaviour("hold_up", 3.5)
			_holding_block = "BIRD"
		"empty":
			play_behaviour("static_flicker", 1.5)
		_:
			play_behaviour("notice", 2.0)


func bark(text: String, seconds := 2.8) -> void:
	if text == "":
		return
	_bark_text = text
	_bark_t = seconds


func set_talking(on: bool) -> void:
	talking = on


func lights_out(seconds: float) -> void:
	_lights_out = seconds


func bird_visit(seconds: float) -> void:
	_bird = seconds


func set_glow(amount: float) -> void:
	_glow = amount


func perform_action(action: String, args: Array) -> void:
	match action:
		"child_blocks":
			_showcase = args.duplicate()
			_showcase_t = 0.0
			_edith_figure = false
			_tower_fallen = 1.2
			play_behaviour("build", 1.5)
		"child_blocks_edith":
			_edith_figure = true
			_showcase = []
			play_behaviour("build", 1.5)
		"child_key":
			_holding_block = "KEY"
			play_behaviour("hold_key", 5.0)
		"finale":
			_glow = 1.0
			if character_id == "child":
				_door_open = true
				_holding_block = "KEY"
				play_behaviour("hold_key", 30.0)
			elif character_id == "empty":
				presence = 0.8


func play_effect(effect: String) -> void:
	match effect:
		"bubbles":
			for i in 70:
				_bubbles.append({"p": Vector2(_rng.randf_range(-width * 0.45, width * 0.45), _rng.randf_range(-20, 40)),
					"v": _rng.randf_range(30, 90), "r": _rng.randf_range(5, 18), "ph": _rng.randf() * TAU, "d": _rng.randf_range(0, 2.5)})
		"pingpong":
			for i in 160:
				_balls.append({"p": Vector2(_rng.randf_range(-width * 0.4, width * 0.4), -height - _rng.randf_range(0, 500)),
					"v": Vector2(_rng.randf_range(-60, 60), 0), "life": 14.0})
		"nightclub":
			_nightclub = 5.0
		"chair_spin":
			_chair_spin = 0.001
		"biscuit":
			_arm = 0.001
		"loud_mic":
			_loud = 2.5
		"waltz":
			for i in 10:
				_notes.append({"p": Vector2(_rng.randf_range(-30, 30), -40 - i * 18), "t": -i * 0.25})


# ---------------------------------------------------------------------- update

func _process(delta: float) -> void:
	_t += delta
	if _behaviour != "":
		_behaviour_t += delta
		if _behaviour_t >= _behaviour_len:
			if _behaviour == "hold_up" or _behaviour == "hold_key":
				_holding_block = ""
			_behaviour = ""
	else:
		_idle_timer -= delta
		if _idle_timer <= 0.0 and not _idle_list.is_empty() and not talking:
			_idle_timer = _rng.randf_range(3.5, 7.5)
			play_behaviour(_idle_list[_rng.randi() % _idle_list.size()], _rng.randf_range(2.0, 3.6))
	_x_offset = move_toward(_x_offset, _x_target, delta * 60.0)
	if _behaviour != "pace":
		_x_target = move_toward(_x_target, 0.0, delta * 25.0)
	_lights_out = maxf(_lights_out - delta, 0.0)
	_bird = maxf(_bird - delta, 0.0)
	_flicker = maxf(_flicker - delta, 0.0)
	_bark_t = maxf(_bark_t - delta, 0.0)
	_tower_fallen = maxf(_tower_fallen - delta, 0.0)
	_nightclub = maxf(_nightclub - delta, 0.0)
	_loud = maxf(_loud - delta, 0.0)
	_showcase_t += delta
	if character_id == "child" and _behaviour == "build" and _rng.randf() < delta * 1.5:
		_tower = mini(_tower + 1, 9)
	if character_id == "child" and _behaviour == "knock_over":
		_tower_fallen = 1.5
		_tower = 2
	if _chair_spin > 0.0:
		_chair_spin += delta / 3.0
		if _chair_spin >= 1.0:
			_chair_spin = 0.0
	if _arm > 0.0:
		_arm += delta / 4.0
		if _arm >= 1.0:
			_arm = 0.0
	_update_bubbles(delta)
	_update_balls(delta)
	for n in _notes:
		n["t"] += delta
		n["p"].y -= delta * 30.0
	_notes = _notes.filter(func(n): return n["t"] < 4.0)
	queue_redraw()


func _update_bubbles(delta: float) -> void:
	for b in _bubbles:
		if b["d"] > 0.0:
			b["d"] -= delta
			continue
		b["p"].y -= b["v"] * delta
		b["p"].x += sin(_t * 2.0 + b["ph"]) * 20.0 * delta
	_bubbles = _bubbles.filter(func(b): return b["p"].y > -height + 10)


func _update_balls(delta: float) -> void:
	var floor_y := -14.0
	for b in _balls:
		b["life"] -= delta
		b["v"].y += 900.0 * delta
		b["p"] += b["v"] * delta
		if b["p"].y > floor_y - _ball_stack(b["p"].x):
			b["p"].y = floor_y - _ball_stack(b["p"].x)
			b["v"].y *= -0.45
			b["v"].x *= 0.8
		if absf(b["p"].x) > width * 0.47:
			b["p"].x = signf(b["p"].x) * width * 0.47
			b["v"].x *= -0.7
	_balls = _balls.filter(func(b): return b["life"] > 0.0)


func _ball_stack(x: float) -> float:
	# Fake pile: the floor rises as balls accumulate, more in the middle.
	var settled := 0
	for b in _balls:
		if absf(b["v"].y) < 40.0:
			settled += 1
	return minf(settled * 0.25, 60.0) * (1.0 - absf(x) / (width * 0.6))


# ------------------------------------------------------------------------ draw

func _font() -> Font:
	return ThemeDB.fallback_font


func _draw() -> void:
	var hw := width * 0.5
	var lit := 1.0 - clampf(_lights_out, 0.0, 1.0) * 0.8
	if _flicker > 0.0 and fmod(_t, 0.18) < 0.07:
		lit *= 0.55
	# Back wall
	var wall := wall_color.lerp(Color(0.05, 0.05, 0.06), 0.15)
	draw_rect(Rect2(-hw, -height, width, height), wall.darkened(0.25))
	# Wallpaper stripes
	for i in int(width / 26.0):
		var x := -hw + 13.0 + i * 26.0
		draw_line(Vector2(x, -height), Vector2(x, -60), wall.lightened(0.05), 6.0)
	# Skirting & floor
	draw_rect(Rect2(-hw, -70, width, 12), wall.darkened(0.45))
	var floor_poly := PackedVector2Array([Vector2(-hw, -58), Vector2(hw, -58), Vector2(hw, 0), Vector2(-hw, 0)])
	draw_colored_polygon(floor_poly, wall.darkened(0.55).lerp(Color(0.25, 0.2, 0.16), 0.4))
	for i in 7:
		var x := lerpf(-hw, hw, i / 6.0)
		draw_line(Vector2(x * 0.8, -58), Vector2(x, 0), Color(0, 0, 0, 0.18), 2.0)
	_draw_props()
	_draw_occupant()
	_draw_effects_inside()
	# Lamp & light cone
	var lamp := Vector2(0, -height + 26)
	draw_line(Vector2(0, -height), lamp, Color(0.1, 0.08, 0.06), 3.0)
	var cone_col := Color(1.0, 0.85, 0.55, 0.16 * lit)
	var cone := PackedVector2Array([lamp + Vector2(-14, 4), lamp + Vector2(14, 4), Vector2(hw * 0.95, -6), Vector2(-hw * 0.95, -6)])
	draw_polygon(cone, PackedColorArray([cone_col, cone_col, Color(cone_col, 0.0), Color(cone_col, 0.0)]))
	draw_circle(lamp, 10, Color(1.0, 0.85, 0.5).lerp(Color(0.2, 0.18, 0.15), 1.0 - lit))
	draw_arc(lamp, 12, PI, TAU, 12, Color(0.55, 0.42, 0.22), 4.0)
	# Darkness when the lights fail (King on the third bell)
	var darkness := (1.0 - lit) * 0.85
	if darkness > 0.01:
		draw_rect(Rect2(-hw, -height, width, height), Color(0.01, 0.01, 0.03, darkness))
	if _nightclub > 0.0:
		_draw_nightclub()
	if _glow > 0.0:
		draw_rect(Rect2(-hw, -height, width, height), Color(1.0, 0.9, 0.6, 0.12 * _glow))
	_draw_glass()
	if _bird > 0.0:
		_draw_perched_bird()
	if _bark_t > 0.0:
		_draw_bark()


func _draw_glass() -> void:
	var hw := width * 0.5
	draw_rect(Rect2(-hw, -height, width, height), Color(0.65, 0.85, 0.95, 0.06))
	for i in 3:
		var x0 := -hw + 40 + i * 120.0
		var streak := PackedVector2Array([Vector2(x0, -height), Vector2(x0 + 34, -height), Vector2(x0 - 80, 0), Vector2(x0 - 114, 0)])
		draw_colored_polygon(streak, Color(1, 1, 1, 0.035 + 0.02 * i))
	if character_id == "empty" and (_flicker > 0.0 or presence > 0.0):
		for i in 14:
			var y := -_rng.randf() * height
			draw_line(Vector2(-hw, y), Vector2(hw, y + _rng.randf_range(-3, 3)), Color(0.7, 0.85, 1.0, 0.05 + 0.08 * presence), 1.0)
	var brass := Color(0.62, 0.47, 0.22)
	draw_rect(Rect2(-hw - 10, -height - 14, width + 20, height + 14), brass.darkened(0.35), false, 16.0)
	draw_rect(Rect2(-hw - 10, -height - 14, width + 20, height + 14), brass, false, 6.0)
	for i in 9:
		var x := lerpf(-hw - 4, hw + 4, i / 8.0)
		draw_circle(Vector2(x, -height - 14), 3.0, brass.lightened(0.3))
		draw_circle(Vector2(x, 0), 3.0, brass.lightened(0.3))
	# Bars across the top (the bird perches here)
	for i in 12:
		var x := lerpf(-hw + 12, hw - 12, i / 11.0)
		draw_line(Vector2(x, -height - 6), Vector2(x, -height + 22), brass.darkened(0.2), 3.0)
	# Speaking grille on the inside of the glass
	draw_circle(Vector2(0, -26), 11, brass.darkened(0.3))
	for i in 3:
		draw_line(Vector2(-6, -30 + i * 4), Vector2(6, -30 + i * 4), Color(0.1, 0.08, 0.05), 1.5)
	if _loud > 0.0:
		for i in 3:
			var r := 20.0 + fmod(_t * 160.0 + i * 40.0, 120.0)
			draw_arc(Vector2(0, -26), r, -PI * 0.9, -PI * 0.1, 16, Color(1, 0.9, 0.5, 0.6 * (1.0 - r / 140.0)), 3.0)
	# Plaque
	var plate := Rect2(-92, 10, 184, 30)
	draw_rect(plate, brass.darkened(0.15))
	draw_rect(plate, brass.lightened(0.25), false, 2.0)
	if plaque_text != "":
		draw_string(_font(), Vector2(-90, 31), plaque_text, HORIZONTAL_ALIGNMENT_CENTER, 180, 15, Color(0.15, 0.1, 0.04))


func _draw_bark() -> void:
	var f := _font()
	var size := 20
	var w := minf(f.get_string_size(_bark_text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x + 28, width + 40)
	var a := clampf(_bark_t * 2.0, 0.0, 1.0)
	var r := Rect2(-w * 0.5, -height - 78, w, 40)
	draw_rect(r, Color(0.96, 0.92, 0.82, 0.95 * a))
	draw_rect(r, Color(0.3, 0.22, 0.12, a), false, 2.0)
	draw_colored_polygon(PackedVector2Array([Vector2(-10, r.end.y), Vector2(10, r.end.y), Vector2(0, r.end.y + 14)]), Color(0.96, 0.92, 0.82, 0.95 * a))
	draw_string(f, Vector2(r.position.x, r.position.y + 27), _bark_text, HORIZONTAL_ALIGNMENT_CENTER, w, size, Color(0.15, 0.1, 0.05, a))


func _draw_perched_bird() -> void:
	var a := clampf(_bird, 0.0, 1.0)
	var p := Vector2(width * 0.18, -height - 4 + sin(_t * 9.0) * 1.5)
	var col := Color(0.05, 0.05, 0.06, a)
	draw_circle(p, 9, col)
	draw_circle(p + Vector2(8, -8), 6, col)
	draw_colored_polygon(PackedVector2Array([p + Vector2(13, -9), p + Vector2(20, -7), p + Vector2(13, -6)]), Color(0.9, 0.6, 0.2, a))
	draw_colored_polygon(PackedVector2Array([p + Vector2(-6, -2), p + Vector2(-22, 2 + sin(_t * 30.0) * 2.0), p + Vector2(-4, 5)]), col)
	draw_circle(p + Vector2(10, -10), 1.6, Color(1, 1, 1, a))
	draw_line(p + Vector2(-2, 4), Vector2(-4 + p.x, 8 + p.y), Color(0.9, 0.6, 0.2, a), 1.5)
	draw_line(Vector2(p.x - 5, p.y - 2), Vector2(p.x - 3, p.y + 1), Color(1, 1, 1, a * 0.9), 2.0)


# ------------------------------------------------------------------- props

func _draw_props() -> void:
	var hw := width * 0.5
	match character_id:
		"king":
			# Throne with a painted eye on the backrest.
			var th := Vector2(-hw + 82, -30)
			draw_rect(Rect2(th + Vector2(-48, -220), Vector2(96, 200)), Color(0.45, 0.12, 0.15))
			draw_rect(Rect2(th + Vector2(-48, -220), Vector2(96, 200)), Color(0.75, 0.58, 0.22), false, 5.0)
			draw_rect(Rect2(th + Vector2(-58, -70), Vector2(116, 24)), Color(0.55, 0.42, 0.18))
			HumanZooSymbols.draw_symbol(self, "EYE", th + Vector2(0, -160), 62, Color(0.95, 0.82, 0.45))
			# Banner
			var bn := Vector2(hw - 70, -height + 60)
			draw_colored_polygon(PackedVector2Array([bn + Vector2(-34, 0), bn + Vector2(34, 0), bn + Vector2(34, 150), bn + Vector2(0, 126), bn + Vector2(-34, 150)]), Color(0.5, 0.15, 0.45))
			HumanZooSymbols.draw_emblem(self, "king", bn + Vector2(0, 50), 44, Color(0.95, 0.8, 0.3))
			draw_string(_font(), bn + Vector2(-34, 100), "ME", HORIZONTAL_ALIGNMENT_CENTER, 68, 22, Color(0.95, 0.8, 0.3))
		"child":
			# The little painted door (with a keyhole) at the back.
			var d := Vector2(hw - 92, -70)
			var door := PackedVector2Array()
			for i in 13:
				var a := PI + PI * i / 12.0
				door.append(d + Vector2(cos(a) * 42, -150 + sin(a) * 42))
			door.append(d + Vector2(42, 0))
			door.append(d + Vector2(-42, 0))
			draw_colored_polygon(door, Color(1.0, 0.92, 0.65) if _door_open else Color(0.35, 0.5, 0.65))
			if _door_open:
				for i in 5:
					var a := -PI * 0.9 + i * PI * 0.2
					draw_line(d + Vector2(0, -100), d + Vector2(0, -100) + Vector2(cos(a), sin(a) * 0.4 + 0.6) * 200.0, Color(1.0, 0.9, 0.6, 0.15), 18.0)
			door.append(door[0])
			draw_polyline(door, Color(0.95, 0.9, 0.7), 3.0)
			draw_circle(d + Vector2(0, -80), 7, Color(0.1, 0.1, 0.12))
			draw_colored_polygon(PackedVector2Array([d + Vector2(-4, -78), d + Vector2(4, -78), d + Vector2(6, -60), d + Vector2(-6, -60)]), Color(0.1, 0.1, 0.12))
			# Crayon sun and a crooked bird on the wall.
			draw_circle(Vector2(-hw + 70, -height + 90), 26, Color(0.95, 0.75, 0.2, 0.7))
			HumanZooSymbols.draw_symbol(self, "BIRD", Vector2(-hw + 150, -height + 120), 46, Color(0.15, 0.15, 0.2, 0.7))
			_draw_child_blocks()
		"accountant":
			for tl in _tallies:
				_draw_tally(Vector2(tl.x, tl.y), int(tl.z), Color(0.9, 0.9, 0.85, 0.32))
			# Chart board
			var cb := Rect2(-hw + 30, -height + 70, 150, 110)
			draw_rect(cb, Color(0.12, 0.16, 0.13))
			draw_rect(cb, Color(0.5, 0.38, 0.2), false, 4.0)
			var pts := PackedVector2Array()
			for i in 9:
				pts.append(cb.position + Vector2(10 + i * 16.0, 90 - 70 * abs(sin(i * 1.3))))
			draw_polyline(pts, Color(0.95, 0.95, 0.9), 2.0)
			draw_string(_font(), cb.position + Vector2(8, 22), "47s?", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.95, 0.95, 0.9))
			# The one thing he trusts: the moon lamp, twelve seconds.
			HumanZooSymbols.draw_symbol(self, "MOON", Vector2(hw - 80, -height + 110), 54, Color(0.95, 0.95, 0.88, 0.85))
			draw_string(_font(), Vector2(hw - 130, -height + 170), "+12s ALWAYS", HORIZONTAL_ALIGNMENT_CENTER, 100, 15, Color(0.95, 0.95, 0.88, 0.85))
			draw_arc(Vector2(hw - 80, -height + 120), 50, 0, TAU, 24, Color(0.95, 0.95, 0.88, 0.5), 2.0)
		"liar":
			# Posters of himself
			for i in 2:
				var pp := Rect2(-hw + 30 + i * 105, -height + 60, 86, 120)
				draw_rect(pp, Color(0.85, 0.78, 0.55))
				draw_circle(pp.position + Vector2(43, 50), 24, Color(0.75, 0.55, 0.4))
				draw_rect(Rect2(pp.position + Vector2(19, 22), Vector2(48, 12)), Color(0.08, 0.06, 0.05))
				draw_string(_font(), pp.position + Vector2(0, 108), "SULLY!" if i == 0 else "LEGEND", HORIZONTAL_ALIGNMENT_CENTER, 86, 16, Color(0.6, 0.1, 0.1))
			# Mirror
			draw_arc(Vector2(hw - 70, -height + 140), 46, 0, TAU, 28, Color(0.75, 0.6, 0.25), 7.0)
			draw_circle(Vector2(hw - 70, -height + 140), 42, Color(0.6, 0.72, 0.78, 0.5))
			# A child-like tree drawing: "I SAW IT"
			var tp := Rect2(Vector2(hw - 118, -height + 212), Vector2(90, 84))
			draw_rect(tp, Color(0.95, 0.94, 0.9))
			HumanZooSymbols.draw_symbol(self, "TREE", tp.position + Vector2(45, 38), 52, Color(0.25, 0.55, 0.3))
			draw_string(_font(), tp.position + Vector2(0, 80), "I SAW IT", HORIZONTAL_ALIGNMENT_CENTER, 90, 13, Color(0.2, 0.2, 0.25))
			# Trophy
			var tr := Vector2(hw - 60, -64)
			draw_rect(Rect2(tr + Vector2(-22, -10), Vector2(44, 10)), Color(0.3, 0.2, 0.1))
			draw_colored_polygon(PackedVector2Array([tr + Vector2(-18, -54), tr + Vector2(18, -54), tr + Vector2(6, -18), tr + Vector2(-6, -18)]), Color(0.9, 0.72, 0.25))
			draw_rect(Rect2(tr + Vector2(-4, -18), Vector2(8, 8)), Color(0.9, 0.72, 0.25))
		"old_woman":
			# Rug, photo of Harold, sampler, side table with teapot, an empty stool.
			draw_colored_polygon(PackedVector2Array([Vector2(-hw + 40, -40), Vector2(hw - 40, -40), Vector2(hw - 10, -4), Vector2(-hw + 10, -4)]), Color(0.45, 0.18, 0.15, 0.8))
			var ph := Rect2(-hw + 40, -height + 90, 70, 86)
			draw_rect(ph, Color(0.4, 0.3, 0.15))
			draw_rect(ph.grow(-6), Color(0.75, 0.7, 0.6))
			draw_circle(ph.get_center() + Vector2(0, -6), 14, Color(0.45, 0.4, 0.35))
			draw_rect(Rect2(ph.get_center() + Vector2(-16, -26), Vector2(32, 7)), Color(0.2, 0.18, 0.15))
			var sm := Rect2(hw - 150, -height + 80, 110, 72)
			draw_rect(sm, Color(0.92, 0.88, 0.78))
			draw_rect(sm, Color(0.5, 0.35, 0.2), false, 4.0)
			draw_string(_font(), sm.position + Vector2(0, 32), "HOME", HORIZONTAL_ALIGNMENT_CENTER, 110, 16, Color(0.55, 0.2, 0.2))
			draw_string(_font(), sm.position + Vector2(0, 56), "(ALLEGEDLY)", HORIZONTAL_ALIGNMENT_CENTER, 110, 12, Color(0.3, 0.3, 0.4))
			var tb := Vector2(hw - 70, -40)
			draw_rect(Rect2(tb + Vector2(-34, -70), Vector2(68, 8)), Color(0.35, 0.22, 0.12))
			draw_line(tb + Vector2(-26, -62), tb + Vector2(-26, 0), Color(0.3, 0.2, 0.1), 5.0)
			draw_line(tb + Vector2(26, -62), tb + Vector2(26, 0), Color(0.3, 0.2, 0.1), 5.0)
			draw_circle(tb + Vector2(0, -88), 17, Color(0.85, 0.85, 0.9))
			draw_line(tb + Vector2(15, -92), tb + Vector2(28, -100), Color(0.85, 0.85, 0.9), 4.0)
			# The empty stool: nobody stays.
			var st := Vector2(-hw + 95, -28)
			draw_rect(Rect2(st + Vector2(-26, -50), Vector2(52, 10)), Color(0.4, 0.26, 0.14))
			draw_line(st + Vector2(-20, -40), st + Vector2(-24, 0), Color(0.35, 0.22, 0.12), 4.0)
			draw_line(st + Vector2(20, -40), st + Vector2(24, 0), Color(0.35, 0.22, 0.12), 4.0)
		"empty":
			# A chair facing the wall and an untouched seventh tray.
			var ch := Vector2(hw - 110, -40)
			draw_rect(Rect2(ch + Vector2(-26, -110), Vector2(52, 70)), Color(0.22, 0.2, 0.2))
			draw_rect(Rect2(ch + Vector2(-30, -44), Vector2(60, 8)), Color(0.2, 0.18, 0.18))
			draw_line(ch + Vector2(-24, -36), ch + Vector2(-26, 0), Color(0.18, 0.16, 0.16), 4.0)
			draw_line(ch + Vector2(24, -36), ch + Vector2(26, 0), Color(0.18, 0.16, 0.16), 4.0)
			var tray := Vector2(-40, -18)
			draw_rect(Rect2(tray + Vector2(-46, -8), Vector2(92, 10)), Color(0.55, 0.55, 0.58))
			draw_circle(tray + Vector2(-14, -12), 10, Color(0.8, 0.75, 0.6))
			draw_rect(Rect2(tray + Vector2(10, -20), Vector2(16, 14)), Color(0.7, 0.7, 0.75))
			for d in _dust:
				var p := Vector2(d.x + sin(_t * 0.3 + d.z * 9.0) * 12.0, d.y + sin(_t * 0.2 + d.z * 5.0) * 18.0)
				draw_circle(p, 1.5, Color(1, 0.95, 0.8, 0.25 + 0.2 * sin(_t + d.z * 7.0)))


func _draw_tally(p: Vector2, n: int, col: Color) -> void:
	for i in mini(n, 4):
		draw_line(p + Vector2(i * 5, 0), p + Vector2(i * 5 + 1, 14), col, 1.5)
	if n >= 5:
		draw_line(p + Vector2(-2, 11), p + Vector2(18, 2), col, 1.5)


func _draw_child_blocks() -> void:
	var colors := [Color(0.85, 0.3, 0.25), Color(0.25, 0.5, 0.8), Color(0.95, 0.75, 0.2), Color(0.35, 0.65, 0.35)]
	# Tower
	var base := Vector2(-width * 0.5 + 70, -20)
	if _tower_fallen > 0.0:
		for i in _tower:
			draw_rect(Rect2(base + Vector2(i * 26 - 20, -22 - (i % 2) * 6), Vector2(22, 22)), colors[i % 4])
	else:
		for i in _tower:
			var wob := sin(_t * 1.3 + i) * i * 0.6
			draw_rect(Rect2(base + Vector2(-13 + wob, -26 - i * 26), Vector2(26, 26)), colors[i % 4])
			draw_rect(Rect2(base + Vector2(-13 + wob, -26 - i * 26), Vector2(26, 26)), Color(0, 0, 0, 0.25), false, 2.0)
	# Showcase row: big symbol blocks, deliberately prominent.
	var row := Vector2(30, -16)
	if _edith_figure:
		var c := Color(0.75, 0.6, 0.85)
		draw_rect(Rect2(row + Vector2(-20, -60), Vector2(40, 44)), c)
		draw_rect(Rect2(row + Vector2(-14, -84), Vector2(28, 26)), Color(0.9, 0.78, 0.65))
		draw_rect(Rect2(row + Vector2(-16, -96), Vector2(32, 14)), Color(0.75, 0.75, 0.78))
		draw_rect(Rect2(row + Vector2(22, -46), Vector2(16, 14)), Color(0.9, 0.9, 0.95))
		draw_rect(Rect2(row + Vector2(-26, -16), Vector2(52, 16)), Color(0.5, 0.3, 0.2))
	elif not _showcase.is_empty():
		var n := _showcase.size()
		for i in n:
			var appear := clampf((_showcase_t - i * 0.5) * 3.0, 0.0, 1.0)
			if appear <= 0.0:
				continue
			var p := row + Vector2((i - (n - 1) * 0.5) * 50.0, -44.0 * appear)
			var r := Rect2(p + Vector2(-22, -22), Vector2(44, 44))
			draw_rect(r, Color(0.96, 0.92, 0.82))
			draw_rect(r, colors[i % 4], false, 4.0)
			HumanZooSymbols.draw_symbol(self, String(_showcase[i]), p, 34, Color(0.15, 0.12, 0.1))


# ----------------------------------------------------------------- occupant

func _look() -> float:
	return clampf((look_target_x - global_position.x) / 500.0, -1.0, 1.0)


func _draw_occupant() -> void:
	var look := _look()
	var b := _behaviour
	var bt := _behaviour_t
	var talk_open := talking and fmod(_t, 0.22) < 0.12
	match character_id:
		"king":
			var o := Vector2(30 + _x_offset, -30)
			var pose := {"lh": Vector2(-34, -40), "rh": Vector2(34, -40), "look": look, "mouth": talk_open}
			match b:
				"adjust_crown":
					pose["rh"] = Vector2(14, -142)
				"pose":
					pose["rh"] = Vector2(40, -150)
				"address":
					pose["lh"] = Vector2(-60, -100 + sin(bt * 6) * 8)
					pose["rh"] = Vector2(60, -100 - sin(bt * 6) * 8)
					pose["mouth"] = fmod(_t, 0.3) < 0.15
				"bang_mic":
					o.x = lerpf(o.x, 0.0, 0.8)
					pose["rh"] = Vector2(10, -60 + absf(sin(bt * 12.0)) * -40)
					pose["mouth"] = true
				"notice":
					pose["look"] = look * 1.5
			_draw_person(o, 1.1, {"coat": Color(0.42, 0.16, 0.5), "robe": true, "skin": Color(0.88, 0.7, 0.58),
				"hair": Color(0.75, 0.75, 0.72), "beard": true, "crown": true, "ladle": true}, pose)
		"child":
			var o := Vector2(-40, -26)
			var pose := {"lh": Vector2(-28, -30), "rh": Vector2(26, -26), "look": look, "mouth": talk_open, "seated": true}
			match b:
				"build", "stack":
					pose["lh"] = Vector2(-60, -40 - absf(sin(bt * 4)) * 30)
				"look_up", "notice":
					pose["look"] = look * 1.5
					pose["head_up"] = true
				"hold_up":
					pose["seated"] = false
					pose["rh"] = Vector2(22, -125)
					pose["look"] = look * 1.5
				"hold_key":
					pose["rh"] = Vector2(60, -70)
					pose["look"] = 1.0
			_draw_person(o, 0.62, {"coat": Color(0.95, 0.75, 0.15), "skin": Color(0.9, 0.72, 0.6), "hair": Color(0.35, 0.22, 0.12)}, pose)
			if _holding_block != "":
				var hp: Vector2 = o + pose["rh"] * 0.62 + Vector2(0, -18)
				draw_rect(Rect2(hp + Vector2(-18, -18), Vector2(36, 36)), Color(0.96, 0.92, 0.82))
				draw_rect(Rect2(hp + Vector2(-18, -18), Vector2(36, 36)), Color(0.85, 0.3, 0.25), false, 3.0)
				HumanZooSymbols.draw_symbol(self, _holding_block, hp, 28, Color(0.15, 0.12, 0.1))
		"accountant":
			var o := Vector2(-20 + _x_offset, -30)
			var pose := {"lh": Vector2(-28, -44), "rh": Vector2(28, -44), "look": look, "mouth": talk_open}
			match b:
				"write_wall":
					pose["rh"] = Vector2(50 + sin(bt * 9) * 12, -130 + cos(bt * 7) * 10)
					pose["look"] = 1.0
				"count_nod":
					pose["head_dy"] = absf(sin(bt * 8)) * 4
					pose["mouth"] = fmod(_t, 0.4) < 0.2
				"check_watch":
					pose["lh"] = Vector2(-10, -84)
					pose["look"] = -0.5
				"tap_chart":
					o.x = -60
					pose["lh"] = Vector2(-70, -130 + absf(sin(bt * 10)) * 8)
					pose["look"] = look
				"notice":
					pose["look"] = look * 1.5
			_draw_person(o, 1.04, {"coat": Color(0.45, 0.47, 0.42), "shirt": Color(0.92, 0.9, 0.84), "skin": Color(0.86, 0.72, 0.62),
				"hair": Color(0.3, 0.26, 0.22), "visor": true, "glasses": true, "thin": true}, pose)
		"liar":
			var o := Vector2(10 + _x_offset, -30)
			var pose := {"lh": Vector2(-30, -44), "rh": Vector2(30, -44), "look": look, "mouth": talk_open, "grin": true}
			match b:
				"mirror":
					o.x = 70
					pose["look"] = 1.0
					pose["rh"] = Vector2(18, -132)
				"finger_guns":
					pose["lh"] = Vector2(-44, -84 + sin(bt * 10) * 4)
					pose["rh"] = Vector2(44, -84 - sin(bt * 10) * 4)
				"lean":
					pose["lean"] = 10.0
					pose["rh"] = Vector2(36, -60)
				"flex":
					pose["lh"] = Vector2(-50, -130)
					pose["rh"] = Vector2(50, -130)
				"notice":
					pose["look"] = look * 1.5
			if _loud > 0.0:
				pose["mouth"] = true
			_draw_person(o, 1.08, {"coat": Color(0.68, 0.16, 0.12), "checks": true, "skin": Color(0.85, 0.66, 0.52),
				"hair": Color(0.08, 0.06, 0.05), "slick": true, "mustache": true}, pose)
			if _arm > 0.0:
				_draw_biscuit_arm(o + Vector2(36, -96))
		"old_woman":
			var spin := _chair_spin
			var sx := cos(spin * TAU) if spin > 0.0 else 1.0
			draw_set_transform(Vector2(-10, 0), 0.0, Vector2(sx if absf(sx) > 0.05 else 0.05, 1.0))
			# Armchair
			var ch := Vector2(0, -26)
			var fabric := Color(0.55, 0.3, 0.25) if sx > 0 else Color(0.4, 0.22, 0.18)
			draw_rect(Rect2(ch + Vector2(-70, -170), Vector2(140, 120)), fabric)
			draw_rect(Rect2(ch + Vector2(-84, -90), Vector2(28, 70)), fabric.darkened(0.15))
			draw_rect(Rect2(ch + Vector2(56, -90), Vector2(28, 70)), fabric.darkened(0.15))
			draw_rect(Rect2(ch + Vector2(-60, -56), Vector2(120, 34)), fabric.lightened(0.08))
			for i in 4:
				draw_circle(ch + Vector2(-50 + i * 33, -140), 6, Color(0.85, 0.7, 0.4, 0.6))
			if sx > 0.0:
				var pose := {"lh": Vector2(-50, -60), "rh": Vector2(40, -66), "look": look, "mouth": talk_open, "seated": true, "cup": true}
				match b:
					"sip_tea":
						pose["rh"] = Vector2(12, -104)
					"knit":
						pose["lh"] = Vector2(-14, -64 + sin(bt * 14) * 3)
						pose["rh"] = Vector2(14, -64 - sin(bt * 14) * 3)
						pose["cup"] = false
						pose["knit"] = true
					"glare":
						pose["look"] = look * 1.6
						pose["squint"] = true
					"doze":
						pose["eyes_closed"] = true
						pose["head_dy"] = 4
					"wave":
						pose["lh"] = Vector2(-50 + sin(bt * 12) * 14, -150)
					"notice":
						pose["look"] = look * 1.5
				_draw_person(ch + Vector2(0, -20), 0.92, {"coat": Color(0.62, 0.55, 0.72), "skin": Color(0.9, 0.78, 0.7),
					"hair": Color(0.85, 0.85, 0.86), "bun": true, "glasses": true}, pose)
				if b == "doze":
					draw_string(_font(), ch + Vector2(30, -190 - fmod(bt * 20.0, 30.0)), "z", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(1, 1, 1, 0.6))
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		"empty":
			if presence > 0.01:
				var a := presence * (0.10 + 0.06 * sin(_t * 3.0))
				var o := Vector2(0, -30)
				var col := Color(0.75, 0.88, 1.0, a)
				draw_circle(o + Vector2(0, -122), 17, col)
				draw_colored_polygon(PackedVector2Array([o + Vector2(-22, -100), o + Vector2(22, -100), o + Vector2(26, 0), o + Vector2(-26, 0)]), col)
			for n in _notes:
				if n["t"] > 0.0:
					draw_string(_font(), n["p"], "~" if int(n["t"] * 3) % 2 == 0 else "*", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(1, 0.9, 0.6, clampf(1.0 - n["t"] / 4.0, 0, 1)))


func _draw_biscuit_arm(target: Vector2) -> void:
	var t := _arm
	var reach := sin(t * PI)
	var top := Vector2(target.x, -height)
	var tip := top.lerp(target, reach)
	var mid := Vector2((top.x + tip.x) * 0.5 + 40 * reach, (top.y + tip.y) * 0.5)
	draw_line(top, mid, Color(0.6, 0.48, 0.25), 8.0)
	draw_line(mid, tip, Color(0.6, 0.48, 0.25), 6.0)
	draw_circle(mid, 7, Color(0.75, 0.6, 0.3))
	draw_circle(tip + Vector2(0, 6), 11, Color(0.85, 0.65, 0.35))
	draw_circle(tip + Vector2(-3, 4), 1.5, Color(0.5, 0.3, 0.15))
	draw_circle(tip + Vector2(4, 8), 1.5, Color(0.5, 0.3, 0.15))


func _draw_person(o: Vector2, k: float, look_cfg: Dictionary, pose: Dictionary) -> void:
	var skin: Color = look_cfg.get("skin", Color(0.85, 0.7, 0.6))
	var coat: Color = look_cfg.get("coat", Color(0.4, 0.4, 0.45))
	var hair: Color = look_cfg.get("hair", Color(0.3, 0.2, 0.1))
	var seated: bool = pose.get("seated", false)
	var breathe := sin(_t * 2.0 + float(hash(character_id) % 7)) * 1.5
	var lean: float = pose.get("lean", 0.0)
	var hip_y := -50.0 if not seated else -28.0
	var sh_y := hip_y - 50.0 + breathe * 0.4
	var sw := 15.0 if look_cfg.get("thin", false) else 19.0
	var hip := o + Vector2(lean * 0.3, hip_y) * k
	# Legs
	var trousers := coat.darkened(0.4)
	if look_cfg.get("robe", false):
		draw_colored_polygon(PackedVector2Array([o + Vector2(-sw - 2, sh_y + 8) * k, o + Vector2(sw + 2, sh_y + 8) * k,
			o + Vector2(32, 0) * k, o + Vector2(-32, 0) * k]), coat)
		draw_rect(Rect2(o + Vector2(-32, -10) * k, Vector2(64, 10) * k), Color(0.95, 0.95, 0.92))
	elif seated:
		draw_line(hip + Vector2(-8, 0) * k, o + Vector2(-16, 0) * k, trousers, 9.0 * k)
		draw_line(hip + Vector2(8, 0) * k, o + Vector2(16, 0) * k, trousers, 9.0 * k)
	else:
		draw_line(hip + Vector2(-8, 0) * k, o + Vector2(-10, 0) * k, trousers, 9.0 * k)
		draw_line(hip + Vector2(8, 0) * k, o + Vector2(10, 0) * k, trousers, 9.0 * k)
		draw_rect(Rect2(o + Vector2(-17, -4) * k, Vector2(12, 5) * k), Color(0.1, 0.08, 0.06))
		draw_rect(Rect2(o + Vector2(5, -4) * k, Vector2(12, 5) * k), Color(0.1, 0.08, 0.06))
	# Torso
	var torso := PackedVector2Array([o + Vector2(-sw + lean, sh_y) * k, o + Vector2(sw + lean, sh_y) * k,
		o + Vector2(sw - 3 + lean * 0.3, hip_y + 4) * k, o + Vector2(-sw + 3 + lean * 0.3, hip_y + 4) * k])
	draw_colored_polygon(torso, coat)
	if look_cfg.has("shirt"):
		draw_colored_polygon(PackedVector2Array([o + Vector2(-6 + lean, sh_y) * k, o + Vector2(6 + lean, sh_y) * k, o + Vector2(lean * 0.6, sh_y + 30) * k]), look_cfg["shirt"])
	if look_cfg.get("checks", false):
		for i in 4:
			var y := sh_y + 8 + i * 11
			draw_line(o + Vector2(-sw + 2 + lean, y) * k, o + Vector2(sw - 2 + lean, y) * k, coat.darkened(0.35), 1.5)
		for i in 3:
			var x := -sw + 8 + i * 12
			draw_line(o + Vector2(x + lean, sh_y) * k, o + Vector2(x + lean * 0.3, hip_y) * k, coat.darkened(0.35), 1.5)
	if look_cfg.get("robe", false):
		# Ermine collar
		draw_rect(Rect2(o + Vector2(-sw - 4 + lean, sh_y - 4) * k, Vector2(sw * 2 + 8, 14) * k), Color(0.96, 0.95, 0.92))
		for i in 5:
			draw_circle(o + Vector2(-sw + 4 + i * 8 + lean, sh_y + 3) * k, 1.6 * k, Color(0.05, 0.05, 0.05))
	# Arms
	var shoulder_l := o + Vector2(-sw + 2 + lean, sh_y + 4) * k
	var shoulder_r := o + Vector2(sw - 2 + lean, sh_y + 4) * k
	var lh: Vector2 = o + pose.get("lh", Vector2(-28, hip_y + 10)) * k
	var rh: Vector2 = o + pose.get("rh", Vector2(28, hip_y + 10)) * k
	for pair in [[shoulder_l, lh, -1.0], [shoulder_r, rh, 1.0]]:
		var s: Vector2 = pair[0]
		var h: Vector2 = pair[1]
		var elbow := (s + h) * 0.5 + Vector2(pair[2] * 10.0 * k, 4.0 * k)
		draw_line(s, elbow, coat.darkened(0.1), 7.5 * k)
		draw_line(elbow, h, coat.darkened(0.1), 7.0 * k)
		draw_circle(h, 4.5 * k, skin)
	if look_cfg.get("ladle", false):
		draw_line(rh, rh + Vector2(6, -60) * k, Color(0.7, 0.7, 0.72), 3.0 * k)
		draw_circle(rh + Vector2(7, -66) * k, 8 * k, Color(0.7, 0.7, 0.72))
	if pose.get("cup", false):
		draw_rect(Rect2(rh + Vector2(-6, -12) * k, Vector2(12, 10) * k), Color(0.92, 0.92, 0.96))
	if pose.get("knit", false):
		draw_line(lh, rh + Vector2(10, -16) * k, Color(0.8, 0.75, 0.6), 2.0)
		draw_line(rh, lh + Vector2(-10, -16) * k, Color(0.8, 0.75, 0.6), 2.0)
		draw_circle((lh + rh) * 0.5 + Vector2(0, 8) * k, 8 * k, Color(0.4, 0.55, 0.75))
	# Head
	var look: float = clampf(pose.get("look", 0.0), -1.5, 1.5)
	var head_dy: float = pose.get("head_dy", 0.0)
	if pose.get("head_up", false):
		head_dy -= 3.0
	var head := o + Vector2(lean + look * 3.0, sh_y - 19 + head_dy) * k
	draw_line(o + Vector2(lean, sh_y) * k, head + Vector2(0, 8) * k, skin.darkened(0.1), 7.0 * k)
	if look_cfg.get("bun", false):
		draw_circle(head + Vector2(0, -15) * k, 9 * k, hair)
	draw_circle(head, 15.5 * k, skin)
	# Hair
	if look_cfg.get("slick", false):
		draw_colored_polygon(PackedVector2Array([head + Vector2(-16, -2) * k, head + Vector2(-12, -16) * k, head + Vector2(8, -18) * k, head + Vector2(17, -6) * k, head + Vector2(2, -10) * k]), hair)
	else:
		draw_arc(head + Vector2(0, -2) * k, 14.5 * k, PI * 1.05, PI * 1.95, 12, hair, 7.0 * k)
	# Eyes
	var ex := look * 3.5
	var eye_y := -2.0
	if pose.get("eyes_closed", false):
		draw_line(head + Vector2(-8 + ex, eye_y) * k, head + Vector2(-3 + ex, eye_y) * k, Color(0.1, 0.08, 0.06), 1.5)
		draw_line(head + Vector2(3 + ex, eye_y) * k, head + Vector2(8 + ex, eye_y) * k, Color(0.1, 0.08, 0.06), 1.5)
	else:
		var er := 1.6 if pose.get("squint", false) else 2.2
		draw_circle(head + Vector2(-5.5 + ex, eye_y) * k, er * k, Color(0.08, 0.06, 0.05))
		draw_circle(head + Vector2(5.5 + ex, eye_y) * k, er * k, Color(0.08, 0.06, 0.05))
	if look_cfg.get("glasses", false):
		draw_arc(head + Vector2(-5.5 + ex, eye_y) * k, 4.5 * k, 0, TAU, 12, Color(0.2, 0.2, 0.22), 1.3)
		draw_arc(head + Vector2(5.5 + ex, eye_y) * k, 4.5 * k, 0, TAU, 12, Color(0.2, 0.2, 0.22), 1.3)
	# Mouth
	var mouth := head + Vector2(ex * 0.6, 7) * k
	if pose.get("mouth", false):
		draw_circle(mouth, 3.2 * k, Color(0.35, 0.1, 0.1))
	elif pose.get("grin", false):
		draw_arc(mouth + Vector2(0, -3) * k, 6 * k, 0.3, PI - 0.3, 8, Color(0.3, 0.1, 0.1), 1.8)
	else:
		draw_line(mouth + Vector2(-3.5, 0) * k, mouth + Vector2(3.5, 0) * k, Color(0.35, 0.15, 0.12), 1.6)
	if look_cfg.get("mustache", false):
		draw_line(mouth + Vector2(-7, -3) * k, mouth + Vector2(7, -3) * k, hair, 2.6 * k)
	if look_cfg.get("beard", false):
		draw_colored_polygon(PackedVector2Array([head + Vector2(-13, 4) * k, head + Vector2(13, 4) * k, head + Vector2(7, 24) * k, head + Vector2(0, 28) * k, head + Vector2(-7, 24) * k]), hair)
		if pose.get("mouth", false):
			draw_circle(mouth, 3.0 * k, Color(0.35, 0.1, 0.1))
	if look_cfg.get("visor", false):
		draw_colored_polygon(PackedVector2Array([head + Vector2(-17, -10) * k, head + Vector2(17, -10) * k, head + Vector2(22, -4) * k, head + Vector2(-22, -4) * k]), Color(0.2, 0.55, 0.3, 0.9))
	if look_cfg.get("crown", false):
		var tilt := -0.12 if _behaviour != "adjust_crown" else sin(_behaviour_t * 5.0) * 0.2
		var cb := head + Vector2(0, -13) * k
		var pts := PackedVector2Array()
		var spikes := [Vector2(-16, 0), Vector2(-16, -16), Vector2(-9, -7), Vector2(-3, -20), Vector2(3, -8), Vector2(10, -19), Vector2(16, -6), Vector2(16, 0)]
		for p in spikes:
			pts.append(cb + p.rotated(tilt) * k)
		draw_colored_polygon(pts, Color(0.95, 0.78, 0.25))
		draw_circle(cb + Vector2(-3, -8).rotated(tilt) * k, 2.2 * k, Color(0.8, 0.15, 0.2))


func _draw_effects_inside() -> void:
	for b in _bubbles:
		if b["d"] > 0.0:
			continue
		draw_arc(b["p"], b["r"], 0, TAU, 16, Color(0.85, 0.95, 1.0, 0.55), 1.5)
		draw_circle(b["p"] + Vector2(-b["r"] * 0.35, -b["r"] * 0.35), b["r"] * 0.2, Color(1, 1, 1, 0.5))
	for b in _balls:
		draw_circle(b["p"], 5.5, Color(0.98, 0.97, 0.94, clampf(b["life"], 0.0, 1.0)))


func _draw_nightclub() -> void:
	var hw := width * 0.5
	var cols := [Color(1, 0.2, 0.4), Color(0.2, 1, 0.5), Color(0.3, 0.5, 1), Color(1, 0.9, 0.2), Color(0.8, 0.3, 1), Color(0.2, 0.9, 1), Color(1, 0.5, 0.1)]
	var top := Vector2(0, -height + 20)
	for i in 7:
		var a := _t * 2.5 + i * TAU / 7.0
		var end := top + Vector2(cos(a) * width, absf(sin(a)) * height + 100)
		var c: Color = cols[i]
		c.a = 0.18
		draw_colored_polygon(PackedVector2Array([top, end + Vector2(-40, 0), end + Vector2(40, 0)]), c)
	if fmod(_t, 0.25) < 0.08:
		var c2: Color = cols[int(_t * 4) % 7]
		c2.a = 0.15
		draw_rect(Rect2(-hw, -height, width, height), c2)
