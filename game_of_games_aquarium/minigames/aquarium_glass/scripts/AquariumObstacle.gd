@tool
extends Node2D
## A solid circle the creatures, shell and memory bump into (rocks, the arch...).
## Place these under AquariumActivity/Layout/Obstacles and drag them in the
## editor. The placeholder environment draws a rock on each one; in the real
## scene you can hide the placeholder art and line these up with your own rocks.

## Collision radius in pixels.
@export var radius := 50.0:
	set(v):
		radius = v
		queue_redraw()
## If true the placeholder art draws a rock here. Turn off for invisible walls.
@export var draw_placeholder_rock := true
## Rocks the Idiot likes to hide behind (it will tuck in next to them).
@export var idiot_hide_spot := false


func _draw() -> void:
	if Engine.is_editor_hint():
		draw_circle(Vector2.ZERO, radius, Color(1, 0.5, 0.1, 0.18))
		draw_arc(Vector2.ZERO, radius, 0, TAU, 32, Color(1, 0.6, 0.2, 0.9), 2.0)
