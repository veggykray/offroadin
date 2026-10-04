class_name LBTableLayout
extends RefCounted
## Where everything sits on the table. Positions are plane coords (x, z).
## Food is spread so that the closest pickings are cheap and the richest
## ones sit under the sharpest eyes. Tall pieces (flowers, cloches, cake
## stands, plate stack, teapots) cast "shadows" of safety, cutlery near the
## lanes is a ready-made distraction, cups punish clumsy hands.

# [kind, x, z, yaw_deg, extra]   extra "food:<type>" spawns food
static func items() -> Array:
	var K = LBTableObject.Kind
	return [
		# --- the guest's biscuit on the ornate centrepiece --------------------
		[K.BISCUIT_PLATE, 0.0, 0.0, 0.0, ""],
		[K.BISCUIT, 0.0, 0.0, 0.0, "food:guest"],
		# --- cover pieces ----------------------------------------------------
		[K.TEAPOT_SILVER, 0.22, -0.95, 0.0, "cheat_mirror"],
		[K.FLOWERS, -0.34, 1.3, 0.0, ""],
		[K.SERVING_DISH, 0.46, 1.7, 20.0, ""],
		[K.PLATE_STACK, 0.55, 3.25, 0.0, ""],
		[K.TEAPOT_CHINA, -0.55, 4.0, 180.0, ""],
		[K.CAKE_STAND, -0.36, 2.62, 0.0, ""],
		[K.CAKE_STAND, 0.3, -2.1, 0.0, ""],
		[K.FLOWERS, -0.55, -3.9, 0.0, ""],
		[K.SERVING_DISH, -0.45, -2.65, -15.0, ""],
		# --- candles ---------------------------------------------------------
		[K.CANDELABRA, 0.12, 2.78, 90.0, "lit"],
		[K.CANDELABRA, -0.05, -1.75, 90.0, "lit"],
		[K.CANDELABRA, 0.5, -4.35, 90.0, "lit"],
		[K.CANDLESTICK, -0.72, 0.75, 0.0, "lit"],
		[K.CANDLESTICK, 0.74, -1.25, 0.0, "lit"],
		[K.CANDLESTICK, 0.72, 4.35, 0.0, "lit"],
		[K.CANDLESTICK, -0.7, -3.3, 0.0, "lit"],
		# --- FOOD (nobody may touch it until the guest arrives) --------------
		# sandwiches near Bill: a gentle start
		[K.PLATTER, -0.3, 3.6, 10.0, ""],
		[K.BISCUIT, -0.4, 3.62, 0.0, "food:sandwich"],
		[K.BISCUIT, -0.25, 3.52, 0.0, "food:sandwich"],
		# tarts and an eclair beside the cloche
		[K.PLATTER, 0.4, 2.2, -10.0, ""],
		[K.BISCUIT, 0.32, 2.2, 0.0, "food:tart"],
		[K.BISCUIT, 0.48, 2.28, 0.0, "food:tart"],
		[K.BISCUIT, 0.44, 2.1, 0.0, "food:eclair"],
		# cake right under the Sleeper's and the Twitch's noses
		[K.PLATTER, -0.4, 0.55, 0.0, ""],
		[K.BISCUIT, -0.48, 0.55, 0.0, "food:cake"],
		[K.BISCUIT, -0.32, 0.6, 0.0, "food:cake"],
		[K.BISCUIT, -0.4, 0.45, 0.0, "food:biscuit"],
		# grapes in the teapot's reflection
		[K.PLATTER, 0.45, -0.5, 0.0, ""],
		[K.BISCUIT, 0.4, -0.5, 0.0, "food:grapes"],
		[K.BISCUIT, 0.52, -0.45, 0.0, "food:macaron"],
		[K.BISCUIT, 0.5, -0.58, 0.0, "food:macaron"],
		# the far platters: rich pickings, long trip home
		[K.PLATTER, -0.4, -1.3, 0.0, ""],
		[K.BISCUIT, -0.48, -1.28, 0.0, "food:eclair"],
		[K.BISCUIT, -0.32, -1.34, 0.0, "food:eclair"],
		[K.BISCUIT, -0.4, -1.2, 0.0, "food:macaron"],
		[K.PLATTER, 0.25, -3.2, 0.0, ""],
		[K.BISCUIT, 0.15, -3.2, 0.0, "food:sausage_roll"],
		[K.BISCUIT, 0.3, -3.12, 0.0, "food:sausage_roll"],
		[K.BISCUIT, 0.3, -3.28, 0.0, "food:cake"],
		[K.BISCUIT, 0.18, -3.3, 0.0, "food:biscuit"],
		[K.BISCUIT, -0.36, -1.4, 0.0, "food:tart"],
		# --- tea things -------------------------------------------------------
		[K.CUP, -0.04, 1.78, 0.0, ""],
		[K.CUP, 0.18, 0.62, 30.0, ""],
		[K.CUP, -0.12, -0.45, 0.0, ""],
		[K.CUP, 0.1, 3.9, 0.0, ""],
		[K.SUGAR_BOWL, -0.2, -0.75, 0.0, ""],
		[K.CREAM_JUG, 0.2, 0.35, 0.0, ""],
		[K.SALT, -0.6, 2.0, 0.0, ""],
		[K.SALT, -0.53, 2.06, 0.0, ""],
		[K.SPOON, 0.14, 1.42, 70.0, ""],
		[K.SPOON, -0.62, 1.7, 20.0, ""],
		[K.SPOON, 0.6, 2.75, -40.0, ""],
		[K.SPOON, -0.1, -1.0, 110.0, ""],
		[K.BOTTLE, 0.66, 0.3, 0.0, ""],
		[K.BOTTLE, -0.66, -1.75, 0.0, ""],
		[K.WINE_GLASS, 0.55, 0.62, 0.0, ""],
		[K.WINE_GLASS, -0.62, 1.05, 0.0, ""],
		[K.WINE_GLASS, -0.62, 3.3, 0.0, ""],
		# --- napkins (cover your hand!) -------------------------------------
		[K.NAPKIN, 0.42, 4.1, 0.0, ""],
		[K.NAPKIN, -0.72, 2.95, 30.0, ""],
		[K.NAPKIN, 0.78, -0.25, 0.0, "rival_napkin"],
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
	# the guest of honour's place at the head of the table (still empty)
	all.append([LBTableObject.Kind.DINNER_PLATE, 0.0, -4.95 + 0.1, 0.0, ""])
	for it in all:
		var extra: String = it[4]
		var o: LBTableObject
		if extra.begins_with("food:"):
			var f := LBBiscuit.new()
			f.setup(Vector2(it[1], it[2]), 1.0, false, extra.substr(5))
			f.home_pos = f.plane_pos
			o = f
		else:
			o = LBTableObject.new()
			o.configure(it[0], Vector2(it[1], it[2]), deg_to_rad(it[3]))
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
