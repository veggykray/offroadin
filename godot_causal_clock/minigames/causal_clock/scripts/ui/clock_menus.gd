class_name CausalClockMenus
extends Control
## Pause menu, mechanism notes (the learnable ruleset in plain words) and
## the completion panel. One small node so the game scene stays tidy.

signal resume_pressed
signal restart_pressed
signal exit_pressed
signal play_again_pressed

const NOTES := [
	["Turning", "Drag a ring, scroll over it, or select it and use ← →. Each turn moves it one notch."],
	["Gears", "A gear between two rings carries motion across. The little badge on its mount shows whether the next ring turns the same way or the opposite way. Motion spreads through every connected gear."],
	["Ratchets", "Copper gears with a pawl and an arrow drive one way only: the ring the arrow points to follows, but cannot push back."],
	["Toothed arcs", "Some rings have teeth on only part of their edge. Their gear bites only while teeth sit under it — the lamp beside the gear is lit when it will."],
	["Pins", "Right-click a ring (or click its socket on the rail) to pin it. A pinned ring never moves; gears trying to drive it slip, and motion stops there."],
	["Locks", "The heart has one open lock and several sealed ones. Not every chain that looks right leads home: a chain that ends in a sealed lock took a wrong turn somewhere."],
	["The heart", "The heart cannot be turned by hand. Find what drives it."],
	["Reading ahead", "Hover a ring to see what would move if you turned it clockwise: blue = clockwise, amber = anticlockwise."],
]

var _dim: ColorRect
var _pause: PanelContainer
var _notes: PanelContainer
var _done: PanelContainer
var _done_text: Label


func _ready() -> void:
	theme = CausalClockTheme.get_theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	_dim = ColorRect.new()
	_dim.color = Color(0, 0, 0, 0.55)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_pause = _panel(center, "Paused", [
		["Resume", func(): resume_pressed.emit()],
		["Mechanism notes", show_notes],
		["Restart puzzle", func(): restart_pressed.emit()],
		["Leave the clock", func(): exit_pressed.emit()],
	])
	_notes = PanelContainer.new()
	_notes.custom_minimum_size = Vector2(760, 0)
	center.add_child(_notes)
	var nv := VBoxContainer.new()
	nv.add_theme_constant_override("separation", 10)
	_notes.add_child(nv)
	nv.add_child(CausalClockTheme.label("How the mechanism behaves", 32))
	for n in NOTES:
		var row := VBoxContainer.new()
		row.add_child(CausalClockTheme.small_caps(n[0], 13))
		var l := CausalClockTheme.label(n[1], 18, CausalClockTheme.INK)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(700, 0)
		row.add_child(l)
		nv.add_child(row)
	var close_b := Button.new()
	close_b.text = "Back"
	close_b.size_flags_horizontal = Control.SIZE_SHRINK_END
	close_b.pressed.connect(func(): resume_pressed.emit())
	nv.add_child(close_b)
	_done = _panel(center, "The chain is whole", [
		["Play again", func(): play_again_pressed.emit()],
		["Leave the clock", func(): exit_pressed.emit()],
	])
	_done_text = CausalClockTheme.label("", 19, CausalClockTheme.INK_DIM)
	_done.get_child(0).add_child(_done_text)
	_done.get_child(0).move_child(_done_text, 1)
	_hide_all()


func _panel(parent: Control, title: String, buttons: Array) -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(420, 0)
	parent.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	p.add_child(v)
	var t := CausalClockTheme.label(title, 34)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	for b in buttons:
		var btn := Button.new()
		btn.text = b[0]
		btn.pressed.connect(b[1])
		v.add_child(btn)
	return p


func _hide_all() -> void:
	_pause.visible = false
	_notes.visible = false
	_done.visible = false


func _show(p: Control) -> void:
	_hide_all()
	p.visible = true
	visible = true
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.25)
	for c in p.get_child(0).get_children():
		if c is Button:
			(c as Button).grab_focus.call_deferred()
			break


func show_pause() -> void:
	_show(_pause)


func show_notes() -> void:
	_show(_notes)


func show_done(moves: int, best: int, hints: int) -> void:
	var s := "Solved in %d moves" % moves
	if best > 0:
		s += "  ·  the clockmaker's count is %d" % best
	if hints > 0:
		s += "  ·  %d hint%s" % [hints, "" if hints == 1 else "s"]
	_done_text.text = s
	_show(_done)


func hide_menus() -> void:
	visible = false
	_hide_all()


func is_open() -> bool:
	return visible
