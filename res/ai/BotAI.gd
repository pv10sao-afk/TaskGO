extends Node
class_name BotAI

@export var lanes_count: int = 3
@export var starting_elixir: int = 10

var elixir_node: Node
var deck_manager: Node
var lane_positions: Array = []
var is_running: bool = false

func _ready():
	if has_node("../Elixir"):
		elixir_node = get_node("../Elixir")
	if has_node("../DeckManager"):
		deck_manager = get_node("../DeckManager")
	lane_positions = [Vector2(100, 200), Vector2(400, 200), Vector2(700, 200)]
	is_running = true

func _process(_delta: float):
	if not is_running:
		return
	if not elixir_node or not deck_manager:
		return
	var current_elixir: int = 0
	if elixir_node.has_method("current_elixir"):
		current_elixir = elixir_node.current_elixir
	if current_elixir <= 0:
		return
	var hand: Array = deck_manager.get_hand()
	var affordable: Array = []
	for i in range(hand.size()):
		var c = hand[i]
		if c != null and c.cost <= current_elixir:
			affordable.append(i)
	if affordable.size() == 0:
		return
	var pick_index: int = affordable[randi() % affordable.size()]
	var lane_index: int = randi() % lanes_count
	if has_node("../BattleManager"):
		var mgr = get_node("../BattleManager")
		if mgr.has_method("deploy_card_at_lane"):
			mgr.call("deploy_card_at_lane", hand[pick_index], lane_index)
			deck_manager.play_card(pick_index)