# BUG FIX: was "extends Node2D" — can_drop_data / drop_data are Control methods
# and are NEVER called on a Node2D. DropZone must extend Control to receive drops.
extends Control

var valid_drop: bool = false

func _unhandled_input(event):
	pass

func can_drop_data(_position: Vector2, data) -> bool:
	return data is Dictionary and data.has("type") and data["type"] == "card"

func drop_data(_position: Vector2, data):
	if not data or not data.has("card"):
		return
	var card = data["card"]
	var mgr = get_node("/root/BattleManager") if has_node("/root/BattleManager") else null
	if mgr and mgr.has_method("deploy_card_at_lane"):
		mgr.call("deploy_card_at_lane", card, 0)
