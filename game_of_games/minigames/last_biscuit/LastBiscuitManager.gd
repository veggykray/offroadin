class_name LBManager
extends Node3D
## THE LAST BISCUIT - orchestrator.
## An etiquette game: everyone is waiting for the guest of honour, so nobody
## may eat - but everyone is starving. Bill steals food, gets it to his mouth
## and chews it while nobody is looking. Rival hands do the same.
## Wires the table world, diners, hands, noise, comedy events and the ending,
## runs the time-based escalation, the caught sequence and the guest's arrival.
##
## Emits last_biscuit_completed("empty_biscuit_plate") when done. Bill
## "receives" the EMPTY_BISCUIT_PLATE item id.

signal last_biscuit_completed(item_id: String)
signal phase_changed(phase: int)
signal player_caught(by_diner: String, attempt: int)

const ITEM_ID := "empty_biscuit_plate"
const ITEM_KEY := "EMPTY_BISCUIT_PLATE"

enum GS { INTRO, PLAY, CAUGHT, BREAK_BEAT, ENDING, DONE }

## When embedded in Game of Games set false: no replay prompt, no restart key.
@export var standalone := true
@export var start_debug := false
@export_group("Dinner")
## Seconds until the guest of honour arrives (the dinner ends).
@export var guest_time := 240.0
## Hunger points Bill needs to feel full (food is worth 1-3).
@export var hunger_goal := 10.0
## Seconds Bill chews after each mouthful (visible to anyone looking at him).
@export var chew_time := 2.2
@export_group("Escalation")
## Play time (s) at which phases 2, 3 and 4 begin.
@export var phase_times := Vector3(25.0, 65.0, 105.0)
## The last stretch before the guest arrives: everyone is grabbier.
@export var rush_time := 45.0
@export var return_alertness := 1.15
@export var rival_out_time_return := 6.0
## Every breach of etiquette makes the table permanently more alert.
@export var alertness_per_breach := 0.06
@export_group("Juice")
@export var slap_loudness := 0.6
@export var hitstop_time := 0.06
@export var slap_jump_radius := 0.45

var gs: GS = GS.INTRO
var phase := 1
var phase_time := 0.0
var play_time := 0.0
var attempt := 1
var breaches := 0
var hunger := 0.0
var eaten := 0
var eating := false
var alertness := 1.0
var debug := false
var paused_rivals := false

var world: LBTableWorld
var noise_sys: LBNoiseSystem
var audio: LBAudio
var room: LBDiningRoom
var camera: LBCameraRig
var player: LBPlayerHand
var bill: LBBillVisual
var comedy: Node
var hud: Node
var debug_overlay: Node
var diners: Array[LBDiner] = []
var rivals: Array[LBRivalHand] = []
var hands: Array[LBHand] = []
var plate: LBTableObject
var cheat_teapot: LBTableObject
var rival_napkin: LBTableObject
var _now := 0.0
var _tension := 0.0
var _near_miss := 0.0
var _chime_cd := 0.0
var _tense_cd := 0.0
var _hitstop := 0.0
var _saved_time_scale := 1.0
var _target_ring: MeshInstance3D
var _expose_ring: MeshInstance3D
var _expose_mat: StandardMaterial3D
var _ripples: Array = []          # [MeshInstance3D, age, max_radius]
var _phase_stagger := 0.0
var _sugar_cubes: Array = []
var _teeth: Array = []
var _rng := RandomNumberGenerator.new()


# ================================================================== setup

func _ready() -> void:
	LBInput.ensure_actions()
	_rng.randomize()
	debug = start_debug
	Input.set_default_cursor_shape(Input.CURSOR_CROSS)
	_find_or_make_nodes()
	room.build()
	_setup_diners()
	var spawned := LBTableLayout.spawn(world, diners.map(func(d): return d.seat))
	plate = spawned["plate"]
	cheat_teapot = spawned["cheat_teapot"]
	rival_napkin = spawned["rival_napkin"]
	_empty_chairs()
	for d in diners:
		if d.behaviour == LBDiner.Behaviour.CHEAT:
			d.teapot = cheat_teapot
			(d.visual as LBDinerVisual).attach_reflection(cheat_teapot)
	_setup_hands()
	world.impact.connect(_on_impact)
	world.biscuit_hit_hard.connect(func(b, _s): break_biscuit(b))
	noise_sys.audio = audio
	noise_sys.noise.connect(_on_noise)
	_make_target_ring()
	bill.look_target = LBConst.p2w(LBConst.BISCUIT_HOME, 1.0)
	_intro()


func _find_or_make_nodes() -> void:
	world = _child_of_type("TableWorld", LBTableWorld) as LBTableWorld
	noise_sys = _child_of_type("NoiseSystem", LBNoiseSystem) as LBNoiseSystem
	audio = _child_of_type("AudioBank", LBAudio) as LBAudio
	room = _child_of_type("DiningRoom", LBDiningRoom) as LBDiningRoom
	camera = _child_of_type("CameraRig", LBCameraRig) as LBCameraRig
	player = _child_of_type("PlayerHand", LBPlayerHand) as LBPlayerHand
	comedy = _child_of_type("ComedyEventController", LBComedyEvents)
	hud = _child_of_type("HUD", LBHud)
	debug_overlay = _child_of_type("DebugOverlay", LBDebugOverlay)
	camera.current = true
	bill = LBBillVisual.new()
	bill.name = "Bill"
	add_child(bill)
	bill.build()


func _child_of_type(nm: String, script_class) -> Node:
	var n := get_node_or_null(nm)
	if n == null:
		n = script_class.new()
		n.name = nm
		add_child(n)
	return n


func _setup_diners() -> void:
	var container := get_node_or_null("Diners")
	if container == null:
		container = Node3D.new()
		container.name = "Diners"
		add_child(container)
	if container.get_child_count() == 0:
		_default_diners(container)
	var i := 0
	for c in container.get_children():
		if c is LBDiner:
			var d := c as LBDiner
			d.setup(i, world, self)
			d.caught_hand.connect(_on_caught)
			diners.append(d)
			i += 1


func _default_diners(container: Node) -> void:
	var specs := [
		[LBDiner.Behaviour.SLEEPER, Vector2(-1.48, 2.4), "The Sleeper", Color(0.28, 0.2, 0.13)],
		[LBDiner.Behaviour.GLASSES, Vector2(-1.48, 0.0), "The Glasses", Color(0.3, 0.12, 0.3)],
		[LBDiner.Behaviour.DEAF_WATCHER, Vector2(-1.48, -2.4), "The Deaf Watcher", Color(0.06, 0.06, 0.07)],
		[LBDiner.Behaviour.TWITCH, Vector2(1.48, 2.4), "The Twitch", Color(0.1, 0.22, 0.12)],
		[LBDiner.Behaviour.BLIND_LISTENER, Vector2(1.48, 0.0), "The Blind Listener", Color(0.42, 0.08, 0.08)],
		[LBDiner.Behaviour.CHEAT, Vector2(1.48, -2.4), "The Cheat", Color(0.3, 0.05, 0.08)],
	]
	for s in specs:
		var d := LBDiner.new()
		d.behaviour = s[0]
		d.seat = s[1]
		d.display_name = s[2]
		d.palette_suit = s[3]
		d.name = (s[2] as String).replace(" ", "")
		container.add_child(d)


func _empty_chairs() -> void:
	# the guest of honour's chair at the head of the table, conspicuously empty
	var head := LBMesh.pivot(self, Vector3(0, 0, -5.55), "HeadChair")
	LBMesh.add(head, LBMesh.box_mesh(Vector3(0.7, 0.06, 0.55)), LBMat.dark_wood(), Vector3(0, 0.46, 0))
	LBMesh.add(head, LBMesh.box_mesh(Vector3(0.75, 1.9, 0.08)), LBMat.dark_wood(), Vector3(0, 1.3, -0.3))
	LBMesh.add(head, LBMesh.box_mesh(Vector3(0.55, 1.5, 0.03)), LBMat.velvet(), Vector3(0, 1.25, -0.25))
	LBMesh.add(head, LBMesh.sphere_mesh(0.08, 12), LBMat.gold(), Vector3(0, 2.3, -0.3))


func _setup_hands() -> void:
	player.shoulder = LBConst.BILL_SHOULDER
	player.plane_pos = LBConst.BILL_HAND_HOME
	player.camera = camera
	player.home = LBConst.BILL_HAND_HOME
	world.add_hand(player)
	hands.append(player)
	player.slap_requested.connect(func(t): do_slap(player, t))
	player.grab_requested.connect(_on_player_grab)
	player.released_object.connect(_on_player_release)
	var container := get_node_or_null("Rivals")
	if container == null:
		container = Node3D.new()
		container.name = "Rivals"
		add_child(container)
	if container.get_child_count() == 0:
		_default_rivals(container)
	for c in container.get_children():
		if c is LBRivalHand:
			var r := c as LBRivalHand
			var owner_d := _diner_by_behaviour(int(r.get_meta("owner_behaviour", -1)))
			if owner_d == null:
				owner_d = _diner_by_name(r.get_meta("owner_name", ""))
			if owner_d == null:
				continue
			r.manager = self
			r.setup_owner(owner_d)
			world.add_hand(r)
			hands.append(r)
			rivals.append(r)
	player.rivals = rivals


func _default_rivals(container: Node) -> void:
	var specs := [
		[LBDiner.Behaviour.CHEAT, LBRivalHand.Tactic.SNEAK, 2],
		[LBDiner.Behaviour.TWITCH, LBRivalHand.Tactic.DARTER, 3],
		[LBDiner.Behaviour.GLASSES, LBRivalHand.Tactic.FORK_BLOCKER, 4],
		[LBDiner.Behaviour.BLIND_LISTENER, LBRivalHand.Tactic.NAPKIN_CREEPER, 4],
	]
	for s in specs:
		var r := LBRivalHand.new()
		r.tactic = s[1]
		r.activation_phase = s[2]
		r.set_meta("owner_behaviour", s[0])
		_tune_rival(r)
		container.add_child(r)


static func _tune_rival(r: LBRivalHand) -> void:
	match r.tactic:
		LBRivalHand.Tactic.SNEAK:
			r.name = "CheatHand"
			r.max_speed = 0.75
			r.drags_plate = true
			r.plants_fake = true
			r.freeze_reliability = 0.97
		LBRivalHand.Tactic.DARTER:
			r.name = "TwitchHand"
			r.max_speed = 1.5
			r.accel = 9.0
			r.freeze_reaction = 0.45
			r.freeze_reliability = 0.6
			r.slap_rate = 2.2
		LBRivalHand.Tactic.FORK_BLOCKER:
			r.name = "GlassesHand"
			r.max_speed = 0.95
			r.freeze_reliability = 0.85
		LBRivalHand.Tactic.NAPKIN_CREEPER:
			r.name = "BlindHand"
			r.max_speed = 0.5
			r.freeze_reliability = 0.0   # he cannot see who is watching
			r.slap_rate = 0.6


func _diner_by_behaviour(b: int) -> LBDiner:
	for d in diners:
		if int(d.behaviour) == b:
			return d
	return null


func _diner_by_name(nm: String) -> LBDiner:
	for d in diners:
		if d.name == nm or d.display_name == nm:
			return d
	return null


func _spawn_biscuit(pos: Vector2, fraction := 1.0, fake := false, type := "biscuit") -> LBBiscuit:
	var b := LBBiscuit.new()
	b.setup(pos, fraction, fake, type)
	world.add_object(b)
	return b


func _make_target_ring() -> void:
	_target_ring = MeshInstance3D.new()
	_target_ring.mesh = LBMesh.torus_mesh(0.03, 0.036, 24, 4)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1.0, 0.9, 0.7, 0.22)
	_target_ring.material_override = m
	_target_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_target_ring)
	# glowing ring under Bill's hand whenever someone's light is on it
	_expose_ring = MeshInstance3D.new()
	_expose_ring.mesh = LBMesh.torus_mesh(0.13, 0.155, 32, 4)
	_expose_mat = StandardMaterial3D.new()
	_expose_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_expose_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_expose_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_expose_mat.albedo_color = Color(1, 1, 1, 0)
	_expose_ring.material_override = _expose_mat
	_expose_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_expose_ring.scale = Vector3(1, 0.2, 1)
	add_child(_expose_ring)


## An expanding ring on the table: you can SEE how far a noise carries.
func _ripple(pos: Vector2, loudness: float) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = LBMesh.torus_mesh(0.96, 1.0, 48, 3)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(1.0, 0.95, 0.8, 0.6)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = LBConst.p2w(pos, LBConst.TABLE_Y + 0.02)
	mi.scale = Vector3(0.01, 0.01, 0.01)
	add_child(mi)
	_ripples.append([mi, 0.0, LBNoiseSystem.audible_radius(loudness) * 0.6, clampf(loudness, 0.2, 1.0)])


# ================================================================ helpers

## All edible food still on the table (held or not).
func foods() -> Array[LBBiscuit]:
	var out: Array[LBBiscuit] = []
	for b in world.biscuits():
		if b.is_real_prize():
			out.append(b)
	return out


func guest_food() -> LBBiscuit:
	for b in world.biscuits():
		if b.is_guest() and not b.is_fake:
			return b
	return null


## The most coveted food left: the guest's biscuit, else anything edible.
func real_biscuit() -> LBBiscuit:
	var g := guest_food()
	if g:
		return g
	var f := foods()
	return f[0] if f.size() > 0 else null


func random_free_food() -> LBBiscuit:
	var pool := foods().filter(func(b): return b.held_by == null)
	return pool[_rng.randi() % pool.size()] if pool.size() > 0 else null


func time_left() -> float:
	return maxf(guest_time - play_time, 0.0)


func rivals_allowed() -> bool:
	return gs == GS.PLAY and not paused_rivals


func nearest_of_kind(k: LBTableObject.Kind, p: Vector2) -> LBTableObject:
	var best: LBTableObject = null
	var bd := INF
	for o in world.find_kind(k):
		if o.held_by != null:
			continue
		var d := o.plane_pos.distance_to(p)
		if d < bd:
			bd = d
			best = o
	return best


func give_napkin(r: LBRivalHand) -> LBTableObject:
	var n := rival_napkin
	if n == null or n.held_by != null or not n.on_table:
		n = nearest_of_kind(LBTableObject.Kind.NAPKIN, r.home)
	if n and n.held_by == null:
		n.plane_pos = r.home
		return n
	return null


func spawn_sugar_cube(p: Vector2) -> LBTableObject:
	var c := LBTableObject.new()
	c.configure(LBTableObject.Kind.SUGAR_CUBE, p)
	world.add_object(c)
	_sugar_cubes.append(c)
	return c


func is_event_allowed() -> bool:
	return gs == GS.PLAY and play_time > 20.0


func set_debug(on: bool) -> void:
	debug = on
	if debug_overlay:
		debug_overlay.visible = on


# ============================================================== main loop

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("lb_debug"):
		set_debug(not debug)
	if event.is_action_pressed("lb_restart") and standalone:
		restart()
	if gs == GS.DONE and standalone and event is InputEventMouseButton and event.pressed and _now > get_meta("done_at", 0.0) + 4.0:
		restart()
	if debug and event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_1: debug_jump_phase(1)
			KEY_2: debug_jump_phase(2)
			KEY_3: debug_jump_phase(3)
			KEY_4: debug_jump_phase(4)
			KEY_5: debug_jump_rush()
			KEY_6: debug_jump_ending()
			KEY_7:
				if comedy:
					comedy.trigger_next()
			KEY_8: Engine.time_scale = 0.25 if Engine.time_scale > 0.5 else 1.0
			KEY_9: debug_jump_home_stretch()
			KEY_0: paused_rivals = not paused_rivals


func _process(dt: float) -> void:
	# hit-stop runs on real time (physics barely ticks while it is active)
	if _hitstop > 0.0:
		_hitstop -= dt / maxf(Engine.time_scale, 0.01)
		if _hitstop <= 0.0:
			Engine.time_scale = _saved_time_scale


func _physics_process(dt: float) -> void:
	_now += dt
	if gs == GS.PLAY:
		play_time += dt
		phase_time += dt
	# 1) input / AI
	player.control(dt)
	for r in rivals:
		if paused_rivals and r.state == LBRivalHand.St.ACTIVE:
			r.drive(dt, Vector2.ZERO, r.accel, r.decel, r.max_speed)
		elif r.forced_freeze:
			r.drive(dt, Vector2.ZERO, r.accel, r.decel * 2.0, r.max_speed)
		else:
			r.think(dt)
	# 2) motion + physics
	for h in hands:
		h.step_motion(dt)
	_tug(dt)
	world.step(dt)
	# 3) perception
	for d in diners:
		d.tick(dt, hands, _now)
	# 4) rules
	if gs == GS.PLAY:
		_update_phase(dt)
		_check_eat()
		if time_left() <= 0.0:
			_guest_arrives()
	if hud:
		hud.set_status(hunger, hunger_goal, time_left(), breaches)
	_juice(dt)


func _update_phase(dt: float) -> void:
	var want := 1
	if play_time > phase_times.x:
		want = 2
	if play_time > phase_times.y:
		want = 3
	if play_time > phase_times.z:
		want = 4
	if time_left() < rush_time:
		want = LBConst.Phase.RETURN
	if want > phase:
		set_phase(want)
	# staggered emergence of rivals that are due
	_phase_stagger -= dt
	if _phase_stagger <= 0.0 and not paused_rivals:
		for r in rivals:
			if r.state == LBRivalHand.St.HIDDEN and r.activation_phase <= phase:
				r.emerge()
				_phase_stagger = 2.2
				break


func set_phase(p: int) -> void:
	phase = p
	phase_time = 0.0
	alertness = (return_alertness if p >= LBConst.Phase.RETURN else 1.0) + breaches * alertness_per_breach
	if p >= LBConst.Phase.RETURN:
		for r in rivals:
			r.out_time = rival_out_time_return
			if r.state == LBRivalHand.St.HIDDEN:
				r.activation_phase = mini(r.activation_phase, LBConst.Phase.RETURN)
	phase_changed.emit(p)


func _check_eat() -> void:
	var b := player.held as LBBiscuit
	if eating or b == null or not b.is_real_prize() or b.is_contested():
		return
	if player.plane_pos.y > LBConst.HOME_ZONE_Z:
		_player_eat(b)


## Hand to mouth, a guilty bite, then chewing that anyone glancing at Bill sees.
func _player_eat(b: LBBiscuit) -> void:
	eating = true
	player.input_enabled = false
	var back := player.plane_pos
	var tw := create_tween().set_parallel(true)
	tw.tween_property(player, "lift", 0.5, 0.28).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(player, "plane_pos", Vector2(0.08, 5.25), 0.28).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	await tw.finished
	if gs != GS.PLAY or player.held != b:
		player.lift = 0.0
		eating = false
		player.input_enabled = gs == GS.PLAY
		return
	audio.play_at("crunch", bill.head.global_position, -4.0, 1.25)
	audio.play_at("gulp", bill.head.global_position, -10.0, 1.1)
	hunger += b.value()
	eaten += 1
	player.release()
	world.remove_object(b)
	player.chewing_t = chew_time
	bill.chew_t = chew_time
	if hud:
		hud.pulse_hunger()
	var tw2 := create_tween().set_parallel(true)
	tw2.tween_property(player, "lift", 0.0, 0.3)
	tw2.tween_property(player, "plane_pos", Vector2(back.x, LBConst.HOME_ZONE_Z + 0.15), 0.3)
	await tw2.finished
	player.snap_cursor_to_hand()
	eating = false
	if gs == GS.PLAY:
		player.input_enabled = true
		if hunger >= hunger_goal:
			_guest_arrives()


# ================================================================== hands

func _on_player_grab(obj: LBTableObject) -> void:
	if obj.kind == LBTableObject.Kind.NAPKIN:
		if obj.held_by == null:
			player.drape(obj)
			noise_sys.emit_noise(obj.plane_pos, 0.1, player, "rustle")
		return
	if obj is LBBiscuit:
		var b := obj as LBBiscuit
		if b.is_fake:
			_fake_squeak(player, b)
			return
		var was_free := b.held_by == null
		player.grab(b)
		audio.play_at("grab", player.palm_world(), -4.0)
		# a small, satisfying pluck: the hand bobs up with its prize
		var pop := create_tween()
		pop.tween_property(player, "lift", 0.07, 0.09).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		pop.tween_property(player, "lift", 0.0, 0.18).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		if b.is_real_prize():
			audio.play_flat("chime", -22.0, 0.75)
		if was_free and plate and b.plane_pos.distance_to(plate.plane_pos) < plate.radius:
			# lifting it off the plate: tiny porcelain tick if done roughly
			noise_sys.emit_noise(b.plane_pos, clampf(player.speed() * 0.25, 0.0, 0.4), player, "clink", player.speed() > 0.3)
		return
	if obj.held_by != null and obj.held_by != player:
		return
	player.grab(obj)
	if obj.mass > 1.0:
		audio.play_at("thud", player.palm_world(), -14.0)


func _on_player_release(obj: LBTableObject) -> void:
	if obj == null:
		return
	if obj.mass > 0.3 and obj.hand_collides:
		noise_sys.emit_noise(obj.plane_pos, clampf(0.05 + player.speed() * 0.35, 0.0, 1.0), player, obj.sound)


func _fake_squeak(h: LBHand, b: LBBiscuit) -> void:
	audio.play_at("squeak", LBConst.p2w(b.plane_pos), 0.0)
	noise_sys.emit_noise(b.plane_pos, 0.35, h, "squeak", false)
	b.jump(0.9)
	b.vel = Vector2(_rng.randf_range(-0.4, 0.4), _rng.randf_range(-0.4, 0.4))
	if h is LBRivalHand:
		h.stunned_t = 0.6


func rival_grab(r: LBRivalHand, b: LBBiscuit) -> void:
	if b.is_fake and not (b.has_meta("planted_by") and b.get_meta("planted_by") == r):
		_fake_squeak(r, b)
		return
	var was_on_plate := b.held_by == null and plate and b.plane_pos.distance_to(plate.plane_pos) < plate.radius * 0.6
	r.grab(b)
	# sleight of hand: the Cheat leaves a fake in its place
	if r.plants_fake and was_on_plate and not r._fake_planted and phase >= 3:
		r._fake_planted = true
		var f := _spawn_biscuit(plate.plane_pos, 1.0, true)
		f.set_meta("planted_by", r)


func do_slap(attacker: LBHand, target: LBHand) -> void:
	var dir := (target.plane_pos - attacker.plane_pos)
	dir = dir.normalized() if dir.length() > 0.001 else Vector2.UP
	attacker.do_slap_anim(dir)
	var dropped := target.held
	target.get_slapped(attacker, dir, 0.6 if target.is_player else 1.0)
	if dropped:
		var o := target.release(dir * 1.4)
		if o:
			o.set_meta("last_toucher", attacker)
	if target.cover:
		target.undrape()
	var mid := (attacker.plane_pos + target.plane_pos) * 0.5
	noise_sys.emit_noise(mid, slap_loudness, attacker, "slap")
	noise_sys.emit_noise(mid, slap_loudness * 0.6, target, "slap", false)
	audio.play_at("slap", LBConst.p2w(mid, LBConst.TABLE_Y + 0.08), 2.0, _rng.randf_range(0.95, 1.1))
	# cutlery leaps, cups rattle
	for o in world.objects:
		if not o.on_table or o.held_by != null:
			continue
		var d := o.plane_pos.distance_to(mid)
		if d < slap_jump_radius:
			var k := 1.0 - d / slap_jump_radius
			if o.mass < 0.4:
				o.jump(_rng.randf_range(0.5, 1.0) * k)
				o.vel += (o.plane_pos - mid).normalized() * 0.3 * k
			o.bump(o.plane_pos - mid, 0.5 * k)
	if camera:
		camera.bump(Vector3(dir.x, -0.6, dir.y), 0.05)
		camera.shake(0.35)
	if _hitstop <= 0.0:
		_saved_time_scale = Engine.time_scale
	_hitstop = hitstop_time
	Engine.time_scale = _saved_time_scale * 0.08


func rival_slap(r: LBRivalHand, target: LBHand) -> void:
	do_slap(r, target)


func _tug(dt: float) -> void:
	for b in world.biscuits():
		if b.holders.size() < 2:
			continue
		var a := b.holders[0] as LBHand
		var c := b.holders[1] as LBHand
		var dist := a.plane_pos.distance_to(c.plane_pos)
		# rubber-band pull between the two greedy hands
		for h in [a, c]:
			var hh := h as LBHand
			hh.vel += (b.plane_pos - hh.plane_pos) * 18.0 * dt
		if dist > b.tug_crack_distance:
			b.tug_strain += dt * dist / b.tug_crack_distance
			if _rng.randf() < dt * 3.0:
				audio.play_at("crunch", LBConst.p2w(b.plane_pos), -18.0, 1.4)
		else:
			b.tug_strain = maxf(b.tug_strain - dt, 0.0)
		if b.tug_strain > b.tug_crack_time:
			break_biscuit(b)
		elif dist > 0.26 and (a.vel - c.vel).length() > 1.1 and _rng.randf() < 0.55:
			break_biscuit(b)      # a violent yank snaps it
		elif dist > 0.26:
			var sa := a.grip * _rng.randf_range(0.7, 1.3) + (0.25 if a.is_player else 0.0)
			var sc := c.grip * _rng.randf_range(0.7, 1.3) + (0.25 if c.is_player else 0.0)
			var loser := a if sa < sc else c
			loser.release()


func break_biscuit(b: LBBiscuit) -> void:
	if not is_instance_valid(b) or not b.can_break():
		return
	var holders := b.holders.duplicate()
	for h in holders:
		(h as LBHand).release()
	var dir := Vector2.from_angle(_rng.randf() * TAU)
	var big := _spawn_biscuit(b.plane_pos + dir * 0.03, 0.62, false, b.food_type)
	var small := _spawn_biscuit(b.plane_pos - dir * 0.03, 0.38, false, b.food_type)
	big.home_pos = b.home_pos
	small.home_pos = b.home_pos
	big.vel = dir * 0.25
	small.vel = -dir * 0.25
	if holders.size() >= 2:
		var first := holders[0] as LBHand
		var second := holders[1] as LBHand
		if _rng.randf() < 0.5:
			first.grab(big)
			second.grab(small)
		else:
			first.grab(small)
			second.grab(big)
	elif holders.size() == 1:
		(holders[0] as LBHand).grab(big if _rng.randf() < 0.5 else small)
	world.remove_object(b)
	audio.play_at("crunch", LBConst.p2w(big.plane_pos), 2.0)
	noise_sys.emit_noise(big.plane_pos, 0.3, null, "crunch", false)
	_break_beat(big.plane_pos)


func _break_beat(at: Vector2) -> void:
	if gs != GS.PLAY:
		return
	gs = GS.BREAK_BEAT
	audio.set_duck(0.0)
	player.input_enabled = false
	for r in rivals:
		r.forced_freeze = true
	for d in diners:
		d.look_at_world(LBConst.p2w(at), 1.7, 3.0)
	bill.look_target = LBConst.p2w(at)
	await get_tree().create_timer(1.7).timeout
	for r in rivals:
		r.forced_freeze = false
	player.input_enabled = true
	audio.set_duck(1.0)
	if gs == GS.BREAK_BEAT:
		gs = GS.PLAY


# ================================================================== noise

func _on_impact(pos: Vector2, loudness: float, source: LBHand, obj: LBTableObject, kind: String) -> void:
	noise_sys.emit_noise(pos, loudness, source, kind)
	if loudness > 0.9 and camera:
		camera.shake(0.25)
	if obj is LBBiscuit or obj == null:
		return


func _on_noise(pos: Vector2, loudness: float, source: LBHand, kind: String) -> void:
	if loudness > 0.12 and kind != "swish":
		_ripple(pos, loudness)
	for d in diners:
		d.on_noise(pos, loudness, source, kind)


# ================================================================= caught

func on_suspicion_level(diner: LBDiner, h: LBHand, lvl: int) -> void:
	if h != player or gs != GS.PLAY:
		return
	if lvl >= 2 and _tense_cd <= 0.0:
		_tense_cd = 2.5
		audio.play_flat("tense", -16.0 + lvl * 2.0)


func _on_caught(d: LBDiner, h: LBHand) -> void:
	if gs != GS.PLAY:
		return
	if h == player:
		_player_caught(d)
	elif h is LBRivalHand:
		_rival_caught(d, h as LBRivalHand)


func _rival_caught(d: LBDiner, r: LBRivalHand) -> void:
	if r.is_out() or r.state == LBRivalHand.St.SHAME:
		return
	var owner_d := diners[r.owner_index]
	d.start_pointing(r.palm_world())
	d.look_at_world(r.palm_world(), 2.5, 3.0)
	audio.play_at("gulp", owner_d.head_world(), -2.0)
	r.withdraw(true)
	for o in diners:
		if o != d and o != owner_d:
			o.look_at_world(owner_d.head_world(), _rng.randf_range(2.6, 3.4), 1.2)
		o.suspicion.values.erase(r)
	owner_d.look_at_world(LBConst.p2w(owner_d.own_plate_point()), 3.0, 2.0)
	await get_tree().create_timer(2.0).timeout
	d.stop_pointing()


func _player_caught(d: LBDiner) -> void:
	gs = GS.CAUGHT
	player_caught.emit(d.display_name, attempt)
	player.input_enabled = false
	player.vel = Vector2.ZERO
	var held_b := player.held as LBBiscuit
	var was_chewing := player.chewing_t > 0.0
	breaches += 1
	audio.play_flat("pluck", -4.0)
	audio.set_duck(0.0)
	audio.set_tension(0.0)
	for r in rivals:
		r.forced_freeze = true
	var hand_at := player.palm_world()
	if was_chewing and held_b == null:
		hand_at = bill.head.global_position          # caught with his mouth full
	d.start_pointing(hand_at)
	d.look_at_world(hand_at, -1, 4.0)
	bill.look_target = d.head_world()
	await get_tree().create_timer(0.7).timeout
	# ...then, one by one, every diner slowly turns to look at Bill
	var order := diners.duplicate()
	order.shuffle()
	for o in order:
		if o == d:
			continue
		o.paused = true
		o.look_at_world(LBConst.p2w(LBConst.BILL_HAND_HOME.lerp(player.plane_pos, 0.3), 1.25), -1, 0.75)
		await get_tree().create_timer(0.32).timeout
	d.paused = true
	# absolute silence. hold it.
	if was_chewing:
		await get_tree().create_timer(1.0).timeout
		audio.play_at("gulp", bill.head.global_position, 0.0, 0.8)   # the loudest swallow in history
		bill.chew_t = 0.0
		await get_tree().create_timer(1.4).timeout
	else:
		await get_tree().create_timer(2.4).timeout
	# Bill withdraws, deflated
	player.force_release_all()
	if held_b:
		held_b.vel = Vector2.ZERO
	for r in rivals:
		r.forced_freeze = false
		r.withdraw(false)
	var tw := create_tween()
	tw.tween_property(player, "plane_pos", LBConst.BILL_HAND_HOME, 1.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(player.snap_cursor_to_hand)
	d.stop_pointing()
	await get_tree().create_timer(0.8).timeout
	# someone calmly puts the food back where it belongs with serving tongs
	if held_b and is_instance_valid(held_b):
		await _tongs_restore(d, held_b)
	for o in diners:
		o.reset_state()
	attempt += 1
	set_phase(phase)
	for r in rivals:
		if r.state == LBRivalHand.St.HIDDEN and r.activation_phase <= phase:
			r.state = LBRivalHand.St.OUT
			r.state_t = 0.0
			_tune_rival_out(r)
	player.vel = Vector2.ZERO
	player.input_enabled = true
	audio.set_duck(1.0)
	bill.look_target = LBConst.p2w(LBConst.BISCUIT_HOME, 1.0)
	player.chewing_t = 0.0
	gs = GS.PLAY


func _tune_rival_out(r: LBRivalHand) -> void:
	r.out_time = 8.0 if phase >= LBConst.Phase.RETURN else 12.0


func _tongs_restore(by: LBDiner, item: LBBiscuit) -> void:
	var tongs := _make_tongs()
	var start := by.head_world() + Vector3(-by.side * 0.2, -0.3, 0)
	tongs.global_position = start
	# the guest's plate goes back too, perfectly centred
	if item.is_guest() and plate:
		var pt := create_tween()
		pt.tween_property(plate, "plane_pos", LBConst.BISCUIT_HOME, 0.8).set_trans(Tween.TRANS_SINE)
	var src := LBConst.p2w(item.plane_pos, LBConst.TABLE_Y + 0.08)
	var dest := LBConst.p2w(item.home_pos, LBConst.TABLE_Y + 0.08)
	var t1 := create_tween()
	t1.tween_property(tongs, "global_position", src + Vector3(0, 0.05, 0), 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await t1.finished
	audio.play_at("tongs", src, -6.0)
	if not is_instance_valid(item):
		tongs.queue_free()
		return
	item.held_by = null
	item.vel = Vector2.ZERO
	var carry := create_tween().set_parallel(true)
	carry.tween_property(tongs, "global_position", dest + Vector3(0, 0.05, 0), 1.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	carry.tween_property(item, "plane_pos", item.home_pos, 1.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	carry.tween_property(item, "lift", 0.08, 0.3)
	await carry.finished
	item.lift = 0.0
	audio.play_at("clink", dest, -10.0, 1.3)
	var t4 := create_tween()
	t4.tween_property(tongs, "global_position", start, 0.8).set_trans(Tween.TRANS_SINE)
	await t4.finished
	tongs.queue_free()
	for c in _sugar_cubes:
		if is_instance_valid(c):
			world.remove_object(c)
	_sugar_cubes.clear()


func _make_tongs() -> Node3D:
	var t := Node3D.new()
	add_child(t)
	t.scale = Vector3.ONE * 1.8
	var s := LBMat.silver()
	for side in [-1.0, 1.0]:
		LBMesh.add(t, LBMesh.box_mesh(Vector3(0.01, 0.006, 0.3)), s, Vector3(0.012 * side, 0, -0.12), Vector3(0, 3.0 * side, 0))
		LBMesh.add(t, LBMesh.box_mesh(Vector3(0.025, 0.012, 0.03)), s, Vector3(0.016 * side, -0.004, -0.27))
	LBMesh.add(t, LBMesh.torus_mesh(0.012, 0.02, 12, 6), s, Vector3(0, 0, 0.03), Vector3(0, 0, 90))
	return t


# ============================================================= rival end

func on_rival_escaped(r: LBRivalHand, b: LBTableObject) -> void:
	if gs != GS.PLAY:
		return
	# they made it: a furtive bite behind a napkin, a long innocent chew
	var owner_d := diners[r.owner_index]
	r.start_eating(owner_d.head_world() + Vector3(0, -0.12, 0))
	await get_tree().create_timer(0.5).timeout
	if is_instance_valid(b) and r.held == b:
		r.release()
		world.remove_object(b)
		audio.play_at("crunch", owner_d.head_world(), -10.0, 1.3)
		owner_d.chew_t = 2.4


func on_shame_done(_r: LBRivalHand) -> void:
	pass


# ================================================================= ending

## Time's up (or Bill is full): three knocks, and the guest of honour takes
## the head chair. It is the dog. It wanted the biscuit.
func _guest_arrives() -> void:
	if gs != GS.PLAY and gs != GS.BREAK_BEAT:
		return
	gs = GS.ENDING
	if hud:
		hud.hide_status()
	player.input_enabled = false
	player.force_release_all()
	player.chewing_t = 0.0
	audio.set_tension(0.0)
	for r in rivals:
		if not r.is_out():
			r.forced_freeze = false
			r.withdraw(false)
	for d in diners:
		d.paused = true
	var back := create_tween()
	back.tween_property(player, "plane_pos", LBConst.BILL_HAND_HOME, 1.0).set_trans(Tween.TRANS_SINE)
	# three slow knocks from the far end
	var head_chair := Vector3(0.0, 1.3, -5.5)
	for i in 3:
		audio.play_at("thud", Vector3(0, 1.2, -9.5), 4.0, 0.7)
		await get_tree().create_timer(0.55).timeout
	audio.set_duck(0.0)
	for d in diners:
		d.neutral_lock = false
		d.look_at_world(head_chair, -1, 1.6)
	bill.look_target = head_chair
	# the camera leans in down the table
	var cam_tw := create_tween().set_parallel(true)
	cam_tw.tween_property(camera, "base_position", Vector3(0.0, 2.6, 4.6), 3.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	cam_tw.tween_property(camera, "look_target", Vector3(0.0, 1.0, -3.6), 3.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await get_tree().create_timer(1.2).timeout
	# the guest rises into its seat
	var dog: Node3D = bill.guest_dog
	dog.visible = true
	var seat := Vector3(0.0, 0.42, -5.42)
	dog.global_position = seat + Vector3(0, -1.6, 0)
	var rise := create_tween()
	rise.tween_property(dog, "global_position", seat, 1.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	await rise.finished
	audio.play_flat("sting", -6.0, 0.8)
	await get_tree().create_timer(1.2).timeout
	# is its biscuit still there?
	var g := guest_food()
	var g_plate := plate
	if g and g.held_by == null and g_plate:
		# the centrepiece glides up the table to its rightful owner...
		var slide := create_tween()
		slide.tween_property(g_plate, "plane_pos", Vector2(0.0, -4.55), 1.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		await slide.finished
		await get_tree().create_timer(0.4).timeout
		# CHOMP
		var dhead: Node3D = bill.guest_head
		var lunge := create_tween()
		lunge.tween_property(dhead, "rotation:x", -0.7, 0.12)
		lunge.parallel().tween_property(bill.guest_jaw, "rotation:x", 0.8, 0.12)
		await lunge.finished
		audio.play_at("chomp", Vector3(0, 1.0, -4.6), 6.0)
		bill.guest_jaw.rotation.x = 0.0
		if is_instance_valid(g):
			world.remove_object(g)
		camera.shake(0.4)
		var settle := create_tween()
		settle.tween_property(dhead, "rotation:x", 0.0, 0.3)
		await get_tree().create_timer(1.4).timeout
	else:
		# it looks at its empty plate... then, very slowly, at Bill
		await get_tree().create_timer(1.6).timeout
		var turn := create_tween()
		turn.tween_property(bill.guest_head, "rotation:x", -0.25, 1.5)
		for d in diners:
			d.look_at_world(bill.head.global_position, -1, 0.6)
		await get_tree().create_timer(2.6).timeout
	# ...and the empty plate is sent all the way down the table to Bill
	audio.set_duck(0.4)
	if g_plate:
		var path := create_tween()
		path.tween_property(g_plate, "plane_pos", Vector2(0.15, 4.45), 2.6).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
		for i in 4:
			get_tree().create_timer(0.3 + i * 0.45).timeout.connect(func(): audio.play_at("clink", LBConst.p2w(g_plate.plane_pos), -14.0, 0.9))
		await path.finished
		var hand := create_tween()
		hand.tween_property(player, "plane_pos", Vector2(0.15, 4.5), 0.6).set_trans(Tween.TRANS_SINE)
		await hand.finished
	for d in diners:
		d.neutral_lock = true
	bill.look_target = LBConst.p2w(Vector2(0.15, 4.45), LBConst.TABLE_Y)
	# Bill looks down at what he has been given
	audio.play_at("gulp" if hunger >= hunger_goal else "thud", bill.head.global_position, -8.0, 0.6)
	var back_cam := create_tween().set_parallel(true)
	back_cam.tween_property(camera, "base_position", Vector3(0.0, 3.35, 8.45), 3.0).set_trans(Tween.TRANS_SINE)
	back_cam.tween_property(camera, "look_target", Vector3(0.0, 0.62, 1.3), 3.0).set_trans(Tween.TRANS_SINE)
	await get_tree().create_timer(2.0).timeout
	gs = GS.DONE
	set_meta("done_at", _now)
	if hud:
		hud.show_item("Empty Biscuit Plate", play_time, attempt, hunger, hunger_goal, eaten, breaches)
	last_biscuit_completed.emit(ITEM_ID)
	await get_tree().create_timer(4.0).timeout
	if hud and standalone:
		hud.show_replay()


# ================================================================ restart

func restart() -> void:
	Engine.time_scale = _saved_time_scale if _hitstop > 0.0 else Engine.time_scale
	get_tree().reload_current_scene()


func _intro() -> void:
	gs = GS.INTRO
	player.input_enabled = false
	if hud:
		hud.fade_in(2.4)
		hud.show_hint()
	await get_tree().create_timer(1.2).timeout
	# put the cursor on Bill's hand so nothing lurches when play begins
	player.snap_cursor_to_hand()
	player.input_enabled = true
	gs = GS.PLAY


# ================================================================== juice

func _juice(dt: float) -> void:
	_chime_cd = maxf(_chime_cd - dt, 0.0)
	_tense_cd = maxf(_tense_cd - dt, 0.0)
	var s := 0.0
	var near := false
	for d in diners:
		s = maxf(s, d.suspicion.get_value(player))
		if gs == GS.PLAY and player.speed() > 0.7 and d.gaze.sight > 0.3:
			var to := player.plane_pos - d.gaze.origin
			var ang := absf(d.gaze.dir.angle_to(to))
			var half := deg_to_rad(d.gaze.half_angle_deg)
			if ang > half and ang < half * 1.9 and to.length() < d.gaze.view_range:
				near = true
	_tension = lerpf(_tension, s, LBConst.damp(3.0, dt))
	if gs == GS.PLAY:
		audio.set_tension(_tension)
	# a successful dash right past someone's eyes earns a tiny chime
	if near:
		_near_miss += dt
	elif _near_miss > 0.25 and s < 0.3 and _chime_cd <= 0.0:
		audio.play_flat("chime", -20.0, _rng.randf_range(0.95, 1.1))
		_chime_cd = 6.0
		_near_miss = 0.0
	else:
		_near_miss = maxf(_near_miss - dt, 0.0)
	# exposure ring: lit = amber, lit AND moving = pulsing red
	var expose := 0.0
	for d in diners:
		expose = maxf(expose, d.gaze_visibility(player))
	if _expose_ring:
		var moving := player.speed() > 0.14 or player.chewing_t > 0.0
		var c := Color(1.0, 0.8, 0.3) if not moving else Color(1.0, 0.15, 0.05)
		var a := clampf(expose * 1.6, 0.0, 0.9) if gs == GS.PLAY else 0.0
		if moving:
			a *= 0.65 + 0.35 * sin(_now * 30.0)
		_expose_mat.albedo_color = Color(c.r, c.g, c.b, a)
		_expose_ring.visible = a > 0.02
		_expose_ring.global_position = LBConst.p2w(player.plane_pos, LBConst.TABLE_Y + 0.01)
	var i := 0
	while i < _ripples.size():
		var rp: Array = _ripples[i]
		rp[1] += dt
		var k: float = rp[1] / 0.7
		var mi: MeshInstance3D = rp[0]
		if k >= 1.0:
			mi.queue_free()
			_ripples.remove_at(i)
			continue
		var r: float = rp[2] * (1.0 - pow(1.0 - k, 3.0))
		mi.scale = Vector3(r, 0.02, r)
		(mi.material_override as StandardMaterial3D).albedo_color.a = (1.0 - k) * 0.7 * float(rp[3])
		i += 1
	# cursor target ring
	if _target_ring:
		_target_ring.visible = gs == GS.PLAY and player.use_mouse and player.target.distance_to(player.plane_pos) > 0.05
		_target_ring.global_position = LBConst.p2w(player.target, LBConst.TABLE_Y + 0.004)
	if camera:
		camera.focus = player.palm_world()
	if room:
		room.portraits_look_at(player.palm_world())
	if gs == GS.PLAY or gs == GS.BREAK_BEAT:
		var look := player.palm_world()
		bill.look_target = bill.look_target.lerp(look, LBConst.damp(2.0, dt))


# ================================================================== debug

func debug_jump_phase(p: int) -> void:
	_debug_reset_rivals()
	play_time = [0.0, 0.0, phase_times.x, phase_times.y, phase_times.z][p] + 0.5
	set_phase(p)
	for r in rivals:
		if r.activation_phase <= p:
			r.emerge()


## The last stretch: the guest is almost here.
func debug_jump_rush() -> void:
	_debug_reset_rivals()
	play_time = guest_time - rush_time + 1.0
	set_phase(LBConst.Phase.RETURN)
	for r in rivals:
		r.emerge()


## Bill's hand right by his mouth with food in it.
func debug_jump_home_stretch() -> void:
	_debug_reset_rivals()
	var f := random_free_food()
	if f == null:
		return
	player.force_release_all()
	player.plane_pos = Vector2(0.15, 3.9)
	f.plane_pos = player.plane_pos
	player.snap_cursor_to_hand()
	player.grab(f)


func debug_jump_ending() -> void:
	_debug_reset_rivals()
	hunger = hunger_goal
	_guest_arrives()


func _debug_reset_rivals() -> void:
	if gs != GS.PLAY:
		return
	for r in rivals:
		r.reset_rival()
	for d in diners:
		d.reset_state()
