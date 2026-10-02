class_name ScareContext
extends RefCounted
## Snapshot of game state handed to scare events. Owned and refreshed by DarkVoid every frame.

var game: Node
var bill: Node3D
var hand_light: HandLight
var creature: DarkCreature
var elapsed := 0.0
var memories_collected := 0
var memories_total := 0
var light_on := false
## Seconds since the hand light was last emitting (0 while it's on).
var light_off_time := 0.0
## Seconds the light has been continuously on (0 while it's off).
var light_on_time := 0.0
var final_phase := false


## Direction from Bill's body to his hand (works with the placeholder or a hand bone).
func hand_direction() -> Vector3:
	if bill == null or hand_light == null:
		return Vector3.RIGHT
	var d := hand_light.global_position - bill.global_position
	d.z = 0.0
	return d.normalized() if d.length() > 0.01 else Vector3.RIGHT
