extends Node

# BUG FIX: path was "res://cards/" — project files are under res/res/, so must be "res://res/cards/"
const CARD_DB_PATH = "res://res/cards/"

var all_cards: Array = []

func _ready():
	load_all_cards()

func load_all_cards():
	var dir = DirAccess.open(CARD_DB_PATH)
	if not dir:
		return
	dir.list_dir_begin()
	var file_name = dir.get_next()
	while file_name != "":
		if file_name.ends_with(".tres"):
			var card = load(CARD_DB_PATH + file_name)
			if card:
				all_cards.append(card)
		file_name = dir.get_next()
	dir.list_dir_end()

func get_card_by_id(card_id: String):
	for c in all_cards:
		if c.id == card_id:
			return c
	return null

func get_all_unit_cards() -> Array:
	var result: Array = []
	for c in all_cards:
		# BUG FIX: get_class() returns built-in Godot class name (e.g. "Resource"),
		# not the script class name. Must use "is UnitCardData" with class_name.
		if c is UnitCardData:
			result.append(c)
	return result

func get_all_spell_cards() -> Array:
	var result: Array = []
	for c in all_cards:
		if c is SpellCardData:  # BUG FIX: was get_class() check
			result.append(c)
	return result

func get_all_building_cards() -> Array:
	var result: Array = []
	for c in all_cards:
		if c is BuildingCardData:  # BUG FIX: was get_class() check
			result.append(c)
	return result

func get_starter_deck() -> Array:
	var deck: Array = []
	deck.append(get_card_by_id("soldier_1"))
	deck.append(get_card_by_id("soldier_1"))
	deck.append(get_card_by_id("tank_1"))
	deck.append(get_card_by_id("ranger_1"))
	deck.append(get_card_by_id("tower_1"))
	deck.append(get_card_by_id("soldier_2"))
	deck.append(get_card_by_id("fireball"))
	deck.append(get_card_by_id("barracks_1"))
	# Filter nulls in case any ID is missing
	deck = deck.filter(func(c): return c != null)
	return deck
