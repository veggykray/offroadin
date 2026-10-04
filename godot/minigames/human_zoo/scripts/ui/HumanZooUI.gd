class_name HumanZooUI
extends CanvasLayer
## All screen-space UI for the Human Zoo: dialogue lines, the 2–4 option list,
## interaction prompts, Bill's thought bubble, the nudge offer, the thought
## board, the tuning dial, machine controls help and the finale card.
##
## HumanZooGame drives it through a small coroutine API:
##   await ui.say(speaker, text, style, pitch)
##   var topic := await ui.choose(options)
## Swap this for the real game's UI by implementing the same methods.

signal line_advanced
signal option_chosen(topic_id: String)
signal blip(pitch: float)
signal finale_dismissed

const PAPER := Color(0.95, 0.91, 0.8)
const INK := Color(0.16, 0.12, 0.08)
const BRASS := Color(0.72, 0.55, 0.26)

@export var chars_per_second := 52.0

var bill: Node2D
var busy := false

var _font: Font
var _root: Control
var _dialogue: PanelContainer
var _speaker: Label
var _text: Label
var _more: Label
var _options_panel: PanelContainer
var _options_box: VBoxContainer
var _prompt: Label
var _thought: PanelContainer
var _thought_label: Label
var _thought_t := 0.0
var _nudge: Label
var _machine_help: Label
var _debug: Label
var _finale: Control
var _finale_title: Label
var _finale_sub: Label
var board: HumanZooThoughtBoard
var tuning: HumanZooTuningDial

var _typing := false
var _waiting_line := false
var _options: Array = []
var _option_rows: Array = []
var _selected := 0
var _choosing := false
var _shake := 0.0
var _blip_acc := 0.0
var _pitch := 1.0
var _finale_waiting := false


func _ready() -> void:
	layer = 20
	_font = ThemeDB.fallback_font
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_build_vignette()
	_build_dialogue()
	_build_options()
	_build_misc()
	board = HumanZooThoughtBoard.new()
	board.set_anchors_preset(Control.PRESET_FULL_RECT)
	board.visible = false
	_root.add_child(board)
	tuning = HumanZooTuningDial.new()
	tuning.set_anchors_preset(Control.PRESET_FULL_RECT)
	tuning.visible = false
	_root.add_child(tuning)
	_build_finale()


func _panel_style(bg: Color, border: Color, radius := 6, border_w := 3) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(border_w)
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 10
	return sb


func _label(size: int, color: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _build_vignette() -> void:
	var v := HumanZooVignette.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(v)


func _build_dialogue() -> void:
	_dialogue = PanelContainer.new()
	_dialogue.add_theme_stylebox_override("panel", _panel_style(Color(0.09, 0.07, 0.06, 0.94), BRASS))
	_dialogue.anchor_left = 0.5
	_dialogue.anchor_right = 0.5
	_dialogue.anchor_top = 1.0
	_dialogue.anchor_bottom = 1.0
	_dialogue.offset_left = -640
	_dialogue.offset_right = 640
	_dialogue.offset_top = -250
	_dialogue.offset_bottom = -34
	_dialogue.visible = false
	_dialogue.mouse_filter = Control.MOUSE_FILTER_STOP
	_dialogue.gui_input.connect(_on_dialogue_click)
	_root.add_child(_dialogue)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dialogue.add_child(v)
	_speaker = _label(24, BRASS.lightened(0.3))
	v.add_child(_speaker)
	_text = _label(31, PAPER)
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.visible_characters_behavior = TextServer.VC_CHARS_AFTER_SHAPING
	_text.custom_minimum_size = Vector2(1200, 0)
	_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(_text)
	_more = _label(20, BRASS)
	_more.text = "E  >"
	_more.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.add_child(_more)


func _build_options() -> void:
	_options_panel = PanelContainer.new()
	_options_panel.add_theme_stylebox_override("panel", _panel_style(Color(0.12, 0.09, 0.07, 0.96), BRASS.darkened(0.2)))
	_options_panel.anchor_left = 0.5
	_options_panel.anchor_right = 0.5
	_options_panel.anchor_top = 1.0
	_options_panel.anchor_bottom = 1.0
	_options_panel.offset_left = 40
	_options_panel.offset_right = 640
	_options_panel.offset_top = -262
	_options_panel.offset_bottom = -262
	_options_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_options_panel.custom_minimum_size = Vector2(600, 0)
	_options_panel.visible = false
	_root.add_child(_options_panel)
	_options_box = VBoxContainer.new()
	_options_box.add_theme_constant_override("separation", 6)
	_options_panel.add_child(_options_box)


func _build_misc() -> void:
	_prompt = _label(26, PAPER)
	_prompt.anchor_left = 0.5
	_prompt.anchor_right = 0.5
	_prompt.anchor_top = 1.0
	_prompt.anchor_bottom = 1.0
	_prompt.offset_left = -400
	_prompt.offset_right = 400
	_prompt.offset_top = -86
	_prompt.offset_bottom = -40
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_prompt.add_theme_constant_override("outline_size", 8)
	_prompt.visible = false
	_root.add_child(_prompt)

	_thought = PanelContainer.new()
	var ts := _panel_style(Color(0.97, 0.95, 0.9, 0.95), Color(0.4, 0.35, 0.3), 22, 2)
	ts.content_margin_left = 18
	ts.content_margin_right = 18
	ts.content_margin_top = 10
	ts.content_margin_bottom = 10
	_thought.add_theme_stylebox_override("panel", ts)
	_thought.visible = false
	_thought.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_thought)
	_thought_label = _label(23, Color(0.2, 0.18, 0.2))
	_thought_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_thought_label.custom_minimum_size = Vector2(380, 0)
	_thought.add_child(_thought_label)

	_nudge = _label(22, Color(0.15, 0.1, 0.05))
	var ns := _panel_style(BRASS, BRASS.darkened(0.4), 4, 2)
	ns.content_margin_top = 8
	ns.content_margin_bottom = 8
	_nudge.add_theme_stylebox_override("normal", ns)
	_nudge.text = "NEED A NUDGE?   H"
	_nudge.anchor_left = 1.0
	_nudge.anchor_right = 1.0
	_nudge.offset_left = -330
	_nudge.offset_right = -30
	_nudge.offset_top = 30
	_nudge.offset_bottom = 74
	_nudge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_nudge.visible = false
	_root.add_child(_nudge)

	var hint := _label(18, Color(0.85, 0.78, 0.62, 0.55))
	hint.text = "A/D walk   ·   E speak / use   ·   TAB thoughts"
	hint.offset_left = 30
	hint.offset_top = 26
	hint.offset_right = 800
	hint.offset_bottom = 60
	_root.add_child(hint)

	_machine_help = _label(22, PAPER)
	_machine_help.anchor_left = 0.5
	_machine_help.anchor_right = 0.5
	_machine_help.anchor_top = 1.0
	_machine_help.anchor_bottom = 1.0
	_machine_help.offset_left = -600
	_machine_help.offset_right = 600
	_machine_help.offset_top = -70
	_machine_help.offset_bottom = -30
	_machine_help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_machine_help.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_machine_help.add_theme_constant_override("outline_size", 8)
	_machine_help.visible = false
	_root.add_child(_machine_help)

	_debug = _label(16, Color(0.6, 1.0, 0.6))
	_debug.offset_left = 30
	_debug.offset_top = 70
	_debug.offset_right = 700
	_debug.offset_bottom = 400
	_debug.add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	_debug.add_theme_constant_override("outline_size", 6)
	_debug.visible = false
	_root.add_child(_debug)


func _build_finale() -> void:
	_finale = ColorRect.new()
	_finale.color = Color(0.02, 0.015, 0.01, 0.0)
	_finale.set_anchors_preset(Control.PRESET_FULL_RECT)
	_finale.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_finale.visible = false
	_root.add_child(_finale)
	_finale_title = _label(96, Color(1.0, 0.88, 0.6))
	_finale_title.set_anchors_preset(Control.PRESET_CENTER)
	_finale_title.offset_left = -800
	_finale_title.offset_right = 800
	_finale_title.offset_top = -120
	_finale_title.offset_bottom = 0
	_finale_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_finale.add_child(_finale_title)
	_finale_sub = _label(30, PAPER)
	_finale_sub.set_anchors_preset(Control.PRESET_CENTER)
	_finale_sub.offset_left = -800
	_finale_sub.offset_right = 800
	_finale_sub.offset_top = 20
	_finale_sub.offset_bottom = 140
	_finale_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_finale_sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_finale.add_child(_finale_sub)


# ===================================================================== dialogue

## Show one line and wait for the player to advance.
## style: "character" | "bill" | "narrator" | "pause" | "loud"
func say(speaker: String, text: String, style := "character", pitch := 1.0, pause_seconds := 0.0) -> void:
	busy = true
	_dialogue.visible = true
	_options_panel.visible = false
	_pitch = pitch
	_speaker.text = speaker
	_text.add_theme_font_size_override("font_size", 31)
	_text.add_theme_color_override("font_color", PAPER)
	match style:
		"bill":
			_speaker.add_theme_color_override("font_color", Color(0.65, 0.8, 1.0))
		"narrator":
			_speaker.text = ""
			_text.add_theme_color_override("font_color", Color(0.75, 0.72, 0.65))
		"loud":
			_text.add_theme_font_size_override("font_size", 50)
			_shake = 1.2
			_speaker.add_theme_color_override("font_color", BRASS.lightened(0.3))
		_:
			_speaker.add_theme_color_override("font_color", BRASS.lightened(0.3))
	if style == "pause":
		_text.text = "..."
		_text.visible_ratio = 1.0
		_more.visible = false
		await get_tree().create_timer(maxf(pause_seconds, 0.4)).timeout
		return
	_text.text = text
	_text.visible_characters = 0
	_typing = true
	_waiting_line = true
	_more.visible = false
	await line_advanced


func close_dialogue() -> void:
	_dialogue.visible = false
	_options_panel.visible = false
	_typing = false
	_waiting_line = false
	_choosing = false
	busy = false


## Show the options and wait for a choice. Returns the topic id.
func choose(options: Array) -> String:
	busy = true
	_options = options
	_choosing = true
	_more.visible = false
	for c in _options_box.get_children():
		_options_box.remove_child(c)
		c.queue_free()
	_option_rows.clear()
	for i in options.size():
		var row := _make_option_row(options[i], i)
		_options_box.add_child(row)
		_option_rows.append(row)
	_selected = 0
	_refresh_option_highlight()
	_options_panel.offset_top = _options_panel.offset_bottom
	_options_panel.visible = true
	var chosen: String = await option_chosen
	_options_panel.visible = false
	_choosing = false
	return chosen


func _make_option_row(opt: Dictionary, index: int) -> PanelContainer:
	var row := PanelContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_STOP
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(h)
	var num := _label(20, BRASS.darkened(0.1))
	num.text = str(index + 1) if opt["style"] != "leave" else "ESC"
	num.custom_minimum_size = Vector2(36, 0)
	h.add_child(num)
	var style: String = opt["style"]
	if style == "message" or style == "new":
		var tag := _label(15, Color(0.1, 0.07, 0.04))
		tag.text = "MESSAGE" if style == "message" else "NEW"
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(1.0, 0.72, 0.3) if style == "message" else Color(0.7, 0.92, 0.55)
		sb.set_corner_radius_all(4)
		sb.content_margin_left = 6
		sb.content_margin_right = 6
		sb.content_margin_top = 2
		sb.content_margin_bottom = 2
		tag.add_theme_stylebox_override("normal", sb)
		tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(tag)
	var l := _label(25, PAPER)
	l.text = opt["label"]
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	match style:
		"message":
			l.add_theme_color_override("font_color", Color(1.0, 0.82, 0.5))
		"new":
			l.add_theme_color_override("font_color", Color(0.9, 1.0, 0.8))
		"subdued", "leave":
			l.add_theme_color_override("font_color", Color(0.6, 0.56, 0.5))
	h.add_child(l)
	row.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			_pick(index)
		elif ev is InputEventMouseMotion and _selected != index:
			_selected = index
			_refresh_option_highlight())
	return row


func _refresh_option_highlight() -> void:
	for i in _option_rows.size():
		var sb := StyleBoxFlat.new()
		sb.set_corner_radius_all(5)
		sb.content_margin_left = 10
		sb.content_margin_right = 10
		sb.content_margin_top = 6
		sb.content_margin_bottom = 6
		sb.bg_color = Color(0.85, 0.65, 0.3, 0.22) if i == _selected else Color(0, 0, 0, 0)
		if i == _selected:
			sb.border_color = BRASS
			sb.border_width_left = 4
		_option_rows[i].add_theme_stylebox_override("panel", sb)


func _pick(index: int) -> void:
	if not _choosing or index < 0 or index >= _options.size():
		return
	get_viewport().set_input_as_handled()
	_choosing = false
	option_chosen.emit(String(_options[index]["topic"]))


func _on_dialogue_click(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
		_advance()


func _advance() -> void:
	if _typing:
		_text.visible_characters = -1
		_typing = false
		_more.visible = true
		return
	if _waiting_line:
		_waiting_line = false
		line_advanced.emit()


func _unhandled_input(event: InputEvent) -> void:
	if _finale_waiting and event.is_action_pressed("hz_interact"):
		get_viewport().set_input_as_handled()
		_finale_waiting = false
		finale_dismissed.emit()
		return
	if board.visible and (event.is_action_pressed("hz_board") or event.is_action_pressed("hz_cancel")):
		get_viewport().set_input_as_handled()
		board.visible = false
		return
	if _choosing:
		if event.is_action_pressed("hz_up"):
			_selected = wrapi(_selected - 1, 0, _options.size())
			_refresh_option_highlight()
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("hz_down"):
			_selected = wrapi(_selected + 1, 0, _options.size())
			_refresh_option_highlight()
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("hz_interact"):
			_pick(_selected)
		elif event.is_action_pressed("hz_cancel"):
			_pick(_options.size() - 1)
		elif event is InputEventKey and event.pressed and not event.echo:
			var n: int = event.keycode - KEY_1
			if n >= 0 and n < 9 and n < _options.size():
				_pick(n)
		return
	if _waiting_line and event.is_action_pressed("hz_interact"):
		get_viewport().set_input_as_handled()
		_advance()


func _process(delta: float) -> void:
	if _typing:
		var before := _text.visible_characters
		var total := _text.text.length()
		var next := mini(total, before + maxi(1, int(ceil(chars_per_second * delta))))
		_text.visible_characters = next
		_blip_acc += next - before
		if _blip_acc >= 3:
			_blip_acc = 0
			blip.emit(_pitch * randf_range(0.92, 1.08))
		if next >= total:
			_text.visible_characters = -1
			_typing = false
			_more.visible = true
	# Thought bubble follows Bill
	if _thought.visible:
		_thought_t -= delta
		_thought.modulate.a = clampf(_thought_t, 0.0, 1.0)
		if _thought_t <= 0.0:
			_thought.visible = false
		elif bill != null and is_instance_valid(bill):
			var sp := bill.get_global_transform_with_canvas().origin
			var target := sp + Vector2(-_thought.size.x * 0.5, -260 - _thought.size.y)
			var vp := get_viewport().get_visible_rect().size
			target.x = clampf(target.x, 20, vp.x - _thought.size.x - 20)
			target.y = clampf(target.y, 90, vp.y - _thought.size.y - 300)
			_thought.position = target
	if _shake > 0.0:
		_shake = maxf(_shake - delta, 0.0)
		_root.position = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * 14.0 * _shake
	else:
		_root.position = Vector2.ZERO


# ========================================================================= misc

func show_prompt(text: String) -> void:
	_prompt.text = text
	_prompt.visible = text != ""


func think(text: String, seconds := 4.5, is_nudge := false) -> void:
	_thought_label.text = text
	_thought_label.add_theme_color_override("font_color", Color(0.45, 0.25, 0.08) if is_nudge else Color(0.2, 0.18, 0.2))
	_thought.visible = true
	_thought.reset_size()
	_thought_t = seconds


func set_nudge_offered(on: bool) -> void:
	_nudge.visible = on


func show_machine_help(on: bool, lever_unlocked := false) -> void:
	_machine_help.visible = on
	_machine_help.text = "A/D  choose dial    W/S  turn    E  %s    ESC  step back" % ("pull the lever" if lever_unlocked else "turn / try the lever")


func set_debug(text: String) -> void:
	_debug.visible = text != ""
	_debug.text = text


func toggle_board() -> void:
	board.visible = not board.visible
	if board.visible:
		board.queue_redraw()


func show_finale(title: String, subtitle: String) -> void:
	_finale.visible = true
	_finale_title.text = title
	_finale_sub.text = subtitle
	_finale_title.modulate.a = 0.0
	_finale_sub.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_finale, "color:a", 0.55, 2.0)
	tw.parallel().tween_property(_finale_title, "modulate:a", 1.0, 2.5)
	tw.tween_property(_finale_sub, "modulate:a", 1.0, 1.5)
	tw.tween_callback(func(): _finale_waiting = true)


func hide_finale() -> void:
	var tw := create_tween()
	tw.tween_property(_finale, "modulate:a", 0.0, 1.0)
	tw.tween_callback(func():
		_finale.visible = false
		_finale.modulate.a = 1.0)
