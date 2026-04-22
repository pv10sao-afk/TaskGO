class_name UnitCardData
extends CardData  # BUG FIX: was "extends Node" — must extend CardData (Resource) to inherit base card fields

@export var hp: int = 100
@export var max_hp: int = 100
@export var dmg: int = 20
@export var speed: float = 120.0
