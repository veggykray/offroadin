extends Node2D

const AqDraw = preload("AqDraw.gd")
## The giant clam on the aquarium floor holding the glowing memory.
##
## Three physical problems, solved by three creatures:
##  1. It starts tucked under a rock overhang ("ShellCover" zone). Only something
##     heavy (the Blimp) can push it out. It slides along the floor only.
##  2. A tough knotted growth binds it shut. Bites wear it down (Bastards).
##  3. It is still shut tight. A fast, hard impact cracks it (Coward).
##
## The shell can always be pushed back and forth, never gets stuck against a
## wall (x is clamped to keep room for the Blimp on both sides) and never
## un-progresses (restraint / cracks persist).

signal restraint_damaged(hp: float)
signal restraint_broken
signal cracked(amount: float)
signal opened
signal pushed(dx: float)

@export_group("Body")
@export var body_radius := 70.0
@export var body_mass := 14.0
## Creatures lighter than this cannot shove the shell at all (it acts like a rock to them).
@export var push_mass_threshold := 6.0
## Sliding friction on the sand (per second). Higher = shorter slides.
@export var floor_friction := 4.0
## Shell centre sits this far above the floor line (it is half sunk in sand).
@export var sink_depth := 55.0

@export_group("Puzzle tuning")
## Restraint toughness. Each Bastard bite removes bite damage (see BastardSwarm).
@export var restraint_max_hp := 100.0
## Shell toughness. A direct full-speed Coward hit does ~110.
@export var crack_max_hp := 100.0
## Impacts slower than this (px/s) do nothing to the shell.
@export var min_crack_speed := 260.0
## Fraction of the shell's width that must be out from under the cover.
@export var exposed_fraction := 0.8

var activity: Node
var velocity := Vector2.ZERO
var body_enabled := true
var floor_locked := true
var collision_group := ""

var restraint_hp := 100.0
var crack_hp := 100.0
var is_open := false
var open_amount := 0.0
var exposed_flag := false
var wobble := 0.0
var wobble_vel := 0.0
var crack_lines: Array = []    # [PackedVector2Array]
var restraint_bits: Array = [] # cosmetic knots that fall off
var _t := 0.0
var _scrape_cooldown := 0.0
var _hit_cooldown := 0.0
var _last_x := 0.0
var _shimmer := 0.0
var _rope_shake := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity


func reset_shell(pos: Vector2) -> void:
	position = Vector2(pos.x, activity.get_floor_y() - sink_depth)
	velocity = Vector2.ZERO
	restraint_hp = restraint_max_hp
	crack_hp = crack_max_hp
	is_open = false
	open_amount = 0.0
	exposed_flag = false
	crack_lines.clear()
	_last_x = position.x
	restraint_bits.clear()
	for i in 9:
		restraint_bits.append({"a": float(i) / 9.0, "alive": true})


func tick(delta: float) -> void:
	_t += delta
	_scrape_cooldown -= delta
	_hit_cooldown -= delta
	_shimmer = move_toward(_shimmer, 0.0, delta)
	_rope_shake = move_toward(_rope_shake, 0.0, delta * 3.0)
	velocity.y = 0.0
	velocity.x *= exp(-floor_friction * delta)
	position += velocity * delta
	position.y = activity.get_floor_y() - sink_depth
	# Keep room for the Blimp on both sides so the puzzle can never jam.
	var min_x: float = activity.aquarium_bounds.position.x + 2.0 * activity.blimp.body_radius + body_radius + 30.0
	var max_x: float = activity.chute.position.x - 2.0 * activity.blimp.body_radius - body_radius - 40.0
	if position.x < min_x:
		position.x = min_x
		velocity.x = maxf(0.0, velocity.x)
	elif position.x > max_x:
		position.x = max_x
		velocity.x = minf(0.0, velocity.x)
	var dx := position.x - _last_x
	_last_x = position.x
	if absf(dx) > 0.15:
		wobble_vel += dx * 0.012
		if _scrape_cooldown <= 0.0:
			_scrape_cooldown = 0.45
			activity.audio.play("shell_move", -8.0, randf_range(0.85, 1.1))
			activity.water_fx.spawn_sand(position + Vector2(-signf(dx) * body_radius * 0.8, sink_depth - 6), 5)
		pushed.emit(dx)
	wobble_vel += -wobble * 60.0 * delta
	wobble_vel *= exp(-5.0 * delta)
	wobble += wobble_vel * delta
	wobble = clampf(wobble, -0.25, 0.25)
	if is_open:
		open_amount = move_toward(open_amount, 1.0, delta * 1.4)
	exposed_flag = is_exposed()
	queue_redraw()


# ------------------------------------------------------------- physics hooks

func inv_mass_for(other) -> float:
	if other is Dictionary:
		return 1.0 / body_mass
	var m = other.get("body_mass")
	if m == null or float(m) < push_mass_threshold:
		return 0.0   # immovable for small fry
	# A heavy creature only shoves the shell when it is going somewhere on
	# purpose (e.g. the Blimp following a tap) - never while idly wandering,
	# so the puzzle cannot quietly undo itself.
	if other.has_method("is_pushing_purposefully") and not other.is_pushing_purposefully():
		return 0.0
	# Hint demonstrations may nudge the shell, but never finish the job for the player.
	if other.has_method("is_natural_push") and other.is_natural_push() and exposed_amount() > 0.4 \
			and other.position.x < position.x:
		return 0.0
	return 1.0 / body_mass


func on_body_collision(other, normal: Vector2, rel_speed: float) -> void:
	if other is Dictionary:
		return
	if other == activity.coward and rel_speed > 120.0:
		on_coward_hit(rel_speed, -normal)
	elif other == activity.idiot and rel_speed > 200.0:
		wobble_vel += 0.6 * signf(normal.x)
		activity.audio.play("shell_crack", -14.0, 1.4)


## Called when the Coward slams into the shell.
func on_coward_hit(speed: float, _dir: Vector2) -> void:
	if _hit_cooldown > 0.0:
		return
	_hit_cooldown = 0.35
	wobble_vel += 1.2 * (1.0 if randf() > 0.5 else -1.0)
	activity.camera_impulse(0.18, 0.2)
	if not is_exposed() and restraint_hp > 0.0:
		activity.audio.play("coward_impact", -4.0, 0.8)
		activity.hints.record_failed("coward_hit_covered")
		return
	if restraint_hp > 0.0:
		# The springy growth absorbs it: BOING.
		_rope_shake = 1.0
		activity.audio.play("coward_impact", -2.0, 1.3)
		activity.water_fx.burst(position + Vector2(0, -body_radius * 0.6), Color(0.4, 0.6, 0.2), 6)
		activity.hints.record_failed("coward_hit_restraint")
		return
	if is_open or speed < min_crack_speed:
		activity.audio.play("coward_impact", -6.0, 1.1)
		return
	var dmg := clampf((speed - min_crack_speed) / 700.0, 0.12, 1.2) * crack_max_hp
	if activity.coward.get("_bolt_natural") == true:
		dmg = minf(dmg, maxf(0.0, crack_hp - 30.0))   # a hint may crack it, never open it
	crack_hp -= dmg
	activity.audio.play("shell_crack", 0.0, randf_range(0.9, 1.05))
	activity.audio.play("coward_impact", 0.0)
	activity.water_fx.burst(position + Vector2(0, -body_radius * 0.5), Color(0.95, 0.85, 0.9), 14)
	activity.glass_fx.add_ripple(position, 0.4, 260.0)
	activity.camera_impulse(0.3, 0.25)
	_add_crack(dmg / crack_max_hp)
	cracked.emit(dmg)
	activity.hints.notify_progress("shell_cracked", false)
	if crack_hp <= 0.0:
		force_open()


func force_open() -> void:
	if is_open:
		return
	restraint_hp = 0.0
	is_open = true
	crack_hp = 0.0
	_shimmer = 1.5
	activity.water_fx.burst(position + Vector2(0, -body_radius * 0.4), Color(1.0, 0.9, 0.5), 30)
	activity.water_fx.spawn_bubbles(position + Vector2(0, -body_radius * 0.5), 20, 1.0)
	opened.emit()


# ------------------------------------------------------------- bite target (restraint)

func can_be_bitten() -> bool:
	return restraint_hp > 0.0 and is_exposed()


func bite_priority() -> float:
	return 5.0


func bite_point() -> Vector2:
	return position + Vector2(randf_range(-0.45, 0.45) * body_radius, -body_radius * 0.55)


func take_bite(_from, amount: float) -> bool:
	if not can_be_bitten():
		return false
	var before := restraint_hp
	restraint_hp = maxf(0.0, restraint_hp - amount)
	_rope_shake = 0.6
	activity.water_fx.spawn_fragments(bite_point(), Color(0.32, 0.45, 0.18), 2)
	var alive := ceili(restraint_hp / restraint_max_hp * restraint_bits.size())
	for i in restraint_bits.size():
		if i >= alive and restraint_bits[i].alive:
			restraint_bits[i].alive = false
			activity.water_fx.spawn_fragments(position + Vector2(lerpf(-body_radius, body_radius, restraint_bits[i].a), -body_radius * 0.5), Color(0.3, 0.42, 0.16), 5)
	restraint_damaged.emit(restraint_hp)
	for thr in [75.0, 50.0, 25.0]:
		if before > thr and restraint_hp <= thr:
			activity.hints.notify_progress("restraint_damaged", false)
	if restraint_hp <= 0.0:
		activity.audio.play("rope_snap", 2.0)
		activity.camera_impulse(0.12, 0.15)
		activity.water_fx.spawn_fragments(position + Vector2(0, -body_radius * 0.5), Color(0.32, 0.45, 0.18), 24)
		wobble_vel += 1.0
		restraint_broken.emit()
	return true


# ------------------------------------------------------------- queries

## How far (px) the shell has been pushed out from under the cover.
func exposure_progress() -> float:
	var cover: Rect2 = activity.get_shell_cover_rect()
	if cover.size == Vector2.ZERO:
		return 9999.0
	# The cover's open side is assumed to be on the right (towards the open floor).
	return position.x - cover.position.x


func exposed_amount() -> float:
	var cover: Rect2 = activity.get_shell_cover_rect()
	if cover.size == Vector2.ZERO:
		return 1.0
	var left := position.x - body_radius
	var right := position.x + body_radius
	var overlap := maxf(0.0, minf(right, cover.end.x) - maxf(left, cover.position.x))
	return 1.0 - overlap / (2.0 * body_radius)


func is_exposed() -> bool:
	return exposed_amount() >= exposed_fraction


func on_exposed() -> void:
	_shimmer = 1.2
	activity.water_fx.burst(position + Vector2(0, -body_radius * 0.3), Color(1.0, 0.95, 0.6), 10)


func memory_anchor() -> Vector2:
	return position + Vector2(0, -body_radius * 0.2 - open_amount * 46.0)


func debug_expose() -> void:
	var cover: Rect2 = activity.get_shell_cover_rect()
	position.x = cover.end.x + body_radius + 30.0
	_last_x = position.x


func debug_break_restraint() -> void:
	if restraint_hp > 0.0:
		restraint_hp = 0.0001
		take_bite(null, 1.0)
		if restraint_hp > 0.0:
			restraint_hp = 0.0
			restraint_broken.emit()


func _add_crack(severity: float) -> void:
	var n := 1 + int(severity * 3.0)
	for i in n:
		var pts := PackedVector2Array()
		var p := Vector2(randf_range(-0.6, 0.6) * body_radius, -body_radius * randf_range(0.35, 0.75))
		var dir := Vector2(randf_range(-1, 1), randf_range(0.3, 1.0)).normalized()
		pts.append(p)
		for k in 4:
			dir = dir.rotated(randf_range(-0.7, 0.7))
			p += dir * randf_range(8, 18) * (0.7 + severity)
			pts.append(p)
		crack_lines.append(pts)


# ------------------------------------------------------------- drawing

func _draw() -> void:
	var r := body_radius
	var t := Transform2D(wobble, Vector2.ZERO)
	draw_set_transform_matrix(t)
	var covered := not exposed_flag
	# Glow of the memory leaking out (seen through the lips of the shell).
	var glow_a := 0.25 + 0.12 * sin(_t * 2.3) + _shimmer * 0.3
	for i in 5:
		draw_circle(Vector2(0, -r * 0.2), r * (0.6 + i * 0.25), Color(1.0, 0.85, 0.45, glow_a * (0.18 - i * 0.03)))
	# Bottom valve (bowl).
	var bowl := PackedVector2Array()
	for i in 25:
		var a := PI * float(i) / 24.0
		bowl.append(Vector2(cos(a) * r * 1.12, sin(a) * r * 0.62 - r * 0.15))
	AqDraw.poly(self, bowl, Color(0.55, 0.42, 0.52))
	for i in 7:
		var a2 := PI * (float(i) + 0.5) / 7.0
		draw_line(Vector2(0, -r * 0.1), Vector2(cos(a2) * r * 1.05, sin(a2) * r * 0.55 - r * 0.15), Color(0.42, 0.3, 0.4), 3.0)
	# The memory inside, visible through the gap.
	var gap := 6.0 + open_amount * 10.0
	draw_rect(Rect2(-r * 0.85, -r * 0.22 - gap * 0.5, r * 1.7, gap), Color(1.0, 0.92, 0.55, 0.9))
	# Top valve (dome), hinged at the back-left; opens upward.
	var hinge := Vector2(-r * 1.0, -r * 0.18)
	var open_ang := -open_amount * 1.05
	var dome_xf := Transform2D(open_ang, hinge) * Transform2D(0, -hinge)
	var dome := PackedVector2Array()
	for i in 25:
		var a3 := PI + PI * float(i) / 24.0
		dome.append(dome_xf * Vector2(cos(a3) * r * 1.15, sin(a3) * r * 0.95 - r * 0.2))
	var dome_col := Color(0.82, 0.62, 0.72).lerp(Color(0.95, 0.8, 0.85), 0.2 + 0.1 * sin(_t * 0.7))
	AqDraw.poly(self, dome, dome_col)
	# Ridges.
	for i in 9:
		var a4 := PI + PI * (float(i) + 0.5) / 9.0
		var p0 := dome_xf * Vector2(0, -r * 0.2)
		var p1 := dome_xf * Vector2(cos(a4) * r * 1.1, sin(a4) * r * 0.9 - r * 0.2)
		draw_line(p0.lerp(p1, 0.15), p1, Color(0.62, 0.42, 0.55), 4.0)
	# Pearly highlight.
	draw_arc(dome_xf * Vector2(-r * 0.15, -r * 0.55), r * 0.55, PI * 1.15, PI * 1.6, 12, Color(1, 1, 1, 0.35), 5.0)
	draw_polyline(dome, Color(0.35, 0.2, 0.3), 3.0)
	draw_polyline(bowl, Color(0.3, 0.18, 0.26), 3.0)
	# Barnacles.
	for b in [Vector2(-0.6, -0.5), Vector2(0.45, -0.7), Vector2(0.75, -0.35), Vector2(-0.2, -0.85)]:
		var bp := dome_xf * Vector2(b.x * r, b.y * r - r * 0.2)
		draw_circle(bp, 7, Color(0.75, 0.75, 0.68))
		draw_circle(bp, 3, Color(0.3, 0.3, 0.28))
	# Cracks.
	for c in crack_lines:
		var cp := PackedVector2Array()
		for p in c:
			cp.append(dome_xf * p)
		draw_polyline(cp, Color(0.12, 0.05, 0.08), 3.0)
		draw_polyline(cp, Color(1.0, 0.9, 0.6, 0.6), 1.0)
	# Restraint: thick knotted growth strapping the shell shut.
	if restraint_hp > 0.0:
		var shake := Vector2(sin(_t * 50.0), cos(_t * 43.0)) * 3.0 * _rope_shake
		var frac := restraint_hp / restraint_max_hp
		var thick := 7.0 + 8.0 * frac
		for band in [-0.42, 0.38]:
			var pts := PackedVector2Array()
			for i in 13:
				var y := lerpf(-r * 1.05, r * 0.42, float(i) / 12.0)
				var x = band * r + sin(float(i) * 1.7 + _t * 0.8) * 4.0
				pts.append(Vector2(x, y) + shake)
			draw_polyline(pts, Color(0.18, 0.26, 0.1), thick + 4.0)
			draw_polyline(pts, Color(0.32, 0.46, 0.18), thick)
		var belt := PackedVector2Array()
		for i in 17:
			var a5 := PI + PI * float(i) / 16.0
			belt.append(Vector2(cos(a5) * r * 1.0, sin(a5) * r * 0.45 - r * 0.25) + shake)
		draw_polyline(belt, Color(0.18, 0.26, 0.1), thick + 4.0)
		draw_polyline(belt, Color(0.36, 0.5, 0.2), thick)
		for kb in restraint_bits:
			if kb.alive:
				var kp := belt[int(kb.a * (belt.size() - 1))]
				draw_circle(kp, thick * 0.9, Color(0.28, 0.38, 0.14))
				draw_circle(kp + Vector2(-2, -2), thick * 0.35, Color(0.5, 0.65, 0.3))
	# Shadow when tucked under the overhang.
	if covered:
		draw_set_transform_matrix(Transform2D.IDENTITY)
		draw_rect(Rect2(-r * 1.3, -r * 1.25, r * 2.6, r * 1.9), Color(0.0, 0.02, 0.05, 0.35))
	draw_set_transform_matrix(Transform2D.IDENTITY)
