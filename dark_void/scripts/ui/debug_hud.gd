class_name DebugHUD
extends CanvasLayer
## Prototype-only readout: light energy bar, memory counter, creature state, controls.
## Disable `enabled` (or delete the node) to remove it; nothing else depends on it.
## The final game should communicate energy through the hand light itself.

@export var enabled := true
@export var visible_on_start := true
## Node with get_debug_info() -> Dictionary (DarkVoid).
@export var game_path: NodePath = ^".."
@export var toggle_action := &"dv_toggle_debug"
@export var show_controls := true

var _game: Node
var _bar: ProgressBar
var _bar_fill: StyleBoxFlat
var _info: Label


func _ready() -> void:
	if not enabled:
		visible = false
		set_process(false)
		set_process_unhandled_input(false)
		return
	DVInput.ensure_actions()
	_game = get_node_or_null(game_path)
	layer = 20
	visible = visible_on_start

	var panel := PanelContainer.new()
	panel.position = Vector2(16, 16)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.05, 0.05, 0.06, 0.55)
	bg.set_content_margin_all(10)
	bg.set_corner_radius_all(4)
	panel.add_theme_stylebox_override("panel", bg)
	add_child(panel)

	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)

	var title := Label.new()
	title.text = "DARK VOID — debug (F1)"
	title.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	title.add_theme_font_size_override("font_size", 13)
	box.add_child(title)

	_bar = ProgressBar.new()
	_bar.min_value = 0.0
	_bar.max_value = 1.0
	_bar.show_percentage = false
	_bar.custom_minimum_size = Vector2(240, 12)
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bar_fill = StyleBoxFlat.new()
	_bar_fill.bg_color = Color(1.0, 0.82, 0.55)
	var bar_bg := StyleBoxFlat.new()
	bar_bg.bg_color = Color(0.15, 0.15, 0.15)
	_bar.add_theme_stylebox_override("fill", _bar_fill)
	_bar.add_theme_stylebox_override("background", bar_bg)
	box.add_child(_bar)

	_info = Label.new()
	_info.add_theme_color_override("font_color", Color(0.72, 0.72, 0.72))
	_info.add_theme_font_size_override("font_size", 13)
	box.add_child(_info)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(toggle_action):
		visible = not visible


func _process(_delta: float) -> void:
	if not visible or _game == null or not _game.has_method("get_debug_info"):
		return
	var d: Dictionary = _game.call("get_debug_info")
	var ratio: float = d.get("energy_ratio", 1.0)
	_bar.value = ratio
	_bar_fill.bg_color = Color(0.8, 0.3, 0.2) if d.get("energy_exhausted", false) else Color(1.0, 0.82, 0.55)
	var lines := PackedStringArray()
	lines.append("Energy  %3d%%   light %s" % [int(ratio * 100.0), "ON" if d.get("light_on", false) else "off"])
	lines.append("Memories  %d / %d" % [d.get("memories", 0), d.get("memories_total", 0)])
	lines.append("Phase  %s" % d.get("phase", "?"))
	lines.append("Creature  %s   lit %.2f (%.1fs)   dist %.1f m" % [
			d.get("creature_state", "?"), d.get("creature_lit_amount", 0.0),
			d.get("creature_lit_time", 0.0), d.get("creature_distance", 0.0)])
	if d.get("phase", "") == "FINAL":
		lines.append("Touch point  %.1f m" % d.get("touch_distance", 0.0))
	if show_controls:
		lines.append("")
		lines.append("WASD/arrows float · mouse aim · hold LMB/Space light")
		lines.append("E interact · F2 reveal void · F3 force scare")
		lines.append("F4 activate next memory · R restart")
	_info.text = "\n".join(lines)
