extends Control
class_name CardUI

var card: CardData

func _ready():
    # Visual setup could go here (icon, cost, etc.)
    pass

func set_card(p_card: CardData):
    card = p_card
    update()
func get_drag_data(position):
    if card:
        return {"type": "card", "card": card}
    return null

func can_drop_data(position, data): bool:
    return data is Dictionary and data.has("type") and data["type"] == "card"

func drop_data(position, data):
    if not data or not data.has("card"):
        return
    var dragged = data["card"]
    var mgr = get_node("/root/BattleManager") if has_node("/root/BattleManager") else null
    if mgr and mgr.has_method("deploy_card_at_lane"):
        mgr.call("deploy_card_at_lane", dragged, 0)
