class_name LBGaze
extends Node
## A diner's field of view on the table plane. Driven by the diner's actual
## (animated) head/eye direction, so what the player SEES on the face is
## exactly what the diner sees. Cones are only drawn in debug mode.

## Half angle of the focused cone (degrees). Movement here is very noticeable.
@export var half_angle_deg := 24.0
## Extra peripheral band beyond the focused cone, as a multiple of half angle.
@export var peripheral_mult := 1.6
@export var peripheral_weight := 0.25
@export var view_range := 4.2
## 0 = blind, 1 = perfect eyesight. Animated by behaviours (sleep, glasses off).
@export_range(0.0, 1.0) var sight := 1.0
## Short range "feel" radius that works even with sight 0 (Blind Listener).
@export var feel_radius := 0.0
## Height of the eyes above the table top.
@export var eye_height := 0.48

## Distance to whatever the eyes are focused on. Looking down at your own
## plate means you don't see the far side of the table.
var focus_dist := 99.0
var origin := Vector2.ZERO        # plane position of the eyes (or teapot mirror)
var dir := Vector2.LEFT           # plane look direction (unit)
var world: LBTableWorld
var ignore_occluder: Object = null


## 0..1 how well a point is seen right now.
func visibility_of(p: Vector2, target_h := 0.06, concealed := false) -> float:
	var to := p - origin
	var d := to.length()
	var feel := 0.0
	if feel_radius > 0.0 and d < feel_radius:
		feel = 1.0 - d / feel_radius
	var rng := minf(view_range, focus_dist * 1.35 + 0.5)
	if sight <= 0.01 or d > rng or d < 0.001:
		return feel
	var ang := absf(dir.angle_to(to))
	var half := deg_to_rad(half_angle_deg)
	var v := 0.0
	if ang < half:
		v = 1.0 - 0.55 * (ang / half)
	elif ang < half * peripheral_mult:
		v = peripheral_weight * (1.0 - (ang - half) / (half * (peripheral_mult - 1.0)))
	else:
		return feel
	v *= 1.0 - 0.45 * (d / rng)
	if world and world.sight_blocked(origin, eye_height, p, target_h, ignore_occluder):
		return feel
	if concealed:
		v *= 0.18
	return maxf(v * sight, feel)


func in_focus(p: Vector2) -> bool:
	var to := p - origin
	return sight > 0.3 and to.length() < minf(view_range, focus_dist * 1.35 + 0.5) and absf(dir.angle_to(to)) < deg_to_rad(half_angle_deg)
