class_name LBHud
extends CanvasLayer
## Deliberately minimal UI: a fade-in, a brief control hint, the debug panel,
## and a tiny item note at the very end. No meters, no victory screen.

var fade: ColorRect
var hint: Label
var item: Label
var replay: Label
var panel: Label
var _font: Font
var manager: LBManager


func _ready() -> void:
	layer = 10
	manager = get_parent() as LBManager
	var sf := SystemFont.new()
	sf.font_names = PackedStringArray(["Georgia", "Garamond", "Times New Roman", "DejaVu Serif", "Liberation Serif", "serif"])
	sf.font_italic = true
	_font = sf
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	hint = _label(root, 17, Color(0.92, 0.86, 0.72, 0.0))
	hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.position = Vector2(-500, -64)
	hint.size = Vector2(1000, 40)
	hint.text = "mouse: reach   ·   hold click: grab   ·   click beside another hand: slap   ·   right click: retract   ·   shift: creep\nwhen someone is looking, keep perfectly still"
	item = _label(root, 22, Color(0.95, 0.88, 0.7, 0.0))
	item.set_anchors_preset(Control.PRESET_TOP_LEFT)
	item.position = Vector2(36, 30)
	item.size = Vector2(600, 80)
	replay = _label(root, 15, Color(0.85, 0.8, 0.7, 0.0))
	replay.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	replay.position = Vector2(-330, -50)
	replay.size = Vector2(300, 30)
	replay.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	replay.text = "click to sit down again"
	panel = Label.new()
	panel.position = Vector2(12, 12)
	panel.add_theme_font_size_override("font_size", 13)
	panel.add_theme_color_override("font_color", Color(0.6, 1.0, 0.6))
	panel.add_theme_color_override("font_shadow_color", Color.BLACK)
	panel.add_theme_constant_override("shadow_offset_x", 1)
	panel.add_theme_constant_override("shadow_offset_y", 1)
	panel.visible = false
	root.add_child(panel)
	fade = ColorRect.new()
	fade.color = Color(0, 0, 0, 1)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade)


func _label(parent: Control, size: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", _font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l


func fade_in(t: float) -> void:
	fade.color.a = 1.0
	var tw := create_tween()
	tw.tween_property(fade, "color:a", 0.0, t).set_trans(Tween.TRANS_SINE)


func show_hint() -> void:
	var tw := create_tween()
	tw.tween_interval(1.5)
	tw.tween_property(hint, "theme_override_colors/font_color:a", 0.75, 1.2)
	tw.tween_interval(9.0)
	tw.tween_property(hint, "theme_override_colors/font_color:a", 0.0, 2.0)


func show_item(name_: String, seconds: float, attempts: int) -> void:
	var m := int(seconds) / 60
	var s := int(seconds) % 60
	item.text = "%s\n%d:%02d  ·  %s" % [name_, m, s, ("first attempt" if attempts == 1 else "%d attempts" % attempts)]
	var tw := create_tween()
	tw.tween_property(item, "theme_override_colors/font_color:a", 0.9, 2.0)


func show_replay() -> void:
	var tw := create_tween()
	tw.tween_property(replay, "theme_override_colors/font_color:a", 0.6, 2.0)


func _process(_dt: float) -> void:
	if manager == null:
		return
	panel.visible = manager.debug
	if not panel.visible:
		return
	var p := manager.player
	var lines := PackedStringArray()
	lines.append("THE LAST BISCUIT  [debug]   fps %d" % Engine.get_frames_per_second())
	lines.append("phase %s   (t %.1fs)   state %s   attempt %d   play %.1fs" % [LBConst.phase_name(manager.phase), manager.phase_time, LBManager.GS.keys()[manager.gs], manager.attempt, manager.play_time])
	lines.append("hand speed %.2f m/s  pos (%.2f, %.2f)  progress %.2f  held %s  cover %s" % [p.speed(), p.plane_pos.x, p.plane_pos.y, LBConst.approach_progress(p.plane_pos), p.held.name if p.held else "-", "napkin" if p.cover else "-"])
	for d in manager.diners:
		var vis := d.gaze_visibility(p)
		var parts := PackedStringArray()
		for h in d.suspicion.values:
			if is_instance_valid(h):
				parts.append("%s %.2f" % ["BILL" if h.is_player else str(h.name).replace("Hand", ""), d.suspicion.values[h]])
		lines.append("%-18s %-7s sees Bill %.2f  sight %.1f  | %s" % [d.display_name, d.state, vis, d.gaze.sight, ", ".join(parts)])
	for r in manager.rivals:
		lines.append("rival %-12s %-10s goal %-14s watched %.2f %s" % [r.name, LBRivalHand.St.keys()[r.state], r.ai_note, r.watched, "FROZEN" if r.frozen else ""])
	lines.append("keys: F1 debug  1-4 phase  5 run back  9 home stretch  6 ending  7 comedy event  8 slow-mo  0 pause rivals  F5 restart")
	panel.text = "\n".join(lines)
