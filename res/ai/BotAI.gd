extends Node

@export var lanes_count: int = 3
@export var starting_elixir: int = 10
@export var action_cooldown: float = 1.5  # BUG FIX: was running every _process frame (thousands/sec)

var elixir_node: Node
var deck_manager: Node
var lane_positions: Array = []
var is_running: bool = false
var _cooldown_timer: float = 0.0

func _ready():
	if has_node("../Elixir"):
		elixir_node = get_node("../Elixir")
	if has_node("../DeckManager"):
		deck_manager = get_node("../DeckManager")
	lane_positions = [Vector2(100, 200), Vector2(400, 200), Vector2(700, 200)]
	is_running = true

func _process(delta: float):
	if not is_running:
		return
	if not elixir_node or not deck_manager:
		return

	# BUG FIX: add cooldown so AI doesn't try to play a card every single frame
	_cooldown_timer -= delta
	if _cooldown_timer > 0.0:
		return
	_cooldown_timer = action_cooldown

	# BUG FIX: was checking has_method("current_elixir") — current_elixir is a
	# variable, not a method, so has_method() always returned false and
	# current_elixir stayed 0, making the AI never play any card.
	var current_elixir: int = elixir_node.current_elixir

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
			# BUG FIX: elixir was never spent after the bot played a card
			elixir_node.spend(hand[pick_index].cost)
