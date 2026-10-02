class_name ScareEvent
extends Node
## Base class for scripted scares. Add subclasses as children of a ScareDirector.
## Override can_trigger(ctx) for the condition and trigger(ctx) for the effect.
## Each event can be toggled independently with `enabled`.

signal fired(event: ScareEvent)

@export var enabled := true
@export var event_id := "scare"
@export var one_shot := true
## Seconds before a repeatable event may fire again.
@export var cooldown := 60.0

var has_fired := false
var _cooldown_left := 0.0


func is_ready() -> bool:
	return enabled and not (one_shot and has_fired) and _cooldown_left <= 0.0


func tick(delta: float, _ctx: ScareContext) -> void:
	_cooldown_left = maxf(0.0, _cooldown_left - delta)


## Condition. Override.
func can_trigger(_ctx: ScareContext) -> bool:
	return false


## Minimum requirement to force the event from a debug key (ignores timing conditions).
func can_force(_ctx: ScareContext) -> bool:
	return true


## Effect. Override. Return false if it couldn't run (it will then not count as fired).
func trigger(_ctx: ScareContext) -> bool:
	return true


func fire(ctx: ScareContext) -> bool:
	if not trigger(ctx):
		return false
	has_fired = true
	_cooldown_left = cooldown
	fired.emit(self)
	return true
