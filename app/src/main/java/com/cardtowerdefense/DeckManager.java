package com.cardtowerdefense;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;

/**
 * Manages the player's deck and 5-card hand.
 *
 * <ul>
 *   <li>Hand always contains exactly 5 cards.</li>
 *   <li>When a card is played, the next card from the queue cycles into that slot immediately.</li>
 *   <li>The queue is an infinite looping shuffle of all playable card types.</li>
 * </ul>
 */
public class DeckManager {

    // ── Configuration ─────────────────────────────────────────────────────────
    private static final int HAND_SIZE = 5;

    /** All card types available to the player (spells included). */
    private static final UnitType[] ALL_CARDS = {
        UnitType.KNIGHT, UnitType.KNIGHT, UnitType.KNIGHT,
        UnitType.GIANT,  UnitType.GIANT,
        UnitType.ARCHER, UnitType.ARCHER, UnitType.ARCHER,
        UnitType.FIREBALL, UnitType.FIREBALL,
        UnitType.MAGE,   UnitType.MAGE,
        UnitType.DRAGON,
        UnitType.BOMBARDIER, UnitType.BOMBARDIER
    };

    // ── State ─────────────────────────────────────────────────────────────────
    /** The 5 visible card slots; null means the slot is being filled (shouldn't happen in normal play). */
    private final UnitType[] hand = new UnitType[HAND_SIZE];

    /** Infinite queue backed by repeatedly shuffled copies of ALL_CARDS. */
    private final Deque<UnitType> queue = new ArrayDeque<>();

    // ── Constructor ───────────────────────────────────────────────────────────
    public DeckManager() {
        refillQueue();
        // Fill initial hand
        for (int i = 0; i < HAND_SIZE; i++) {
            hand[i] = drawFromQueue();
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Returns the card in the given hand slot (0–4). */
    public UnitType getCard(int slot) { return hand[slot]; }

    /** Returns the card at the top of the upcoming queue (displayed as "Next"). */
    public UnitType peekNext() { return queue.isEmpty() ? null : queue.peek(); }

    /**
     * Plays the card in {@code slot}.
     * Removes it from the hand and immediately replaces it from the queue.
     *
     * @return the {@link UnitType} that was played.
     */
    public UnitType playCard(int slot) {
        UnitType played = hand[slot];
        hand[slot] = drawFromQueue();
        return played;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private UnitType drawFromQueue() {
        if (queue.isEmpty()) refillQueue();
        return queue.poll();
    }

    private void refillQueue() {
        List<UnitType> list = new ArrayList<>();
        Collections.addAll(list, ALL_CARDS);
        Collections.shuffle(list);
        queue.addAll(list);
    }
}
