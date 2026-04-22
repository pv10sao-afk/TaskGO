extends Control

var card: Resource

func set_card(p_card: Resource):
	card = p_card
	queue_redraw()

func get_drag_data(_pos: Vector2):
	if card:
		return {"type": "card", "card": card}
	return null

func can_drop_data(_pos: Vector2, data) -> bool:
	return data is Dictionary and data.has("type") and data["type"] == "card"

func drop_data(_pos: Vector2, data):
	if not data or not data.has("card"):
		return
	var dragged = data["card"]
	var scene = get_tree().get_current_scene()
	if scene and scene.has_method("deploy_card_at_lane"):
		scene.deploy_card_at_lane(dragged, 0)
	elif scene and scene.has_node("BattleManager"):
		var mgr = scene.get_node("BattleManager")
		if mgr.has_method("deploy_card_at_lane"):
			mgr.call("deploy_card_at_lane", dragged, 0)
