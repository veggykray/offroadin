class_name CloseEncounterScare
extends ScareEvent
## While everything is dark, the creature silently relocates so a part of it (default: the
## eye) sits right inside where the hand light will reach. No animation, no sting: the shock
## is turning the light back on and finding it there.

@export_group("Conditions")
@export var min_memories := 1
@export var min_elapsed_time := 45.0
## The light must have been off at least this long.
@export var min_dark_time := 4.0
@export var allow_in_final_phase := false

@export_group("Staging")
## Creature anchor placed in front of the hand.
@export var anchor_name := "EyeAnchor"
## Where along the hand's aim to put it, as a fraction of the light's range.
@export_range(0.0, 1.0) var range_fraction := 0.4
## Depth offset relative to Bill's plane (negative = just behind him).
@export var depth_offset := -0.25
## The creature stays put this long (or until lit) instead of relocating away.
@export var hold_time := 40.0
## Very quiet exhale when it's discovered. Null + play_discovery_sound = generated placeholder.
@export var play_discovery_sound := true
@export var discovery_sound: AudioStream


func can_trigger(ctx: ScareContext) -> bool:
	if ctx.creature == null or ctx.hand_light == null:
		return false
	if ctx.final_phase and not allow_in_final_phase:
		return false
	return ctx.memories_collected >= min_memories \
			and ctx.elapsed >= min_elapsed_time \
			and not ctx.light_on \
			and ctx.light_off_time >= min_dark_time \
			and ctx.creature.can_be_staged()


func can_force(ctx: ScareContext) -> bool:
	return ctx.creature != null and ctx.hand_light != null and ctx.creature.can_be_staged()


func trigger(ctx: ScareContext) -> bool:
	var light := ctx.hand_light
	var point := light.global_position + ctx.hand_direction() * light.light_range * range_fraction
	point.z = ctx.bill.global_position.z + depth_offset
	var snd: AudioStream = null
	if play_discovery_sound:
		snd = discovery_sound if discovery_sound else PlaceholderAudio.get_sound(&"exhale")
	return ctx.creature.stage_anchor_at(anchor_name, point, hold_time, snd)
