class_name DarkVoidHUD
extends CanvasLayer
## Minimal gameplay overlay: the TOUCH prompt, an occasional line of text, and the fade.

@export var touch_text := "TOUCH"
@export var touch_font_size := 56
@export var touch_color := Color(0.86, 0.8, 0.72)
@export var prompt_fade_time := 0.8
@export var message_color := Color(0.75, 0.72, 0.68)

var _touch: Label
var _message: Label
var _fade: ColorRect
var _touch_tween: Tween
var _touch_visible := false


func _ready() -> void:
	layer = 10
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_touch = _label(touch_text, touch_font_size, touch_color)
	_touch.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_touch.offset_top = -220
	_touch.offset_bottom = -140
	_touch.offset_left = -300
	_touch.offset_right = 300
	_touch.modulate.a = 0.0
	root.add_child(_touch)

	_message = _label("", 24, message_color)
	_message.set_anchors_preset(Control.PRESET_CENTER)
	_message.offset_left = -400
	_message.offset_right = 400
	_message.offset_top = -30
	_message.offset_bottom = 30
	_message.modulate.a = 0.0
	root.add_child(_message)

	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_fade)
	# Message above the fade so it can be read on black.
	_message.move_to_front()


func _label(text: String, font_size: int, col: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", col)
	return l


func set_touch_visible(v: bool) -> void:
	if v == _touch_visible:
		return
	_touch_visible = v
	if _touch_tween:
		_touch_tween.kill()
	_touch_tween = create_tween()
	_touch_tween.tween_property(_touch, "modulate:a", 1.0 if v else 0.0, prompt_fade_time)


func is_touch_visible() -> bool:
	return _touch_visible


func show_message(text: String, hold := 3.0, fade := 1.5) -> void:
	_message.text = text
	var tw := create_tween()
	tw.tween_property(_message, "modulate:a", 1.0, fade)
	if hold >= 0.0:
		tw.tween_interval(hold)
		tw.tween_property(_message, "modulate:a", 0.0, fade)


## Fades the screen to black; await the returned signal.
func fade_out(duration: float) -> Signal:
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 1.0, duration).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	return tw.finished
