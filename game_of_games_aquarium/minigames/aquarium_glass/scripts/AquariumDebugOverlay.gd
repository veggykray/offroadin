extends Node2D
## Debug view (toggle with F1 by default; see AquariumActivity.debug_toggle_key).
## Draws gesture positions/radii, creature targets & states, the Idiot's goal
## and trap probes, and prints the hidden values. Hotkeys (only while debug is on):
##   1 tap  2 double tap  3 rub  4 scratch  5 hard knock   (at the mouse)
##   N advance stage   R reset puzzle   H next hint   O open shell
##   C start chase   I capture Idiot   = / - glass damage   U summon deep creature
##   F trigger finale   T toggle 3x speed

const Stim = preload("GlassStimulus.gd")

var activity: Node
var enabled := false
var _label: Label
var _layer: CanvasLayer
var _stims: Array = []   # {p, r, kind, life}
var _fast := false


func setup(p_activity: Node) -> void:
	activity = p_activity
	z_index = 200
	_layer = CanvasLayer.new()
	_layer.layer = 50
	add_child(_layer)
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0.6)
	sb.set_content_margin_all(10)
	panel.add_theme_stylebox_override("panel", sb)
	panel.position = Vector2(10, 10)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_layer.add_child(panel)
	_label = Label.new()
	_label.add_theme_font_size_override("font_size", 15)
	_label.add_theme_color_override("font_color", Color(0.8, 1.0, 0.85))
	panel.add_child(_label)
	set_enabled(activity.debug_mode)


func set_enabled(on: bool) -> void:
	enabled = on
	visible = on
	_layer.visible = on


func on_stimulus(s) -> void:
	_stims.append({"p": s.position, "r": s.radius, "kind": s.kind, "life": 1.0, "natural": s.natural})
	if _stims.size() > 30:
		_stims.pop_front()


func _process(delta: float) -> void:
	for i in range(_stims.size() - 1, -1, -1):
		_stims[i].life -= delta
		if _stims[i].life <= 0.0:
			_stims.remove_at(i)
	if not enabled:
		return
	var a = activity
	var rec = a.recognizer
	var hints = a.hints
	var lines: PackedStringArray = []
	lines.append("AQUARIUM DEBUG  (F1 to hide)")
	lines.append("stage: %s   stage time %.1f   activity time %.1f" % [a.get_stage_name(), a.stage_time, a.activity_time])
	lines.append("gesture: %s   last: %s @ (%d, %d)" % [Stim.kind_name(rec.current_gesture), Stim.kind_name(rec.last_gesture), rec.last_gesture_pos.x, rec.last_gesture_pos.y])
	lines.append("hint level %d   since progress %.1f s   diagnosis: %s   hints used %d" % [hints.hint_level, hints.time_since_progress, hints.diagnosis, hints.hints_used])
	lines.append("  last hint: %s   knows: blimp %s  bastards %s  coward %s  coward-dir %s" % [hints.last_hint_desc, hints.knows("blimp"), hints.knows("bastards"), hints.knows("coward"), hints.knows("coward_direction")])
	lines.append(a.deep.get_debug_text())
	lines.append("glass damage %.2f   hard knocks %d" % [a.glass_damage.damage, a.stat_hard_knocks])
	lines.append("shell: exposed %.2f  restraint %.0f  crack hp %.0f  open %s" % [a.shell.exposed_amount(), a.shell.restraint_hp, a.shell.crack_hp, a.shell.is_open])
	lines.append("memory: %s" % a.memory.mem_state)
	for c in a.creatures:
		lines.append(c.get_debug_text())
	lines.append(a.bastards.get_debug_text())
	lines.append("")
	lines.append("1 tap  2 dbl  3 rub  4 scratch  5 knock | N next stage  R reset  H hint  O open shell")
	lines.append("C chase  I capture idiot  =/- damage  U summon deep  F finale  T speed x3 (%s)" % ("on" if _fast else "off"))
	_label.text = "\n".join(lines)
	queue_redraw()


func _unhandled_key_input(event: InputEvent) -> void:
	if not enabled:
		return
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	var cmd := ""
	match k.keycode:
		KEY_1: cmd = "tap"
		KEY_2: cmd = "double_tap"
		KEY_3: cmd = "rub"
		KEY_4: cmd = "scratch"
		KEY_5: cmd = "knock"
		KEY_N: cmd = "advance_stage"
		KEY_R: cmd = "reset_stage"
		KEY_H: cmd = "next_hint"
		KEY_O: cmd = "open_shell"
		KEY_C: cmd = "start_chase"
		KEY_I: cmd = "capture_idiot"
		KEY_EQUAL, KEY_PLUS, KEY_KP_ADD: cmd = "damage_up"
		KEY_MINUS, KEY_KP_SUBTRACT: cmd = "damage_down"
		KEY_U: cmd = "summon_deep"
		KEY_F: cmd = "finale"
		KEY_T:
			_fast = not _fast
			Engine.time_scale = 3.0 if _fast else 1.0
			get_viewport().set_input_as_handled()
			return
	if cmd != "":
		activity.debug_command(cmd, activity.to_local(activity.get_global_mouse_position()))
		get_viewport().set_input_as_handled()


func _draw() -> void:
	var a = activity
	draw_rect(a.aquarium_bounds, Color(0.2, 0.9, 1.0, 0.6), false, 2.0)
	draw_rect(a.glass_rect, Color(1, 1, 1, 0.3), false, 1.0)
	var fy: float = a.get_floor_y()
	draw_line(Vector2(a.aquarium_bounds.position.x, fy), Vector2(a.aquarium_bounds.end.x, fy), Color(1, 0.8, 0.3, 0.5), 1.0)
	var cover: Rect2 = a.get_shell_cover_rect()
	draw_rect(cover, Color(0.3, 0.8, 1.0, 0.6), false, 2.0)
	for o in a.obstacles:
		draw_arc(o.pos, o.r, 0, TAU, 24, Color(1, 0.6, 0.2, 0.6), 1.5)
	for hs in a.hide_spots:
		draw_circle(hs, 6.0, Color(0.6, 0.4, 1.0, 0.8))
	var font := ThemeDB.fallback_font
	# Gestures.
	var cols := {Stim.Kind.SINGLE_TAP: Color(0.4, 1, 0.4), Stim.Kind.DOUBLE_TAP: Color(0.4, 0.8, 1), Stim.Kind.RUB: Color(1, 0.6, 1), Stim.Kind.SCRATCH: Color(1, 0.4, 0.3), Stim.Kind.HARD_KNOCK: Color(1, 1, 0.3)}
	for s in _stims:
		var c: Color = cols.get(s.kind, Color.WHITE)
		c.a = s.life
		draw_arc(s.p, s.r, 0, TAU, 40, c, 2.0)
		draw_string(font, s.p + Vector2(8, -8), Stim.kind_name(s.kind) + (" (natural)" if s.natural else ""), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, c)
	# Creatures.
	for cr in a.creatures:
		draw_arc(cr.position, cr.body_radius, 0, TAU, 24, Color(1, 1, 1, 0.5), 1.0)
		if cr.target_pos != null:
			draw_line(cr.position, cr.target_pos, Color(1, 1, 0.4, 0.6), 1.5)
			draw_circle(cr.target_pos, 4.0, Color(1, 1, 0.4))
		draw_string(font, cr.position + Vector2(-30, -cr.body_radius - 10), cr.state, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1, 1, 1))
	var sw = a.bastards
	if sw.swarm_target != null:
		draw_line(sw.swarm_center(), sw.swarm_target, Color(1, 0.3, 0.3, 0.7), 2.0)
	if sw.bite_target != null:
		draw_circle(sw.bite_target.bite_point(), 8.0, Color(1, 0.2, 0.2, 0.8))
	# Idiot chase info.
	var idiot = a.idiot
	if idiot.is_chasing():
		draw_line(idiot.position, idiot.chase_goal, Color(1, 0.8, 0.2, 0.9), 2.0)
		draw_circle(idiot.chase_goal, 7.0, Color(1, 0.8, 0.2))
		for i in idiot._probe_hits.size():
			var d := Vector2.from_angle(TAU * i / 12.0)
			var col := Color(1, 0.2, 0.2, 0.7) if idiot._probe_hits[i] else Color(0.3, 1, 0.3, 0.4)
			draw_line(idiot.position, idiot.position + d * idiot.trap_probe_length, col, 1.5)
		draw_rect(Rect2(idiot.position + Vector2(-30, -60), Vector2(60 * clampf(idiot.pressure, 0, 1), 6)), Color(1, 0.3, 0.2))
		draw_rect(Rect2(idiot.position + Vector2(-30, -60), Vector2(60, 6)), Color(1, 1, 1, 0.6), false, 1.0)
	# Chute.
	draw_arc(a.chute.position, a.chute.capture_radius, 0, TAU, 24, Color(0.4, 1, 0.6, 0.6), 1.5)
	draw_arc(a.chute.position, a.chute.suction_radius, 0, TAU, 32, Color(0.4, 1, 0.6, 0.25), 1.0)
