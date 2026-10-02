class_name DarkCreature
extends Node3D
## The large unknown creature.
##
## UNSEEN: while no part is lit it occasionally *relocates* (an instant jump, never visible
## travel) to a new spot around Bill — usually a little closer, sometimes sideways, sometimes
## further — and its movement is only communicated through positional sound.
## LIT: it stops. If the light stays on it long enough it slowly recoils. It never attacks.
## FINAL: stops stalking, emits a beacon sound from its TouchAnchor, recoils from direct light.
##
## Visual-agnostic: art is reached only through anchors (see CreaturePlaceholderVisual) and
## illumination only through an IlluminatedObject.

signal state_changed(new_state: int, old_state: int)
signal repositioned(new_position: Vector3)

enum State { DORMANT, STALKING, FROZEN, RECOILING, FINAL_WAITING, FINAL_RECOIL, REVEALED }

@export var target_path: NodePath
@export var hand_light_path: NodePath
@export var camera_path: NodePath
@export var detector_path: NodePath = ^"Detector"
@export var visual_path: NodePath = ^"Visual"
@export var eye_anchor_name := "EyeAnchor"
@export var touch_anchor_name := "TouchAnchor"
@export var reveal_point_prefix := "RevealPoint"

@export_group("Stalking (unseen)")
## Silent, motionless opening period so the start feels exploratory.
@export var dormant_time := 20.0
## Random seconds between relocations (scaled by threat level).
@export var reposition_interval := Vector2(7.0, 14.0)
## The creature must have been unlit at least this long before it may relocate.
@export var dark_time_before_reposition := 1.5
@export var start_distance := 32.0
@export var max_distance := 42.0
## Closest the creature's centre may come to Bill, per threat level (memories collected).
@export var min_distance_per_threat: Array[float] = [16.0, 12.5, 10.0, 10.0]
@export var interval_scale_per_threat: Array[float] = [1.0, 0.85, 0.65, 0.65]
## Metres gained per normal relocation.
@export var approach_step := Vector2(2.0, 6.0)
@export_range(0.0, 1.0) var orbit_chance := 0.35
@export_range(0.0, 1.0) var retreat_chance := 0.12
@export var retreat_step := Vector2(4.0, 9.0)
@export var max_yaw_degrees := 18.0
## Random depth (Z) offset of the creature's centre relative to Bill.
@export var depth_offset_range := Vector2(-3.0, 0.0)
## No body sample may end up closer to Bill than this after relocating.
@export var player_clearance := 2.5
## No part may come closer to the camera than Bill's plane + this.
@export var max_forward_depth := 0.8
@export var candidate_attempts := 16
@export var prefer_off_screen := true

@export_group("Illuminated")
## Seconds of continuous light before it starts to recoil.
@export var freeze_before_recoil := 2.0
@export var recoil_speed := 1.3
@export var recoil_ramp_time := 1.5
@export var recoil_max_distance := 7.0
## Extra delay before relocating after having been lit.
@export var post_light_cooldown := 5.0

@export_group("Final phase")
@export var final_distance := 24.0
@export var final_recoil_speed := 2.2
@export var final_recoil_max_distance := 5.0

@export_group("Reveal")
@export var reveal_light_energy := 0.8
@export var reveal_light_range := 10.0
@export var reveal_light_color := Color(0.78, 0.72, 0.66)
@export var reveal_time := 4.0

@export_group("Audio")
## Leave arrays empty to use generated placeholder sounds.
@export var scrape_sounds: Array[AudioStream] = []
@export var breath_sounds: Array[AudioStream] = []
@export var move_sounds: Array[AudioStream] = []
@export var impact_sounds: Array[AudioStream] = []
@export var beacon_sound: AudioStream
@export var sfx_volume_db := 0.0
@export var beacon_volume_db := 0.0
@export var sound_unit_size := 7.0
@export var sound_max_distance := 90.0
@export var breath_interval := Vector2(9.0, 20.0)
@export var distant_impact_interval := Vector2(22.0, 50.0)
@export var distant_impact_distance := 40.0

var state: State = State.DORMANT
var threat_level := 0

var _target: Node3D
var _hand: IlluminationSource
var _camera: Camera3D
var _detector: IlluminatedObject
var _visual: Node3D
var _sfx: AudioStreamPlayer3D
var _distant: AudioStreamPlayer3D
var _beacon: AudioStreamPlayer3D

var _dormant_left := 0.0
var _reposition_left := 0.0
var _dark_time := 0.0
var _hold_left := 0.0
var _breath_left := 0.0
var _impact_left := 0.0
var _recoil_speed_now := 0.0
var _recoil_travelled := 0.0
var _recoil_dir := Vector3.LEFT
var _pending_discovery: AudioStream
var _reveal_lights: Array[OmniLight3D] = []


func _ready() -> void:
	_target = get_node_or_null(target_path) as Node3D
	_hand = get_node_or_null(hand_light_path) as IlluminationSource
	_camera = get_node_or_null(camera_path) as Camera3D
	_detector = get_node_or_null(detector_path) as IlluminatedObject
	_visual = get_node_or_null(visual_path) as Node3D
	_fill_default_sounds()
	_sfx = _make_player("Sfx", sfx_volume_db)
	_distant = _make_player("Distant", sfx_volume_db - 3.0)
	_beacon = _make_player("Beacon", beacon_volume_db)
	_beacon.stream = beacon_sound
	_beacon.unit_size = sound_unit_size * 1.6
	_beacon.max_distance = sound_max_distance * 1.5
	if _detector:
		_detector.refresh_samples()
	_dormant_left = dormant_time
	_breath_left = randf_range(breath_interval.x, breath_interval.y)
	_impact_left = randf_range(distant_impact_interval.x, distant_impact_interval.y)
	_reset_reposition_timer()
	_initial_place.call_deferred()


func _initial_place() -> void:
	if _target:
		_relocate(start_distance, true)


# --- Public API -------------------------------------------------------------------------

func get_state_name() -> String:
	return State.keys()[state]


func is_illuminated() -> bool:
	return _detector != null and _detector.is_lit


func get_detector() -> IlluminatedObject:
	return _detector


func set_threat_level(level: int) -> void:
	threat_level = maxi(level, 0)


func get_anchor(anchor_name: String) -> Node3D:
	if _visual == null:
		return null
	return _visual.find_child(anchor_name, true, false) as Node3D


func get_touch_point() -> Vector3:
	var a := get_anchor(touch_anchor_name)
	return a.global_position if a else global_position


## Can a scare event move it right now (unseen and stalking)?
func can_be_staged() -> bool:
	return (state == State.STALKING or state == State.DORMANT) and not is_illuminated()


## Silently teleports so the named anchor sits at world_point, facing the camera (+Z).
## It then holds still for hold_time seconds (or until lit).
func stage_anchor_at(anchor_name: String, world_point: Vector3, hold_time: float,
		discovery_sound: AudioStream = null) -> bool:
	var anchor := get_anchor(anchor_name)
	if anchor == null:
		return false
	var local := global_transform.affine_inverse() * anchor.global_position
	var b := Basis(Vector3.BACK, randf_range(-0.35, 0.35))
	global_transform = Transform3D(b, world_point - b * local)
	_hold_left = hold_time
	_dark_time = 0.0
	_pending_discovery = discovery_sound
	if state == State.DORMANT:
		_set_state(State.STALKING)
	return true


func force_reposition() -> void:
	if state == State.STALKING or state == State.DORMANT:
		_reposition_step()


func enter_final_phase() -> void:
	_hold_left = 0.0
	_set_state(State.FINAL_WAITING)
	var anchor := get_anchor(touch_anchor_name)
	if _target and anchor:
		var bill := _target.global_position
		var local := global_transform.affine_inverse() * anchor.global_position
		var best := Transform3D()
		var best_score := -INF
		for i in candidate_attempts:
			var ang := randf() * TAU
			var b := Basis(Vector3.BACK, randf() * TAU)
			var p := bill + Vector3(cos(ang), sin(ang), 0.0) * final_distance
			var xf := Transform3D(b, p - b * local)
			var score := randf()
			if _camera and _camera.is_position_in_frustum(xf.origin):
				score -= 1.0
			if score > best_score:
				best_score = score
				best = xf
		global_transform = best
	if _beacon.stream:
		_beacon.global_position = get_touch_point()
		_beacon.play()


## Completion: gentle lights on parts of the body. Partial on purpose.
func reveal() -> void:
	_set_state(State.REVEALED)
	if _visual:
		for c in _visual.find_children(reveal_point_prefix + "*", "Node3D", true, false):
			var l := OmniLight3D.new()
			l.omni_range = reveal_light_range
			l.omni_attenuation = 1.2
			l.light_color = reveal_light_color
			l.light_energy = 0.0
			l.shadow_enabled = true
			(c as Node3D).add_child(l)
			_reveal_lights.append(l)
			create_tween().tween_property(l, "light_energy", reveal_light_energy, reveal_time) \
					.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if _beacon.playing:
		var tw := create_tween()
		tw.tween_property(_beacon, "volume_db", -50.0, reveal_time)
		tw.tween_callback(_beacon.stop)


# --- State machine ----------------------------------------------------------------------

func _process(delta: float) -> void:
	if _detector == null:
		return
	var lit := _detector.is_lit
	match state:
		State.DORMANT:
			_dormant_left -= delta
			if lit:
				_set_state(State.FROZEN)
			elif _dormant_left <= 0.0:
				_set_state(State.STALKING)
		State.STALKING:
			_update_ambient_audio(delta)
			if lit:
				_set_state(State.FROZEN)
				return
			_dark_time += delta
			if _hold_left > 0.0:
				_hold_left -= delta
				return
			_reposition_left -= delta
			if _reposition_left <= 0.0 and _dark_time >= dark_time_before_reposition:
				_reposition_step()
				_reset_reposition_timer()
		State.FROZEN:
			if not lit:
				_set_state(State.STALKING)
			elif _detector.continuous_lit_time >= freeze_before_recoil:
				_set_state(State.RECOILING)
		State.RECOILING:
			_update_recoil(delta, lit, recoil_speed, recoil_max_distance)
			if not lit and _recoil_speed_now <= 0.01:
				_set_state(State.STALKING)
		State.FINAL_WAITING:
			if lit:
				_set_state(State.FINAL_RECOIL)
		State.FINAL_RECOIL:
			_update_recoil(delta, lit, final_recoil_speed, final_recoil_max_distance)
			if not lit and _recoil_speed_now <= 0.01:
				_set_state(State.FINAL_WAITING)
		State.REVEALED:
			pass
	if _beacon.playing:
		_beacon.global_position = get_touch_point()


func _set_state(s: State) -> void:
	if s == state:
		return
	var old := state
	state = s
	match s:
		State.FROZEN:
			_hold_left = 0.0
			if _pending_discovery:
				_play_at(_sfx, _pending_discovery, _detector.brightest_point, -6.0)
				_pending_discovery = null
		State.STALKING:
			_dark_time = 0.0
			_reposition_left = maxf(_reposition_left, post_light_cooldown)
		State.RECOILING, State.FINAL_RECOIL:
			_recoil_travelled = 0.0
			_recoil_speed_now = 0.0
			_play_at(_sfx, _pick(scrape_sounds), _nearest_part_position(), -8.0)
	if _visual and _visual.has_method("set_idle_motion"):
		_visual.call("set_idle_motion", s != State.FROZEN and s != State.RECOILING and s != State.FINAL_RECOIL)
	state_changed.emit(s, old)


func _update_recoil(delta: float, lit: bool, speed: float, max_dist: float) -> void:
	if lit and _detector.brightest_source:
		var from := _detector.brightest_source.global_position
		var d := _detector.brightest_point - from
		if d.length() < 0.1:
			d = global_position - from
		d.z = -absf(d.length()) * 0.35  # retreat slightly into depth as well
		_recoil_dir = d.normalized()
	var want := speed if (lit and _recoil_travelled < max_dist) else 0.0
	_recoil_speed_now = move_toward(_recoil_speed_now, want, speed / maxf(recoil_ramp_time, 0.01) * delta)
	var step := _recoil_speed_now * delta
	global_position += _recoil_dir * step
	_recoil_travelled += step


func _reset_reposition_timer() -> void:
	var k := _threat_value(interval_scale_per_threat, 1.0)
	_reposition_left = randf_range(reposition_interval.x, reposition_interval.y) * k


func _threat_value(arr: Array[float], fallback: float) -> float:
	if arr.is_empty():
		return fallback
	return arr[clampi(threat_level, 0, arr.size() - 1)]


# --- Relocation -------------------------------------------------------------------------

func _reposition_step() -> void:
	if _target == null:
		return
	var to_me := global_position - _target.global_position
	to_me.z = 0.0
	var cur := to_me.length()
	var min_d := _threat_value(min_distance_per_threat, 10.0)
	var r := randf()
	var d: float
	if r < retreat_chance:
		d = cur + randf_range(retreat_step.x, retreat_step.y)
	elif r < retreat_chance + orbit_chance:
		d = cur * randf_range(0.9, 1.05)
	else:
		d = cur - randf_range(approach_step.x, approach_step.y)
	d = clampf(d, min_d, max_distance)
	if _relocate(d, false):
		_play_at(_sfx, _pick(move_sounds if randf() < 0.55 else scrape_sounds), _nearest_part_position())


## Teleport to `dist` from Bill, picking the best of several random candidates.
func _relocate(dist: float, silent: bool) -> bool:
	var bill := _target.global_position
	var samples := _sample_locals()
	var best := Transform3D()
	var best_score := -INF
	for i in candidate_attempts:
		var ang := randf() * TAU
		var b := Basis.from_euler(Vector3(0.0, deg_to_rad(randf_range(-max_yaw_degrees, max_yaw_degrees)), randf() * TAU))
		var origin := bill + Vector3(cos(ang), sin(ang), 0.0) * dist
		origin.z = bill.z + randf_range(depth_offset_range.x, depth_offset_range.y)
		var xf := Transform3D(b, origin)
		var score := _score(xf, samples, bill)
		if score > best_score:
			best_score = score
			best = xf
	if best_score == -INF:
		return false
	global_transform = best
	repositioned.emit(global_position)
	if not silent:
		_dark_time = 0.0
	return true


func _score(xf: Transform3D, samples: Array, bill: Vector3) -> float:
	for s in samples:
		var p: Vector3 = xf * (s[0] as Vector3)
		var rad: float = s[1]
		if p.distance_to(bill) - rad < player_clearance:
			return -INF
		if p.z - rad > bill.z + max_forward_depth:
			return -INF
		# Never arrive inside the light's reach, even if it's off right now — that would turn
		# every relocation into a cheap jump-scare. (Scare events do that deliberately instead.)
		if _hand and _hand.get_illumination_at(p, rad, true) > 0.0:
			return -INF
	var score := randf()
	if prefer_off_screen and _camera and _camera.is_position_in_frustum(xf.origin):
		score -= 1.0
	return score


func _sample_locals() -> Array:
	var out := []
	if _detector == null:
		return out
	var inv := global_transform.affine_inverse()
	for n in _detector.get_samples():
		if is_instance_valid(n):
			out.append([inv * n.global_position, IlluminatedObject.sample_radius_of(n, _detector.sample_radius)])
	return out


func _nearest_part_position() -> Vector3:
	if _target == null or _detector == null:
		return global_position
	var bill := _target.global_position
	var best := global_position
	var best_d := INF
	for n in _detector.get_samples():
		if not is_instance_valid(n):
			continue
		var d := n.global_position.distance_to(bill)
		if d < best_d:
			best_d = d
			best = n.global_position
	return best


# --- Audio ------------------------------------------------------------------------------

func _fill_default_sounds() -> void:
	if scrape_sounds.is_empty():
		scrape_sounds.append(PlaceholderAudio.get_sound(&"scrape"))
	if breath_sounds.is_empty():
		breath_sounds.append(PlaceholderAudio.get_sound(&"breath"))
	if move_sounds.is_empty():
		move_sounds.append(PlaceholderAudio.get_sound(&"move"))
	if impact_sounds.is_empty():
		impact_sounds.append(PlaceholderAudio.get_sound(&"impact"))
	if beacon_sound == null:
		beacon_sound = PlaceholderAudio.get_sound(&"beacon")


func _make_player(player_name: String, volume: float) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.name = player_name
	p.top_level = true
	p.volume_db = volume
	p.unit_size = sound_unit_size
	p.max_distance = sound_max_distance
	p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
	add_child(p)
	return p


func _pick(arr: Array[AudioStream]) -> AudioStream:
	return null if arr.is_empty() else arr[randi() % arr.size()]


func _play_at(player: AudioStreamPlayer3D, stream: AudioStream, pos: Vector3, volume_offset := 0.0) -> void:
	if stream == null:
		return
	player.global_position = pos
	player.stream = stream
	player.volume_db = sfx_volume_db + volume_offset
	player.pitch_scale = randf_range(0.85, 1.1)
	player.play()


func _update_ambient_audio(delta: float) -> void:
	_breath_left -= delta
	if _breath_left <= 0.0:
		_breath_left = randf_range(breath_interval.x, breath_interval.y)
		if not _sfx.playing:
			_play_at(_sfx, _pick(breath_sounds), _nearest_part_position(), -4.0)
	_impact_left -= delta
	if _impact_left <= 0.0 and _target:
		_impact_left = randf_range(distant_impact_interval.x, distant_impact_interval.y)
		var dir := (global_position - _target.global_position)
		dir.z = 0.0
		dir = dir.normalized().rotated(Vector3.BACK, randf_range(-1.2, 1.2))
		_play_at(_distant, _pick(impact_sounds), _target.global_position + dir * distant_impact_distance)
