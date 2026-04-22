extends Node

@export var lanes_count: int = 3
@export var action_cooldown: float = 1.5

# FIX: Bot has its own private deck so it does NOT steal from the player's hand
var _bot_deck: Array = []
var _bot_hand: Array = []
var _hand_size: int = 4
var _bot_elixir: int = 4
var _bot_elixir_timer: float = 0.0
var _bot_elixir_interval: float = 1.0

var _battle_mgr: Node
var is_running: bool = false
var _cooldown_timer: float = 0.0

func _ready():
	if has_node("../BattleManager"):
		_battle_mgr = get_node("../BattleManager")

	var db_node = get_node_or_null("../CardDatabase")
	if db_node:
		var all_unit_cards = db_node.get_all_unit_cards()
		for c in all_unit_cards:
			_bot_deck.append(c)
			_bot_deck.append(c)
		_bot_deck.shuffle()
	else:
		push_warning("BotAI: CardDatabase node not found")

	_draw_initial_hand()
	is_running = true

func _draw_initial_hand():
	_bot_hand.clear()
	for i in range(_hand_size):
		if _bot_deck.size() > 0:
			_bot_hand.append(_bot_deck.pop_at(0))
		else:
			_bot_hand.append(null)

func _process(delta: float):
	if not is_running:
		return

	# Bot own elixir regen (independent of player)
	_bot_elixir_timer += delta
	if _bot_elixir_timer >= _bot_elixir_interval:
		_bot_elixir_timer = 0.0
		_bot_elixir = min(10, _bot_elixir + 1)

	_cooldown_timer -= delta
	if _cooldown_timer > 0.0:
		return
	_cooldown_timer = action_cooldown

	if _bot_elixir <= 0:
		return

	var affordable: Array = []
	for i in range(_bot_hand.size()):
		var c = _bot_hand[i]
		if c != null and c.cost <= _bot_elixir:
			affordable.append(i)

	if affordable.size() == 0:
		return

	var pick_index: int = affordable[randi() % affordable.size()]
	var card = _bot_hand[pick_index]
	var lane_index: int = randi() % lanes_count

	if _battle_mgr and _battle_mgr.has_method("deploy_card_at_lane"):
		_battle_mgr.call("deploy_card_at_lane", card, lane_index)
		_bot_elixir -= card.cost
		_bot_hand.remove_at(pick_index)
		if _bot_deck.size() > 0:
			_bot_hand.append(_bot_deck.pop_at(0))
		else:
			_bot_hand.append(null)
