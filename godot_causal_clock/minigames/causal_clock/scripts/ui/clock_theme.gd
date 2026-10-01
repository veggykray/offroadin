class_name CausalClockTheme
extends RefCounted
## Builds the mini-game's UI Theme in code (serif type, dark glass panels,
## thin brass rules) so it carries no dependency on the host project's theme.

const INK := Color(0.93, 0.87, 0.74)
const INK_DIM := Color(0.66, 0.6, 0.5)
const BRASS := Color(0.82, 0.66, 0.38)
const PANEL := Color(0.04, 0.035, 0.04, 0.78)

static var _theme: Theme


static func get_theme() -> Theme:
	if _theme != null:
		return _theme
	var t := Theme.new()
	t.default_font = CausalClockDraw.font()
	t.default_font_size = 20
	t.set_color("font_color", "Label", INK)
	t.set_color("default_color", "RichTextLabel", INK)

	var normal := _box(Color(0.07, 0.06, 0.06, 0.82), BRASS * Color(1, 1, 1, 0.45))
	var hover := _box(Color(0.14, 0.11, 0.08, 0.92), BRASS * Color(1, 1, 1, 0.9))
	var pressed := _box(Color(0.22, 0.16, 0.08, 0.95), BRASS)
	var disabled := _box(Color(0.05, 0.05, 0.05, 0.5), Color(0.4, 0.36, 0.3, 0.3))
	var focus := _box(Color(0, 0, 0, 0), BRASS * Color(1, 1, 1, 0.7))
	focus.draw_center = false
	for s in [["normal", normal], ["hover", hover], ["pressed", pressed], ["disabled", disabled], ["focus", focus]]:
		t.set_stylebox(s[0], "Button", s[1])
	t.set_color("font_color", "Button", INK)
	t.set_color("font_hover_color", "Button", Color(1, 0.95, 0.82))
	t.set_color("font_pressed_color", "Button", Color(1, 0.9, 0.6))
	t.set_color("font_disabled_color", "Button", INK_DIM * Color(1, 1, 1, 0.5))
	t.set_font_size("font_size", "Button", 19)

	var panel := _box(PANEL, BRASS * Color(1, 1, 1, 0.35))
	panel.content_margin_left = 22
	panel.content_margin_right = 22
	panel.content_margin_top = 18
	panel.content_margin_bottom = 18
	panel.shadow_color = Color(0, 0, 0, 0.5)
	panel.shadow_size = 18
	t.set_stylebox("panel", "PanelContainer", panel)
	t.set_stylebox("panel", "Panel", panel)
	_theme = t
	return t


static func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(1)
	s.set_corner_radius_all(3)
	s.content_margin_left = 16
	s.content_margin_right = 16
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


static func label(text: String, size: int = 20, color: Color = INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


static func small_caps(text: String, size: int = 14, color: Color = BRASS) -> Label:
	var l := label(" ".join(text.to_upper().split("")), size, color)
	return l
