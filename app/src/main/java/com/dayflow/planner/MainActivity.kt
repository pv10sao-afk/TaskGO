@file:OptIn(
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
    androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.dayflow.planner

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Alarm
import androidx.compose.material.icons.rounded.ArrowBackIosNew
import androidx.compose.material.icons.rounded.ArrowForwardIos
import androidx.compose.material.icons.rounded.AutoGraph
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircleOutline
import androidx.compose.material.icons.rounded.Coffee
import androidx.compose.material.icons.rounded.DashboardCustomize
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material.icons.rounded.RocketLaunch
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.TaskAlt
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.ViewWeek
import androidx.compose.material3.AlertDialogDefaults
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.rounded.Search
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import java.text.SimpleDateFormat
import java.util.Locale
import com.dayflow.planner.data.PlannerHabit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dayflow.planner.data.FocusTimerState
import com.dayflow.planner.data.ModuleKey
import com.dayflow.planner.data.ModulePreference
import com.dayflow.planner.data.PlannerState
import com.dayflow.planner.data.PlannerStore
import com.dayflow.planner.data.PlannerTask
import com.dayflow.planner.ui.theme.AccentBlue
import com.dayflow.planner.ui.theme.AccentMint
import com.dayflow.planner.ui.theme.AccentPeach
import com.dayflow.planner.ui.theme.AccentPurple
import com.dayflow.planner.ui.theme.AccentRose
import com.dayflow.planner.ui.theme.AccentYellow
import com.dayflow.planner.ui.theme.AppThemeMode
import com.dayflow.planner.ui.theme.BorderSoft
import com.dayflow.planner.ui.theme.DayFlowTheme
import com.dayflow.planner.ui.theme.SkyBlue
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Calendar
import kotlin.math.max

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Create notification channel once on startup
        createNotificationChannel(this)
        // Request notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
        setContent {
            PlannerRoot()
        }
    }
}

private enum class PlannerTab(
    val title: String,
    val icon: ImageVector
) {
    Today("Сьогодні", Icons.Rounded.TaskAlt),
    Calendar("Календар", Icons.Rounded.CalendarMonth),
    Matrix("Матриця", Icons.Rounded.GridView),
    Focus("Фокус", Icons.Rounded.Timer),
    Habits("Звички", Icons.Rounded.AutoGraph),
    Search("Пошук", Icons.Rounded.Search),
    More("Ще", Icons.Rounded.MoreHoriz)
}

private data class CategoryChip(
    val title: String,
    val count: Int,
    val tint: Color
)

private data class AgendaItem(
    val title: String,
    val dayIndex: Int,
    val startHour: Float,
    val endHour: Float,
    val tint: Color
)

private data class FocusStat(
    val label: String,
    val value: String,
    val tint: Color
)

private data class ModuleUiItem(
    val key: ModuleKey,
    val title: String,
    val subtitle: String,
    val enabled: Boolean,
    val icon: ImageVector
)

@Composable
private fun HabitsScreen(
    habits: List<PlannerHabit>,
    onAddHabit: (String) -> Unit,
    onDeleteHabit: (Int) -> Unit,
    onToggleDate: (Int, String) -> Unit
) {
    var newHabitName by rememberSaveable { mutableStateOf("") }
    
    val past7Days = remember {
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val displayFormat = SimpleDateFormat("EE", Locale.getDefault())
        val days = mutableListOf<Pair<String, String>>()
        for (i in 6 downTo 0) {
            val cal = Calendar.getInstance()
            cal.add(Calendar.DAY_OF_YEAR, -i)
            days.add(format.format(cal.time) to displayFormat.format(cal.time))
        }
        days
    }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            HeaderBlock(
                title = "Звички",
                subtitle = "Відстежуй свій прогрес щодня"
            )
        }

        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = newHabitName,
                        onValueChange = { newHabitName = it },
                        modifier = Modifier.weight(1f),
                        label = { Text("Нова звичка") },
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    IconButton(
                        onClick = {
                            if (newHabitName.isNotBlank()) {
                                onAddHabit(newHabitName.trim())
                                newHabitName = ""
                            }
                        },
                        modifier = Modifier.background(MaterialTheme.colorScheme.primary, CircleShape)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = "Додати", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                }
            }
        }

        if (habits.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("У вас поки немає звичок.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        items(habits) { habit ->
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(habit.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                        IconButton(onClick = { onDeleteHabit(habit.id) }) {
                            Icon(Icons.Rounded.Delete, contentDescription = "Видалити", tint = AccentRose)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        past7Days.forEach { (dateStr, displayStr) ->
                            val isCompleted = habit.completedDates.contains(dateStr)
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(if (isCompleted) MaterialTheme.colorScheme.primary else Color.Transparent)
                                        .clickable { onToggleDate(habit.id, dateStr) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = displayStr.take(1).uppercase(),
                                        color = if (isCompleted) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(modifier = Modifier.height(72.dp)) }
    }
}

@Composable
private fun SearchScreen(
    tasks: List<PlannerTask>,
    nowMillis: Long,
    onToggleTask: (Int) -> Unit,
    onDeleteTask: (Int) -> Unit,
    onEditTask: (PlannerTask) -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }
    var sortBy by rememberSaveable { mutableStateOf("date") }

    val filteredTasks = remember(tasks, query, sortBy) {
        val q = query.trim().lowercase()
        val filtered = if (q.isEmpty()) {
            tasks
        } else {
            tasks.filter {
                it.title.lowercase().contains(q) ||
                it.group.lowercase().contains(q) ||
                it.note.lowercase().contains(q)
            }
        }
        when (sortBy) {
            "date" -> filtered.sortedWith(compareBy<PlannerTask> { it.completed }.thenBy { it.deadlineMillis ?: Long.MAX_VALUE })
            "priority" -> filtered.sortedWith(compareBy<PlannerTask> { it.completed }.thenBy { it.quadrant })
            "group" -> filtered.sortedWith(compareBy<PlannerTask> { it.completed }.thenBy { it.group })
            else -> filtered
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            HeaderBlock(
                title = "Пошук та фільтри",
                subtitle = "Знайдіть потрібну задачу серед усіх"
            )
        }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Пошук...") },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                singleLine = true
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    "date" to "За датою",
                    "priority" to "За пріоритетом",
                    "group" to "За групою"
                ).forEach { (key, label) ->
                    AssistChip(
                        onClick = { sortBy = key },
                        label = { Text(label) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = if (sortBy == key) MaterialTheme.colorScheme.primary.copy(alpha = 0.24f) else MaterialTheme.colorScheme.surface
                        )
                    )
                }
            }
        }
        if (filteredTasks.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Задач не знайдено", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        items(filteredTasks) { task ->
            TaskCard(
                task = task,
                nowMillis = nowMillis,
                onToggle = { onToggleTask(task.id) },
                onDelete = { onDeleteTask(task.id) },
                onEdit = { onEditTask(task) }
            )
        }
        item { Spacer(modifier = Modifier.height(72.dp)) }
    }
}

@Composable
private fun PlannerRoot() {
    val context = LocalContext.current
    val plannerStore = remember { PlannerStore(context.applicationContext) }
    val appState by plannerStore.appState.collectAsState(initial = PlannerStore.defaultState())
    val scope = rememberCoroutineScope()
    val currentTab = PlannerTab.entries.find { it.name == appState.selectedTabName } ?: PlannerTab.Today

    // If the active tab's module gets disabled, redirect to Today tab
    LaunchedEffect(appState.modules) {
        val moduleStates = appState.modules.associateBy({ it.key }, { it.enabled })
        val currentTabDisabled = when (currentTab) {
            PlannerTab.Calendar -> moduleStates[ModuleKey.CALENDAR] == false
            PlannerTab.Matrix   -> moduleStates[ModuleKey.MATRIX] == false
            PlannerTab.Focus    -> moduleStates[ModuleKey.FOCUS] == false
            PlannerTab.Habits   -> moduleStates[ModuleKey.HABITS] == false
            PlannerTab.Search   -> moduleStates[ModuleKey.SEARCH] == false
            else -> false
        }
        if (currentTabDisabled) {
            plannerStore.setSelectedTab(PlannerTab.Today.name)
        }
    }
    var showNewTaskSheet by rememberSaveable { mutableStateOf(false) }
    var taskToEdit by remember { mutableStateOf<PlannerTask?>(null) }
    // Ticks every second always – used for deadline countdowns in TaskCards
    val tickMillis by produceState(initialValue = System.currentTimeMillis()) {
        while (true) {
            value = System.currentTimeMillis()
            delay(1_000L)
        }
    }
    // Ticks every second when focus timer running, else every 15s – used for focus timer display
    val nowMillis by produceState(
        initialValue = System.currentTimeMillis(),
        key1 = appState.focusTimer.isRunning
    ) {
        while (true) {
            value = System.currentTimeMillis()
            delay(if (appState.focusTimer.isRunning) 1_000L else 15_000L)
        }
    }
    val timerRemaining = appState.focusTimer.remainingAt(nowMillis)

    LaunchedEffect(appState.focusTimer.isRunning, timerRemaining) {
        if (appState.focusTimer.isRunning && timerRemaining == 0L) {
            plannerStore.completeTimerSession()
        }
    }

    DayFlowTheme(themeMode = appState.themeMode) {
        DayFlowApp(
            appState = appState,
            currentTab = currentTab,
            nowMillis = nowMillis,
            tickMillis = tickMillis,
            onSelectTab = { tab ->
                scope.launch {
                    plannerStore.setSelectedTab(tab.name)
                }
            },
            onToggleTask = { taskId ->
                scope.launch {
                    plannerStore.toggleTask(taskId)
                }
            },
            onDeleteTask = { taskId ->
                scope.launch {
                    plannerStore.deleteTask(taskId)
                }
            },
            onEditTask = { task ->
                taskToEdit = task
                showNewTaskSheet = true
            },
            onSaveTask = { title, group, quadrant, deadlineMillis, recurringMode, note ->
                scope.launch {
                    if (taskToEdit != null) {
                        plannerStore.editTask(taskToEdit!!.id, title, group, quadrant, deadlineMillis, recurringMode, note)
                    } else {
                        plannerStore.addTask(title, group, quadrant, deadlineMillis, recurringMode, note)
                    }
                }
            },
            onToggleModule = { key ->
                scope.launch {
                    plannerStore.toggleModule(key)
                }
            },
            onThemeChange = { mode ->
                scope.launch {
                    plannerStore.setThemeMode(mode)
                }
            },
            onStartPauseTimer = {
                scope.launch { 
                    if (appState.focusTimer.isRunning) plannerStore.pauseTimer(nowMillis)
                    else plannerStore.startTimer(nowMillis)
                }
            },
            onResetTimer = {
                scope.launch { plannerStore.resetTimer() }
            },
            onSetTimerDuration = { duration ->
                scope.launch { plannerStore.setTimerDuration(duration) }
            },
            onAddHabit = { title ->
                scope.launch { plannerStore.addHabit(title) }
            },
            onDeleteHabit = { id ->
                scope.launch { plannerStore.deleteHabit(id) }
            },
            onToggleHabitDate = { id, dateStr ->
                scope.launch { plannerStore.toggleHabitDate(id, dateStr) }
            },
            showEditTaskSheet = showNewTaskSheet,
            taskToEdit = taskToEdit,
            onShowEditTaskSheet = { 
                taskToEdit = null
                showNewTaskSheet = true 
            },
            onDismissEditTaskSheet = { 
                showNewTaskSheet = false 
                taskToEdit = null
            }
        )
    }
}

@Composable
private fun DayFlowApp(
    appState: PlannerState,
    currentTab: PlannerTab,
    nowMillis: Long,
    tickMillis: Long,
    onSelectTab: (PlannerTab) -> Unit,
    onToggleTask: (Int) -> Unit,
    onDeleteTask: (Int) -> Unit,
    onEditTask: (PlannerTask) -> Unit,
    onSaveTask: (String, String, Int, Long?, String, String) -> Unit,
    onToggleModule: (ModuleKey) -> Unit,
    onThemeChange: (AppThemeMode) -> Unit,
    onStartPauseTimer: () -> Unit,
    onResetTimer: () -> Unit,
    onSetTimerDuration: (Int) -> Unit,
    onAddHabit: (String) -> Unit,
    onDeleteHabit: (Int) -> Unit,
    onToggleHabitDate: (Int, String) -> Unit,
    showEditTaskSheet: Boolean,
    taskToEdit: PlannerTask?,
    onShowEditTaskSheet: () -> Unit,
    onDismissEditTaskSheet: () -> Unit
) {
    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            PlannerBottomBar(
                currentTab = currentTab,
                modules = appState.modules,
                onSelect = onSelectTab
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onShowEditTaskSheet,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.background
            ) {
                Icon(Icons.Rounded.Add, contentDescription = "Нова задача")
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.background,
                            MaterialTheme.colorScheme.background.copy(alpha = 0.95f),
                            SkyBlue.copy(alpha = 0.35f)
                        )
                    )
                )
                .padding(innerPadding)
        ) {
            when (currentTab) {
                PlannerTab.Today -> TodayScreen(
                    tasks = appState.tasks,
                    timerLabel = formatTimer(appState.focusTimer.remainingAt(nowMillis)),
                    nowMillis = tickMillis,
                    onToggleTask = onToggleTask,
                    onDeleteTask = onDeleteTask,
                    onEditTask = onEditTask
                )

                PlannerTab.Calendar -> CalendarScreen(
                    tasks = appState.tasks,
                    onToggleTask = onToggleTask,
                    onDeleteTask = onDeleteTask,
                    onEditTask = onEditTask
                )
                PlannerTab.Matrix -> MatrixScreen(tasks = appState.tasks)
                PlannerTab.Focus -> FocusScreen(
                    tasks = appState.tasks,
                    timerState = appState.focusTimer,
                    nowMillis = nowMillis,
                    habitsEnabled = appState.modules.find { it.key == ModuleKey.HABITS }?.enabled == true,
                    onStartPause = onStartPauseTimer,
                    onReset = onResetTimer,
                    onSelectDuration = onSetTimerDuration
                )
                PlannerTab.Habits -> HabitsScreen(
                    habits = appState.habits,
                    onAddHabit = onAddHabit,
                    onDeleteHabit = onDeleteHabit,
                    onToggleDate = onToggleHabitDate
                )
                PlannerTab.Search -> SearchScreen(
                    tasks = appState.tasks,
                    nowMillis = tickMillis,
                    onToggleTask = onToggleTask,
                    onDeleteTask = onDeleteTask,
                    onEditTask = onEditTask
                )

                PlannerTab.More -> MoreScreen(
                    modules = appState.modules,
                    themeMode = appState.themeMode,
                    onToggleModule = onToggleModule,
                    onThemeChange = onThemeChange
                )
            }
        }
    }

    if (showEditTaskSheet) {
        TaskEditSheet(
            taskToEdit = taskToEdit,
            onDismiss = onDismissEditTaskSheet,
            onSaveTask = { title, group, quadrant, deadlineMillis, recurringMode, note ->
                onSaveTask(title, group, quadrant, deadlineMillis, recurringMode, note)
                onDismissEditTaskSheet()
            }
        )
    }
}

@Composable
private fun PlannerBottomBar(
    currentTab: PlannerTab,
    modules: List<ModulePreference>,
    onSelect: (PlannerTab) -> Unit
) {
    val activeTabs = remember(modules) {
        val states = modules.associateBy({ it.key }, { it.enabled })
        PlannerTab.entries.filter { tab ->
            when (tab) {
                PlannerTab.Today -> states[ModuleKey.TASKS] != false
                PlannerTab.Calendar -> states[ModuleKey.CALENDAR] != false
                PlannerTab.Matrix -> states[ModuleKey.MATRIX] != false
                PlannerTab.Focus -> states[ModuleKey.FOCUS] != false
                PlannerTab.Habits -> states[ModuleKey.HABITS] != false
                PlannerTab.Search -> states[ModuleKey.SEARCH] == true
                PlannerTab.More -> true
            }
        }
    }

    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f),
        tonalElevation = 12.dp
    ) {
        activeTabs.forEach { tab ->
            NavigationBarItem(
                selected = tab == currentTab,
                onClick = { onSelect(tab) },
                icon = { Icon(tab.icon, contentDescription = tab.title) },
                label = { Text(tab.title, maxLines = 1) }
            )
        }
    }
}

@Composable
private fun TodayScreen(
    tasks: List<PlannerTask>,
    timerLabel: String,
    nowMillis: Long,
    onToggleTask: (Int) -> Unit,
    onDeleteTask: (Int) -> Unit,
    onEditTask: (PlannerTask) -> Unit
) {
    val categories = remember(tasks) { buildCategories(tasks) }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            HeaderBlock(
                title = "Плануй день спокійно",
                subtitle = "Усе зберігається на телефоні: задачі, тема, вкладки та фокус-сесії"
            )
        }

        item {
            QuoteCard()
        }

        item {
            CategoryStrip(categories = categories)
        }

        item {
            SectionHeader(
                title = "Сьогодні",
                action = "${tasks.count { it.completed }}/${tasks.size}"
            )
        }

        items(tasks) { task ->
            TaskCard(
                task = task, 
                nowMillis = nowMillis, 
                onToggle = { onToggleTask(task.id) },
                onDelete = { onDeleteTask(task.id) },
                onEdit = { onEditTask(task) }
            )
        }

        item {
            SectionHeader(title = "Швидкі віджети", action = null)
        }

        item {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                maxItemsInEachRow = 2
            ) {
                MiniStatCard(
                    modifier = Modifier.width(160.dp),
                    title = "Фокус",
                    value = timerLabel,
                    accent = MaterialTheme.colorScheme.primary,
                    icon = Icons.Rounded.PlayArrow
                )
                MiniStatCard(
                    modifier = Modifier.width(160.dp),
                    title = "Автозбереження",
                    value = "Увімк.",
                    accent = AccentMint,
                    icon = Icons.Rounded.Save
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(72.dp))
        }
    }
}

@Composable
private fun CalendarScreen(
    tasks: List<PlannerTask>,
    onToggleTask: (Int) -> Unit,
    onDeleteTask: (Int) -> Unit,
    onEditTask: (PlannerTask) -> Unit
) {
    val monthNames = listOf("Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень")
    val today = remember { Calendar.getInstance() }

    // State: current displayed month/year
    var displayYear by remember { mutableStateOf(today.get(Calendar.YEAR)) }
    var displayMonth by remember { mutableStateOf(today.get(Calendar.MONTH)) }

    // State: selected day (day of month, or -1 = none)
    var selectedDay by remember { mutableStateOf(today.get(Calendar.DAY_OF_MONTH)) }

    // Compute days in displayed month
    val daysInMonth = remember(displayYear, displayMonth) {
        val c = Calendar.getInstance()
        c.set(displayYear, displayMonth, 1)
        c.getActualMaximum(Calendar.DAY_OF_MONTH)
    }
    // Day of week for 1st of displayed month (Mon=0 ... Sun=6)
    val firstDayOffset = remember(displayYear, displayMonth) {
        val c = Calendar.getInstance()
        c.set(displayYear, displayMonth, 1)
        (c.get(Calendar.DAY_OF_WEEK) + 5) % 7
    }

    // Tasks for selected day
    val selectedTasks = remember(tasks, displayYear, displayMonth, selectedDay) {
        tasks.filter { task ->
            if (task.deadlineMillis == null) return@filter false
            val tc = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
            tc.get(Calendar.YEAR) == displayYear &&
            tc.get(Calendar.MONTH) == displayMonth &&
            tc.get(Calendar.DAY_OF_MONTH) == selectedDay
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            HeaderBlock(
                title = "Календар",
                subtitle = "Обирай день щоб побачити свої задачі"
            )
        }

        item {
            // Month navigation header
            Card(
                shape = RoundedCornerShape(32.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    // Month selector row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            if (displayMonth == 0) { displayMonth = 11; displayYear-- }
                            else displayMonth--
                            selectedDay = 1
                        }) {
                            Icon(Icons.Rounded.ArrowBackIosNew, contentDescription = "Попередній місяц", tint = MaterialTheme.colorScheme.primary)
                        }
                        Text(
                            text = "${monthNames[displayMonth]} $displayYear",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        IconButton(onClick = {
                            if (displayMonth == 11) { displayMonth = 0; displayYear++ }
                            else displayMonth++
                            selectedDay = 1
                        }) {
                            Icon(Icons.Rounded.ArrowForwardIos, contentDescription = "Наступний місяц", tint = MaterialTheme.colorScheme.primary)
                        }
                    }

                    // Days of week header
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        listOf("ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "НД").forEach { d ->
                            Text(
                                text = d,
                                modifier = Modifier.width(40.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }

                    // Calendar grid
                    val totalCells = firstDayOffset + daysInMonth
                    val rows = (totalCells + 6) / 7
                    for (row in 0 until rows) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            for (col in 0 until 7) {
                                val cellIndex = row * 7 + col
                                val dayNum = cellIndex - firstDayOffset + 1
                                val isValid = dayNum in 1..daysInMonth
                                val isToday = isValid &&
                                    dayNum == today.get(Calendar.DAY_OF_MONTH) &&
                                    displayMonth == today.get(Calendar.MONTH) &&
                                    displayYear == today.get(Calendar.YEAR)
                                val isSelected = isValid && dayNum == selectedDay
                                val hasTasks = isValid && tasks.any { task ->
                                    if (task.deadlineMillis == null) return@any false
                                    val tc = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
                                    tc.get(Calendar.YEAR) == displayYear &&
                                    tc.get(Calendar.MONTH) == displayMonth &&
                                    tc.get(Calendar.DAY_OF_MONTH) == dayNum
                                }

                                Box(
                                    modifier = Modifier
                                        .width(40.dp)
                                        .height(44.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                isSelected -> MaterialTheme.colorScheme.primary
                                                isToday -> MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                                else -> Color.Transparent
                                            }
                                        )
                                        .then(if (isValid) Modifier.clickable { selectedDay = dayNum } else Modifier),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isValid) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(
                                                text = dayNum.toString(),
                                                fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                                                color = if (isSelected) MaterialTheme.colorScheme.surface else if (isToday) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                            if (hasTasks) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(4.dp)
                                                        .clip(CircleShape)
                                                        .background(if (isSelected) MaterialTheme.colorScheme.surface else AccentRose)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Tasks for selected day
        item {
            SectionHeader(
                title = if (selectedDay > 0) "Задачі на ${selectedDay} ${monthNames[displayMonth]}" else "Задачі",
                action = if (selectedTasks.isNotEmpty()) "${selectedTasks.size}" else null
            )
        }

        if (selectedTasks.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("Немає задач на цей день", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        } else {
            items(selectedTasks) { task ->
                TaskCard(
                    task = task,
                    onToggle = { onToggleTask(task.id) },
                    onDelete = { onDeleteTask(task.id) },
                    onEdit = { onEditTask(task) }
                )
            }
        }

        item { Spacer(modifier = Modifier.height(72.dp)) }
    }
}

@Composable
private fun MatrixScreen(tasks: List<PlannerTask>) {
    val quadrants = listOf(
        "I Срочно і важливо" to 1,
        "II Не срочно, але важливо" to 2,
        "III Срочно, але не важливо" to 3,
        "IV Не срочно і не важливо" to 4
    )

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            HeaderBlock(
                title = "Матриця Ейзенхауера",
                subtitle = "Фокус на важливому, а не тільки на терміновому"
            )
        }

        item {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                maxItemsInEachRow = 2
            ) {
                quadrants.forEach { (label, quadrant) ->
                    QuadrantCard(
                        modifier = Modifier.width(160.dp),
                        title = label,
                        tint = quadrantColor(quadrant),
                        tasks = tasks.filter { it.quadrant == quadrant }
                    )
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(72.dp))
        }
    }
}

@Composable
private fun FocusScreen(
    tasks: List<PlannerTask>,
    timerState: FocusTimerState,
    nowMillis: Long,
    habitsEnabled: Boolean,
    onStartPause: () -> Unit,
    onReset: () -> Unit,
    onSelectDuration: (Int) -> Unit
) {
    val remainingMillis = timerState.remainingAt(nowMillis)
    val progress = 1f - (remainingMillis.toFloat() / timerState.durationMillis().coerceAtLeast(1L).toFloat())
    val stats = remember(timerState, remainingMillis) {
        listOf(
            FocusStat("Сьогодні", formatMinutes(timerState.focusedTodayMinutes), AccentBlue),
            FocusStat("Сесій", timerState.completedSessions.toString(), AccentMint),
            FocusStat("Поточний режим", "${timerState.durationMinutes} хв", AccentPeach),
            FocusStat("Статус", if (timerState.isRunning) "У роботі" else "Пауза", AccentPurple)
        )
    }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            HeaderBlock(
                title = "Фокус і таймер",
                subtitle = "Таймер оновлюється щосекунди й відновлюється з того ж місця після перезапуску"
            )
        }

        item {
            FocusHeroCard(
                remainingLabel = formatTimer(remainingMillis),
                progress = progress.coerceIn(0f, 1f),
                isRunning = timerState.isRunning,
                durationMinutes = timerState.durationMinutes,
                onStartPause = onStartPause,
                onReset = onReset,
                onSelectDuration = onSelectDuration
            )
        }

        item {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                maxItemsInEachRow = 2
            ) {
                stats.forEach { stat ->
                    MiniStatCard(
                        modifier = Modifier.width(160.dp),
                        title = stat.label,
                        value = stat.value,
                        accent = stat.tint,
                        icon = Icons.Rounded.AutoGraph
                    )
                }
            }
        }

        if (habitsEnabled) {
            item {
                WeeklyTasksHeatmapCard(tasks = tasks)
            }
        }

        item {
            Spacer(modifier = Modifier.height(72.dp))
        }
    }
}

@Composable
private fun MoreScreen(
    modules: List<ModulePreference>,
    themeMode: AppThemeMode,
    onToggleModule: (ModuleKey) -> Unit,
    onThemeChange: (AppThemeMode) -> Unit
) {
    val moduleItems = remember(modules) { buildModuleItems(modules) }

    LazyColumn(
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            HeaderBlock(
                title = "Налаштування",
                subtitle = "Керуй темою, активними модулями та локальним збереженням даних"
            )
        }

        item {
            ThemeSelectionCard(themeMode = themeMode, onThemeChange = onThemeChange)
        }

        item {
            StorageStatusCard()
        }

        item {
            ModulePanelCard(
                title = "Активно",
                items = moduleItems.filter { it.enabled },
                onToggle = onToggleModule
            )
        }

        item {
            ModulePanelCard(
                title = "Вимкнено",
                items = moduleItems.filter { !it.enabled },
                onToggle = onToggleModule
            )
        }

        item {
            PreferenceCard()
        }

        item {
            Spacer(modifier = Modifier.height(72.dp))
        }
    }
}

@Composable
private fun HeaderBlock(
    title: String,
    subtitle: String
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun QuoteCard() {
    Card(
        shape = RoundedCornerShape(30.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF1C2B52), Color(0xFF314A86), Color(0xFF3C2768))
                    )
                )
                .padding(24.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = "День не має бути перевантаженим. Він має бути зібраним.",
                    color = MaterialTheme.colorScheme.background,
                    fontSize = 24.sp,
                    lineHeight = 30.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Тут усе тримається локально: стан задач, фокус-сесії, тема і вкладки.",
                    color = MaterialTheme.colorScheme.background.copy(alpha = 0.78f),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
private fun CategoryStrip(categories: List<CategoryChip>) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        categories.forEach { category ->
            Card(
                shape = RoundedCornerShape(26.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, category.tint.copy(alpha = 0.28f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(category.tint.copy(alpha = 0.22f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Rounded.ViewWeek, contentDescription = category.title, tint = category.tint)
                    }
                    Column {
                        Text(category.title, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                        Text(
                            text = "${category.count} шт.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    action: String?
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground
        )
        action?.let {
            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)) {
                Text(
                    text = it,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun TaskCard(
    task: PlannerTask,
    nowMillis: Long = System.currentTimeMillis(),
    onToggle: () -> Unit,
    onDelete: (() -> Unit)? = null,
    onEdit: () -> Unit = {}
) {
    Card(
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth().clickable { onEdit() }
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(end = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onToggle) {
                    Icon(
                        imageVector = if (task.completed) {
                            Icons.Rounded.CheckCircleOutline
                        } else {
                            Icons.Rounded.RadioButtonUnchecked
                        },
                        contentDescription = task.title,
                        tint = if (task.completed) quadrantColor(task.quadrant) else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = task.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = if (task.completed) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                        textDecoration = if (task.completed) TextDecoration.LineThrough else null
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    val timerText = if (task.deadlineMillis != null) {
                        val remaining = task.deadlineMillis - nowMillis
                        if (remaining > 0) "Залишилось: " + formatTimer(remaining) else "Прострочено"
                    } else ""
                    val repText = if (task.recurringMode != "NONE") " • 🔁 ${task.recurringMode}" else ""
                    val dueLabel = "${task.group}$repText" + (if (timerText.isNotEmpty()) " • $timerText" else "")

                    Text(
                        text = dueLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (timerText == "Прострочено") AccentRose else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (task.note.isNotBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(task.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (onDelete != null) {
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Rounded.Delete, contentDescription = "Видалити", tint = AccentRose)
                    }
                }
            }
            Box(
                modifier = Modifier
                    .size(width = 5.dp, height = 54.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(quadrantColor(task.quadrant))
                    .align(Alignment.CenterEnd)
            )
        }
    }
}

@Composable
private fun MiniStatCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    accent: Color,
    icon: ImageVector
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.2f))
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(accent.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = title, tint = accent)
            }
            Text(text = title, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = value,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 26.sp
            )
        }
    }
}

@Composable
private fun CalendarAgendaCard(events: List<AgendaItem>, monthLabel: String) {
    val days = listOf("ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "НД")

    Card(
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Rounded.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Rounded.ArrowBackIosNew,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = monthLabel,
                        modifier = Modifier.padding(horizontal = 10.dp),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
                Icon(Icons.Rounded.Add, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(modifier = Modifier.height(18.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                days.forEachIndexed { index, day ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(day, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .size(if (index == 4) 44.dp else 36.dp)
                                .clip(CircleShape)
                                .background(if (index == 4) MaterialTheme.colorScheme.primary else Color.Transparent),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = (14 + index).toString(),
                                color = if (index == 4) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            TimelineGrid(events = events)
        }
    }
}

@Composable
private fun TimelineGrid(events: List<AgendaItem>) {
    val startHour = 8
    val endHour = 22
    val totalHours = endHour - startHour
    val contentHeight = 350.dp

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .height(contentHeight)
    ) {
        val dayWidth = maxWidth / 7
        val hourHeight = contentHeight / totalHours

        repeat(totalHours + 1) { index ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = hourHeight * index)
            ) {
                Text(
                    text = "${startHour + index}",
                    modifier = Modifier.width(30.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                DividerLine(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 34.dp)
                )
            }
        }

        events.forEach { event ->
            val eventHeight = hourHeight * (event.endHour - event.startHour)
            val topOffset = hourHeight * (event.startHour - startHour)

            Card(
                modifier = Modifier
                    .width(dayWidth - 12.dp)
                    .height(max(48f, eventHeight.value).dp)
                    .offset(x = dayWidth * event.dayIndex + 38.dp, y = topOffset + 4.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = event.tint.copy(alpha = 0.28f))
            ) {
                Text(
                    text = event.title,
                    modifier = Modifier.padding(10.dp),
                    color = MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun DividerLine(modifier: Modifier = Modifier) {
    HorizontalDivider(
        modifier = modifier.padding(top = 8.dp),
        thickness = 1.dp,
        color = MaterialTheme.colorScheme.outline
    )
}

@Composable
private fun WeekTasksCard(tasks: List<PlannerTask>) {
    Card(
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                text = "Завдання тижня",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            tasks.forEach { task ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(quadrantColor(task.quadrant).copy(alpha = 0.22f))
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(task.title, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyLarge)
                    }
                    val dateLabel = if (task.deadlineMillis != null) formatDateShort(task.deadlineMillis) else "Без дати"
                    Text(dateLabel, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun QuadrantCard(
    modifier: Modifier,
    title: String,
    tint: Color,
    tasks: List<PlannerTask>
) {
    Card(
        modifier = modifier.wrapContentHeight(),
        shape = RoundedCornerShape(30.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.24f))
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = title,
                color = tint,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )
            if (tasks.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Немає задач", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                tasks.take(4).forEach { task ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(
                            imageVector = Icons.Rounded.RadioButtonUnchecked,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                        Column {
                            Text(task.title, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                            val dateLabel = if (task.deadlineMillis != null) formatDateShort(task.deadlineMillis!!) else "Без дати"
                            Text(dateLabel, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FocusHeroCard(
    remainingLabel: String,
    progress: Float,
    isRunning: Boolean,
    durationMinutes: Int,
    onStartPause: () -> Unit,
    onReset: () -> Unit,
    onSelectDuration: (Int) -> Unit
) {
    var customInput by rememberSaveable { mutableStateOf("") }
    var showCustomField by rememberSaveable { mutableStateOf(false) }
    val onText = MaterialTheme.colorScheme.onSurface
    val mutedText = MaterialTheme.colorScheme.onSurfaceVariant
    val primary = MaterialTheme.colorScheme.primary

    Card(
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Помодоро", color = mutedText, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = remainingLabel,
                        color = onText,
                        fontSize = 48.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-1).sp
                    )
                    Text(
                        text = "$durationMinutes хв · ${if (isRunning) "Йде робота ▶" else "Пауза ⏸"}",
                        color = mutedText,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(primary.copy(alpha = 0.15f))
                        .clickable { onStartPause() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isRunning) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                        contentDescription = null,
                        tint = primary,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            // Progress bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(10.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(primary.copy(alpha = 0.12f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progress)
                        .height(10.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Brush.horizontalGradient(colors = listOf(primary, primary.copy(alpha = 0.6f))))
                )
            }

            // Preset + custom chips
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf(25, 45, 60).forEach { minutes ->
                    val selected = durationMinutes == minutes && !showCustomField
                    AssistChip(
                        onClick = {
                            showCustomField = false
                            onSelectDuration(minutes)
                        },
                        label = { Text("$minutes хв", color = if (selected) primary else mutedText) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = if (selected) primary.copy(alpha = 0.18f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        ),
                        border = if (selected) BorderStroke(1.dp, primary.copy(alpha = 0.5f)) else null
                    )
                }
                // Custom chip
                AssistChip(
                    onClick = { showCustomField = !showCustomField },
                    label = { Text("✏️ Свій час", color = if (showCustomField) primary else mutedText) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = if (showCustomField) primary.copy(alpha = 0.18f)
                        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ),
                    border = if (showCustomField) BorderStroke(1.dp, primary.copy(alpha = 0.5f)) else null
                )
            }

            // Custom time input field
            if (showCustomField) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = customInput,
                        onValueChange = { v -> if (v.length <= 3 && v.all { it.isDigit() }) customInput = v },
                        modifier = Modifier.width(120.dp),
                        label = { Text("Хвилини") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        trailingIcon = { Text("хв", color = mutedText, style = MaterialTheme.typography.bodySmall) }
                    )
                    Button(
                        onClick = {
                            val mins = customInput.toIntOrNull()
                            if (mins != null && mins in 1..180) {
                                onSelectDuration(mins)
                                showCustomField = false
                                customInput = ""
                            }
                        },
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = primary)
                    ) {
                        Text("Встановити")
                    }
                }
            }

            // Control row
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AssistChip(
                    onClick = onReset,
                    label = { Text("Скинути", color = mutedText) },
                    leadingIcon = { Icon(Icons.Rounded.Refresh, contentDescription = null, tint = mutedText) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                )
                AssistChip(
                    onClick = onStartPause,
                    label = { Text(if (isRunning) "Пауза" else "Старт", color = primary) },
                    leadingIcon = { Icon(Icons.Rounded.Timer, contentDescription = null, tint = primary) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = primary.copy(alpha = 0.14f)
                    )
                )
            }
        }
    }
}

@Composable
private fun WeeklyTasksHeatmapCard(tasks: List<PlannerTask>) {
    val daysLabels = remember { mutableListOf<String>() }
    val values = remember(tasks) {
        val today = Calendar.getInstance()
        val scores = mutableListOf<Float>()
        
        for (i in 6 downTo 0) {
            val cal = Calendar.getInstance()
            cal.add(Calendar.DAY_OF_YEAR, -i)
            
            val dayTasks = tasks.filter { task ->
                if (task.deadlineMillis == null) return@filter false
                val tc = Calendar.getInstance().apply { timeInMillis = task.deadlineMillis }
                tc.get(Calendar.DAY_OF_YEAR) == cal.get(Calendar.DAY_OF_YEAR) &&
                tc.get(Calendar.YEAR) == cal.get(Calendar.YEAR)
            }
            
            val completionRate = if (dayTasks.isEmpty()) 0f else dayTasks.count { it.completed }.toFloat() / dayTasks.size
            scores.add(completionRate)
            
            val labels = listOf("Н", "П", "В", "С", "Ч", "П", "С")
            daysLabels.add(labels[cal.get(Calendar.DAY_OF_WEEK) - 1])
        }
        scores
    }

    Card(
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Text(
                text = "Продуктивність тижня",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Виконані задачі за останні 7 днів",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                values.forEachIndexed { index, value ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        val baseColor = if (value == 0f) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f) else AccentMint.copy(alpha = 0.16f + value * 0.84f)
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(baseColor)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(daysLabels[index], color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun ThemeSelectionCard(
    themeMode: AppThemeMode,
    onThemeChange: (AppThemeMode) -> Unit
) {
    Card(
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(AccentPurple.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.Palette, contentDescription = null, tint = AccentPurple)
                }
                Column {
                    Text("Тема застосунку", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    Text("Вибір зберігається локально на телефоні", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf(
                    AppThemeMode.SYSTEM to "Системна",
                    AppThemeMode.LIGHT to "Світла",
                    AppThemeMode.DARK to "Темна",
                    AppThemeMode.BLACK to "Чорна",
                    AppThemeMode.BLUE to "Синя",
                    AppThemeMode.GREEN to "Зелена",
                    AppThemeMode.RED to "Червона",
                    AppThemeMode.YELLOW to "Жовта"
                ).forEach { (mode, label) ->
                    AssistChip(
                        onClick = { onThemeChange(mode) },
                        label = { Text(label) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = if (themeMode == mode) {
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
                            } else {
                                MaterialTheme.colorScheme.surface
                            }
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun StorageStatusCard() {
    Card(
        shape = RoundedCornerShape(30.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, AccentMint.copy(alpha = 0.22f))
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Локальне збереження",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Задачі, стан таймера, обрана тема та активні модулі автоматично записуються в пам'ять телефона.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium
            )
            Surface(shape = CircleShape, color = AccentMint.copy(alpha = 0.18f)) {
                Text(
                    text = "Автозбереження активне",
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    color = AccentMint.copy(alpha = 0.95f),
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun ModulePanelCard(
    title: String,
    items: List<ModuleUiItem>,
    onToggle: (ModuleKey) -> Unit
) {
    Card(
        shape = RoundedCornerShape(32.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            items.forEachIndexed { index, item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onToggle(item.key) }
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(if (item.enabled) AccentRose.copy(alpha = 0.18f) else AccentMint.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(item.icon, contentDescription = item.title, tint = MaterialTheme.colorScheme.onSurface)
                    }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(end = 70.dp)) {
                            Text(item.title, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)
                            Text(item.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                        }
                        Switch(
                            checked = item.enabled,
                            onCheckedChange = { onToggle(item.key) },
                            modifier = Modifier.align(Alignment.CenterEnd)
                        )
                    }
                }
                if (index != items.lastIndex) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                }
            }
        }
    }
}

@Composable
private fun PreferenceCard() {
    Card(
        shape = RoundedCornerShape(30.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Максимум вкладок у нижній навігації",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "5",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 34.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = "Якщо модулів стане більше, їх можна тримати у вкладці \"Ще\" без перевантаження головного екрана.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun TaskEditSheet(
    taskToEdit: PlannerTask? = null,
    onDismiss: () -> Unit,
    onSaveTask: (title: String, group: String, quadrant: Int, deadlineMillis: Long?, recurringMode: String, note: String) -> Unit
) {
    val context = LocalContext.current
    var title by rememberSaveable { mutableStateOf(taskToEdit?.title ?: "") }
    var group by rememberSaveable { mutableStateOf(taskToEdit?.group ?: "Сьогодні") }
    var note by rememberSaveable { mutableStateOf(taskToEdit?.note ?: "") }
    var quadrant by rememberSaveable { mutableStateOf(taskToEdit?.quadrant ?: 2) }
    var deadlineMillis by rememberSaveable { mutableStateOf<Long?>(taskToEdit?.deadlineMillis) }
    var recurringMode by rememberSaveable { mutableStateOf(taskToEdit?.recurringMode ?: "NONE") }

    val datePickerDialog = remember {
        val cal = Calendar.getInstance()
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val timeCal = Calendar.getInstance()
                timeCal.set(Calendar.YEAR, year)
                timeCal.set(Calendar.MONTH, month)
                timeCal.set(Calendar.DAY_OF_MONTH, dayOfMonth)
                TimePickerDialog(
                    context,
                    { _, hour, minute ->
                        timeCal.set(Calendar.HOUR_OF_DAY, hour)
                        timeCal.set(Calendar.MINUTE, minute)
                        timeCal.set(Calendar.SECOND, 0)
                        deadlineMillis = timeCal.timeInMillis
                    },
                    timeCal.get(Calendar.HOUR_OF_DAY),
                    timeCal.get(Calendar.MINUTE),
                    true
                ).show()
            },
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH),
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = AlertDialogDefaults.containerColor
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = if (taskToEdit != null) "Редагувати задачу" else "Нова задача",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Назва") },
                singleLine = true
            )
            OutlinedTextField(
                value = group,
                onValueChange = { group = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Розділ") },
                singleLine = true
            )
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Нотатки (необов'язково)") },
                minLines = 2,
                maxLines = 4
            )
            Text(
                text = "Квадрант",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf(
                    1 to "Терміново і важливо",
                    2 to "Важливо",
                    3 to "Делегувати",
                    4 to "Відкласти"
                ).forEach { (value, label) ->
                    AssistChip(
                        onClick = { quadrant = value },
                        label = { Text(label) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = if (quadrant == value) {
                                quadrantColor(value).copy(alpha = 0.24f)
                            } else {
                                MaterialTheme.colorScheme.surface
                            }
                        )
                    )
                }
            }
            Text(
                text = "Дедлайн",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = { datePickerDialog.show() }) {
                    val label = if (deadlineMillis != null) {
                        val cal = Calendar.getInstance().apply { timeInMillis = deadlineMillis!! }
                        "%02d.%02d.%d %02d:%02d".format(
                            cal.get(Calendar.DAY_OF_MONTH),
                            cal.get(Calendar.MONTH) + 1,
                            cal.get(Calendar.YEAR),
                            cal.get(Calendar.HOUR_OF_DAY),
                            cal.get(Calendar.MINUTE)
                        )
                    } else "Вибрати час"
                    Text(label)
                }
                Spacer(modifier = Modifier.width(8.dp))
                if (deadlineMillis != null) {
                    TextButton(onClick = { deadlineMillis = null }) { Text("Без дедлайну", color = AccentRose) }
                }
            }

            Text(
                text = "Повторення",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf(
                    "NONE" to "Ні",
                    "DAILY" to "Щодня",
                    "WEEKLY" to "Щотижня"
                ).forEach { (value, label) ->
                    AssistChip(
                        onClick = { recurringMode = value },
                        label = { Text(label) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = if (recurringMode == value) {
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.24f)
                            } else {
                                MaterialTheme.colorScheme.surface
                            }
                        )
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Скасувати")
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        onSaveTask(
                            title.ifBlank { "Нова задача" },
                            group.ifBlank { "Сьогодні" },
                            quadrant,
                            deadlineMillis,
                            recurringMode,
                            note
                        )
                    }
                ) {
                    Text("Зберегти")
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

private fun buildCategories(tasks: List<PlannerTask>): List<CategoryChip> {
    return listOf(
        CategoryChip("У фокусі", tasks.count { it.quadrant == 1 || it.quadrant == 2 }, AccentMint),
        CategoryChip("Термінові", tasks.count { it.quadrant == 1 || it.quadrant == 3 }, AccentRose),
        CategoryChip("Виконані", tasks.count { it.completed }, AccentBlue),
        CategoryChip("Особисті", tasks.count { it.group.contains("Я") || it.group.contains("Ритуали") }, AccentPurple)
    )
}

private fun buildModuleItems(modules: List<ModulePreference>): List<ModuleUiItem> {
    val states = modules.associateBy({ it.key }, { it.enabled })

    return listOf(
        ModuleUiItem(ModuleKey.TASKS, "Задачі", "Керуйте списками та фільтрами", states[ModuleKey.TASKS] ?: true, Icons.Rounded.TaskAlt),
        ModuleUiItem(ModuleKey.CALENDAR, "Календар", "Плануйте день, тиждень і місяць", states[ModuleKey.CALENDAR] ?: true, Icons.Rounded.CalendarMonth),
        ModuleUiItem(ModuleKey.MATRIX, "Матриця Ейзенхауера", "Виділяйте важливе", states[ModuleKey.MATRIX] ?: true, Icons.Rounded.GridView),
        ModuleUiItem(ModuleKey.FOCUS, "Помодоро", "Таймер і глибока робота", states[ModuleKey.FOCUS] ?: true, Icons.Rounded.Timer),
        ModuleUiItem(ModuleKey.HABITS, "Привички", "Формуйте стабільний ритм", states[ModuleKey.HABITS] ?: true, Icons.Rounded.AutoGraph),
        ModuleUiItem(ModuleKey.SETTINGS, "Налаштування", "Тема, нагадування, безпека", states[ModuleKey.SETTINGS] ?: true, Icons.Rounded.Settings),
        ModuleUiItem(ModuleKey.COUNTDOWN, "Зворотний відлік", "Тримайте в полі зору дедлайни", states[ModuleKey.COUNTDOWN] ?: false, Icons.Rounded.Alarm),
        ModuleUiItem(ModuleKey.SEARCH, "Пошук", "Швидкий доступ до задач", states[ModuleKey.SEARCH] ?: false, Icons.Rounded.DashboardCustomize),
        ModuleUiItem(ModuleKey.NOTIFICATIONS, "🔔 Сповіщення", "Нагадування про дедлайни задач в центрі сповіщень", states[ModuleKey.NOTIFICATIONS] ?: false, Icons.Rounded.NotificationsNone)
    )
}

private fun quadrantColor(quadrant: Int): Color = when (quadrant) {
    1 -> AccentRose
    2 -> AccentYellow
    3 -> AccentBlue
    else -> AccentMint
}

private fun formatTimer(remainingMillis: Long): String {
    val totalSeconds = (remainingMillis / 1_000L).coerceAtLeast(0L)
    val hours = totalSeconds / 3600L
    val minutes = (totalSeconds % 3600L) / 60L
    val seconds = totalSeconds % 60L
    return if (hours > 0) "%02d:%02d:%02d".format(hours, minutes, seconds)
    else "%02d:%02d".format(minutes, seconds)
}

private fun formatDateShort(millis: Long): String {
    val cal = Calendar.getInstance().apply { timeInMillis = millis }
    return "%02d.%02d".format(cal.get(Calendar.DAY_OF_MONTH), cal.get(Calendar.MONTH) + 1)
}


private fun formatMinutes(totalMinutes: Int): String {
    if (totalMinutes < 60) {
        return "${totalMinutes}хв"
    }

    val hours = totalMinutes / 60
    val minutes = totalMinutes % 60
    return if (minutes == 0) {
        "${hours}г"
    } else {
        "${hours}г ${minutes}хв"
    }
}
