extends RefCounted
## THE PUZZLE RULES — every tunable value lives at the top of this file.
##
## Pure logic: no nodes, no drawing. The root scene owns one instance, feeds it
## player actions (spray, set_light, set_temperature, set_stage) and calls
## tick(dt) every frame. Presentation reacts to the signals and reads the
## public state. Tests drive it headlessly.
##
## HOW THE PLANT BEHAVES (the intended discovery path)
##  1. GROWING. Turning the age dial forward grows the plant one stage. The
##     conditions AT THAT MOMENT decide whether it grows healthy:
##       soil MOIST or WET, light MEDIUM or BRIGHT, temperature COOL or WARM.
##     Anything else and it grows sickly (an "ailment" it shows visibly).
##     Every growth spurt drinks one step of soil moisture, so the player has
##     to water again between stages.
##     A SEEDLING is dormant: harsh conditions show on it but do not harm it.
##  2. AILING IS NEVER PERMANENT. A sickly plant kept in good growing
##     conditions for RECOVER_TIME seconds heals. Harsh conditions (bone dry,
##     waterlogged, pitch dark, frost, scorching heat) held for HARM_TIME
##     seconds make a healthy plant ail. The orange lamp blinks as a warning.
##  3. FLOWERING NEEDS A NIGHT. A healthy plant at the FLOWERING age only
##     forms buds when it gets a "cool night": lamp LOW or off AND the air
##     COOL or COLD. Half a night (just one of the two) swells a small bud,
##     which is the "you're close" clue. A full night opens the flower.
##  4. FRUIT NEEDS THE DAY BACK, EXACTLY. An open flower turns into fruit
##     only while the soil is MOIST, the lamp BRIGHT and the air WARM, held
##     for FRUIT_TIME seconds. Two of the three right makes the flower's heart
##     glow (another "close" clue) but nothing more.
##  5. OLD AGE withers the flowers. Turning the dial back is always allowed:
##     a plant can be rewound and regrown.
##
## Soil physics: hot air dries the soil (one step per HOT_DRY_TIME), warm air
## slowly too (WARM_DRY_TIME). Waterlogged soil drains back to wet after
## DRAIN_TIME. The reservoir holds TANK_CAPACITY sprays and refills slowly.

signal sprayed(new_water: int)
signal spray_failed()
signal grew(stage: int, healthy: bool)
signal ailment_started(ailment: String)
signal recovered()
signal bud_changed(stage_name: String)  # "bud", "flower"
signal fruit_started()
signal solved()
signal soil_changed(new_water: int, reason: String)  # "evaporated", "drained", "drunk"
signal tank_refilled(sprays_left: int)

enum Water { DRY, DAMP, MOIST, WET, WATERLOGGED }
enum Light { DARK, LOW, MEDIUM, BRIGHT }
enum Temp { COLD, COOL, WARM, HOT }
enum Stage { SEEDLING, YOUNG, MATURE, FLOWERING, OLD }

const WATER_NAMES := ["Dry", "Damp", "Moist", "Wet", "Waterlogged"]
const LIGHT_NAMES := ["Dark", "Low", "Medium", "Bright"]
const TEMP_NAMES := ["Cold", "Cool", "Warm", "Hot"]
const STAGE_NAMES := ["Seedling", "Young", "Mature", "Flowering", "Old"]

# =============================================================================
# TUNING
# =============================================================================

## Starting state (also used by reset).
const START_WATER := Water.DRY
const START_LIGHT := Light.LOW
const START_TEMP := Temp.COOL
const START_STAGE := Stage.SEEDLING

## Conditions for a healthy growth spurt (age dial forward into YOUNG,
## MATURE or FLOWERING), and for an ailing plant to recover.
const GROW_WATER := [Water.MOIST, Water.WET]
const GROW_LIGHT := [Light.MEDIUM, Light.BRIGHT]
const GROW_TEMP := [Temp.COOL, Temp.WARM]
## Soil steps the plant drinks on each growth spurt.
const DRINK_PER_GROWTH := 1

## Harsh conditions that make a healthy plant ail if they last HARM_TIME.
const HARM_WATER := [Water.DRY, Water.WATERLOGGED]
const HARM_LIGHT := [Light.DARK]
const HARM_TEMP := [Temp.COLD, Temp.HOT]
const HARM_TIME := 7.0
## Seconds of good growing conditions that heal an ailing plant.
const RECOVER_TIME := 5.0

## The flowering cue ("a cool night"), only at Stage.FLOWERING.
const NIGHT_LIGHT := [Light.DARK, Light.LOW]
const NIGHT_TEMP := [Temp.COLD, Temp.COOL]
## Bud size with half a night (one cue) / a full night (both cues).
const BUD_PARTIAL := 0.4
## Seconds of full night to go from nothing to an open flower.
const BUD_TIME := 3.0

## The exact fruiting conditions, once the flower is open.
const FRUIT_WATER := Water.MOIST
const FRUIT_LIGHT := Light.BRIGHT
const FRUIT_TEMP := Temp.WARM
const FRUIT_TIME := 4.0
## How fast an interrupted fruit shrinks back (per second, fraction).
const FRUIT_DECAY_RATE := 0.12

## Reservoir.
const TANK_CAPACITY := 14
const TANK_REFILL_TIME := 8.0
## Soil drying / draining (seconds per step).
const HOT_DRY_TIME := 5.0
const WARM_DRY_TIME := 25.0
const DRAIN_TIME := 10.0

# =============================================================================
# STATE (read by the presentation)
# =============================================================================

var water: int = START_WATER
var light: int = START_LIGHT
var temp: int = START_TEMP
var stage: int = START_STAGE
var tank: int = TANK_CAPACITY

## "" when healthy, else one of: "dry", "drowned", "dark", "leggy", "frost", "scorch".
var ailment: String = ""
## 0..1 progress of nursing an ailing plant back to health.
var recovery: float = 0.0
## 0..1 how close harsh conditions are to making a healthy plant ail.
var harm: float = 0.0
## Bud growth 0..1 (1 = flower open). Latched once the flower opens.
var bud: float = 0.0
var flowered: bool = false
## Fruit growth 0..1 (1 = solved).
var fruit: float = 0.0
var is_solved: bool = false

var _refill_t := 0.0
var _dry_t := 0.0
var _drain_t := 0.0


func reset() -> void:
	water = START_WATER
	light = START_LIGHT
	temp = START_TEMP
	stage = START_STAGE
	tank = TANK_CAPACITY
	ailment = ""
	recovery = 0.0
	harm = 0.0
	bud = 0.0
	flowered = false
	fruit = 0.0
	is_solved = false
	_refill_t = 0.0
	_dry_t = 0.0
	_drain_t = 0.0


func is_healthy() -> bool:
	return ailment == ""


# =============================================================================
# PLAYER ACTIONS. Each returns false when ignored (e.g. after solving).
# =============================================================================

## One press of the blue button: one step wetter, one spray from the tank.
func spray() -> bool:
	if is_solved:
		return false
	if tank <= 0:
		spray_failed.emit()
		return false
	tank -= 1
	_refill_t = 0.0
	water = mini(water + 1, Water.WATERLOGGED)
	_dry_t = 0.0
	_drain_t = 0.0
	sprayed.emit(water)
	return true


func set_light(v: int) -> bool:
	if is_solved:
		return false
	light = clampi(v, 0, Light.BRIGHT)
	return true


func set_temperature(v: int) -> bool:
	if is_solved:
		return false
	var old := temp
	temp = clampi(v, 0, Temp.HOT)
	if temp != old:
		_dry_t = 0.0
	return true


## Move the age dial ONE stage (dir = +1 / -1). Forward growth into YOUNG,
## MATURE or FLOWERING is judged against the current conditions.
func step_stage(dir: int) -> bool:
	if is_solved:
		return false
	var target := clampi(stage + signi(dir), 0, Stage.OLD)
	if target == stage:
		return false
	var old := stage
	stage = target
	if target > old:
		if target <= Stage.FLOWERING:
			_growth_spurt()
		else:
			grew.emit(stage, is_healthy())
	else:
		# Rewinding time. Leaving the flowering age undoes buds and flowers.
		if stage < Stage.FLOWERING:
			bud = 0.0
			flowered = false
			fruit = 0.0
		grew.emit(stage, is_healthy())
	return true


func _growth_spurt() -> void:
	var cause := growth_problem()
	if cause == "":
		if ailment != "":
			ailment = ""
			recovered.emit()
	else:
		ailment = cause
		ailment_started.emit(cause)
	recovery = 0.0
	harm = 0.0
	grew.emit(stage, is_healthy())
	if DRINK_PER_GROWTH > 0 and water > Water.DRY:
		water = maxi(Water.DRY, water - DRINK_PER_GROWTH)
		soil_changed.emit(water, "drunk")


# =============================================================================
# CONDITION CHECKS
# =============================================================================

## "" if the current conditions are good for growing, else the worst problem.
func growth_problem() -> String:
	if not water in GROW_WATER:
		return "dry" if water < Water.MOIST else "drowned"
	if not temp in GROW_TEMP:
		return "frost" if temp < Temp.COOL else "scorch"
	if not light in GROW_LIGHT:
		return "dark" if light == Light.DARK else "leggy"
	return ""


## "" if nothing harsh is happening, else the harsh condition's ailment.
func harm_problem() -> String:
	if temp in HARM_TEMP:
		return "frost" if temp == Temp.COLD else "scorch"
	if water in HARM_WATER:
		return "dry" if water == Water.DRY else "drowned"
	if light in HARM_LIGHT:
		return "dark"
	return ""


## How many of the two night cues are present (0..2).
func night_cues() -> int:
	return int(light in NIGHT_LIGHT) + int(temp in NIGHT_TEMP)


## How many of the three fruiting conditions are exactly right (0..3).
func fruit_matches() -> int:
	return int(water == FRUIT_WATER) + int(light == FRUIT_LIGHT) + int(temp == FRUIT_TEMP)


# =============================================================================
# TIME
# =============================================================================

func tick(dt: float) -> void:
	if is_solved:
		return
	_tick_tank(dt)
	_tick_soil(dt)
	_tick_health(dt)
	_tick_bloom(dt)


func _tick_tank(dt: float) -> void:
	if tank >= TANK_CAPACITY:
		_refill_t = 0.0
		return
	_refill_t += dt
	if _refill_t >= TANK_REFILL_TIME:
		_refill_t = 0.0
		tank += 1
		tank_refilled.emit(tank)


func _tick_soil(dt: float) -> void:
	if water == Water.WATERLOGGED:
		_drain_t += dt
		if _drain_t >= DRAIN_TIME:
			_drain_t = 0.0
			water = Water.WET
			soil_changed.emit(water, "drained")
			return
	else:
		_drain_t = 0.0
	var dry_time := HOT_DRY_TIME if temp == Temp.HOT else (WARM_DRY_TIME if temp == Temp.WARM else -1.0)
	if dry_time > 0.0 and water > Water.DRY:
		_dry_t += dt
		if _dry_t >= dry_time:
			_dry_t = 0.0
			water -= 1
			soil_changed.emit(water, "evaporated")
	else:
		_dry_t = 0.0


func _tick_health(dt: float) -> void:
	if ailment == "":
		var h := harm_problem() if stage > Stage.SEEDLING else ""
		if h != "":
			harm += dt / HARM_TIME
			if harm >= 1.0:
				harm = 0.0
				ailment = h
				ailment_started.emit(h)
		else:
			harm = maxf(0.0, harm - dt / HARM_TIME * 2.0)
	else:
		harm = 0.0
		if growth_problem() == "":
			recovery += dt / RECOVER_TIME
			if recovery >= 1.0:
				recovery = 0.0
				ailment = ""
				recovered.emit()
		else:
			recovery = maxf(0.0, recovery - dt / RECOVER_TIME)


func _tick_bloom(dt: float) -> void:
	if stage != Stage.FLOWERING:
		if stage == Stage.OLD:
			fruit = maxf(0.0, fruit - dt * FRUIT_DECAY_RATE * 3.0)
		return
	if not flowered:
		var target := 0.0
		if is_healthy():
			target = [0.0, BUD_PARTIAL, 1.0][night_cues()]
		var before := bud
		if bud < target:
			bud = minf(target, bud + dt / BUD_TIME)
		else:
			bud = maxf(target, bud - dt / (BUD_TIME * 2.0))
		if before <= 0.0 and bud > 0.0:
			bud_changed.emit("bud")
		if bud >= 1.0:
			flowered = true
			bud_changed.emit("flower")
		return
	# Open flower: fruit only under the exact conditions.
	if is_healthy() and fruit_matches() == 3:
		var before2 := fruit
		fruit = minf(1.0, fruit + dt / FRUIT_TIME)
		if before2 <= 0.0 and fruit > 0.0:
			fruit_started.emit()
		if fruit >= 1.0:
			is_solved = true
			solved.emit()
	elif fruit_matches() < 2 or not is_healthy():
		fruit = maxf(0.0, fruit - dt * FRUIT_DECAY_RATE)


# =============================================================================
# DEBUG
# =============================================================================

func describe() -> String:
	return "W %s  L %s  T %s  Age %s  tank %d | %s%s bud %.2f%s fruit %.2f%s" % [
		WATER_NAMES[water], LIGHT_NAMES[light], TEMP_NAMES[temp], STAGE_NAMES[stage], tank,
		("AILING:" + ailment + " rec %.2f " % recovery) if ailment != "" else "healthy ",
		(" harm %.2f" % harm) if harm > 0.0 else "", bud, " FLOWERED" if flowered else "",
		fruit, "  SOLVED" if is_solved else ""]
