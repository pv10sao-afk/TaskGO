extends Node

const CARD_DB_PATH = "res://cards/"

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
		if "UnitCardData" in c.get_class():
			result.append(c)
	return result

func get_all_spell_cards() -> Array:
	var result: Array = []
	for c in all_cards:
		if "SpellCardData" in c.get_class():
			result.append(c)
	return result

func get_all_building_cards() -> Array:
	var result: Array = []
	for c in all_cards:
		if "BuildingCardData" in c.get_class():
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
	return deck