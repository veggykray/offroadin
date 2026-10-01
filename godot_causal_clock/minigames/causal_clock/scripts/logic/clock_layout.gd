class_name CausalClockLayout
extends RefCounted
## Parsed, validated description of one Causal Clock puzzle.
##
## A layout is authored as JSON (see data/layouts/*.json and the README).
## This class turns that JSON into typed definitions that the rules
## (CausalClockMechanism), the puzzle session (CausalClockPuzzle), the solver
## and the renderer all read. Nothing in here knows about nodes or drawing.
##
## Index convention used everywhere in the mini-game:
##   elements[0]            = outermost ring (Ring A)
##   elements[ring_count-1] = innermost ring
##   elements[ring_count]   = the central hub ("heart")
## Angles in the JSON are degrees measured CLOCKWISE from 12 o'clock.
## Ring-local positions are "slots": slot s of a ring with N positions sits at
## s * 360/N degrees in the ring's own frame. A ring at position p is rotated
## p slots clockwise, so local slot s is found at world slot (s + p).

const FORMAT_VERSION := 1
const NONE := -1


class SegmentDef:
	## A fragment of chain painted on a ring. It enters at the ring's outer edge
	## at local slot `out_slot` and leaves at the inner edge at `in_slot`.
	## Either end may be NONE (-1): that makes a broken fragment / dead end.
	var out_slot: int = NONE
	var in_slot: int = NONE
	## 0..1 across the band (0 = outer edge, 1 = inner edge) for the arc part.
	var lane: float = 0.5
	## Optional: +1 force clockwise arc, -1 anticlockwise, 0 = shortest.
	var arc_dir: int = 0
	## Optional memory id: draws a medallion on this fragment (purely visual).
	var marker: String = ""

	func is_through() -> bool:
		return out_slot != NONE and in_slot != NONE


class ElementDef:
	## One rotatable element: a ring or the hub.
	var index: int = 0
	var id: String = ""
	var label: String = ""
	var positions: int = 8
	var start: int = 0
	## Can the player turn it directly? (The hub normally can't.)
	var manual: bool = true
	var pinnable: bool = true
	var pin_angle_deg: float = 247.5
	var is_hub: bool = false
	## Visual hints (renderer only).
	var material: String = "brass"
	var ornaments: PackedStringArray = PackedStringArray()
	## Heavier rings animate more slowly and sound lower. No rules effect.
	var mass: float = 1.0
	var segments: Array[SegmentDef] = []
	## Hub only: local slots where the chain may terminate.
	var sockets: PackedInt32Array = PackedInt32Array()

	func step_degrees() -> float:
		return 360.0 / float(positions)


class CouplingDef:
	## A mechanical link: when element `a` turns by d steps, element `b` turns
	## by d * ratio steps. Two-way links also let `b` drive `a` (ratio must be
	## +1 or -1 then). One-way links are ratchets/worm drives: `b` can never
	## push `a`.
	var index: int = 0
	var id: String = ""
	var a: int = 0
	var b: int = 0
	var ratio: int = -1
	var one_way: bool = false
	## Where the transfer gear sits (degrees clockwise from 12). Purely visual
	## unless a cam is set, in which case it is also where the cam is read.
	var angle_deg: float = 0.0
	## Cam ("toothed arc"): the link only bites while one of the listed local
	## sectors of `cam_element` is under the gear. Sector k spans local slots
	## k..k+1. cam_element == NONE means always engaged.
	var cam_element: int = NONE
	var cam_teeth: PackedInt32Array = PackedInt32Array()
	## Visual style: "gear", "ratchet", "shaft" (auto-chosen when empty).
	var style: String = ""

	func has_cam() -> bool:
		return cam_element != NONE


class MilestoneDef:
	## A point in the puzzle that reveals a memory.
	## trigger_type: "chain_depth" (value = rings the chain passes through),
	##               "segment_linked" (element + segment become part of chain),
	##               "complete" (the chain reaches a hub socket).
	var index: int = 0
	var id: String = ""
	var trigger_type: String = "chain_depth"
	var value: int = 0
	var element: int = NONE
	var segment: int = NONE
	var memory_id: String = ""
	## "card" = modal reveal, "toast" = small non-blocking notice, "silent".
	var presentation: String = "toast"


var source_path: String = ""
var id: String = ""
var title: String = ""
var subtitle: String = ""
var result_id: String = "causal_clock_complete"
var entry_angle_deg: float = 0.0
var pin_count: int = 2
var intro_lines: PackedStringArray = PackedStringArray()
var elements: Array[ElementDef] = []
var ring_count: int = 0
var couplings: Array[CouplingDef] = []
var milestones: Array[MilestoneDef] = []
## Optional authored solution, e.g. ["A+", "pin:B", "C-"]. Used by tests and
## the analyzer tool to prove the layout is solvable.
var reference_solution: PackedStringArray = PackedStringArray()
var errors: PackedStringArray = PackedStringArray()
var warnings: PackedStringArray = PackedStringArray()


func is_valid() -> bool:
	return errors.is_empty()


func element_count() -> int:
	return elements.size()


func hub_index() -> int:
	return ring_count


func index_of(element_id: String) -> int:
	for e in elements:
		if e.id == element_id:
			return e.index
	return NONE


func start_positions() -> PackedInt32Array:
	var p := PackedInt32Array()
	for e in elements:
		p.append(posmod(e.start, e.positions))
	return p


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

static func load_from_file(path: String) -> CausalClockLayout:
	var layout := CausalClockLayout.new()
	layout.source_path = path
	if not FileAccess.file_exists(path):
		layout.errors.append("Layout file not found: %s" % path)
		return layout
	var text := FileAccess.get_file_as_string(path)
	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		layout.errors.append("%s: JSON error on line %d: %s" % [path, json.get_error_line(), json.get_error_message()])
		return layout
	if typeof(json.data) != TYPE_DICTIONARY:
		layout.errors.append("%s: top level must be an object" % path)
		return layout
	layout._parse(json.data)
	return layout


static func from_dict(data: Dictionary) -> CausalClockLayout:
	var layout := CausalClockLayout.new()
	layout._parse(data)
	return layout


func _parse(d: Dictionary) -> void:
	var fmt := int(d.get("format", FORMAT_VERSION))
	if fmt > FORMAT_VERSION:
		warnings.append("Layout format %d is newer than this build understands (%d)." % [fmt, FORMAT_VERSION])
	id = str(d.get("id", "layout"))
	title = str(d.get("title", "The Causal Clock"))
	subtitle = str(d.get("subtitle", ""))
	result_id = str(d.get("result_id", "causal_clock_complete"))
	entry_angle_deg = float(d.get("entry_angle_deg", 0.0))
	pin_count = int(d.get("pin_count", 2))
	for line in d.get("intro_lines", []):
		intro_lines.append(str(line))
	for step in d.get("reference_solution", []):
		reference_solution.append(str(step))

	var rings_data: Array = d.get("rings", [])
	if rings_data.is_empty():
		errors.append("Layout needs at least one ring.")
	for rd in rings_data:
		elements.append(_parse_element(rd, false))
	ring_count = elements.size()
	elements.append(_parse_element(d.get("hub", {}), true))
	for i in elements.size():
		elements[i].index = i

	var seen := {}
	for e in elements:
		if seen.has(e.id):
			errors.append("Duplicate ring id '%s'." % e.id)
		seen[e.id] = true

	# Couplings reference element ids, so they are parsed after elements.
	var cdata: Array = d.get("couplings", [])
	for i in cdata.size():
		var c := _parse_coupling(cdata[i], i)
		if c != null:
			couplings.append(c)
	var mdata: Array = d.get("milestones", [])
	for i in mdata.size():
		var m := _parse_milestone(mdata[i], i)
		if m != null:
			milestones.append(m)
	_validate()


func _parse_element(rd: Dictionary, hub: bool) -> ElementDef:
	var e := ElementDef.new()
	e.is_hub = hub
	e.id = str(rd.get("id", "H" if hub else "R%d" % elements.size()))
	e.label = str(rd.get("label", "Heart" if hub else "Ring %s" % e.id))
	e.positions = int(rd.get("positions", 8))
	e.start = int(rd.get("start", 0))
	e.manual = bool(rd.get("manual", not hub))
	e.pinnable = bool(rd.get("pinnable", not hub))
	e.pin_angle_deg = float(rd.get("pin_angle_deg", 247.5))
	e.material = str(rd.get("material", "gold" if hub else "brass"))
	for o in rd.get("ornaments", []):
		e.ornaments.append(str(o))
	e.mass = float(rd.get("mass", 1.0))
	for sd in rd.get("segments", []):
		var s := SegmentDef.new()
		s.out_slot = int(sd.get("out", NONE))
		s.in_slot = int(sd.get("in", NONE))
		s.lane = clampf(float(sd.get("lane", 0.5)), 0.15, 0.85)
		s.arc_dir = int(sd.get("arc_dir", 0))
		s.marker = str(sd.get("marker", ""))
		e.segments.append(s)
	for s in rd.get("sockets", []):
		e.sockets.append(int(s))
	return e


func _parse_coupling(cd: Dictionary, i: int) -> CouplingDef:
	var c := CouplingDef.new()
	c.index = couplings.size()
	c.id = str(cd.get("id", "coupling_%d" % i))
	c.a = index_of(str(cd.get("a", "")))
	c.b = index_of(str(cd.get("b", "")))
	if c.a == NONE or c.b == NONE:
		errors.append("Coupling '%s' names an unknown ring (a='%s', b='%s')." % [c.id, cd.get("a", ""), cd.get("b", "")])
		return null
	c.ratio = int(cd.get("ratio", -1))
	c.one_way = bool(cd.get("one_way", false))
	c.angle_deg = float(cd.get("angle_deg", 0.0))
	c.style = str(cd.get("style", ""))
	if cd.has("cam"):
		var cam: Dictionary = cd["cam"]
		c.cam_element = index_of(str(cam.get("ring", "")))
		if c.cam_element == NONE:
			errors.append("Coupling '%s' cam names an unknown ring." % c.id)
		for t in cam.get("teeth", []):
			c.cam_teeth.append(int(t))
	if c.style == "":
		if absi(c.a - c.b) > 1:
			c.style = "shaft"
		elif c.one_way:
			c.style = "ratchet"
		else:
			c.style = "gear"
	return c


func _parse_milestone(md: Dictionary, i: int) -> MilestoneDef:
	var m := MilestoneDef.new()
	m.index = milestones.size()
	m.id = str(md.get("id", "milestone_%d" % i))
	m.memory_id = str(md.get("memory_id", ""))
	m.presentation = str(md.get("presentation", "toast"))
	var trig: Dictionary = md.get("trigger", {})
	m.trigger_type = str(trig.get("type", "chain_depth"))
	m.value = int(trig.get("value", 0))
	if trig.has("ring"):
		m.element = index_of(str(trig["ring"]))
	m.segment = int(trig.get("segment", NONE))
	if not m.trigger_type in ["chain_depth", "segment_linked", "complete"]:
		errors.append("Milestone '%s' has unknown trigger type '%s'." % [m.id, m.trigger_type])
		return null
	return m


func _validate() -> void:
	if pin_count < 0:
		errors.append("pin_count must be >= 0.")
	for e in elements:
		if e.positions < 2 or e.positions > 64:
			errors.append("%s: positions must be 2..64." % e.label)
			continue
		var outs := {}
		for si in e.segments.size():
			var s := e.segments[si]
			for slot in [s.out_slot, s.in_slot]:
				if slot != NONE and (slot < 0 or slot >= e.positions):
					errors.append("%s segment %d: slot %d out of range 0..%d." % [e.label, si, slot, e.positions - 1])
			if s.out_slot == NONE and s.in_slot == NONE:
				errors.append("%s segment %d has neither an outer nor an inner end." % [e.label, si])
			if s.out_slot != NONE:
				if outs.has(s.out_slot):
					errors.append("%s: two segments share outer slot %d (the path would be ambiguous)." % [e.label, s.out_slot])
				outs[s.out_slot] = true
		if e.is_hub:
			if e.sockets.is_empty():
				errors.append("The hub needs at least one socket.")
			for s in e.sockets:
				if s < 0 or s >= e.positions:
					errors.append("Hub socket %d out of range." % s)
		elif not e.segments.any(func(s): return s.is_through()):
			errors.append("%s has no through-segment; the chain could never cross it." % e.label)
	for c in couplings:
		if c.a == c.b:
			errors.append("Coupling '%s' links a ring to itself." % c.id)
		if c.ratio == 0:
			errors.append("Coupling '%s' has ratio 0." % c.id)
		if not c.one_way and absi(c.ratio) != 1:
			errors.append("Coupling '%s': two-way links must have ratio +1 or -1 (use one_way for larger ratios)." % c.id)
		if c.has_cam():
			var n := elements[c.cam_element].positions
			for t in c.cam_teeth:
				if t < 0 or t >= n:
					errors.append("Coupling '%s' cam tooth %d out of range." % [c.id, t])
	for m in milestones:
		if m.trigger_type == "segment_linked":
			if m.element == NONE or m.segment < 0 or m.segment >= elements[m.element].segments.size():
				errors.append("Milestone '%s' references a missing ring segment." % m.id)
	if not elements.is_empty() and not elements[hub_index()].manual:
		var driven := couplings.any(func(c): return c.b == hub_index() or (not c.one_way and c.a == hub_index()))
		if not driven:
			warnings.append("The hub is fixed (not manual and not driven). Make sure the chain offsets add up.")
