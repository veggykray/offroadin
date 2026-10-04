class_name HumanZooThoughtBoard
extends Control
## Bill's folded card of scribbles. Not a quest log: it only shows what Bill
## has picked up, how the pieces connect, and a "?" where a thread is still
## loose. Undiscovered nodes and connections are never drawn.
##   solid line   = confirmed connection
##   dotted line  = suspected / unconfirmed
##   crossed line = debunked (e.g. Sully's version of the sequence)

var db: HumanZooDatabase
var state: HumanZooState
var progress: HumanZooProgress

const INK := Color(0.18, 0.15, 0.13)
const PENCIL_RED := Color(0.65, 0.18, 0.12)
const FADED := Color(0.45, 0.4, 0.35)

var _font: Font


func _ready() -> void:
	_font = ThemeDB.fallback_font
	mouse_filter = Control.MOUSE_FILTER_STOP


func setup(database: HumanZooDatabase, game_state: HumanZooState, prog: HumanZooProgress) -> void:
	db = database
	state = game_state
	progress = prog


func _draw() -> void:
	if db == null:
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.55))
	var card := Rect2(size.x * 0.5 - 820, size.y * 0.5 - 450, 1640, 900)
	draw_set_transform(card.get_center(), -0.012, Vector2.ONE)
	var r := Rect2(-card.size * 0.5, card.size)
	draw_rect(Rect2(r.position + Vector2(10, 12), r.size), Color(0, 0, 0, 0.4))
	draw_rect(r, Color(0.94, 0.9, 0.79))
	# Fold, coffee ring, ruled lines
	draw_line(Vector2(0, r.position.y), Vector2(0, r.end.y), Color(0.8, 0.75, 0.62), 3.0)
	for i in 22:
		var y := r.position.y + 90 + i * 37.0
		draw_line(Vector2(r.position.x + 20, y), Vector2(r.end.x - 20, y), Color(0.55, 0.65, 0.8, 0.18), 1.0)
	draw_arc(Vector2(r.end.x - 150, r.position.y + 120), 62, 0, TAU, 40, Color(0.55, 0.35, 0.15, 0.18), 7.0)
	_text(Vector2(r.position.x + 40, r.position.y + 58), "THINGS I KNOW  (I THINK)", 34, INK)
	_text(Vector2(r.end.x - 360, r.position.y + 54), "TAB to put it away", 18, FADED)
	var positions := {}
	var cols: Array = db.ledger.get("columns", [])
	var col_w := (r.size.x - 80) / maxf(cols.size(), 1)
	for ci in cols.size():
		var col: Dictionary = cols[ci]
		var x := r.position.x + 40 + ci * col_w
		var y := r.position.y + 130
		var any := false
		for nid in col.get("nodes", []):
			if not state.has_fact(nid):
				continue
			if not any:
				_text(Vector2(x, y - 6), String(col.get("title", "")), 20, PENCIL_RED)
				y += 26
				any = true
			positions[nid] = Vector2(x, y)
			_draw_node(nid, Vector2(x, y), col_w - 30)
			y += 74
	_draw_links(positions)
	_draw_frontier(positions)
	_draw_wants(r)
	_draw_carrying(r)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _text(p: Vector2, t: String, size_px: int, col: Color, width := -1.0) -> void:
	draw_string(_font, p, t, HORIZONTAL_ALIGNMENT_LEFT, width, size_px, col)


func _draw_node(nid: String, p: Vector2, w: float) -> void:
	var td := db.topic(nid)
	if td == null:
		return
	var col := INK
	var text := td.ledger_text
	var claim := td.kind == "claim"
	var confirmed := claim and td.confirmed_when != null and HumanZooConditions.check(td.confirmed_when, state)
	var debunked := claim and progress.is_misleading(nid)
	if td.kind == "message" and state.consumed.has(nid):
		col = FADED
	if claim and not confirmed:
		text += " ?"
	var fs := 19
	while fs > 13 and _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + td.symbols.size() * 34 > w:
		fs -= 1
	_text(p, text, fs, col)
	var tw := _font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var sx := p.x + tw + 22
	for s in td.symbols:
		HumanZooSymbols.draw_symbol(self, s, Vector2(sx, p.y - 7), 26, col)
		sx += 32
	if debunked:
		draw_line(p + Vector2(-4, -7), Vector2(sx - 10, p.y - 7), PENCIL_RED, 3.0)
	elif claim and not confirmed:
		_dotted(p + Vector2(0, 6), Vector2(sx - 14, p.y + 6), col)
	elif confirmed:
		draw_line(p + Vector2(0, 6), Vector2(p.x + tw, p.y + 6), INK, 1.5)


func _draw_links(positions: Dictionary) -> void:
	for link in db.ledger.get("links", []):
		var a := String(link["from"])
		var b := String(link["to"])
		if not positions.has(a) or not positions.has(b):
			continue
		var pa: Vector2 = positions[a] + Vector2(10, 14)
		var pb: Vector2 = positions[b] + Vector2(10, -26)
		if absf(pa.x - pb.x) > 20:
			pa = positions[a] + Vector2(200, -8)
			pb = positions[b] + Vector2(-12, -8)
		if link.has("broken_when") and HumanZooConditions.check(link["broken_when"], state):
			_dotted(pa, pb, PENCIL_RED)
			var mid := (pa + pb) * 0.5
			draw_line(mid + Vector2(-7, -7), mid + Vector2(7, 7), PENCIL_RED, 2.5)
			draw_line(mid + Vector2(-7, 7), mid + Vector2(7, -7), PENCIL_RED, 2.5)
			continue
		var solid := true
		if link.has("solid_when"):
			solid = HumanZooConditions.check(link["solid_when"], state)
		else:
			for id in [a, b]:
				var td := db.topic(id)
				if td and td.kind == "claim" and not (td.confirmed_when != null and HumanZooConditions.check(td.confirmed_when, state)):
					solid = false
		if solid:
			draw_line(pa, pb, INK, 2.0, true)
			_arrow_head(pa, pb, INK)
		else:
			_dotted(pa, pb, INK)


func _draw_frontier(positions: Dictionary) -> void:
	var frontier: Dictionary = db.ledger.get("frontier", {})
	for nid in frontier.keys():
		if not positions.has(nid):
			continue
		var f: Dictionary = frontier[nid]
		if HumanZooConditions.check(f.get("when"), state) and not HumanZooConditions.check_until(f.get("until"), state):
			var p: Vector2 = positions[nid]
			_dotted(p + Vector2(10, 14), p + Vector2(10, 46), INK)
			_text(p + Vector2(2, 70), "?", 30, PENCIL_RED)


func _draw_wants(r: Rect2) -> void:
	var wants: Array = db.ledger.get("wants", [])
	var any := false
	for w in wants:
		if state.has_fact(w):
			any = true
	if not any and not state.has_fact("what_want"):
		return
	var y := r.end.y - 190
	_text(Vector2(r.position.x + 40, y), "WHAT THEY WANT", 22, PENCIL_RED)
	var slot_w := (r.size.x - 80) / maxf(wants.size(), 1)
	for i in wants.size():
		var x := r.position.x + 40 + i * slot_w
		var td := db.topic(wants[i])
		var who := String(wants[i]).trim_prefix("desire_")
		HumanZooSymbols.draw_emblem(self, who, Vector2(x + 20, y + 44), 30, INK)
		if state.has_fact(wants[i]) and td:
			var parts := td.ledger_text.split(":", false, 1)
			var line2 := parts[1].strip_edges() if parts.size() > 1 else td.ledger_text
			_text(Vector2(x + 44, y + 40), parts[0], 15, FADED)
			_text(Vector2(x, y + 76), line2, 16, INK, slot_w - 10)
		else:
			draw_line(Vector2(x, y + 80), Vector2(x + slot_w - 30, y + 80), FADED, 1.0)


func _draw_carrying(r: Rect2) -> void:
	var carrying: Array = []
	for t in state.topic_order:
		var td := db.topic(t)
		if td and td.kind == "message" and not state.consumed.has(t):
			carrying.append(td)
	if carrying.is_empty():
		return
	var x := r.end.x - 520
	var y := r.position.y + 100
	_text(Vector2(x, y), "CARRYING:", 18, PENCIL_RED)
	for td in carrying:
		y += 28
		var to_c := db.character(td.to_character)
		var to_name := to_c.display_name if to_c else "?"
		_text(Vector2(x, y), "-> " + to_name + ":  " + td.noun, 17, INK)


func _dotted(a: Vector2, b: Vector2, col: Color) -> void:
	var d := a.distance_to(b)
	var n := int(d / 10.0)
	for i in n:
		if i % 2 == 0:
			draw_line(a.lerp(b, float(i) / n), a.lerp(b, float(i + 1) / n), col, 2.0)


func _arrow_head(a: Vector2, b: Vector2, col: Color) -> void:
	var dir := (b - a).normalized()
	var perp := Vector2(-dir.y, dir.x)
	draw_colored_polygon(PackedVector2Array([b, b - dir * 10 + perp * 5, b - dir * 10 - perp * 5]), col)
