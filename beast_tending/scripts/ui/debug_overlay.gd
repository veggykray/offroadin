class_name DebugOverlay
extends Control
## Debug mode only (F1 or `): recognised gesture, region under the hand, the
## creature's judgement, hidden satisfaction / pleasure / irritation, stage and
## progress, plus a colour-coded pointer trail.
##   F2 skip stage   F3 force hint   F4 restart

const TYPE_COLORS := [Color.GRAY, Color.WHITE, Color.CORNFLOWER_BLUE, Color.LIME_GREEN, Color.ORANGE, Color.RED, Color.MAGENTA]

var label: Label
var panel: Panel
var trail: Array = []  # {p, type, t}
var last_gesture: Gesture
var last_region := ""
var last_level := -1
var t := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	panel = Panel.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.position = Vector2(16, 16)
	panel.size = Vector2(560, 400)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0.6)
	sb.set_corner_radius_all(6)
	panel.add_theme_stylebox_override("panel", sb)
	add_child(panel)
	label = Label.new()
	label.position = Vector2(30, 26)
	label.add_theme_font_size_override("font_size", 17)
	label.add_theme_color_override("font_color", Color(0.85, 1.0, 0.85))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(label)
	visible = Game.debug
	Game.debug_toggled.connect(func(on): visible = on)


func record(g: Gesture, region_id: String, level: int) -> void:
	last_gesture = g
	last_region = region_id
	last_level = level


func _process(delta: float) -> void:
	t += delta
	if not visible:
		return
	var gr: GestureRecognizer = Game.gestures
	if gr and gr.pressed:
		trail.append({"p": gr.pointer_pos, "type": gr.current_type, "t": t})
	trail = trail.filter(func(e): return t - e.t < 1.5)
	var mind: BeastMind = Game.mind
	var seq: TendingSequence = Game.sequence
	var lines: Array[String] = []
	lines.append("DEBUG  (F1 hide · F2 skip stage · F3 hint · F4 restart)")
	if gr:
		var a: Dictionary = gr.last_analysis
		lines.append("gesture: %s%s" % [Gesture.type_name(gr.current_type), "  [pressed]" if gr.pressed else ""])
		if not a.is_empty():
			lines.append("  speed %d px/s  rev/s %.1f  turn %.1f  extent %d" % [a.speed, a.rev_rate, a.turn_rate, a.extent])
	if last_gesture:
		lines.append("last: %s on '%s' -> %s" % [Gesture.type_name(last_gesture.type), last_region, Game.LEVEL_NAMES[last_level] if last_level >= 0 else "-"])
		lines.append("  %s" % str(last_gesture))
	if mind:
		lines.append("satisfaction %.2f   pleasure %.2f   irritation %.2f" % [mind.satisfaction, mind.pleasure, mind.irritation])
		lines.append("escalation %.2f   mood: %s" % [mind.escalation, BeastMind.MOOD_NAMES[mind.mood]])
	if seq:
		lines.append("stage: %s   progress %.2f   idle %.0fs" % [TendingSequence.STAGE_NAMES[seq.stage], seq.progress, seq.idle_time])
		var target := seq.current_target()
		lines.append("wants: %s" % (target.region_id if target else "-"))
		if seq.stage == TendingSequence.Stage.COMBINATION:
			lines.append("  combo step %d / %d (%.2f)" % [seq.combo_index + 1, seq.combo_cycles * 3, seq.combo_progress])
		if seq.stage == TendingSequence.Stage.FINISH:
			var want := lerpf(seq.finish_speed_start, seq.finish_speed_end, seq.progress)
			lines.append("  wants speed ~%d px/s  state %d" % [want, seq.finish_state])
		lines.append("crevice pokes: %d" % seq.herring_count)
		lines.append(seq.last_judgement)
	var hand_world := Game.screen_to_world(get_viewport().get_mouse_position())
	var under := "-"
	for r in Game.regions.values():
		if r.contains(hand_world):
			var z: StringName = r.zone_at(hand_world)
			under = str(r.region_id) + (":" + str(z) if z != &"" else "")
			break
	lines.append("under hand: %s   world x %d" % [under, hand_world.x])
	label.text = "\n".join(lines)
	panel.size = Vector2(600, 30 + lines.size() * 24)
	queue_redraw()


func _draw() -> void:
	for i in range(1, trail.size()):
		var a: Dictionary = trail[i - 1]
		var b: Dictionary = trail[i]
		var c: Color = TYPE_COLORS[b.type]
		c.a = 1.0 - (t - b.t) / 1.5
		draw_line(a.p, b.p, c, 3.0, true)
	# Region outlines.
	for r in Game.regions.values():
		if not r.accessible:
			continue
		var pts := PackedVector2Array()
		for k in range(33):
			var ang := TAU * k / 32.0
			pts.append(Game.world_to_screen(r.to_global(r.hit_offset + Vector2(cos(ang), sin(ang)) * r.hit_radii)))
		draw_polyline(pts, Color(1, 1, 0, 0.35), 1.5, true)
