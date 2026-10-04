extends Control
## Temporary Shroom Mart styled UI: order sign, hints, prompts, results.
## Deliberately simple and drawn with code. Turn off with the activity's
## `show_hud` if the real game wants to draw its own UI (use the
## order_progress_changed / phase_changed signals for that).

var activity: Node

var _hint := ""
var _hint_t := 0.0
var _big := ""
var _big_color := Color.WHITE
var _big_t := 99.0
var _flash := Color(0, 0, 0, 0)
var _prompt_ready := false
var _prompt_docked := false
var _sign_wobble := 0.0
var _results := {}
var _t := 0.0

const RED := Color(0.82, 0.16, 0.16)
const CREAM := Color(1, 0.95, 0.85)
const INK := Color(0.2, 0.1, 0.08)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func reset() -> void:
	_results = {}
	_hint = ""
	_big_t = 99.0
	_prompt_ready = false


func set_hint(text: String) -> void:
	_hint = text
	_hint_t = 0.0


func big_message(text: String, color: Color) -> void:
	_big = text
	_big_color = color
	_big_t = 0.0


func flash(color: Color) -> void:
	_flash = color


func wobble_sign() -> void:
	_sign_wobble = 1.0


func set_prompt(is_ready: bool, docked: bool) -> void:
	_prompt_ready = is_ready
	_prompt_docked = docked


func show_results(result: Dictionary) -> void:
	_results = result
	big_message("ORDER COMPLETE!", Color(0.5, 1, 0.5))


func _process(delta: float) -> void:
	_t += delta
	_hint_t += delta
	_big_t += delta
	_flash.a = maxf(0.0, _flash.a - delta * 0.8)
	_sign_wobble = maxf(0.0, _sign_wobble - delta * 1.5)
	queue_redraw()


func _draw() -> void:
	if activity == null:
		return
	var font := ThemeDB.fallback_font
	var vp := get_viewport_rect().size
	if _flash.a > 0.0:
		draw_rect(Rect2(Vector2.ZERO, vp), _flash)

	_draw_order_sign(font)

	# hint banner
	if _hint != "" and _hint_t < 5.0:
		var a := clampf(_hint_t * 4.0, 0.0, 1.0) * clampf((5.0 - _hint_t) * 2.0, 0.0, 1.0)
		var w := font.get_string_size(_hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x + 40.0
		var r := Rect2(Vector2((vp.x - w) * 0.5, 18), Vector2(w, 40))
		draw_rect(r, Color(INK, 0.75 * a))
		draw_rect(r, Color(CREAM, a), false, 2.0)
		draw_string(font, r.position + Vector2(20, 28), _hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(CREAM, a))

	# big pop message
	if _big_t < 1.6:
		var s := 1.0 + maxf(0.0, 0.4 - _big_t) * 1.5
		var a2 := clampf((1.6 - _big_t) * 3.0, 0.0, 1.0)
		var size := int(54 * s)
		var tw := font.get_string_size(_big, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		var pos := Vector2((vp.x - tw) * 0.5, vp.y * 0.36)
		draw_string_outline(font, pos, _big, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 10, Color(INK, a2))
		draw_string(font, pos, _big, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(_big_color, a2))

	# checkout prompt
	if _prompt_ready and _results.is_empty():
		var txt := "S / DOWN : TIP IT IN!" if _prompt_docked else "DRIVE TO THE CHECKOUT  >>>"
		var col := Color(0.5, 1, 0.5) if _prompt_docked else Color(1, 0.9, 0.4)
		var pulse := 0.75 + 0.25 * sin(_t * 8.0)
		var w2 := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 26).x
		var p2 := Vector2((vp.x - w2) * 0.5, vp.y - 62)
		draw_string_outline(font, p2, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, 8, Color(INK, pulse))
		draw_string(font, p2, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color(col, pulse))

	if not _results.is_empty():
		_draw_results(font, vp)

	if activity.debug_overlay_visible:
		var txt2: String = activity.debug_text()
		var lines := txt2.split("\n")
		draw_rect(Rect2(Vector2(8, vp.y - 18 * lines.size() - 16), Vector2(560, 18 * lines.size() + 10)), Color(0, 0, 0, 0.6))
		for i in lines.size():
			draw_string(font, Vector2(14, vp.y - 18 * (lines.size() - i) - 4), lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.7, 1, 0.7))


func _draw_order_sign(font: Font) -> void:
	var o: Node = activity.order
	var need: int = activity.required_good
	var delivered: int = o.delivered.good
	var held: int = o.held_good + activity.dump_in_flight_good()
	var rot := sin(_t * 20.0) * 0.06 * _sign_wobble
	draw_set_transform(Vector2(20, 14), rot, Vector2.ONE)
	var w := 300.0
	draw_rect(Rect2(0, 0, w, 116), CREAM)
	draw_rect(Rect2(0, 0, w, 30), RED)
	draw_rect(Rect2(0, 0, w, 116), RED, false, 3.0)
	draw_string(font, Vector2(10, 22), "SHROOM MART  -  ORDER", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, CREAM)
	draw_string(font, Vector2(10, 52), "%d GOOD SHROOMS" % need, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, INK)
	var got := mini(need, delivered + held)
	draw_string(font, Vector2(w - 70, 52), "%d/%d" % [got, need], HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(0.1, 0.5, 0.15) if got >= need else INK)
	for i in need:
		var c := Vector2(20 + i * 27.0, 74)
		if i < delivered:
			_mini_shroom(c, Color(0.3, 0.75, 0.3), true)
		elif i < delivered + held:
			_mini_shroom(c, Color(0.86, 0.24, 0.18), true)
		else:
			_mini_shroom(c, Color(0.75, 0.7, 0.62), false)
	var gold: bool = int(o.delivered.golden) > 0 or (activity.cargo.get_counts().get("golden", 0) > 0)
	draw_string(font, Vector2(10, 106), "BONUS: 1 GOLDEN", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.6, 0.45, 0.0))
	_mini_shroom(Vector2(150, 100), Color(1, 0.8, 0.15) if gold else Color(0.75, 0.7, 0.62), gold)
	var tt: float = activity.round_time
	draw_string(font, Vector2(w - 70, 106), "%d:%02d" % [int(tt) / 60, int(tt) % 60], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, INK)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _mini_shroom(c: Vector2, col: Color, filled: bool) -> void:
	if filled:
		draw_rect(Rect2(c + Vector2(-3, 0), Vector2(6, 8)), CREAM)
		draw_circle(c, 9.0, col)
		draw_rect(Rect2(c + Vector2(-10, 0), Vector2(20, 8)), CREAM)
		draw_rect(Rect2(c + Vector2(-3, 0), Vector2(6, 9)), Color(0.95, 0.88, 0.75))
	else:
		draw_arc(c, 9.0, PI, TAU, 10, col, 2.0)
		draw_line(c + Vector2(-9, 0), c + Vector2(9, 0), col, 2.0)


func _draw_results(font: Font, vp: Vector2) -> void:
	var r := _results
	var box := Rect2(Vector2(vp.x * 0.5 - 230, vp.y * 0.44), Vector2(460, 250))
	draw_rect(box, Color(CREAM, 0.96))
	draw_rect(box, RED, false, 4.0)
	draw_rect(Rect2(box.position, Vector2(box.size.x, 40)), RED)
	draw_string(font, box.position + Vector2(16, 28), "RECEIPT  -  SHROOM MART", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, CREAM)
	var lines := [
		"Good shrooms ......... %d" % r.good_delivered,
		"Golden ............... %d %s" % [r.golden_delivered, "(BONUS!)" if r.bonus_achieved else ""],
		"Rotten (yuck) ........ %d" % r.rotten_delivered,
		"Spills ............... %d (%d shrooms)" % [r.spills, r.mushrooms_spilled],
		"Biggest load ......... %d" % r.largest_load,
		"Time ................. %.1fs" % r.completion_time,
		"SCORE ................ %d" % r.score,
	]
	for i in lines.size():
		draw_string(font, box.position + Vector2(18, 66 + i * 24), lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 17, INK)
	draw_string(font, box.position + Vector2(340, 150), r.grade, HORIZONTAL_ALIGNMENT_LEFT, -1, 90, RED)
