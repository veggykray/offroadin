extends Node2D
## The fruit once it leaves the plant: falls, bounces, waits to be clicked, splits open and
## reveals the brass seed-key. Also plays the "lost fruit" animation (falls and crumbles to dust).
## Draws in Stage coordinates (node sits at the origin).

signal landed()
signal opened()
signal key_collected()
signal became_idle()

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

enum State { IDLE, FALLING, RESTING, OPENING, KEY, COLLECTING, DONE }

const FLOOR_Y := 962.0
const GRAVITY := 1700.0
const FRUIT_R := 36.0
const KEY_SCALE := 1.6
const KEY_LIFT := 58.0
const OPEN_TIME := 1.0
const COLLECT_TIME := 1.3
const ROT_TIME := 4.0

var state: int = State.IDLE
## Set by the root: the temporal field is ANCIENT, so a fruit lying on the floor rots away.
var rot_active := false

var _pos := Vector2.ZERO
var _vel := Vector2.ZERO
var _rot := 0.0
var _spin := 0.0
var _bounces := 0
var _t := 0.0
var _crumble := false
var _crumble_reason := ""
var _decay := 0.0
var _key_tarnish := 0.0
var _hover := false
var _time := 0.0
var _bits: Array[Dictionary] = []
var _collected_emitted := false


func is_idle() -> bool:
	return state == State.IDLE and _bits.is_empty()


func state_name() -> String:
	return State.keys()[state]


func key_position() -> Vector2:
	return _key_pos()


func reset() -> void:
	state = State.IDLE
	_bits.clear()
	_decay = 0.0
	_key_tarnish = 0.0
	_crumble = false
	queue_redraw()


## A ripe fruit drops from the plant.
func drop_from(stage_pos: Vector2) -> void:
	_start_fall(stage_pos)
	_crumble = false


## A spoiled fruit falls off and crumbles to nothing. reason: "rot", "frost" or "scorch".
func crumble_from(stage_pos: Vector2, reason: String) -> void:
	_start_fall(stage_pos)
	_crumble = true
	_crumble_reason = reason


func _start_fall(p: Vector2) -> void:
	state = State.FALLING
	_pos = p
	_vel = Vector2(randf_range(30.0, 60.0), -60.0)
	_rot = 0.0
	_spin = randf_range(2.0, 4.0)
	_bounces = 0
	_t = 0.0
	_decay = 0.0
	_key_tarnish = 0.0


func _process(delta: float) -> void:
	_time += delta
	_t += delta
	match state:
		State.FALLING:
			_vel.y += GRAVITY * delta
			_pos += _vel * delta
			_rot += _spin * delta
			if _pos.y >= FLOOR_Y:
				_pos.y = FLOOR_Y
				if _crumble:
					_burst(_crumble_color(), 26)
					state = State.IDLE
				elif _bounces < 2 and _vel.y > 160.0:
					if _bounces == 0:
						landed.emit()
					_vel.y = -_vel.y * 0.32
					_vel.x *= 0.55
					_spin *= -0.5
					_bounces += 1
				else:
					_vel = Vector2.ZERO
					state = State.RESTING
					_t = 0.0
		State.RESTING:
			_rot = lerpf(_rot, 0.35, 1.0 - exp(-delta * 4.0))
			if rot_active:
				_decay = minf(1.0, _decay + delta / ROT_TIME)
				if _decay >= 1.0:
					# The flesh rots away; brass does not. The key is left behind, a little tarnished.
					_key_tarnish = 0.6
					_burst(Color(0.3, 0.22, 0.12), 18)
					_enter_key()
		State.OPENING:
			if _t >= OPEN_TIME:
				_enter_key()
		State.COLLECTING:
			if _t >= COLLECT_TIME * 0.7 and not _collected_emitted:
				_collected_emitted = true
				key_collected.emit()
			if _t >= COLLECT_TIME:
				state = State.DONE
	_update_bits(delta)
	queue_redraw()


func _enter_key() -> void:
	state = State.KEY
	_t = 0.0
	opened.emit()


func _crumble_color() -> Color:
	match _crumble_reason:
		"frost":
			return Color(0.8, 0.9, 1.0)
		"scorch":
			return Color(0.15, 0.09, 0.06)
	return Color(0.32, 0.22, 0.12)


func _burst(col: Color, n: int) -> void:
	for i in n:
		var a := randf() * TAU
		_bits.append({"p": _pos + Vector2(cos(a), sin(a)) * randf() * 14.0, "v": Vector2(cos(a) * randf_range(40, 180), randf_range(-260, -60)),
				"c": col.lerp(Color.WHITE, randf() * 0.2), "r": randf_range(2.0, 5.5), "t": 0.0, "life": randf_range(0.7, 1.4)})


func _update_bits(dt: float) -> void:
	if _bits.is_empty():
		return
	for b in _bits:
		var v: Vector2 = b["v"]
		v.y += GRAVITY * 0.5 * dt
		var p: Vector2 = b["p"] + v * dt
		if p.y > FLOOR_Y + 8.0:
			p.y = FLOOR_Y + 8.0
			v = v * 0.3
		b["v"] = v
		b["p"] = p
		b["t"] = float(b["t"]) + dt
	_bits.assign(_bits.filter(func(b: Dictionary) -> bool: return float(b["t"]) < float(b["life"])))
	if _bits.is_empty() and state == State.IDLE:
		became_idle.emit()


func _key_pos() -> Vector2:
	match state:
		State.OPENING:
			return _pos + Vector2(0, -lerpf(0.0, KEY_LIFT, smoothstep(0.3, 1.0, _t / OPEN_TIME)))
		State.KEY:
			return _pos + Vector2(0, -KEY_LIFT + sin(_time * 2.2) * 4.0)
		State.COLLECTING:
			var k := smoothstep(0.0, 1.0, _t / COLLECT_TIME)
			return _pos + Vector2(0, -KEY_LIFT - 160.0 * k)
	return _pos


# --- Input -----------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var p := get_local_mouse_position()
		_hover = (state == State.RESTING and p.distance_to(_pos) < FRUIT_R + 18.0) \
				or (state == State.KEY and p.distance_to(_key_pos()) < 64.0)
		return
	if not (event is InputEventMouseButton):
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	var p2 := get_local_mouse_position()
	if state == State.RESTING and p2.distance_to(_pos) < FRUIT_R + 18.0:
		state = State.OPENING
		_t = 0.0
		_burst(Color(1.0, 0.5, 0.45), 14)
		get_viewport().set_input_as_handled()
	elif state == State.KEY and p2.distance_to(_key_pos()) < 64.0:
		state = State.COLLECTING
		_collected_emitted = false
		_t = 0.0
		get_viewport().set_input_as_handled()


## Lets the root open/collect without a mouse (keyboard test shortcut).
func interact() -> void:
	if state == State.RESTING:
		state = State.OPENING
		_t = 0.0
		_burst(Color(1.0, 0.5, 0.45), 14)
	elif state == State.KEY:
		state = State.COLLECTING
		_collected_emitted = false
		_t = 0.0


# --- Drawing ---------------------------------------------------------------------------------

func _draw() -> void:
	for b in _bits:
		var k := 1.0 - float(b["t"]) / float(b["life"])
		draw_circle(b["p"], float(b["r"]) * (0.5 + 0.5 * k), U.with_alpha(b["c"], k))
	match state:
		State.FALLING:
			_draw_shadow(1.0 - clampf((FLOOR_Y - _pos.y) / 400.0, 0.0, 1.0))
			if _crumble:
				var reason_frost := 1.0 if _crumble_reason == "frost" else 0.0
				var reason_scorch := 1.0 if _crumble_reason == "scorch" else 0.0
				U.draw_fruit(self, _pos, FRUIT_R * 0.8, 0.3, 0.8, reason_frost, reason_scorch, _rot)
			else:
				U.draw_fruit(self, _pos, FRUIT_R, 1.0, 0.0, 0.0, 0.0, _rot, 0.6)
		State.RESTING:
			_draw_shadow(1.0)
			var pulse := 0.5 + 0.5 * sin(_time * 3.0)
			var glow := (0.45 + 0.35 * pulse) * (1.0 - _decay)
			if _hover:
				glow += 0.5
			U.draw_fruit(self, _pos, FRUIT_R, 1.0, _decay, 0.0, 0.0, _rot, glow)
		State.OPENING:
			_draw_shadow(1.0)
			_draw_halves(smoothstep(0.0, 0.6, _t / OPEN_TIME))
			_draw_key_glow(smoothstep(0.2, 1.0, _t / OPEN_TIME))
			U.draw_key(self, _key_pos(), KEY_SCALE, -0.25, _key_tarnish, 0.0)
		State.KEY:
			_draw_shadow(1.0)
			_draw_halves(1.0)
			_draw_key_glow(1.0 + (0.4 if _hover else 0.0))
			var glint := pow(maxf(0.0, sin(_time * 2.6)), 6.0)
			U.draw_key(self, _key_pos(), KEY_SCALE + (0.12 if _hover else 0.0), -0.25 + sin(_time * 1.5) * 0.06, _key_tarnish, glint)
		State.COLLECTING:
			var k := clampf(_t / COLLECT_TIME, 0.0, 1.0)
			_draw_halves(1.0, 1.0 - k)
			var flash := sin(k * PI)
			U.radial(self, _key_pos(), 60.0 + 160.0 * flash, Color(1.0, 0.9, 0.55, 0.55 * flash), U.CLEAR, 28)
			U.draw_key(self, _key_pos(), KEY_SCALE + k * 1.0, -0.25 + k * TAU, _key_tarnish * (1.0 - k), 1.0 - k)


func _draw_shadow(k: float) -> void:
	U.ellipse(self, Vector2(_pos.x, FLOOR_Y + FRUIT_R * 0.95), FRUIT_R * 1.1 * k, 6.0 * k, Color(0, 0, 0, 0.35 * k), 18)


func _draw_key_glow(k: float) -> void:
	U.radial(self, _key_pos(), 70.0 * k, Color(1.0, 0.85, 0.45, 0.35 * minf(k, 1.0)), U.CLEAR, 24)


## The fruit split in two, halves rolled apart, showing pale flesh and seeds.
func _draw_halves(open: float, alpha := 1.0) -> void:
	var outline := U.fruit_outline(Vector2.ZERO, FRUIT_R, _decay)
	var left := PackedVector2Array()
	var right := PackedVector2Array()
	var n := outline.size()
	for i in n:
		var p := outline[i]
		if i <= n / 2:
			right.append(p)
		if i >= n / 2 or i == 0:
			left.append(p)
	var body := U.with_alpha(U.fruit_color(1.0, _decay, 0.0, 0.0), alpha)
	var flesh := U.with_alpha(Color(1.0, 0.86, 0.62), alpha)
	for half in [[right, 1.0], [left, -1.0]]:
		var pts: PackedVector2Array = half[0]
		var dir := float(half[1])
		var off := Vector2(dir * (6.0 + 34.0 * open), 8.0 * open)
		var rot := dir * 0.4 * open
		var moved := PackedVector2Array()
		for p in pts:
			moved.append(_pos + off + p.rotated(rot))
		if moved.size() >= 3:
			draw_colored_polygon(moved, body)
			# Cut face: a flesh-coloured inset.
			var inset := PackedVector2Array()
			for p in pts:
				inset.append(_pos + off + (p * Vector2(0.8, 0.88)).rotated(rot) + Vector2(-dir * 1.5, 1.0).rotated(rot))
			draw_colored_polygon(inset, flesh)
			for s in 4:
				var sp := _pos + off + Vector2(-dir * 6.0, -16.0 + float(s) * 11.0).rotated(rot)
				U.ellipse(self, sp, 3.0, 4.5, U.with_alpha(Color(0.35, 0.15, 0.1), alpha), 8)
