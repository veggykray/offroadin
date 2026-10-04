class_name HumanZooCentralMachine
extends Node2D
## The mysterious brass machine at the centre of the gallery.
##
## It is the main progress indicator: it never shows numbers, it changes.
##   0  dead, dark, silent
##   1  first pipe lights, CLUNK, a ring turns, first symbol lamp wakes
##   2  steam, the outer ring starts slowly rotating, more lamps
##   3  pressure gauges wake, steam pulses
##   4  inner core glows, quiet hum
##   5  everything alive, the lever unlocks
## Five mechanical lock bolts around the core retract one per stage.
##
## Origin = gallery floor at the machine's centre.

signal beat(kind: String)   # "clunk", "hiss", "hum", "ratchet" ... for audio

@export var symbols: Array = ["MOON", "EYE", "BIRD", "KEY", "TREE", "HAND"]
## Selector order (character ids), left to right on the plinth.
@export var selector_ids: Array = []
@export var core_y: float = -430.0

var level := 0
var active_symbols: Dictionary = {}
var selector_symbols: Array = []
var selector_glow: Dictionary = {}   # character id -> 0..1 (mirrors pipe glow)
var selected := -1                    # -1 none, 0..5 dials, 6 lever
var machine_mode := false
var lever_unlocked := false

var _t := 0.0
var _jolt := 0.0
var _ring_outer := 0.0
var _ring_mid := 0.0
var _ring_inner := 0.0
var _speed := 0.0
var _speed_target := 0.0
var _core := 0.0
var _gauge := 0.0
var _tube := 0.0
var _locks: Array[float] = [1.0, 1.0, 1.0, 1.0, 1.0]
var _steam: Array = []
var _steam_timer := 0.0
var _dial_turn: Array = []
var _dial_shake: Array = []
var _lever := 0.0                    # 0 up, 1 pulled
var _lever_target := 0.0
var _lever_jiggle := 0.0
var _attempting := 0.0
var _symbol_flash: Dictionary = {}
var _finale := -1.0                  # <0 not started, then seconds since start
var _tree_seed := 1234
var _light_birds: Array = []
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	for i in selector_ids.size():
		selector_symbols.append(symbols[0])
		_dial_turn.append(0.0)
		_dial_shake.append(0.0)


# ------------------------------------------------------------------ public API

func selector_position(i: int) -> Vector2:
	var n := maxi(selector_ids.size(), 1)
	return Vector2((i - (n - 1) * 0.5) * 104.0, -96.0)


func lever_position() -> Vector2:
	return Vector2(352, -170)


## Where an operator should stand: beside the lever, clear of the dials.
func operator_offset() -> Vector2:
	return Vector2(470, 0)


func set_level(new_level: int, animate := true) -> void:
	var old := level
	level = new_level
	for i in _locks.size():
		if i < level:
			_locks[i] = _locks[i] if animate else 0.0
	_speed_target = [0.0, 0.0, 0.12, 0.18, 0.25, 0.35][clampi(level, 0, 5)]
	if not animate:
		_core = 1.0 if level >= 4 else 0.0
		_gauge = 1.0 if level >= 3 else 0.0
		_tube = level / 5.0
		for i in _locks.size():
			_locks[i] = 0.0 if i < level else 1.0
		return
	if level > old:
		_jolt = 1.0
		beat.emit("clunk")
		match level:
			1:
				_ring_inner += 0.5
			2:
				puff(Vector2(-250, -200), 14)
				puff(Vector2(250, -200), 14)
				beat.emit("hiss")
			3:
				puff(Vector2(-330, -600), 10)
				puff(Vector2(330, -600), 10)
				beat.emit("hiss")
			4:
				beat.emit("hum")
			5:
				puff(Vector2(0, -700), 20)
				beat.emit("hiss")


func activate_symbols(list: Array, animate := true) -> void:
	for s in list:
		if not active_symbols.has(s):
			active_symbols[s] = true
			if animate:
				_symbol_flash[s] = 1.0


func set_selector(i: int, symbol: String, animate := true) -> void:
	if i < 0 or i >= selector_symbols.size():
		return
	if selector_symbols[i] != symbol and animate:
		_dial_turn[i] = 1.0
		_jolt = maxf(_jolt, 0.25)
	selector_symbols[i] = symbol


func shake_selector_id(id: String) -> void:
	var i := selector_ids.find(id)
	if i >= 0:
		_dial_shake[i] = 1.5


func set_lever_unlocked(on: bool) -> void:
	lever_unlocked = on


func jiggle_lever() -> void:
	_lever_jiggle = 0.6
	beat.emit("ratchet")


func pull_lever() -> void:
	_lever_target = 1.0


func release_lever() -> void:
	_lever_target = 0.0


func attempt_start() -> void:
	_attempting = 1.0
	_speed = 1.6


func attempt_fail() -> void:
	_attempting = 0.0
	_jolt = 1.5
	puff(Vector2(_rng.randf_range(-200, 200), -300), 22)
	_speed = 0.0
	release_lever()


func start_finale() -> void:
	_finale = 0.0
	_speed_target = 1.2
	_core = 1.0


func is_finale() -> bool:
	return _finale >= 0.0


func puff(at: Vector2, n: int) -> void:
	for i in n:
		_steam.append({"p": at + Vector2(_rng.randf_range(-10, 10), 0), "v": Vector2(_rng.randf_range(-40, 40), _rng.randf_range(-120, -50)),
			"r": _rng.randf_range(8, 18), "life": _rng.randf_range(1.0, 2.2), "age": 0.0})


func finale_height() -> float:
	return 820.0


# ---------------------------------------------------------------------- update

func _process(delta: float) -> void:
	_t += delta
	_jolt = maxf(_jolt - delta * 3.0, 0.0)
	_speed = lerpf(_speed, _speed_target, delta * (0.6 if _attempting <= 0.0 else 0.2))
	_ring_outer += _speed * delta
	_ring_mid -= _speed * 1.6 * delta
	_ring_inner += _speed * 2.3 * delta
	_core = move_toward(_core, 1.0 if level >= 4 else 0.0, delta * 0.4)
	_gauge = move_toward(_gauge, 1.0 if level >= 3 else 0.0, delta * 0.5)
	_tube = move_toward(_tube, level / 5.0, delta * 0.12)
	for i in _locks.size():
		if i < level:
			_locks[i] = move_toward(_locks[i], 0.0, delta * 0.8)
	for i in _dial_turn.size():
		_dial_turn[i] = maxf(_dial_turn[i] - delta * 5.0, 0.0)
		_dial_shake[i] = maxf(_dial_shake[i] - delta, 0.0)
	_lever = move_toward(_lever, _lever_target, delta * 2.5)
	_lever_jiggle = maxf(_lever_jiggle - delta, 0.0)
	for k in _symbol_flash.keys():
		_symbol_flash[k] = maxf(_symbol_flash[k] - delta * 0.5, 0.0)
	if level >= 3 and _finale < 0.0:
		_steam_timer -= delta
		if _steam_timer <= 0.0:
			_steam_timer = _rng.randf_range(2.5, 5.0)
			puff(Vector2(-330 if _rng.randf() < 0.5 else 330, -230), 5)
	for s in _steam:
		s["age"] += delta
		s["p"] += s["v"] * delta
		s["v"] *= 0.98
		s["r"] += delta * 14.0
	_steam = _steam.filter(func(s): return s["age"] < s["life"])
	if _finale >= 0.0:
		_finale += delta
		if _finale > 4.0 and _light_birds.size() < 14 and _rng.randf() < delta * 2.5:
			_light_birds.append({"p": Vector2(_rng.randf_range(-120, 120), core_y - _rng.randf_range(250, 500)),
				"v": Vector2(_rng.randf_range(-160, 160), _rng.randf_range(-90, -20)), "ph": _rng.randf() * TAU})
		for b in _light_birds:
			b["p"] += b["v"] * delta
			b["v"].y -= 6.0 * delta
	queue_redraw()


# ------------------------------------------------------------------------ draw

func _font() -> Font:
	return ThemeDB.fallback_font


func _draw() -> void:
	var jolt := Vector2(0, sin(_t * 60.0) * 3.0 * _jolt)
	draw_set_transform(jolt, 0.0, Vector2.ONE)
	var alive := clampf(level / 5.0, 0.0, 1.0)
	var brass := Color(0.45, 0.36, 0.2).lerp(Color(0.72, 0.55, 0.26), 0.35 + alive * 0.65)
	var dark := brass.darkened(0.5)
	var shine := brass.lightened(0.35)
	var c := Vector2(0, core_y)
	# Backlight halo (stronger as the machine wakes)
	if alive > 0.0 or _finale >= 0.0:
		var halo := 0.08 * alive + (0.25 if _finale >= 0.0 else 0.0)
		for i in 5:
			draw_circle(c, 300 + i * 60, Color(1.0, 0.8, 0.45, halo * (1.0 - i / 5.0) * 0.5))
	_draw_tubes(brass, dark)
	_draw_gauges(brass, dark)
	# Struts from plinth to the ring
	for sx: float in [-1.0, 1.0]:
		draw_colored_polygon(PackedVector2Array([Vector2(sx * 160, -170), Vector2(sx * 210, -170), Vector2(sx * 120, c.y + 150), Vector2(sx * 90, c.y + 130)]), dark)
	_draw_gear(Vector2(-215, -250), 52, 14, _ring_mid * 1.3, brass.darkened(0.2))
	_draw_gear(Vector2(228, -268), 40, 11, -_ring_mid * 1.7, brass.darkened(0.2))
	_draw_gear(Vector2(185, -610), 34, 9, _ring_outer * 2.0, brass.darkened(0.25))
	# Outer ring with the six symbol lamps
	draw_circle(c, 262, dark)
	draw_arc(c, 250, 0, TAU, 72, brass, 24.0, true)
	draw_arc(c, 262, 0, TAU, 72, shine.darkened(0.2), 3.0, true)
	for i in 60:
		var a := _ring_outer + i * TAU / 60.0
		var r0 := 240.0 if i % 5 else 234.0
		draw_line(c + Vector2(cos(a), sin(a)) * r0, c + Vector2(cos(a), sin(a)) * 246.0, dark, 2.0)
	for i in symbols.size():
		var s: String = symbols[i]
		var a := -PI / 2.0 + i * TAU / symbols.size() + _ring_outer * 0.15
		var p := c + Vector2(cos(a), sin(a)) * 212.0
		var on := active_symbols.has(s) or _finale >= 0.0
		var fl: float = _symbol_flash.get(s, 0.0)
		draw_circle(p, 30, dark.darkened(0.3))
		if on:
			draw_circle(p, 36 + fl * 30.0, Color(1.0, 0.8, 0.4, 0.2 + fl * 0.4))
			draw_circle(p, 27, Color(0.35, 0.2, 0.08))
		draw_arc(p, 30, 0, TAU, 20, brass, 4.0)
		HumanZooSymbols.draw_symbol(self, s, p, 38, Color(1.0, 0.86, 0.5) if on else Color(0.35, 0.3, 0.24))
	# Middle ring: gear teeth
	draw_arc(c, 172, 0, TAU, 60, brass.darkened(0.15), 18.0, true)
	for i in 36:
		var a := _ring_mid + i * TAU / 36.0
		var p0 := c + Vector2(cos(a), sin(a)) * 180
		var p1 := c + Vector2(cos(a), sin(a)) * 192
		draw_line(p0, p1, brass.darkened(0.1), 7.0)
	# Inner ring with engraved spokes
	draw_arc(c, 128, 0, TAU, 48, brass, 12.0, true)
	for i in 6:
		var a := _ring_inner + i * TAU / 6.0
		draw_line(c + Vector2(cos(a), sin(a)) * 86, c + Vector2(cos(a), sin(a)) * 122, dark, 5.0)
	# Lock bolts
	for i in _locks.size():
		var a := -PI / 2.0 + PI / 5.0 + i * TAU / 5.0
		var dir := Vector2(cos(a), sin(a))
		var out := 92.0 + (1.0 - _locks[i]) * 44.0
		var p := c + dir * out
		var perp := Vector2(-dir.y, dir.x)
		var bolt := PackedVector2Array([p - perp * 9 - dir * 22, p + perp * 9 - dir * 22, p + perp * 9 + dir * 10, p - perp * 9 + dir * 10])
		draw_colored_polygon(bolt, Color(0.35, 0.33, 0.32) if _locks[i] > 0.05 else brass)
		draw_circle(p + dir * 2, 3.5, Color(0.8, 0.2, 0.1) if _locks[i] > 0.05 else Color(1.0, 0.85, 0.4))
	# Core: a glass dome
	var cg := _core
	draw_circle(c, 84, Color(0.08, 0.07, 0.06))
	if cg > 0.0:
		var pulse := 0.85 + 0.15 * sin(_t * 2.2)
		for i in 4:
			draw_circle(c, 80 - i * 16, Color(1.0, 0.75 + i * 0.05, 0.4, cg * pulse * (0.18 + i * 0.12)))
	draw_arc(c, 84, 0, TAU, 40, shine, 3.0, true)
	draw_arc(c + Vector2(-20, -24), 50, PI * 1.1, PI * 1.5, 12, Color(1, 1, 1, 0.25), 4.0)
	_draw_steam_pipes(brass, dark)
	_draw_plinth(brass, dark, shine)
	_draw_lever(brass, dark)
	for s in _steam:
		var a: float = (1.0 - s["age"] / s["life"]) * 0.35
		draw_circle(s["p"], s["r"], Color(0.92, 0.92, 0.95, a))
	if _finale >= 0.0:
		_draw_tree()
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_gear(p: Vector2, r: float, teeth: int, ang: float, col: Color) -> void:
	draw_circle(p, r, col)
	for i in teeth:
		var a := ang + i * TAU / teeth
		draw_line(p + Vector2(cos(a), sin(a)) * (r - 2), p + Vector2(cos(a), sin(a)) * (r + 9), col, 8.0)
	draw_circle(p, r * 0.45, col.darkened(0.35))
	draw_circle(p, r * 0.15, col.lightened(0.3))


func _draw_tubes(brass: Color, dark: Color) -> void:
	for sx: float in [-1.0, 1.0]:
		var x := sx * 335.0
		var top := -640.0
		var bottom := -220.0
		draw_rect(Rect2(x - 22, top, 44, bottom - top), Color(0.6, 0.8, 0.85, 0.12))
		var fill := clampf(_tube, 0.0, 1.0)
		if fill > 0.0:
			var fy := lerpf(bottom, top + 20, fill)
			var liquid := Color(1.0, 0.62, 0.22, 0.65) if sx < 0 else Color(0.45, 0.85, 0.75, 0.6)
			draw_rect(Rect2(x - 18, fy, 36, bottom - fy), liquid)
			if level >= 5 or _finale >= 0.0:
				for i in 6:
					var by := bottom - fmod(_t * 70.0 + i * 47.0, bottom - fy)
					draw_circle(Vector2(x + sin(_t * 3.0 + i) * 8.0, by), 3.0, Color(1, 1, 1, 0.5))
		draw_rect(Rect2(x - 22, top, 44, bottom - top), Color(0.85, 0.95, 1.0, 0.35), false, 2.0)
		draw_rect(Rect2(x - 28, top - 16, 56, 18), brass)
		draw_rect(Rect2(x - 28, bottom - 2, 56, 18), brass)
		draw_line(Vector2(x - 12, top + 10), Vector2(x - 12, bottom - 10), Color(1, 1, 1, 0.2), 3.0)
		# Pipe from tube base down into the plinth
		draw_line(Vector2(x, bottom + 16), Vector2(x, -170), dark, 14.0)
		draw_line(Vector2(x, bottom + 16), Vector2(x, -170), brass.darkened(0.1), 8.0)


func _draw_gauges(brass: Color, dark: Color) -> void:
	for sx: float in [-1.0, 1.0]:
		var g := Vector2(sx * 250.0, -690.0)
		draw_line(g + Vector2(0, 30), g + Vector2(sx * 40, 110), dark, 10.0)
		draw_circle(g, 38, dark)
		draw_circle(g, 32, Color(0.93, 0.9, 0.8) if _gauge > 0.1 else Color(0.5, 0.48, 0.42))
		for i in 9:
			var a := lerpf(PI * 0.75, PI * 2.25, i / 8.0)
			draw_line(g + Vector2(cos(a), sin(a)) * 24, g + Vector2(cos(a), sin(a)) * 30, Color(0.2, 0.15, 0.1), 2.0)
		var v := 0.05 + _gauge * (0.55 + 0.12 * sin(_t * (2.0 + sx) + sx))
		if _finale >= 0.0:
			v = 0.95 + 0.03 * sin(_t * 20.0)
		var na := lerpf(PI * 0.75, PI * 2.25, v)
		draw_line(g, g + Vector2(cos(na), sin(na)) * 26, Color(0.75, 0.1, 0.1), 3.0)
		draw_circle(g, 5, brass)
		draw_arc(g, 38, 0, TAU, 28, brass, 4.0)


func _draw_steam_pipes(brass: Color, dark: Color) -> void:
	# Pipes curling from the plinth into the ring
	for sx: float in [-1.0, 1.0]:
		var pts := PackedVector2Array()
		for i in 13:
			var t := i / 12.0
			pts.append(Vector2(sx * lerpf(300.0, 190.0, t), lerpf(-170.0, core_y + 160.0 * (1.0 - t) + 40.0, t)) + Vector2(sx * sin(t * PI) * 50.0, 0))
		draw_polyline(pts, dark, 16.0, true)
		draw_polyline(pts, brass.darkened(0.05), 9.0, true)


func _draw_plinth(brass: Color, dark: Color, shine: Color) -> void:
	var plinth := PackedVector2Array([Vector2(-385, 0), Vector2(385, 0), Vector2(360, -170), Vector2(-360, -170)])
	draw_colored_polygon(plinth, dark.lerp(Color(0.12, 0.09, 0.06), 0.3))
	draw_rect(Rect2(-370, -180, 740, 14), brass)
	draw_line(Vector2(-370, -180), Vector2(370, -180), shine, 2.0)
	for i in 15:
		var x := lerpf(-360, 360, i / 14.0)
		draw_circle(Vector2(x, -173), 2.5, shine)
	# Selector dials
	for i in selector_ids.size():
		var p := selector_position(i)
		var shake: float = _dial_shake[i] if i < _dial_shake.size() else 0.0
		p.x += sin(_t * 40.0) * 5.0 * shake
		var id: String = selector_ids[i]
		var sel_glow: float = selector_glow.get(id, 0.0)
		var is_sel := machine_mode and selected == i
		if is_sel:
			draw_circle(p, 62, Color(1.0, 0.85, 0.5, 0.25 + 0.1 * sin(_t * 6.0)))
		draw_circle(p, 47, brass.darkened(0.2))
		# Knurled rim that rotates when the dial turns
		var turn: float = _dial_turn[i] if i < _dial_turn.size() else 0.0
		for k in 24:
			var a := k * TAU / 24.0 + turn * TAU / 6.0
			draw_line(p + Vector2(cos(a), sin(a)) * 42, p + Vector2(cos(a), sin(a)) * 48, shine.darkened(0.2), 3.0)
		draw_circle(p, 38, Color(0.1, 0.08, 0.07))
		var sym: String = selector_symbols[i] if i < selector_symbols.size() else symbols[0]
		var sym_col := Color(0.96, 0.9, 0.75).lerp(Color(1.0, 0.8, 0.4), sel_glow)
		if level < 5 and not machine_mode:
			sym_col = sym_col.darkened(0.45)
		var off := Vector2(0, -turn * 30.0)
		HumanZooSymbols.draw_symbol(self, sym, p + off, 50, Color(sym_col, 1.0 - turn))
		# Pointer notch
		draw_colored_polygon(PackedVector2Array([p + Vector2(-7, -50), p + Vector2(7, -50), p + Vector2(0, -40)]), shine)
		# Glow lamp above and emblem plaque below
		draw_circle(p + Vector2(0, -62), 6, Color(1.0, 0.7, 0.3) if sel_glow > 0.5 else Color(0.3, 0.15, 0.08))
		if sel_glow > 0.5:
			draw_circle(p + Vector2(0, -62), 12, Color(1.0, 0.7, 0.3, 0.25))
		var plate := Rect2(p + Vector2(-30, 52), Vector2(60, 34))
		draw_rect(plate, brass.darkened(0.1))
		draw_rect(plate, shine.darkened(0.2), false, 2.0)
		HumanZooSymbols.draw_emblem(self, id, plate.get_center(), 28, Color(0.18, 0.12, 0.06))


func _draw_lever(brass: Color, dark: Color) -> void:
	var base := lever_position()
	var jig := sin(_t * 50.0) * 0.08 * _lever_jiggle
	var ang := lerpf(-0.25, 1.2, _lever) + jig
	var tip := base + Vector2(sin(ang), -cos(ang)) * 150.0
	var is_sel := machine_mode and selected == selector_ids.size()
	if is_sel:
		draw_circle(tip, 40, Color(1.0, 0.85, 0.5, 0.3 + 0.1 * sin(_t * 6.0)))
	draw_rect(Rect2(base + Vector2(-30, -16), Vector2(60, 20)), dark)
	draw_line(base, tip, Color(0.3, 0.3, 0.32), 12.0)
	draw_line(base, tip, Color(0.55, 0.55, 0.58), 5.0)
	draw_circle(tip, 17, Color(0.7, 0.12, 0.1))
	draw_circle(tip + Vector2(-5, -5), 5, Color(1, 0.6, 0.55, 0.6))
	draw_circle(base, 12, brass)
	# Lock: a padlock + chain until the machine is ready
	var lamp := base + Vector2(0, 26)
	if not lever_unlocked:
		var mid := base.lerp(tip, 0.5)
		draw_line(mid, base + Vector2(34, 0), Color(0.5, 0.5, 0.52), 3.0)
		var lock := base + Vector2(40, 4)
		draw_rect(Rect2(lock + Vector2(-10, -4), Vector2(20, 16)), Color(0.6, 0.5, 0.2))
		draw_arc(lock + Vector2(0, -5), 7, PI, TAU, 10, Color(0.6, 0.6, 0.62), 3.0)
		draw_circle(lamp, 6, Color(0.45, 0.08, 0.05))
	else:
		draw_circle(lamp, 14, Color(0.5, 1.0, 0.5, 0.2 + 0.1 * sin(_t * 4.0)))
		draw_circle(lamp, 6, Color(0.5, 1.0, 0.55))


# ----------------------------------------------------------------- the finale

func _draw_tree() -> void:
	var t := _finale
	var grow := clampf((t - 1.0) / 7.0, 0.0, 1.0)
	grow = 1.0 - pow(1.0 - grow, 3.0)
	var base := Vector2(0, core_y + 60)
	# Light column
	var beam := clampf(t / 1.5, 0.0, 1.0)
	draw_colored_polygon(PackedVector2Array([base + Vector2(-60, 0), base + Vector2(60, 0), base + Vector2(200, -1200), base + Vector2(-200, -1200)]),
		Color(1.0, 0.9, 0.6, 0.10 * beam))
	var rng := RandomNumberGenerator.new()
	rng.seed = _tree_seed
	_branch(base, -PI / 2.0, 230.0, 26.0, 0, grow, rng)
	for b in _light_birds:
		var flap := sin(_t * 10.0 + b["ph"]) * 0.25 + 1.0
		HumanZooSymbols.draw_symbol(self, "BIRD", b["p"], 34 * flap, Color(1.0, 0.95, 0.75, 0.9))


func _branch(p: Vector2, ang: float, length: float, w: float, depth: int, grow: float, rng: RandomNumberGenerator) -> void:
	var start := depth * 0.12
	var local := clampf((grow - start) / 0.35, 0.0, 1.0)
	var sway := sin(_t * 0.8 + depth) * 0.03 * depth
	var a := ang + sway
	var end := p + Vector2(cos(a), sin(a)) * length * local
	if local <= 0.0:
		return
	var bark := Color(0.55, 0.42, 0.2).lerp(Color(0.85, 0.95, 1.0, 0.85), clampf(depth / 6.0, 0.0, 1.0))
	draw_line(p, end, bark, maxf(w * local, 1.5), true)
	if depth < 6:
		var n := 2 if depth < 2 else 3
		for i in n:
			var spread := rng.randf_range(0.3, 0.65)
			var na := a + (i - (n - 1) * 0.5) * spread + rng.randf_range(-0.12, 0.12)
			_branch(end, na, length * rng.randf_range(0.62, 0.78), w * 0.66, depth + 1, grow, rng)
	else:
		var leaf_cols := [Color(1.0, 0.85, 0.45), Color(0.6, 1.0, 0.85), Color(1.0, 0.65, 0.75), Color(0.85, 0.9, 1.0)]
		var lc: Color = leaf_cols[rng.randi() % leaf_cols.size()]
		var bloom := clampf((grow - 0.85) / 0.15, 0.0, 1.0)
		if bloom > 0.0:
			var tw := 0.75 + 0.25 * sin(_t * 3.0 + end.x)
			draw_circle(end, 16 * bloom, Color(lc, 0.18 * tw))
			draw_circle(end, 6 * bloom, Color(lc, 0.9 * tw))
