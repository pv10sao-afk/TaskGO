extends Node
class_name DeckManager

signal deck_updated

export(int) var hand_slots := 4

var deck: Array = []          # Array[CardData]
var hand: Array = []          # Array[CardData]

func _ready():
    # Ensure we always have at least 'hand_slots' items in hand when starting
    for i in range(hand_slots):
        hand.append(null)

func initialize(start_deck: Array):
    deck = start_deck.duplicate()
    deck.shuffle()
    hand.clear()
    for i in range(hand_slots):
        if deck.size() > 0:
            hand.append(deck.pop_front())
        else:
            hand.append(null)
    emit_signal("deck_updated")

func get_hand() -> Array:
    return hand

func can_play(index: int, current_elixir: int) -> bool:
    if index < 0 or index >= hand.size():
        return false
    var card = hand[index]
    if card == null:
        return false
    return current_elixir >= card.cost

func play_card(index: int) -> CardData:
    if index < 0 or index >= hand.size():
        return null
    var card: CardData = hand[index]
    if card == null:
        return null
    hand.remove(index)
    draw_card()
    emit_signal("deck_updated")
    return card

func draw_card():
    if deck.size() > 0:
        hand.append(deck.pop_front())
        emit_signal("deck_updated")

func add_card_to_deck(card: CardData):
    deck.append(card)
    emit_signal("deck_updated")
