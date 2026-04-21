package com.cardtowerdefense;

/**
 * Defines all unit/card types with their stats.
 * SPELL types (like FIREBALL) have hp = -1 (no unit is spawned; effect applied instantly).
 *
 * Special mechanics:
 *   MAGE       — on hit, applies FREEZE for 2s (target stops moving & attacking)
 *   DRAGON     — AoE fire: damages all enemies in 70px radius on each attack
 *   BOMBARDIER — AoE explosive: damages all enemies in 90px radius, slow projectile cadence
 */
public enum UnitType {

    // ── Original units ────────────────────────────────────────────────────────
    KNIGHT    ("Knight",     "⚔️",  3, 150,  25, 70f,  50f, false, SpecialAbility.NONE),
    GIANT     ("Giant",      "🛡️",  5, 400,  15, 35f,  55f, false, SpecialAbility.NONE),
    ARCHER    ("Archer",     "🏹",  2,  80,  18, 60f, 130f, false, SpecialAbility.NONE),
    FIREBALL  ("Fireball",   "🔥",  4,  -1, 150,  0f,  80f, true,  SpecialAbility.NONE),

    // ── New units ─────────────────────────────────────────────────────────────
    MAGE      ("Mage",       "🧙",  4, 100,  20, 55f, 120f, false, SpecialAbility.FREEZE),
    DRAGON    ("Dragon",     "🐉",  7, 350,  40, 45f,  90f, false, SpecialAbility.AOE_FIRE),
    BOMBARDIER("Bombardier", "💣",  6, 200,  60, 40f,  80f, false, SpecialAbility.AOE_BOMB);

    // ── Special ability enum ──────────────────────────────────────────────────
    public enum SpecialAbility {
        NONE,
        FREEZE,    // Mage: freezes target for 2 seconds on hit
        AOE_FIRE,  // Dragon: damages all enemies within aoeRadius on each attack
        AOE_BOMB   // Bombardier: damages all enemies within aoeRadius on each attack
    }

    // ── Display ──────────────────────────────────────────────────────────────
    public final String name;
    public final String icon;

    // ── Card / economy ────────────────────────────────────────────────────────
    public final int elixirCost;

    // ── Combat ───────────────────────────────────────────────────────────────
    /** Max HP. -1 for spells. */
    public final int maxHp;
    public final int damage;

    // ── Movement ─────────────────────────────────────────────────────────────
    public final float speed;

    // ── Attack ───────────────────────────────────────────────────────────────
    public final float range;

    // ── Flags ─────────────────────────────────────────────────────────────────
    public final boolean isSpell;
    public final SpecialAbility ability;

    // ── AoE radius (used by DRAGON and BOMBARDIER) ────────────────────────────
    public float aoeRadius() {
        switch (this) {
            case DRAGON:     return 70f;
            case BOMBARDIER: return 90f;
            case FIREBALL:   return range;
            default:         return 0f;
        }
    }

    // ── Freeze duration in seconds (MAGE) ─────────────────────────────────────
    public float freezeDuration() { return 2.0f; }

    // ── Attack cooldown (seconds) ─────────────────────────────────────────────
    public float attackCooldown() {
        switch (this) {
            case KNIGHT:     return 1.2f;
            case GIANT:      return 1.8f;
            case ARCHER:     return 0.9f;
            case MAGE:       return 1.5f;
            case DRAGON:     return 2.0f;
            case BOMBARDIER: return 2.5f;
            default:         return 0f;
        }
    }

    // ── Visual size ───────────────────────────────────────────────────────────
    public float halfW() {
        switch (this) {
            case GIANT:
            case DRAGON:     return 40f;
            case BOMBARDIER: return 34f;
            case KNIGHT:     return 30f;
            case MAGE:       return 28f;
            case ARCHER:     return 26f;
            default:         return 32f;
        }
    }

    public float halfH() { return halfW() * 1.2f; }

    // ── Constructor ───────────────────────────────────────────────────────────
    UnitType(String name, String icon, int elixirCost,
             int maxHp, int damage, float speed, float range,
             boolean isSpell, SpecialAbility ability) {
        this.name       = name;
        this.icon       = icon;
        this.elixirCost = elixirCost;
        this.maxHp      = maxHp;
        this.damage     = damage;
        this.speed      = speed;
        this.range      = range;
        this.isSpell    = isSpell;
        this.ability    = ability;
    }
}
