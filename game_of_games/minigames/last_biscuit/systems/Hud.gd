class_name LBHud
extends CanvasLayer
## Minimal UI: a fade-in, a brief hint, the dinner status in the corner (time
## until the guest arrives, how hungry Bill still is, breaches of etiquette),
## the debug panel and a small note at the very end. No victory screen.

var fade: ColorRect
var hint: Label
var item: Label
var replay: Label
var panel: Label
var status: Label
var hunger_lbl: Label
var _font: Font
var _pulse := 0.0
var manager: LBManager


func _ready() -> void:
	layer = 10
	manager = get_parent() as LBManager
	var sf := SystemFont.new()
	sf.font_names = PackedStringArray(["Georgia", "Garamond", "Times New Roman", "DejaVu Serif", "Liberation Serif", "serif"])
	sf.font_italic = true
	_font = sf
	var root := Control.new()
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_place(root, Vector4(0, 0, 1, 1), Vector4.ZERO)
	hint = _label(root, 17, Color(0.92, 0.86, 0.72))
	_place(hint, Vector4(0.5, 1.0, 0.5, 1.0), Vector4(-560, -92, 560, -24))
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.text = "Nobody may eat until the guest arrives. Everybody is starving.\nsteal food and bring it to your mouth  ·  never move inside someone's light  ·  chew when nobody is looking at you\nmouse: reach   ·   hold click: grab   ·   click beside another hand: slap   ·   right click: retract   ·   shift: creep"
	_place(hint, Vector4(0.5, 1.0, 0.5, 1.0), Vector4(-620, -112, 620, -20))
	status = _label(root, 20, Color(0.96, 0.9, 0.74))
	_place(status, Vector4(1, 0, 1, 0), Vector4(-460, 22, -28, 60))
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	status.modulate.a = 0.92
	hunger_lbl = _label(root, 26, Color(0.98, 0.82, 0.45))
	_place(hunger_lbl, Vector4(1, 0, 1, 0), Vector4(-460, 54, -28, 96))
	hunger_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hunger_lbl.modulate.a = 0.92
	item = _label(root, 22, Color(0.95, 0.88, 0.7))
	_place(item, Vector4(0, 0, 0, 0), Vector4(36, 30, 636, 110))
	replay = _label(root, 15, Color(0.85, 0.8, 0.7))
	_place(replay, Vector4(1, 1, 1, 1), Vector4(-340, -56, -30, -24))
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
	_place(fade, Vector4(0, 0, 1, 1), Vector4.ZERO)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade)


## anchors (l, t, r, b) and offsets (l, t, r, b)
func _place(c: Control, anchors: Vector4, offsets: Vector4) -> void:
	c.anchor_left = anchors.x
	c.anchor_top = anchors.y
	c.anchor_right = anchors.z
	c.anchor_bottom = anchors.w
	c.offset_left = offsets.x
	c.offset_top = offsets.y
	c.offset_right = offsets.z
	c.offset_bottom = offsets.w


func _label(parent: Control, size: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", _font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.modulate.a = 0.0
	parent.add_child(l)
	return l


func fade_in(t: float) -> void:
	fade.color.a = 1.0
	var tw := create_tween()
	tw.tween_property(fade, "color:a", 0.0, t).set_trans(Tween.TRANS_SINE)


func show_hint() -> void:
	var tw := create_tween()
	tw.tween_interval(1.5)
	tw.tween_property(hint, "modulate:a", 0.75, 1.2)
	tw.tween_interval(9.0)
	tw.tween_property(hint, "modulate:a", 0.0, 2.0)


func show_item(name_: String, seconds: float, _attempts: int, hunger := 0.0, goal := 1.0, eaten := 0, breaches := 0) -> void:
	var m := int(seconds) / 60
	var s := int(seconds) % 60
	var mood := "Bill is full." if hunger >= goal else "Bill is still hungry."
	item.text = "%s\n%s  %d mouthfuls  ·  %d:%02d  ·  %s" % [name_, mood, eaten, m, s,
			("impeccable manners" if breaches == 0 else "%d breaches of etiquette" % breaches)]
	var tw := create_tween()
	tw.tween_property(item, "modulate:a", 0.9, 2.0)


## Called every frame by the manager.
func set_status(hunger: float, goal: float, left: float, breaches: int) -> void:
	if status == null:
		return
	var m := int(ceil(left)) / 60
	var s := int(ceil(left)) % 60
	status.text = "the guest arrives in %d:%02d" % [m, s] + ("" if breaches == 0 else "   ·   breaches %d" % breaches)
	var full := int(clampf(hunger, 0.0, goal))
	var bar := ""
	for i in int(goal):
		bar += "●" if i < full else "○"
	hunger_lbl.text = "hunger  " + bar
	if left < 30.0:
		status.add_theme_color_override("font_color", Color(1.0, 0.55, 0.4))


func hide_status() -> void:
	var tw := create_tween()
	tw.tween_property(status, "modulate:a", 0.0, 0.8)
	tw.parallel().tween_property(hunger_lbl, "modulate:a", 0.0, 0.8)
	tw.parallel().tween_property(hint, "modulate:a", 0.0, 0.5)


func pulse_hunger() -> void:
	var tw := create_tween()
	tw.tween_property(hunger_lbl, "scale", Vector2(1.15, 1.15), 0.1)
	tw.tween_property(hunger_lbl, "scale", Vector2.ONE, 0.25)


func show_replay() -> void:
	var tw := create_tween()
	tw.tween_property(replay, "modulate:a", 0.6, 2.0)


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
	lines.append("hand speed %.2f m/s  pos (%.2f, %.2f)  held %s  cover %s  chewing %.1f  hunger %.0f/%.0f  food left %d" % [p.speed(), p.plane_pos.x, p.plane_pos.y, p.held.name if p.held else "-", "napkin" if p.cover else "-", p.chewing_t, manager.hunger, manager.hunger_goal, manager.foods().size()])
	for d in manager.diners:
		var vis := d.gaze_visibility(p)
		var parts := PackedStringArray()
		for h in d.suspicion.values:
			if is_instance_valid(h):
				parts.append("%s %.2f" % ["BILL" if h.is_player else str(h.name).replace("Hand", ""), d.suspicion.values[h]])
		lines.append("%-18s %-7s sees Bill %.2f  sight %.1f  | %s" % [d.display_name, d.state, vis, d.gaze.sight, ", ".join(parts)])
	for r in manager.rivals:
		lines.append("rival %-12s %-10s goal %-14s watched %.2f %s" % [r.name, LBRivalHand.St.keys()[r.state], r.ai_note, r.watched, "FROZEN" if r.frozen else ""])
	lines.append("keys: F1 debug  1-4 phase  5 the rush  9 food at mouth  6 ending  7 comedy event  8 slow-mo  0 pause rivals  F5 restart")
	panel.text = "\n".join(lines)
