extends Node2D

func _ready() -> void:
	var db: Node = $CardDatabase
	var deck_mgr: Node = $DeckManager
	var elixir: Node = $Elixir

	# Connect signals BEFORE initialize so first emit is caught
	elixir.elixir_changed.connect(_on_elixir_changed)
	deck_mgr.deck_updated.connect(_on_deck_updated)

	var starter: Array = db.get_starter_deck()
	deck_mgr.initialize(starter)

	# Connect card slot buttons
	for i in range(4):
		var slot = get_node_or_null("UI/Root/HandLayout/Cards/Slot%d" % i)
		if slot:
			slot.pressed.connect(_on_card_pressed.bind(i))

	var back_btn = get_node_or_null("UI/Root/TopBar/BackBtn")
	if back_btn:
		back_btn.pressed.connect(_on_back_pressed)

func _on_elixir_changed(amount: int) -> void:
	var label = get_node_or_null("UI/Root/TopBar/ElixirLabel")
	if label:
		label.text = "⚡ %d / 10" % amount

	var bar = get_node_or_null("UI/Root/HandLayout/ElixirBar")
	if bar:
		for i in range(bar.get_child_count()):
			var cell = bar.get_child(i)
			if cell is ColorRect:
				cell.color = Color(0.55, 0.1, 0.9) if i < amount else Color(0.15, 0.15, 0.25)

func _on_deck_updated() -> void:
	var deck_mgr: Node = $DeckManager
	var elixir: Node = $Elixir
	var hand: Array = deck_mgr.get_hand()
	for i in range(4):
		var slot = get_node_or_null("UI/Root/HandLayout/Cards/Slot%d" % i)
		if not slot:
			continue
		var card = hand[i] if i < hand.size() else null
		if card:
			var affordable: bool = elixir.can_afford(card.cost)
			slot.disabled = false
			slot.modulate = Color(1.0, 1.0, 1.0) if affordable else Color(0.55, 0.55, 0.55)
			slot.text = "%s\n⚡%d" % [card.id.replace("_", " ").capitalize(), card.cost]
		else:
			slot.disabled = true
			slot.modulate = Color(0.3, 0.3, 0.3)
			slot.text = "—"

func _on_card_pressed(index: int) -> void:
	var deck_mgr: Node = $DeckManager
	var elixir: Node = $Elixir
	var hand: Array = deck_mgr.get_hand()
	if index >= hand.size():
		return
	var card = hand[index]
	if card == null or not elixir.can_afford(card.cost):
		return
	var mgr: Node = $BattleManager
	mgr.deploy_card_at_lane(card, 1)
	elixir.spend(card.cost)
	deck_mgr.play_card(index)

func _on_back_pressed() -> void:
	get_tree().change_scene_to_file("res://res/scenes/MainMenu.tscn")
