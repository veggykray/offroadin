class_name SoundCueEvent
extends ScareEvent
## Plays a positional sound somewhere around Bill once conditions are met
## (e.g. a heavy impact right behind him after the first memory).

@export_group("Conditions")
@export var min_memories := 1
@export var min_elapsed_time := 30.0
@export var require_light_off := false
## Seconds to wait after the conditions first become true.
@export var delay := 6.0

@export_group("Sound")
## Empty = placeholder by id.
@export var sound: AudioStream
@export var placeholder_id := &"impact"
@export var distance := 14.0
## Opposite the hand (behind where Bill is looking) instead of a random direction.
@export var behind_player := true
@export var volume_db := 2.0

var _armed_time := 0.0


func tick(delta: float, ctx: ScareContext) -> void:
	super.tick(delta, ctx)
	if _conditions(ctx):
		_armed_time += delta
	else:
		_armed_time = 0.0


func _conditions(ctx: ScareContext) -> bool:
	return ctx.bill != null and ctx.memories_collected >= min_memories \
			and ctx.elapsed >= min_elapsed_time and not (require_light_off and ctx.light_on)


func can_trigger(ctx: ScareContext) -> bool:
	return _conditions(ctx) and _armed_time >= delay


func can_force(ctx: ScareContext) -> bool:
	return ctx.bill != null


func trigger(ctx: ScareContext) -> bool:
	var stream := sound if sound else PlaceholderAudio.get_sound(placeholder_id)
	if stream == null:
		return false
	var dir := -ctx.hand_direction() if behind_player else Vector3.RIGHT.rotated(Vector3.BACK, randf() * TAU)
	var p := AudioStreamPlayer3D.new()
	p.stream = stream
	p.volume_db = volume_db
	p.unit_size = 8.0
	p.max_distance = 120.0
	p.top_level = true
	add_child(p)
	p.global_position = ctx.bill.global_position + dir * distance
	p.finished.connect(p.queue_free)
	p.play()
	return true
