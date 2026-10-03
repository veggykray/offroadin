class_name LBManager
extends Node3D
## THE LAST BISCUIT - orchestrator.
## Wires the table world, diners, hands, noise, comedy events and the ending,
## runs the escalation phases, the caught sequence and the dog finale.
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
@export_group("Escalation")
## Approach progress (0 = Bill's end, 1 = biscuit) that summons the 2nd hand.
@export var second_hand_progress := 0.45
@export var third_hand_progress := 0.8
@export var phase2_max_time := 28.0
@export var phase3_max_time := 30.0
@export var return_alertness := 1.15
@export var rival_out_time_return := 6.0
@export_group("Juice")
@export var slap_loudness := 0.6
@export var hitstop_time := 0.06
@export var slap_jump_radius := 0.45

var gs: GS = GS.INTRO
var phase := 1
var phase_time := 0.0
var play_time := 0.0
var attempt := 1
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
	_spawn_biscuit(LBConst.BISCUIT_HOME)
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
	# empty places at the far end (and the head of the table) for gloom
	for p in [Vector3(-1.48, 0, -4.3), Vector3(1.48, 0, -4.3)]:
		var c := LBMesh.pivot(self, p, "EmptyChair")
		c.rotation.y = -PI * 0.5 if p.x < 0.0 else PI * 0.5
		var wood := LBMat.dark_wood()
		LBMesh.add(c, LBMesh.box_mesh(Vector3(0.5, 0.06, 0.48)), wood, Vector3(0, 0.46, 0.12))
		LBMesh.add(c, LBMesh.box_mesh(Vector3(0.5, 1.15, 0.05)), wood, Vector3(0, 1.05, 0.35))
		LBMesh.add(c, LBMesh.box_mesh(Vector3(0.38, 0.85, 0.02)), LBMat.velvet(), Vector3(0, 1.02, 0.32))
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


func _spawn_biscuit(pos: Vector2, fraction := 1.0, fake := false) -> LBBiscuit:
	var b := LBBiscuit.new()
	b.setup(pos, fraction, fake)
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


# ================================================================ helpers

func real_biscuit() -> LBBiscuit:
	var best: LBBiscuit = null
	for b in world.biscuits():
		if b.is_fake:
			continue
		if best == null or b.size_fraction > best.size_fraction:
			best = b
	return best


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
			KEY_5: debug_jump_return()
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
		_check_win()
	_juice(dt)


func _update_phase(dt: float) -> void:
	var prog := LBConst.approach_progress(player.plane_pos)
	var b := real_biscuit()
	var want := phase
	if b and b.held_by == player:
		want = LBConst.Phase.RETURN
	elif phase < LBConst.Phase.RETURN:
		if phase < 2 and prog >= second_hand_progress:
			want = 2
		if phase == 2 and (prog >= third_hand_progress or phase_time > phase2_max_time):
			want = 3
		if phase == 3 and (phase_time > phase3_max_time or (b and b.held_by != null)):
			want = 4
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
	alertness = return_alertness if p >= LBConst.Phase.RETURN else 1.0
	if p >= LBConst.Phase.RETURN:
		for r in rivals:
			r.out_time = rival_out_time_return
			if r.state == LBRivalHand.St.HIDDEN:
				r.activation_phase = mini(r.activation_phase, LBConst.Phase.RETURN)
	phase_changed.emit(p)


func _check_win() -> void:
	var b := player.held as LBBiscuit
	if b == null or not b.is_real_prize() or b.is_contested():
		return
	if player.plane_pos.y > LBConst.HOME_ZONE_Z:
		_ending(b)


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
	if b.size_fraction < 0.99 or b.is_fake or not is_instance_valid(b):
		return
	var holders := b.holders.duplicate()
	for h in holders:
		(h as LBHand).release()
	var dir := Vector2.from_angle(_rng.randf() * TAU)
	var big := _spawn_biscuit(b.plane_pos + dir * 0.03, 0.62)
	var small := _spawn_biscuit(b.plane_pos - dir * 0.03, 0.38)
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
	audio.play_flat("pluck", -4.0)
	audio.set_duck(0.0)
	audio.set_tension(0.0)
	for r in rivals:
		r.forced_freeze = true
	var hand_at := player.palm_world()
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
	# someone calmly restores the biscuit with serving tongs
	await _tongs_restore(d)
	for o in diners:
		o.reset_state()
	attempt += 1
	set_phase(1)
	for r in rivals:
		r.reset_rival()
		_tune_rival_out(r)
	player.vel = Vector2.ZERO
	player.input_enabled = true
	audio.set_duck(1.0)
	bill.look_target = LBConst.p2w(LBConst.BISCUIT_HOME, 1.0)
	gs = GS.PLAY


func _tune_rival_out(r: LBRivalHand) -> void:
	r.out_time = 12.0


func _tongs_restore(by: LBDiner) -> void:
	var tongs := _make_tongs()
	var start := by.head_world() + Vector3(-by.side * 0.2, -0.3, 0)
	tongs.global_position = start
	# put the plate back first, perfectly centred
	if plate:
		var pt := create_tween()
		pt.tween_property(plate, "plane_pos", LBConst.BISCUIT_HOME, 0.8).set_trans(Tween.TRANS_SINE)
	var pieces := world.biscuits()
	var target := LBConst.p2w(LBConst.BISCUIT_HOME, LBConst.TABLE_Y + 0.12)
	var src := target
	var b := real_biscuit()
	if b:
		src = LBConst.p2w(b.plane_pos, LBConst.TABLE_Y + 0.08)
	var t1 := create_tween()
	t1.tween_property(tongs, "global_position", src + Vector3(0, 0.05, 0), 0.9).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await t1.finished
	audio.play_at("tongs", src, -6.0)
	tongs.set_meta("closed", true)
	for p in pieces:
		p.visible = false
	var carry := LBMesh.add(tongs, LBProps.biscuit_mesh(1.0, 1.0), LBMat.shader_unique("biscuit.gdshader"), Vector3(0, -0.04, -0.26))
	var t2 := create_tween()
	t2.tween_property(tongs, "global_position", target + Vector3(0, 0.12, 0), 1.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await t2.finished
	var t3 := create_tween()
	t3.tween_property(tongs, "global_position", target + Vector3(0, -0.02, 0), 0.5)
	await t3.finished
	for p in pieces:
		world.remove_object(p)
	_spawn_biscuit(LBConst.BISCUIT_HOME)
	carry.queue_free()
	audio.play_at("clink", target, -10.0, 1.3)
	var t4 := create_tween()
	t4.tween_property(tongs, "global_position", start, 0.9).set_trans(Tween.TRANS_SINE)
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
	# Everyone saw THAT. Glares. The biscuit is slowly put back.
	var owner_d := diners[r.owner_index]
	r.start_shame(plate.plane_pos if plate else LBConst.BISCUIT_HOME)
	audio.play_at("gulp", owner_d.head_world(), -2.0)
	for d in diners:
		if d == owner_d:
			d.look_at_world(LBConst.p2w(r.plane_pos, 1.0), 4.0, 2.0)
			continue
		d.glare = 1.0
		d.look_at_world(owner_d.head_world(), 4.5, 2.5)
	await get_tree().create_timer(4.5).timeout
	for d in diners:
		d.glare = 0.0


func on_shame_done(_r: LBRivalHand) -> void:
	pass


# ================================================================= ending

func _ending(b: LBBiscuit) -> void:
	gs = GS.ENDING
	player.input_enabled = false
	player.vel = Vector2.ZERO
	for r in rivals:
		r.forced_freeze = true
	audio.set_tension(0.0)
	audio.play_flat("sting", -3.0)
	bill.look_target = player.palm_world()
	# rivals slink away
	for r in rivals:
		if not r.is_out():
			r.forced_freeze = false
			r.withdraw(false)
	for d in diners:
		d.paused = true
	# Bill raises it in triumph
	var tw := create_tween().set_parallel(true)
	tw.tween_property(player, "lift", 0.62, 0.9).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(player, "plane_pos", Vector2(0.2, 4.95), 0.9).set_trans(Tween.TRANS_SINE)
	await tw.finished
	bill.look_target = player.palm_world() + Vector3(0, 0.1, 0)
	# a tiny, proud wiggle
	var wig := create_tween()
	for i in 3:
		wig.tween_property(player, "palm_up", 0.12, 0.08)
		wig.tween_property(player, "palm_up", 0.0, 0.08)
	await get_tree().create_timer(0.8).timeout
	# CHOMP
	var dog := bill.dog
	dog.visible = true
	dog.scale = Vector3.ONE * 1.5
	var palm := player.palm_world()
	var side := Vector3(0.28, 0.0, -0.55)
	dog.global_position = palm + side + Vector3(0, -1.2, 0)
	dog.look_at(palm + Vector3(0, -0.05, 0), Vector3.UP)
	bill.dog_jaw.rotation.x = 0.8
	var up := create_tween()
	up.tween_property(dog, "global_position", palm + side * 0.45 + Vector3(0, -0.05, 0), 0.14).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	await up.finished
	audio.play_at("chomp", palm, 4.0)
	bill.dog_jaw.rotation.x = 0.0
	camera.bump(Vector3(0.5, -1.0, 0.0), 0.09)
	camera.shake(0.6)
	player.release()
	world.remove_object(b)
	for d in diners:
		d.neutral_lock = true
	for o in world.objects:
		if o.on_table and o.plane_pos.distance_to(player.plane_pos) < 0.9:
			o.bump(o.plane_pos - player.plane_pos, 0.4)
			if o.mass < 0.4:
				o.jump(0.5)
	# a satisfied chew
	var chew := create_tween()
	for i in 2:
		chew.tween_property(bill.dog_jaw, "rotation:x", 0.25, 0.09)
		chew.tween_property(bill.dog_jaw, "rotation:x", 0.0, 0.09)
	await get_tree().create_timer(0.42).timeout
	var down := create_tween()
	down.tween_property(dog, "global_position", dog.global_position + Vector3(0.15, -1.4, 0.15), 0.24).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await down.finished
	dog.visible = false
	# silence. Bill looks at his empty hand.
	audio.set_duck(0.0)
	await get_tree().create_timer(1.4).timeout
	var look := create_tween().set_parallel(true)
	look.tween_property(player, "lift", 0.3, 1.2).set_trans(Tween.TRANS_SINE)
	look.tween_property(player, "palm_up", 1.0, 1.2).set_trans(Tween.TRANS_SINE)
	bill.look_target = player.palm_world() + Vector3(0, -0.1, 0)
	await look.finished
	await get_tree().create_timer(2.2).timeout
	gs = GS.DONE
	set_meta("done_at", _now)
	audio.set_duck(0.6)
	if hud:
		hud.show_item("Empty Biscuit Plate", play_time, attempt)
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
	# cursor target ring
	if _target_ring:
		_target_ring.visible = gs == GS.PLAY and player.use_mouse and player.target.distance_to(player.plane_pos) > 0.05
		_target_ring.global_position = LBConst.p2w(player.target, LBConst.TABLE_Y + 0.004)
	if camera:
		camera.focus = player.palm_world()
	if room:
		room.portraits_look_at(player.palm_world())
	if gs == GS.PLAY or gs == GS.BREAK_BEAT:
		var b := real_biscuit()
		var look := player.palm_world()
		if b and b.held_by != player and player.plane_pos.y > 2.5:
			look = look.lerp(LBConst.p2w(b.plane_pos), 0.5)
		bill.look_target = bill.look_target.lerp(look, LBConst.damp(2.0, dt))


# ================================================================== debug

func debug_jump_phase(p: int) -> void:
	_debug_reset_rivals()
	var z := lerpf(LBConst.BILL_HAND_HOME.y, LBConst.BISCUIT_HOME.y, [0.0, 0.0, 0.5, 0.82, 0.9][p])
	player.plane_pos = Vector2(0.1, z)
	player.snap_cursor_to_hand()
	set_phase(p)
	for r in rivals:
		if r.activation_phase <= p:
			r.emerge()


func debug_jump_return() -> void:
	_debug_reset_rivals()
	var b := real_biscuit()
	if b == null:
		b = _spawn_biscuit(LBConst.BISCUIT_HOME)
	player.force_release_all()
	player.plane_pos = b.plane_pos + Vector2(0, 0.05)
	player.snap_cursor_to_hand()
	player.grab(b)
	set_phase(LBConst.Phase.RETURN)
	for r in rivals:
		r.emerge()


func debug_jump_home_stretch() -> void:
	debug_jump_return()
	player.plane_pos = Vector2(0.1, 3.9)
	player.snap_cursor_to_hand()


func debug_jump_ending() -> void:
	debug_jump_return()
	player.plane_pos = Vector2(0.1, LBConst.HOME_ZONE_Z + 0.1)
	player.snap_cursor_to_hand()
	for r in rivals:
		r.reset_rival()


func _debug_reset_rivals() -> void:
	if gs != GS.PLAY:
		return
	for r in rivals:
		r.reset_rival()
	for d in diners:
		d.reset_state()
