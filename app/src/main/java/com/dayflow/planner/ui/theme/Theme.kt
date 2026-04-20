package com.dayflow.planner.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = PrimaryBlue,
    secondary = AccentMint,
    tertiary = AccentPeach,
    background = SkyBlue,
    surface = SurfaceWhite,
    onPrimary = SurfaceWhite,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

private val DarkColors = darkColorScheme(
    primary = NightPrimary,
    secondary = AccentMint,
    tertiary = AccentPeach,
    background = NightBackground,
    surface = NightSurface,
    onPrimary = TextPrimary,
    onBackground = NightText,
    onSurface = NightText
)

private val BlackColors = darkColorScheme(
    primary = NightPrimary,
    secondary = AccentMint,
    tertiary = AccentPeach,
    background = PureBlackBackground,
    surface = PureBlackSurface,
    onPrimary = TextPrimary,
    onBackground = NightText,
    onSurface = NightText
)

private val BlueColors = darkColorScheme(
    primary = AccentBlue,
    secondary = AccentMint,
    tertiary = AccentPeach,
    background = BlueThemeBackground,
    surface = BlueThemeSurface,
    onPrimary = TextPrimary,
    onBackground = NightText,
    onSurface = NightText
)

private val GreenColors = darkColorScheme(
    primary = AccentMint,
    secondary = AccentBlue,
    tertiary = AccentPeach,
    background = GreenThemeBackground,
    surface = GreenThemeSurface,
    onPrimary = TextPrimary,
    onBackground = NightText,
    onSurface = NightText
)

private val RedColors = darkColorScheme(
    primary = AccentRose,
    secondary = AccentMint,
    tertiary = AccentPeach,
    background = RedThemeBackground,
    surface = RedThemeSurface,
    onPrimary = TextPrimary,
    onBackground = NightText,
    onSurface = NightText
)

private val YellowColors = darkColorScheme(
    primary = AccentYellow,
    secondary = AccentMint,
    tertiary = AccentPeach,
    background = YellowThemeBackground,
    surface = YellowThemeSurface,
    onPrimary = TextPrimary,
    onBackground = NightText,
    onSurface = NightText
)

@Composable
fun DayFlowTheme(
    themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    content: @Composable () -> Unit
) {
    val systemDark = isSystemInDarkTheme()
    val colorScheme = when (themeMode) {
        AppThemeMode.LIGHT -> LightColors
        AppThemeMode.DARK -> DarkColors
        AppThemeMode.BLACK -> BlackColors
        AppThemeMode.BLUE -> BlueColors
        AppThemeMode.GREEN -> GreenColors
        AppThemeMode.RED -> RedColors
        AppThemeMode.YELLOW -> YellowColors
        AppThemeMode.SYSTEM -> if (systemDark) DarkColors else LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = DayFlowTypography,
        content = content
    )
}

