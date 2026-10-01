extends Node2D
## The strange plant in its brass-caged planter.
##
## Visuals are fully procedural and continuous, so no per-state sprites are needed:
##   * AGE (smoothed level) drives the body: seed → shoot → adult → gnarled → dead.
##   * TEMPERATURE and LIGHT layer reactions on top: droop, frost, scorch, folded / opened / bleached leaves.
##   * bloom / ripeness / decay drive the bud → flower → fruit sequence.
##
## The *rules* (which settings allow blooming, ripening, rot...) are decided by the root
## (polarity_machine.gd -> evaluate_puzzle) and handed in through the flags below.
## This node only runs the biology timers and reports milestones via signals.

signal bloom_milestone(milestone: String)  # "stir", "bud", "flower", "fruit"
signal fruit_ripened()
signal fruit_dropped(stage_position: Vector2)
signal fruit_lost(stage_position: Vector2, reason: String)
signal inspected(target: String)  # "plant" or "fruit" — the player clicked to look closer

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

enum FruitState { NONE, HANGING }

const BLOOM_TIME := 6.5  # seconds for the whole straighten → bud → flower → fruit sequence
const RIPEN_TIME := 4.5
const ROT_TIME := 3.5
const HAZARD_TIME := 4.5
const DROP_WOBBLE := 0.9
const MAX_LEAVES := 12
const FRUIT_RADIUS := 32.0
const SEGMENTS := 18
const MILESTONES := [[0.03, "stir"], [0.22, "bud"], [0.45, "flower"]]

# --- Inputs from the root (rules) ---
## How far the bloom sequence may progress right now (0 = none, ~0.3 = closed bud, 1 = fruit).
var bloom_target := 0.0
## Whether a hanging fruit may ripen right now.
var ripen_allowed := false
## Extreme temperature: a hanging fruit is damaged (recoverable if it ends in time).
var fruit_hazard := false
## The temporal field is ancient: a hanging fruit rots.
var rot_active := false
## The temporal field is too young: an unformed or hanging fruit un-grows back into the plant.
var rewind_active := false

# --- Smoothed room levels (from the environment controller) ---
var temperature_level := 2.0
var light_level := 2.0
var age_level := 1.0

# --- Biology state ---
var fruit_state: int = FruitState.NONE
var bloom := 0.0
var ripeness := 0.0
var decay := 0.0
var _drop_timer := -1.0
var _ripe_announced := false
var _last_milestone := 0.0
var _recoil := 0.0
var _time := 0.0
var _bloom_flash := 0.0

# --- Geometry cache (rebuilt every frame, used for drawing and hit-testing) ---
var _stem := PackedVector2Array()
var _stem_w := PackedFloat32Array()
var _leaves: Array[Dictionary] = []
var _branches: Array[Dictionary] = []
var _tip := Vector2.ZERO  # tip of the fruiting branch
var _fruit_pos := Vector2.ZERO
var _fruit_r := 0.0
var _bounds := Rect2()


func set_levels(t: float, l: float, a: float) -> void:
	temperature_level = t
	light_level = l
	age_level = a


func reset() -> void:
	fruit_state = FruitState.NONE
	bloom = 0.0
	ripeness = 0.0
	decay = 0.0
	_drop_timer = -1.0
	_ripe_announced = false
	_last_milestone = 0.0
	bloom_target = 0.0
	ripen_allowed = false
	fruit_hazard = false
	rot_active = false
	rewind_active = false


func has_fruit() -> bool:
	return fruit_state == FruitState.HANGING


func is_ripening() -> bool:
	return fruit_state == FruitState.HANGING and ripen_allowed and ripeness > 0.0


## Where the fruit hangs, in Stage coordinates.
func fruit_stage_position() -> Vector2:
	return position + _fruit_pos


# ---------------------------------------------------------------------------------------------
# Biology
# ---------------------------------------------------------------------------------------------

func _process(delta: float) -> void:
	_time += delta
	_recoil = maxf(0.0, _recoil - delta * 1.6)
	_bloom_flash = maxf(0.0, _bloom_flash - delta * 0.7)
	_update_biology(delta)
	_build_geometry()
	queue_redraw()


func _update_biology(dt: float) -> void:
	if fruit_state == FruitState.NONE:
		var target := 0.0 if rewind_active else bloom_target
		if bloom < target:
			bloom = minf(target, bloom + dt / BLOOM_TIME)
		elif bloom > target:
			bloom = maxf(target, bloom - dt / (BLOOM_TIME * 0.45))
		_check_milestones()
		ripeness = maxf(0.0, ripeness - dt / 1.5)
		if bloom >= 1.0:
			fruit_state = FruitState.HANGING
			decay = 0.0
			ripeness = 0.0
			_ripe_announced = false
			bloom_milestone.emit("fruit")
		return

	# A fruit is hanging.
	if rewind_active:
		# Time runs backwards for the plant: the fruit shrinks back into a flower, then a bud.
		fruit_state = FruitState.NONE
		_drop_timer = -1.0
		return
	if rot_active:
		decay += dt / ROT_TIME
	elif fruit_hazard:
		decay += dt / HAZARD_TIME
	else:
		decay = maxf(0.0, decay - dt / 6.0)
	if decay >= 1.0:
		_lose_fruit("rot" if rot_active else ("frost" if temperature_level < 2.0 else "scorch"))
		return
	if ripen_allowed and decay < 0.35:
		ripeness = minf(1.0, ripeness + dt / RIPEN_TIME)
	if ripeness >= 1.0:
		if not _ripe_announced:
			_ripe_announced = true
			_drop_timer = DROP_WOBBLE
			fruit_ripened.emit()
		elif _drop_timer > 0.0:
			_drop_timer -= dt
			if _drop_timer <= 0.0:
				var p := fruit_stage_position()
				_detach()
				fruit_dropped.emit(p)


func _check_milestones() -> void:
	for m in MILESTONES:
		var th := float(m[0])
		if bloom >= th and _last_milestone < th:
			if th <= 0.05:
				_bloom_flash = 1.0
			bloom_milestone.emit(String(m[1]))
	# Remember the furthest point reached, so wavering around a threshold doesn't spam events.
	_last_milestone = 0.0 if bloom <= 0.0 else maxf(_last_milestone, bloom)


func _lose_fruit(reason: String) -> void:
	var p := fruit_stage_position()
	_detach()
	fruit_lost.emit(p, reason)


func _detach() -> void:
	fruit_state = FruitState.NONE
	bloom = 0.0
	ripeness = 0.0
	decay = 0.0
	_drop_timer = -1.0
	_last_milestone = 0.0
	_recoil = 1.0


# ---------------------------------------------------------------------------------------------
# Reaction parameters (all continuous in the smoothed levels)
# ---------------------------------------------------------------------------------------------

func _frost() -> float:
	return U.key5(temperature_level, [1.0, 0.4, 0.0, 0.0, 0.0])


func _scorch() -> float:
	return U.key5(temperature_level, [0.0, 0.0, 0.0, 0.0, 1.0])


func _bleach() -> float:
	return U.key5(light_level, [0.0, 0.0, 0.0, 0.0, 1.0])


func _vigor() -> float:
	var tv := U.key5(temperature_level, [0.0, 0.25, 0.65, 1.0, 0.1])
	var lv := U.key5(light_level, [0.05, 0.3, 0.7, 1.0, 0.3])
	var av := U.key5(age_level, [0.6, 0.8, 1.0, 0.6, 0.0])
	return clampf(tv * lv * av + _straighten() * 0.4, 0.0, 1.0)


func _straighten() -> float:
	return smoothstep(0.0, 0.15, bloom) if fruit_state == FruitState.NONE else 1.0 - decay * 0.6


func _droop() -> float:
	var td := U.key5(temperature_level, [0.3, 0.62, 0.15, 0.0, 0.72])
	var ld := U.key5(light_level, [0.25, 0.5, 0.12, 0.0, 0.3])
	var ad := U.key5(age_level, [0.0, 0.0, 0.0, 0.18, 0.45])
	return clampf(maxf(td, ld) + ad - _straighten() * 0.5, 0.0, 1.0)


## 0 = leaves folded shut against the stem (dark), 1 = fully spread.
func _leaf_open() -> float:
	return U.key5(light_level, [0.0, 0.55, 0.88, 1.0, 0.8])


func _curl() -> float:
	var ac := U.key5(age_level, [0.0, 0.0, 0.0, 0.2, 0.65])
	return clampf(_scorch() * 0.85 + _bleach() * 0.6 + _frost() * 0.15 + ac, 0.0, 1.0)


## Positive = leans left, toward the lamp.
func _lean() -> float:
	return U.key5(light_level, [0.0, 0.08, 0.25, 0.55, 0.38])


func _sway() -> float:
	return U.key5(temperature_level, [0.0, 0.45, 1.0, 1.2, 0.7])


func _leaf_color(s: float) -> Color:
	var c := U.key5c(age_level, [Color(0.74, 0.92, 0.48), Color(0.42, 0.84, 0.42), Color(0.13, 0.64, 0.5),
			Color(0.5, 0.58, 0.26), Color(0.44, 0.31, 0.16)])
	var v := _vigor()
	c = c.lerp(Color(0.42, 0.44, 0.36), (1.0 - v) * 0.3)
	c = c.lightened(v * 0.08)
	c = c.lerp(Color(0.82, 0.92, 1.0), _frost() * 0.55)
	c = c.lerp(Color(0.4, 0.26, 0.1), _scorch() * 0.45)
	c = c.lerp(Color(0.93, 0.92, 0.74), _bleach() * 0.6)
	# Old plants yellow from the bottom up.
	c = c.lerp(Color(0.7, 0.58, 0.2), smoothstep(2.6, 3.6, age_level) * (1.0 - s) * 0.4)
	return c


func _bark_color() -> Color:
	var c := U.key5c(age_level, [Color(0.62, 0.82, 0.42), Color(0.36, 0.62, 0.32), Color(0.36, 0.3, 0.2),
			Color(0.33, 0.27, 0.22), Color(0.42, 0.39, 0.36)])
	c = c.lerp(Color(0.78, 0.86, 0.95), _frost() * 0.4)
	c = c.lerp(Color(0.14, 0.08, 0.05), _scorch() * 0.4)
	c = c.lerp(Color(0.85, 0.83, 0.72), _bleach() * 0.35)
	return c


# ---------------------------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------------------------

func _build_geometry() -> void:
	var a := age_level
	var h := U.key5(a, [40.0, 165.0, 330.0, 360.0, 330.0])
	var thick := U.key5(a, [5.0, 8.0, 16.0, 21.0, 24.0])
	var gnarl := U.key5(a, [0.0, 3.0, 8.0, 26.0, 46.0])
	var droop := _droop()
	var lean := _lean()
	var sway := _sway() * (1.0 - _frost() * 0.9)
	var hook := 1.0 - smoothstep(0.3, 1.2, a)  # germinating shoots arrive hooked

	_stem.clear()
	_stem_w.clear()
	var bow := droop * 0.55
	for i in SEGMENTS + 1:
		var s := float(i) / float(SEGMENTS)
		var x := gnarl * sin(s * 6.0 + 1.3) * s + gnarl * 0.45 * sin(s * 13.0) * s * s
		x += bow * s * s * h * 0.38
		x -= lean * s * s * h * 0.3
		x += sin(_time * 1.3 + s * 2.2) * s * 5.0 * sway
		x += hook * pow(s, 4.0) * 16.0
		var y := -h * s + bow * s * s * h * 0.2 + hook * pow(s, 4.0) * 10.0
		_stem.append(Vector2(x, y))
		_stem_w.append(maxf(1.6, thick * lerpf(1.0, 0.28, s)))

	# Leaves on the main stem.
	_leaves.clear()
	var count := U.key5(a, [1.8, 5.0, 10.0, 12.0, 3.5])
	var leaf_len := U.key5(a, [20.0, 40.0, 72.0, 70.0, 46.0]) * lerpf(0.88, 1.08, _vigor())
	var open := _leaf_open()
	var curl := _curl()
	var n := int(ceil(count))
	for i in mini(n, MAX_LEAVES):
		var presence := clampf(count - float(i), 0.0, 1.0)
		var s := lerpf(0.16, 0.94, (float(i) + 0.5) / maxf(count, 1.0))
		s = minf(s, 0.96)
		var side := 1.0 if i % 2 == 0 else -1.0
		var size := leaf_len * (0.78 + 0.3 * pow(sin(float(i) * 1.7), 2.0)) * (1.0 - 0.25 * s) * presence
		_leaves.append(_make_leaf(_stem_point(s), side, size, s, droop, open, curl, float(i)))

	# Side branches (adult plants), one of which carries the bud / flower / fruit.
	_branches.clear()
	var br := smoothstep(1.55, 2.35, a)
	var scale_h := h / 318.0
	if br > 0.01:
		var specs := [
			{"s": 0.5, "side": -1.0, "len": 130.0, "fruit": false},
			{"s": 0.62, "side": 1.0, "len": 150.0, "fruit": true},
			{"s": 0.8, "side": -1.0, "len": 95.0, "fruit": false},
			{"s": 0.36, "side": 1.0, "len": 105.0, "fruit": false},
		]
		for spec in specs:
			var bs := float(spec["s"])
			var bside := float(spec["side"])
			var blen := float(spec["len"]) * br * scale_h
			if not bool(spec["fruit"]) and bs < 0.4:
				blen *= smoothstep(2.4, 3.2, a)  # extra low branch only on old plants
			if blen < 2.0:
				continue
			var p0 := _stem_point(bs)
			var droop_k := droop * 0.8 + U.key5(a, [0, 0, 0, 0.2, 0.5])
			var up := -0.55 + droop_k * 0.9
			var p1 := p0 + Vector2(bside * blen * 0.55, blen * up * 0.7)
			var p2 := p0 + Vector2(bside * blen, blen * (up * 0.2 + 0.08 + droop_k * 0.5))
			if bool(spec["fruit"]):
				p2.y -= _recoil * sin(_time * 18.0) * 10.0
				p2.x += sin(_time * 1.1) * 3.0 * sway
			var pts := PackedVector2Array()
			var ws := PackedFloat32Array()
			for k in 9:
				var t := float(k) / 8.0
				var q := p0.lerp(p1, t).lerp(p1.lerp(p2, t), t)
				q.x += gnarl * 0.25 * sin(t * 7.0 + bs * 10.0) * t
				pts.append(q)
				ws.append(maxf(1.4, _stem_w[int(bs * SEGMENTS)] * 0.55 * lerpf(1.0, 0.35, t)))
			var b := {"pts": pts, "w": ws, "fruit": bool(spec["fruit"]), "leaves": []}
			var bleaves: Array[Dictionary] = []
			var bcount := count / 12.0 * 3.0
			for k in 3:
				var pres := clampf(bcount - float(k), 0.0, 1.0)
				if pres <= 0.0:
					continue
				var t2 := 0.45 + 0.25 * float(k)
				var lp := p0.lerp(p1, t2).lerp(p1.lerp(p2, t2), t2)
				var lside := bside if k % 2 == 0 else -bside
				bleaves.append(_make_leaf(lp, lside, leaf_len * 0.72 * pres * br, bs, droop, open, curl, float(k) + bs * 7.0))
			b["leaves"] = bleaves
			_branches.append(b)
			if bool(spec["fruit"]):
				_tip = p2

	# Bud / flower / fruit position.
	var fruit_scale := smoothstep(0.66, 1.0, bloom) if fruit_state == FruitState.NONE else 1.0
	_fruit_r = FRUIT_RADIUS * fruit_scale * (1.0 + 0.18 * ripeness) * (1.0 - 0.3 * decay)
	var hang := lerpf(0.0, 14.0 + FRUIT_RADIUS, fruit_scale)
	var wob := 0.0
	if _drop_timer > 0.0:
		wob = sin(_time * 30.0) * 4.0
	_fruit_pos = _tip + Vector2(wob, hang)

	# Bounds for click hit-testing.
	_bounds = Rect2(_stem[0], Vector2.ZERO)
	for p in _stem:
		_bounds = _bounds.expand(p)
	for b2 in _branches:
		for p in (b2["pts"] as PackedVector2Array):
			_bounds = _bounds.expand(p)
	_bounds = _bounds.grow(36.0)


func _stem_point(s: float) -> Vector2:
	var f := clampf(s, 0.0, 1.0) * float(SEGMENTS)
	var i := mini(int(floor(f)), SEGMENTS - 1)
	return _stem[i].lerp(_stem[i + 1], f - float(i))


func _make_leaf(base: Vector2, side: float, length: float, s: float, droop: float, open: float,
		curl: float, seed_f: float) -> Dictionary:
	# Angle measured from straight up, toward the leaf's side.
	var open_angle := lerpf(0.85, 2.45, droop)  # ~50° upright … ~140° hanging
	var closed_angle := 0.2  # folded up against the stem
	var ang := lerpf(closed_angle, open_angle, open)
	ang += sin(_time * 2.0 + seed_f) * 0.05 * _sway()
	ang -= _straighten() * 0.25 * open
	# Leaves facing the lamp (left) reach a little higher in bright light.
	if side < 0.0:
		ang -= _lean() * 0.3
	return {"base": base, "side": side, "len": length, "ang": ang, "open": open, "curl": curl, "s": s}


# ---------------------------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------------------------

func _draw() -> void:
	_draw_shadow()
	_draw_cage(true)
	_draw_soil()
	_draw_seed()
	_draw_plant_body(false)
	_draw_bloom()
	_draw_bowl()
	_draw_cage(false)


func _draw_shadow() -> void:
	# A sheared silhouette on the wall. Long and soft in dim light, short and hard in bright light.
	var alpha := U.key5(light_level, [0.0, 0.32, 0.22, 0.3, 0.42])
	if alpha < 0.01:
		return
	var k := U.key5(light_level, [1.2, 1.15, 0.55, 0.38, 0.3])
	var sy := U.key5(light_level, [1.3, 1.25, 1.05, 0.95, 0.92])
	draw_set_transform_matrix(Transform2D(Vector2(1, 0), Vector2(-k, sy), Vector2(30, -40)))
	_draw_plant_body(true, Color(0.02, 0.01, 0.03, alpha))
	draw_set_transform_matrix(Transform2D.IDENTITY)


func _draw_plant_body(is_shadow: bool, shadow_col := Color.BLACK) -> void:
	if _stem.size() < 2:
		return
	var bark := _bark_color()
	var outline := bark.darkened(0.55)
	if is_shadow:
		bark = shadow_col
		outline = shadow_col
	# Branches behind the stem.
	for b in _branches:
		var pts: PackedVector2Array = b["pts"]
		var ws: PackedFloat32Array = b["w"]
		if not is_shadow:
			var wo := PackedFloat32Array()
			for w in ws:
				wo.append(w + 3.0)
			U.ribbon(self, pts, wo, outline)
		U.ribbon(self, pts, ws, bark)
		# Dead twigs on ancient branches.
		if age_level > 3.2:
			var tw := clampf((age_level - 3.2) / 0.8, 0.0, 1.0)
			var end := pts[pts.size() - 1]
			var d := (end - pts[pts.size() - 3]).normalized()
			draw_line(end, end + d.rotated(0.6) * 22.0 * tw, outline if not is_shadow else shadow_col, 2.0)
			draw_line(end, end + d.rotated(-0.5) * 16.0 * tw, outline if not is_shadow else shadow_col, 1.5)
	# Main stem.
	if not is_shadow:
		var wo2 := PackedFloat32Array()
		for w in _stem_w:
			wo2.append(w + 3.5)
		U.ribbon(self, _stem, wo2, outline)
	U.ribbon(self, _stem, _stem_w, bark)
	if not is_shadow:
		# Bark texture: highlight on young stems, fissures on old ones.
		var hl := PackedVector2Array()
		for i in _stem.size():
			hl.append(_stem[i] + Vector2(-_stem_w[i] * 0.22, 0))
		draw_polyline(hl, bark.lightened(0.25 * (1.0 - smoothstep(2.5, 4.0, age_level))), maxf(1.0, _stem_w[0] * 0.15), true)
		if age_level > 2.4:
			var fk := clampf((age_level - 2.4) / 1.2, 0.0, 1.0)
			for j in 3:
				var fl := PackedVector2Array()
				for i in range(1, _stem.size() - 4):
					fl.append(_stem[i] + Vector2((float(j) - 1.0) * _stem_w[i] * 0.25 + sin(float(i) * 1.7 + float(j)) * 1.5, 0))
				draw_polyline(fl, U.with_alpha(bark.darkened(0.5), fk), 1.2, true)
			# Knots.
			for kx in [0.3, 0.58]:
				var kp := _stem_point(float(kx))
				U.ellipse(self, kp, 5.0 * fk, 7.0 * fk, bark.darkened(0.45), 10)
	# Leaves.
	for b in _branches:
		for lf in (b["leaves"] as Array):
			_draw_leaf(lf, is_shadow, shadow_col)
	for lf in _leaves:
		_draw_leaf(lf, is_shadow, shadow_col)
	# Frost rime along the stem.
	if not is_shadow and _frost() > 0.05:
		for i in range(0, _stem.size(), 2):
			draw_circle(_stem[i] + Vector2(_stem_w[i] * 0.3, 0), _stem_w[i] * 0.25, Color(0.92, 0.97, 1.0, 0.7 * _frost()))


func _draw_leaf(lf: Dictionary, is_shadow: bool, shadow_col: Color) -> void:
	var length := float(lf["len"])
	if length < 1.5:
		return
	var base: Vector2 = lf["base"]
	var side := float(lf["side"])
	var ang := float(lf["ang"])
	var open := float(lf["open"])
	var curl := float(lf["curl"])
	var s := float(lf["s"])
	var width := length * 0.42 * lerpf(0.22, 1.0, open) * (1.0 - curl * 0.35)
	var steps := 8
	var mid := PackedVector2Array()
	var left := PackedVector2Array()
	var right := PackedVector2Array()
	var dirv := Vector2(side * sin(ang), -cos(ang))
	var p := base
	var seg := length / float(steps)
	for k in steps + 1:
		var u := float(k) / float(steps)
		mid.append(p)
		var nrm := dirv.orthogonal()
		var wprof := pow(sin(PI * clampf(u * 0.95 + 0.03, 0.0, 1.0)), 0.8) * (1.0 - 0.25 * u) * width
		left.append(p + nrm * wprof)
		right.append(p - nrm * wprof * 0.85)
		# Curl bends the tip back under itself; droop sags the tip.
		dirv = dirv.rotated(side * curl * 0.28 + side * 0.04)
		p += dirv * seg
	var base_col := _leaf_color(s)
	var tip_col := base_col
	var scorch := _scorch()
	if scorch > 0.01:
		tip_col = base_col.lerp(Color(0.22, 0.1, 0.03), scorch * 0.85)
	var dark := base_col.darkened(0.3)
	if is_shadow:
		base_col = shadow_col
		tip_col = shadow_col
		dark = shadow_col
	else:
		# Bold outline.
		for k in steps:
			U.quad(self, left[k] + (left[k] - mid[k]).normalized() * 1.6, left[k + 1] + (left[k + 1] - mid[k + 1]).normalized() * 1.6,
					right[k + 1] + (right[k + 1] - mid[k + 1]).normalized() * 1.6, right[k] + (right[k] - mid[k]).normalized() * 1.6,
					base_col.darkened(0.6))
	for k in steps:
		var u0 := float(k) / float(steps)
		var u1 := float(k + 1) / float(steps)
		var c0 := base_col.lerp(tip_col, smoothstep(0.35, 1.0, u0))
		var c1 := base_col.lerp(tip_col, smoothstep(0.35, 1.0, u1))
		U.quad4(self, mid[k], left[k], left[k + 1], mid[k + 1], c0, c0, c1, c1)
		var d0 := dark.lerp(tip_col.darkened(0.3), smoothstep(0.35, 1.0, u0))
		var d1 := dark.lerp(tip_col.darkened(0.3), smoothstep(0.35, 1.0, u1))
		U.quad4(self, mid[k], right[k], right[k + 1], mid[k + 1], d0, d0, d1, d1)
	if not is_shadow:
		draw_polyline(mid, base_col.lightened(0.35), maxf(1.0, length * 0.03), true)
		var fr := _frost()
		if fr > 0.05:
			draw_polyline(left, Color(0.95, 0.98, 1.0, 0.8 * fr), 2.0, true)
		var bl := _bleach()
		if bl > 0.05:
			draw_polyline(left, Color(1.0, 1.0, 0.9, 0.5 * bl), 1.5, true)


func _draw_seed() -> void:
	var vis := 1.0 - smoothstep(0.7, 1.5, age_level)
	if vis <= 0.01:
		return
	var c := Color(0.55, 0.36, 0.2).lerp(Color(0.85, 0.92, 1.0), _frost() * 0.4)
	# Split seed coat half-buried in the soil, the shoot emerging from it.
	U.radial(self, Vector2(-6, -6), 70.0 * vis, Color(0.9, 1.0, 0.7, 0.12 * vis), U.CLEAR, 20)
	U.ellipse(self, Vector2(-6, -2), 32.0 * vis, 19.0 * vis, c.darkened(0.55), 20)
	U.ellipse(self, Vector2(-6, -3), 29.0 * vis, 16.0 * vis, c, 20)
	draw_line(Vector2(-26, -6) * vis, Vector2(12, -10) * vis, c.darkened(0.45), 2.0)
	draw_circle(Vector2(-14, -8) * vis, 4.5 * vis, Color(1, 1, 1, 0.25))


func _draw_bloom() -> void:
	if _branches.is_empty():
		return
	var tip := _tip
	var b := bloom if fruit_state == FruitState.NONE else 1.0
	var bud := smoothstep(0.12, 0.32, b)
	var open := smoothstep(0.36, 0.62, b)
	var wither := smoothstep(0.64, 0.82, b)
	var frost := _frost()
	var scorch := _scorch()
	if _bloom_flash > 0.01:
		U.radial(self, tip, 70.0, Color(1.0, 0.95, 0.7, 0.35 * _bloom_flash), U.CLEAR, 20)
	# Fruit (drawn first so the dying petals sit over it as it emerges).
	if _fruit_r > 0.5:
		draw_line(tip, _fruit_pos + Vector2(0, -_fruit_r), _bark_color().darkened(0.3), 3.0)
		var glow := smoothstep(0.7, 1.0, ripeness) * (1.0 - decay)
		U.draw_fruit(self, _fruit_pos, _fruit_r, ripeness, decay, frost, scorch, sin(_time * 1.2) * 0.05, glow)
	# Petals: a closed green bud that opens into a violet star, then falls away.
	if bud > 0.01 and wither < 0.999:
		var petals := 7
		for k in petals:
			var kc := float(k) - 3.0
			var a_closed := -PI * 0.5 + kc * 0.13
			var a_open := -PI * 0.5 + kc * TAU / float(petals)
			var a := lerpf(a_closed, a_open, open)
			a += wither * 0.9 * signf(kc + 0.01)  # petals drop as they wither
			var plen := lerpf(22.0, 62.0, open) * bud * (1.0 - wither * 0.6)
			var pw := lerpf(7.0, 19.0, open) * bud
			var dirv := Vector2(cos(a), sin(a))
			var nrm := dirv.orthogonal()
			var pc := Color(0.3, 0.58, 0.3).lerp(Color(0.62, 0.26, 0.78), open)
			pc = pc.lerp(Color(0.85, 0.9, 1.0), frost * 0.5).lerp(Color(0.25, 0.12, 0.06), scorch * 0.6)
			pc = U.with_alpha(pc, 1.0 - wither)
			var p0 := tip
			var p1 := tip + dirv * plen * 0.45 + nrm * pw
			var p2 := tip + dirv * plen
			var p3 := tip + dirv * plen * 0.45 - nrm * pw
			U.quad(self, p0, p1, p2, p3, pc.darkened(0.15))
			U.tri(self, p0, p1, p2, pc.lightened(0.12))
		# Sepals.
		for k in 3:
			var a2 := PI * 0.5 + (float(k) - 1.0) * 0.8
			U.tri(self, tip + Vector2(-5, 0), tip + Vector2(5, 0), tip + Vector2(cos(a2), sin(a2)) * 16.0 * bud,
					Color(0.2, 0.42, 0.18))
		# Golden heart of the open flower.
		if open > 0.05:
			var gc := Color(1.0, 0.82, 0.3, open * (1.0 - wither))
			draw_circle(tip, 10.0 * open, gc)
			for k in 6:
				var a3 := float(k) * TAU / 6.0 + _time * 0.5
				draw_circle(tip + Vector2(cos(a3), sin(a3)) * 13.0 * open, 2.4, gc.lightened(0.3))


func _draw_soil() -> void:
	U.ellipse(self, Vector2(0, 2), 168.0, 22.0, Color(0.1, 0.07, 0.05), 40)
	U.ellipse(self, Vector2(0, 4), 160.0, 17.0, Color(0.2, 0.13, 0.09).lerp(Color(0.8, 0.88, 0.95), _frost() * 0.6), 40)
	if _scorch() > 0.05:
		for k in 9:
			var x := -130.0 + float(k) * 32.0
			draw_line(Vector2(x, 0), Vector2(x + 12, 6), Color(0.05, 0.03, 0.02, _scorch()), 2.0)


func _draw_bowl() -> void:
	var tarnish := smoothstep(1.5, 4.0, age_level)
	var brass := Color(0.84, 0.64, 0.3).lerp(Color(0.5, 0.42, 0.26), tarnish)
	var dark := brass.darkened(0.5)
	# Pedestal.
	U.quad(self, Vector2(-44, 100), Vector2(44, 100), Vector2(30, 152), Vector2(-30, 152), dark)
	U.quad(self, Vector2(-38, 100), Vector2(22, 100), Vector2(14, 152), Vector2(-24, 152), brass.darkened(0.2))
	U.quad(self, Vector2(-96, 152), Vector2(96, 152), Vector2(116, 176), Vector2(-116, 176), dark)
	U.quad(self, Vector2(-90, 154), Vector2(70, 154), Vector2(86, 172), Vector2(-108, 172), brass.darkened(0.1))
	# Bowl body: lower half-ellipse.
	var body := PackedVector2Array()
	for i in 25:
		var a := PI * float(i) / 24.0
		body.append(Vector2(cos(a) * 178.0, sin(a) * 118.0))
	draw_colored_polygon(body, dark)
	var face := PackedVector2Array()
	for i in 25:
		var a := PI * float(i) / 24.0
		face.append(Vector2(cos(a) * 170.0, sin(a) * 110.0 + 2.0))
	draw_colored_polygon(face, brass)
	# Shading bands and an engraved triangle frieze (polarity: up / down).
	var shade := PackedVector2Array()
	for i in 13:
		var a := PI * float(i) / 24.0
		shade.append(Vector2(cos(a) * 170.0, sin(a) * 110.0 + 2.0))
	shade.append(Vector2(0, 2))
	draw_colored_polygon(shade, Color(0, 0, 0, 0.18))
	for k in 11:
		var x := -125.0 + float(k) * 25.0
		var y := 34.0
		var up := k % 2 == 0
		var c := dark.lerp(brass, 0.3)
		if up:
			draw_polyline(PackedVector2Array([Vector2(x - 9, y + 8), Vector2(x + 9, y + 8), Vector2(x, y - 8), Vector2(x - 9, y + 8)]), c, 2.0)
		else:
			draw_polyline(PackedVector2Array([Vector2(x - 9, y - 8), Vector2(x + 9, y - 8), Vector2(x, y + 8), Vector2(x - 9, y - 8)]), c, 2.0)
	draw_line(Vector2(-150, 16), Vector2(150, 16), brass.lightened(0.3), 2.0)
	draw_line(Vector2(-140, 54), Vector2(140, 54), dark, 2.0)
	# Rim.
	draw_arc(Vector2(0, 0), 176.0, 0.0, PI, 40, dark, 10.0, true)
	draw_arc(Vector2(0, -2), 174.0, 0.05, PI - 0.05, 40, brass.lightened(0.25), 3.0, true)
	draw_line(Vector2(-182, 0), Vector2(182, 0), brass.lightened(0.15), 6.0)
	# Tarnish and verdigris.
	if tarnish > 0.3:
		for k in 8:
			var p := Vector2(-140.0 + float(k) * 40.0, 70.0 + sin(float(k) * 2.3) * 22.0)
			U.ellipse(self, p, 12.0, 7.0, Color(0.3, 0.55, 0.45, 0.6 * (tarnish - 0.3)), 12)
	var fr := _frost()
	if fr > 0.01:
		draw_line(Vector2(-182, -3), Vector2(182, -3), Color(0.92, 0.97, 1.0, 0.85 * fr), 6.0)
		for k in 9:
			var x2 := -150.0 + float(k) * 37.0
			U.tri(self, Vector2(x2 - 4, 4), Vector2(x2 + 4, 4), Vector2(x2, 4 + 14.0 * fr), Color(0.88, 0.95, 1.0, 0.8 * fr))


func _draw_cage(back: bool) -> void:
	var tarnish := smoothstep(1.5, 4.0, age_level)
	var brass := Color(0.84, 0.64, 0.3).lerp(Color(0.5, 0.42, 0.26), tarnish)
	var apex := Vector2(0, -505)
	var xs := [-150.0, -60.0, 60.0, 150.0] if back else [-172.0, 0.0, 172.0]
	var w := 5.0 if back else 3.5
	var col := brass.darkened(0.35) if back else U.with_alpha(brass, 0.9)
	for x in xs:
		var x0 := float(x)
		var start := Vector2(x0, -10.0 if back else 6.0)
		var ctrl := Vector2(x0 * 1.15, -360)
		var pts := PackedVector2Array()
		for k in 17:
			var t := float(k) / 16.0
			pts.append(start.lerp(ctrl, t).lerp(ctrl.lerp(apex, t), t))
		draw_polyline(pts, col, w, true)
	# Horizontal hoops: back halves behind the plant, front halves in front.
	for hoop in [[-200.0, 168.0, 16.0], [-370.0, 120.0, 11.0]]:
		var hy := float(hoop[0])
		var hr := float(hoop[1])
		var hry := float(hoop[2])
		if back:
			draw_arc(Vector2(0, hy), hr, PI, TAU, 28, col, w, true)
		else:
			var pts2 := PackedVector2Array()
			for k in 29:
				var a := PI * float(k) / 28.0
				pts2.append(Vector2(cos(a) * hr, hy + sin(a) * hry))
			draw_polyline(pts2, col, w, true)
	if not back:
		draw_circle(apex, 10.0, brass)
		draw_line(apex, apex + Vector2(0, -22), brass, 3.0)
		draw_circle(apex + Vector2(-3, -3), 3.0, Color(1, 1, 1, 0.35))


# ---------------------------------------------------------------------------------------------
# Input: clicking the plant or its fruit to look closer
# ---------------------------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventMouseButton):
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	var p := get_local_mouse_position()
	if _fruit_r > 4.0 and p.distance_to(_fruit_pos) < _fruit_r + 14.0:
		inspected.emit("fruit")
		get_viewport().set_input_as_handled()
	elif _bounds.has_point(p) or Rect2(-180, -30, 360, 60).has_point(p):
		inspected.emit("plant")
		get_viewport().set_input_as_handled()
