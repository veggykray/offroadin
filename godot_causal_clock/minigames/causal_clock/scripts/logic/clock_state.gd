class_name CausalClockState
extends RefCounted
## The complete mutable state of a puzzle: one position per element (rings +
## hub) and the set of pinned rings (a bitmask, bit i = element i pinned).
## Small and copyable so the undo stack and the solver can keep many.

var positions: PackedInt32Array = PackedInt32Array()
var pin_mask: int = 0


static func create(start_positions: PackedInt32Array, pins: int = 0) -> CausalClockState:
	var s := CausalClockState.new()
	s.positions = start_positions.duplicate()
	s.pin_mask = pins
	return s


func copy() -> CausalClockState:
	return CausalClockState.create(positions, pin_mask)


func is_pinned(element: int) -> bool:
	return (pin_mask >> element) & 1 == 1


func pins_used() -> int:
	var n := 0
	var m := pin_mask
	while m != 0:
		n += m & 1
		m >>= 1
	return n


func equals(other: CausalClockState) -> bool:
	return other != null and pin_mask == other.pin_mask and positions == other.positions


func describe() -> String:
	return "pos=%s pins=%d" % [str(positions), pin_mask]
