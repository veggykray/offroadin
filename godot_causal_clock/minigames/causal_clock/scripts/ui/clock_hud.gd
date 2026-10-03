class_name CausalClockHUD
extends Control
## Minimal, elegant heads-up layer around the clock:
##   top left  – title and a one-line status / feedback,
##   right     – pins remaining, chain gauge, move count, Undo / Reset / Hint,
##   left      – the memory shelf (one medallion per milestone),
##   bottom    – the short introductory prompt, fading once the player starts,
##   toasts    – "a memory surfaces" notices that open the reveal card.

signal undo_pressed
signal reset_pressed
signal hint_pressed
signal notes_pressed
signal menu_pressed
signal memory_pressed(milestone_id: String)


## Row of locking-pin icons: filled = available, hollow = in use.
class PinTray extends Control:
	var total: int = 2
	var used: int = 0
	var flash: float = 0.0

	func _process(dt: float) -> void:
		if flash > 0.0:
			flash = maxf(0.0, flash - dt * 2.0)
			queue_redraw()

	func _draw() -> void:
		for i in total:
			var c := Vector2(18 + i * 34, size.y * 0.5)
			var free := i < total - used
			var col := Color(0.86, 0.3, 0.22) if free else Color(0.3, 0.25, 0.22)
			if flash > 0.0 and not free:
				col = col.lerp(Color(1, 0.3, 0.2), flash)
			draw_circle(c + Vector2(1.5, 2), 12, Color(0, 0, 0, 0.5))
			draw_circle(c, 12, Color(0.45, 0.33, 0.14) if free else Color(0.2, 0.18, 0.16))
			draw_circle(c, 10, Color(0.78, 0.6, 0.3) if free else Color(0.25, 0.22, 0.2))
			draw_circle(c, 6, col)
			if free:
				draw_circle(c - Vector2(3, 3), 2.2, Color(1, 1, 1, 0.6))


## A small sub-dial: needle shows how far the chain reaches (0..rings+1).
class ChainGauge extends Control:
	var steps: int = 6
	var value: float = 0.0
	var shown: float = 0.0
	var labels: PackedStringArray = PackedStringArray()

	func _process(dt: float) -> void:
		if absf(shown - value) > 0.001:
			shown = lerpf(shown, value, clampf(dt * 5.0, 0, 1))
			queue_redraw()

	func _draw() -> void:
		var c := Vector2(size.x * 0.5, size.y * 0.86)
		var r := minf(size.x * 0.46, size.y * 0.78)
		var brass := CausalClockPalette.material("brass")
		var face := func(rr: float) -> PackedVector2Array:
			var pts := PackedVector2Array([c + Vector2(rr, 6)])
			for k in 33:
				pts.append(c + Vector2.from_angle(-PI * float(k) / 32.0) * rr)
			pts.append(c + Vector2(-rr, 6))
			return pts
		draw_colored_polygon(face.call(r + 6), brass["dark"])
		draw_colored_polygon(face.call(r + 3), brass["base"])
		draw_colored_polygon(face.call(r), Color(0.9, 0.85, 0.72))
		var a0 := -PI * 0.92
		var a1 := -PI * 0.08
		draw_arc(c, r * 0.82, a0, a1, 32, Color(0.3, 0.22, 0.12), 1.5, true)
		for i in steps + 1:
			var a := lerpf(a0, a1, float(i) / steps)
			var d := Vector2.from_angle(a)
			var lit := i <= int(round(value))
			draw_line(c + d * r * 0.72, c + d * r * 0.9, Color(0.75, 0.35, 0.1) if lit else Color(0.3, 0.22, 0.12), 2.5, true)
			if i < labels.size():
				CausalClockDraw.text(self, c + d * r * 0.58, labels[i], 13, Color(0.3, 0.22, 0.12))
		var na := lerpf(a0, a1, shown / maxf(1.0, steps))
		var nd := Vector2.from_angle(na)
		draw_line(c + Vector2(1, 2), c + nd * r * 0.85 + Vector2(1, 2), Color(0, 0, 0, 0.35), 3.0, true)
		draw_line(c - nd * r * 0.15, c + nd * r * 0.85, Color(0.12, 0.08, 0.06), 2.5, true)
		draw_circle(c, 4.5, brass["base"])
		draw_circle(c, 2.0, brass["dark"])


## A memory medallion on the shelf.
class Medallion extends Button:
	var unlocked: bool = false
	var numeral: String = "I"
	var icon_tex: Texture2D
	var pulse: float = 0.0
	var _t: float = 0.0

	func _process(dt: float) -> void:
		_t += dt
		if pulse > 0.0:
			pulse = maxf(0.0, pulse - dt * 0.5)
		queue_redraw()

	func _draw() -> void:
		var c := size * 0.5
		var r := minf(size.x, size.y) * 0.42
		var gold := CausalClockPalette.material("gold")
		var en := CausalClockPalette.material("enamel")
		if unlocked:
			CausalClockDraw.glow(self, c, r * 2.2, Color(1, 0.7, 0.3, 0.12 + 0.25 * pulse + 0.04 * sin(_t * 2.0)))
		draw_circle(c + Vector2(2, 3), r + 3, Color(0, 0, 0, 0.5))
		draw_circle(c, r + 3, gold["dark"])
		draw_circle(c, r + 1, gold["base"] if unlocked else Color(0.2, 0.18, 0.16))
		draw_circle(c, r - 3, en["base"] if unlocked else Color(0.08, 0.08, 0.09))
		if unlocked and icon_tex:
			draw_texture_rect(icon_tex, Rect2(c - Vector2(r, r) * 0.62, Vector2(r, r) * 1.24), false)
		else:
			CausalClockDraw.text(self, c, numeral if unlocked else "?", int(r * 0.7), gold["light"] if unlocked else Color(0.35, 0.32, 0.3))
		if is_hovered() and unlocked:
			draw_arc(c, r + 5, 0, TAU, 32, Color(1, 0.9, 0.65, 0.8), 1.5, true)


## Aged parchment sheets in the margins with a sketch and a handwritten line.
class MarginNote extends Control:
	var text: String = ""
	var kind: int = 0
	var tilt: float = 0.0

	func _draw() -> void:
		var s := size
		draw_set_transform(s * 0.5, tilt, Vector2.ONE)
		var r := Rect2(-s * 0.5, s)
		draw_rect(Rect2(r.position + Vector2(6, 8), r.size), Color(0, 0, 0, 0.45))
		var paper := Color(0.72, 0.62, 0.45)
		draw_rect(r, paper)
		for k in 6:
			draw_rect(r.grow(-k * 5.0), Color(0.45, 0.33, 0.18, 0.05), false, 5.0)
		var rng := RandomNumberGenerator.new()
		rng.seed = 3 + kind
		for i in 40:
			draw_circle(r.position + Vector2(rng.randf() * s.x, rng.randf() * s.y), rng.randf_range(1, 5), Color(0.4, 0.28, 0.14, 0.08))
		var ink := Color(0.25, 0.17, 0.08, 0.8)
		var c := Vector2(0, -s.y * 0.2)
		if kind == 0:
			# A tower-and-compass study.
			draw_arc(c, s.x * 0.22, 0, TAU, 40, ink, 1.0, true)
			for k in 8:
				var d := Vector2.from_angle(TAU * k / 8.0)
				draw_line(c, c + d * s.x * (0.22 if k % 2 == 0 else 0.13), ink, 1.0, true)
			var t := PackedVector2Array([c + Vector2(-8, 30), c + Vector2(-5, -28), c + Vector2(5, -28), c + Vector2(8, 30)])
			draw_polyline(t, ink, 1.2, true)
			draw_line(c + Vector2(-11, -28), c + Vector2(11, -28), ink, 1.2, true)
		else:
			# A moon-phase diagram.
			draw_circle(c, s.x * 0.16, Color(0.45, 0.35, 0.2, 0.5))
			draw_arc(c, s.x * 0.16, 0, TAU, 40, ink, 1.2, true)
			for k in 5:
				var p := c + Vector2.from_angle(PI + k * PI / 4.0) * s.x * 0.33
				draw_arc(p, 6, 0, TAU, 16, ink, 1.0, true)
				draw_circle(p + Vector2(2, 0), 5, Color(0.25, 0.17, 0.08, 0.4 + 0.1 * k))
			draw_line(c + Vector2(-s.x * 0.4, s.y * 0.06), c + Vector2(s.x * 0.4, -s.y * 0.1), ink, 0.8, true)
		var f := CausalClockTheme.italic_font()
		var words := text.split(" ")
		var line := ""
		var y := s.y * 0.2
		for w in words:
			var trial := (line + " " + w).strip_edges()
			if f.get_string_size(trial, HORIZONTAL_ALIGNMENT_LEFT, -1, 19).x > s.x - 30 and line != "":
				draw_string(f, Vector2(-s.x * 0.5 + 15, y), line, HORIZONTAL_ALIGNMENT_LEFT, -1, 19, ink)
				y += 24
				line = w
			else:
				line = trial
		if line != "":
			draw_string(f, Vector2(-s.x * 0.5 + 15, y), line, HORIZONTAL_ALIGNMENT_LEFT, -1, 19, ink)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


var layout: CausalClockLayout
var memories: CausalClockMemoryLibrary
var title_label: Label
var status_label: Label
var moves_label: Label
var pin_tray: PinTray
var gauge: ChainGauge
var intro_box: VBoxContainer
var shelf: VBoxContainer
var toast_panel: PanelContainer
var hint_button: Button
var undo_button: Button
var reset_button: Button
var _medallions: Dictionary = {}  # milestone id -> Medallion
var _status_tween: Tween
var _toast_tween: Tween
var _toast_milestone: String = ""
var _intro_faded: bool = false


func build(p_layout: CausalClockLayout, p_memories: CausalClockMemoryLibrary) -> void:
	layout = p_layout
	memories = p_memories
	theme = CausalClockTheme.get_theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for ch in get_children():
		ch.queue_free()
	_build_notes()
	_build_title()
	_build_tab()
	_build_right()
	_build_shelf()
	_build_intro()
	_build_toast()


func _build_title() -> void:
	var box := VBoxContainer.new()
	box.position = Vector2(48, 36)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(box)
	title_label = CausalClockTheme.label(layout.title, 38, CausalClockTheme.INK)
	box.add_child(title_label)
	if layout.subtitle != "":
		box.add_child(CausalClockTheme.label(layout.subtitle, 18, CausalClockTheme.INK_DIM))
	status_label = CausalClockTheme.label("", 19, CausalClockTheme.BRASS)
	status_label.custom_minimum_size = Vector2(420, 0)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.modulate.a = 0.0
	box.add_child(status_label)


func _build_right() -> void:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(252, 0)
	add_child(panel)
	_place(panel, Vector2(1, 0), Vector2(-48, 92), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_END)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	panel.add_child(v)
	v.add_child(CausalClockTheme.small_caps("Pins"))
	pin_tray = PinTray.new()
	pin_tray.total = layout.pin_count
	pin_tray.custom_minimum_size = Vector2(maxi(1, layout.pin_count) * 34 + 8, 30)
	v.add_child(pin_tray)
	v.add_child(HSeparator.new())
	v.add_child(CausalClockTheme.small_caps("Chain"))
	gauge = ChainGauge.new()
	gauge.steps = layout.ring_count + 1
	for i in layout.ring_count + 1:
		gauge.labels.append("" if i == 0 else (layout.elements[i - 1].id))
	gauge.labels.append(layout.elements[layout.hub_index()].id)
	gauge.custom_minimum_size = Vector2(212, 120)
	v.add_child(gauge)
	moves_label = CausalClockTheme.label("Moves  0", 18, CausalClockTheme.INK_DIM)
	v.add_child(moves_label)
	v.add_child(HSeparator.new())
	undo_button = _button(v, "Undo", "Z", undo_pressed)
	reset_button = _button(v, "Reset", "R", reset_pressed)
	hint_button = _button(v, "Hint", "H", hint_pressed)
	_button(v, "Mechanism notes", "N", notes_pressed)
	_button(v, "Pause", "Esc", menu_pressed)


func _build_notes() -> void:
	var specs := [[Vector2(0, 1), Vector2(14, -360), -0.06, 0], [Vector2(1, 1), Vector2(-262, -380), 0.05, 1]]
	for i in specs.size():
		var note := MarginNote.new()
		note.kind = specs[i][3]
		note.tilt = specs[i][2]
		note.text = layout.margin_notes[i] if i < layout.margin_notes.size() else ""
		note.custom_minimum_size = Vector2(240, 270)
		note.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(note)
		_place(note, specs[i][0], specs[i][1], Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_END)


## The "Pause · P" tab at the top right, as on the reference layout.
func _build_tab() -> void:
	var b := Button.new()
	b.text = "Pause  ·  P"
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 22)
	b.pressed.connect(func(): menu_pressed.emit())
	add_child(b)
	_place(b, Vector2(1, 0), Vector2(-48, 20), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_END)


func _button(parent: Control, text: String, key: String, sig: Signal) -> Button:
	var b := Button.new()
	b.text = "%s   ·  %s" % [text, key]
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func(): sig.emit())
	parent.add_child(b)
	return b


func _build_shelf() -> void:
	shelf = VBoxContainer.new()
	shelf.add_theme_constant_override("separation", 18)
	add_child(shelf)
	_place(shelf, Vector2(0, 0.5), Vector2(56, 0), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_BOTH)
	if layout.milestones.is_empty():
		return
	shelf.add_child(CausalClockTheme.small_caps("Memories"))
	for m in layout.milestones:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		var md := Medallion.new()
		md.custom_minimum_size = Vector2(64, 64)
		md.flat = true
		md.focus_mode = Control.FOCUS_NONE
		md.numeral = CausalClockDraw.roman(m.index + 1)
		md.disabled = true
		var mem := memories.get_memory(m.memory_id)
		md.icon_tex = mem.load_icon()
		md.tooltip_text = ""
		md.pressed.connect(func(): memory_pressed.emit(m.id))
		row.add_child(md)
		var lbl := CausalClockTheme.label("· · ·", 17, CausalClockTheme.INK_DIM)
		lbl.name = "Label"
		lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		row.add_child(lbl)
		shelf.add_child(row)
		_medallions[m.id] = md


func _build_intro() -> void:
	intro_box = VBoxContainer.new()
	intro_box.custom_minimum_size = Vector2(900, 0)
	intro_box.alignment = BoxContainer.ALIGNMENT_END
	intro_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(intro_box)
	_place(intro_box, Vector2(0.5, 1), Vector2(0, -34), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BEGIN)
	var lines := layout.intro_lines
	if lines.is_empty():
		lines = PackedStringArray(["Rotate rings", "Use pins to lock rings", "Connect the chain to the center"])
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 28)
	intro_box.add_child(row)
	for i in lines.size():
		var l := CausalClockTheme.label(lines[i], 19, CausalClockTheme.INK)
		l.modulate.a = 0.0
		row.add_child(l)
		var tw := create_tween()
		tw.tween_interval(0.8 + i * 0.9)
		tw.tween_property(l, "modulate:a", 0.92, 1.2)
		if i < lines.size() - 1:
			var dot := CausalClockTheme.label("◆", 10, CausalClockTheme.BRASS)
			dot.modulate.a = 0.0
			row.add_child(dot)
			var tw2 := create_tween()
			tw2.tween_interval(1.3 + i * 0.9)
			tw2.tween_property(dot, "modulate:a", 0.7, 1.0)


func _build_toast() -> void:
	toast_panel = PanelContainer.new()
	toast_panel.custom_minimum_size = Vector2(380, 0)
	toast_panel.modulate.a = 0.0
	toast_panel.visible = false
	add_child(toast_panel)
	_place(toast_panel, Vector2(1, 1), Vector2(-48, -90), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_BEGIN)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	toast_panel.add_child(h)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(v)
	var head := CausalClockTheme.small_caps("A memory surfaces", 12)
	head.name = "Head"
	v.add_child(head)
	var name_l := CausalClockTheme.label("", 24)
	name_l.name = "Name"
	v.add_child(name_l)
	var date_l := CausalClockTheme.label("", 16, CausalClockTheme.INK_DIM)
	date_l.name = "Date"
	v.add_child(date_l)
	var b := Button.new()
	b.text = "View"
	b.focus_mode = Control.FOCUS_NONE
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.pressed.connect(func():
		hide_toast()
		memory_pressed.emit(_toast_milestone))
	h.add_child(b)


## Pin a control to an anchor point and let it grow in the given directions.
static func _place(c: Control, anchor: Vector2, offset: Vector2, grow_h: int, grow_v: int) -> void:
	c.anchor_left = anchor.x
	c.anchor_right = anchor.x
	c.anchor_top = anchor.y
	c.anchor_bottom = anchor.y
	c.offset_left = offset.x
	c.offset_right = offset.x
	c.offset_top = offset.y
	c.offset_bottom = offset.y
	c.grow_horizontal = grow_h
	c.grow_vertical = grow_v


# ---------------------------------------------------------------------------

func set_status(text: String, warn: bool = false, hold: float = 3.5) -> void:
	status_label.text = text
	status_label.add_theme_color_override("font_color", CausalClockPalette.WARN.lightened(0.25) if warn else CausalClockTheme.BRASS)
	if _status_tween:
		_status_tween.kill()
		_status_tween = null
	status_label.modulate.a = 1.0
	if hold > 0.0:
		_status_tween = create_tween()
		_status_tween.tween_interval(hold)
		_status_tween.tween_property(status_label, "modulate:a", 0.0, 1.2)


func update_state(puzzle: CausalClockPuzzle) -> void:
	pin_tray.used = puzzle.state.pins_used()
	pin_tray.queue_redraw()
	gauge.value = float(puzzle.layout.ring_count + 1 if puzzle.trace.solved else puzzle.trace.depth)
	moves_label.text = "Moves  %d" % puzzle.move_count
	undo_button.disabled = not puzzle.can_undo()
	reset_button.disabled = puzzle.is_solved
	hint_button.disabled = puzzle.is_solved


func flash_pins() -> void:
	pin_tray.flash = 1.0


func fade_intro() -> void:
	if _intro_faded:
		return
	_intro_faded = true
	var tw := create_tween()
	tw.tween_property(intro_box, "modulate:a", 0.28, 2.5)


func unlock_memory(milestone_id: String) -> void:
	var md: Medallion = _medallions.get(milestone_id)
	if md == null:
		return
	md.unlocked = true
	md.disabled = false
	md.pulse = 1.0
	var m := _milestone(milestone_id)
	var mem := memories.get_memory(m.memory_id)
	var lbl := md.get_parent().get_node("Label") as Label
	lbl.text = mem.label
	lbl.add_theme_color_override("font_color", CausalClockTheme.INK)
	md.tooltip_text = "%s — %s" % [mem.label, mem.date_text]


func _milestone(id: String) -> CausalClockLayout.MilestoneDef:
	for m in layout.milestones:
		if m.id == id:
			return m
	return null


func show_toast(milestone_id: String) -> void:
	var m := _milestone(milestone_id)
	if m == null:
		return
	var mem := memories.get_memory(m.memory_id)
	_toast_milestone = milestone_id
	(toast_panel.find_child("Name", true, false) as Label).text = mem.label
	(toast_panel.find_child("Date", true, false) as Label).text = mem.date_text
	toast_panel.visible = true
	if _toast_tween:
		_toast_tween.kill()
	_toast_tween = create_tween()
	_toast_tween.tween_property(toast_panel, "modulate:a", 1.0, 0.6)
	_toast_tween.tween_interval(7.0)
	_toast_tween.tween_property(toast_panel, "modulate:a", 0.0, 1.0)
	_toast_tween.tween_callback(func(): toast_panel.visible = false)


func hide_toast() -> void:
	if _toast_tween:
		_toast_tween.kill()
	toast_panel.visible = false
	toast_panel.modulate.a = 0.0
