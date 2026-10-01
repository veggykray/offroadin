class_name CausalClockMemoryReveal
extends Control
## Modal "memory card" that presents one memory: date, label, an icon, a
## video clip (or a placeholder frame when the clip is missing) and text.
##
## Content comes entirely from CausalClockMemoryLibrary.Memory, so replacing
## the memories JSON changes what appears here with no code changes.
## Video: any VideoStream Godot can load (.ogv Theora is supported natively).

signal closed(memory_id: String)

## Film-frame stand-in shown when a memory has no playable clip.
class PlaceholderFrame extends Control:
	var caption: String = ""
	var path_text: String = ""
	var _t: float = 0.0
	var _rng := RandomNumberGenerator.new()

	func _process(dt: float) -> void:
		_t += dt
		queue_redraw()

	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		draw_rect(r, Color(0.06, 0.05, 0.04))
		var inner := r.grow(-18)
		var flicker := 0.85 + 0.15 * sin(_t * 23.0) * sin(_t * 7.0)
		draw_rect(inner, Color(0.32, 0.26, 0.18) * flicker)
		# Vignette bands and film grain.
		for k in 8:
			draw_rect(inner.grow(-k * 6), Color(0, 0, 0, 0.06), false, 6.0)
		_rng.seed = int(_t * 24.0)
		for i in 120:
			var p := inner.position + Vector2(_rng.randf() * inner.size.x, _rng.randf() * inner.size.y)
			draw_rect(Rect2(p, Vector2(1.5, 1.5)), Color(1, 0.95, 0.85, _rng.randf() * 0.25))
		if _rng.randf() < 0.3:
			var x := inner.position.x + _rng.randf() * inner.size.x
			draw_line(Vector2(x, inner.position.y), Vector2(x, inner.end.y), Color(1, 1, 1, 0.08), 1.0)
		# Sprocket holes.
		for y in range(int(r.position.y) + 8, int(r.end.y) - 8, 22):
			draw_rect(Rect2(Vector2(5, y), Vector2(8, 12)), Color(0.0, 0.0, 0.0))
			draw_rect(Rect2(Vector2(r.end.x - 13, y), Vector2(8, 12)), Color(0.0, 0.0, 0.0))
		var f := CausalClockDraw.font()
		var c := inner.get_center()
		_centered(f, c + Vector2(0, -14), caption, 26, Color(0.95, 0.88, 0.72, 0.9))
		_centered(f, c + Vector2(0, 18), "clip placeholder", 15, Color(0.95, 0.88, 0.72, 0.55))
		if path_text != "":
			_centered(f, c + Vector2(0, 42), path_text, 12, Color(0.95, 0.88, 0.72, 0.4))

	func _centered(f: Font, at: Vector2, s: String, sz: int, col: Color) -> void:
		var w := f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, sz).x
		draw_string(f, at - Vector2(w * 0.5, 0), s, HORIZONTAL_ALIGNMENT_LEFT, -1, sz, col)


var _memory_id: String = ""
var _dim: ColorRect
var _card: PanelContainer
var _date: Label
var _title: Label
var _icon: TextureRect
var _media: Control
var _video: VideoStreamPlayer
var _placeholder: PlaceholderFrame
var _desc: RichTextLabel
var _button: Button


func _ready() -> void:
	theme = CausalClockTheme.get_theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	_dim = ColorRect.new()
	_dim.color = Color(0, 0, 0, 0.62)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_card = PanelContainer.new()
	_card.custom_minimum_size = Vector2(760, 0)
	center.add_child(_card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	_card.add_child(v)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 16)
	v.add_child(head)
	_icon = TextureRect.new()
	_icon.custom_minimum_size = Vector2(64, 64)
	_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	head.add_child(_icon)
	var titles := VBoxContainer.new()
	titles.alignment = BoxContainer.ALIGNMENT_CENTER
	head.add_child(titles)
	_date = CausalClockTheme.small_caps("", 13)
	titles.add_child(_date)
	_title = CausalClockTheme.label("", 36)
	titles.add_child(_title)
	_media = Control.new()
	_media.custom_minimum_size = Vector2(716, 403)
	v.add_child(_media)
	_video = VideoStreamPlayer.new()
	_video.set_anchors_preset(Control.PRESET_FULL_RECT)
	_video.expand = true
	_media.add_child(_video)
	_placeholder = PlaceholderFrame.new()
	_placeholder.set_anchors_preset(Control.PRESET_FULL_RECT)
	_media.add_child(_placeholder)
	_desc = RichTextLabel.new()
	_desc.fit_content = true
	_desc.bbcode_enabled = true
	_desc.custom_minimum_size = Vector2(716, 0)
	_desc.add_theme_font_size_override("normal_font_size", 20)
	v.add_child(_desc)
	_button = Button.new()
	_button.text = "Continue"
	_button.size_flags_horizontal = Control.SIZE_SHRINK_END
	_button.pressed.connect(close)
	v.add_child(_button)


func is_open() -> bool:
	return visible


func open(memory: CausalClockMemoryLibrary.Memory) -> void:
	_memory_id = memory.id
	_date.text = " ".join(memory.date_text.to_upper().split("")) if memory.date_text != "" else ""
	_title.text = memory.label
	_desc.text = memory.description_text
	var tex := memory.load_icon()
	_icon.texture = tex if tex else _fallback_icon()
	var stream := memory.load_video()
	if stream:
		_video.stream = stream
		_video.visible = true
		_placeholder.visible = false
		_video.play()
	else:
		_video.stop()
		_video.stream = null
		_video.visible = false
		_placeholder.visible = true
		_placeholder.caption = memory.label
		_placeholder.path_text = memory.video_path if memory.video_path != "" else "(no video_path set)"
	visible = true
	modulate.a = 0.0
	_card.scale = Vector2(0.96, 0.96)
	_card.pivot_offset = _card.size * 0.5
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 1.0, 0.45)
	tw.parallel().tween_property(_card, "scale", Vector2.ONE, 0.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_button.grab_focus.call_deferred()


func close() -> void:
	if not visible:
		return
	_video.stop()
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.3)
	tw.tween_callback(func():
		visible = false
		closed.emit(_memory_id))


func _unhandled_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo:
		if event.keycode in [KEY_ESCAPE, KEY_ENTER, KEY_SPACE, KEY_KP_ENTER]:
			close()
			get_viewport().set_input_as_handled()


static var _fallback: Texture2D


## Procedural medallion used when a memory has no icon.
static func _fallback_icon() -> Texture2D:
	if _fallback:
		return _fallback
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	for y in 64:
		for x in 64:
			var d := Vector2(x - 31.5, y - 31.5).length()
			var c := Color(0, 0, 0, 0)
			if d < 30:
				c = Color(0.78, 0.58, 0.2)
			if d < 26:
				c = Color(0.09, 0.27, 0.33)
			if d < 8:
				c = Color(1.0, 0.85, 0.48)
			if absf(d - 17) < 1.0:
				c = Color(0.86, 0.72, 0.42)
			img.set_pixel(x, y, c)
	_fallback = ImageTexture.create_from_image(img)
	return _fallback
