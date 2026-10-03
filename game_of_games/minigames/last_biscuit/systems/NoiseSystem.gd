class_name LBNoiseSystem
extends Node
## Every sound in the room is also information. Collisions, slaps and
## distractions are emitted here; diners listen (spatially) and turn towards
## them. The audio bank plays the matching sound at the location.

signal noise(pos: Vector2, loudness: float, source: LBHand, kind: String)

## Global loudness multiplier applied to everything diners hear.
@export var hearing_scale := 1.0
## Below this loudness nothing is broadcast to listeners (purely cosmetic sound).
@export var broadcast_threshold := 0.05

var audio: LBAudio
var recent: Array = []            # debug: [pos, loudness, age]


func emit_noise(pos: Vector2, loudness: float, source: LBHand = null, kind := "clink", play_sound := true) -> void:
	if play_sound and audio:
		audio.play_noise(kind, LBConst.p2w(pos, LBConst.TABLE_Y + 0.05), loudness)
	if loudness * hearing_scale < broadcast_threshold:
		return
	recent.append([pos, loudness, 0.0])
	noise.emit(pos, loudness * hearing_scale, source, kind)


func _process(dt: float) -> void:
	for r in recent:
		r[2] += dt
	while recent.size() > 0 and recent[0][2] > 1.2:
		recent.pop_front()


## Radius at which a noise of this loudness is still noticed by a normal ear.
static func audible_radius(loudness: float) -> float:
	return 0.6 + loudness * 4.2
