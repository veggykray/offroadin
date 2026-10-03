class_name CausalClockSolver
extends RefCounted
## Breadth-first search over puzzle states. Used for:
##  * the in-game hint ("shortest way to extend the chain by one ring"),
##  * tests and the layout analyzer (prove a layout is solvable).
##
## States are packed into a single int: positions in mixed radix, then the pin
## mask above them. Move effects depend on the state only through the pin mask
## and which cams are engaged, so propagation results are cached on that key.
## This keeps the search fast enough to run on a worker thread mid-game.
##
## Thread safety: a solver only reads the layout and owns all of its caches,
## so create one per search.

## Move encoding: rotate = element * 2 + (0 for +1, 1 for -1); pin = PIN_BASE + element.
const PIN_BASE := 1000

var layout: CausalClockLayout
var _radix: PackedInt64Array = PackedInt64Array()
var _pos_space: int = 1
var _cam_couplings: Array[CausalClockLayout.CouplingDef] = []
var _moves: PackedInt32Array = PackedInt32Array()
var _effect_cache: Dictionary = {}
var _depth_cache: Dictionary = {}
var nodes_expanded: int = 0


func _init(p_layout: CausalClockLayout) -> void:
	layout = p_layout
	_pos_space = 1
	for e in layout.elements:
		_radix.append(_pos_space)
		_pos_space *= e.positions
	for c in layout.couplings:
		if c.has_cam():
			_cam_couplings.append(c)
	for e in layout.elements:
		if e.manual:
			_moves.append(e.index * 2)
			_moves.append(e.index * 2 + 1)
	if layout.pin_count > 0:
		for e in layout.elements:
			if e.pinnable:
				_moves.append(PIN_BASE + e.index)


func encode(s: CausalClockState) -> int:
	var k := 0
	for i in s.positions.size():
		k += s.positions[i] * _radix[i]
	return k + s.pin_mask * _pos_space


func decode(key: int) -> CausalClockState:
	var s := CausalClockState.new()
	var p := key % _pos_space
	s.positions.resize(layout.element_count())
	for i in layout.element_count():
		s.positions[i] = (p / _radix[i]) % layout.elements[i].positions
	s.pin_mask = key / _pos_space
	return s


static func move_to_string(layout_: CausalClockLayout, move: int) -> String:
	if move >= PIN_BASE:
		return "pin:%s" % layout_.elements[move - PIN_BASE].id
	return "%s%s" % [layout_.elements[move / 2].id, "+" if move % 2 == 0 else "-"]


## Successor key for `move` from state `key`, or -1 if the move is illegal.
func successor(key: int, move: int) -> int:
	var pins := key / _pos_space
	var pos_key := key % _pos_space
	if move >= PIN_BASE:
		var el := move - PIN_BASE
		var bit := 1 << el
		if pins & bit == 0:
			var used := 0
			var m := pins
			while m != 0:
				used += m & 1
				m >>= 1
			if used >= layout.pin_count:
				return -1
		return pos_key + (pins ^ bit) * _pos_space
	var element := move / 2
	var dir := 1 if move % 2 == 0 else -1
	if (pins >> element) & 1 == 1:
		return -1
	# Cam bits for this position.
	var cams := 0
	for j in _cam_couplings.size():
		var c := _cam_couplings[j]
		var n := layout.elements[c.cam_element].positions
		var pos := (pos_key / _radix[c.cam_element]) % n
		var gear_slot := int(floor(c.angle_deg / 360.0 * n + CausalClockMechanism.EPS))
		if c.cam_teeth.has(posmod(gear_slot - pos, n)):
			cams |= 1 << j
	var ck := ((move * 65536 + pins) << _cam_couplings.size()) | cams
	var deltas: PackedInt32Array
	if _effect_cache.has(ck):
		deltas = _effect_cache[ck]
	else:
		var engaged: Array[bool] = []
		var j2 := 0
		for c in layout.couplings:
			if c.has_cam():
				engaged.append((cams >> j2) & 1 == 1)
				j2 += 1
			else:
				engaged.append(true)
		var r := CausalClockMechanism.MoveResult.new()
		CausalClockMechanism.propagate(layout, engaged, pins, element, dir, r)
		deltas = r.deltas if r.ok else PackedInt32Array()
		_effect_cache[ck] = deltas
	if deltas.is_empty():
		return -1
	var out := 0
	for i in deltas.size():
		var n2 := layout.elements[i].positions
		var p := (pos_key / _radix[i]) % n2
		out += posmod(p + deltas[i], n2) * _radix[i]
	return out + pins * _pos_space


## Genuine chain depth for a position key (solved = ring_count + 1). Decoy
## routes count as no progress, so hints never lead into a red herring. Cached.
func depth_of(key: int) -> int:
	var pk := key % _pos_space
	if _depth_cache.has(pk):
		return _depth_cache[pk]
	var s := decode(pk)
	var t := CausalClockMechanism.trace_chain(layout, s.positions)
	var d := layout.ring_count + 1 if t.solved else t.true_depth
	_depth_cache[pk] = d
	return d


## Shortest move list from `start` to any state whose chain depth is at least
## `target_depth` (use ring_count + 1 for "solved"). Returns the moves as
## encoded ints, an empty array if already there, or null if nothing was
## found within `max_nodes` expansions.
func search(start: CausalClockState, target_depth: int, max_nodes: int = 200000) -> Variant:
	var start_key := encode(start)
	if depth_of(start_key) >= target_depth:
		return PackedInt32Array()
	var parent := {start_key: -1}
	var via := {start_key: -1}
	var frontier := PackedInt64Array([start_key])
	nodes_expanded = 0
	while not frontier.is_empty():
		var next := PackedInt64Array()
		for key in frontier:
			nodes_expanded += 1
			if nodes_expanded > max_nodes:
				return null
			for mv in _moves:
				var nk := successor(key, mv)
				if nk < 0 or parent.has(nk):
					continue
				parent[nk] = key
				via[nk] = mv
				if depth_of(nk) >= target_depth:
					var path := PackedInt32Array()
					var k: int = nk
					while parent[k] != -1:
						path.append(via[k])
						k = parent[k]
					path.reverse()
					return path
				next.append(nk)
		frontier = next
	return null


## Hint: the shortest way to make the chain one ring longer (or to finish).
func hint(start: CausalClockState, max_nodes: int = 200000) -> Variant:
	var d := depth_of(encode(start))
	return search(start, mini(d + 1, layout.ring_count + 1), max_nodes)


## Plays hint after hint until solved; returns the full move list or null.
## Mirrors what a methodical player following the hint would do.
func solve_by_stages(start: CausalClockState, max_nodes_per_stage: int = 400000) -> Variant:
	var s := start.copy()
	var all := PackedInt32Array()
	var guard := 0
	while depth_of(encode(s)) <= layout.ring_count and guard < 64:
		guard += 1
		var part: Variant = hint(s, max_nodes_per_stage)
		if part == null:
			return null
		for mv in part:
			s = decode(successor(encode(s), mv))
			all.append(mv)
	return all
