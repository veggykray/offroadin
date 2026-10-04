class_name AquariumGlassActivity
extends Node2D
## "DON'T TAP THE GLASS" - the aquarium mini-game, as one self-contained node.
##
## Instance AquariumActivity.tscn into any 2D scene, position it, then call
## start_activity(player). Everything inside is placeholder-art-agnostic: the
## gameplay only depends on the exported rectangles and the Layout markers.
##
## PUBLIC API
##   start_activity(player: Node = null)
##   cancel_activity()
##   reset_activity()
##   is_running() -> bool
## SIGNALS
##   activity_started
##   activity_completed(result_data: Dictionary)
##   aquarium_completed(result_data: Dictionary)   (same thing, alternative name)
##   activity_cancelled
##   reward_delivered(reward_id: String)            memory reached the chute
##   bill_knocked_over                              the enormous answering tap
##   camera_impulse_requested(strength, duration)   connect to your camera shake
##   stage_changed(stage_name: String)
##   glass_touched(position_global: Vector2, gesture_name: String)
##
## See README.md -> "HOW TO PUT THIS INTO THE REAL AQUARIUM SCENE".

const Stim = preload("GlassStimulus.gd")

signal activity_started
signal activity_completed(result_data: Dictionary)
signal aquarium_completed(result_data: Dictionary)
signal activity_cancelled
signal reward_delivered(reward_id: String)
signal bill_knocked_over
signal camera_impulse_requested(strength: float, duration: float)
signal stage_changed(stage_name: String)
signal glass_touched(position_global: Vector2, gesture_name: String)

enum Stage {
	NOT_STARTED,
	PUSH_SHELL,        # lure the Blimp behind the shell, push it out from under the arch
	BREAK_RESTRAINT,   # scratch so the Bastards chew through the growth
	CRACK_SHELL,       # fire the Coward into the shell
	SHELL_OPENED,      # "YES."
	IDIOT_THEFT,       # ...no.
	CHASE,             # herd the Idiot with the other creatures
	MEMORY_FALLING,    # memory sinks / rolls into the chute
	CALM,              # everything goes quiet
	FINALE_APPROACH,   # something enormous comes to the glass
	FINALE_WAIT,       # will the player tap?
	FINALE_RESPONSE,   # it taps back
	COMPLETE,
}
const STAGE_NAMES := ["not_started", "push_shell", "break_restraint", "crack_shell",
	"shell_opened", "idiot_theft", "chase", "memory_falling", "calm",
	"finale_approach", "finale_wait", "finale_response", "complete"]

@export_group("Aquarium area (activity-local pixels)")
## The water volume. Creatures never leave it.
@export var aquarium_bounds := Rect2(60, 40, 1800, 840)
## Where the player can touch the glass. Leave size at 0,0 to use aquarium_bounds.
@export var glass_rect := Rect2(0, 0, 0, 0)
## Height of the sandy floor measured up from the bottom of aquarium_bounds.
@export var floor_height := 70.0
## Creatures stay this far below the water surface.
@export var surface_margin := 40.0

@export_group("Integration")
## Optional: a Camera2D (gets shaken automatically) or any node with
## add_trauma(amount) / shake(strength, duration) / apply_impulse(strength, duration).
## camera_impulse_requested is always emitted as well.
@export var camera_path: NodePath
## If true, start_activity(null) is called automatically in _ready (handy for quick tests).
@export var auto_start := false
## Draw the built-in placeholder rocks, plants, background etc.
@export var show_placeholder_environment := true
## Show the built-in "PLEASE DO NOT TAP THE GLASS" sign and info plaque.
@export var show_outside_props := true
## Keep the aquarium interactive (as a toy) after completion.
@export var keep_interactive_after_complete := true
## Offset from the player's global_position to Bill's head (where creatures look).
@export var bill_head_offset := Vector2(0, -150)
## Identifier handed back in the result data.
@export var reward_id := "aquarium_memory"

@export_group("Timing")
## Pause after the shell opens before the Idiot strikes ("YES." moment).
@export var shell_open_pause := 1.8
## Quiet period after the memory is delivered before the finale starts.
@export var calm_duration := 4.0
## How long the giant waits for a tap before leaving, disappointed.
@export var finale_wait_time := 9.0
## How long to wait (after the answering tap) before completing.
@export var finale_outro_time := 4.0

@export_group("Debug")
@export var debug_mode := false
## Allow toggling debug with debug_toggle_key at runtime.
@export var allow_debug_toggle := true
@export var debug_toggle_key := KEY_F1

# Children (paths are internal to AquariumActivity.tscn).
@onready var layout: Node2D = $Layout
@onready var environment: Node2D = $Environment
@onready var deep: Node2D = $DeepCreature
@onready var shell: Node2D = $Shell
@onready var chute: Node2D = $Chute
@onready var memory: Node2D = $Memory
@onready var blimp: Node2D = $Creatures/Blimp
@onready var bastards: Node2D = $Creatures/Bastards
@onready var coward: Node2D = $Creatures/Coward
@onready var sucker: Node2D = $Creatures/Sucker
@onready var idiot: Node2D = $Creatures/Idiot
@onready var water_fx: Node2D = $WaterFX
@onready var glass_fx: Node2D = $GlassFX
@onready var glass_damage: Node2D = $GlassDamage
@onready var outside: Node2D = $OutsideProps
@onready var recognizer: Node = $GestureRecognizer
@onready var surface: Node2D = $InteractionSurface
@onready var hints: Node = $HintController
@onready var audio: Node = $Audio
@onready var info_panel: Control = $UI/InfoPanel
@onready var debug_overlay: Node = $DebugOverlay

var stage: int = Stage.NOT_STARTED
var stage_time := 0.0
var activity_time := 0.0
var player: Node = null
var running := false

var creatures: Array = []
var bodies: Array = []
var obstacles: Array = []   # [{pos, r, node}]
var hide_spots: Array = []  # Vector2

# Stats for the result.
var stat_hard_knocks := 0
var stat_chase_start := -1.0
var stat_chase_time := 0.0
var stat_final_tap := false
var stat_gestures := {}

var _start_positions := {}
var _shell_exposed_time := 0.0
var _best_exposure := 0.0
var _recent_impacts: Array = []
var _rub_audio_timer := 0.0
var _scratch_audio_timer := 0.0
var _finale_tap_pos := Vector2.ZERO
var _camera: Node = null
var _cam_shake := 0.0
var _cam_shake_dur := 0.0
var _cam_base_offset := Vector2.ZERO
var _chase_energy := 0.0
var _complete_emitted := false
var _last_counted_stroke := -1


func _ready() -> void:
	if glass_rect.size == Vector2.ZERO:
		glass_rect = aquarium_bounds
	_collect_layout()
	creatures = [blimp, coward, sucker, idiot]
	blimp.creature_id = "blimp"
	coward.creature_id = "coward"
	sucker.creature_id = "sucker"
	idiot.creature_id = "idiot"

	environment.setup(self)
	deep.setup(self)
	water_fx.setup(self)
	glass_fx.setup(self)
	glass_damage.setup(self)
	shell.setup(self)
	chute.setup(self)
	memory.setup(self)
	for c in creatures:
		c.setup(self)
	bastards.setup(self)
	hints.setup(self)
	audio.setup(self)
	info_panel.setup(self)
	$UI/HintUI.setup(self)
	outside.setup(self)
	debug_overlay.setup(self)

	surface.glass_rect = glass_rect
	surface.recognizer = recognizer
	recognizer.gesture_recognized.connect(_on_gesture)
	recognizer.contact.connect(_on_contact)
	recognizer.stroke_ended.connect(_on_stroke_ended)

	shell.restraint_broken.connect(_on_restraint_broken)
	shell.opened.connect(_on_shell_opened)
	idiot.theft_finished.connect(_on_theft_finished)
	idiot.memory_spat.connect(_on_memory_spat)
	chute.memory_received.connect(_on_memory_delivered)
	deep.approach_finished.connect(_on_finale_approach_done)
	deep.finale_finished.connect(_on_finale_finished)
	deep.giant_tap.connect(_on_giant_tap)

	environment.visible = show_placeholder_environment
	outside.visible = show_outside_props
	_camera = get_node_or_null(camera_path) if camera_path != NodePath() else null
	if _camera is Camera2D:
		_cam_base_offset = _camera.offset

	_reset_world()
	if auto_start:
		start_activity.call_deferred(null)


# ======================================================================= API

## Begin the activity. `player` is optional and only used for: where creatures
## look ("Bill"), knockdown callback and reward callback. See README.
func start_activity(p_player: Node = null) -> void:
	player = p_player
	if stage != Stage.NOT_STARTED:
		_reset_world()
	running = true
	activity_time = 0.0
	_complete_emitted = false
	_set_stage(Stage.PUSH_SHELL)
	audio.loop("ambience", true, 0.0)
	activity_started.emit()


## Stop immediately (e.g. the player walked away). Emits activity_cancelled.
func cancel_activity() -> void:
	if not running and stage == Stage.NOT_STARTED:
		return
	running = false
	surface.enabled = false
	recognizer.cancel()
	audio.stop_all_loops()
	stage = Stage.NOT_STARTED
	activity_cancelled.emit()


## Put everything back to the starting state (does not start it).
func reset_activity() -> void:
	running = false
	_reset_world()


func is_running() -> bool:
	return running


func get_stage_name() -> String:
	return STAGE_NAMES[stage]


## Returns the same dictionary sent with activity_completed.
func get_result_data() -> Dictionary:
	return {
		"completion_time": snappedf(activity_time, 0.01),
		"hard_knocks_used": stat_hard_knocks,
		"glass_damage": snappedf(glass_damage.damage, 0.01),
		"hints_used": hints.hints_used,
		"idiot_capture_time": snappedf(stat_chase_time, 0.01),
		"final_tap_used": stat_final_tap,
		"reward_id": reward_id,
		"gesture_counts": stat_gestures.duplicate(),
	}


# ================================================================ world queries

func get_floor_y() -> float:
	return aquarium_bounds.end.y - floor_height


## Area a creature centre of radius r can occupy.
func get_swim_rect(r: float) -> Rect2:
	var top := aquarium_bounds.position.y + surface_margin + r
	var bottom := get_floor_y() - r
	return Rect2(aquarium_bounds.position.x + r, top, aquarium_bounds.size.x - 2.0 * r, maxf(1.0, bottom - top))


## Where "Bill's face" is, in activity-local coordinates.
func get_bill_point() -> Vector2:
	if player != null and is_instance_valid(player):
		if player.has_method("get_aquarium_gaze_position"):
			var g = player.get_aquarium_gaze_position()
			if g is Vector2:
				return to_local(g)
		if player is Node2D:
			return to_local((player as Node2D).global_position + bill_head_offset)
	return layout.get_node("BillGazePoint").position


func get_deep_nervousness() -> float:
	return deep.get_nervousness()


func get_deep_position() -> Vector2:
	return deep.get_visible_position()


func get_all_bodies() -> Array:
	return bodies


## Things the Bastards can bite, as objects with bite_point(), can_be_bitten(),
## bite_priority() and take_bite(from, amount).
func get_bitables() -> Array:
	var out: Array = []
	out.append(shell)
	out.append_array(hints.get_bitables())
	out.append_array(environment.get_bitables())
	for c in creatures:
		if c.visible and c.body_enabled:
			out.append(c)
	return out


func get_hide_spots() -> Array:
	return hide_spots


func is_chase() -> bool:
	return stage == Stage.CHASE


func puzzle_stage() -> int:
	return stage


## The Idiot copies things; every creature reports what it does here.
func notify_creature_event(kind: String, creature: Node, data := {}) -> void:
	if creature != idiot:
		idiot.observe(kind, creature, data)
	hints.record_creature_event(kind, creature, data)


# ================================================================ feedback helpers

func camera_impulse(strength: float, duration: float) -> void:
	camera_impulse_requested.emit(strength, duration)
	if _camera == null or not is_instance_valid(_camera):
		return
	if _camera.has_method("add_trauma"):
		_camera.add_trauma(strength)
	elif _camera.has_method("shake"):
		_camera.shake(strength, duration)
	elif _camera.has_method("apply_impulse"):
		_camera.apply_impulse(strength, duration)
	elif _camera is Camera2D:
		_cam_shake = maxf(_cam_shake, strength)
		_cam_shake_dur = maxf(_cam_shake_dur, duration)


## Create a vibration that did not come from the player (bubbles, hint demos...).
func emit_natural_stimulus(kind: int, pos: Vector2, radius := 160.0, strength := 0.8, with_fx := true) -> void:
	var s = Stim.new().setup(kind, pos, radius, strength, true)
	s.time = activity_time
	if with_fx:
		glass_fx.add_ripple(pos, 0.35 * strength, radius * 0.6)
		water_fx.spawn_bubbles(pos, 6, 0.6)
		audio.play("bubbles", -10.0, 1.2)
	_broadcast(s)


func set_debug(on: bool) -> void:
	debug_mode = on
	debug_overlay.set_enabled(on)


# ================================================================ main loop

func _physics_process(delta: float) -> void:
	if running:
		activity_time += delta
	stage_time += delta
	surface.enabled = _input_allowed()

	environment.tick(delta)
	deep.tick(delta)
	for c in creatures:
		c.tick(delta)
	bastards.tick(delta)
	shell.tick(delta)
	memory.tick(delta)
	chute.tick(delta)
	_resolve_collisions()
	water_fx.tick(delta)
	glass_fx.tick(delta)
	glass_damage.tick(delta)
	hints.tick(delta)
	outside.tick(delta)
	_update_stage(delta)
	_update_audio_loops(delta)
	_update_camera(delta)


func _input_allowed() -> bool:
	if info_panel.is_open:
		return false
	match stage:
		Stage.NOT_STARTED:
			return false
		Stage.CALM, Stage.FINALE_APPROACH, Stage.FINALE_RESPONSE:
			return false
		Stage.COMPLETE:
			return keep_interactive_after_complete
	return running


func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k and k.pressed and not k.echo and allow_debug_toggle and k.keycode == debug_toggle_key:
		set_debug(not debug_mode)
		get_viewport().set_input_as_handled()


# ================================================================ stages

func _set_stage(s: int) -> void:
	stage = s
	stage_time = 0.0
	hints.notify_stage(s)
	stage_changed.emit(STAGE_NAMES[s])


func _update_stage(delta: float) -> void:
	match stage:
		Stage.PUSH_SHELL:
			if shell.is_exposed():
				_shell_exposed_time += delta
				if _shell_exposed_time > 0.7:
					_shell_now_exposed()
			else:
				_shell_exposed_time = 0.0
			var e: float = shell.exposure_progress()
			if e > _best_exposure + 35.0:
				_best_exposure = e
				hints.notify_progress("shell_pushed", false)
		Stage.SHELL_OPENED:
			if stage_time > shell_open_pause:
				_set_stage(Stage.IDIOT_THEFT)
				idiot.begin_theft(memory)
				audio.play("idiot_noise", -2.0, 1.25)
		Stage.CHASE:
			stat_chase_time = activity_time - stat_chase_start
			_chase_energy = move_toward(_chase_energy, 1.0, delta * 0.6)
			environment.set_chase_energy(_chase_energy)
		Stage.MEMORY_FALLING:
			_chase_energy = move_toward(_chase_energy, 0.0, delta * 0.3)
			environment.set_chase_energy(_chase_energy)
			memory.assist_delivery(delta, blimp, chute)
		Stage.CALM:
			_chase_energy = 0.0
			environment.set_chase_energy(0.0)
			if stage_time > calm_duration:
				_set_stage(Stage.FINALE_APPROACH)
				deep.begin_finale_approach()
		Stage.FINALE_WAIT:
			if stage_time > finale_wait_time:
				_set_stage(Stage.FINALE_RESPONSE)
				stat_final_tap = false
				deep.leave_disappointed()
		Stage.FINALE_RESPONSE:
			pass


func _shell_now_exposed() -> void:
	if stage != Stage.PUSH_SHELL:
		return
	audio.play("memory_shimmer", -6.0, 1.0)
	shell.on_exposed()
	_set_stage(Stage.BREAK_RESTRAINT if shell.restraint_hp > 0.0 else Stage.CRACK_SHELL)


func _on_restraint_broken() -> void:
	if stage == Stage.PUSH_SHELL or stage == Stage.BREAK_RESTRAINT:
		if stage == Stage.PUSH_SHELL:
			shell.on_exposed()
		_set_stage(Stage.CRACK_SHELL)


func _on_shell_opened() -> void:
	if stage >= Stage.SHELL_OPENED:
		return
	_set_stage(Stage.SHELL_OPENED)
	memory.release_from_shell()
	audio.play("memory_release", 0.0)
	for c in creatures:
		if c != idiot:
			c.look_at_point(memory.position, 2.0)


func _on_theft_finished() -> void:
	if stage != Stage.IDIOT_THEFT:
		return
	_set_stage(Stage.CHASE)
	stat_chase_start = activity_time
	idiot.begin_chase()
	audio.loop("chase_music", true, -8.0)
	audio.set_loop_pitch("ambience", 1.12)


func _on_memory_spat(pos: Vector2, vel: Vector2) -> void:
	if stage != Stage.CHASE:
		return
	stat_chase_time = activity_time - stat_chase_start
	memory.drop(pos, vel)
	audio.play("memory_release", -2.0, 0.9)
	audio.loop("chase_music", false)
	audio.set_loop_pitch("ambience", 1.0)
	_set_stage(Stage.MEMORY_FALLING)


func _on_memory_delivered() -> void:
	if stage >= Stage.CALM:
		return
	audio.play("chute_suck", 0.0)
	audio.play("completion", -2.0)
	reward_delivered.emit(reward_id)
	if player != null and is_instance_valid(player) and player.has_method("on_aquarium_reward"):
		player.on_aquarium_reward(reward_id)
	_set_stage(Stage.CALM)
	surface.enabled = false
	recognizer.cancel()
	audio.fade_loop("ambience", -16.0, 3.0)
	environment.set_light(0.55, 4.0)
	for c in creatures:
		c.retreat()
	bastards.retreat()


func _on_finale_approach_done() -> void:
	if stage != Stage.FINALE_APPROACH:
		return
	_set_stage(Stage.FINALE_WAIT)


func _finale_tap(pos: Vector2) -> void:
	stat_final_tap = true
	_finale_tap_pos = pos
	_set_stage(Stage.FINALE_RESPONSE)
	deep.respond_to_tap(pos)


func _on_giant_tap(pos: Vector2) -> void:
	# BOOOOOOOOOOM.
	audio.play("final_tap", 2.0)
	audio.play("glass_stress", 0.0, 0.7)
	camera_impulse(1.0, 0.8)
	glass_fx.add_ripple(pos, 3.0, 900.0)
	glass_fx.add_ripple(pos, 2.0, 600.0)
	water_fx.push(pos, 1200.0, 3.0)
	water_fx.spawn_bubbles(pos, 40, 1.5)
	environment.disturb(pos, 1500.0, 3.0)
	glass_damage.giant_crack(pos)
	outside.on_giant_tap()
	bill_knocked_over.emit()
	if player != null and is_instance_valid(player) and player.has_method("on_aquarium_knockdown"):
		player.on_aquarium_knockdown()


func _on_finale_finished() -> void:
	if stage == Stage.COMPLETE:
		return
	_complete()


func _complete() -> void:
	_set_stage(Stage.COMPLETE)
	running = false
	environment.set_light(1.0, 5.0)
	audio.fade_loop("ambience", 0.0, 4.0)
	for c in creatures:
		c.return_from_retreat()
	bastards.return_from_retreat()
	if not _complete_emitted:
		_complete_emitted = true
		var data := get_result_data()
		activity_completed.emit(data)
		aquarium_completed.emit(data)


# ================================================================ input → stimuli

func _on_contact(pos: Vector2, is_knock: bool) -> void:
	if is_knock:
		return   # knocks get their own, bigger feedback in _on_gesture
	audio.play("glass_tap", -2.0, 1.0, 0.12)
	glass_fx.add_ripple(pos, 0.6, 170.0)
	water_fx.push(pos, 140.0, 0.6)
	environment.disturb(pos, 160.0, 0.4)
	_register_impact(pos)
	glass_touched.emit(to_global(pos), "tap")
	if stage == Stage.FINALE_WAIT:
		_finale_tap(pos)


func _register_impact(_pos: Vector2) -> void:
	_recent_impacts.append(activity_time)
	while _recent_impacts.size() > 0 and activity_time - float(_recent_impacts[0]) > 2.0:
		_recent_impacts.pop_front()
	if _recent_impacts.size() >= 5:
		deep.add_attention(0.012 * (_recent_impacts.size() - 4))   # frantic tapping


func _on_gesture(kind: int, pos: Vector2, info: Dictionary) -> void:
	var s = Stim.new().setup(kind, pos, info.get("radius", 150.0), info.get("strength", 1.0), false)
	s.stroke_id = info.get("stroke_id", 0)
	s.continuous = info.get("continuous", false)
	s.time = activity_time
	var kname := Stim.kind_name(kind)
	if not s.continuous or s.stroke_id != _last_counted_stroke:
		_last_counted_stroke = s.stroke_id if s.continuous else _last_counted_stroke
		stat_gestures[kname] = int(stat_gestures.get(kname, 0)) + 1

	match kind:
		Stim.Kind.SINGLE_TAP:
			deep.add_attention(0.006)
		Stim.Kind.DOUBLE_TAP:
			audio.play("glass_double_tap", -3.0, 1.05, 0.08)
			glass_fx.add_ripple(pos, 1.0, 230.0)
			water_fx.push(pos, 220.0, 1.0)
			deep.add_attention(0.016)
		Stim.Kind.RUB:
			_rub_audio_timer = 0.18
			glass_fx.add_smear(pos)
			water_fx.push(pos, 80.0, 0.15)
			deep.add_attention(0.0012)
		Stim.Kind.SCRATCH:
			_scratch_audio_timer = 0.18
			glass_fx.add_scratch(pos)
			glass_fx.add_ripple(pos, 0.25, 120.0)
			water_fx.push(pos, 150.0, 0.35)
			environment.disturb(pos, 140.0, 0.2)
			deep.add_attention(0.0055)
		Stim.Kind.HARD_KNOCK:
			stat_hard_knocks += 1
			audio.play("hard_knock", 2.0, 1.0, 0.06)
			audio.play("deep_rumble", -8.0, 1.3)
			glass_fx.add_ripple(pos, 2.0, 520.0)
			glass_fx.add_ripple(pos, 1.0, 300.0)
			water_fx.push(pos, 600.0, 2.2)
			water_fx.spawn_bubbles(pos, 14, 1.0)
			environment.disturb(pos, 700.0, 1.6)
			camera_impulse(0.35, 0.3)
			glass_damage.on_hard_knock(pos)
			deep.add_attention(0.17)
			outside.on_hard_knock()
			_register_impact(pos)
			glass_touched.emit(to_global(pos), "knock")
			if stage == Stage.FINALE_WAIT:
				_finale_tap(pos)
	if not s.continuous and kind != Stim.Kind.SINGLE_TAP:
		glass_touched.emit(to_global(pos), kname)
	_broadcast(s)


func _on_stroke_ended(_kind: int, _pos: Vector2) -> void:
	pass


func _broadcast(s) -> void:
	if not s.natural:
		hints.record_gesture(s.kind)
	for c in creatures:
		if c.on_stimulus(s) and not s.natural:
			hints.record_response(c.creature_id, s.kind)
	if bastards.on_stimulus(s) and not s.natural:
		hints.record_response("bastards", s.kind)
	debug_overlay.on_stimulus(s)


func _update_audio_loops(delta: float) -> void:
	_rub_audio_timer -= delta
	_scratch_audio_timer -= delta
	audio.loop("glass_rub", _rub_audio_timer > 0.0, -6.0)
	audio.loop("glass_scratch", _scratch_audio_timer > 0.0, -4.0)


func _update_camera(delta: float) -> void:
	if not (_camera is Camera2D) or not is_instance_valid(_camera):
		return
	if _cam_shake_dur > 0.0:
		_cam_shake_dur -= delta
		var amt := _cam_shake * clampf(_cam_shake_dur * 3.0, 0.0, 1.0)
		(_camera as Camera2D).offset = _cam_base_offset + Vector2(randf_range(-1, 1), randf_range(-1, 1)) * 38.0 * amt
		if _cam_shake_dur <= 0.0:
			_cam_shake = 0.0
			(_camera as Camera2D).offset = _cam_base_offset


# ================================================================ physics

func _collect_layout() -> void:
	obstacles.clear()
	hide_spots.clear()
	for o in layout.get_node("Obstacles").get_children():
		if o is Node2D and o.get("radius") != null:
			obstacles.append({"pos": (o as Node2D).position, "r": float(o.radius), "node": o})
			if o.get("idiot_hide_spot"):
				hide_spots.append((o as Node2D).position)
	var hs := layout.get_node_or_null("HideSpots")
	if hs:
		for m in hs.get_children():
			if m is Node2D:
				hide_spots.append((m as Node2D).position)
	for key in ["BlimpStart", "BastardsHome", "CowardStart", "SuckerStart", "IdiotStart", "ShellStart", "Chute", "DeepCreatureOrigin", "BillGazePoint"]:
		var n := layout.get_node_or_null(key)
		_start_positions[key] = (n as Node2D).position if n else aquarium_bounds.get_center()


func layout_point(key: String) -> Vector2:
	return _start_positions.get(key, aquarium_bounds.get_center())


func get_shell_cover_rect() -> Rect2:
	var z := layout.get_node_or_null("ShellCover")
	if z and z.has_method("get_rect_local_to_parent"):
		return z.get_rect_local_to_parent()
	return Rect2()


func _reset_world() -> void:
	stage = Stage.NOT_STARTED
	stage_time = 0.0
	stat_hard_knocks = 0
	stat_chase_start = -1.0
	stat_chase_time = 0.0
	stat_final_tap = false
	stat_gestures = {}
	_best_exposure = 0.0
	_shell_exposed_time = 0.0
	_chase_energy = 0.0
	_recent_impacts.clear()
	recognizer.cancel()
	surface.enabled = false
	blimp.reset_creature(layout_point("BlimpStart"))
	coward.reset_creature(layout_point("CowardStart"))
	sucker.reset_creature(layout_point("SuckerStart"))
	idiot.reset_creature(layout_point("IdiotStart"))
	bastards.reset_swarm(layout_point("BastardsHome"))
	shell.reset_shell(layout_point("ShellStart"))
	chute.position = layout_point("Chute")
	chute.reset_chute()
	memory.place_in_shell(shell)
	deep.reset_deep(layout_point("DeepCreatureOrigin"))
	glass_damage.reset_damage()
	hints.reset_hints()
	environment.set_light(1.0, 0.0)
	environment.set_chase_energy(0.0)
	audio.stop_all_loops()
	outside.reset_props()
	info_panel.close()
	bodies = [blimp, coward, sucker, idiot, shell, memory]
	bodies.append_array(bastards.get_bodies())
	bodies.append_array(environment.get_pebbles())
	_complete_emitted = false


func _inv_mass(a, other) -> float:
	if a.has_method("inv_mass_for"):
		return a.inv_mass_for(other)
	return 1.0 / maxf(0.01, a.body_mass)


func _resolve_collisions() -> void:
	var n := bodies.size()
	for i in n:
		var a = bodies[i]
		if not a.body_enabled:
			continue
		for j in range(i + 1, n):
			var b = bodies[j]
			if not b.body_enabled:
				continue
			if a.collision_group != "" and a.collision_group == b.collision_group:
				continue
			var d: Vector2 = b.position - a.position
			var rr: float = a.body_radius + b.body_radius
			var dsq := d.length_squared()
			if dsq >= rr * rr:
				continue
			var dist := sqrt(dsq)
			var nrm := d / dist if dist > 0.001 else Vector2.UP
			var wa := _inv_mass(a, b)
			var wb := _inv_mass(b, a)
			var wsum := wa + wb
			if wsum <= 0.0:
				continue
			var total := nrm * (rr - dist)
			var share_a := -total * (wa / wsum)
			var share_b := total * (wb / wsum)
			var a_locked: bool = a.get("floor_locked") == true
			var b_locked: bool = b.get("floor_locked") == true
			if a_locked:
				share_a.y = 0.0
				share_b.y = total.y
			if b_locked:
				share_b.y = 0.0
				share_a.y = -total.y
			a.position += share_a
			b.position += share_b
			var rel: float = (b.velocity - a.velocity).dot(nrm)
			if rel < 0.0:
				var jimp := -(1.0 + 0.25) * rel / wsum
				var dva: Vector2 = -nrm * jimp * wa
				var dvb: Vector2 = nrm * jimp * wb
				if a_locked: dva.y = 0.0
				if b_locked: dvb.y = 0.0
				a.velocity += dva
				b.velocity += dvb
			a.on_body_collision(b, -nrm, maxf(0.0, -rel))
			b.on_body_collision(a, nrm, maxf(0.0, -rel))
	# Static rocks.
	for body in bodies:
		if not body.body_enabled:
			continue
		for o in obstacles:
			var d2: Vector2 = body.position - o.pos
			var rr2: float = body.body_radius + o.r
			if d2.length_squared() >= rr2 * rr2:
				continue
			var dist2 := d2.length()
			var nrm2 := d2 / dist2 if dist2 > 0.001 else Vector2.UP
			var push := nrm2 * (rr2 - dist2)
			if body.get("floor_locked") == true:
				push.y = 0.0
				if absf(nrm2.x) < 0.2:
					push.x = signf(nrm2.x if nrm2.x != 0.0 else 1.0) * (rr2 - dist2) * 0.2
			body.position += push
			var vn: float = body.velocity.dot(nrm2)
			if vn < 0.0:
				body.velocity -= nrm2 * vn * 1.3
				if body.get("floor_locked") == true:
					body.velocity.y = 0.0
				body.on_body_collision(o, nrm2, -vn)


# ================================================================ debug commands

## Debug / integration helper. Names: tap, double_tap, rub, scratch, knock,
## advance_stage, reset_stage, next_hint, open_shell, start_chase, capture_idiot,
## damage_up, damage_down, summon_deep, finale.
func debug_command(cmd: String, pos := Vector2.INF) -> void:
	if pos == Vector2.INF:
		pos = surface.pointer_pos if glass_rect.has_point(surface.pointer_pos) else aquarium_bounds.get_center()
	if not running and stage == Stage.NOT_STARTED and cmd != "reset_stage":
		start_activity(player)
	match cmd:
		"tap":
			_on_contact(pos, false)
			_on_gesture(Stim.Kind.SINGLE_TAP, pos, {"radius": recognizer.single_tap_radius})
		"double_tap":
			_on_contact(pos, false)
			_on_gesture(Stim.Kind.DOUBLE_TAP, pos, {"radius": recognizer.double_tap_radius})
		"rub":
			for i in 6:
				_on_gesture(Stim.Kind.RUB, pos + Vector2(i * 6, 0), {"radius": recognizer.rub_radius, "continuous": i > 0, "stroke_id": 9999})
		"scratch":
			for i in 6:
				_on_gesture(Stim.Kind.SCRATCH, pos, {"radius": recognizer.scratch_radius, "continuous": i > 0, "stroke_id": 9998})
		"knock":
			_on_gesture(Stim.Kind.HARD_KNOCK, pos, {"radius": recognizer.hard_knock_radius})
		"advance_stage":
			match stage:
				Stage.PUSH_SHELL:
					shell.debug_expose()
				Stage.BREAK_RESTRAINT:
					shell.debug_break_restraint()
				Stage.CRACK_SHELL:
					shell.force_open()
				Stage.SHELL_OPENED, Stage.IDIOT_THEFT:
					debug_command("start_chase")
				Stage.CHASE:
					debug_command("capture_idiot")
				Stage.MEMORY_FALLING:
					chute.force_receive(memory)
				Stage.CALM, Stage.FINALE_APPROACH, Stage.FINALE_WAIT:
					debug_command("finale")
		"reset_stage":
			reset_activity()
			start_activity(player)
		"next_hint":
			hints.debug_next_hint()
		"open_shell":
			if stage < Stage.SHELL_OPENED:
				shell.debug_expose()
				shell.debug_break_restraint()
				shell.force_open()
		"start_chase":
			if stage < Stage.SHELL_OPENED:
				debug_command("open_shell")
			if stage < Stage.CHASE:
				_set_stage(Stage.IDIOT_THEFT)
				idiot.debug_grab(memory)
				_on_theft_finished()
		"capture_idiot":
			if stage < Stage.CHASE:
				debug_command("start_chase")
			idiot.force_capture()
		"damage_up":
			glass_damage.on_hard_knock(pos)
		"damage_down":
			glass_damage.debug_reduce()
		"summon_deep":
			deep.debug_summon()
		"finale":
			if stage < Stage.CALM:
				if stage < Stage.MEMORY_FALLING:
					debug_command("capture_idiot")
				_on_memory_delivered()
			stage_time = calm_duration + 1.0
			if stage == Stage.CALM:
				_set_stage(Stage.FINALE_APPROACH)
				deep.begin_finale_approach()
