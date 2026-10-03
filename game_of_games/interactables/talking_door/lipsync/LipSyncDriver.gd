class_name LipSyncDriver
extends RefCounted
## Base class for anything that drives a talking mouth.
##
## TalkingDoorFace only talks to this interface:
##   start(), update(delta), get_pose(), get_energy(), pop_events(), is_finished(), stop()
##
## Implementations:
##   AmplitudeLipSync   - reads the loudness / tone of a playing audio file
##   VisemeTrackLipSync - plays timed mouth shapes (from text, or from a phoneme
##                        tool such as Rhubarb Lip Sync) optionally clocked by audio
##
## A future phoneme/viseme system only needs to subclass this and fill in
## _sample(); the face, expressions and gestures keep working unchanged.

## Speech "events" the face uses to time its gestures.
const EVENT_PHRASE_START := &"phrase_start"  ## voice starts after silence
const EVENT_PAUSE := &"pause"                ## a noticeable gap mid-line
const EVENT_EMPHASIS := &"emphasis"          ## a stressed / louder syllable
const EVENT_SYLLABLE := &"syllable"          ## a new syllable onset

## Multiplies how wide the mouth opens.
var sensitivity := 1.0
## Seconds; how lazily the mouth closes (opening is always quicker).
var smoothing := 0.07
## Seed for the small per-syllable shape variation.
var variation_seed := 0

var _pose := MouthPose.new()
var _energy := 0.0
var _events: Array[StringName] = []
var _time := 0.0
var _started := false
var _finished := false

# event tracking
var _silence := 1.0
var _in_pause := true
var _avg_energy := 0.2
var _since_emphasis := 10.0
var _prev_energy := 0.0
var _rising := false
var _rng := RandomNumberGenerator.new()
var _variant_shape := MouthPose.Shape.SMALL_OPEN


func start() -> void:
	_started = true
	_finished = false
	_time = 0.0
	_rng.seed = variation_seed if variation_seed != 0 else randi()
	_pick_variant()


func stop() -> void:
	_finished = true


func update(delta: float) -> void:
	if not _started or _finished:
		return
	_time += delta
	var raw := _sample(delta)  # {"pose": MouthPose, "energy": float}
	var target: MouthPose = raw.get("pose", MouthPose.new())
	var energy: float = raw.get("energy", 0.0)
	_track_events(energy, delta)
	_energy = energy
	# Smooth: open fast, close a little slower; other params in between.
	var t_open := 1.0 - exp(-delta / (0.03 if target.open > _pose.open else maxf(smoothing, 0.001)))
	var t_shape := 1.0 - exp(-delta / maxf(smoothing * 0.9, 0.025))
	var next := _pose.lerp_to(target, t_shape)
	next.open = lerpf(_pose.open, target.open, t_open)
	_pose = next


func get_pose() -> MouthPose:
	return _pose


func get_energy() -> float:
	return _energy


func get_time() -> float:
	return _time


func pop_events() -> Array[StringName]:
	var out := _events.duplicate()
	_events.clear()
	return out


func is_finished() -> bool:
	return _finished


## Seconds, or -1 if unknown.
func get_duration() -> float:
	return -1.0


## Override: return {"pose": MouthPose, "energy": 0..1}. Call _finish() when done.
func _sample(_delta: float) -> Dictionary:
	return {"pose": MouthPose.new(), "energy": 0.0}


func _finish() -> void:
	_finished = true


func _track_events(energy: float, delta: float) -> void:
	var voiced := energy > 0.14
	_since_emphasis += delta
	if voiced:
		if _in_pause:
			_events.append(EVENT_PHRASE_START)
			_in_pause = false
		_silence = 0.0
	else:
		_silence += delta
		if not _in_pause and _silence > 0.2:
			_in_pause = true
			_events.append(EVENT_PAUSE)
	# syllable onsets: rising through a threshold
	if not _rising and energy > _prev_energy + 0.02 and energy > 0.3:
		_rising = true
		_events.append(EVENT_SYLLABLE)
		_pick_variant()
	elif _rising and energy < _prev_energy - 0.04:
		_rising = false
	# emphasis: clearly louder than the recent average
	if energy > 0.55 and energy > _avg_energy * 1.35 + 0.12 and _since_emphasis > 0.7:
		_events.append(EVENT_EMPHASIS)
		_since_emphasis = 0.0
	_avg_energy = lerpf(_avg_energy, energy, 1.0 - exp(-delta * 1.2))
	_prev_energy = energy


func _pick_variant() -> void:
	var r := _rng.randf()
	if r < 0.4:
		_variant_shape = MouthPose.Shape.SMALL_OPEN
	elif r < 0.7:
		_variant_shape = MouthPose.Shape.WIDE_OPEN
	else:
		_variant_shape = MouthPose.Shape.SMILE_OPEN


## Shared mapping from simple audio features to a mouth pose.
##   energy:   0..1 loudness
##   lowness:  0..1 how dark/low the sound is compared with this voice's average ("oo", "oh")
##   hiss:     0..1 how noisy / high it is compared with this voice's average ("s", "sh", "f")
func _pose_from_features(energy: float, lowness: float, hiss: float) -> MouthPose:
	var open_amt := clampf(pow(clampf(energy, 0.0, 1.0), 1.2) * sensitivity, 0.0, 1.0)
	if open_amt < 0.04:
		return MouthPose.make()
	var round_w := smoothstep(0.6, 0.95, lowness) * 0.85
	var hiss_w := smoothstep(0.35, 0.75, hiss) * (1.0 - open_amt * 0.5)
	var open_w := maxf(1.0 - round_w - hiss_w, 0.0)
	var weights := {}
	weights[MouthPose.Shape.ROUND] = round_w
	weights[MouthPose.Shape.NARROW] = hiss_w
	# Louder syllables lean towards a wide mouth regardless of the variant.
	weights[_variant_shape] = open_w * (1.0 - open_amt * 0.4)
	weights[MouthPose.Shape.WIDE_OPEN] = weights.get(MouthPose.Shape.WIDE_OPEN, 0.0) + open_w * open_amt * 0.4
	var pose := MouthPose.blend_shapes(weights)
	pose.open = open_amt * (1.0 - 0.3 * round_w - 0.55 * hiss_w)
	return pose
