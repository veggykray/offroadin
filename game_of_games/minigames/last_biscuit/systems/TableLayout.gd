class_name LBTableLayout
extends RefCounted
## Where everything sits on the table. Positions are plane coords (x, z).
## Designed around the diners' sight lines: tall pieces (flowers, cloche,
## plate stack, teapots) cast "shadows" of safety, cutlery near the lanes is
## a ready-made distraction, cups near the centre punish clumsy hands.

# [kind, x, z, yaw_deg, extra]
static func items() -> Array:
	var K = LBTableObject.Kind
	return [
		# --- the prize -------------------------------------------------------
		[K.BISCUIT_PLATE, 0.0, 0.0, 0.0, ""],
		# --- cover pieces ----------------------------------------------------
		[K.TEAPOT_SILVER, 0.36, -0.82, 0.0, "cheat_mirror"],
		[K.FLOWERS, -0.34, 1.3, 0.0, ""],
		[K.SERVING_DISH, 0.4, 1.95, 20.0, ""],
		[K.PLATE_STACK, -0.46, 3.25, 0.0, ""],
		[K.TEAPOT_CHINA, 0.48, 3.55, 180.0, ""],
		[K.FLOWERS, 0.0, -3.6, 0.0, ""],
		[K.SERVING_DISH, -0.3, -2.2, -15.0, ""],
		[K.SERVING_DISH, -0.36, 2.62, 10.0, ""],
		# --- candles ---------------------------------------------------------
		[K.CANDELABRA, 0.12, 2.78, 90.0, "lit"],
		[K.CANDELABRA, 0.0, -2.35, 90.0, "lit"],
		[K.CANDELABRA, 0.0, -4.5, 90.0, "lit"],
		[K.CANDLESTICK, -0.72, 0.75, 0.0, "lit"],
		[K.CANDLESTICK, 0.74, -1.55, 0.0, ""],
		[K.CANDLESTICK, 0.7, 4.3, 0.0, "lit"],
		[K.CANDLESTICK, -0.7, -3.3, 0.0, ""],
		# --- tea things near the lanes ----------------------------------------
		[K.CUP, -0.04, 1.78, 0.0, ""],
		[K.CUP, -0.18, 0.62, 30.0, ""],
		[K.CUP, 0.27, -0.38, 0.0, ""],
		[K.CUP, -0.12, 3.85, 0.0, ""],
		[K.CUP, 0.62, 0.95, 0.0, ""],
		[K.SUGAR_BOWL, -0.26, -0.42, 0.0, ""],
		[K.CREAM_JUG, 0.18, 0.4, 0.0, ""],
		[K.SALT, -0.55, 2.0, 0.0, ""],
		[K.SALT, -0.48, 2.06, 0.0, ""],
		[K.SPOON, 0.14, 1.42, 70.0, ""],
		[K.SPOON, -0.62, 1.7, 20.0, ""],
		[K.SPOON, 0.58, 2.7, -40.0, ""],
		[K.SPOON, -0.4, -0.9, 110.0, ""],
		[K.BOTTLE, 0.64, 0.3, 0.0, ""],
		[K.BOTTLE, -0.66, -1.45, 0.0, ""],
		[K.WINE_GLASS, 0.52, 0.55, 0.0, ""],
		[K.WINE_GLASS, -0.55, 1.05, 0.0, ""],
		[K.WINE_GLASS, -0.5, 3.7, 0.0, ""],
		# --- napkins (cover your hand!) -------------------------------------
		[K.NAPKIN, 0.42, 4.1, 0.0, ""],
		[K.NAPKIN, -0.7, 3.0, 30.0, ""],
		[K.NAPKIN, 0.78, -0.3, 0.0, "rival_napkin"],
	]


## Place setting in front of a diner (plane coords of the seat).
static func place_setting(seat: Vector2) -> Array:
	var K = LBTableObject.Kind
	var s := signf(seat.x)
	var x := seat.x - s * 0.78
	return [
		[K.DINNER_PLATE, x, seat.y, 0.0, ""],
		[K.FORK, x, seat.y + 0.2 * -s, 90.0, ""],
		[K.KNIFE, x, seat.y - 0.2 * -s, 90.0, ""],
		[K.SPOON, x - s * 0.02, seat.y - 0.26 * -s, 90.0, ""],
		[K.CUP, x - s * 0.08, seat.y - 0.33 * -s, 0.0, ""],
		[K.WINE_GLASS, x - s * 0.18, seat.y - 0.18 * -s, 0.0, ""],
	]


static func spawn(world: LBTableWorld, seats: Array) -> Dictionary:
	var out := {"plate": null, "cheat_teapot": null, "rival_napkin": null}
	var all: Array = items()
	for seat in seats:
		all.append_array(place_setting(seat))
	# empty places at the far end: nobody has sat there for decades
	for z in [-4.3]:
		for s in [-1.0, 1.0]:
			all.append_array(place_setting(Vector2(LBConst.SEAT_X * s, z)))
	for it in all:
		var o := LBTableObject.new()
		o.configure(it[0], Vector2(it[1], it[2]), deg_to_rad(it[3]))
		var extra: String = it[4]
		if extra == "lit":
			o.set_meta("lit", true)
		world.add_object(o)
		if it[0] == LBTableObject.Kind.BISCUIT_PLATE:
			out["plate"] = o
		if extra == "cheat_mirror":
			out["cheat_teapot"] = o
		if extra == "rival_napkin":
			out["rival_napkin"] = o
	return out
