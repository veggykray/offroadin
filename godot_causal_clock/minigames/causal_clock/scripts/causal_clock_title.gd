extends Node
## Entry scene: the clock idles in the dark while the player chooses to begin.

const GAME_SCENE := "res://minigames/causal_clock/scenes/causal_clock_game.tscn"
const MAIN_LAYOUT := "res://minigames/causal_clock/data/layouts/default_layout.json"
const PRELUDE_LAYOUT := "res://minigames/causal_clock/data/layouts/prelude_layout.json"

var _world: Node2D
var _view: CausalClockView
var _ui: Control


func _ready() -> void:
	add_child(CausalClockAmbient.new())
	var layout := CausalClockLayout.load_from_file(MAIN_LAYOUT)
	_world = Node2D.new()
	add_child(_world)
	if layout.is_valid():
		_view = CausalClockView.new()
		_view.attract = true
		_world.add_child(_view)
		_view.setup(layout)
		_view.show_state(CausalClockState.create(layout.start_positions()), CausalClockMechanism.trace_chain(layout, layout.start_positions()))
		_view.modulate = Color(0.78, 0.76, 0.74)
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)
	_ui = Control.new()
	_ui.theme = CausalClockTheme.get_theme()
	_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_ui)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	_ui.add_child(box)
	CausalClockHUD._place(box, Vector2(0, 0.5), Vector2(110, 0), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_BOTH)
	box.add_child(CausalClockTheme.small_caps("a mechanism of memory", 15))
	var title := CausalClockTheme.label("The Causal Clock", 72)
	box.add_child(title)
	var sub := CausalClockTheme.label("Turn the rings. Pin what must hold.\nLead the broken chain back to the heart.", 22, CausalClockTheme.INK_DIM)
	box.add_child(sub)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 24)
	box.add_child(spacer)
	var begin := _button(box, "Begin", func(): _start(MAIN_LAYOUT))
	_button(box, "Prelude  ·  a smaller movement to learn the hands", func(): _start(PRELUDE_LAYOUT))
	_button(box, "Quit", func(): get_tree().quit())
	begin.grab_focus.call_deferred()
	box.modulate.a = 0.0
	create_tween().tween_property(box, "modulate:a", 1.0, 1.6).set_delay(0.3)
	get_viewport().size_changed.connect(_fit)
	_fit()


func _button(parent: Control, text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(460, 0)
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	b.pressed.connect(cb)
	parent.add_child(b)
	return b


func _fit() -> void:
	var s := get_viewport().get_visible_rect().size
	if _view == null:
		return
	var r := _view.visual_radius()
	_world.scale = Vector2.ONE * (s.y * 0.92 / (2.0 * r))
	_world.position = Vector2(s.x * 0.66, s.y * 0.5)


func _start(layout_path: String) -> void:
	CausalClockGame.pending_layout_path = layout_path
	get_tree().change_scene_to_file(GAME_SCENE)
