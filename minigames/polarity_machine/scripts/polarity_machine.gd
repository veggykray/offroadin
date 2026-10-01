extends Node2D
## POLARITY MACHINE — a self-contained puzzle room about the Hermetic principle of polarity.
##
## Three physical controls set three continua (TEMPERATURE, LIGHT, AGE), each with five states.
## The plant teaches the player what it needs; the goal is to grow, ripen and open its fruit.
##
## Integration contract:
##   signal puzzle_completed(reward_id: String)   # reward_id == "polarity_fruit_key"
##   signal exit_requested()                      # Esc pressed; the host decides what to do
##   func reset_puzzle() -> void
##
## Flow of a state change:
##   control.value_changed → _on_*_changed → _refresh():
##       update_environment()  room glides toward the new setting (visual)
##       update_plant()        plant gets the integer state (for its observations)
##       evaluate_puzzle()     the rules below decide what the plant is allowed to do

signal puzzle_completed(reward_id: String)
signal exit_requested()

const REWARD_ID := "polarity_fruit_key"
const DESIGN_SIZE := Vector2(1920.0, 1080.0)
const Sounds := preload("res://minigames/polarity_machine/scripts/placeholder_sounds.gd")

enum Temperature { FREEZING, COLD, TEMPERATE, WARM, SCORCHING }
enum Light { DARK, DIM, SOFT, BRIGHT, BLAZING }
enum Age { NEW, YOUNG, MATURE, OLD, ANCIENT }

# --- The puzzle rules. The whole solution lives in these constants and evaluate_puzzle(). ---
## The fruit first sets on a MATURE plant that is WARM and BRIGHTLY lit.
const FRUIT_AGE := Age.MATURE
const FRUIT_TEMPERATURE := Temperature.WARM
const FRUIT_LIGHT := Light.BRIGHT
## It ripens when the plant is then aged to OLD while kept in sensible conditions.
const RIPEN_AGE := Age.OLD
const SENSIBLE_TEMPERATURES := [Temperature.TEMPERATE, Temperature.WARM]
const SENSIBLE_LIGHTS := [Light.SOFT, Light.BRIGHT]
## Near-miss on a mature plant (comfortable but not ideal): a closed bud forms and waits. A hint.
const BUD_HINT_BLOOM := 0.3

## Debug only: shows numeric machine state in a corner label. Never needed to play. (F3 toggles.)
@export var DEBUG := false
## Scale the 1920×1080 composition to fit the viewport (letterboxed). Turn off if the host
## positions / scales this scene itself.
@export var auto_fit_to_viewport := true
## Q/W temperature, A/S light, Z/X age, E open/collect fruit, R reset, F3 debug. Testing aid.
@export var keyboard_shortcuts := true
## Fill any AudioStreamPlayer without a stream with a synthesised placeholder.
@export var use_placeholder_sounds := true
@export var show_intro_text := true
@export_range(0, 4) var start_temperature: int = Temperature.COLD
@export_range(0, 4) var start_light: int = Light.DIM
@export_range(0, 4) var start_age: int = Age.YOUNG

var temperature: int = Temperature.COLD
var light: int = Light.DIM
var age: int = Age.YOUNG
var completed := false

@onready var stage: Node2D = $Stage
@onready var environment = $Stage/Environment
@onready var plant = $Stage/Plant
@onready var fallen_fruit = $Stage/FallenFruit
@onready var atmosphere = $Stage/Atmosphere
@onready var machine = $Stage/Machine
@onready var temperature_control = $Stage/Machine/TemperatureLever
@onready var light_control = $Stage/Machine/LightIris
@onready var age_control = $Stage/Machine/AgeDial
@onready var hint_label: Label = $UI/Hint
@onready var debug_label: Label = $UI/DebugLabel
@onready var audio: Node = $Audio

var _hint_tween: Tween
var _unripe_time := 0.0
var _unripe_hint_shown := false


func _ready() -> void:
	if use_placeholder_sounds:
		_install_placeholder_sounds()
	temperature_control.value_changed.connect(_on_temperature_changed)
	light_control.value_changed.connect(_on_light_changed)
	age_control.value_changed.connect(_on_age_changed)
	for c in [temperature_control, light_control, age_control]:
		c.detent_crossed.connect(_on_detent_crossed)
	environment.levels_changed.connect(_on_levels_changed)
	plant.bloom_milestone.connect(_on_bloom_milestone)
	plant.fruit_ripened.connect(_on_fruit_ripened)
	plant.fruit_dropped.connect(_on_fruit_dropped)
	plant.fruit_lost.connect(_on_fruit_lost)
	plant.inspected.connect(_on_plant_inspected)
	fallen_fruit.landed.connect(_on_fruit_landed)
	fallen_fruit.opened.connect(_on_fruit_opened)
	fallen_fruit.key_collected.connect(_on_key_collected)
	fallen_fruit.became_idle.connect(_refresh)
	get_viewport().size_changed.connect(_fit_to_viewport)
	_fit_to_viewport()
	hint_label.modulate.a = 0.0
	reset_puzzle()
	(audio.get_node("MachineHum") as AudioStreamPlayer).play()
	if show_intro_text:
		_show_hint("Something here wants to grow.", 0.8, 5.0)


func _exit_tree() -> void:
	for child in audio.get_children():
		(child as AudioStreamPlayer).stop()


## Puts the room back to its starting state. Safe to call at any time.
func reset_puzzle() -> void:
	completed = false
	temperature = clampi(start_temperature, 0, 4)
	light = clampi(start_light, 0, 4)
	age = clampi(start_age, 0, 4)
	temperature_control.set_value(temperature, false, false)
	light_control.set_value(light, false, false)
	age_control.set_value(age, false, false)
	plant.reset()
	fallen_fruit.reset()
	machine.reset()
	_unripe_time = 0.0
	_unripe_hint_shown = false
	environment.set_state(temperature, light, age, true)
	_refresh()


# ---------------------------------------------------------------------------------------------
# State system
# ---------------------------------------------------------------------------------------------

func _refresh() -> void:
	update_environment()
	update_plant()
	evaluate_puzzle()
	_update_debug()


func update_environment() -> void:
	environment.set_state(temperature, light, age)
	var hum: AudioStreamPlayer = audio.get_node("MachineHum")
	hum.pitch_scale = 0.8 + 0.1 * float(temperature)


func update_plant() -> void:
	fallen_fruit.rot_active = age == Age.ANCIENT


## The rules. Everything the plant may do follows from the three integers here.
func evaluate_puzzle() -> void:
	var free_to_fruit: bool = not completed and fallen_fruit.is_idle()
	var ideal := age == FRUIT_AGE and temperature == FRUIT_TEMPERATURE and light == FRUIT_LIGHT
	var near := age == FRUIT_AGE and temperature in SENSIBLE_TEMPERATURES and light in SENSIBLE_LIGHTS
	if free_to_fruit and ideal:
		plant.bloom_target = 1.0
	elif free_to_fruit and near:
		plant.bloom_target = BUD_HINT_BLOOM
	else:
		plant.bloom_target = 0.0
	plant.ripen_allowed = age == RIPEN_AGE and temperature in SENSIBLE_TEMPERATURES and light in SENSIBLE_LIGHTS
	plant.fruit_hazard = temperature == Temperature.FREEZING or temperature == Temperature.SCORCHING
	plant.rot_active = age == Age.ANCIENT
	plant.rewind_active = age <= Age.YOUNG


# ---------------------------------------------------------------------------------------------
# Control handlers
# ---------------------------------------------------------------------------------------------

func _on_temperature_changed(v: int, _old: int) -> void:
	temperature = v
	_play("TemperatureShift", 0.8 + 0.1 * float(v))
	machine.jolt()
	_refresh()


func _on_light_changed(v: int, _old: int) -> void:
	light = v
	_play("LightShift", 0.75 + 0.12 * float(v))
	machine.jolt()
	_refresh()


func _on_age_changed(v: int, _old: int) -> void:
	age = v
	_play("AgeShift", 1.2 - 0.1 * float(v))
	machine.jolt(1.5)
	_refresh()


func _on_detent_crossed(v: int) -> void:
	_play("LeverClick", 0.85 + 0.08 * float(v))


func _on_levels_changed(t: float, l: float, a: float) -> void:
	plant.set_levels(t, l, a)
	machine.set_levels(t, l, a)
	atmosphere.set_levels(t, l, a)


# ---------------------------------------------------------------------------------------------
# Plant and fruit events
# ---------------------------------------------------------------------------------------------

func _on_bloom_milestone(milestone: String) -> void:
	match milestone:
		"stir":
			machine.pulse(0.35, Color(0.7, 1.0, 0.7))
			_play("PlantGrow")
		"bud":
			_play("PlantGrow", 1.25)
		"flower":
			machine.pulse(0.5, Color(0.85, 0.6, 1.0))
			atmosphere.flash(plant.fruit_stage_position(), Color(0.8, 0.6, 1.0), 160.0, 1.0)
		"fruit":
			machine.settle()
			machine.pulse(0.6, Color(1.0, 0.9, 0.6))
			_play("FruitAppear")


func _on_fruit_ripened() -> void:
	atmosphere.flash(plant.fruit_stage_position(), Color(1.0, 0.5, 0.5), 140.0, 0.9)


func _on_fruit_dropped(stage_pos: Vector2) -> void:
	fallen_fruit.drop_from(stage_pos)
	_refresh()


func _on_fruit_lost(stage_pos: Vector2, reason: String) -> void:
	fallen_fruit.crumble_from(stage_pos, reason)
	_refresh()


func _on_fruit_landed() -> void:
	_play("FruitDrop")


func _on_fruit_opened() -> void:
	_play("FruitOpen")
	atmosphere.flash(fallen_fruit.key_position(), Color(1.0, 0.85, 0.5), 180.0, 1.0)


func _on_key_collected() -> void:
	if completed:
		return
	completed = true
	machine.pulse(1.0, Color(1.0, 0.85, 0.45))
	machine.settle()
	atmosphere.flash(fallen_fruit.key_position(), Color(1.0, 0.85, 0.5), 520.0, 1.8)
	atmosphere.flash(machine.core_position(), Color(1.0, 0.8, 0.4), 300.0, 1.4)
	_play("PuzzleSuccess")
	_show_hint("The machine exhales, and falls quiet.", 0.4, 4.0)
	_refresh()
	puzzle_completed.emit(REWARD_ID)


func _on_plant_inspected(target: String) -> void:
	_show_hint(_observation(target), 0.0, 3.2)


## A short, sensory description of the plant's worst complaint. Never states a setting.
func _observation(target: String) -> String:
	if target == "fruit":
		if plant.decay > 0.3:
			return "The fruit is spoiling on the stem."
		if plant.ripeness >= 1.0:
			return "Heavy and ready to fall."
		if plant.ripeness > 0.05:
			return "The fruit is colouring."
		return "Hard and green. It is not ready."
	match age:
		Age.NEW:
			return "A seed, barely stirring. Far too young to bear anything."
		Age.YOUNG:
			return "A young shoot. It has a lot of growing to do."
		Age.ANCIENT:
			return "Ancient and brittle. Whatever it once gave is long spent."
	match temperature:
		Temperature.FREEZING:
			return "Frozen stiff. Rime coats every leaf."
		Temperature.SCORCHING:
			return "The leaf edges are blackened and curling in the heat."
	match light:
		Light.DARK:
			return "In the dark its leaves have folded shut."
		Light.BLAZING:
			return "The glare is bleaching its leaves pale."
	if temperature == Temperature.COLD:
		return "Its leaves sag in the chill."
	if light == Light.DIM:
		return "It strains weakly in the gloom."
	if age == Age.OLD:
		if plant.has_fruit():
			return "Gnarled now. The fruit hangs heavy on it."
		return "Gnarled with age. Its flowering days seem behind it."
	if plant.has_fruit():
		return "Vigorous. The fruit hangs hard and green."
	if plant.bloom > 0.5:
		return "Something is happening."
	if plant.bloom > 0.05:
		return "Content, but not quite thriving. A tight bud waits, unwilling to open."
	return "Healthy, and full grown."


# ---------------------------------------------------------------------------------------------
# Presentation helpers
# ---------------------------------------------------------------------------------------------

func _process(delta: float) -> void:
	# One gentle nudge if the fruit has hung green for a long time without ripening.
	if plant.has_fruit() and plant.ripeness < 0.05:
		_unripe_time += delta
		if _unripe_time > 30.0 and not _unripe_hint_shown:
			_unripe_hint_shown = true
			_show_hint("The fruit hangs green and hard. Time has not finished with it.", 0.0, 5.0)
	else:
		_unripe_time = 0.0
	if DEBUG:
		_update_debug()


func _unhandled_input(event: InputEvent) -> void:
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
	match k.physical_keycode:
		KEY_Q: temperature_control.step(-1)
		KEY_W: temperature_control.step(1)
		KEY_A: light_control.step(-1)
		KEY_S: light_control.step(1)
		KEY_Z: age_control.step(-1)
		KEY_X: age_control.step(1)
		KEY_E: fallen_fruit.interact()
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
	# Letterbox colour behind the stage when the window is not exactly 16:9.
	if auto_fit_to_viewport:
		draw_rect(Rect2(Vector2.ZERO, get_viewport_rect().size), Color(0.02, 0.015, 0.025))


func _show_hint(text: String, delay: float, hold: float) -> void:
	if _hint_tween:
		_hint_tween.kill()
	hint_label.text = text
	_hint_tween = create_tween()
	if delay > 0.0:
		_hint_tween.tween_interval(delay)
	_hint_tween.tween_property(hint_label, "modulate:a", 1.0, 0.6)
	_hint_tween.tween_interval(hold)
	_hint_tween.tween_property(hint_label, "modulate:a", 0.0, 1.2)


func _update_debug() -> void:
	debug_label.visible = DEBUG
	if not DEBUG:
		return
	debug_label.text = "T %d %s   L %d %s   A %d %s\nbloom %.2f  ripe %.2f  decay %.2f  fruit %s  floor-fruit %s%s" % [
			temperature, Temperature.keys()[temperature], light, Light.keys()[light], age, Age.keys()[age],
			plant.bloom, plant.ripeness, plant.decay, "hanging" if plant.has_fruit() else "-",
			fallen_fruit.state_name(), "   COMPLETED" if completed else ""]


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
