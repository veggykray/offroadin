class_name CausalClockMechanism
extends RefCounted
## The rules of the clock, as pure functions over (layout, state).
##
## THE RULESET (also explained to players in the in-game "Mechanism" notes):
##
## 1. Turning. The player turns one ring one step clockwise (+1) or
##    anticlockwise (-1). A pinned ring cannot be turned; the hub cannot be
##    turned by hand (unless the layout marks it manual).
## 2. Gears. Each coupling is a gear between two elements. When one end
##    turns d steps the other turns d * ratio steps (ratio -1 = opposite
##    direction). Motion spreads through the whole gear train, breadth first.
## 3. Ratchets. A one-way coupling transmits only from `a` to `b`. Turning
##    `b` leaves `a` alone.
## 4. Cams (toothed arcs). A coupling with a cam only bites while one of the
##    cam ring's toothed sectors sits under the gear. Engagement is read from
##    the state BEFORE the turn begins.
## 5. Pins. A pinned ring never moves. Any gear trying to drive it slips, and
##    motion does not pass through it to rings beyond.
## 6. Jams. If two gear paths try to drive the same element by different
##    amounts, the mechanism jams and the turn is refused (nothing moves).
##
## These rules are deterministic and local, which is what makes the puzzle
## learnable: every effect can be seen as a gear meshing on screen.


class MoveResult:
	var ok: bool = false
	## "" when ok; otherwise "pinned", "fixed", "jam", "solved", "invalid".
	var reason: String = ""
	var element: int = -1
	var dir: int = 0
	## Steps each element turns (0 for unaffected).
	var deltas: PackedInt32Array = PackedInt32Array()
	## Propagation distance from the turned ring (-1 = not reached). Used to
	## stagger animations so cause visibly precedes effect.
	var wave: PackedInt32Array = PackedInt32Array()
	## Coupling indices that carried motion / slipped against a pin.
	var transmitted: PackedInt32Array = PackedInt32Array()
	var slipped: PackedInt32Array = PackedInt32Array()
	## Couplings left idle because their cam had no tooth under the gear.
	var idle_cams: PackedInt32Array = PackedInt32Array()
	## On a jam: the element that was driven two ways and the couplings involved.
	var jam_element: int = -1
	var jam_couplings: PackedInt32Array = PackedInt32Array()

	func moved_elements() -> PackedInt32Array:
		var out := PackedInt32Array()
		for i in deltas.size():
			if deltas[i] != 0:
				out.append(i)
		return out


class ChainTrace:
	## How far the chain currently runs from the entry towards the heart.
	## depth = number of rings the chain fully crosses (0..ring_count).
	var depth: int = 0
	var solved: bool = false
	## Vector2i(element, segment) for every fragment that is part of the chain,
	## in order from the entry inward (includes a final dead-end if touched).
	var links: Array[Vector2i] = []
	## World angle (degrees) of each connected junction, entry first.
	var junction_angles: PackedFloat32Array = PackedFloat32Array()
	## The hub socket index reached when solved.
	var socket: int = -1
	## Where the chain breaks (world degrees) and on which element (-1 none).
	var break_element: int = -1
	var break_angle: float = 0.0

	func contains(element: int, segment: int) -> bool:
		return links.has(Vector2i(element, segment))


const EPS := 0.0001


## Is coupling `c` currently able to transmit motion?
static func coupling_engaged(layout: CausalClockLayout, positions: PackedInt32Array, c: CausalClockLayout.CouplingDef) -> bool:
	if not c.has_cam():
		return true
	return c.cam_teeth.has(cam_sector(layout, positions, c))


## Which local sector of the cam ring currently sits under the coupling gear.
static func cam_sector(layout: CausalClockLayout, positions: PackedInt32Array, c: CausalClockLayout.CouplingDef) -> int:
	var n := layout.elements[c.cam_element].positions
	var gear_slot := int(floor(c.angle_deg / 360.0 * n + EPS))
	return posmod(gear_slot - positions[c.cam_element], n)


## Engagement flags for every coupling (index-aligned with layout.couplings).
static func engagement(layout: CausalClockLayout, positions: PackedInt32Array) -> Array[bool]:
	var out: Array[bool] = []
	for c in layout.couplings:
		out.append(coupling_engaged(layout, positions, c))
	return out


## Simulate turning `element` by `dir` (+1/-1). Does not modify `state`.
static func simulate_turn(layout: CausalClockLayout, state: CausalClockState, element: int, dir: int) -> MoveResult:
	var r := MoveResult.new()
	r.element = element
	r.dir = dir
	if element < 0 or element >= layout.element_count() or dir == 0:
		r.reason = "invalid"
		return r
	if not layout.elements[element].manual:
		r.reason = "fixed"
		return r
	if state.is_pinned(element):
		r.reason = "pinned"
		return r
	propagate(layout, engagement(layout, state.positions), state.pin_mask, element, dir, r)
	return r


## Core propagation, separated from state so the solver can cache it by
## (pins, engagement). Fills `r` and sets r.ok.
static func propagate(layout: CausalClockLayout, engaged: Array[bool], pin_mask: int, element: int, dir: int, r: MoveResult) -> void:
	var n := layout.element_count()
	r.deltas.resize(n)
	r.deltas.fill(0)
	r.wave.resize(n)
	r.wave.fill(-1)
	var assigned := PackedByteArray()
	assigned.resize(n)
	assigned.fill(0)
	var via := PackedInt32Array()  # coupling that first drove each element
	via.resize(n)
	via.fill(-1)
	r.deltas[element] = dir
	r.wave[element] = 0
	assigned[element] = 1
	var queue := PackedInt32Array([element])
	var head := 0
	while head < queue.size():
		var u := queue[head]
		head += 1
		for c in layout.couplings:
			var v := -1
			if c.a == u:
				v = c.b
			elif c.b == u and not c.one_way:
				v = c.a
			else:
				continue
			if not engaged[c.index]:
				if not r.idle_cams.has(c.index):
					r.idle_cams.append(c.index)
				continue
			if (pin_mask >> v) & 1 == 1:
				if not r.slipped.has(c.index):
					r.slipped.append(c.index)
				continue
			var nd := r.deltas[u] * c.ratio
			if assigned[v] == 1:
				if r.deltas[v] != nd:
					r.ok = false
					r.reason = "jam"
					r.jam_element = v
					r.jam_couplings = PackedInt32Array([c.index])
					if via[v] >= 0:
						r.jam_couplings.append(via[v])
					return
				if not r.transmitted.has(c.index):
					r.transmitted.append(c.index)
				continue
			assigned[v] = 1
			via[v] = c.index
			r.deltas[v] = nd
			r.wave[v] = r.wave[u] + 1
			r.transmitted.append(c.index)
			queue.append(v)
	r.ok = true
	r.reason = ""


## Apply a successful MoveResult to `state` (in place).
static func apply(layout: CausalClockLayout, state: CausalClockState, r: MoveResult) -> void:
	for i in r.deltas.size():
		if r.deltas[i] != 0:
			state.positions[i] = posmod(state.positions[i] + r.deltas[i], layout.elements[i].positions)


## Can a pin be added to / removed from `element`? Returns "" when allowed.
static func pin_toggle_error(layout: CausalClockLayout, state: CausalClockState, element: int) -> String:
	if element < 0 or element >= layout.element_count():
		return "invalid"
	if not layout.elements[element].pinnable:
		return "not_pinnable"
	if not state.is_pinned(element) and state.pins_used() >= layout.pin_count:
		return "no_pins_left"
	return ""


## Follow the chain from the entry anchor inward.
static func trace_chain(layout: CausalClockLayout, positions: PackedInt32Array) -> ChainTrace:
	var t := ChainTrace.new()
	var turn := wrapf(layout.entry_angle_deg / 360.0, 0.0, 1.0)
	t.junction_angles.append(turn * 360.0)
	for k in layout.ring_count:
		var e := layout.elements[k]
		var found := -1
		for si in e.segments.size():
			var s := e.segments[si]
			if s.out_slot != CausalClockLayout.NONE and _same_turn(float(s.out_slot + positions[k]) / e.positions, turn):
				found = si
				break
		if found == -1:
			t.break_element = k
			t.break_angle = turn * 360.0
			return t
		t.links.append(Vector2i(k, found))
		var seg := e.segments[found]
		if seg.in_slot == CausalClockLayout.NONE:
			t.break_element = k
			t.break_angle = turn * 360.0
			return t
		turn = wrapf(float(seg.in_slot + positions[k]) / e.positions, 0.0, 1.0)
		t.depth = k + 1
		t.junction_angles.append(turn * 360.0)
	var hub := layout.elements[layout.hub_index()]
	for si in hub.sockets.size():
		if _same_turn(float(hub.sockets[si] + positions[layout.hub_index()]) / hub.positions, turn):
			t.solved = true
			t.socket = si
			return t
	t.break_element = layout.hub_index()
	t.break_angle = turn * 360.0
	return t


static func _same_turn(a: float, b: float) -> bool:
	return absf(wrapf(a - b, -0.5, 0.5)) < EPS
