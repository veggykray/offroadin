class_name LBHand
extends Node3D
## Shared base for Bill's hand and the rival hands: planar movement with
## acceleration / max speed / inertia, grabbing, being slapped, being pinned.
## The 3D look (arm + hand) lives in LBHandVisual so art can be swapped.

signal slapped(by: LBHand)
signal grabbed(obj: LBTableObject)
signal dropped(obj: LBTableObject)

@export_group("Body")
@export var radius := 0.095
## How strongly this hand shoves objects / other hands.
@export var push_mass := 1.6
@export var grip := 1.0
@export var hover_height := 0.06

@export_group("Look")
@export var sleeve_color := Color(0.24, 0.2, 0.15)
@export var skin_color := Color(0.88, 0.7, 0.6)
@export var cuff_color := Color(0.92, 0.9, 0.84)
@export var sleeve_radius := 0.07
## Bare arm with a short sleeve (Bill's hospital gown) instead of a full sleeve.
@export var bare_arm := false
## Optional material for the sleeve (overrides sleeve_color).
var sleeve_material: Material
## Cartoon scale of the hand mesh (readability from the far camera).
@export var visual_scale := 1.9

var plane_pos := Vector2.ZERO
var vel := Vector2.ZERO
var is_player := false
var owner_index := -1            # diner index, -1 = Bill
var shoulder := Vector3.ZERO
var active := true
var held: LBTableObject = null
var cover: LBTableObject = null  # napkin draped over the hand
var stunned_t := 0.0
var pinned_by: LBHand = null
var pinning: LBHand = null
var slap_t := 0.0                # >0 while the slap animation plays
var slap_dir := Vector2.ZERO
var grip_closed := 0.0           # 0 open .. 1 closed (visual)
var lift := 0.0                  # extra height (ending raise, emerging)
var palm_up := 0.0               # 0 palm down .. 1 palm up (empty-hand look)
var reach_scale := 1.0           # 0 = withdrawn under the table edge
var forced_freeze := false
var world                        # LBTableWorld
var visual: Node3D
var held_fork: bool = false      # the Glasses rival wields a fork
var innocent := false            # pretending / shamed: diners stop judging it
var chewing_t := 0.0             # >0 while chewing a stolen mouthful (Bill)


func _ready() -> void:
	if visual == null:
		visual = LBHandVisual.new()
		visual.name = "HandVisual"
		add_child(visual)
		visual.setup(self)


func speed() -> float:
	return vel.length()


func is_concealed() -> bool:
	return cover != null


func can_act() -> bool:
	return active and stunned_t <= 0.0 and pinned_by == null and not forced_freeze


func height_above_table() -> float:
	return hover_height + lift


## Integrate velocity towards desired_vel with separate accel/decel limits.
func drive(dt: float, desired: Vector2, accel: float, decel: float, max_speed: float) -> void:
	if desired.length() > max_speed:
		desired = desired.normalized() * max_speed
	var dv := desired - vel
	var speeding_up := desired.length() > vel.length() and desired.dot(vel) >= 0.0
	var rate := accel if speeding_up else decel
	vel += dv.limit_length(rate * dt)


func step_motion(dt: float) -> void:
	if stunned_t > 0.0:
		stunned_t -= dt
		vel = vel.lerp(Vector2.ZERO, LBConst.damp(5.0, dt))
	if pinned_by != null:
		vel = Vector2.ZERO
		plane_pos = plane_pos.lerp(pinned_by.plane_pos + (plane_pos - pinned_by.plane_pos).limit_length(0.07), LBConst.damp(20.0, dt))
	plane_pos += vel * dt
	if slap_t > 0.0:
		slap_t = maxf(slap_t - dt, 0.0)
	chewing_t = maxf(chewing_t - dt, 0.0)
	var target_grip := 1.0 if held != null else 0.0
	if pinning != null:
		target_grip = 0.8
	grip_closed = lerpf(grip_closed, target_grip, LBConst.damp(14.0, dt))


func grab(obj: LBTableObject) -> void:
	if obj == null:
		return
	if obj is LBBiscuit:
		(obj as LBBiscuit).add_holder(self)
	else:
		if obj.held_by != null and obj.held_by != self and obj.held_by is LBHand:
			(obj.held_by as LBHand).held = null
		obj.held_by = self
	held = obj
	obj.vel = Vector2.ZERO
	grabbed.emit(obj)


func release(throw_vel := Vector2.ZERO) -> LBTableObject:
	var obj := held
	if obj == null:
		return null
	held = null
	if obj is LBBiscuit:
		(obj as LBBiscuit).remove_holder(self)
	elif obj.held_by == self:
		obj.held_by = null
	if obj.held_by == null:
		obj.vel = throw_vel
		obj.lift = 0.0
	dropped.emit(obj)
	return obj


func drape(napkin: LBTableObject) -> void:
	cover = napkin
	napkin.held_by = self


func undrape() -> LBTableObject:
	var n := cover
	if n == null:
		return null
	cover = null
	n.held_by = null
	n.lift = 0.0
	n.vel = vel * 0.5
	return n


func get_slapped(by: LBHand, dir: Vector2, strength := 1.0) -> void:
	vel = dir.normalized() * 2.6 * strength
	stunned_t = 0.75 * strength
	if pinning:
		pinning.pinned_by = null
		pinning = null
	slapped.emit(by)


func do_slap_anim(dir: Vector2) -> void:
	slap_t = 0.16
	slap_dir = dir.normalized()


## World-space position of the palm.
func palm_world() -> Vector3:
	return LBConst.p2w(plane_pos, LBConst.TABLE_Y + height_above_table())
