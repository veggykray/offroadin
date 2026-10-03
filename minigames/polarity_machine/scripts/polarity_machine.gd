extends Node2D
## POLARITY MACHINE — grow a strange plant until it bears one fruit.
##
## Four systems on the machine: WATER (blue button + reservoir), LIGHT (sun
## dial + lamp), TEMPERATURE (lever + curved gauge), AGE / TIME (the upper
## dial). The plant shows what it needs; the player experiments.
##
## >>> ALL PUZZLE RULES AND TUNING VALUES LIVE AT THE TOP OF
## >>> scripts/plant_rules.gd  (required states, timings, tank size …)
## This script only wires controls, presentation, audio and the host API.
##
## Integration contract (unchanged):
##   signal puzzle_completed(reward_id: String)   # reward_id == "polarity_fruit_key", once
##   signal exit_requested()                      # Esc pressed; the host decides
##   func reset_puzzle() -> void

signal puzzle_completed(reward_id: String)
signal exit_requested()

const REWARD_ID := "polarity_fruit_key"
const DESIGN_SIZE := Vector2(1920.0, 1080.0)
const Rules := preload("res://minigames/polarity_machine/scripts/plant_rules.gd")
const Sounds := preload("res://minigames/polarity_machine/scripts/placeholder_sounds.gd")

## Debug only: shows the numeric state in a corner label (F3 toggles).
@export var DEBUG := false
## Scale the 1920×1080 composition to fit the viewport (letterboxed). Turn off
## if the host positions / scales this scene itself.
@export var auto_fit_to_viewport := true
## Q/W temperature, A/S light, Z/X age, D (or Space) water, R reset, F3 debug.
@export var keyboard_shortcuts := true
## Fill any AudioStreamPlayer without a stream with a synthesised placeholder.
@export var use_placeholder_sounds := true
@export var show_intro_text := true
## Opening settings (see plant_rules.gd for the meaning of each step).
@export_range(0, 4) var start_water: int = Rules.START_WATER
@export_range(0, 3) var start_light: int = Rules.START_LIGHT
@export_range(0, 3) var start_temperature: int = Rules.START_TEMP
@export_range(0, 4) var start_age: int = Rules.START_STAGE
## Seconds before the gentle one-line nudges appear (0 disables them).
@export var nudge_delay := 30.0

var rules = Rules.new()
var completed := false

@onready var stage: Node2D = $Stage
@onready var tank = $Stage/WaterTank
@onready var chamber = $Stage/PlantChamber
@onready var spray_fx = $Stage/SprayFX
@onready var atmosphere = $Stage/Atmosphere
@onready var machine = $Stage/Machine
@onready var age_control = $Stage/Machine/AgeDial
@onready var light_control = $Stage/Machine/LightDial
@onready var temperature_control = $Stage/Machine/TemperatureLever
@onready var water_button = $Stage/Machine/WaterButton
@onready var hint_label: Label = $UI/Hint
@onready var debug_label: Label = $UI/DebugLabel
@onready var audio: Node = $Audio

var _hint_tween: Tween
var _waiting_t := 0.0
var _nudges_shown := {}
var _empty_hint_shown := false


func _ready() -> void:
	if use_placeholder_sounds:
		_install_placeholder_sounds()
	for n in [tank, chamber, atmosphere, machine]:
		n.rules = rules
	rules.sprayed.connect(_on_sprayed)
	rules.spray_failed.connect(_on_spray_failed)
	rules.grew.connect(_on_grew)
	rules.ailment_started.connect(_on_ailment)
	rules.recovered.connect(_on_recovered)
	rules.bud_changed.connect(_on_bud_changed)
	rules.fruit_started.connect(_on_fruit_started)
	rules.solved.connect(_on_solved)
	rules.soil_changed.connect(_on_soil_changed)
	age_control.value_changed.connect(_on_age_changed)
	light_control.value_changed.connect(_on_light_changed)
	temperature_control.value_changed.connect(_on_temperature_changed)
	for c in [age_control, light_control, temperature_control]:
		c.detent_crossed.connect(_on_detent)
	water_button.pressed.connect(press_water)
	get_viewport().size_changed.connect(_fit_to_viewport)
	_fit_to_viewport()
	hint_label.modulate.a = 0.0
	reset_puzzle()
	(audio.get_node("MachineHum") as AudioStreamPlayer).play()
	if show_intro_text:
		_show_hint("Something in the cage wants to grow.", 0.8, 5.0)


func _exit_tree() -> void:
	for child in audio.get_children():
		(child as AudioStreamPlayer).stop()


## Puts the room back to its starting state. Safe to call at any time.
func reset_puzzle() -> void:
	completed = false
	rules.reset()
	rules.water = clampi(start_water, 0, 4)
	rules.light = clampi(start_light, 0, 3)
	rules.temp = clampi(start_temperature, 0, 3)
	rules.stage = clampi(start_age, 0, 4)
	age_control.set_value(rules.stage, false, false)
	light_control.set_value(rules.light, false, false)
	temperature_control.set_value(rules.temp, false, false)
	_set_controls_enabled(true)
	chamber.snap()
	atmosphere.snap()
	machine.snap()
	tank.level = 1.0
	_waiting_t = 0.0
	_nudges_shown.clear()
	_empty_hint_shown = false
	_update_debug()


# ---------------------------------------------------------------------------------------------
# Controls → rules
# ---------------------------------------------------------------------------------------------

## One press of the blue water button (also used by keyboard / host scripts).
func press_water() -> void:
	if completed:
		return
	_play("ButtonPress")
	rules.spray()


func _on_age_changed(v: int, old: int) -> void:
	# The dial may be dragged across several stations at once: grow one at a time.
	var dir := signi(v - old)
	for i in absi(v - old):
		rules.step_stage(dir)
	_play("AgeShift", 1.15 - 0.08 * float(v))
	machine.jolt(1.5)


func _on_light_changed(v: int, _old: int) -> void:
	rules.set_light(v)
	_play("LightShift", 0.75 + 0.15 * float(v))
	machine.jolt()


func _on_temperature_changed(v: int, _old: int) -> void:
	rules.set_temperature(v)
	_play("TemperatureShift", 0.8 + 0.12 * float(v))
	machine.jolt()
	(audio.get_node("MachineHum") as AudioStreamPlayer).pitch_scale = 0.8 + 0.12 * float(v)


func _on_detent(v: int) -> void:
	_play("LeverClick", 0.85 + 0.08 * float(v))


func _set_controls_enabled(on: bool) -> void:
	for c in [age_control, light_control, temperature_control, water_button]:
		c.input_enabled = on


# ---------------------------------------------------------------------------------------------
# Rules → presentation
# ---------------------------------------------------------------------------------------------

func _on_sprayed(_water: int) -> void:
	water_button.press(true)
	tank.pump()
	spray_fx.spray()
	machine.pump = 0.9
	machine.jolt(0.6)
	_play("WaterSpray")


func _on_spray_failed() -> void:
	water_button.press(false)
	spray_fx.sputter()
	_play("Sputter")
	if not _empty_hint_shown:
		_empty_hint_shown = true
		_show_hint("The reservoir is empty. It is slowly filling again.", 0.0, 3.5)


func _on_grew(_stage: int, healthy: bool) -> void:
	chamber.kick()
	_play("PlantGrow", 1.0 if healthy else 0.8)
	if healthy:
		atmosphere.flash(chamber.bloom_point(), Color(0.6, 1.0, 0.6), 90.0, 0.8)


func _on_ailment(_cause: String) -> void:
	_play("PlantSick")
	machine.jolt(0.8)


func _on_recovered() -> void:
	_play("PlantRecover")
	atmosphere.flash(chamber.bloom_point(), Color(0.55, 1.0, 0.55), 120.0, 1.0)


func _on_bud_changed(what: String) -> void:
	if what == "bud":
		_play("BudForm")
	else:
		_play("FlowerOpen")
		machine.pulse(0.5, Color(0.8, 0.6, 1.0))
		atmosphere.flash(chamber.bloom_point(), Color(0.8, 0.6, 1.0), 170.0, 1.2)


func _on_fruit_started() -> void:
	_play("BudForm", 0.7)
	machine.jolt(1.0)


func _on_soil_changed(_water: int, reason: String) -> void:
	if reason == "drained":
		_play("Drip")


func _on_solved() -> void:
	if completed:
		return
	completed = true
	_set_controls_enabled(false)
	_play("FruitAppear")
	_play("PuzzleSuccess")
	machine.pulse(1.0, Color(1.0, 0.85, 0.45))
	atmosphere.flash(chamber.bloom_point(), Color(1.0, 0.85, 0.5), 420.0, 2.0)
	atmosphere.flash(machine.core_position(), Color(1.0, 0.8, 0.4), 260.0, 1.6)
	_show_hint("The machine exhales. A strange fruit hangs heavy in the cage.", 0.6, 5.0)
	_update_debug()
	puzzle_completed.emit(REWARD_ID)


# ---------------------------------------------------------------------------------------------
# Observation: click the plant for one line about how it looks. Never names a setting.
# ---------------------------------------------------------------------------------------------

func _observation() -> String:
	if rules.is_solved:
		return "It has borne its fruit — half night, half day."
	match rules.ailment:
		"dry":
			return "Its leaves are crisp at the edges. It went thirsty."
		"drowned":
			return "Yellow and limp, as if its roots sat in standing water."
		"dark":
			return "Pale and folded. It has been left too long in darkness."
		"leggy":
			return "Thin and stretched, straining toward a light too weak for it."
		"frost":
			return "Dark, frost-bitten patches mark its leaves."
		"scorch":
			return "The leaf edges are scorched and curling."
	if rules.ailment != "" and rules.recovery > 0.2:
		return "It is greening again."
	var harsh: String = rules.harm_problem()
	if harsh != "" and rules.harm > 0.15:
		match harsh:
			"dry":
				return "The soil is parched. The leaves are starting to sag."
			"drowned":
				return "Water stands on the soil. The plant is starting to slump."
			"frost":
				return "Rime is forming on the leaves."
			"scorch":
				return "The leaves are curling in the heat."
			"dark":
				return "In the darkness its leaves have folded shut."
	match rules.stage:
		Rules.Stage.SEEDLING:
			return "A seedling. The machine has not given it any time yet."
		Rules.Stage.OLD:
			if rules.flowered:
				return "Gnarled now. Its flowers have withered on the stem."
			return "Gnarled and spent. Its flowering days seem behind it."
		Rules.Stage.YOUNG, Rules.Stage.MATURE:
			return "Healthy, and still growing." if rules.is_healthy() else "It is growing, but not well."
	# Flowering age.
	if rules.flowered:
		if rules.fruit > 0.05:
			return "Something is swelling at the heart of the flower."
		if rules.fruit_matches() >= 2:
			return "The heart of the flower glows faintly, as if almost satisfied."
		if rules.light < Rules.Light.MEDIUM:
			return "The flower has half-closed, as flowers do at night."
		return "The flower is open. It seems to want something more."
	if rules.bud > 0.05:
		return "A tight bud has formed, as if it sensed evening coming."
	return "Lush and full-grown, but it shows no sign of flowering."


func _check_nudges(dt: float) -> void:
	if nudge_delay <= 0.0 or rules.is_solved:
		return
	var key := ""
	if rules.stage == Rules.Stage.FLOWERING and rules.is_healthy() and not rules.flowered and rules.bud < 0.05:
		key = "night"
	elif rules.stage == Rules.Stage.FLOWERING and rules.flowered and rules.fruit < 0.05:
		key = "day"
	if key == "" or _nudges_shown.has(key):
		_waiting_t = 0.0
		return
	_waiting_t += dt
	if _waiting_t > nudge_delay:
		_nudges_shown[key] = true
		_waiting_t = 0.0
		if key == "night":
			_show_hint("It is ready to flower, but seems to be waiting for nightfall.", 0.0, 5.0)
		else:
			_show_hint("The flower turns its face to where a warm midday sun would be.", 0.0, 5.0)


# ---------------------------------------------------------------------------------------------
# Frame, input, layout
# ---------------------------------------------------------------------------------------------

func _process(delta: float) -> void:
	rules.tick(delta)
	water_button.has_water = rules.tank > 0
	_check_nudges(delta)
	if DEBUG:
		_update_debug()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		var p := (chamber.make_input_local(event) as InputEventMouse).position
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT and chamber.hit_plant(p):
			_show_hint(_observation(), 0.0, 3.2)
			get_viewport().set_input_as_handled()
		return
	if not (event is InputEventKey):
		return
	var k := event as InputEventKey
	if not k.pressed or k.echo:
		return
	if k.physical_keycode == KEY_ESCAPE:
		exit_requested.emit()
		return
	if not keyboard_shortcuts:
		return
	var controls_locked := completed
	match k.physical_keycode:
		KEY_Q, KEY_W:
			if not controls_locked:
				temperature_control.step(-1 if k.physical_keycode == KEY_Q else 1)
		KEY_A, KEY_S:
			if not controls_locked:
				light_control.step(-1 if k.physical_keycode == KEY_A else 1)
		KEY_Z, KEY_X:
			if not controls_locked:
				age_control.step(-1 if k.physical_keycode == KEY_Z else 1)
		KEY_D, KEY_SPACE:
			press_water()
		KEY_R: reset_puzzle()
		KEY_F3:
			DEBUG = not DEBUG
			_update_debug()
		_:
			return
	get_viewport().set_input_as_handled()


func _fit_to_viewport() -> void:
	if not auto_fit_to_viewport:
		return
	var vs := get_viewport_rect().size
	var s := minf(vs.x / DESIGN_SIZE.x, vs.y / DESIGN_SIZE.y)
	stage.scale = Vector2(s, s)
	stage.position = ((vs - DESIGN_SIZE * s) * 0.5).floor()
	queue_redraw()


func _draw() -> void:
	if auto_fit_to_viewport:
		draw_rect(Rect2(Vector2.ZERO, get_viewport_rect().size), Color(0.02, 0.015, 0.025))


func _show_hint(text: String, delay: float, hold: float) -> void:
	if _hint_tween:
		_hint_tween.kill()
	hint_label.text = text
	_hint_tween = create_tween()
	if delay > 0.0:
		_hint_tween.tween_interval(delay)
	_hint_tween.tween_property(hint_label, "modulate:a", 1.0, 0.5)
	_hint_tween.tween_interval(hold)
	_hint_tween.tween_property(hint_label, "modulate:a", 0.0, 1.0)


func _update_debug() -> void:
	debug_label.visible = DEBUG
	if DEBUG:
		debug_label.text = rules.describe() + ("   COMPLETED" if completed else "")


func _play(sound: String, pitch := 1.0) -> void:
	var p := audio.get_node_or_null(sound) as AudioStreamPlayer
	if p == null or p.stream == null:
		return
	p.pitch_scale = pitch
	p.play()


func _install_placeholder_sounds() -> void:
	for child in audio.get_children():
		var p := child as AudioStreamPlayer
		if p and p.stream == null:
			p.stream = Sounds.make(p.name)
