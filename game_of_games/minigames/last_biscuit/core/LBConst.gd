class_name LBConst
extends RefCounted
## Shared layout constants and helpers for The Last Biscuit.
##
## Gameplay runs on the table *plane*: a Vector2 (x, z) where x is across the
## table (left/right from Bill's point of view) and z runs along its length
## (+z is Bill's end, -z is the far end). World height is added for visuals.

const TABLE_Y := 0.76            # height of the table top
const TABLE_HALF_W := 1.05       # half width (x)
const TABLE_HALF_L := 5.0        # half length (z)
const TABLE_DRAW_HALF_L := 5.0   # drawn table length (play area spans all of it)
const SEAT_X := 1.48             # diners sit this far from the centre line
const BISCUIT_HOME := Vector2(0.0, 0.0)
const BILL_HAND_HOME := Vector2(0.18, 4.55)
const BILL_SHOULDER := Vector3(0.30, 1.20, 5.72)
const HOME_ZONE_Z := 4.35        # bring the biscuit past this line to win

enum Phase { BEGINNING = 1, SECOND_HAND = 2, THIRD_HAND = 3, CHAOS = 4, RETURN = 5 }


static func p2w(p: Vector2, y: float = TABLE_Y) -> Vector3:
	return Vector3(p.x, y, p.y)


static func w2p(v: Vector3) -> Vector2:
	return Vector2(v.x, v.z)


## Progress of a point from Bill's home towards the biscuit plate, 0..1.
static func approach_progress(p: Vector2) -> float:
	var total := BILL_HAND_HOME.y - BISCUIT_HOME.y
	return clampf((BILL_HAND_HOME.y - p.y) / total, 0.0, 1.0)


static func phase_name(p: int) -> String:
	match p:
		Phase.BEGINNING: return "1 BEGINNING (Bill alone)"
		Phase.SECOND_HAND: return "2 SECOND HAND"
		Phase.THIRD_HAND: return "3 ANOTHER HAND"
		Phase.CHAOS: return "4 SILENT CHAOS"
		Phase.RETURN: return "5 THE RUN BACK"
	return str(p)


## Exponential smoothing factor that is frame-rate independent.
static func damp(rate: float, dt: float) -> float:
	return 1.0 - exp(-rate * dt)


static func angle_wrap(a: float) -> float:
	return wrapf(a, -PI, PI)
