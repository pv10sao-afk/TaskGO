package com.cardtowerdefense;

/**
 * Interface for any entity that can receive damage.
 * Implemented by Unit and MainBase.
 */
public interface IDamageable {
    void takeDamage(int amount);
    boolean isDead();
    float getX();
    float getY();
    boolean isEnemy();
}
