extends Node2D
## Water spray from the spout into the plant chamber: a burst of droplets on
## a ballistic arc, a fine mist, and splashes where they land on the soil.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")
const Tank := preload("res://minigames/polarity_machine/scripts/water_tank.gd")

const GRAVITY := 900.0
## Droplets stop when they reach the soil surface (design space).
const SOIL_Y := 672.0

var _drops: Array = []    # [pos, vel, life]
var _splashes: Array = [] # [pos, age]
var _emit_left := 0.0
var _sputter := false
var _was_busy := false
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	material = m


## A full spray burst.
func spray() -> void:
	_emit_left = 0.55
	_sputter = false


## Empty tank: a couple of weak drips only.
func sputter() -> void:
	_emit_left = 0.12
	_sputter = true


func _process(dt: float) -> void:
	if _emit_left > 0.0:
		_emit_left -= dt
		var n := 3 if _sputter else 14
		for i in n:
			var spread := _rng.randf_range(-0.16, 0.16)
			var speed := _rng.randf_range(80, 140) if _sputter else _rng.randf_range(430, 560)
			var dir := Tank.NOZZLE_DIR.rotated(spread)
			_drops.append([Tank.NOZZLE + dir * 4, dir * speed, 0.0])
	for i in range(_drops.size() - 1, -1, -1):
		var d = _drops[i]
		d[1].y += GRAVITY * dt
		d[0] += d[1] * dt
		d[2] += dt
		if d[0].y >= SOIL_Y - 6 and d[0].x > 560 and d[0].x < 930:
			if _rng.randf() < 0.3:
				_splashes.append([Vector2(d[0].x, SOIL_Y - 6 + _rng.randf_range(-4, 6)), 0.0])
			_drops.remove_at(i)
		elif d[2] > 1.6 or d[0].y > 1080:
			_drops.remove_at(i)
	for i in range(_splashes.size() - 1, -1, -1):
		_splashes[i][1] += dt
		if _splashes[i][1] > 0.45:
			_splashes.remove_at(i)
	var busy := not _drops.is_empty() or not _splashes.is_empty() or _emit_left > 0.0
	if busy or _was_busy:
		queue_redraw()
	_was_busy = busy


func is_active() -> bool:
	return not _drops.is_empty() or _emit_left > 0.0


func _draw() -> void:
	if _emit_left > 0.0 and not _sputter:
		U.radial(self, Tank.NOZZLE + Tank.NOZZLE_DIR * 40, 70, Color(0.6, 0.85, 1.0, 0.22), Color(0.6, 0.85, 1.0, 0.0))
	for d in _drops:
		var p: Vector2 = d[0]
		var v: Vector2 = d[1]
		var a := clampf(1.2 - d[2], 0.2, 1.0)
		draw_line(p, p - v * 0.018, Color(0.65, 0.88, 1.0, 0.85 * a), 2.0)
		draw_circle(p, 1.6, Color(0.9, 0.98, 1.0, a))
	for s in _splashes:
		var k: float = s[1] / 0.45
		draw_arc(s[0], 3.0 + k * 10.0, PI * 1.05, PI * 1.95, 8, Color(0.75, 0.92, 1.0, 0.7 * (1.0 - k)), 1.5)
