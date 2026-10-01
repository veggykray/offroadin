extends Node2D
## A drawing layer whose contents are produced by another script.
## Lets one controller draw at several depths / blend modes without a script per layer.

var draw_callback: Callable


func _draw() -> void:
	if draw_callback.is_valid():
		draw_callback.call(self)
