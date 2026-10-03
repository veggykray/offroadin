class_name LBTableObject
extends Node3D
## A physical object on the table. Simulated on the table plane by
## LBTableWorld (circle collisions, sliding, wobble), rendered in 3D.
## Visuals come from LBProps so placeholder art can be swapped per kind.

enum Kind {
	CUP, DINNER_PLATE, BISCUIT_PLATE, CANDLESTICK, CANDELABRA, FORK, KNIFE, SPOON,
	TEAPOT_SILVER, TEAPOT_CHINA, FLOWERS, SUGAR_BOWL, SERVING_DISH, PLATE_STACK,
	NAPKIN, BOTTLE, CREAM_JUG, SALT, WINE_GLASS, TEETH, SUGAR_CUBE, BISCUIT, FAKE_BISCUIT,
}

@export var kind: Kind = Kind.CUP
@export var radius := 0.05
@export var mass := 0.3
## Height used for line-of-sight occlusion (0 = never hides a hand).
@export var height := 0.1
## Loudness multiplier when hit.
@export var noise_factor := 1.0
@export var hand_collides := true
@export var grabbable := false
@export var occludes := false
@export var friction := 6.0
## "clink", "glass", "clatter", "thud", "rustle", "squeak"
@export var sound := "clink"

var plane_pos := Vector2.ZERO
var vel := Vector2.ZERO
var yaw := 0.0
var held_by: Node = null          # LBHand currently holding it
var on_table := true
var home_pos := Vector2.ZERO
var home_yaw := 0.0
var visual: Node3D
var world                          # LBTableWorld (untyped to avoid cyclic refs)

# juice
var wobble := 0.0
var wobble_vel := 0.0
var wobble_dir := Vector2.RIGHT
var hop := 0.0
var hop_vel := 0.0
var lift := 0.0                   # extra height while carried
var last_noise_t := -10.0
var riders: Array = []            # objects resting on top (biscuit on plate)
var _fall_t := -1.0


static func defaults(k: Kind) -> Dictionary:
	# radius, mass, height, noise, hand_collides, grabbable, occludes, friction, sound
	match k:
		Kind.CUP: return {"r": 0.062, "m": 0.35, "h": 0.1, "n": 1.0, "hc": true, "g": true, "o": false, "f": 7.0, "s": "clink"}
		Kind.DINNER_PLATE: return {"r": 0.13, "m": 0.6, "h": 0.0, "n": 0.6, "hc": false, "g": false, "o": false, "f": 9.0, "s": "clink"}
		Kind.BISCUIT_PLATE: return {"r": 0.17, "m": 0.9, "h": 0.0, "n": 0.7, "hc": false, "g": true, "o": false, "f": 8.0, "s": "clink"}
		Kind.CANDLESTICK: return {"r": 0.05, "m": 1.0, "h": 0.25, "n": 1.4, "hc": true, "g": false, "o": false, "f": 9.0, "s": "clatter"}
		Kind.CANDELABRA: return {"r": 0.08, "m": 2.6, "h": 0.3, "n": 1.6, "hc": true, "g": false, "o": false, "f": 10.0, "s": "clatter"}
		Kind.FORK: return {"r": 0.04, "m": 0.08, "h": 0.0, "n": 0.9, "hc": true, "g": true, "o": false, "f": 5.0, "s": "clink"}
		Kind.KNIFE: return {"r": 0.04, "m": 0.09, "h": 0.0, "n": 0.9, "hc": true, "g": true, "o": false, "f": 5.0, "s": "clink"}
		Kind.SPOON: return {"r": 0.035, "m": 0.06, "h": 0.0, "n": 1.0, "hc": true, "g": true, "o": false, "f": 5.0, "s": "clink"}
		Kind.TEAPOT_SILVER: return {"r": 0.1, "m": 1.6, "h": 0.27, "n": 1.1, "hc": true, "g": true, "o": true, "f": 9.0, "s": "clatter"}
		Kind.TEAPOT_CHINA: return {"r": 0.1, "m": 1.4, "h": 0.25, "n": 1.0, "hc": true, "g": true, "o": true, "f": 9.0, "s": "clink"}
		Kind.FLOWERS: return {"r": 0.15, "m": 3.5, "h": 0.55, "n": 0.35, "hc": true, "g": false, "o": true, "f": 12.0, "s": "thud"}
		Kind.SUGAR_BOWL: return {"r": 0.065, "m": 0.5, "h": 0.1, "n": 1.0, "hc": true, "g": true, "o": false, "f": 8.0, "s": "clink"}
		Kind.SERVING_DISH: return {"r": 0.16, "m": 3.0, "h": 0.3, "n": 1.2, "hc": true, "g": false, "o": true, "f": 11.0, "s": "clatter"}
		Kind.PLATE_STACK: return {"r": 0.13, "m": 2.2, "h": 0.22, "n": 1.5, "hc": true, "g": false, "o": true, "f": 11.0, "s": "clatter"}
		Kind.NAPKIN: return {"r": 0.09, "m": 0.05, "h": 0.0, "n": 0.0, "hc": false, "g": true, "o": false, "f": 10.0, "s": "rustle"}
		Kind.BOTTLE: return {"r": 0.05, "m": 1.1, "h": 0.32, "n": 1.2, "hc": true, "g": false, "o": false, "f": 9.0, "s": "glass"}
		Kind.CREAM_JUG: return {"r": 0.045, "m": 0.3, "h": 0.1, "n": 1.0, "hc": true, "g": true, "o": false, "f": 8.0, "s": "clink"}
		Kind.SALT: return {"r": 0.03, "m": 0.15, "h": 0.08, "n": 0.8, "hc": true, "g": true, "o": false, "f": 8.0, "s": "clink"}
		Kind.WINE_GLASS: return {"r": 0.045, "m": 0.2, "h": 0.18, "n": 1.3, "hc": true, "g": false, "o": false, "f": 8.0, "s": "glass"}
		Kind.TEETH: return {"r": 0.05, "m": 0.15, "h": 0.03, "n": 1.0, "hc": true, "g": true, "o": false, "f": 4.0, "s": "clack"}
		Kind.SUGAR_CUBE: return {"r": 0.018, "m": 0.02, "h": 0.0, "n": 0.2, "hc": false, "g": true, "o": false, "f": 6.0, "s": "clink"}
		Kind.BISCUIT, Kind.FAKE_BISCUIT: return {"r": 0.055, "m": 0.05, "h": 0.0, "n": 0.15, "hc": false, "g": true, "o": false, "f": 5.0, "s": "clink"}
	return {"r": 0.05, "m": 0.3, "h": 0.0, "n": 1.0, "hc": true, "g": false, "o": false, "f": 6.0, "s": "clink"}


func configure(k: Kind, pos: Vector2, rot := 0.0) -> void:
	kind = k
	var d := defaults(k)
	radius = d.r
	mass = d.m
	height = d.h
	noise_factor = d.n
	hand_collides = d.hc
	grabbable = d.g
	occludes = d.o
	friction = d.f
	sound = d.s
	plane_pos = pos
	home_pos = pos
	yaw = rot
	home_yaw = rot
	name = "%s_%d" % [Kind.keys()[k], get_instance_id() % 10000]


func _ready() -> void:
	if visual == null:
		visual = LBProps.build(self)
	_sync_transform()


## The hand that last shoved this object (for blaming noise), or null.
func toucher():
	return get_meta("last_toucher") if has_meta("last_toucher") else null


func is_biscuit() -> bool:
	return kind == Kind.BISCUIT or kind == Kind.FAKE_BISCUIT


func is_flat() -> bool:
	return not hand_collides


func reset_to_home() -> void:
	plane_pos = home_pos
	yaw = home_yaw
	vel = Vector2.ZERO
	held_by = null
	on_table = true
	visible = true
	wobble = 0.0
	wobble_vel = 0.0
	hop = 0.0
	hop_vel = 0.0
	lift = 0.0
	_fall_t = -1.0
	riders.clear()


func bump(impulse_dir: Vector2, strength: float) -> void:
	if strength <= 0.0:
		return
	wobble_dir = impulse_dir.normalized() if impulse_dir.length() > 0.0001 else Vector2.RIGHT
	wobble_vel += strength * 9.0 / maxf(mass, 0.2)


func jump(strength: float) -> void:
	hop_vel = maxf(hop_vel, strength)


func fall_off() -> void:
	if not on_table:
		return
	on_table = false
	_fall_t = 0.0
	vel *= 0.6


func _process(dt: float) -> void:
	# wobble: damped spring giving a little rocking tilt after impacts
	var tilt_limit := 0.5
	var steps := int(ceil(dt / 0.005))
	var h := dt / maxf(steps, 1)
	for i in steps:
		wobble_vel += (-wobble * 160.0 - wobble_vel * 9.0) * h
		wobble = clampf(wobble + wobble_vel * h, -tilt_limit, tilt_limit)
	# hop: little ballistic jump (cutlery leaping after a slap)
	if hop > 0.0 or hop_vel > 0.0:
		hop_vel -= 9.8 * dt
		hop += hop_vel * dt
		if hop <= 0.0:
			hop = 0.0
			if hop_vel < -0.6 and world:
				world.object_landed(self, -hop_vel)
			hop_vel = 0.0
	if _fall_t >= 0.0:
		_fall_t += dt
		if _fall_t > 1.2:
			visible = false
	_sync_transform()


func _sync_transform() -> void:
	var y := LBConst.TABLE_Y + hop + lift
	if _fall_t >= 0.0:
		var t := _fall_t
		y = LBConst.TABLE_Y - 4.9 * t * t
		plane_pos += vel * get_process_delta_time()
	position = LBConst.p2w(plane_pos, y)
	var tilt_axis := Vector3(-wobble_dir.y, 0.0, wobble_dir.x)
	var b := Basis(Vector3.UP, yaw)
	if absf(wobble) > 0.0005 and tilt_axis.length() > 0.001:
		b = Basis(tilt_axis.normalized(), wobble) * b
	if _fall_t >= 0.0:
		b = Basis(Vector3(1, 0, 0.3).normalized(), _fall_t * 6.0) * b
	transform.basis = b
