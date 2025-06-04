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

// Stats elements
const breaksTakenEl = document.getElementById('breaks-taken');
const streakEl = document.getElementById('streak');

let timer = null;
let timeLeft;
let settings;
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
}

function startTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    timeLeft = settings.workInterval * 60;
    updateTimerDisplay();
    
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            timer = null;
            startBreak();
        }
    }, 1000);
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

// Add IPC listener for break end
ipcRenderer.on('break-ended', () => {
    if (!timer) {
        startTimer();
    }
});

// Add IPC listener for snooze
ipcRenderer.on('break-snoozed', () => {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    
    timeLeft = 300; // 5 minutes in seconds
    updateTimerDisplay();
    
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            timer = null;
            startBreak();
        }
    }, 1000);
});

// Initialize the app
init(); 