class_name BuildingCardData
extends CardData  # BUG FIX: was "extends Node" — must extend CardData (Resource) to inherit base card fields

@export var hp: int = 500
@export var attack: int = 0
