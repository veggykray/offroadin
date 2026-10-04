extends Node2D
## Converts real input (mouse / touch / an optional "hard knock" action) into
## calls on the GlassGestureRecognizer, but only inside the glass rectangle.
##
## It uses _unhandled_input, so any UI (pause menu, info panel...) that handles
## the click first automatically blocks the glass. Coordinates are converted
## with make_input_local(), so it works under any Camera2D / canvas transform
## and inside a SubViewport (see AquariumViewport3DBridge.gd for 3D games).

## Set by AquariumActivity. Rectangle in activity-local coordinates.
var glass_rect := Rect2(0, 0, 1920, 1080)
var recognizer: Node
## When false the glass ignores the player completely.
var enabled := false

## Right mouse button = hard knock.
@export var right_click_is_hard_knock := true
## Shift + left click = hard knock (handy on laptops / trackpads).
@export var shift_click_is_hard_knock := true
## Optional InputMap action name for hard knock (knocks where the pointer is).
## Leave empty or undefined to ignore.
@export var hard_knock_action := "aquarium_hard_knock"

var pointer_inside := false
var pointer_pos := Vector2.ZERO
var _left_down := false


func _unhandled_input(event: InputEvent) -> void:
	if recognizer == null:
		return
	if not enabled:
		if _left_down:
			_left_down = false
			recognizer.cancel()
		return

	if event is InputEventMouseButton or event is InputEventMouseMotion:
		var local_event := make_input_local(event)
		var p: Vector2 = local_event.position
		var inside := glass_rect.has_point(p)
		pointer_pos = p
		pointer_inside = inside

		if event is InputEventMouseButton:
			var mb := event as InputEventMouseButton
			if mb.button_index == MOUSE_BUTTON_LEFT:
				if mb.pressed and inside:
					if shift_click_is_hard_knock and mb.shift_pressed:
						recognizer.knock(p)
					else:
						_left_down = true
						recognizer.press(p)
					get_viewport().set_input_as_handled()
				elif not mb.pressed and _left_down:
					_left_down = false
					recognizer.release(_clamp(p))
					get_viewport().set_input_as_handled()
			elif mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed and inside and right_click_is_hard_knock:
				recognizer.knock(p)
				get_viewport().set_input_as_handled()
		else:
			recognizer.move(_clamp(p))
		return

	if hard_knock_action != "" and InputMap.has_action(hard_knock_action) \
			and event.is_action_pressed(hard_knock_action) and pointer_inside:
		recognizer.knock(pointer_pos)
		get_viewport().set_input_as_handled()


func _clamp(p: Vector2) -> Vector2:
	return Vector2(clampf(p.x, glass_rect.position.x, glass_rect.end.x),
		clampf(p.y, glass_rect.position.y, glass_rect.end.y))
