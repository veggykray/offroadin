@tool
class_name MouthPose
extends RefCounted
## A mouth described by a handful of normalised numbers.
##
## Every mouth rig (procedural or sprite based) only ever receives a MouthPose,
## so lip-sync sources (amplitude, text, phoneme/viseme tracks...) never need to
## know what the mouth artwork looks like.

## Named mouth shapes. Lip-sync sources talk in these; rigs may use them to pick
## a sprite (see SpriteMouth.gd).
enum Shape { REST, SMALL_OPEN, WIDE_OPEN, ROUND, NARROW, SMILE_OPEN, FROWN_OPEN, PRESSED }

const SHAPE_NAMES := ["REST", "SMALL_OPEN", "WIDE_OPEN", "ROUND", "NARROW", "SMILE_OPEN", "FROWN_OPEN", "PRESSED"]

var open := 0.0    ## 0 closed .. 1 jaw fully dropped
var width := 1.0   ## horizontal stretch multiplier
var smile := 0.0   ## -1 frown .. +1 smile (corner height)
var pucker := 0.0  ## 0..1 rounded / pushed-forward lips ("oo", "oh")
var teeth := 0.0   ## 0..1 lips pulled back to show teeth ("ee", "s")
var press := 0.0   ## 0..1 lips squeezed thin ("m", "b", "p", annoyance)
var asym := 0.0    ## -1..1 one corner higher than the other (smirk)


static func make(p_open := 0.0, p_width := 1.0, p_smile := 0.0, p_pucker := 0.0, p_teeth := 0.0, p_press := 0.0, p_asym := 0.0) -> MouthPose:
	var p := MouthPose.new()
	p.open = p_open
	p.width = p_width
	p.smile = p_smile
	p.pucker = p_pucker
	p.teeth = p_teeth
	p.press = p_press
	p.asym = p_asym
	return p


## The canonical pose for each named shape. Tweak these to change how every
## door articulates (or override per rig).
static func from_shape(shape: int) -> MouthPose:
	match shape:
		Shape.SMALL_OPEN: return make(0.32, 0.96, 0.0, 0.1, 0.15)
		Shape.WIDE_OPEN:  return make(0.95, 1.08, 0.0, 0.0, 0.1)
		Shape.ROUND:      return make(0.55, 0.62, 0.0, 0.85, 0.0)
		Shape.NARROW:     return make(0.16, 1.0, 0.25, 0.0, 0.85)
		Shape.SMILE_OPEN: return make(0.5, 1.12, 0.7, 0.0, 0.55)
		Shape.FROWN_OPEN: return make(0.45, 0.94, -0.7, 0.1, 0.2)
		Shape.PRESSED:    return make(0.0, 0.95, 0.0, 0.1, 0.0, 1.0)
	return make()


static func shape_from_name(shape_name: String) -> int:
	var idx := SHAPE_NAMES.find(shape_name.to_upper())
	return idx if idx >= 0 else Shape.REST


func duplicate_pose() -> MouthPose:
	return make(open, width, smile, pucker, teeth, press, asym)


func lerp_to(other: MouthPose, t: float) -> MouthPose:
	return make(
		lerpf(open, other.open, t), lerpf(width, other.width, t), lerpf(smile, other.smile, t),
		lerpf(pucker, other.pucker, t), lerpf(teeth, other.teeth, t), lerpf(press, other.press, t),
		lerpf(asym, other.asym, t))


## Weighted blend of several poses. `weights` maps Shape -> weight.
static func blend_shapes(weights: Dictionary) -> MouthPose:
	var total := 0.0
	for w in weights.values():
		total += maxf(w, 0.0)
	if total <= 0.0001:
		return make()
	var out := make(0.0, 0.0)
	for shape in weights:
		var w: float = maxf(weights[shape], 0.0) / total
		if w <= 0.0:
			continue
		var p := from_shape(shape)
		out.open += p.open * w
		out.width += p.width * w
		out.smile += p.smile * w
		out.pucker += p.pucker * w
		out.teeth += p.teeth * w
		out.press += p.press * w
		out.asym += p.asym * w
	return out


## Which named shape is this pose closest to? (Used by sprite mouths.)
func nearest_shape() -> int:
	var best := Shape.REST
	var best_d := INF
	for s in SHAPE_NAMES.size():
		var p := from_shape(s)
		var d := absf(p.open - open) * 2.0 + absf(p.width - width) + absf(p.smile - smile) \
			+ absf(p.pucker - pucker) + absf(p.teeth - teeth) * 0.6 + absf(p.press - press)
		if d < best_d:
			best_d = d
			best = s
	return best
