class_name Cards
extends CanvasLayer
## Title and ending cards. Deadpan.

signal start_requested
signal restart_requested

var shade: ColorRect
var title: Label
var line1: Label
var line2: Label
var prompt: Label
var mode := "title"  # title | hidden | end
var t := 0.0
var can_click := false
var _waiting_for_sound := true


func _ready() -> void:
	layer = 20
	shade = ColorRect.new()
	shade.color = Color(0.02, 0.01, 0.03, 0.82)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	var spaced := FontVariation.new()
	spaced.base_font = ThemeDB.fallback_font
	spaced.spacing_glyph = 10
	title = _label(spaced, 76, Color(0.98, 0.9, 0.8), 360)
	var small := FontVariation.new()
	small.base_font = ThemeDB.fallback_font
	small.spacing_glyph = 2
	line1 = _label(small, 28, Color(0.9, 0.8, 0.72), 520)
	line2 = _label(small, 24, Color(0.75, 0.66, 0.6), 570)
	prompt = _label(small, 22, Color(1, 0.85, 0.7), 760)
	show_title()


func _label(font: Font, size: int, col: Color, y: float) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 6)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.set_anchors_preset(Control.PRESET_TOP_WIDE)
	l.offset_left = 0.0
	l.offset_right = 0.0
	l.offset_top = y
	l.offset_bottom = y + size * 1.6
	add_child(l)
	return l


func show_title() -> void:
	mode = "title"
	visible = true
	t = 0.0
	can_click = false
	title.text = "THE BEAST TENDING"
	line1.text = "Bill has been asked to tend to the beast."
	line2.text = "It is wary of strangers."
	prompt.text = ""
	for l in [title, line1, line2, prompt]:
		l.modulate.a = 0.0
	shade.modulate.a = 1.0


func show_end() -> void:
	mode = "end"
	visible = true
	t = 0.0
	can_click = false
	title.text = "THE BEAST IS TENDED."
	line1.text = "Bill would like to sit down for a moment."
	line2.text = ""
	prompt.text = ""
	for l in [title, line1, line2, prompt]:
		l.modulate.a = 0.0
	shade.modulate.a = 0.0


func hide_cards() -> void:
	mode = "hidden"
	var tw := create_tween().set_parallel(true)
	for l in [title, line1, line2, prompt]:
		tw.tween_property(l, "modulate:a", 0.0, 0.6)
	tw.tween_property(shade, "modulate:a", 0.0, 1.6)
	tw.chain().tween_callback(func(): visible = false)


func _process(delta: float) -> void:
	t += delta
	if mode == "title":
		title.modulate.a = clampf((t - 0.3) / 1.5, 0.0, 1.0)
		line1.modulate.a = clampf((t - 1.6) / 1.2, 0.0, 1.0)
		line2.modulate.a = clampf((t - 2.6) / 1.2, 0.0, 1.0)
		var sound_ok: bool = Game.voice == null or Game.voice.loaded or t > 12.0
		if t > 3.2 and sound_ok:
			can_click = true
			prompt.text = "[ click to begin ]"
			prompt.modulate.a = 0.55 + 0.45 * sin(t * 2.2)
		elif t > 3.2:
			prompt.text = "the beast is breathing…"
			prompt.modulate.a = 0.5
	elif mode == "end":
		shade.modulate.a = clampf(t / 3.0, 0.0, 1.0)
		title.modulate.a = clampf((t - 2.0) / 2.0, 0.0, 1.0)
		line1.modulate.a = clampf((t - 5.0) / 1.5, 0.0, 1.0)
		if t > 7.0:
			can_click = true
			prompt.text = "[ click to tend again ]"
			prompt.modulate.a = 0.55 + 0.45 * sin(t * 2.2)


func _input(event: InputEvent) -> void:
	if not can_click or mode == "hidden":
		return
	var clicked: bool = (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT) \
		or (event is InputEventKey and event.pressed and (event.keycode == KEY_SPACE or event.keycode == KEY_ENTER))
	if not clicked:
		return
	get_viewport().set_input_as_handled()
	can_click = false
	if mode == "title":
		hide_cards()
		start_requested.emit()
	elif mode == "end":
		restart_requested.emit()
