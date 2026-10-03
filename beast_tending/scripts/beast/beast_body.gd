class_name BeastBody
extends Node2D
## The whole near body of the beast. Breathes (the entire hide rises and
## falls), heaves, shivers, shifts away, thumps distant limbs, and turns the
## creature's judgement of each touch into a physical, audible reaction.

signal thumped(strength: float)

@export_group("Breathing")
@export var breath_rate_calm := 0.15     ## Hz
@export var breath_rate_excited := 0.7
@export var breath_depth_calm := 1.0
@export var breath_depth_excited := 2.6

@export_group("Thumps")
## Escalation above which a distant limb starts thumping.
@export var thump_threshold := 0.5
@export var thump_interval_slow := 3.2
@export var thump_interval_fast := 0.38

var breath := 0.0           ## -1..1
var breath_phase := 0.0
var breath_depth := 1.0
var exhaling := false
var heave_offset := Vector2.ZERO
var heave_v := Vector2.ZERO
var heave_rot := 0.0
var heave_rot_v := 0.0
var shiver := 0.0
var t := 0.0
var thump_timer := 3.0
var idle_shift_timer := 30.0
var _cool := {}
var _last_exhale := false


func _ready() -> void:
	Game.body = self


func _process(delta: float) -> void:
	t += delta
	var e := Game.escalation()
	var mood: int = Game.mind.mood if Game.mind else 0
	var rate := lerpf(breath_rate_calm, breath_rate_excited, e)
	if mood == BeastMind.Mood.IRRITATED:
		rate *= 1.4
	elif mood == BeastMind.Mood.SPENT:
		rate *= 0.6
	elif mood == BeastMind.Mood.ANTICIPATING:
		rate *= 1.6  # quick, shallow, expectant
	breath_depth = Game.damp(breath_depth, lerpf(breath_depth_calm, breath_depth_excited, e), 1.0, delta)
	breath_phase += TAU * rate * delta
	breath = sin(breath_phase)
	exhaling = cos(breath_phase) < 0.0
	if exhaling and not _last_exhale and Game.screen_fx:
		Game.screen_fx.exhale(breath_depth * 0.35 + e * 0.4)
	_last_exhale = exhaling

	# Rhythmic rocking once worked up.
	var rock := Vector2.ZERO
	if e > 0.42:
		var k := (e - 0.42) / 0.58
		var hz := lerpf(0.5, 1.6, k)
		rock = Vector2(sin(t * TAU * hz * 0.5) * 10.0 * k, sin(t * TAU * hz) * 9.0 * k)

	heave_v += (-heave_offset * 18.0 - heave_v * 4.0) * delta
	heave_offset += heave_v * delta
	heave_rot_v += (-heave_rot * 14.0 - heave_rot_v * 3.5) * delta
	heave_rot += heave_rot_v * delta
	shiver = maxf(shiver - delta * 1.6, 0.0)
	var shiver_off := Vector2(sin(t * 71.0), cos(t * 63.0)) * shiver * 3.5

	var cx := Game.camera_x()
	var pivot := Vector2(cx, 1100.0)
	var s := 1.0 + breath * 0.0055 * breath_depth
	scale = Vector2(s, s)
	rotation = heave_rot
	position = pivot - (pivot * s).rotated(heave_rot) + Vector2(0, breath * 6.0 * breath_depth) + heave_offset + rock + shiver_off

	_update_thumps(delta, e)
	_update_idle_shift(delta)


## Every so often the beast simply resettles its enormous bulk.
func _update_idle_shift(delta: float) -> void:
	var seq := Game.sequence
	if seq == null or seq.stage < TendingSequence.Stage.TRUST or seq.stage > TendingSequence.Stage.FINISH:
		return
	idle_shift_timer -= delta
	if idle_shift_timer > 0.0:
		return
	idle_shift_timer = randf_range(24.0, 48.0)
	var side := -1.0 if randf() < 0.5 else 1.0
	impulse(Vector2(side * randf_range(70, 140), randf_range(-70, -30)), side * randf_range(0.004, 0.01))
	if Game.voice:
		Game.voice.play_offscreen(&"creak", side, -10.0, randf_range(0.6, 0.8))
		Game.voice.play_offscreen(&"rumble", -side, -8.0, randf_range(0.8, 0.95))
	if Game.camera:
		Game.camera.sway(0.4)
	if Game.decor:
		Game.decor.bounce(120.0)


func _update_thumps(delta: float, e: float) -> void:
	if e < thump_threshold:
		thump_timer = maxf(thump_timer, 1.0)
		return
	thump_timer -= delta
	if thump_timer <= 0.0:
		var k := clampf((e - thump_threshold) / (1.0 - thump_threshold), 0.0, 1.0)
		thump_timer = lerpf(thump_interval_slow, thump_interval_fast, k * k) * randf_range(0.85, 1.15)
		thump(lerpf(0.5, 1.2, k))


## Something enormous hits the ground somewhere out of frame.
func thump(strength: float) -> void:
	heave_v.y += 120.0 * strength
	if Game.voice:
		Game.voice.play_offscreen(&"thump", 1.0 if randf() < 0.6 else -1.0, lerpf(-6.0, 2.0, clampf(strength, 0.0, 1.0)), randf_range(0.9, 1.1))
	if Game.camera:
		Game.camera.bump(Vector2(0, 14.0 * strength))
	if Game.decor:
		Game.decor.bounce(260.0 * strength)
	if Game.screen_fx:
		Game.screen_fx.dust_burst(0.4 * strength)
	if Game.bill:
		Game.bill.brace(strength)
	for r in Game.regions.values():
		if absf(r.global_position.x - Game.camera_x()) < 1600.0:
			r.body_jolt(strength * 0.6)
	thumped.emit(strength)


func impulse(v: Vector2, rot: float = 0.0) -> void:
	heave_v += v
	heave_rot_v += rot


func _ready_cd(key: StringName, seconds: float) -> bool:
	var now := t
	if _cool.get(key, -100.0) > now:
		return false
	_cool[key] = now + seconds
	return true


# --- Reaction presentation -------------------------------------------------------

## Make the whole creature physically answer one judged touch.
func present(level: int, region: BodyRegion, world_pos: Vector2, g: Gesture) -> void:
	var v: Node = Game.voice
	var e := Game.escalation()
	if region:
		region.react(level, world_pos, g)
	match level:
		Game.Level.WRONG:
			if _ready_cd(&"wrong_voice", 0.9) and v:
				v.play_at([&"grunt", &"huff", &"grunt"][randi() % 3], world_pos, -2.0, randf_range(0.85, 1.1))
			if _ready_cd(&"wrong_fx", 0.35):
				if Game.screen_fx:
					Game.screen_fx.dust_puff(world_pos, 0.7)
				var away := signf(world_pos.x - Game.camera_x() + 0.1)
				impulse(Vector2(-away * 30.0, -25.0), -away * 0.004)
				if Game.decor:
					Game.decor.react_near(world_pos, -0.8, 500.0)
				if Game.terrain:
					Game.terrain.tension = 0.6
		Game.Level.CLOSE:
			if _ready_cd(&"close_fx", 1.2):
				shiver = maxf(shiver, 0.35)
			if _ready_cd(&"close_voice", 2.8) and v:
				v.play_at(&"rumble", world_pos, -8.0, randf_range(0.9, 1.1))
			if Game.decor and _ready_cd(&"close_decor", 0.4):
				Game.decor.react_near(world_pos, 0.15, 450.0)
		Game.Level.GOOD:
			if _ready_cd(&"good_voice", 2.6) and v:
				v.play_at([&"moan", &"purr"][randi() % 2], world_pos, -3.0, randf_range(0.92, 1.06))
			if _ready_cd(&"good_ripple", 0.7) and Game.terrain:
				Game.terrain.add_ripple(world_pos, 0.55)
			if _ready_cd(&"good_body", 1.3):
				impulse(Vector2(randf_range(-20, 20), 30.0))
			if Game.decor and _ready_cd(&"good_decor", 0.4):
				Game.decor.react_near(world_pos, 0.45, 650.0)
		Game.Level.VERY_GOOD:
			if _ready_cd(&"vgood_voice", 3.0) and v:
				v.play_at(&"groan", world_pos, 0.0, randf_range(0.92, 1.05))
			if _ready_cd(&"good_ripple", 0.5) and Game.terrain:
				Game.terrain.add_ripple(world_pos, 0.9)
			if _ready_cd(&"vgood_body", 1.0):
				impulse(Vector2(randf_range(-40, 40), 55.0), randf_range(-0.004, 0.004))
				if Game.camera:
					Game.camera.sway(0.5)
				if Game.decor:
					Game.decor.bounce(180.0)
			if _ready_cd(&"vgood_dust", 1.6) and Game.screen_fx:
				Game.screen_fx.dust_burst(0.25 + e * 0.3)
			if _ready_cd(&"vgood_thump", 3.5) and e < thump_threshold:
				thump(0.5)
			if Game.decor and _ready_cd(&"good_decor", 0.4):
				Game.decor.react_near(world_pos, 0.7, 800.0)
		Game.Level.HERRING:
			pass  # see herring()


## The crevice was poked. Spectacular. Unhelpful.
func herring(region: BodyRegion, count: int) -> void:
	var v: Node = Game.voice
	if v:
		v.play_at(&"bellow", region.global_position, 4.0, lerpf(1.0, 0.82, clampf(count / 3.0, 0.0, 1.0)))
		v.play_offscreen_delayed(&"crash", -1.0 if randf() < 0.5 else 1.0, 0.45, 0.0, randf_range(0.9, 1.1))
	impulse(Vector2(randf_range(-60, 60), -160.0 - count * 30.0), randf_range(-0.012, 0.012))
	if Game.camera:
		Game.camera.shake(0.85)
	if Game.screen_fx:
		Game.screen_fx.dust_burst(1.0)
		Game.screen_fx.flash(0.12)
	if Game.decor:
		Game.decor.bounce(700.0)
		Game.decor.glance_eyes(region.global_position, 1.5)
	if Game.terrain:
		Game.terrain.add_ripple(region.global_position, 1.2)
	if Game.bill:
		Game.bill.startle()
	for r in Game.regions.values():
		r.body_jolt(1.2)


## Too much irritation: the beast rolls / shuffles away from the hand.
func shift_away(region: BodyRegion) -> void:
	var v: Node = Game.voice
	var from_x: float = region.global_position.x if region else Game.camera_x()
	var side := signf(from_x - Game.camera_x() + 0.1)
	if v:
		v.play_at(&"grunt", Vector2(from_x, 600), 2.0, 0.75)
		v.play_at(&"creak", Vector2(from_x, 600), 0.0, 0.7)
	impulse(Vector2(side * 260.0, -120.0), side * 0.03)
	if Game.camera:
		Game.camera.shake(0.45)
		Game.camera.nudge(-side * 140.0)
	if Game.screen_fx:
		Game.screen_fx.dust_burst(0.6)
	if Game.decor:
		Game.decor.bounce(320.0)
		Game.decor.react_near(Vector2(from_x, 600), -1.0, 1200.0)
	if region:
		region.react(Game.Level.WRONG, region.global_position, null)
		region.tension = 1.0
	if Game.bill:
		Game.bill.startle()


## Draw the player's attention to a region without words.
func hint(region: BodyRegion, strength: float) -> void:
	if region == null:
		return
	region.hint(strength)
	var focus := region.focus_point()
	if Game.decor:
		Game.decor.point_at(focus, clampf(strength, 0.0, 1.0))
		Game.decor.glance_eyes(focus, 2.5)
	if Game.terrain and strength > 0.5:
		Game.terrain.add_ripple(focus, 0.25 * strength)
	if Game.voice and _ready_cd(&"hint_voice", 5.0):
		Game.voice.play_at(&"whine" if strength < 0.8 else &"huff", focus, -6.0 + strength * 4.0, randf_range(0.95, 1.1))
