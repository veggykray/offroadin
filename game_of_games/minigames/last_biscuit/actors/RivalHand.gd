class_name LBRivalHand
extends LBHand
## Another diner's secret hand. Obeys the same visibility rules as Bill:
## it freezes when it believes it is watched, can be caught, slapped and
## pinned, and it fights Bill (and the other rivals) for the biscuit.

enum Tactic { SNEAK, DARTER, FORK_BLOCKER, NAPKIN_CREEPER }
enum St { HIDDEN, EMERGING, ACTIVE, PRETEND, WITHDRAWING, OUT, SHAME, EATING }

@export var tactic: Tactic = Tactic.SNEAK
@export var activation_phase := 2
@export_group("Movement")
@export var max_speed := 0.85
@export var accel := 5.0
@export var decel := 16.0
@export_group("Caution")
## Watch level (0..1) at which the hand decides to freeze.
@export var freeze_threshold := 0.22
@export var freeze_reaction := 0.25
## Probability that a given watch episode is noticed at all.
@export var freeze_reliability := 0.95
## Seconds to wait after the coast is clear before moving again.
@export var resume_delay := 0.35
@export_group("Aggression")
## Chance per second to slap a nearby hand that holds the biscuit.
@export var slap_rate := 1.2
@export var snatch_rate := 1.6
@export_group("Tricks")
@export var drags_plate := false
@export var plants_fake := false
@export var emerge_time := 1.4
## Extra time a rival stays away after successfully eating something.
@export var digest_time := 10.0
@export var out_time := 12.0

var state: St = St.HIDDEN
var state_t := 0.0
var home := Vector2.ZERO
var watched := 0.0
var frozen := false
var goal := Vector2.ZERO
var ai_note := ""
var manager
var _watch_t := 0.0
var _clear_t := 0.0
var _episode_noticed := true
var _rng := RandomNumberGenerator.new()
var _plate_dragged := false
var _fake_planted := false
var _pretend_cd := 8.0
var _pretend_stage := 0
var _pretend_obj: LBTableObject
var _slap_cd := 0.0


func _ready() -> void:
	super()
	_rng.seed = 4242 + owner_index * 31
	active = false
	reach_scale = 0.0


func setup_owner(diner: LBDiner) -> void:
	owner_index = diner.index
	var side := diner.side
	home = Vector2(side * (LBConst.TABLE_HALF_W - 0.02), diner.seat.y + 0.12 * -side)
	shoulder = LBConst.p2w(diner.seat + Vector2(-side * 0.1, 0.0), LBConst.TABLE_Y + 0.42)
	sleeve_color = diner.palette_suit.lightened(0.12)
	skin_color = diner.palette_skin
	if visual:
		(visual as LBHandVisual).refresh_colors()
	radius = 0.09
	push_mass = 1.2
	visual_scale = 1.75
	sleeve_radius = 0.06
	plane_pos = home


func reset_rival() -> void:
	if held:
		release()
	if cover:
		undrape()
	state = St.HIDDEN
	active = false
	reach_scale = 0.0
	plane_pos = home
	vel = Vector2.ZERO
	stunned_t = 0.0
	pinned_by = null
	lift = 0.0
	frozen = false
	held_fork = false
	innocent = false
	_plate_dragged = false
	_fake_planted = false
	_pretend_stage = 0
	_pretend_cd = 8.0


func is_out() -> bool:
	return state == St.HIDDEN or state == St.OUT or state == St.WITHDRAWING or state == St.EATING


func emerge() -> void:
	if state != St.HIDDEN and state != St.OUT:
		return
	state = St.EMERGING
	state_t = 0.0
	active = true
	plane_pos = home
	vel = Vector2.ZERO
	held_fork = tactic == Tactic.FORK_BLOCKER
	if held_fork:
		radius = 0.13
	if tactic == Tactic.NAPKIN_CREEPER and manager:
		var n: LBTableObject = manager.give_napkin(self)
		if n:
			drape(n)


func withdraw(then_out := true) -> void:
	if held:
		release()
	if cover:
		undrape()
	state = St.WITHDRAWING
	state_t = 0.0
	set_meta("then_out", then_out)


func think(dt: float) -> void:
	state_t += dt
	_slap_cd = maxf(_slap_cd - dt, 0.0)
	_pretend_cd = maxf(_pretend_cd - dt, 0.0)
	match state:
		St.HIDDEN:
			active = false
			reach_scale = 0.0
		St.EMERGING:
			reach_scale = clampf(state_t / emerge_time, 0.0, 1.0)
			lift = lerpf(-0.18, 0.0, reach_scale)
			plane_pos = home
			if state_t >= emerge_time:
				reach_scale = 1.0
				lift = 0.0
				state = St.ACTIVE
				state_t = 0.0
		St.WITHDRAWING:
			var k := clampf(state_t / 1.6, 0.0, 1.0)
			plane_pos = plane_pos.lerp(home, LBConst.damp(3.0, dt))
			vel = Vector2.ZERO
			if plane_pos.distance_to(home) < 0.1:
				reach_scale = clampf(1.0 - (state_t - 0.6), 0.0, 1.0)
				lift = lerpf(0.0, -0.18, 1.0 - reach_scale)
			if reach_scale <= 0.0 or k >= 1.0 and state_t > 2.6:
				active = false
				reach_scale = 0.0
				held_fork = false
				state = St.OUT if get_meta("then_out", true) else St.HIDDEN
				state_t = 0.0
		St.OUT:
			active = false
			var wait := out_time + (digest_time if get_meta("digest", false) else 0.0)
			if state_t > wait and get_meta("digest", false):
				set_meta("digest", false)
			if state_t > wait and manager and manager.phase >= activation_phase and manager.rivals_allowed():
				emerge()
		St.ACTIVE:
			_active(dt)
		St.PRETEND:
			_pretend(dt)
		St.SHAME:
			_shame(dt)
		St.EATING:
			_eating(dt)


func _compute_watched() -> float:
	var w := 0.0
	if manager == null:
		return 0.0
	for dn in manager.diners:
		var diner := dn as LBDiner
		if diner.index == owner_index or diner.paused:
			continue
		var v := diner.gaze_visibility(self)
		# they can tell when someone is already looking their way
		if diner.focus_hand == self:
			v = maxf(v, 0.6)
		w = maxf(w, v)
	return w


func _max_suspicion_on_me() -> float:
	var s := 0.0
	if manager:
		for dn in manager.diners:
			s = maxf(s, (dn as LBDiner).suspicion.get_value(self))
	return s


func _active(dt: float) -> void:
	if not can_act():
		return
	watched = _compute_watched()
	# freeze decision with reaction time and imperfect attention
	if watched > freeze_threshold:
		if _watch_t == 0.0:
			_episode_noticed = _rng.randf() < freeze_reliability
		_watch_t += dt
		_clear_t = 0.0
		if _watch_t > freeze_reaction and _episode_noticed:
			frozen = true
	else:
		_watch_t = 0.0
		_clear_t += dt
		if _clear_t > resume_delay:
			frozen = false
	# comedic cover story when things get hot
	if _max_suspicion_on_me() > 0.5 and _pretend_cd <= 0.0 and held == null and manager:
		var bowl: LBTableObject = manager.nearest_of_kind(LBTableObject.Kind.SUGAR_BOWL, plane_pos)
		if bowl and bowl.plane_pos.distance_to(plane_pos) < 1.3:
			_start_pretend(bowl)
			return
	_choose_goal()
	var desired := Vector2.ZERO
	var spd := max_speed
	if manager and manager.phase >= LBConst.Phase.RETURN:
		spd *= 1.25
	if watched > 0.06 and not frozen:
		spd *= 0.55
	if not frozen:
		var to_g := goal - plane_pos
		desired = to_g.normalized() * minf(spd, to_g.length() * 4.0)
		desired += _avoidance() * spd * 0.8
	drive(dt, desired, accel, decel, spd)
	_act_at_goal(dt)


var _target: LBBiscuit = null
var _retarget_t := 0.0


## The food this hand is after. Sticky (re-thought every couple of seconds)
## so the hands commit to a plan instead of dithering.
func _target_biscuit() -> LBBiscuit:
	if manager == null:
		return null
	_retarget_t -= get_physics_process_delta_time()
	if _target != null and is_instance_valid(_target) and _target.on_table and _retarget_t > 0.0 \
			and (_target.held_by == null or _target.held_by == self or _target.held_by.plane_pos.distance_to(plane_pos) < 1.2):
		return _target
	_retarget_t = _rng.randf_range(1.5, 3.0)
	var best: LBBiscuit = null
	var best_score := -INF
	for b in manager.world.biscuits():
		var bb := b as LBBiscuit
		if bb.is_fake and (_fake_planted or bb.has_meta("planted_by") and bb.get_meta("planted_by") == self):
			continue
		if not bb.is_fake and not bb.is_real_prize():
			continue
		var held_by_other: bool = bb.held_by != null and bb.held_by != self
		var sc := bb.value() * 0.35 - bb.plane_pos.distance_to(plane_pos) * 0.6
		if held_by_other:
			sc -= 0.6 if bb.held_by.plane_pos.distance_to(plane_pos) < 0.8 else 9.0
		if bb.is_guest() and tactic == Tactic.SNEAK:
			sc += 1.2              # the Cheat has eyes only for the guest's biscuit
		# don't all pile onto the same plate: prefer food other rivals aren't after
		for r in manager.rivals:
			if r != self and r._target == bb:
				sc -= 0.5
		if sc > best_score:
			best_score = sc
			best = bb
	_target = best
	return best


func start_eating(_mouth: Vector3) -> void:
	state = St.EATING
	state_t = 0.0
	innocent = true
	ai_note = "eating"


func _eating(dt: float) -> void:
	# hand up to the mouth, a bite, then back down looking innocent
	vel = Vector2.ZERO
	lift = lerpf(lift, 0.42 if state_t < 0.9 else 0.0, LBConst.damp(6.0, dt))
	if state_t > 2.2:
		lift = 0.0
		innocent = false
		_target = null
		# a moment to digest (and look innocent) before the next raid
		withdraw(true)
		set_meta("digest", true)


func _choose_goal() -> void:
	var b := _target_biscuit()
	if held is LBBiscuit:
		goal = home
		ai_note = "carry home to eat"
		var p: LBHand = manager.player if manager else null
		if p and p.plane_pos.distance_to(plane_pos) < 0.45:
			goal += (plane_pos - p.plane_pos).normalized() * 0.3
		return
	if held != null and held.kind == LBTableObject.Kind.BISCUIT_PLATE:
		goal = home
		ai_note = "drag plate"
		return
	if b == null:
		goal = home.lerp(LBConst.BISCUIT_HOME, 0.3)
		ai_note = "idle"
		return
	if b.held_by != null and b.held_by != self:
		goal = (b.held_by as LBHand).plane_pos
		ai_note = "chase holder"
		return
	if tactic == Tactic.FORK_BLOCKER and manager:
		var p: LBHand = manager.player
		var d_p := p.plane_pos.distance_to(b.plane_pos)
		var d_me := plane_pos.distance_to(b.plane_pos)
		if d_p > 0.3 and d_me < d_p:
			goal = b.plane_pos + (p.plane_pos - b.plane_pos).normalized() * 0.2
			ai_note = "fork block"
			return
	if drags_plate and not _plate_dragged and manager and b.is_guest():
		var plate: LBTableObject = manager.plate
		if plate and plate.plane_pos.distance_to(b.plane_pos) < 0.1 and plate.plane_pos.distance_to(home) > 1.0:
			goal = plate.plane_pos + (home - plate.plane_pos).normalized() * 0.13
			ai_note = "grab plate rim"
			return
	goal = b.plane_pos
	ai_note = "go " + b.food_type


func _act_at_goal(dt: float) -> void:
	if frozen or manager == null:
		return
	var b := _target_biscuit()
	# made it home with food
	if held is LBBiscuit and plane_pos.distance_to(home) < 0.14:
		manager.on_rival_escaped(self, held)
		return
	# plate dragging
	if drags_plate and not _plate_dragged and held == null and ai_note == "grab plate rim" \
			and plane_pos.distance_to(goal) < 0.06:
		grab(manager.plate)
		set_meta("drag_start", manager.plate.plane_pos)
		return
	if held != null and held.kind == LBTableObject.Kind.BISCUIT_PLATE:
		var start: Vector2 = get_meta("drag_start", held.plane_pos)
		if held.plane_pos.distance_to(start) > 0.55 or watched > freeze_threshold:
			release()
			_plate_dragged = true
		elif manager.noise_sys and _rng.randf() < dt * 2.0:
			manager.noise_sys.emit_noise(plane_pos, 0.08, self, "clink")
		return
	if b == null:
		return
	var holder := b.held_by as LBHand
	if holder == null and held == null and b.plane_pos.distance_to(plane_pos) < 0.1:
		manager.rival_grab(self, b)
		return
	if holder != null and holder != self and holder.plane_pos.distance_to(plane_pos) < 0.2:
		if _slap_cd <= 0.0 and _rng.randf() < slap_rate * dt:
			_slap_cd = 1.4
			manager.rival_slap(self, holder)
		elif held == null and _rng.randf() < snatch_rate * dt and holder.plane_pos.distance_to(plane_pos) < 0.12:
			manager.rival_grab(self, b)


func _avoidance() -> Vector2:
	var push := Vector2.ZERO
	if manager == null:
		return push
	for o in manager.world.objects:
		var obj := o as LBTableObject
		if not obj.hand_collides or not obj.on_table:
			continue
		var d := plane_pos - obj.plane_pos
		var r := obj.radius + radius + 0.08
		var dist := d.length()
		if dist < r and dist > 0.001:
			push += d / dist * (1.0 - dist / r)
	return push.limit_length(1.0)


func _start_pretend(bowl: LBTableObject) -> void:
	state = St.PRETEND
	state_t = 0.0
	_pretend_stage = 0
	_pretend_obj = bowl
	innocent = true
	ai_note = "pretend: sugar"


func _pretend(dt: float) -> void:
	if not can_act():
		return
	if state_t > 9.0 or (_pretend_obj == null or not is_instance_valid(_pretend_obj)):
		_end_pretend()
		return
	var spd := 0.6
	match _pretend_stage:
		0:
			goal = _pretend_obj.plane_pos + (plane_pos - _pretend_obj.plane_pos).normalized() * 0.09
			if plane_pos.distance_to(goal) < 0.05:
				var cube: LBTableObject = manager.spawn_sugar_cube(plane_pos)
				grab(cube)
				_pretend_stage = 1
				state_t = 0.0
		1:
			# hold it up innocently for a moment
			lift = lerpf(lift, 0.12, LBConst.damp(4.0, dt))
			goal = plane_pos
			if state_t > 1.4:
				_pretend_stage = 2
		2:
			lift = lerpf(lift, 0.0, LBConst.damp(4.0, dt))
			var cup: LBTableObject = manager.nearest_of_kind(LBTableObject.Kind.CUP, home)
			goal = cup.plane_pos if cup else home
			if plane_pos.distance_to(goal) < 0.08 or state_t > 4.0:
				var c := release()
				if c:
					manager.world.remove_object(c)
					manager.noise_sys.emit_noise(plane_pos, 0.06, null, "clink")
				_pretend_stage = 3
				state_t = 0.0
		3:
			goal = home.lerp(LBConst.BISCUIT_HOME, 0.25)
			if state_t > 1.2:
				innocent = false
				_pretend_cd = 22.0
				state = St.ACTIVE
				state_t = 0.0
	var to_g := goal - plane_pos
	drive(dt, to_g.normalized() * minf(spd, to_g.length() * 4.0), accel, decel, spd)


func _end_pretend() -> void:
	if held and held.kind == LBTableObject.Kind.SUGAR_CUBE:
		var c := release()
		if c and manager:
			manager.world.remove_object(c)
	lift = 0.0
	innocent = false
	_pretend_cd = 22.0
	state = St.ACTIVE
	state_t = 0.0


func start_shame(plate_pos: Vector2) -> void:
	state = St.SHAME
	state_t = 0.0
	set_meta("shame_goal", plate_pos)
	innocent = true


func _shame(dt: float) -> void:
	var g: Vector2 = get_meta("shame_goal", LBConst.BISCUIT_HOME)
	# lost the biscuit (slapped?) or can't get there: slink away regardless
	if (held == null and state_t > 0.2) or state_t > 9.0:
		if held:
			release()
		innocent = false
		withdraw(true)
		if manager:
			manager.on_shame_done(self)
		return
	if state_t < 1.6:
		# guilty pause: biscuit raised halfway to the mouth
		lift = lerpf(lift, 0.22, LBConst.damp(3.0, dt))
		vel = Vector2.ZERO
		return
	lift = lerpf(lift, 0.0, LBConst.damp(2.0, dt))
	var to_g := g - plane_pos
	drive(dt, to_g.normalized() * minf(0.45, to_g.length() * 3.0), accel, decel, 0.45)
	if to_g.length() < 0.08 and state_t > 2.5:
		var b := release()
		if b:
			b.plane_pos = g
			b.vel = Vector2.ZERO
		innocent = false
		withdraw(true)
		if manager:
			manager.on_shame_done(self)
