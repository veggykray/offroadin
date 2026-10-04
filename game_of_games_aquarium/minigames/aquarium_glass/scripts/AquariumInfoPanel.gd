extends Control
## The aquarium information panel ("hint level 3"). Opened by clicking the
## little plaque beside the tank (OutsideProps) or by calling open().
## Text comes from data/info_panel_entries.json - edit that file to change it.

signal opened
signal closed

@export_file("*.json") var entries_path := "res://minigames/aquarium_glass/data/info_panel_entries.json"

var activity: Node
var is_open := false
var _built := false


func setup(p_activity: Node) -> void:
	activity = p_activity
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false


func open() -> void:
	if not _built:
		_build()
	visible = true
	is_open = true
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.25)
	if activity:
		activity.audio.play("bubbles", -12.0, 0.8)
	opened.emit()


func close() -> void:
	if not is_open:
		visible = false
		return
	is_open = false
	visible = false
	closed.emit()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close()
		accept_event()


func _unhandled_key_input(event: InputEvent) -> void:
	if is_open and event.is_pressed() and (event as InputEventKey).keycode in [KEY_ESCAPE, KEY_SPACE, KEY_ENTER]:
		close()
		get_viewport().set_input_as_handled()


func _build() -> void:
	_built = true
	var data := {"title": "RESIDENTS OF THE DEEP TANK", "footer": "", "entries": []}
	if FileAccess.file_exists(entries_path):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(entries_path))
		if parsed is Dictionary:
			data = parsed
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dim)

	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.13, 0.14, 0.97)
	sb.border_color = Color(0.72, 0.58, 0.3)
	sb.set_border_width_all(6)
	sb.set_corner_radius_all(14)
	sb.set_content_margin_all(34)
	sb.shadow_color = Color(0, 0, 0, 0.5)
	sb.shadow_size = 18
	panel.add_theme_stylebox_override("panel", sb)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(980, 0)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(panel)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(vb)
	var title := Label.new()
	title.text = str(data.get("title", ""))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 40)
	title.add_theme_color_override("font_color", Color(0.95, 0.82, 0.5))
	vb.add_child(title)
	var sep := HSeparator.new()
	vb.add_child(sep)
	for e in data.get("entries", []):
		var name_l := Label.new()
		name_l.text = str(e.get("name", ""))
		name_l.add_theme_font_size_override("font_size", 27)
		name_l.add_theme_color_override("font_color", Color(0.95, 0.85, 0.6))
		vb.add_child(name_l)
		if str(e.get("latin", "")) != "":
			var latin := Label.new()
			latin.text = str(e.latin)
			latin.add_theme_font_size_override("font_size", 17)
			latin.add_theme_color_override("font_color", Color(0.55, 0.75, 0.72))
			vb.add_child(latin)
		var body := Label.new()
		body.text = "\n".join(PackedStringArray(e.get("lines", [])))
		body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		body.custom_minimum_size = Vector2(900, 0)
		body.add_theme_font_size_override("font_size", 21)
		body.add_theme_color_override("font_color", Color(0.85, 0.92, 0.9))
		vb.add_child(body)
	if str(data.get("footer", "")) != "":
		var foot := Label.new()
		foot.text = str(data.footer)
		foot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		foot.add_theme_font_size_override("font_size", 19)
		foot.add_theme_color_override("font_color", Color(0.9, 0.45, 0.4))
		vb.add_child(foot)
	# Re-centre once sizes are known.
	await get_tree().process_frame
	panel.position = (size - panel.size) * 0.5
