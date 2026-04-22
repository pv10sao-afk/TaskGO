class_name SpellCardData
extends CardData  # BUG FIX: was "extends Node" — must extend CardData (Resource) to inherit base card fields

@export var radius: float = 64.0
@export var damage: int = 20
