class_name HumanZooVignette
extends Control
## Soft dark edges so the gallery feels lamp-lit.


func _draw() -> void:
	var s := size
	var steps := 10
	for i in steps:
		var t := float(i) / steps
		var a := 0.055 * (1.0 - t)
		var inset := t * minf(s.x, s.y) * 0.22
		draw_rect(Rect2(0, 0, s.x, inset + 12), Color(0, 0, 0, a))
		draw_rect(Rect2(0, s.y - inset - 12, s.x, inset + 12), Color(0, 0, 0, a))
		draw_rect(Rect2(0, 0, inset * 1.4 + 12, s.y), Color(0, 0, 0, a))
		draw_rect(Rect2(s.x - inset * 1.4 - 12, 0, inset * 1.4 + 12, s.y), Color(0, 0, 0, a))


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		queue_redraw()
