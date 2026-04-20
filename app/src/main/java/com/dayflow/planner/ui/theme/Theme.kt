package com.dayflow.planner.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── Light (clean, airy) ───────────────────────────────────────────────────────
private val LightColors = lightColorScheme(
    primary          = PrimaryBlue,
    secondary        = AccentMint,
    tertiary         = AccentPeach,
    background       = SkyBlue,
    surface          = SurfaceWhite,
    surfaceVariant   = Color(0xFFF0F5FF),
    onPrimary        = SurfaceWhite,
    onSecondary      = Color(0xFF0A2A1A),
    onBackground     = TextPrimary,
    onSurface        = TextPrimary,
    onSurfaceVariant = TextSecondary,
    outline          = BorderSoft
)

// ── Dark (deep navy) ──────────────────────────────────────────────────────────
private val DarkColors = darkColorScheme(
    primary          = NightPrimary,
    secondary        = AccentMint,
    tertiary         = AccentPeach,
    background       = NightBackground,
    surface          = NightSurface,
    surfaceVariant   = Color(0xFF1E2D45),
    onPrimary        = NightText,
    onSecondary      = Color(0xFF0A2A1A),
    onBackground     = NightText,
    onSurface        = NightText,
    onSurfaceVariant = NightMuted,
    outline          = Color(0xFF2A3A55)
)

// ── Black (AMOLED pure black) ─────────────────────────────────────────────────
private val BlackColors = darkColorScheme(
    primary          = Color(0xFF7BA7FF),
    secondary        = AccentMint,
    tertiary         = AccentPeach,
    background       = PureBlackBackground,
    surface          = PureBlackSurface,
    surfaceVariant   = Color(0xFF1A1A1A),
    onPrimary        = NightText,
    onSecondary      = Color(0xFF0A2A1A),
    onBackground     = NightText,
    onSurface        = NightText,
    onSurfaceVariant = Color(0xFF888888),
    outline          = Color(0xFF222222)
)

// ── Blue (ocean depth) ────────────────────────────────────────────────────────
private val BlueColors = darkColorScheme(
    primary          = BlueThemePrimary,
    secondary        = Color(0xFF38D4FF),
    tertiary         = AccentPurple,
    background       = BlueThemeBackground,
    surface          = BlueThemeSurface,
    surfaceVariant   = Color(0xFF122558),
    onPrimary        = Color(0xFF001240),
    onSecondary      = Color(0xFF001A25),
    onBackground     = Color(0xFFD8E8FF),
    onSurface        = Color(0xFFD8E8FF),
    onSurfaceVariant = Color(0xFF8AABDE),
    outline          = Color(0xFF1E3560)
)

// ── Green (forest neon) ───────────────────────────────────────────────────────
private val GreenColors = darkColorScheme(
    primary          = GreenThemePrimary,
    secondary        = Color(0xFF38FFD4),
    tertiary         = AccentYellow,
    background       = GreenThemeBackground,
    surface          = GreenThemeSurface,
    surfaceVariant   = Color(0xFF10382A),
    onPrimary        = Color(0xFF002212),
    onSecondary      = Color(0xFF001A12),
    onBackground     = Color(0xFFCCF5E0),
    onSurface        = Color(0xFFCCF5E0),
    onSurfaceVariant = Color(0xFF72C49B),
    outline          = Color(0xFF164830)
)

// ── Red (volcanic dark) ───────────────────────────────────────────────────────
private val RedColors = darkColorScheme(
    primary          = RedThemePrimary,
    secondary        = AccentPeach,
    tertiary         = AccentYellow,
    background       = RedThemeBackground,
    surface          = RedThemeSurface,
    surfaceVariant   = Color(0xFF420B16),
    onPrimary        = Color(0xFF2A0008),
    onSecondary      = Color(0xFF2A0E00),
    onBackground     = Color(0xFFFFDDE3),
    onSurface        = Color(0xFFFFDDE3),
    onSurfaceVariant = Color(0xFFCC8090),
    outline          = Color(0xFF4E1020)
)

// ── Yellow (amber dusk) ───────────────────────────────────────────────────────
private val YellowColors = darkColorScheme(
    primary          = YellowThemePrimary,
    secondary        = AccentPeach,
    tertiary         = AccentMint,
    background       = YellowThemeBackground,
    surface          = YellowThemeSurface,
    surfaceVariant   = Color(0xFF3A3000),
    onPrimary        = Color(0xFF241A00),
    onSecondary      = Color(0xFF2A1500),
    onBackground     = Color(0xFFFFF3CC),
    onSurface        = Color(0xFFFFF3CC),
    onSurfaceVariant = Color(0xFFCCA855),
    outline          = Color(0xFF4A3C00)
)

@Composable
fun DayFlowTheme(
    themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    content: @Composable () -> Unit
) {
    val systemDark = isSystemInDarkTheme()
    val colorScheme = when (themeMode) {
        AppThemeMode.LIGHT  -> LightColors
        AppThemeMode.DARK   -> DarkColors
        AppThemeMode.BLACK  -> BlackColors
        AppThemeMode.BLUE   -> BlueColors
        AppThemeMode.GREEN  -> GreenColors
        AppThemeMode.RED    -> RedColors
        AppThemeMode.YELLOW -> YellowColors
        AppThemeMode.SYSTEM -> if (systemDark) DarkColors else LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography  = DayFlowTypography,
        content     = content
    )
}
