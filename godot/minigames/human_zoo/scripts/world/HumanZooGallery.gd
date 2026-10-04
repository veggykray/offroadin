class_name HumanZooGallery
extends Node2D
## The viewing gallery around the enclosures: wallpaper, cast-iron columns,
## cornice, hanging lamps, the floor, and the ceiling apparatus that plays the
## third-bell sequence (bell -> lights out -> bird -> moon lamp -> feeding hand).
## Purely atmospheric; replace freely in the real scene.

@export var left: float = -200.0
@export var right: float = 4000.0
@export var ceiling: float = -980.0
@export var machine_x: float = 1800.0
## X positions of the columns (between enclosures).
var columns: Array = []
var lamps: Array = []

var _t := 0.0
var _bell_swing := 0.0
var _bird := -1.0
var _bird_from := Vector2.ZERO
var _bird_to := Vector2.ZERO
var _moon := 0.0
var _hand := 0.0
var _motes: Array = []
var _stars: Array = []
var _finale := 0.0


func _ready() -> void:
	# Deferred so callers can set left/right/ceiling right after add_child().
	_generate.call_deferred()


func _generate() -> void:
	_motes.clear()
	_stars.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 90:
		_motes.append(Vector3(rng.randf_range(left, right), rng.randf_range(ceiling, 0), rng.randf()))
	for i in 160:
		_stars.append(Vector3(rng.randf_range(left, right), rng.randf_range(ceiling - 1450.0, ceiling - 230.0), rng.randf() * 1.2))


func ring_bell(low: bool) -> void:
	_bell_swing = 1.4 if low else 1.0


## The bird flies in from the dark, perches over the King, and leaves.
func fly_bird(to: Vector2, duration: float) -> void:
	_bird = 0.0
	_bird_to = to
	_bird_from = Vector2(to.x - 900, ceiling + 120)
	_bird_duration = duration


var _bird_duration := 5.0


func light_moon(seconds: float) -> void:
	_moon = seconds


func lower_hand(seconds: float) -> void:
	_hand = seconds


func set_finale(amount: float) -> void:
	_finale = amount


func _process(delta: float) -> void:
	_t += delta
	_bell_swing = maxf(_bell_swing - delta * 0.35, 0.0)
	_moon = maxf(_moon - delta, 0.0)
	_hand = maxf(_hand - delta, 0.0)
	if _bird >= 0.0:
		_bird += delta
		if _bird > _bird_duration + 2.0:
			_bird = -1.0
	queue_redraw()


func _draw() -> void:
	var w := right - left
	# Wall
	draw_rect(Rect2(left, ceiling, w, -ceiling), Color(0.11, 0.13, 0.11))
	# Damask-ish wallpaper diamonds
	var y := ceiling + 60.0
	var row := 0
	while y < -80.0:
		var x := left + (40.0 if row % 2 else 0.0)
		while x < right:
			draw_colored_polygon(PackedVector2Array([Vector2(x, y - 14), Vector2(x + 9, y), Vector2(x, y + 14), Vector2(x - 9, y)]), Color(0.16, 0.19, 0.15))
			x += 80.0
		y += 52.0
		row += 1
	# The vault above the gallery: iron trusses and a dark skylight. Mostly
	# unseen, but the finale's tree grows up into it.
	var vault_top := ceiling - 1500.0
	draw_rect(Rect2(left, vault_top, w, ceiling - vault_top), Color(0.035, 0.04, 0.06))
	for st in _stars:
		var tw := 0.4 + 0.6 * absf(sin(_t * 0.6 + st.z * 11.0))
		draw_circle(Vector2(st.x, st.y), 1.3 + st.z, Color(0.85, 0.9, 1.0, (0.12 + 0.5 * _finale) * tw))
	var bx := left
	while bx < right:
		draw_line(Vector2(bx, ceiling - 200), Vector2(bx + 300, vault_top + 300), Color(0.09, 0.085, 0.08), 10.0)
		draw_line(Vector2(bx + 600, ceiling - 200), Vector2(bx + 300, vault_top + 300), Color(0.09, 0.085, 0.08), 10.0)
		draw_line(Vector2(bx + 300, vault_top + 300), Vector2(bx + 300, ceiling - 200), Color(0.08, 0.075, 0.07), 6.0)
		bx += 600.0
	draw_line(Vector2(left, ceiling - 200), Vector2(right, ceiling - 200), Color(0.12, 0.1, 0.08), 14.0)
	# Cornice and ceiling
	draw_rect(Rect2(left, ceiling - 200, w, 200), Color(0.06, 0.055, 0.05))
	draw_rect(Rect2(left, ceiling, w, 34), Color(0.3, 0.24, 0.16))
	draw_rect(Rect2(left, ceiling + 34, w, 6), Color(0.6, 0.47, 0.25))
	for i in int(w / 40.0):
		draw_rect(Rect2(left + i * 40.0 + 8, ceiling + 6, 22, 22), Color(0.22, 0.18, 0.12))
	# Floor of the gallery
	draw_rect(Rect2(left, -80, w, 80), Color(0.16, 0.12, 0.1))
	draw_rect(Rect2(left, 0, w, 260), Color(0.12, 0.09, 0.075))
	var tx := left
	var k := 0
	while tx < right:
		draw_rect(Rect2(tx, 0, 60, 24), Color(0.2, 0.16, 0.12) if k % 2 else Color(0.27, 0.22, 0.16))
		draw_rect(Rect2(tx + 30, 110, 60, 30), Color(0.17, 0.13, 0.1) if k % 2 else Color(0.22, 0.18, 0.14))
		tx += 60.0
		k += 1
	draw_line(Vector2(left, 0), Vector2(right, 0), Color(0.55, 0.42, 0.22), 3.0)
	# Columns
	for cx in columns:
		_draw_column(float(cx))
	# Hanging gallery lamps with warm pools of light
	for lx in lamps:
		var lp := Vector2(float(lx), ceiling + 150)
		draw_line(Vector2(lp.x, ceiling + 40), lp, Color(0.15, 0.12, 0.08), 3.0)
		draw_colored_polygon(PackedVector2Array([lp + Vector2(-26, 0), lp + Vector2(26, 0), lp + Vector2(14, -22), lp + Vector2(-14, -22)]), Color(0.55, 0.42, 0.2))
		draw_circle(lp + Vector2(0, 6), 9, Color(1.0, 0.85, 0.55))
		draw_circle(lp + Vector2(0, 6), 40, Color(1.0, 0.8, 0.5, 0.06))
		draw_colored_polygon(PackedVector2Array([lp + Vector2(-20, 8), lp + Vector2(20, 8), lp + Vector2(160, -ceiling + 30 - 150), lp + Vector2(-160, -ceiling + 30 - 150)]),
			Color(1.0, 0.82, 0.5, 0.035))
	_draw_ceiling_apparatus()
	# Sign (hangs in front of the bell's chain)
	var sx := machine_x
	var sign_r := Rect2(sx - 260, ceiling + 60, 520, 56)
	draw_rect(sign_r, Color(0.13, 0.1, 0.07))
	draw_rect(sign_r, Color(0.65, 0.5, 0.25), false, 4.0)
	draw_string(ThemeDB.fallback_font, Vector2(sign_r.position.x, sign_r.position.y + 37), "THE HUMAN ZOO  ·  PLEASE DO NOT TAP THE GLASS", HORIZONTAL_ALIGNMENT_CENTER, sign_r.size.x, 20, Color(0.85, 0.72, 0.42))
	# Dust motes drifting in the lamplight
	for m in _motes:
		var p := Vector2(m.x + sin(_t * 0.2 + m.z * 20.0) * 30.0, m.y + fmod(_t * 6.0 * (0.3 + m.z), 200.0))
		draw_circle(p, 1.4, Color(1.0, 0.9, 0.7, 0.10 + 0.12 * sin(_t * 0.7 + m.z * 9.0)))
	_draw_bird()
	if _finale > 0.0:
		draw_rect(Rect2(left, ceiling - 200, w, -ceiling + 460), Color(1.0, 0.85, 0.55, 0.06 * _finale))


func _draw_column(x: float) -> void:
	var col := Color(0.14, 0.13, 0.13)
	draw_rect(Rect2(x - 20, ceiling + 40, 40, -ceiling - 40), col)
	draw_rect(Rect2(x - 14, ceiling + 40, 6, -ceiling - 40), Color(0.22, 0.2, 0.2))
	draw_rect(Rect2(x - 30, ceiling + 40, 60, 24), Color(0.55, 0.42, 0.22))
	draw_rect(Rect2(x - 30, -40, 60, 40), Color(0.4, 0.3, 0.16))
	for i in 3:
		draw_circle(Vector2(x, ceiling + 140 + i * 230), 6, Color(0.55, 0.42, 0.22))


func _draw_ceiling_apparatus() -> void:
	var mx := machine_x
	# The bell
	var pivot := Vector2(mx, ceiling + 150)
	var ang := sin(_t * 7.0) * 0.35 * _bell_swing
	draw_line(Vector2(mx, ceiling + 40), pivot, Color(0.2, 0.16, 0.1), 5.0)
	var bell := PackedVector2Array()
	var shape := [Vector2(-10, 0), Vector2(10, 0), Vector2(22, 26), Vector2(30, 52), Vector2(40, 60), Vector2(-40, 60), Vector2(-30, 52), Vector2(-22, 26)]
	for p in shape:
		bell.append(pivot + p.rotated(ang))
	draw_colored_polygon(bell, Color(0.7, 0.54, 0.24))
	draw_circle(pivot + Vector2(0, 66).rotated(ang * 1.4), 7, Color(0.4, 0.3, 0.15))
	# Moon lamp
	var moon_p := Vector2(mx - 360, ceiling + 200)
	draw_line(Vector2(moon_p.x, ceiling + 40), moon_p + Vector2(0, -30), Color(0.2, 0.16, 0.1), 3.0)
	var lit := clampf(_moon, 0.0, 1.0)
	if lit > 0.0:
		draw_circle(moon_p, 70, Color(0.85, 0.9, 1.0, 0.12 * lit))
	draw_circle(moon_p, 30, Color(0.2, 0.2, 0.22))
	HumanZooSymbols.draw_symbol(self, "MOON", moon_p, 52, Color(0.35, 0.36, 0.4).lerp(Color(0.95, 0.97, 1.0), lit))
	# Feeding hatch and hand
	var hatch := Vector2(mx + 360, ceiling + 40)
	draw_rect(Rect2(hatch + Vector2(-34, 0), Vector2(68, 14)), Color(0.35, 0.28, 0.16))
	var drop := sin(clampf(_hand / 2.4, 0.0, 1.0) * PI) * 170.0
	if drop > 1.0:
		var tip := hatch + Vector2(0, 14 + drop)
		draw_line(hatch + Vector2(0, 14), tip, Color(0.5, 0.42, 0.25), 7.0)
		HumanZooSymbols.draw_symbol(self, "HAND", tip + Vector2(0, 20), 46, Color(0.75, 0.62, 0.35))
		draw_rect(Rect2(tip + Vector2(-28, 34), Vector2(56, 6)), Color(0.6, 0.6, 0.62))


func _draw_bird() -> void:
	if _bird < 0.0:
		return
	var arrive := 1.6
	var p: Vector2
	if _bird < arrive:
		p = _bird_from.lerp(_bird_to, _bird / arrive) + Vector2(0, -sin(_bird / arrive * PI) * 80.0)
	elif _bird < _bird_duration:
		return  # perched: drawn by the King's enclosure
	else:
		var t := (_bird - _bird_duration) / 2.0
		p = _bird_to.lerp(_bird_to + Vector2(900, -300), t)
	var flap := sin(_t * 18.0) * 0.4 + 1.0
	HumanZooSymbols.draw_symbol(self, "BIRD", p, 34 * flap, Color(0.04, 0.04, 0.05))
