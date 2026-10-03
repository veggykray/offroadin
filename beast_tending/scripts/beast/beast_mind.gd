class_name BeastMind
extends Node
## The beast's internal state. Nothing here is ever shown to the player
## (except in debug mode): the body, the eyes and the noises are the meter.

enum Mood { WARY, CURIOUS, RELAXED, CONTENT, EXCITED, IRRITATED, SURPRISED, IMPATIENT, SPENT, ANTICIPATING }
const MOOD_NAMES := ["wary", "curious", "relaxed", "content", "excited", "irritated", "surprised", "impatient", "spent", "anticipating"]

signal mood_changed(mood: int)
signal shifted_away(region: BodyRegion)

@export_group("Pleasure")
@export var pleasure_decay := 0.045
## Pleasure gained per second of continuous contact at each level.
@export var close_rate := 0.05
@export var good_rate := 0.14
@export var very_good_rate := 0.24
## Pleasure gained per instant event (poke/rhythm) at each level.
@export var close_event := 0.02
@export var good_event := 0.05
@export var very_good_event := 0.08

@export_group("Irritation")
@export var irritation_decay := 0.07
@export var wrong_rate := 0.42
@export var wrong_event := 0.16
## Irritation at which the beast shifts away (regions may lower it).
@export var shift_away_threshold := 1.0

var pleasure := 0.0
var irritation := 0.0
var satisfaction := 0.0     ## overall progress through the sequence 0..1
var escalation := 0.0
var escalation_override := -1.0
var mood: int = Mood.WARY
var surprise_timer := 0.0
var _shift_cooldown := 0.0


func _ready() -> void:
	Game.mind = self


func reset() -> void:
	pleasure = 0.0
	irritation = 0.0
	satisfaction = 0.0
	escalation = 0.0
	escalation_override = -1.0
	mood = Mood.WARY


func apply(level: int, region: BodyRegion, g: Gesture) -> void:
	var cont := g != null and g.is_continuous()
	var dt := g.dt if cont else 0.0
	var contrib := region.pleasure_contribution if region else 1.0
	var sens := region.sensitivity if region else 0.6
	match level:
		Game.Level.WRONG:
			irritation += (wrong_rate * dt if cont else wrong_event) * sens
			pleasure = maxf(pleasure - (0.1 * dt if cont else 0.03), 0.0)
		Game.Level.CLOSE:
			pleasure += (close_rate * dt if cont else close_event) * contrib
		Game.Level.GOOD:
			pleasure += (good_rate * dt if cont else good_event) * contrib
			irritation = maxf(irritation - 0.1 * (dt if cont else 0.2), 0.0)
		Game.Level.VERY_GOOD:
			pleasure += (very_good_rate * dt if cont else very_good_event) * contrib
			irritation = maxf(irritation - 0.15 * (dt if cont else 0.3), 0.0)
	pleasure = clampf(pleasure, 0.0, 1.0)
	var threshold := shift_away_threshold
	if region:
		threshold = minf(threshold, region.irritation_threshold)
	if irritation >= threshold and _shift_cooldown <= 0.0:
		_shift_cooldown = 2.5
		irritation = 0.4
		pleasure *= 0.5
		shifted_away.emit(region)


## The crevice: a huge thrill that is actually annoying.
func herring(count: int) -> void:
	surprise_timer = 2.2
	pleasure = minf(pleasure + 0.25, 1.0)
	irritation += 0.25 + 0.2 * count


func _process(delta: float) -> void:
	_shift_cooldown -= delta
	surprise_timer = maxf(surprise_timer - delta, 0.0)
	pleasure = maxf(pleasure - pleasure_decay * delta, 0.0)
	irritation = maxf(irritation - irritation_decay * delta, 0.0)
	var seq := Game.sequence
	var base: float = seq.base_escalation() if seq else 0.0
	satisfaction = seq.satisfaction() if seq else 0.0
	var target := clampf(base + pleasure * 0.38, 0.0, 1.0)
	if escalation_override >= 0.0:
		target = escalation_override
	escalation = Game.damp(escalation, target, 1.5 if target > escalation else 0.6, delta)
	_update_mood()


func _update_mood() -> void:
	var m: int = mood
	var seq := Game.sequence
	var stage: int = seq.stage if seq else 0
	if seq and stage >= TendingSequence.Stage.AFTERGLOW:
		m = Mood.SPENT
	elif surprise_timer > 0.0:
		m = Mood.SURPRISED
	elif irritation > 0.55:
		m = Mood.IRRITATED
	elif pleasure > 0.55 or escalation > 0.72:
		m = Mood.EXCITED
	elif seq and stage >= TendingSequence.Stage.TRUST and stage < TendingSequence.Stage.FINISH and seq.progress > 0.7 and pleasure > 0.12:
		m = Mood.ANTICIPATING
	elif seq and seq.is_impatient():
		m = Mood.IMPATIENT
	elif pleasure > 0.28:
		m = Mood.CONTENT
	elif stage <= TendingSequence.Stage.TRUST and (seq == null or seq.progress < 0.35):
		m = Mood.WARY
	elif pleasure > 0.1:
		m = Mood.RELAXED
	else:
		m = Mood.CURIOUS
	if m != mood:
		mood = m
		mood_changed.emit(m)
