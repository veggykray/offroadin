class_name BodyRegion
extends Node2D
## One physical place on the beast. Holds the region's preferences (what kind
## of touch it enjoys) and the local physical state that its visuals read:
## relaxation, tension, excitement, hint attention.
##
## Subclasses draw themselves and override _on_reaction / _on_pointer.
## Replace a region's art by overriding _draw (or adding sprites as children);
## the gameplay contract is evaluate(), contains(), react().

signal reacted(level: int, local_pos: Vector2)

@export var region_id: StringName = &"region"
@export var display_name := "Region"

@export_group("Preferences")
@export var preferred_gesture: Gesture.Type = Gesture.Type.STROKE
## A second gesture it also likes, a little less.
@export var secondary_gesture: Gesture.Type = Gesture.Type.NONE
## Preferred pointer speed in screen px/s (0 = don't care).
@export var preferred_speed := 300.0
## Log-space tolerance on speed: 0.7 means roughly half to double is fine.
@export var speed_tolerance := 0.7
## Preferred 0..1 pressure approximation (-1 = don't care).
@export var preferred_intensity := -1.0
@export var intensity_tolerance := 0.4
## Preferred direction (either way along this axis). Zero = any direction.
@export var preferred_direction := Vector2.ZERO
@export_range(0.0, 1.0) var direction_tolerance := 0.5
## Preferred tap interval in seconds for rhythmic tapping (0 = n/a).
@export var preferred_rhythm := 0.0
@export var rhythm_tolerance := 0.3
## Gestures that annoy this region.
@export var disliked_gestures: Array[Gesture.Type] = []
## Multiplies irritation caused here.
@export var sensitivity := 1.0
## Irritation (0..1+) at which this region makes the beast shift away.
@export var irritation_threshold := 1.0
## Multiplies pleasure given by good contact here.
@export var pleasure_contribution := 1.0

@export_group("Look")
## Overlay leathery hide texture (shaders/hide_detail.gdshader) on this region's drawing.
@export var hide_texture := false
@export var hide_detail_scale := 0.025

@export_group("Shape")
## Hit area: ellipse radii around the node origin (local space).
@export var hit_radii := Vector2(300, 200)
@export var hit_offset := Vector2.ZERO

var accessible := true
var relax := 0.0       ## 0..1 settles in when touched well
var tension := 0.0     ## 0..1 spikes when touched badly
var excitement := 0.0  ## 0..1 short-term thrill
var attention := 0.0   ## 0..1 hint wiggle requested by the beast
var hover := 0.0       ## 0..1 pointer proximity
var level_smoothed := 0.0
var last_level: int = Game.Level.NEUTRAL
var t := 0.0
var pointer_local := Vector2(99999, 99999)
var pointer_pressed := false
var glow: GlowLayer
## True while near enough to the camera to be seen; off-screen regions skip
## redrawing and their heavier simulation.
var onscreen := true


func _ready() -> void:
	Game.register_region(self)
	t = randf() * 100.0
	glow = GlowLayer.new(_draw_glow, 2)
	add_child(glow)
	if hide_texture:
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/hide_detail.gdshader")
		m.set_shader_parameter("detail_scale", hide_detail_scale)
		material = m
	_setup()


func _setup() -> void:
	pass


func _process(delta: float) -> void:
	t += delta
	relax = Game.damp(relax, 0.0, 0.05, delta)
	tension = Game.damp(tension, 0.0, 1.6, delta)
	excitement = Game.damp(excitement, 0.0, 0.8, delta)
	attention = Game.damp(attention, 0.0, 0.7, delta)
	var near := 1.0 - clampf(_ellipse_dist(pointer_local) - 0.6, 0.0, 1.0)
	hover = Game.damp(hover, near, 6.0, delta)
	onscreen = absf(global_position.x - Game.camera_x()) < Game.SCREEN.x * 0.5 + hit_radii.x + 500.0
	_update(delta)
	if onscreen:
		queue_redraw()
		glow.queue_redraw()


func _update(_delta: float) -> void:
	pass


func _draw_glow(_layer: GlowLayer) -> void:
	pass


# --- Gameplay contract --------------------------------------------------------

func contains(world_pos: Vector2) -> bool:
	if not accessible:
		return false
	return _ellipse_dist(to_local(world_pos)) <= 1.0


## Named sub-area under a world position ("" if none). Override for zones.
func zone_at(_world_pos: Vector2) -> StringName:
	return &""


## How much the region itself likes this contact: -1 disliked, else 0..1.
func evaluate(g: Gesture) -> float:
	if disliked_gestures.has(g.type):
		return -1.0
	return score_against(g, preferred_gesture, preferred_speed, speed_tolerance,
		preferred_intensity, intensity_tolerance, preferred_direction,
		direction_tolerance, preferred_rhythm, rhythm_tolerance, secondary_gesture)


## Generic scoring of a gesture against any wanted profile, with tolerance.
func score_against(g: Gesture, wanted: int, speed: float = 0.0, speed_tol: float = 0.7,
		intensity: float = -1.0, int_tol: float = 0.4, dir: Vector2 = Vector2.ZERO,
		dir_tol: float = 0.5, rhythm: float = 0.0, rhythm_tol: float = 0.3,
		secondary: int = Gesture.Type.NONE) -> float:
	var gm := Gesture.affinity(g.type, wanted)
	if secondary != Gesture.Type.NONE and g.type == secondary:
		gm = maxf(gm, 0.65)
	if gm <= 0.0:
		return 0.0
	var parts: Array[float] = []
	if speed > 0.0 and g.is_continuous() and g.type != Gesture.Type.HOLD:
		parts.append(log_gauss(g.speed, speed, speed_tol))
	if intensity >= 0.0:
		var d := g.intensity - intensity
		parts.append(exp(-(d * d) / (2.0 * int_tol * int_tol)))
	if dir != Vector2.ZERO and g.direction != Vector2.ZERO:
		var align := absf(g.direction.dot(dir.normalized()))
		parts.append(smoothstep(1.0 - dir_tol - 0.25, 1.0 - dir_tol * 0.5, align))
	if rhythm > 0.0 and g.type == Gesture.Type.RHYTHM:
		parts.append(log_gauss(g.interval, rhythm, rhythm_tol) * lerpf(0.6, 1.0, g.regularity))
	var pm := 1.0
	if not parts.is_empty():
		pm = 0.0
		for p in parts:
			pm += p
		pm /= parts.size()
	return gm * (0.3 + 0.7 * pm)


static func log_gauss(value: float, target: float, tol: float) -> float:
	if value <= 0.0 or target <= 0.0:
		return 0.0
	var d := log(value / target)
	return exp(-(d * d) / (2.0 * tol * tol))


## Physical reaction to a judged contact. `g` may be null for scripted reactions.
func react(level: int, world_pos: Vector2, g: Gesture = null) -> void:
	var lp := to_local(world_pos)
	last_level = level
	match level:
		Game.Level.WRONG:
			tension = minf(tension + 0.55, 1.0)
			relax = maxf(relax - 0.15, 0.0)
		Game.Level.CLOSE:
			relax = minf(relax + 0.04, 1.0)
			excitement = minf(excitement + 0.12, 1.0)
		Game.Level.GOOD:
			relax = minf(relax + 0.08, 1.0)
			excitement = minf(excitement + 0.25, 1.0)
		Game.Level.VERY_GOOD:
			relax = minf(relax + 0.12, 1.0)
			excitement = minf(excitement + 0.45, 1.0)
		Game.Level.HERRING:
			excitement = 1.0
			tension = 1.0
	var target := float(level)
	level_smoothed = lerpf(level_smoothed, target, 0.3)
	_on_reaction(level, lp, g)
	reacted.emit(level, lp)


func _on_reaction(_level: int, _local_pos: Vector2, _g: Gesture) -> void:
	pass


## Pointer hover / drag, world space. Called every motion event.
func on_pointer(world_pos: Vector2, pressed: bool, world_vel: Vector2) -> void:
	var lp := to_local(world_pos)
	var prev := pointer_local
	pointer_local = lp
	pointer_pressed = pressed
	_on_pointer(prev, lp, pressed, world_vel)


func _on_pointer(_prev: Vector2, _lp: Vector2, _pressed: bool, _vel: Vector2) -> void:
	pass


## The beast is drawing the player's attention here.
func hint(strength: float) -> void:
	attention = maxf(attention, clampf(strength, 0.0, 1.0))


## Called by the beast on big full-body events (thumps, shifts, release).
func body_jolt(_strength: float) -> void:
	pass


## World position the beast's eyes / tendrils point at when hinting.
func focus_point() -> Vector2:
	return to_global(hit_offset)


func _ellipse_dist(lp: Vector2) -> float:
	var d := (lp - hit_offset) / hit_radii
	return d.length()
