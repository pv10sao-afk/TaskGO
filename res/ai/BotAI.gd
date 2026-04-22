extends Node
class_name BotAI

export(int) var lanes_count := 3
export(int) var starting_elixir := 10

var elixir_node: Node
var deck_manager: Node
var lane_positions: Array = []  # Array of Vector2 centers for lanes
var is_running := false

func _ready():
    # Expect autoload to wire these or assign from scene
    if has_node("../Elixir"):
        elixir_node = get_node("../Elixir")
    if has_node("../DeckManager"):
        deck_manager = get_node("../DeckManager")
    # Initialize lane centers (example values, to be replaced by level data)
    lane_positions = [Vector2(100, 200), Vector2(400, 200), Vector2(700, 200)]
    is_running = true

func _process(_delta):
    if not is_running:
        return
    if not elixir_node or not deck_manager:
        return
    # Simple spawn logic: if enough elixir, spawn a random card into a random lane
    var current_elixir = 0
    if elixir_node.has_method("current_elixir"):
        current_elixir = elixir_node.current_elixir
    if current_elixir <= 0:
        return
    # Pick a random card with cost <= current_elixir
    var hand = deck_manager.get_hand()
    var affordable = []
    for i in range(hand.size()):
        var c = hand[i]
        if c != null and c.cost <= current_elixir:
            affordable.append(i)
    if affordable.size() == 0:
        return
    var pick_index = affordable[randi() % affordable.size()]
    var lane_index = randi() % lanes_count
    # Deploy via an autoloaded BattleManager if available
    if has_node("../BattleManager"):
        var mgr = get_node("../BattleManager")
        if mgr.has_method("deploy_card_at_lane"):
            mgr.call("deploy_card_at_lane", hand[pick_index], lane_index)
            deck_manager.play_card(pick_index)
