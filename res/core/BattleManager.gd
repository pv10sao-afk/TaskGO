extends Node
class_name BattleManager

signal deploy_validated(is_valid: bool, position: Vector2)
signal unit_deployed(unit: Node)

const CENTER_Y: float = 400.0

func deploy_card_at_lane(card: Resource, lane_index: int) -> void:
	if not card:
		return
	if not card.packed_scene:
		push_warning("CardData missing PackedScene: cannot spawn unit for card %s" % str(card.id))
		return
	
	var spawn_pos: Vector2 = _lane_spawn_position(lane_index)
	if not _is_valid_deploy_position(spawn_pos):
		push_warning("Deploy position outside player zone: %s" % str(spawn_pos))
		emit_signal("deploy_validated", false, spawn_pos)
		return
	
	emit_signal("deploy_validated", true, spawn_pos)
	
	var scene: Node = card.packed_scene.instantiate()
	if scene:
		scene.position = spawn_pos
		get_tree().get_current_scene().add_child(scene)
		emit_signal("unit_deployed", scene)

func _lane_spawn_position(lane_index: int) -> Vector2:
	var scene: Node = get_tree().get_current_scene()
	var path: String = "Lanes/Lane%s/SpawnMarker" % str(clamp(lane_index, 0, 2))
	if scene and scene.has_node(path):
		var marker = scene.get_node(path)
		if marker and marker is Marker2D:
			return marker.global_position
	var base_y: float = 600.0
	var lane_x: Array = [200.0, 400.0, 600.0]
	var x: float = lane_x[clamp(lane_index, 0, lane_x.size() - 1)]
	return Vector2(x, base_y)

func _is_valid_deploy_position(pos: Vector2) -> bool:
	return pos.y > CENTER_Y