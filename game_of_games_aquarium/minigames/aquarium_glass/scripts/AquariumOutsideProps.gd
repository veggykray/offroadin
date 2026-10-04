extends Node2D

const AqDraw = preload("AqDraw.gd")
## Things OUTSIDE the glass that belong to the module:
##  * the "PLEASE DO NOT TAP THE GLASS" sign (child node "Sign") - it swings on
##    its screw when the glass is knocked, and never quite recovers from the finale
##  * the information plaque (child node "InfoPlaque") - click it to open the
##    info panel; it glows at hint level 3
##  * dust and debris falling outside the tank after big impacts
## Move the Sign / InfoPlaque nodes in the editor to place them. If the real
## scene has its own sign, set AquariumActivity.show_outside_props = false and
## call activity.info_panel.open() from your own plaque instead.

@export var sign_text := "PLEASE DO NOT\nTAP THE GLASS"
@export var plaque_size := Vector2(150, 96)

var activity: Node
var _sign: Node2D
var _plaque: Node2D
var _sign_ang := 0.0
var _sign_vel := 0.0
var _sign_rest := 0.0
var _attention := false
var _hover := false
var _t := 0.0
var _dust: Array = []
var _ping_t := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity
	z_index = 70
	_sign = get_node_or_null("Sign")
	_plaque = get_node_or_null("InfoPlaque")
	if _sign == null:
		_sign = Node2D.new(); _sign.name = "Sign"; add_child(_sign)
	if _plaque == null:
		_plaque = Node2D.new(); _plaque.name = "InfoPlaque"; add_child(_plaque)


func get_plaque() -> Node2D:
	return _plaque


func reset_props() -> void:
	_sign_ang = 0.0
	_sign_vel = 0.0
	_sign_rest = 0.0
	_attention = false
	_dust.clear()


func set_panel_attention(on: bool) -> void:
	_attention = on
	_ping_t = 0.0


func on_hard_knock() -> void:
	_sign_vel += randf_range(1.6, 2.6) * (1.0 if randf() > 0.5 else -1.0)
	_spawn_dust(8, false)


func on_giant_tap() -> void:
	_sign_vel += 9.0
	_sign_rest = 0.22   # it will hang crooked forever now
	_spawn_dust(140, true)


func _spawn_dust(n: int, chunks: bool) -> void:
	var b: Rect2 = activity.aquarium_bounds
	for i in n:
		_dust.append({
			"p": Vector2(randf_range(b.position.x - 40, b.end.x + 40), b.position.y - randf_range(20, 60)),
			"v": Vector2(randf_range(-30, 30), randf_range(0, 120)),
			"s": randf_range(1.5, 3.5) if (not chunks or randf() < 0.85) else randf_range(6, 14),
			"r": randf() * TAU, "life": randf_range(2.5, 5.0),
		})


func tick(delta: float) -> void:
	_t += delta
	_sign_vel += (-(_sign_ang - _sign_rest) * 30.0) * delta
	_sign_vel *= exp(-1.6 * delta)
	_sign_ang += _sign_vel * delta
	var floor_y: float = activity.aquarium_bounds.end.y + 220.0
	for i in range(_dust.size() - 1, -1, -1):
		var d = _dust[i]
		d.v.y += 220.0 * delta
		d.v.x += sin(_t * 3.0 + i) * 20.0 * delta
		d.p += d.v * delta
		d.r += delta * 2.0
		d.life -= delta
		if d.life <= 0.0 or d.p.y > floor_y:
			_dust.remove_at(i)
	if _attention:
		_ping_t -= delta
		if _ping_t <= 0.0:
			_ping_t = 6.0
			activity.audio.play("memory_shimmer", -16.0, 1.6)
	_hover = _plaque_rect().has_point(get_local_mouse_position())
	queue_redraw()


func _plaque_rect() -> Rect2:
	return Rect2(_plaque.position - plaque_size * 0.5, plaque_size)


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var p: Vector2 = make_input_local(event).position
		if _plaque_rect().has_point(p) and not activity.info_panel.is_open:
			activity.info_panel.open()
			get_viewport().set_input_as_handled()


func _draw() -> void:
	# --- The sign. Hangs from one screw. ---
	var sp := _sign.position
	var w := 300.0
	var h := 96.0
	var xf := Transform2D(_sign_ang, sp)
	draw_set_transform_matrix(xf)
	draw_rect(Rect2(-w * 0.5 + 6, 8, w, h), Color(0, 0, 0, 0.35))
	draw_rect(Rect2(-w * 0.5, 0, w, h), Color(0.92, 0.9, 0.84))
	draw_rect(Rect2(-w * 0.5 + 6, 6, w - 12, h - 12), Color(0.75, 0.15, 0.12), false, 4.0)
	var font := ThemeDB.fallback_font
	var lines := sign_text.split("\n")
	for i in lines.size():
		draw_string(font, Vector2(-w * 0.5, 40 + i * 32), lines[i], HORIZONTAL_ALIGNMENT_CENTER, w, 26, Color(0.7, 0.1, 0.08))
	draw_circle(Vector2(0, 0), 5.0, Color(0.5, 0.5, 0.5))
	draw_set_transform_matrix(Transform2D.IDENTITY)
	draw_circle(sp, 3.0, Color(0.3, 0.3, 0.3))

	# --- Info plaque. ---
	var r := _plaque_rect()
	var glow := 0.0
	if _attention:
		glow = 0.5 + 0.5 * sin(_t * 3.0)
		draw_rect(r.grow(10.0 + glow * 6.0), Color(0.9, 0.8, 0.4, 0.15 + glow * 0.2))
	draw_rect(r, Color(0.2, 0.17, 0.12))
	draw_rect(r.grow(-5), Color(0.62, 0.5, 0.28) if not _hover else Color(0.75, 0.62, 0.35))
	draw_rect(r.grow(-11), Color(0.1, 0.16, 0.16))
	draw_string(font, r.position + Vector2(0, 30), "SPECIES", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 18, Color(0.95, 0.85, 0.6))
	draw_string(font, r.position + Vector2(0, 52), "INFORMATION", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 15, Color(0.95, 0.85, 0.6))
	for i in 3:
		draw_line(r.position + Vector2(22, 64 + i * 8), r.position + Vector2(r.size.x - 22 - i * 14, 64 + i * 8), Color(0.6, 0.7, 0.68, 0.6), 2.0)

	# --- Dust and debris outside the glass. ---
	for d in _dust:
		var a: float = clampf(d.life, 0.0, 1.0)
		if d.s > 5.0:
			var dx := Transform2D(d.r, d.p)
			AqDraw.poly(self, PackedVector2Array([dx * Vector2(-d.s, -d.s * 0.6), dx * Vector2(d.s, -d.s * 0.3), dx * Vector2(d.s * 0.3, d.s * 0.7)]), Color(0.55, 0.52, 0.48, a))
		else:
			draw_circle(d.p, d.s, Color(0.75, 0.72, 0.65, 0.6 * a))
