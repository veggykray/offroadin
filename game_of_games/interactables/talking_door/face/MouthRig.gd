@tool
class_name MouthRig
extends Node2D
## Base class for anything that can display a mouth.
##
## TalkingDoorFace calls apply_pose() every frame. To use your own mouth artwork,
## either use SpriteMouth (one texture per mouth shape) or write a new script that
## extends MouthRig and overrides apply_pose().


func apply_pose(_pose: MouthPose) -> void:
	pass
