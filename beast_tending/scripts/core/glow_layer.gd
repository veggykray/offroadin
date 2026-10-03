class_name GlowLayer
extends Node2D
## A child canvas item, by default drawn with additive blending. The owner supplies a
## `painter` Callable(layer: GlowLayer) that issues draw_* calls.

var painter: Callable


func _init(p: Callable = Callable(), z: int = 1, additive: bool = true) -> void:
	painter = p
	z_index = z
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD if additive else CanvasItemMaterial.BLEND_MODE_MIX
	material = m


func _draw() -> void:
	if painter.is_valid():
		painter.call(self)


## Soft radial blob.
func blob(pos: Vector2, radius: float, color: Color) -> void:
	if radius <= 0.5 or color.a <= 0.003:
		return
	draw_texture_rect(Game.soft_texture, Rect2(pos - Vector2(radius, radius), Vector2(radius, radius) * 2.0), false, color)


func ring(pos: Vector2, radius: float, color: Color) -> void:
	if radius <= 0.5 or color.a <= 0.003:
		return
	draw_texture_rect(Game.ring_texture, Rect2(pos - Vector2(radius, radius), Vector2(radius, radius) * 2.0), false, color)
