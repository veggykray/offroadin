extends Control
## The only text the hint system ever shows:
##  * a small, ignorable "Need a hint?" bubble next to the information plaque
##  * one short hint line, if accepted, that fades away by itself.

var activity: Node
var _offer: Button
var _text: Label
var _text_t := 0.0
var _offer_t := 0.0


func setup(p_activity: Node) -> void:
	activity = p_activity
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_offer = Button.new()
	_offer.text = "Need a hint?"
	_offer.add_theme_font_size_override("font_size", 22)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.95, 0.92, 0.82, 0.92)
	sb.set_corner_radius_all(18)
	sb.set_content_margin_all(12)
	_offer.add_theme_stylebox_override("normal", sb)
	var sbh := sb.duplicate()
	sbh.bg_color = Color(1, 1, 0.92, 1)
	_offer.add_theme_stylebox_override("hover", sbh)
	_offer.add_theme_stylebox_override("pressed", sbh)
	_offer.add_theme_color_override("font_color", Color(0.15, 0.2, 0.22))
	_offer.add_theme_color_override("font_hover_color", Color(0.1, 0.15, 0.17))
	_offer.visible = false
	_offer.pressed.connect(func(): activity.hints.accept_offer())
	add_child(_offer)
	_text = Label.new()
	_text.add_theme_font_size_override("font_size", 30)
	_text.add_theme_color_override("font_color", Color(1, 0.97, 0.88))
	_text.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_text.add_theme_constant_override("outline_size", 8)
	_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_text.visible = false
	add_child(_text)


func show_offer(v: bool) -> void:
	_offer.visible = v
	_offer_t = 0.0
	if v:
		_offer.modulate.a = 0.0


func show_text(t: String) -> void:
	_text.text = t
	_text.visible = true
	_text_t = 0.0


func _process(delta: float) -> void:
	if _offer.visible:
		_offer_t += delta
		_offer.modulate.a = minf(1.0, _offer_t * 1.5)
		# Sit next to the info plaque, wherever that is on screen.
		var plaque: Node2D = activity.outside.get_plaque()
		var p: Vector2 = plaque.get_global_transform_with_canvas().origin
		_offer.position = p + Vector2(-_offer.size.x * 0.5, -150.0 + sin(_offer_t * 2.0) * 4.0)
		if _offer_t > 14.0:
			activity.hints.decline_offer()
	if _text.visible:
		_text_t += delta
		var vp := get_viewport_rect().size
		_text.size = Vector2(vp.x, 50)
		_text.position = Vector2(0, vp.y * 0.86)
		_text.modulate.a = clampf(_text_t * 3.0, 0.0, 1.0) * clampf((7.0 - _text_t) / 1.0, 0.0, 1.0)
		if _text_t > 7.0:
			_text.visible = false
