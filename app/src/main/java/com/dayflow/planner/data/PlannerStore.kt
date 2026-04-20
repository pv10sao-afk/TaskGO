package com.dayflow.planner.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.dayflow.planner.ui.theme.AppThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

private val Context.plannerDataStore by preferencesDataStore(name = "dayflow_planner_state")

class PlannerStore(private val context: Context) {
    val appState: Flow<PlannerState> = context.plannerDataStore.data
        .catch { error ->
            if (error is IOException) {
                emit(emptyPreferences())
            } else {
                throw error
            }
        }
        .map { preferences ->
            PlannerStateJson.decode(preferences[STATE_KEY])
        }

    suspend fun toggleTask(taskId: Int) = updateState { state ->
        val existingTask = state.tasks.find { it.id == taskId } ?: return@updateState state
        val isCompleting = !existingTask.completed
        
        val newlyCreatedTasks = mutableListOf<PlannerTask>()
        if (isCompleting && existingTask.recurringMode != "NONE" && existingTask.deadlineMillis != null) {
            val nextDeadline = when (existingTask.recurringMode) {
                "DAILY" -> existingTask.deadlineMillis + 24 * 60 * 60 * 1000L
                "WEEKLY" -> existingTask.deadlineMillis + 7 * 24 * 60 * 60 * 1000L
                else -> existingTask.deadlineMillis
            }
            val nextId = (state.tasks.maxOfOrNull { it.id } ?: 0) + 1
            newlyCreatedTasks.add(
                existingTask.copy(
                    id = nextId,
                    deadlineMillis = nextDeadline,
                    completed = false
                )
            )
        }

        val updatedTasks = state.tasks.map { task ->
            if (task.id == taskId) task.copy(completed = isCompleting) else task
        }

        state.copy(tasks = updatedTasks + newlyCreatedTasks)
    }

    suspend fun deleteTask(taskId: Int) = updateState { state ->
        state.copy(tasks = state.tasks.filter { it.id != taskId })
    }

    suspend fun addTask(
        title: String,
        group: String,
        quadrant: Int,
        deadlineMillis: Long?,
        recurringMode: String
    ) = updateState { state ->
        val nextId = (state.tasks.maxOfOrNull { it.id } ?: 0) + 1
        val task = PlannerTask(
            id = nextId,
            title = title,
            group = group,
            deadlineMillis = deadlineMillis,
            recurringMode = recurringMode,
            note = "",
            quadrant = quadrant,
            completed = false
        )
        state.copy(tasks = listOf(task) + state.tasks)
    }

    suspend fun setThemeMode(themeMode: AppThemeMode) = updateState { state ->
        state.copy(themeMode = themeMode)
    }

    suspend fun setSelectedTab(tabName: String) = updateState { state ->
        state.copy(selectedTabName = tabName)
    }

    suspend fun toggleModule(moduleKey: ModuleKey) = updateState { state ->
        state.copy(
            modules = state.modules.map { module ->
                if (module.key == moduleKey) module.copy(enabled = !module.enabled) else module
            }
        )
    }

    suspend fun setTimerDuration(minutes: Int) = updateState { state ->
        state.copy(
            focusTimer = state.focusTimer.copy(
                durationMinutes = minutes,
                remainingMillis = minutes.toDurationMillis(),
                endAtMillis = 0L,
                isRunning = false
            )
        )
    }

    suspend fun startTimer(nowMillis: Long) = updateState { state ->
        val timer = state.focusTimer
        val remainingMillis = if (timer.remainingMillis > 0L) {
            timer.remainingMillis
        } else {
            timer.durationMinutes.toDurationMillis()
        }

        state.copy(
            focusTimer = timer.copy(
                isRunning = true,
                endAtMillis = nowMillis + remainingMillis,
                remainingMillis = remainingMillis
            )
        )
    }

    suspend fun pauseTimer(nowMillis: Long) = updateState { state ->
        val timer = state.focusTimer
        if (!timer.isRunning) {
            state
        } else {
            state.copy(
                focusTimer = timer.copy(
                    isRunning = false,
                    endAtMillis = 0L,
                    remainingMillis = timer.remainingAt(nowMillis)
                )
            )
        }
    }

    suspend fun resetTimer() = updateState { state ->
        val timer = state.focusTimer
        state.copy(
            focusTimer = timer.copy(
                isRunning = false,
                endAtMillis = 0L,
                remainingMillis = timer.durationMinutes.toDurationMillis()
            )
        )
    }

    suspend fun completeTimerSession() = updateState { state ->
        val timer = state.focusTimer
        if (!timer.isRunning) {
            state
        } else {
            state.copy(
                focusTimer = timer.copy(
                    isRunning = false,
                    endAtMillis = 0L,
                    remainingMillis = timer.durationMinutes.toDurationMillis(),
                    completedSessions = timer.completedSessions + 1,
                    focusedTodayMinutes = timer.focusedTodayMinutes + timer.durationMinutes
                )
            )
        }
    }

    private suspend fun updateState(transform: (PlannerState) -> PlannerState) {
        context.plannerDataStore.edit { preferences ->
            val currentState = PlannerStateJson.decode(preferences[STATE_KEY])
            preferences[STATE_KEY] = PlannerStateJson.encode(transform(currentState))
        }
        updateWidgets()
    }

    private fun updateWidgets() {
        val manager = android.appwidget.AppWidgetManager.getInstance(context)
        val widgetClasses = listOf(
            com.dayflow.planner.PlannerWidget::class.java,
            com.dayflow.planner.MiniWidget::class.java,
            com.dayflow.planner.FocusWidget::class.java
        )
        for (clazz in widgetClasses) {
            val ids = manager.getAppWidgetIds(android.content.ComponentName(context, clazz))
            if (ids.isNotEmpty()) {
                val intent = android.content.Intent(context, clazz).apply {
                    action = android.appwidget.AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
                context.sendBroadcast(intent)
            }
        }
    }

    companion object {
        private val STATE_KEY = stringPreferencesKey("planner_state_json")

        fun defaultState(): PlannerState = PlannerState(
            tasks = defaultTasks(),
            themeMode = AppThemeMode.SYSTEM,
            selectedTabName = "Today",
            modules = defaultModules(),
            focusTimer = FocusTimerState(
                durationMinutes = 25,
                remainingMillis = 25.toDurationMillis(),
                endAtMillis = 0L,
                isRunning = false,
                completedSessions = 0,
                focusedTodayMinutes = 0
            )
        )
    }
}

data class PlannerState(
    val tasks: List<PlannerTask>,
    val themeMode: AppThemeMode,
    val selectedTabName: String,
    val modules: List<ModulePreference>,
    val focusTimer: FocusTimerState
)

data class PlannerTask(
    val id: Int,
    val title: String,
    val group: String,
    val deadlineMillis: Long?,
    val recurringMode: String,
    val note: String,
    val quadrant: Int,
    val completed: Boolean
)

data class ModulePreference(
    val key: ModuleKey,
    val enabled: Boolean
)

enum class ModuleKey {
    TASKS,
    CALENDAR,
    MATRIX,
    FOCUS,
    HABITS,
    SETTINGS,
    COUNTDOWN,
    SEARCH,
    NOTIFICATIONS
}

data class FocusTimerState(
    val durationMinutes: Int,
    val remainingMillis: Long,
    val endAtMillis: Long,
    val isRunning: Boolean,
    val completedSessions: Int,
    val focusedTodayMinutes: Int
) {
    fun durationMillis(): Long = durationMinutes.toDurationMillis()

    fun remainingAt(nowMillis: Long): Long {
        return if (isRunning) {
            (endAtMillis - nowMillis).coerceAtLeast(0L)
        } else {
            remainingMillis.coerceAtLeast(0L)
        }
    }
}

private object PlannerStateJson {
    fun encode(state: PlannerState): String {
        return JSONObject().apply {
            put("themeMode", state.themeMode.name)
            put("selectedTabName", state.selectedTabName)
            put("tasks", JSONArray().apply {
                state.tasks.forEach { task ->
                    put(JSONObject().apply {
                        put("id", task.id)
                        put("title", task.title)
                        put("group", task.group)
                        if (task.deadlineMillis != null) {
                            put("deadlineMillis", task.deadlineMillis)
                        }
                        put("recurringMode", task.recurringMode)
                        put("note", task.note)
                        put("quadrant", task.quadrant)
                        put("completed", task.completed)
                    })
                }
            })
            put("modules", JSONArray().apply {
                state.modules.forEach { module ->
                    put(JSONObject().apply {
                        put("key", module.key.name)
                        put("enabled", module.enabled)
                    })
                }
            })
            put("focusTimer", JSONObject().apply {
                put("durationMinutes", state.focusTimer.durationMinutes)
                put("remainingMillis", state.focusTimer.remainingMillis)
                put("endAtMillis", state.focusTimer.endAtMillis)
                put("isRunning", state.focusTimer.isRunning)
                put("completedSessions", state.focusTimer.completedSessions)
                put("focusedTodayMinutes", state.focusTimer.focusedTodayMinutes)
            })
        }.toString()
    }

    fun decode(rawState: String?): PlannerState {
        if (rawState.isNullOrBlank()) {
            return PlannerStore.defaultState()
        }

        return try {
            val json = JSONObject(rawState)
            val defaultState = PlannerStore.defaultState()

            PlannerState(
                tasks = json.optJSONArray("tasks")?.toTaskList().orEmpty().ifEmpty { defaultState.tasks },
                themeMode = json.optString("themeMode")
                    .takeIf { it.isNotBlank() }
                    ?.let(::parseThemeMode)
                    ?: defaultState.themeMode,
                selectedTabName = json.optString("selectedTabName").ifBlank { defaultState.selectedTabName },
                modules = json.optJSONArray("modules")?.toModuleList().orEmpty().ifEmpty { defaultState.modules },
                focusTimer = json.optJSONObject("focusTimer")?.toTimerState() ?: defaultState.focusTimer
            )
        } catch (_: Exception) {
            PlannerStore.defaultState()
        }
    }

    private fun JSONArray.toTaskList(): List<PlannerTask> {
        return buildList {
            for (index in 0 until length()) {
                val item = optJSONObject(index) ?: continue
                val deadlineRaw = item.opt("deadlineMillis")
                val deadlineMillis = if (deadlineRaw is Number) deadlineRaw.toLong() else null
                add(
                    PlannerTask(
                        id = item.optInt("id"),
                        title = item.optString("title"),
                        group = item.optString("group"),
                        deadlineMillis = deadlineMillis,
                        recurringMode = item.optString("recurringMode", "NONE"),
                        note = item.optString("note"),
                        quadrant = item.optInt("quadrant", 2),
                        completed = item.optBoolean("completed")
                    )
                )
            }
        }
    }

    private fun JSONArray.toModuleList(): List<ModulePreference> {
        return buildList {
            for (index in 0 until length()) {
                val item = optJSONObject(index) ?: continue
                val keyName = item.optString("key")
                val key = runCatching { ModuleKey.valueOf(keyName) }.getOrNull() ?: continue
                add(ModulePreference(key = key, enabled = item.optBoolean("enabled", true)))
            }
        }
    }

    private fun JSONObject.toTimerState(): FocusTimerState {
        val durationMinutes = optInt("durationMinutes", 25)
        return FocusTimerState(
            durationMinutes = durationMinutes,
            remainingMillis = optLong("remainingMillis", durationMinutes.toDurationMillis()),
            endAtMillis = optLong("endAtMillis", 0L),
            isRunning = optBoolean("isRunning", false),
            completedSessions = optInt("completedSessions", 0),
            focusedTodayMinutes = optInt("focusedTodayMinutes", 0)
        )
    }

    private fun parseThemeMode(rawValue: String): AppThemeMode {
        return runCatching { AppThemeMode.valueOf(rawValue) }.getOrElse { AppThemeMode.SYSTEM }
    }
}

private fun Int.toDurationMillis(): Long = this * 60_000L

private fun defaultTasks(): List<PlannerTask> = emptyList()

private fun defaultModules(): List<ModulePreference> = listOf(
    ModulePreference(ModuleKey.TASKS, true),
    ModulePreference(ModuleKey.CALENDAR, true),
    ModulePreference(ModuleKey.MATRIX, true),
    ModulePreference(ModuleKey.FOCUS, true),
    ModulePreference(ModuleKey.HABITS, true),
    ModulePreference(ModuleKey.SETTINGS, true),
    ModulePreference(ModuleKey.COUNTDOWN, false),
    ModulePreference(ModuleKey.SEARCH, false),
    ModulePreference(ModuleKey.NOTIFICATIONS, false)
)
