const { ipcRenderer } = require('electron');

// DOM Elements
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const minimizeBtn = document.getElementById('minimize-btn');
const closeBtn = document.getElementById('close-btn');

// Settings inputs
const workIntervalInput = document.getElementById('work-interval');
const breakIntervalInput = document.getElementById('break-interval');
const darkModeInput = document.getElementById('dark-mode');
const showCountdownInput = document.getElementById('show-countdown');

// Stats elements
const breaksTakenEl = document.getElementById('breaks-taken');
const streakEl = document.getElementById('streak');

let timer = null;
let timeLeft;
let settings;
let isPaused = false;
let stats = {
    breaksTaken: 0,
    streak: 0
};

// Initialize app
async function init() {
    settings = await ipcRenderer.invoke('get-settings');
    loadSettings();
    startTimer();
    loadStats();
}

function loadSettings() {
    workIntervalInput.value = settings.workInterval;
    breakIntervalInput.value = settings.breakInterval;
    darkModeInput.checked = settings.darkMode;
    showCountdownInput.checked = settings.showCountdown;
    document.body.classList.toggle('dark-mode', settings.darkMode);
}

function loadStats() {
    breaksTakenEl.textContent = stats.breaksTaken;
    streakEl.textContent = stats.streak;
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    minutesEl.textContent = minutes.toString().padStart(2, '0');
    secondsEl.textContent = seconds.toString().padStart(2, '0');
    // Send countdown update to main process
    ipcRenderer.send('update-countdown', timeLeft);
}

function createTimer(duration, onComplete) {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    timeLeft = duration;
    updateTimerDisplay();
    
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    timer = setInterval(() => {
        if (!isPaused) {
            const currentTime = Date.now();
            const remainingTime = Math.max(0, Math.floor((endTime - currentTime) / 1000));
            
            if (remainingTime !== timeLeft) {
                timeLeft = remainingTime;
                updateTimerDisplay();
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                timer = null;
                onComplete();
            }
        }
    }, 100); // Check more frequently for better accuracy
}

function startTimer() {
    createTimer(settings.workInterval * 60, startBreak);
}

function startBreak() {
    ipcRenderer.send('start-break');
    stats.breaksTaken++;
    loadStats();
}

// Event Listeners
minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

closeBtn.addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// Settings change handlers
workIntervalInput.addEventListener('change', async () => {
    settings.workInterval = parseInt(workIntervalInput.value);
    await ipcRenderer.invoke('update-settings', settings);
    startTimer();
});

breakIntervalInput.addEventListener('change', async () => {
    settings.breakInterval = parseInt(breakIntervalInput.value);
    await ipcRenderer.invoke('update-settings', settings);
});

darkModeInput.addEventListener('change', async () => {
    settings.darkMode = darkModeInput.checked;
    await ipcRenderer.invoke('update-settings', settings);
    document.body.classList.toggle('dark-mode', settings.darkMode);
});

// Add settings change handler for countdown toggle
showCountdownInput.addEventListener('change', async () => {
    settings.showCountdown = showCountdownInput.checked;
    await ipcRenderer.invoke('update-settings', settings);
    // Update tray immediately when setting changes
    ipcRenderer.send('update-countdown', timeLeft);
});

// Add IPC listener for break end
ipcRenderer.on('break-ended', () => {
    if (!timer) {
        startTimer();
    }
});

// Add IPC listener for snooze
ipcRenderer.on('break-snoozed', () => {
    createTimer(300, startBreak); // 5 minutes in seconds
});

// Add IPC listener for pause toggle
ipcRenderer.on('toggle-pause', (event, paused) => {
    isPaused = paused;
    // Update the countdown display immediately when paused/resumed
    updateTimerDisplay();
});

// Initialize the app
init(); 