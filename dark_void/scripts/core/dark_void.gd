class_name DarkVoid
extends Node3D
## Root of the Dark Void mini-game. Self-contained: instance the scene in a host game, connect
## dark_void_completed(reward_id), and free the scene when done.
##
## Owns progression only (memories -> reveal level -> final reversal -> completion). Lighting,
## illumination, creature behaviour and scares live in their own components and are wired
## here by NodePath, so any of them can be swapped.

signal dark_void_completed(reward_id: String)
signal memory_activated(memory_id: String, count: int, total: int)
signal phase_changed(new_phase: String)
signal touch_available_changed(available: bool)

enum Phase { EXPLORE, FINAL, COMPLETING, COMPLETED }

@export var reward_id := "dark_creature_memory"
## R restarts and F2–F4 debug keys. Turn off when embedded in the main game.
@export var standalone_controls := true

@export_group("Nodes")
@export var bill_path: NodePath
@export var hand_light_path: NodePath
@export var creature_path: NodePath
@export var environment_path: NodePath
@export var hud_path: NodePath
@export var scare_director_path: NodePath
## Where to look for MemoryObjects (empty = anywhere under this node).
@export var memories_root_path: NodePath

@export_group("Progression")
## 0 = every MemoryObject found.
@export var memories_required := 0
## Pause between the last memory's chime and the objective changing.
@export var final_phase_delay := 3.0
@export var final_phase_message := ""

@export_group("Final reversal")
## Bill-to-TouchAnchor distance at which TOUCH appears.
@export var touch_distance := 2.4
## TOUCH only while the creature isn't lit (you approach it in the dark).
@export var touch_requires_unlit_creature := true
@export var interact_action := &"dv_interact"

@export_group("Completion")
@export var completion_light_intensity_mult := 2.6
@export var completion_light_range_mult := 2.8
@export var completion_light_time := 3.5
@export var completion_ambient_boost := 0.1
@export var fade_delay := 4.0
@export var fade_time := 3.0
@export var completed_message := ""

var phase: Phase = Phase.EXPLORE
var memories_collected := 0
var memories_total := 0
var elapsed := 0.0
var scare_context := ScareContext.new()

var _bill: Node3D
var _hand: HandLight
var _creature: DarkCreature
var _env: VoidEnvironment
var _hud: DarkVoidHUD
var _scares: ScareDirector
var _memories: Array[MemoryObject] = []
var _light_off_time := 0.0
var _light_on_time := 0.0
var _touch_available := false
var _touch_dist := INF


func _ready() -> void:
	DVInput.ensure_actions()
	_bill = get_node_or_null(bill_path) as Node3D
	_hand = get_node_or_null(hand_light_path) as HandLight
	_creature = get_node_or_null(creature_path) as DarkCreature
	_env = get_node_or_null(environment_path) as VoidEnvironment
	_hud = get_node_or_null(hud_path) as DarkVoidHUD
	_scares = get_node_or_null(scare_director_path) as ScareDirector

	var root: Node = get_node_or_null(memories_root_path) if memories_root_path != NodePath() else self
	if root == null:
		root = self
	for n in get_tree().get_nodes_in_group(MemoryObject.GROUP):
		if n is MemoryObject and (root == n or root.is_ancestor_of(n)):
			_memories.append(n)
			(n as MemoryObject).activated.connect(_on_memory_activated)
	memories_total = memories_required if memories_required > 0 else _memories.size()

	scare_context.game = self
	scare_context.bill = _bill
	scare_context.hand_light = _hand
	scare_context.creature = _creature
	scare_context.memories_total = memories_total
	if _env:
		_env.set_reveal_level(0, true)


func _process(delta: float) -> void:
	elapsed += delta
	var on := _hand != null and _hand.is_emitting()
	if on:
		_light_on_time += delta
		_light_off_time = 0.0
	else:
		_light_off_time += delta
		_light_on_time = 0.0
	scare_context.elapsed = elapsed
	scare_context.memories_collected = memories_collected
	scare_context.light_on = on
	scare_context.light_off_time = _light_off_time
	scare_context.light_on_time = _light_on_time
	scare_context.final_phase = phase != Phase.EXPLORE
	if phase == Phase.FINAL:
		_update_touch()


func _unhandled_input(event: InputEvent) -> void:
	if phase == Phase.FINAL and _touch_available and event.is_action_pressed(interact_action):
		complete()
		return
	if not standalone_controls:
		return
	if event.is_action_pressed(DVInput.RESTART):
		get_tree().reload_current_scene()
	elif event.is_action_pressed(DVInput.DEBUG_REVEAL) and _env:
		_env.toggle_debug_reveal()
	elif event.is_action_pressed(DVInput.DEBUG_SCARE) and _scares:
		if not _scares.force_trigger("close_encounter"):
			print("[DarkVoid] scare not possible right now (creature lit or busy)")
	elif event.is_action_pressed(DVInput.DEBUG_MEMORY):
		for m in _memories:
			if not m.is_activated:
				m.activate()
				break


# --- Progression ------------------------------------------------------------------------

func _on_memory_activated(memory: MemoryObject) -> void:
	memories_collected += 1
	if _env:
		_env.set_reveal_level(memories_collected)
	if _creature:
		_creature.set_threat_level(memories_collected)
	memory_activated.emit(memory.memory_id, memories_collected, memories_total)
	if memories_collected >= memories_total and phase == Phase.EXPLORE:
		get_tree().create_timer(final_phase_delay).timeout.connect(_enter_final_phase)


func _enter_final_phase() -> void:
	if phase != Phase.EXPLORE:
		return
	_set_phase(Phase.FINAL)
	if _creature:
		_creature.enter_final_phase()
	if _hud and final_phase_message != "":
		_hud.show_message(final_phase_message)


func _update_touch() -> void:
	if _creature == null or _bill == null:
		return
	_touch_dist = _bill.global_position.distance_to(_creature.get_touch_point())
	var ok := _touch_dist <= touch_distance
	if ok and touch_requires_unlit_creature and _creature.is_illuminated():
		ok = false
	if ok != _touch_available:
		_touch_available = ok
		if _hud:
			_hud.set_touch_visible(ok)
		touch_available_changed.emit(ok)


## Ends the mini-game: light swells, creature partially revealed, fade, completion signal.
func complete() -> void:
	if phase == Phase.COMPLETING or phase == Phase.COMPLETED:
		return
	_set_phase(Phase.COMPLETING)
	_touch_available = false
	if _hud:
		_hud.set_touch_visible(false)
	if _bill is BillController:
		(_bill as BillController).input_enabled = false
	if _scares:
		_scares.enabled = false
	if _hand:
		_hand.boost(completion_light_intensity_mult, completion_light_range_mult, completion_light_time)
	if _creature:
		_creature.reveal()
	if _env:
		_env.add_extra_ambient(completion_ambient_boost, completion_light_time)
	await get_tree().create_timer(fade_delay).timeout
	if _hud:
		await _hud.fade_out(fade_time)
	_set_phase(Phase.COMPLETED)
	print("[DarkVoid] dark_void_completed(\"%s\")" % reward_id)
	dark_void_completed.emit(reward_id)
	if _hud and completed_message != "":
		_hud.show_message(completed_message, -1.0)


func _set_phase(p: Phase) -> void:
	phase = p
	phase_changed.emit(Phase.keys()[p])


# --- Debug ------------------------------------------------------------------------------

func get_debug_info() -> Dictionary:
	var d := {
		"phase": Phase.keys()[phase],
		"memories": memories_collected,
		"memories_total": memories_total,
		"light_on": _hand != null and _hand.is_emitting(),
		"energy_ratio": 1.0,
		"energy_exhausted": false,
		"touch_distance": _touch_dist,
	}
	if _hand and _hand.energy and _hand.energy.enabled:
		d["energy_ratio"] = _hand.energy.get_ratio()
		d["energy_exhausted"] = _hand.energy.exhausted
	if _creature:
		d["creature_state"] = _creature.get_state_name()
		var det := _creature.get_detector()
		if det:
			d["creature_lit_amount"] = det.amount
			d["creature_lit_time"] = det.continuous_lit_time
		if _bill:
			d["creature_distance"] = _bill.global_position.distance_to(_creature.global_position)
	return d
