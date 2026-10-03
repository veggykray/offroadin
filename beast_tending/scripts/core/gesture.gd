class_name Gesture
extends RefCounted
## One recognised piece of physical contact, produced by GestureRecognizer.
##
## Continuous gestures (HOLD, STROKE, RUB, SCRATCH) arrive as a BEGIN, then a
## TICK roughly every `tick_interval`, then an END. POKE and RHYTHM arrive as a
## single INSTANT event.

enum Type { NONE, POKE, HOLD, STROKE, RUB, SCRATCH, RHYTHM }
enum Phase { INSTANT, BEGIN, TICK, END }

const TYPE_NAMES := ["none", "poke", "hold", "stroke", "rub", "scratch", "rhythmic tap"]

## How similar a performed gesture (row) is to a wanted gesture (column).
## Gives the creature some tolerance: a rub is a bit like a scratch, etc.
const AFFINITY := {
	Type.RUB: {Type.SCRATCH: 0.45, Type.STROKE: 0.4, Type.HOLD: 0.2},
	Type.SCRATCH: {Type.RUB: 0.45, Type.STROKE: 0.1},
	Type.STROKE: {Type.RUB: 0.4, Type.HOLD: 0.1},
	Type.HOLD: {Type.RUB: 0.25, Type.STROKE: 0.15},
	Type.POKE: {Type.RHYTHM: 0.5},
	Type.RHYTHM: {Type.POKE: 0.6},
}

var type: Type = Type.NONE
var phase: Phase = Phase.INSTANT
var screen_pos := Vector2.ZERO
var world_pos := Vector2.ZERO
## Average pointer speed over the analysis window, screen px / s.
var speed := 0.0
## Dominant direction of travel (normalised), or principal axis for rubs.
var direction := Vector2.ZERO
## Largest side of the bounding box of recent movement, px.
var extent := 0.0
## Back-and-forth cycles per second (rub / scratch).
var frequency := 0.0
## 0..1 rough "pressure" approximation derived from speed / sharpness / time.
var intensity := 0.0
## Seconds since this gesture type began (or press length for pokes).
var duration := 0.0
## Seconds this tick covers (continuous gestures only).
var dt := 0.0
## Total distance travelled since the gesture began, px.
var path_length := 0.0
## Mean interval between taps (pokes / rhythm), seconds.
var interval := 0.0
## 0..1, how even the tap intervals were.
var regularity := 0.0
## Taps in the current tap streak.
var tap_count := 0
## Recogniser clock time of the event.
var time := 0.0


static func type_name(t: int) -> String:
	return TYPE_NAMES[t] if t >= 0 and t < TYPE_NAMES.size() else "?"


static func affinity(performed: int, wanted: int) -> float:
	if performed == wanted:
		return 1.0
	if AFFINITY.has(performed):
		return AFFINITY[performed].get(wanted, 0.0)
	return 0.0


func is_continuous() -> bool:
	return type == Type.HOLD or type == Type.STROKE or type == Type.RUB or type == Type.SCRATCH


func duplicate_gesture() -> Gesture:
	var g := Gesture.new()
	g.type = type
	g.phase = phase
	g.screen_pos = screen_pos
	g.world_pos = world_pos
	g.speed = speed
	g.direction = direction
	g.extent = extent
	g.frequency = frequency
	g.intensity = intensity
	g.duration = duration
	g.dt = dt
	g.path_length = path_length
	g.interval = interval
	g.regularity = regularity
	g.tap_count = tap_count
	g.time = time
	return g


func _to_string() -> String:
	return "%s spd=%d f=%.1f ext=%d int=%.2f" % [type_name(type), speed, frequency, extent, intensity]
