class_name LBTableWorld
extends Node3D
## Lightweight, fully controllable table-top physics on the table plane:
## circles with mass, friction and restitution. Hands shove objects, objects
## knock into each other, everything reports impacts as NOISE.
## Also answers line-of-sight questions for the gaze system (tall objects hide
## hands that are close behind them).

## Emitted for every audible collision. source = the LBHand to blame (or null).
signal impact(pos: Vector2, loudness: float, source: LBHand, obj: LBTableObject, kind: String)
signal biscuit_hit_hard(b: LBBiscuit, speed: float)

@export var restitution := 0.3
## Loudness per m/s of closing speed.
@export var impact_noise_scale := 0.5
@export var min_impact_speed := 0.14
## Objects launched faster than this over the edge fall off and smash.
@export var fall_off_speed := 1.5
## Hands moving faster than this past cups make a faint swish / tinkle.
@export var swish_speed := 1.7
@export var swish_radius := 0.15
@export var hand_bounds_margin := 0.04

var objects: Array[LBTableObject] = []
var hands: Array[LBHand] = []
var _prev_pos := {}


func add_object(o: LBTableObject) -> LBTableObject:
	o.world = self
	objects.append(o)
	add_child(o)
	return o


func remove_object(o: LBTableObject) -> void:
	objects.erase(o)
	if o.is_inside_tree():
		o.queue_free()


func add_hand(h: LBHand) -> void:
	h.world = self
	hands.append(h)


static func is_surface(o: LBTableObject) -> bool:
	return o.kind == LBTableObject.Kind.DINNER_PLATE or o.kind == LBTableObject.Kind.BISCUIT_PLATE \
			or o.kind == LBTableObject.Kind.NAPKIN


static func is_small_flat(o: LBTableObject) -> bool:
	return o.is_biscuit() or o.kind == LBTableObject.Kind.SUGAR_CUBE or o.kind == LBTableObject.Kind.FORK \
			or o.kind == LBTableObject.Kind.KNIFE or o.kind == LBTableObject.Kind.SPOON


func step(dt: float) -> void:
	_move_objects(dt)
	_carry_riders()
	for _i in 2:
		_object_collisions()
		_hand_object_collisions()
		_hand_hand_collisions()
	_bounds()
	_swish(dt)


func _move_objects(dt: float) -> void:
	for o in objects:
		_prev_pos[o] = o.plane_pos
		if not o.on_table:
			continue
		var holder := o.held_by as LBHand
		if holder != null:
			var target := holder.plane_pos
			if o is LBBiscuit and (o as LBBiscuit).holders.size() >= 2:
				var b := o as LBBiscuit
				target = Vector2.ZERO
				for h in b.holders:
					target += (h as LBHand).plane_pos
				target /= b.holders.size()
			if holder.cover == o:
				target = holder.plane_pos
				o.lift = holder.height_above_table() + 0.035
			else:
				# held items sit just under the curled fingers
				var fwd := (holder.plane_pos - LBConst.w2p(holder.shoulder)).normalized()
				target += fwd * 0.05
				o.lift = maxf(holder.height_above_table() - 0.02, 0.012)
			o.vel = (target - o.plane_pos) / maxf(dt, 0.0001)
			o.plane_pos = target
			# dragging a plate or pot across the polish scrapes audibly
			if o.mass >= 0.5 and o.vel.length() > 0.7 and holder.cover != o:
				var now := Time.get_ticks_msec() * 0.001
				if now - o.last_noise_t > 0.35:
					o.last_noise_t = now
					impact.emit(o.plane_pos, 0.1 + o.vel.length() * 0.08, holder, o, "clink")
			continue
		o.plane_pos += o.vel * dt
		o.vel *= exp(-o.friction * dt)
		if o.vel.length() < 0.01:
			o.vel = Vector2.ZERO


## Small things resting on a moving plate travel with it.
func _carry_riders() -> void:
	for p in objects:
		if not is_surface(p) or not p.on_table or p.kind == LBTableObject.Kind.NAPKIN:
			continue
		var delta: Vector2 = p.plane_pos - _prev_pos.get(p, p.plane_pos)
		if delta.length() < 0.00001:
			continue
		for o in objects:
			if o == p or o.held_by != null or not is_small_flat(o) or not o.on_table:
				continue
			var prev: Vector2 = _prev_pos.get(o, o.plane_pos)
			if prev.distance_to(_prev_pos.get(p, p.plane_pos)) < p.radius * 0.8:
				o.plane_pos += delta


func _collides(a: LBTableObject, b: LBTableObject) -> bool:
	if not a.on_table or not b.on_table:
		return false
	if is_surface(a) or is_surface(b):
		return false
	if a.held_by != null and a.held_by == b.held_by:
		return false
	if is_small_flat(a) and is_small_flat(b) and not (a.is_biscuit() and b.is_biscuit()):
		return false
	return true


func _object_collisions() -> void:
	var n := objects.size()
	for i in n:
		var a := objects[i]
		for j in range(i + 1, n):
			var b := objects[j]
			if not _collides(a, b):
				continue
			var d := b.plane_pos - a.plane_pos
			var min_d := a.radius + b.radius
			var dist2 := d.length_squared()
			if dist2 >= min_d * min_d:
				continue
			var dist := sqrt(dist2)
			var nrm := d / dist if dist > 0.0001 else Vector2.RIGHT
			var pen := min_d - dist
			# held objects behave as kinematic
			var ia := 0.0 if a.held_by != null else 1.0 / a.mass
			var ib := 0.0 if b.held_by != null else 1.0 / b.mass
			if ia + ib <= 0.0:
				continue
			a.plane_pos -= nrm * pen * ia / (ia + ib)
			b.plane_pos += nrm * pen * ib / (ia + ib)
			var rel := (a.vel - b.vel).dot(nrm)
			if rel > 0.0:
				var j_imp := rel * (1.0 + restitution) / (ia + ib)
				a.vel -= nrm * j_imp * ia
				b.vel += nrm * j_imp * ib
				var blame := _blame(a, b)
				var hard := b if b.mass >= a.mass else a
				_report(a.plane_pos + nrm * a.radius, rel, hard, blame, (a.noise_factor + b.noise_factor) * 0.5)
				a.bump(-nrm, rel * 0.25)
				b.bump(nrm, rel * 0.25)
				for pair in [[a, b], [b, a]]:
					var bis: LBTableObject = pair[0]
					var other: LBTableObject = pair[1]
					if bis is LBBiscuit and other.mass > 0.25 and not other.is_biscuit() and rel > (bis as LBBiscuit).break_impact_speed:
						biscuit_hit_hard.emit(bis, rel)


func _blame(a: LBTableObject, b: LBTableObject) -> LBHand:
	if a.held_by is LBHand:
		return a.held_by
	if b.held_by is LBHand:
		return b.held_by
	var la: LBHand = a.toucher()
	var lb: LBHand = b.toucher()
	return la if la != null else lb


func _hand_object_collisions() -> void:
	for h in hands:
		if not h.active or h.reach_scale < 0.95:
			continue
		for o in objects:
			if not o.on_table or not o.hand_collides or o.held_by != null or o == h.held:
				continue
			if h.lift > o.height + 0.08:
				continue
			var d := o.plane_pos - h.plane_pos
			var min_d := o.radius + h.radius * 0.85
			var dist2 := d.length_squared()
			if dist2 >= min_d * min_d:
				continue
			var dist := sqrt(dist2)
			var nrm := d / dist if dist > 0.0001 else (h.vel.normalized() if h.vel.length() > 0.001 else Vector2.UP)
			var pen := min_d - dist
			var mh := h.push_mass
			var mo := o.mass
			o.plane_pos += nrm * pen * mh / (mh + mo)
			h.plane_pos -= nrm * pen * mo / (mh + mo)
			var rel := (h.vel - o.vel).dot(nrm)
			o.set_meta("last_toucher", h)
			if rel > 0.0:
				var j_imp := rel * (1.0 + restitution) / (1.0 / mh + 1.0 / mo)
				o.vel += nrm * j_imp / mo
				h.vel -= nrm * j_imp / mh
				_report(o.plane_pos - nrm * o.radius, rel, o, h, o.noise_factor)
				o.bump(nrm, rel * 0.35)


func _hand_hand_collisions() -> void:
	var n := hands.size()
	for i in n:
		var a := hands[i]
		if not a.active or a.reach_scale < 0.95:
			continue
		for j in range(i + 1, n):
			var b := hands[j]
			if not b.active or b.reach_scale < 0.95:
				continue
			if a.pinning == b or b.pinning == a:
				continue
			var d := b.plane_pos - a.plane_pos
			var min_d := (a.radius + b.radius) * 0.8
			if d.length_squared() >= min_d * min_d:
				continue
			var dist := d.length()
			var nrm := d / dist if dist > 0.0001 else Vector2.RIGHT
			var pen := min_d - dist
			var wa := b.push_mass / (a.push_mass + b.push_mass)
			a.plane_pos -= nrm * pen * wa
			b.plane_pos += nrm * pen * (1.0 - wa)
			var rel := (a.vel - b.vel).dot(nrm)
			if rel > 0.0:
				a.vel -= nrm * rel * wa
				b.vel += nrm * rel * (1.0 - wa)


func _bounds() -> void:
	var hw := LBConst.TABLE_HALF_W
	var hl := LBConst.TABLE_HALF_L
	for o in objects:
		if not o.on_table or o.held_by != null:
			continue
		var lim_x := hw - o.radius * 0.5
		var lim_z := LBConst.TABLE_DRAW_HALF_L - o.radius
		if absf(o.plane_pos.x) > lim_x:
			var spd := absf(o.vel.x)
			if spd > fall_off_speed and not o.is_biscuit() and not is_surface(o):
				o.fall_off()
				_report(o.plane_pos, 2.5, o, o.toucher(), 1.0, "smash")
				continue
			o.plane_pos.x = signf(o.plane_pos.x) * lim_x
			o.vel.x = -o.vel.x * 0.3
		if absf(o.plane_pos.y) > lim_z:
			o.plane_pos.y = signf(o.plane_pos.y) * lim_z
			o.vel.y = -o.vel.y * 0.3
	for h in hands:
		if not h.active or h.reach_scale < 0.95:
			continue
		var mx := hw - hand_bounds_margin
		if h.plane_pos.x > mx:
			h.plane_pos.x = mx
			h.vel.x = minf(h.vel.x, 0.0)
		elif h.plane_pos.x < -mx:
			h.plane_pos.x = -mx
			h.vel.x = maxf(h.vel.x, 0.0)
		var top := hl + 0.12
		if h.plane_pos.y > top:
			h.plane_pos.y = top
			h.vel.y = minf(h.vel.y, 0.0)
		elif h.plane_pos.y < -hl:
			h.plane_pos.y = -hl
			h.vel.y = maxf(h.vel.y, 0.0)


func _swish(_dt: float) -> void:
	var now := Time.get_ticks_msec() * 0.001
	for h in hands:
		if not h.active or h.speed() < swish_speed:
			continue
		for o in objects:
			if not o.on_table or not o.hand_collides or o.held_by != null:
				continue
			if o.kind != LBTableObject.Kind.CUP and o.kind != LBTableObject.Kind.WINE_GLASS \
					and o.kind != LBTableObject.Kind.SPOON and o.kind != LBTableObject.Kind.BOTTLE:
				continue
			if o.plane_pos.distance_to(h.plane_pos) < swish_radius + o.radius and now - o.last_noise_t > 0.6:
				o.last_noise_t = now
				o.bump(h.vel, 0.04)
				impact.emit(o.plane_pos, 0.16, h, o, "swish")


func _report(pos: Vector2, rel_speed: float, obj: LBTableObject, src: LBHand, factor: float, kind := "") -> void:
	if rel_speed < min_impact_speed:
		return
	var loud := (rel_speed - min_impact_speed * 0.5) * impact_noise_scale * factor
	if kind == "smash":
		loud = 1.4
	if loud < 0.03:
		return
	var now := Time.get_ticks_msec() * 0.001
	if now - obj.last_noise_t < 0.09 and kind != "smash":
		return
	obj.last_noise_t = now
	impact.emit(pos, loud, src, obj, kind if kind != "" else obj.sound)


func object_landed(o: LBTableObject, speed: float) -> void:
	_report(o.plane_pos, speed, o, o.toucher(), o.noise_factor * 0.5)


## True if a tall object hides `target` from an eye at `eye` (plane) and
## height `eye_h` above the table.
func sight_blocked(eye: Vector2, eye_h: float, target: Vector2, target_h: float, ignore: Object = null) -> bool:
	var seg := eye - target
	var L := seg.length()
	if L < 0.001:
		return false
	var dir := seg / L
	for o in objects:
		if not o.occludes or not o.on_table or o == ignore:
			continue
		var to := o.plane_pos - target
		var u := clampf(to.dot(dir), 0.0, L)
		var closest := target + dir * u
		if closest.distance_squared_to(o.plane_pos) < (o.radius * 0.95) * (o.radius * 0.95):
			var line_h := target_h + (eye_h - target_h) * (u / L)
			if line_h < o.height + o.lift:
				return true
	return false


func nearest_grabbable(p: Vector2, r: float, exclude: Object = null) -> LBTableObject:
	var best: LBTableObject = null
	var best_score := INF
	for o in objects:
		if not o.grabbable or not o.on_table or o == exclude:
			continue
		var d := o.plane_pos.distance_to(p)
		if d > r + o.radius * 0.5:
			continue
		var score := d
		if o.is_biscuit():
			score -= 0.2           # biscuits win ties: that's why we're here
		if o.kind == LBTableObject.Kind.BISCUIT_PLATE:
			score += 0.08          # grabbing the plate only when clearly aiming for it
		if score < best_score:
			best_score = score
			best = o
	return best


func biscuits() -> Array[LBBiscuit]:
	var out: Array[LBBiscuit] = []
	for o in objects:
		if o is LBBiscuit and o.on_table:
			out.append(o)
	return out


func find_kind(k: LBTableObject.Kind) -> Array[LBTableObject]:
	var out: Array[LBTableObject] = []
	for o in objects:
		if o.kind == k and o.on_table:
			out.append(o)
	return out
