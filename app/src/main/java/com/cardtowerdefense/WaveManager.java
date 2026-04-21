package com.cardtowerdefense;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Drives scripted enemy waves with improved AI.
 *
 * AI improvements
 * ───────────────
 *   1. LANE PRESSURE  — detects which lanes have the most player units and
 *                       sends enemies there to apply counter-pressure.
 *   2. COUNTER-UNITS  — if player has many Mages/Archers (ranged), AI sends
 *                       Giants/Dragons to tank; if player has many Giants,
 *                       AI sends Bombardiers to AoE them down.
 *   3. FLANKING       — every 3rd sudden-death wave spawns on the LEAST
 *                       defended lanes instead of the most.
 *
 * Wave script
 * ───────────
 *    5 s → 2 Knights on random lanes
 *   20 s → 1 Giant + 2 Knights
 *   40 s → 3 Knights + 2 Giants spread across lanes
 *   60 s → SUDDEN DEATH: 6 enemies rapidly, double elixir regen
 *          Every 8 s after: AI-chosen composition based on player army
 */
public class WaveManager {

    // ── Dependencies ─────────────────────────────────────────────────────────
    private final List<Unit> unitList;
    private final float      screenW;
    private final float      spawnY;
    private final int        laneCount;

    // ── Timing ───────────────────────────────────────────────────────────────
    private float   elapsed           = 0f;
    private int     waveIndex         = 0;
    private boolean suddenDeath       = false;
    private float   suddenDeathTimer  = 0f;
    private int     suddenDeathCount  = 0;   // counts SD waves for flanking
    private static final float SUDDEN_DEATH_INTERVAL = 8f;

    // ── Elixir multiplier ─────────────────────────────────────────────────────
    private float elixirRegenMultiplier = 1.0f;

    // ── Wave script ───────────────────────────────────────────────────────────
    private static final float[] WAVE_TIMES = { 5f, 20f, 40f, 60f };

    private final Random rng = new Random();

    // ── Constructor ───────────────────────────────────────────────────────────
    public WaveManager(List<Unit> unitList, float screenW, int laneCount, float spawnY) {
        this.unitList  = unitList;
        this.screenW   = screenW;
        this.laneCount = laneCount;
        this.spawnY    = spawnY;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    public void update(float dt) {
        elapsed += dt;

        while (waveIndex < WAVE_TIMES.length && elapsed >= WAVE_TIMES[waveIndex]) {
            triggerWave(waveIndex);
            waveIndex++;
        }

        if (suddenDeath) {
            suddenDeathTimer -= dt;
            if (suddenDeathTimer <= 0f) {
                spawnSuddenDeathWave();
                suddenDeathTimer = SUDDEN_DEATH_INTERVAL;
                suddenDeathCount++;
            }
        }
    }

    // ── Accessors ─────────────────────────────────────────────────────────────
    public float   getElixirRegenMultiplier() { return elixirRegenMultiplier; }
    public boolean isSuddenDeath()            { return suddenDeath; }
    public int     getWaveNumber()            { return waveIndex; }

    // ── Scripted waves ────────────────────────────────────────────────────────
    private void triggerWave(int index) {
        switch (index) {
            case 0:  // 5s
                spawnEnemies(buildList(UnitType.KNIGHT, 2), randomLanes(2));
                break;
            case 1:  // 20s
                spawnEnemies(buildList(UnitType.GIANT, 1, UnitType.KNIGHT, 2), randomLanes(3));
                break;
            case 2:  // 40s
                List<UnitType> w3 = buildList(UnitType.KNIGHT, 3, UnitType.GIANT, 2);
                spawnEnemies(w3, spreadLanes(w3.size()));
                break;
            case 3:  // 60s — SUDDEN DEATH
                suddenDeath           = true;
                elixirRegenMultiplier = 2.0f;
                suddenDeathTimer      = 0f;
                break;
        }
    }

    // ── AI-driven sudden death ────────────────────────────────────────────────
    private void spawnSuddenDeathWave() {
        List<UnitType> composition = buildAiComposition();
        int[] lanes;

        // Every 3rd SD wave: FLANK (least defended lanes)
        if (suddenDeathCount % 3 == 2) {
            lanes = leastDefendedLanes(composition.size());
        } else {
            lanes = mostPressuredLanes(composition.size());
        }

        spawnEnemies(composition, lanes);
    }

    /**
     * Analyses the current player army and picks a counter-composition.
     *
     * Rules:
     *   - Many ranged units (Archer, Mage) → send Giants + Dragon to tank through them
     *   - Many tanks (Giant) → send Bombardiers to AoE
     *   - Player has Mages → send Dragons (immune flavour; high HP absorbs freeze)
     *   - Default → balanced mix
     */
    private List<UnitType> buildAiComposition() {
        int playerRanged = 0, playerTanks = 0, playerMages = 0;

        for (Unit u : unitList) {
            if (u.isDead() || u.isEnemy()) continue;
            switch (u.getType()) {
                case ARCHER: case MAGE: playerRanged++; break;
                case GIANT:             playerTanks++;  break;
                default: break;
            }
            if (u.getType() == UnitType.MAGE) playerMages++;
        }

        List<UnitType> comp = new ArrayList<>();

        if (playerMages >= 2) {
            // Player spamming freeze → counter with high-HP Dragons
            comp.add(UnitType.DRAGON);
            comp.add(UnitType.GIANT);
            comp.add(UnitType.KNIGHT);
            comp.add(UnitType.KNIGHT);
            comp.add(UnitType.GIANT);
            comp.add(UnitType.DRAGON);
        } else if (playerTanks >= 3) {
            // Player turtling with Giants → Bombardiers break clusters
            comp.add(UnitType.BOMBARDIER);
            comp.add(UnitType.KNIGHT);
            comp.add(UnitType.BOMBARDIER);
            comp.add(UnitType.ARCHER);
            comp.add(UnitType.KNIGHT);
            comp.add(UnitType.BOMBARDIER);
        } else if (playerRanged >= 3) {
            // Player has lots of ranged → Giants + Dragon to rush through
            comp.add(UnitType.GIANT);
            comp.add(UnitType.DRAGON);
            comp.add(UnitType.GIANT);
            comp.add(UnitType.KNIGHT);
            comp.add(UnitType.GIANT);
            comp.add(UnitType.KNIGHT);
        } else {
            // Balanced
            UnitType[] pool = {
                UnitType.KNIGHT, UnitType.ARCHER, UnitType.GIANT,
                UnitType.MAGE, UnitType.BOMBARDIER, UnitType.DRAGON
            };
            for (int i = 0; i < 6; i++) comp.add(pool[rng.nextInt(pool.length)]);
        }

        return comp;
    }

    // ── Lane intelligence ─────────────────────────────────────────────────────

    /**
     * Returns lanes with the MOST player units — apply pressure there.
     */
    private int[] mostPressuredLanes(int n) {
        int[] counts = laneCounts(false);
        return topNLanes(counts, n, true);
    }

    /**
     * Returns lanes with the FEWEST player units — flank the weak side.
     */
    private int[] leastDefendedLanes(int n) {
        int[] counts = laneCounts(false);
        return topNLanes(counts, n, false);
    }

    /** Count player (or enemy) units per lane. */
    private int[] laneCounts(boolean countEnemy) {
        int[] counts = new int[laneCount];
        float laneW  = screenW / laneCount;
        for (Unit u : unitList) {
            if (u.isDead() || u.isEnemy() != countEnemy) continue;
            int lane = Math.max(0, Math.min(laneCount - 1, (int)(u.getX() / laneW)));
            counts[lane]++;
        }
        return counts;
    }

    /** Return top-n lane indices sorted by count (descending if highest=true). */
    private int[] topNLanes(int[] counts, int n, boolean highest) {
        n = Math.min(n, laneCount);
        // simple insertion sort on lane indices
        Integer[] indices = new Integer[laneCount];
        for (int i = 0; i < laneCount; i++) indices[i] = i;
        for (int i = 1; i < laneCount; i++) {
            int key = indices[i];
            int j   = i - 1;
            while (j >= 0 && (highest
                    ? counts[indices[j]] < counts[key]
                    : counts[indices[j]] > counts[key])) {
                indices[j + 1] = indices[j];
                j--;
            }
            indices[j + 1] = key;
        }
        // Fill remaining random if ties
        int[] result = new int[n];
        for (int i = 0; i < n; i++) result[i] = indices[i % laneCount];
        return result;
    }

    // ── Spawn helpers ─────────────────────────────────────────────────────────
    private void spawnEnemies(List<UnitType> types, int[] lanes) {
        float laneW = screenW / laneCount;
        for (int i = 0; i < Math.min(types.size(), lanes.length); i++) {
            float cx = lanes[i] * laneW + laneW * 0.5f;
            unitList.add(new Unit(types.get(i), true, cx, spawnY));
        }
    }

    private int[] randomLanes(int n) {
        n = Math.min(n, laneCount);
        int[] all = new int[laneCount];
        for (int i = 0; i < laneCount; i++) all[i] = i;
        for (int i = 0; i < n; i++) {
            int j = i + rng.nextInt(laneCount - i);
            int tmp = all[i]; all[i] = all[j]; all[j] = tmp;
        }
        int[] result = new int[n];
        System.arraycopy(all, 0, result, 0, n);
        return result;
    }

    private int[] spreadLanes(int n) {
        n = Math.min(n, laneCount);
        int[] result = new int[n];
        float step   = (float)(laneCount - 1) / Math.max(1, n - 1);
        for (int i = 0; i < n; i++) result[i] = Math.round(i * step);
        return result;
    }

    private List<UnitType> buildList(Object... args) {
        List<UnitType> list = new ArrayList<>();
        for (int i = 0; i < args.length - 1; i += 2) {
            UnitType t = (UnitType) args[i];
            int      n = (int)     args[i + 1];
            for (int j = 0; j < n; j++) list.add(t);
        }
        return list;
    }
}
