// TODO show/link to license of face-api.js

const urlParams = new URLSearchParams(window.location.search);


// **************** ADJUSTABLE URL SETTINGS **************** //
// You can set the below parameters directly in the URL query string, e.g.:
//   http://<address.com>/?subject_id=123&session_number=1&game_duration=300000&trial_duration=5000
// Note the "||" indicates the default value of that parameter if not set in the URL.

// *** Subject and session settings
const subject_id = urlParams.get('subject_id') || error('Missing subject_id in URL parameters');
const session_number = urlParams.get('session_number') || error('Missing session_number in URL parameters');

// *** Game settings (all times in milliseconds)
const number_of_trials = urlParams.get('number_of_trials') || 60;
const trial_duration = urlParams.get('trial_duration') || 5 * 1000; // default 5 seconds
const starfish_onset = urlParams.get('starfish_onset') || 1 * 1000;
const starfish_offset = urlParams.get('starfish_offset') || 4 * 1000;
const starfish_disappear_duration = urlParams.get('starfish_disappear_duration') || 500;
const coin_appear_delay = urlParams.get('coin_appear_delay') || 100;
const gold_coin_duration = urlParams.get('gold_coin_duration') || 200;
// Interval between end of face detection and beggining of next face detection
const detect_faces_interval = urlParams.get('detect_faces_interval') || 100;
const happy_threshold = urlParams.get('happy_threshold') || 0.1;
const happy_threshold_timespan = urlParams.get('happy_threshold_timespan') || 1000;
const fish_speed = urlParams.get('fish_speed') || 0.8;

// *** Debug settings
const show_video = urlParams.get('show_video') === 'true';
const log_detected = urlParams.get('log_detected') === 'true';

// **************** END OF ADJUSTABLE URL SETTINGS **************** //


const game_duration = number_of_trials * trial_duration;

// *** Game variables
let gameLog = [];
let totalTime; // for game control
let displayTime; // for display, updated every second
let correctClick;
let trialNumber;
let starfishShowing;
// Fish movement
let fish_posX = 10; // Horizontal position
let fish_posY = 10; // Vertical position
let fish_directionX = 1; // Horizontal direction
let fish_directionY = 1; // Vertical direction


logEvent('Page loaded',  {
    subject_id,
    session_number,
    number_of_trials,
    trial_duration,
    starfish_onset,
    starfish_offset,
    starfish_disappear_duration,
    gold_coin_duration,
    detect_faces_interval,
    happy_threshold,
    fish_speed,
});



async function loadModels() {
    logEvent('Loading models');
    // Load the models from their respective URIs
    await faceapi.nets.tinyFaceDetector.loadFromUri('models');
    await faceapi.nets.faceExpressionNet.loadFromUri('models');
    // Other models can be loaded similarly if needed
}


const fish = document.getElementById('fish');
const starfish = document.getElementById('starfish');
const goldCoin = document.getElementById('gold-coin');
const pingSound = document.getElementById('ping-sound');

const gameContainer = document.getElementById('game-container');
const startGameButton = document.getElementById('start-game');
const countdownDisplay = document.getElementById('countdown-display');
const trialDisplay = document.getElementById('trial-display');


const downloadButton = document.getElementById('download-log');
downloadButton.addEventListener('click', downloadLog);
document.addEventListener('click', logPageClick);


const video = document.createElement('video');
video.setAttribute('id', 'video');
video.setAttribute('autoplay', 'muted');
document.body.appendChild(video);

if (show_video) {
    video.style.display = 'block';
} else {
    video.style.display = 'none';
}

function setupWebcam() {
    logEvent('Setting up webcam');
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            video.onloadeddata = () => {
                logEvent('Webcam ready');
                // Video is ready, can now let the user start the game
                startGameButton.textContent = "Start game";
                startGameButton.disabled = false;
                startGameButton.addEventListener('click', startGame);
            };
        })
        .catch(err => {
            alert(`Error accessing webcam: ${err}`);
        });
}

const face_decetor_options = new faceapi.TinyFaceDetectorOptions();

let detectFacesTimeout;
async function detectFaces() {
    detections = await faceapi.detectAllFaces(video, face_decetor_options).withFaceExpressions();
    if (detections.length > 0) {
        // Note there might be more than 1 face detected, we just take the first one.
        // We could stop and display an error if more than 1 detected, but this could backfire in case the algorithm occasionally hallucinates other faces.
        logEvent('Face detected', detections[0].expressions);
    } else { 
        logEvent('No face detected');
    }
    // Repeat
    detectFacesTimeout = setTimeout(detectFaces, detect_faces_interval);
}





function startGame() {
    startGameButton.disabled = true;
    logEvent('Game started');
    totalTime = game_duration;
    displayTime = game_duration;
    trialNumber = 0;
    starfishShowing = false;
    setupFishOnClick();
    countdown();
    detectFaces();
    moveFish();
    startTrial();
}

function setupFishOnClick() {
    fish.onclick = (event) => {
        event.stopPropagation(); // Prevent triggering the page-wide click logger
        if (starfishShowing && happy_face()) {
            correctClick = true;
            logEvent('Fish clicked correctly');
            floatAwayStarfish();
            setTimeout(showGoldCoinAndPlayPing, coin_appear_delay);
        } else {
            logEvent('Fish clicked incorrectly');
        }
    };
}

function floatAwayStarfish() {
    starfish.style.transition = `all ${starfish_disappear_duration}ms ease`;
    starfish.style.transform = 'translateY(-100px)';
    setTimeout(() => {
        starfish.style.display = 'none';
        starfish.style.transition = '';
        starfish.style.transform = '';
        logEvent('Starfish disappeared after correct click');
        starfishShowing = false;
    }, starfish_disappear_duration);
}

function logPageClick(event) {
    const elementClicked = `${event.target.tagName} ${event.target.id}`;
    logEvent(`Clicked on: ${elementClicked}`);
}

function startTrial() {
    if (totalTime == 0) {
        endGame();
        return;
    }
    trialNumber++;
    logEvent('Trial started', trialNumber);
    trialDisplay.innerText = `Trial ${trialNumber} / ${number_of_trials}`;
    correctClick = false;
    let randomTime = starfish_onset + Math.random() * (starfish_offset - starfish_onset);
    // console.log('randomTime', randomTime);
    setTimeout(showStarfish, randomTime);

    totalTime -= trial_duration; // Decrement the total game time by the duration of one trial
    // next trial (or end game if time is up)
    setTimeout(startTrial, 5000);
}

function showStarfish() {
    const numStarfishImages = 8
    let randomImageNumber = Math.floor(Math.random() * numStarfishImages) + 1;
    let imageName = `Picture1.png-${randomImageNumber}.png`;
    let imageUrl = `images/starfish/${imageName}`;
    starfish.src = imageUrl;
    starfish.style.display = 'block';
    starfishShowing = true;
    starfish.style.left = `${Math.random() * (gameContainer.clientWidth - starfish.clientWidth)}px`;
    starfish.style.top = `${Math.random() * (gameContainer.clientHeight - starfish.clientHeight)}px`;
    logEvent('Starfish appeared', imageName);

    setTimeout(() => {
        if (!correctClick) {
            starfish.style.display = 'none';
            logEvent('Starfish disappeared automatically');
        }
        starfishShowing = false;
    }, 1000);
}

function showGoldCoinAndPlayPing() {
    logEvent('Gold coin appeared');
    pingSound.play();
    goldCoin.style.display = 'block';

    setTimeout(() => {
        goldCoin.style.display = 'none';
        logEvent('Gold coin disappeared');
    }, gold_coin_duration);
}

function countdown() {
    let minutes = Math.floor(displayTime / 1000 / 60);
    let seconds = (displayTime / 1000) % 60;
    countdownDisplay.textContent = `Time Remaining: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (displayTime != 0) {
        displayTime -= 1000;
        setTimeout(countdown, 1000); // Update every second
    }
}

function endGame() {
    clearTimeout(detectFacesTimeout);
    logEvent('Game ended');
    downloadButton.style.display = 'block';
    fish.innerHTML = '<span style="font-size: 20px;">Game completed!</span>🐟';
}

function logEvent(gameEvent, metadata = null) {
    const timestamp = new Date();
    // console.log('gameEvent', gameEvent, 'metadata', metadata);
    gameLog.push({ timestamp, gameEvent, metadata });
    const metadataEntries = metadata && typeof metadata === 'object' ? Object.entries(metadata).flat() : [metadata];
    if (gameEvent.includes("detected") && !log_detected) {
        return;
    }
    console.log(`${timestamp.toISOString()}: ${gameEvent} (${metadataEntries.map(entry => typeof entry === 'number' ? entry.toFixed(2) : entry).join(', ')})`);
}


function downloadLog() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Timestamp,Event,Metadata\n"
        + gameLog.map(eventToCsv).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FISHER_results_${subject_id}_${session_number}.csv`);
    link.click();
}

function eventToCsv(event) {
    let metadata = event.metadata;
    const metadataEntries = metadata && typeof metadata === 'object' ? Object.entries(metadata).flat() : [metadata];
    return [event.timestamp.toISOString(), event.gameEvent].concat(metadataEntries).join(",");
}

function moveFish() {
    function move() {
        // Randomize direction change
        if (Math.random() < 0.01) {
            fish_directionX *= -1;
            fish_directionY *= -1;
        }

        let maxX = gameContainer.clientWidth - fish.clientWidth;
        let maxY = gameContainer.clientHeight - fish.clientHeight;

        // Change direction on reaching boundaries
        if (fish_posX + fish_speed > maxX || fish_posX - fish_speed < 0) {
            fish_directionX *= -1;
        }
        if (fish_posY + fish_speed > maxY || fish_posY - fish_speed < 0) {
            fish_directionY *= -1;
        }

        // Update positions
        fish_posX += fish_speed * fish_directionX;
        fish_posY += fish_speed * fish_directionY;

        // Ensure fish within container boundaries
        if (fish_posX < 0) {
            fish_posX = 0;
        } else if (fish_posX > maxX) {
            fish_posX = maxX;
        }
        if (fish_posY < 0) {
            fish_posY = 0;
        } else if (fish_posY > maxY) {
            fish_posY = maxY;
        }

        fish.style.left = fish_posX + 'px';
        fish.style.top = fish_posY + 'px';

        // `requestAnimationFrame` can depend on the browser and the screen refresh rate, so using setTimeout instead
        setTimeout(move, 1000 / 60);
    }

    move();
}
function happy_face() {
    const currentTime = new Date();
    const pastTime = new Date(currentTime.getTime() - happy_threshold_timespan);
    const faceDetections = gameLog.filter(event => event.gameEvent === "Face detected" && event.timestamp >= pastTime && event.timestamp <= currentTime);
    // console.log("faceDetections", faceDetections)
    if (faceDetections.length > 0) {
        const totalHappy = faceDetections.reduce((sum, event) => sum + event.metadata.happy, 0.0);
        const averageHappy = totalHappy / faceDetections.length;
        logEvent('Average happy', averageHappy);
        return averageHappy >= happy_threshold;
    } else {
        logEvent('Average happy', null);
        return false;
    }
}


function error(s) {
    alert(s);
    throw new Error(s);
}

loadModels().then(() => {
    if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceExpressionNet.isLoaded) {
        setupWebcam();
    } else {
        alert('Models could not be loaded, cannot start the game.');
    }
});
