const STORAGE_KEY = "ember-focus-state-v2";
const LEGACY_STORAGE_KEY = "ember-focus-state-v1";

const DEFAULTS = {
  settings: { focus: 25, short: 5, long: 15, dailyGoal: 4, autoStart: false, sound: true, volume: 45, theme: "ember", accent: "#e86545", clockSkin: "flip", miniTimer: false, ambientRoom: "", ambientVolume: 35 },
  tasks: [],
  sessionHistory: [],
  activeTaskId: null,
  stats: { date: "", focusMinutes: 0, finishedSessions: 0 },
  completedInCycle: 0,
  timerRuntime: null,
};

const modeCopy = {
  focus: { label: "Ready when you are", button: "Start focus", overlay: "Focus session" },
  short: { label: "A little room to breathe", button: "Start break", overlay: "Short break" },
  long: { label: "Step away and reset", button: "Start break", overlay: "Long break" },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  body: document.body,
  panel: $(".timer-panel"),
  orbit: $("#timerOrbit"),
  timer: $("#timerValue"),
  label: $("#sessionHeading"),
  sessionCount: $("#sessionCount"),
  startButton: $("#startButton"),
  startButtonText: $("#startButtonText"),
  resetButton: $("#resetButton"),
  skipButton: $("#skipButton"),
  currentTask: $("#currentTask"),
  currentTaskName: $("#currentTaskName"),
  taskForm: $("#taskForm"),
  taskInput: $("#taskInput"),
  estimateInput: $("#estimateInput"),
  taskList: $("#taskList"),
  plannerTaskList: $("#plannerTaskList"),
  planTaskForm: $("#planTaskForm"),
  planTaskInput: $("#planTaskInput"),
  planEstimateInput: $("#planEstimateInput"),
  emptyState: $("#emptyState"),
  clearCompletedButton: $("#clearCompletedButton"),
  focusMinutes: $("#focusMinutes"),
  finishedSessions: $("#finishedSessions"),
  completedTasks: $("#completedTasks"),
  headerMinutes: $("#headerMinutes"),
  goalCopy: $("#goalCopy"),
  goalProgress: $("#goalProgress"),
  goalTrack: $(".goal-track"),
  dateLabel: $("#dateLabel"),
  plannedPomos: $("#plannedPomos"),
  plannedTasks: $("#plannedTasks"),
  planSelection: $("#planSelection"),
  focusSelectedButton: $("#focusSelectedButton"),
  settingsButton: $("#settingsButton"),
  settingsDialog: $("#settingsDialog"),
  settingsForm: $("#settingsForm"),
  restoreDefaultsButton: $("#restoreDefaultsButton"),
  taskDialog: $("#taskDialog"),
  taskEditForm: $("#taskEditForm"),
  taskCompleteButton: $("#taskCompleteButton"),
  editReceipt: $("#editReceipt"),
  calendarMonth: $("#calendarMonth"),
  calendarGrid: $("#calendarGrid"),
  previousMonthButton: $("#previousMonthButton"),
  nextMonthButton: $("#nextMonthButton"),
  todayMonthButton: $("#todayMonthButton"),
  selectedDayTitle: $("#selectedDayTitle"),
  dayFocusMinutes: $("#dayFocusMinutes"),
  daySessionCount: $("#daySessionCount"),
  dayTaskCount: $("#dayTaskCount"),
  daySessionList: $("#daySessionList"),
  fullscreenButton: $("#fullscreenButton"),
  focusOverlay: $("#focusOverlay"),
  fullscreenExitButton: $("#fullscreenExitButton"),
  overlayViewButton: $("#overlayViewButton"),
  overlayTimerDisplay: $("#overlayTimerDisplay"),
  overlayClockDisplay: $("#overlayClockDisplay"),
  overlayTimerMinutes: $("#overlayTimerMinutes"), overlayTimerSeconds: $("#overlayTimerSeconds"),
  overlayModeLabel: $("#overlayModeLabel"),
  overlayTaskName: $("#overlayTaskName"),
  overlaySessionCount: $("#overlaySessionCount"),
  overlayStartButton: $("#overlayStartButton"),
  overlayResetButton: $("#overlayResetButton"),
  overlaySkipButton: $("#overlaySkipButton"),
  roomButton: $("#roomButton"), roomButtonLabel: $("#roomButtonLabel"), roomDialog: $("#roomDialog"), closeRoomButton: $("#closeRoomButton"), roomGrid: $("#roomGrid"), ambientVolume: $("#ambientVolume"), ambientStatus: $("#ambientStatus"),
  miniTimer: $("#miniTimer"), miniTimerValue: $("#miniTimerValue"), miniTimerMode: $("#miniTimerMode"),
  clockDateLabel: $("#clockDateLabel"),
  clockWeekday: $("#clockWeekday"),
  clockHour: $("#clockHour"),
  clockMinute: $("#clockMinute"),
  clockSeconds: $("#clockSeconds"),
  toast: $("#toast"),
};

let state = loadState();
const restoredRuntime = state.timerRuntime;
let timerState = { mode: restoredRuntime?.mode || "focus", remaining: restoredRuntime?.remaining || state.settings[restoredRuntime?.mode || "focus"] * 60, running: false, endAt: restoredRuntime?.endAt || null };
let intervalId = null;
let toastTimer = null;
let editingTaskId = null;
let calendarCursor = startOfMonth(new Date());
let selectedCalendarDate = localDateKey();
let showingClock = false;
let lastTimerText = "";
let ambientContext = null;
let ambientSource = null;
let ambientGain = null;

function structuredDefault() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const merged = {
      ...structuredDefault(),
      ...saved,
      settings: { ...DEFAULTS.settings, ...(saved.settings || {}) },
      stats: { ...DEFAULTS.stats, ...(saved.stats || {}) },
      tasks: Array.isArray(saved.tasks) ? saved.tasks.map((task) => ({ sessions: 0, done: false, completedDate: null, ...task })) : [],
      sessionHistory: Array.isArray(saved.sessionHistory) ? saved.sessionHistory : [],
    };
    if (merged.stats.date !== localDateKey()) {
      merged.stats = { date: localDateKey(), focusMinutes: 0, finishedSessions: 0 };
      merged.completedInCycle = 0;
    }
    return merged;
  } catch {
    const fallback = structuredDefault();
    fallback.stats.date = localDateKey();
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistTimerRuntime() {
  state.timerRuntime = { mode: timerState.mode, remaining: timerState.remaining, running: timerState.running, endAt: timerState.endAt };
  saveState();
}

function setFlipNumber(node, value) {
  const previous = node.textContent;
  if (previous === value) return;
  node.dataset.prev = previous || value;
  node.textContent = value;
  node.classList.remove("paper-fall");
  void node.offsetWidth;
  node.classList.add("paper-fall");
}

function durationFor(mode = timerState.mode) {
  return Number(state.settings[mode]) * 60;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeTask() {
  return state.tasks.find((task) => task.id === state.activeTaskId && !task.done) || null;
}

function renderTimer() {
  const total = durationFor();
  const elapsedRatio = total ? (total - timerState.remaining) / total : 0;
  const time = formatTime(timerState.remaining);
  elements.timer.textContent = time;
  elements.timer.setAttribute("datetime", `PT${Math.ceil(timerState.remaining)}S`);
  const [minutes, seconds] = time.split(":");
  setFlipNumber(elements.overlayTimerMinutes, minutes);
  setFlipNumber(elements.overlayTimerSeconds, seconds);
  elements.miniTimerValue.textContent = time;
  elements.miniTimerMode.textContent = timerState.mode === "focus" ? "Focus" : timerState.mode === "short" ? "Short break" : "Long break";
  elements.orbit.style.setProperty("--progress", `${Math.min(360, Math.max(0, elapsedRatio * 360))}deg`);
  elements.panel.classList.toggle("running", timerState.running);
  elements.startButtonText.textContent = timerState.running ? "Pause" : modeCopy[timerState.mode].button;
  elements.overlayStartButton.textContent = timerState.running ? "Pause" : modeCopy[timerState.mode].button;
  elements.label.textContent = timerState.running ? (timerState.mode === "focus" ? "Stay with this one thing" : "Let your mind wander") : modeCopy[timerState.mode].label;
  elements.sessionCount.textContent = timerState.mode === "focus" ? `Session ${(state.completedInCycle % 4) + 1} of 4` : timerState.mode === "long" ? "Long reset" : "Quick reset";
  elements.overlayModeLabel.textContent = modeCopy[timerState.mode].overlay;
  elements.overlaySessionCount.textContent = timerState.mode === "focus" ? `${(state.completedInCycle % 4) + 1}/4` : timerState.mode === "long" ? "Long" : "Break";
  const task = activeTask();
  elements.currentTaskName.textContent = task?.name || "Choose a task to begin";
  elements.overlayTaskName.textContent = task?.name || "Choose a task to begin";
  document.title = timerState.running ? `${time} · Ember Focus` : "Ember Focus";
  if (time !== lastTimerText) {
    lastTimerText = time;
    [elements.timer].forEach((node) => {
      node.classList.remove("digit-drop");
      requestAnimationFrame(() => node.classList.add("digit-drop"));
    });
  }
}

function switchMode(mode, shouldAutoStart = false) {
  stopInterval();
  timerState = { mode, remaining: durationFor(mode), running: false, endAt: null };
  elements.body.dataset.mode = mode;
  $$(".mode-tab").forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  renderTimer();
  persistTimerRuntime();
  if (shouldAutoStart) startTimer();
}

function startTimer() {
  if (timerState.running) return;
  timerState.running = true;
  timerState.endAt = Date.now() + timerState.remaining * 1000;
  intervalId = window.setInterval(tick, 250);
  persistTimerRuntime();
  renderTimer();
  playSound("start", timerState.mode);
}

function pauseTimer() {
  if (!timerState.running) return;
  timerState.remaining = Math.max(0, Math.ceil((timerState.endAt - Date.now()) / 1000));
  stopInterval();
  persistTimerRuntime();
  renderTimer();
}

function toggleTimer() {
  timerState.running ? pauseTimer() : startTimer();
}

function stopInterval() {
  window.clearInterval(intervalId);
  intervalId = null;
  timerState.running = false;
  timerState.endAt = null;
}

function tick() {
  timerState.remaining = Math.max(0, Math.ceil((timerState.endAt - Date.now()) / 1000));
  renderTimer();
  if (timerState.remaining <= 0) finishSession();
}

function finishSession({ skipped = false } = {}) {
  const completedMode = timerState.mode;
  stopInterval();
  if (!skipped && completedMode === "focus") {
    const task = activeTask();
    const completedAt = new Date();
    state.completedInCycle += 1;
    state.stats.focusMinutes += Number(state.settings.focus);
    state.stats.finishedSessions += 1;
    if (task) task.sessions += 1;
    state.sessionHistory.unshift({
      id: makeId(),
      taskId: task?.id || null,
      taskName: task?.name || "Unassigned focus",
      duration: Number(state.settings.focus),
      completedAt: completedAt.toISOString(),
      date: localDateKey(completedAt),
    });
    saveState();
    renderAll();
    showToast(task ? `One Pomodoro logged for ${task.name}.` : "Focus session complete — beautifully done.");
  } else if (!skipped) {
    showToast("Break complete. Come back gently.");
  }
  if (!skipped) playSound("end", completedMode);
  const nextMode = completedMode === "focus" ? (state.completedInCycle % 4 === 0 ? "long" : "short") : "focus";
  switchMode(nextMode, state.settings.autoStart && !skipped);
}

function resetTimer() {
  stopInterval();
  timerState.remaining = durationFor();
  persistTimerRuntime();
  renderTimer();
  showToast("Timer reset.");
}

function playSound(kind, mode) {
  if (!state.settings.sound || Number(state.settings.volume) <= 0) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    const now = context.currentTime;
    const volume = (Number(state.settings.volume) / 100) * 0.14;
    const notes = kind === "start"
      ? (mode === "focus" ? [392, 523.25] : [329.63, 392])
      : (mode === "focus" ? [523.25, 659.25, 783.99] : [659.25, 523.25, 440]);
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const offset = index * (kind === "start" ? 0.07 : 0.13);
      oscillator.type = kind === "start" ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.55);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.58);
    });
    window.setTimeout(() => context.close(), 1300);
  } catch { /* Browser audio is optional. */ }
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function taskMarkup(task, location) {
  const atEstimate = task.sessions >= task.estimate && !task.done;
  return `<article class="task-item ${task.done ? "done" : ""} ${task.id === state.activeTaskId ? "selected" : ""} ${atEstimate ? "at-estimate" : ""}" data-task-id="${task.id}" tabindex="0" aria-label="Select task: ${escapeHtml(task.name)}">
    <button class="task-check" type="button" data-action="toggle-task" aria-label="${task.done ? "Mark incomplete" : "Mark complete"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" /></svg></button>
    <span class="task-name">${escapeHtml(task.name)}${atEstimate ? '<small>Estimate reached</small>' : ""}</span>
    <span class="task-estimate"><b>${task.sessions}</b> / ${task.estimate} p</span>
    <button class="task-edit" type="button" data-action="edit-task" aria-label="Edit ${escapeHtml(task.name)}">Edit</button>
    <button class="task-delete" type="button" data-action="delete-task" aria-label="Delete ${escapeHtml(task.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
  </article>`;
}

function renderTasks() {
  const markup = state.tasks.map((task) => taskMarkup(task, "focus")).join("");
  elements.taskList.innerHTML = markup;
  elements.plannerTaskList.innerHTML = state.tasks.map((task) => taskMarkup(task, "plan")).join("");
  elements.emptyState.hidden = state.tasks.length > 0;
  renderPlanSelection();
}

function renderPlanSelection() {
  const task = activeTask();
  if (!task) {
    elements.planSelection.innerHTML = '<span class="selection-orb">+</span><h2>Select a task</h2><p>Click a task to make it the focus for your next session.</p>';
    elements.focusSelectedButton.disabled = true;
    return;
  }
  elements.planSelection.innerHTML = `<span class="selection-orb">${task.sessions}/${task.estimate}</span><h2>${escapeHtml(task.name)}</h2><p>${Math.max(0, task.estimate - task.sessions)} Pomodoros remain in this estimate.</p>`;
  elements.focusSelectedButton.disabled = false;
}

function addTask(event, input, estimate) {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) return input.focus();
  const task = { id: makeId(), name, estimate: Math.min(24, Math.max(1, Number(estimate.value) || 1)), sessions: 0, done: false, completedDate: null };
  state.tasks.unshift(task);
  if (!state.activeTaskId) state.activeTaskId = task.id;
  input.value = "";
  estimate.value = 1;
  saveState();
  renderAll();
  showToast("Task added to today.");
}

function handleTaskAction(event) {
  const taskElement = event.target.closest("[data-task-id]");
  if (!taskElement) return;
  const task = state.tasks.find((entry) => entry.id === taskElement.dataset.taskId);
  if (!task) return;
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "delete-task") {
    state.tasks = state.tasks.filter((entry) => entry.id !== task.id);
    if (state.activeTaskId === task.id) state.activeTaskId = state.tasks.find((entry) => !entry.done)?.id || null;
    showToast("Task removed.");
  } else if (action === "toggle-task") {
    task.done = !task.done;
    task.completedDate = task.done ? localDateKey() : null;
    if (task.done && state.activeTaskId === task.id) state.activeTaskId = state.tasks.find((entry) => !entry.done)?.id || null;
    showToast(task.done ? "Task complete. Nice work." : "Task reopened.");
  } else if (action === "edit-task") {
    openTaskEditor(task);
    return;
  } else if (!task.done) {
    state.activeTaskId = task.id;
    showToast(`${task.name} is now active.`);
  }
  saveState();
  renderAll();
}

function handleTaskKeydown(event) {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-task-id]")) {
    event.preventDefault();
    handleTaskAction(event);
  }
}

function clearCompleted() {
  const count = state.tasks.filter((task) => task.done).length;
  if (!count) return showToast("No completed tasks to clear.");
  state.tasks = state.tasks.filter((task) => !task.done);
  saveState();
  renderAll();
  showToast(`${count} completed ${count === 1 ? "task" : "tasks"} cleared.`);
}

function renderStats() {
  const completed = state.tasks.filter((task) => task.done && task.completedDate === localDateKey()).length;
  const goal = Number(state.settings.dailyGoal);
  const sessions = state.stats.finishedSessions;
  const progress = Math.min(100, (sessions / goal) * 100);
  elements.focusMinutes.textContent = state.stats.focusMinutes;
  elements.headerMinutes.textContent = state.stats.focusMinutes;
  elements.finishedSessions.textContent = sessions;
  elements.completedTasks.textContent = completed;
  elements.goalCopy.textContent = `${sessions} of ${goal} sessions`;
  elements.goalProgress.style.width = `${progress}%`;
  elements.goalTrack.setAttribute("aria-valuemax", goal);
  elements.goalTrack.setAttribute("aria-valuenow", sessions);
  const openTasks = state.tasks.filter((task) => !task.done);
  elements.plannedTasks.textContent = openTasks.length;
  elements.plannedPomos.textContent = openTasks.reduce((sum, task) => sum + Math.max(0, task.estimate - task.sessions), 0);
}

function openSettings() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const field = elements.settingsForm.elements.namedItem(key);
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value;
  });
  elements.settingsDialog.showModal();
}

function saveSettings(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(elements.settingsForm);
  state.settings = {
    focus: Number(data.get("focus")), short: Number(data.get("short")), long: Number(data.get("long")), dailyGoal: Number(data.get("dailyGoal")),
    autoStart: data.has("autoStart"), sound: data.has("sound"), volume: Number(data.get("volume")), theme: data.get("theme"), accent: data.get("accent"), clockSkin: data.get("clockSkin"), miniTimer: data.has("miniTimer"), ambientRoom: state.settings.ambientRoom, ambientVolume: state.settings.ambientVolume,
  };
  saveState();
  applyPersonalisation();
  switchMode(timerState.mode);
  renderAll();
  elements.settingsDialog.close();
  showToast("Your rhythm has been updated.");
}

function restoreDefaults() {
  Object.entries(DEFAULTS.settings).forEach(([key, value]) => {
    const field = elements.settingsForm.elements.namedItem(key);
    if (field.type === "checkbox") field.checked = value;
    else field.value = value;
  });
}

function applyPersonalisation() {
  elements.body.dataset.theme = state.settings.theme;
  elements.body.dataset.clockSkin = state.settings.clockSkin;
  elements.body.style.setProperty("--user-accent", state.settings.accent);
  elements.miniTimer.hidden = !state.settings.miniTimer;
  elements.roomButtonLabel.textContent = state.settings.ambientRoom ? state.settings.ambientRoom : "Room";
}

function stopAmbient() {
  ambientSource?.stop(); ambientSource = null;
  ambientContext?.close(); ambientContext = null; ambientGain = null;
}

function startAmbient(room) {
  stopAmbient();
  state.settings.ambientRoom = room;
  state.settings.ambientVolume = Number(elements.ambientVolume.value);
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ambientContext = new AudioCtx();
    const buffer = ambientContext.createBuffer(1, ambientContext.sampleRate * 2, ambientContext.sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < channel.length; i += 1) { const white = Math.random() * 2 - 1; brown = room === "brown" ? (brown + 0.02 * white) / 1.02 : white; channel[i] = room === "rain" ? white * (Math.random() > .96 ? 1 : .35) : brown; }
    ambientSource = ambientContext.createBufferSource(); ambientSource.buffer = buffer; ambientSource.loop = true;
    const filter = ambientContext.createBiquadFilter(); filter.type = room === "forest" ? "lowpass" : room === "white" ? "highpass" : "bandpass"; filter.frequency.value = room === "cafe" ? 750 : room === "forest" ? 1200 : 620;
    ambientGain = ambientContext.createGain(); ambientGain.gain.value = (state.settings.ambientVolume / 100) * .15;
    ambientSource.connect(filter).connect(ambientGain).connect(ambientContext.destination); ambientSource.start();
  } catch { showToast("Ambient audio needs a supported browser."); }
  saveState(); applyPersonalisation(); renderRooms();
}

function renderRooms() {
  const room = state.settings.ambientRoom;
  elements.ambientVolume.value = state.settings.ambientVolume;
  elements.ambientStatus.textContent = room ? `${room[0].toUpperCase()}${room.slice(1)} is playing` : "Choose a room to begin";
  $$("[data-room]").forEach((button) => button.classList.toggle("active", button.dataset.room === room));
}

function openTaskEditor(task) {
  editingTaskId = task.id;
  elements.taskEditForm.elements.name.value = task.name;
  elements.taskEditForm.elements.estimate.value = task.estimate;
  elements.editReceipt.textContent = `${task.sessions} ${task.sessions === 1 ? "session" : "sessions"} recorded`;
  elements.taskCompleteButton.textContent = task.done ? "Mark open" : "Mark complete";
  elements.taskDialog.showModal();
}

function saveTaskEdit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const task = state.tasks.find((entry) => entry.id === editingTaskId);
  if (!task) return elements.taskDialog.close();
  task.name = elements.taskEditForm.elements.name.value.trim() || task.name;
  task.estimate = Math.min(24, Math.max(1, Number(elements.taskEditForm.elements.estimate.value) || 1));
  saveState();
  renderAll();
  elements.taskDialog.close();
  showToast("Task updated.");
}

function toggleEditedTask() {
  const task = state.tasks.find((entry) => entry.id === editingTaskId);
  if (!task) return;
  task.done = !task.done;
  task.completedDate = task.done ? localDateKey() : null;
  if (task.done && state.activeTaskId === task.id) state.activeTaskId = state.tasks.find((entry) => !entry.done)?.id || null;
  saveState();
  renderAll();
  elements.taskDialog.close();
  showToast(task.done ? "Task complete. Nice work." : "Task reopened.");
}

function setView(view) {
  elements.body.dataset.view = view;
  $$(".view-tab").forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.toggleAttribute("aria-current", active);
  });
  $$("[data-view-panel]").forEach((panel) => {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (view === "calendar") renderCalendar();
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sessionsForDate(key) {
  return state.sessionHistory.filter((session) => session.date === key);
}

function renderCalendar() {
  const first = startOfMonth(calendarCursor);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const title = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(first);
  elements.calendarMonth.textContent = title;
  const cells = [];
  for (let index = 0; index < leading; index += 1) cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(first.getFullYear(), first.getMonth(), day);
    const key = localDateKey(date);
    const sessions = sessionsForDate(key);
    const minutes = sessions.reduce((sum, entry) => sum + Number(entry.duration || 0), 0);
    const closed = state.tasks.filter((task) => task.completedDate === key).length;
    const intensity = Math.min(4, Math.ceil(minutes / Math.max(1, Number(state.settings.focus))));
    const isSelected = key === selectedCalendarDate;
    const isToday = key === localDateKey();
    cells.push(`<button class="calendar-day intensity-${intensity} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}" type="button" data-calendar-date="${key}" aria-label="${new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(date)}: ${sessions.length} focus sessions"><span>${day}</span><small>${sessions.length ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}` : closed ? `${closed} task${closed === 1 ? "" : "s"}` : ""}</small></button>`);
  }
  elements.calendarGrid.innerHTML = cells.join("");
  renderDayDetail();
}

function renderDayDetail() {
  const date = dateFromKey(selectedCalendarDate);
  const sessions = sessionsForDate(selectedCalendarDate);
  const minutes = sessions.reduce((sum, entry) => sum + Number(entry.duration || 0), 0);
  const completed = state.tasks.filter((task) => task.completedDate === selectedCalendarDate);
  elements.selectedDayTitle.textContent = selectedCalendarDate === localDateKey() ? "Today" : new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(date);
  elements.dayFocusMinutes.textContent = minutes;
  elements.daySessionCount.textContent = sessions.length;
  elements.dayTaskCount.textContent = completed.length;
  const sessionRows = sessions.map((session) => `<li><span class="session-dot"></span><div><strong>${escapeHtml(session.taskName)}</strong><small>${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(session.completedAt))} · ${session.duration} min focus</small></div></li>`);
  const taskRows = completed.map((task) => `<li class="closed-row"><span class="session-dot"></span><div><strong>${escapeHtml(task.name)}</strong><small>Task marked complete</small></div></li>`);
  elements.daySessionList.innerHTML = sessionRows.length || taskRows.length ? `<ul>${sessionRows.join("")}${taskRows.join("")}</ul>` : '<p class="no-history">Nothing recorded here yet. A little breathing room is good too.</p>';
}

function moveCalendar(monthChange) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + monthChange, 1);
  selectedCalendarDate = `${monthKey(calendarCursor)}-01`;
  renderCalendar();
}

function enterFocusMode() {
  elements.body.classList.add("focus-mode");
  elements.focusOverlay.setAttribute("aria-hidden", "false");
  document.documentElement.requestFullscreen?.().catch(() => {});
  renderTimer();
}

function exitFocusMode() {
  elements.body.classList.remove("focus-mode");
  elements.body.classList.remove("clock-view");
  elements.focusOverlay.setAttribute("aria-hidden", "true");
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

function toggleOverlayView() {
  showingClock = !showingClock;
  elements.body.classList.toggle("clock-view", showingClock);
  elements.overlayTimerDisplay.hidden = showingClock;
  elements.overlayClockDisplay.hidden = !showingClock;
  elements.overlayViewButton.textContent = showingClock ? "Show timer" : "Show clock";
}

function updateClock() {
  const now = new Date();
  const hour = new Intl.DateTimeFormat(undefined, { hour: "2-digit", hour12: false }).format(now);
  const minute = new Intl.DateTimeFormat(undefined, { minute: "2-digit" }).format(now);
  const second = new Intl.DateTimeFormat(undefined, { second: "2-digit" }).format(now);
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now);
  [[elements.clockHour, hour], [elements.clockMinute, minute], [elements.clockSeconds, second]].forEach(([node, value]) => setFlipNumber(node, value));
  elements.clockDateLabel.textContent = date;
  elements.clockWeekday.textContent = weekday;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2700);
}

function renderAll() {
  renderTimer();
  renderTasks();
  renderStats();
  renderCalendar();
}

function init() {
  elements.body.dataset.mode = "focus";
  elements.dateLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date());
  renderAll();
  if (restoredRuntime?.running && restoredRuntime.endAt > Date.now()) {
    timerState.running = true;
    timerState.remaining = Math.ceil((restoredRuntime.endAt - Date.now()) / 1000);
    intervalId = window.setInterval(tick, 250);
    renderTimer();
  }
  applyPersonalisation(); renderRooms();
  updateClock();
  window.setInterval(updateClock, 1000);

  $$(".mode-tab").forEach((tab) => tab.addEventListener("click", () => switchMode(tab.dataset.mode)));
  $$(".view-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
  elements.startButton.addEventListener("click", toggleTimer);
  elements.overlayStartButton.addEventListener("click", toggleTimer);
  elements.resetButton.addEventListener("click", resetTimer);
  elements.overlayResetButton.addEventListener("click", resetTimer);
  elements.skipButton.addEventListener("click", () => finishSession({ skipped: true }));
  elements.overlaySkipButton.addEventListener("click", () => finishSession({ skipped: true }));
  elements.currentTask.addEventListener("click", () => setView("plan"));
  elements.taskForm.addEventListener("submit", (event) => addTask(event, elements.taskInput, elements.estimateInput));
  elements.planTaskForm.addEventListener("submit", (event) => addTask(event, elements.planTaskInput, elements.planEstimateInput));
  document.addEventListener("click", handleTaskAction);
  document.addEventListener("keydown", handleTaskKeydown);
  elements.clearCompletedButton.addEventListener("click", clearCompleted);
  elements.focusSelectedButton.addEventListener("click", () => setView("focus"));
  elements.settingsButton.addEventListener("click", openSettings);
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.restoreDefaultsButton.addEventListener("click", restoreDefaults);
  elements.taskEditForm.addEventListener("submit", saveTaskEdit);
  elements.taskCompleteButton.addEventListener("click", toggleEditedTask);
  [elements.settingsDialog, elements.taskDialog].forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  elements.previousMonthButton.addEventListener("click", () => moveCalendar(-1));
  elements.nextMonthButton.addEventListener("click", () => moveCalendar(1));
  elements.todayMonthButton.addEventListener("click", () => { calendarCursor = startOfMonth(new Date()); selectedCalendarDate = localDateKey(); renderCalendar(); });
  elements.calendarGrid.addEventListener("click", (event) => { const button = event.target.closest("[data-calendar-date]"); if (!button) return; selectedCalendarDate = button.dataset.calendarDate; renderCalendar(); });
  elements.fullscreenButton.addEventListener("click", enterFocusMode);
  elements.fullscreenExitButton.addEventListener("click", exitFocusMode);
  elements.overlayViewButton.addEventListener("click", toggleOverlayView);
  elements.roomButton.addEventListener("click", () => elements.roomDialog.showModal());
  elements.closeRoomButton.addEventListener("click", () => elements.roomDialog.close());
  elements.roomGrid.addEventListener("click", (event) => { const button = event.target.closest("[data-room]"); if (!button) return; startAmbient(button.dataset.room); });
  elements.ambientVolume.addEventListener("input", () => { state.settings.ambientVolume = Number(elements.ambientVolume.value); if (ambientGain) ambientGain.gain.value = (state.settings.ambientVolume / 100) * .15; saveState(); renderRooms(); });
  elements.miniTimer.addEventListener("click", enterFocusMode);
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && elements.body.classList.contains("focus-mode")) { elements.body.classList.remove("focus-mode"); elements.focusOverlay.setAttribute("aria-hidden", "true"); } });

  document.addEventListener("keydown", (event) => {
    const tag = document.activeElement.tagName;
    const dialogOpen = elements.settingsDialog.open || elements.taskDialog.open;
    if (event.code === "Space" && !/INPUT|TEXTAREA|BUTTON/.test(tag) && !dialogOpen) { event.preventDefault(); toggleTimer(); }
    if (event.key.toLowerCase() === "t" && !/INPUT|TEXTAREA/.test(tag) && !dialogOpen && !elements.body.classList.contains("focus-mode")) { event.preventDefault(); elements.taskInput.focus(); }
    if (event.key === "Escape" && elements.body.classList.contains("focus-mode")) exitFocusMode();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && timerState.running) tick(); });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
