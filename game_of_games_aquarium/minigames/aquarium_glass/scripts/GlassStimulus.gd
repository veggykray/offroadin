extends RefCounted
## A single disturbance of the aquarium water/glass.
##
## Every gesture the player makes on the glass becomes one of these, and so do
## "natural" disturbances the hint system invents (a bubble popping against the
## glass, a parasite wriggling...). Creatures only ever react to stimuli, never
## to raw mouse input, which is what keeps the module portable.

enum Kind { NONE, SINGLE_TAP, DOUBLE_TAP, RUB, SCRATCH, HARD_KNOCK }

const KIND_NAMES := {
	Kind.NONE: "none",
	Kind.SINGLE_TAP: "single tap",
	Kind.DOUBLE_TAP: "double tap",
	Kind.RUB: "rub",
	Kind.SCRATCH: "scratch",
	Kind.HARD_KNOCK: "HARD KNOCK",
}

var kind: int = Kind.NONE
## Position in AquariumActivity local space.
var position := Vector2.ZERO
## How far the vibration reaches (pixels).
var radius := 120.0
## 0..1+ intensity.
var strength := 1.0
## True when produced by the environment / hint system rather than the player.
var natural := false
## Rub / scratch are reported many times per stroke; all reports of one stroke share an id.
var stroke_id := 0
var continuous := false
## Seconds since activity start when this happened.
var time := 0.0


## Usage: Stim.new().setup(Stim.Kind.SINGLE_TAP, pos, 140.0)
func setup(p_kind: int, p_pos: Vector2, p_radius: float, p_strength := 1.0, p_natural := false) -> RefCounted:
	kind = p_kind
	position = p_pos
	radius = p_radius
	strength = p_strength
	natural = p_natural
	return self


static func kind_name(k: int) -> String:
	return KIND_NAMES.get(k, "?")


func is_impact() -> bool:
	return kind == Kind.SINGLE_TAP or kind == Kind.DOUBLE_TAP or kind == Kind.HARD_KNOCK
