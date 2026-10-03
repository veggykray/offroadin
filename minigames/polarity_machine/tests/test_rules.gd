extends SceneTree
## Headless tests for the Polarity Machine rules (scripts/plant_rules.gd).
##   godot --headless --path <project> --script res://minigames/polarity_machine/tests/test_rules.gd

const Rules := preload("res://minigames/polarity_machine/scripts/plant_rules.gd")

var _checks := 0
var _fails := 0


func _init() -> void:
	print("== Polarity Machine rule tests ==")
	_test_intended_solve()
	_test_four_good_switches_is_not_enough()
	_test_poor_growth_ails_and_recovers()
	_test_soil_physics()
	_test_harsh_conditions_and_warning()
	_test_partial_night_bud()
	_test_near_miss_fruit()
	_test_old_age_and_rewind()
	_test_tank()
	_test_lock_after_solve()
	print("== %d checks, %d failures ==" % [_checks, _fails])
	quit(1 if _fails > 0 else 0)


func check(c: bool, what: String) -> void:
	_checks += 1
	if not c:
		_fails += 1
		printerr("  FAIL: ", what)


func run(r, seconds: float) -> void:
	var t := 0.0
	while t < seconds and not r.is_solved:
		r.tick(0.05)
		t += 0.05


## Grows a healthy plant to FLOWERING the intended way. Returns the rules.
func grown_to_flowering():
	var r = Rules.new()
	r.spray(); r.spray()  # DRY -> MOIST
	r.set_light(Rules.Light.MEDIUM)
	r.set_temperature(Rules.Temp.COOL)
	r.step_stage(1)  # YOUNG, drinks -> DAMP
	r.spray()
	r.step_stage(1)  # MATURE
	r.spray()
	r.step_stage(1)  # FLOWERING
	return r


func _test_intended_solve() -> void:
	print("- intended solve")
	var r = Rules.new()
	var solved_count := [0]
	r.solved.connect(func(): solved_count[0] += 1)
	r.spray(); r.spray()
	check(r.water == Rules.Water.MOIST, "two sprays: moist")
	r.set_light(Rules.Light.MEDIUM)
	r.set_temperature(Rules.Temp.COOL)
	r.step_stage(1)
	check(r.stage == Rules.Stage.YOUNG and r.is_healthy(), "healthy growth to young")
	check(r.water == Rules.Water.DAMP, "growth drinks the soil")
	r.spray(); r.step_stage(1)
	r.spray(); r.step_stage(1)
	check(r.stage == Rules.Stage.FLOWERING and r.is_healthy(), "healthy at flowering")
	run(r, 1.0)
	check(r.bud > 0.0 and r.bud <= Rules.BUD_PARTIAL + 0.001, "cool day alone: a small bud (%.2f)" % r.bud)
	check(not r.flowered, "no flower without a full night")
	r.set_light(Rules.Light.LOW)
	run(r, Rules.BUD_TIME + 0.5)
	check(r.flowered, "a cool night opens the flower")
	run(r, 2.0)
	check(r.fruit == 0.0, "no fruit under night conditions")
	r.spray()  # DAMP -> MOIST
	r.set_light(Rules.Light.BRIGHT)
	r.set_temperature(Rules.Temp.WARM)
	run(r, Rules.FRUIT_TIME + 0.5)
	check(r.is_solved and r.fruit >= 1.0, "moist + bright + warm sets the fruit: %s" % r.describe())
	check(solved_count[0] == 1, "solved emitted once")


func _test_four_good_switches_is_not_enough() -> void:
	print("- setting the 'good' values everywhere does not solve it")
	var r = Rules.new()
	r.spray(); r.spray()
	r.set_light(Rules.Light.BRIGHT)
	r.set_temperature(Rules.Temp.WARM)
	for i in 3:
		r.step_stage(1)
		r.spray()
	run(r, 30.0)
	check(r.stage == Rules.Stage.FLOWERING and r.is_healthy(), "healthy flowering plant")
	check(not r.flowered and r.fruit == 0.0, "no flower and no fruit in endless day: %s" % r.describe())


func _test_poor_growth_ails_and_recovers() -> void:
	print("- poor growth ails, nursing recovers")
	var r = Rules.new()
	r.set_light(Rules.Light.MEDIUM)
	r.set_temperature(Rules.Temp.COOL)
	r.step_stage(1)  # dry soil
	check(r.stage == Rules.Stage.YOUNG and r.ailment == "dry", "grown dry: ailing dry (%s)" % r.ailment)
	r.spray(); r.spray()
	run(r, Rules.RECOVER_TIME + 0.3)
	check(r.is_healthy(), "recovers after nursing in good conditions")
	var r2 = Rules.new()
	r2.spray(); r2.spray()
	r2.set_temperature(Rules.Temp.WARM)
	r2.set_light(Rules.Light.LOW)
	r2.step_stage(1)
	check(r2.ailment == "leggy", "grown in low light: leggy")
	# Advancing under good conditions also heals it (a healthy growth spurt).
	r2.spray()
	r2.set_light(Rules.Light.BRIGHT)
	r2.step_stage(1)
	check(r2.is_healthy(), "a good growth spurt heals")
	# An ailing plant cannot bud.
	var r3 = grown_to_flowering()
	r3.set_temperature(Rules.Temp.HOT)
	run(r3, Rules.HARM_TIME + 0.3)
	check(r3.ailment == "scorch", "sustained heat scorches")
	r3.set_temperature(Rules.Temp.COOL)
	r3.set_light(Rules.Light.LOW)
	run(r3, 2.0)
	check(r3.bud == 0.0, "ailing plant forms no buds")


func _test_soil_physics() -> void:
	print("- soil physics")
	var r = Rules.new()
	for i in 4:
		r.spray()
	check(r.water == Rules.Water.WATERLOGGED, "four sprays: waterlogged")
	r.spray()
	check(r.water == Rules.Water.WATERLOGGED, "cannot go past waterlogged")
	run(r, Rules.DRAIN_TIME + 0.2)
	check(r.water == Rules.Water.WET, "waterlogged drains to wet")
	r.set_temperature(Rules.Temp.HOT)
	run(r, Rules.HOT_DRY_TIME + 0.2)
	check(r.water == Rules.Water.MOIST, "heat dries the soil")
	r.set_temperature(Rules.Temp.COOL)
	run(r, 60.0)
	check(r.water == Rules.Water.MOIST, "cool air does not dry it")


func _test_harsh_conditions_and_warning() -> void:
	print("- harsh conditions warn, then harm")
	var r0 = Rules.new()
	r0.set_temperature(Rules.Temp.COLD)
	run(r0, Rules.HARM_TIME * 3.0)
	check(r0.is_healthy() and r0.harm == 0.0, "a dormant seedling is not harmed")
	var r = Rules.new()
	r.spray(); r.spray()
	r.set_light(Rules.Light.MEDIUM)
	r.set_temperature(Rules.Temp.WARM)
	r.step_stage(1)
	r.set_temperature(Rules.Temp.COLD)
	run(r, Rules.HARM_TIME * 0.5)
	check(r.harm > 0.3 and r.is_healthy(), "harm builds before damage")
	r.set_temperature(Rules.Temp.WARM)
	run(r, 1.0)
	check(r.harm < 0.4, "harm recedes when fixed")
	r.set_temperature(Rules.Temp.COLD)
	run(r, Rules.HARM_TIME + 0.2)
	check(r.ailment == "frost", "sustained cold: frost")


func _test_partial_night_bud() -> void:
	print("- partial night")
	var r = grown_to_flowering()
	r.set_temperature(Rules.Temp.WARM)
	r.set_light(Rules.Light.LOW)
	run(r, 4.0)
	check(not r.flowered and absf(r.bud - Rules.BUD_PARTIAL) < 0.01, "dim but warm: small bud only")
	r.set_light(Rules.Light.BRIGHT)
	run(r, 10.0)
	check(r.bud == 0.0, "bud shrinks back in full day")


func _test_near_miss_fruit() -> void:
	print("- near-miss fruiting")
	var r = grown_to_flowering()
	r.set_light(Rules.Light.LOW)
	run(r, Rules.BUD_TIME + 0.5)
	check(r.flowered, "flowered")
	r.spray(); r.spray()  # WET
	r.set_light(Rules.Light.BRIGHT)
	r.set_temperature(Rules.Temp.COOL)
	run(r, 6.0)
	check(r.fruit == 0.0 and not r.is_solved, "wet + cool: no fruit")
	r.set_light(Rules.Light.MEDIUM)
	r.set_temperature(Rules.Temp.WARM)
	run(r, 6.0)
	check(not r.is_solved, "medium light: no fruit")
	r.set_light(Rules.Light.BRIGHT)
	run(r, 6.0)
	check(not r.is_solved, "wet soil: no fruit")
	run(r, Rules.WARM_DRY_TIME + Rules.FRUIT_TIME + 1.0)
	check(r.is_solved, "warm air dries wet soil to moist, then the fruit sets (%s)" % r.describe())


func _test_old_age_and_rewind() -> void:
	print("- old age and rewinding")
	var r = grown_to_flowering()
	r.set_light(Rules.Light.LOW)
	run(r, Rules.BUD_TIME + 0.5)
	r.step_stage(1)
	check(r.stage == Rules.Stage.OLD, "old")
	r.spray()
	r.set_light(Rules.Light.BRIGHT)
	r.set_temperature(Rules.Temp.WARM)
	run(r, 10.0)
	check(not r.is_solved, "an old plant does not fruit")
	r.step_stage(-1)
	check(r.flowered, "rewinding to flowering keeps the flower")
	run(r, Rules.FRUIT_TIME + 0.5)
	check(r.is_solved, "then it fruits")
	var r2 = grown_to_flowering()
	r2.set_light(Rules.Light.LOW)
	run(r2, Rules.BUD_TIME + 0.5)
	r2.step_stage(-1)
	check(not r2.flowered and r2.bud == 0.0, "rewinding below flowering undoes the bloom")
	for i in 5:
		r2.step_stage(-1)
	check(r2.stage == Rules.Stage.SEEDLING, "can rewind to a seedling")


func _test_tank() -> void:
	print("- reservoir")
	var r = Rules.new()
	var fails := [0]
	r.spray_failed.connect(func(): fails[0] += 1)
	for i in Rules.TANK_CAPACITY:
		check(r.spray(), "spray %d" % i)
	check(not r.spray() and fails[0] == 1, "empty tank sputters")
	run(r, Rules.TANK_REFILL_TIME + 0.1)
	check(r.tank == 1, "tank refills")


func _test_lock_after_solve() -> void:
	print("- locked after solving")
	var r = grown_to_flowering()
	var n := [0]
	r.solved.connect(func(): n[0] += 1)
	r.set_light(Rules.Light.LOW)
	run(r, Rules.BUD_TIME + 0.5)
	r.spray()
	r.set_light(Rules.Light.BRIGHT)
	r.set_temperature(Rules.Temp.WARM)
	run(r, Rules.FRUIT_TIME + 0.5)
	check(r.is_solved, "solved")
	check(not r.spray() and not r.set_light(0) and not r.step_stage(1), "actions ignored after solving")
	run(r, 20.0)
	check(n[0] == 1 and r.fruit >= 1.0, "stays solved, emitted once")
	r.reset()
	check(not r.is_solved and r.stage == Rules.Stage.SEEDLING, "reset")
