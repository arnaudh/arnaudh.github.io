// TODO show/link to license of face-api.js

const urlParams = new URLSearchParams(window.location.search);
const show_video = urlParams.get('show_video') === 'true';
const log_detected = urlParams.get('log_detected') === 'true';
const game_duration = urlParams.get('game_duration') || 300;
const trial_duration = urlParams.get('trial_duration') || 5;

const starfish_onset = 1;
const starfish_offset = 4;

if (game_duration % trial_duration != 0) {
    throw new Error('Timer duration should be a multiple of trial duration');
}

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
            console.error("Error accessing webcam:", err);
        });
}

async function detectFaces() {

    // Check if the models are loaded
    if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceExpressionNet.isLoaded) {
        // TODO try with bigger model, should give more accurate (though slower) face bounding box
        // detection, and so better smile detection?
        options = new faceapi.TinyFaceDetectorOptions();
        detections = await faceapi.detectAllFaces(video, options).withFaceExpressions();

        // console.log('detections', detections);



        // detections.forEach(detection => {
            // console.log(detection.expressions);
            // if (detection.expressions.happy > 0.5) {
            //     console.log("Smile Detected!");
            // }
        // });
        if (detections.length > 0) {
            logEvent('Face detected', detections[0].expressions);
            smileDetected = detections[0].expressions.happy > 0.1;
            if (smileDetected) {
                logEvent('Smile detected');
            }
        } else { 
            logEvent('No face detected');
            // TODO error if no face detected?
        }
        // smileDetected = detections.some(detection => detection.expressions.happy > 0.1);
    } else {
        console.log('MODELS NOT LOADED');
    }

    // Repeat this function
    // requestAnimationFrame(detectFaces);
    detectFacesTimeout = setTimeout(detectFaces, 100);
}



let gameLog = [];
let totalTime; // for game control
let displayTime; // for display, updated every second
let correctClick;
let trialNumber;
let starfishShowing;

let detectFacesTimeout;

function startGame() {
    startGameButton.disabled = true;
    logEvent('Game started');
    totalTime = game_duration;
    displayTime = game_duration;
    trialNumber = 0;
    starfishShowing = false;
    setupFishOnClick();
    updateCountdownDisplay();
    countdownTimer = setInterval(updateCountdownDisplay, 1000); // Update every second
    detectFaces();
    startTrial();
}

function setupFishOnClick() {
    const fish = document.getElementById('fish');
    fish.onclick = (event) => {
        event.stopPropagation(); // Prevent triggering the page-wide click logger
        logEvent('Fish clicked');
        if (starfishShowing && happy_face()) {
            correctClick = true;
            logEvent('Fish clicked correctly');
            starfish.style.transition = 'all 0.5s ease';
            starfish.style.transform = 'translateY(-100px)';
            setTimeout(() => {
                starfish.style.display = 'none';
                starfish.style.transform = '';
                logEvent('Starfish disappeared after correct click');
                starfishShowing = false;
            }, 500);
        }
    };
}

function logPageClick(event) {
    const elementClicked = `${event.target.tagName} ${event.target.id}`;
    logEvent(`Clicked on: ${elementClicked}`);
}

function startTrial() {
    console.log('totalTime', totalTime);
    console.log('trialNumber', trialNumber);
    if (totalTime == 0) {
        endGame();
        return;
    }
    trialNumber++;
    logEvent('Trial started', trialNumber);
    correctClick = false;
    moveFish();
    let randomTime = Math.random() * (starfish_offset-starfish_onset) + starfish_onset; // Starfish appears randomly between 1-4 seconds
    randomTime = randomTime * 1000;
    console.log('randomTime', randomTime);
    setTimeout(showStarfish, randomTime);
    setTimeout(showGoldCoinAndPlayPing, trial_duration * 1000 - 100);

    totalTime -= 5; // Decrement the total game time by the duration of one trial
    // next trial (or end game if time is up)
    setTimeout(startTrial, 5000);
}

function showStarfish() {
    starfishShowing = true;
    starfish.style.display = 'block';
    starfish.style.left = `${Math.random() * (800 - 32)}px`; // Assuming the game container and starfish width
    starfish.style.top = `${Math.random() * (600 - 32)}px`; // Assuming the game container and starfish height
    logEvent('Starfish appeared');

    setTimeout(() => {
        if (!correctClick) {
            starfish.style.display = 'none';
            logEvent('Starfish disappeared automatically');
        }
        starfishShowing = false;
    }, 1000);
}

function showGoldCoinAndPlayPing() {
    if (correctClick) {
        logEvent('Gold coin appeared');
        pingSound.play();
        goldCoin.style.display = 'block';

        setTimeout(() => {
            goldCoin.style.display = 'none';
            logEvent('Gold coin disappeared');
        }, 100);
    }
}

function updateCountdownDisplay() {
    let minutes = Math.floor(displayTime / 60);
    let seconds = displayTime % 60;
    countdownDisplay.textContent = `Time Remaining: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (displayTime == 0) {
        clearInterval(countdownTimer);
    } else {
        displayTime--;
    }
}

function endGame() {
    clearTimeout(detectFacesTimeout);
    logEvent('Game ended');
    downloadButton.style.display = 'block';
}
function logEvent(gameEvent, metadata = null) {
    const timestamp = new Date().toISOString();
    // console.log('metadata', metadata);
    const metadataEntries = metadata && typeof metadata === 'object' ? Object.entries(metadata).flat() : [metadata];
    gameLog.push({ timestamp, gameEvent, metadata });
    if (gameEvent.includes("detected") && !log_detected) {
        return;
    }
    console.log(`${timestamp}: ${gameEvent} (${metadataEntries.map(entry => typeof entry === 'number' ? entry.toFixed(2) : entry).join(', ')})`);
}


function downloadLog() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Event,Timestamp\n" 
        + gameLog.map(eventToCsv).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "game_log.csv");
    link.click();
}

function eventToCsv(event) {
    let metadata = event.metadata;
    const metadataEntries = metadata && typeof metadata === 'object' ? Object.entries(metadata).flat() : [metadata];
    return [event.timestamp, event.gameEvent].concat(metadataEntries).join(",");
}


function moveFish() {
    let posX = 10; // Horizontal position
    let posY = 10; // Vertical position
    let directionX = 1; // Horizontal direction
    let directionY = 1; // Vertical direction
    const speed = 1.2; // Movement speed
    const fishSize = fish.clientWidth;
    const maxX = gameContainer.clientWidth - fishSize;
    const maxY = gameContainer.clientHeight - fishSize;

    function move() {
        // Randomize direction change
        if (Math.random() < 0.01) {
            directionX *= -1;
            directionY *= -1;
        }

        // Change direction on reaching boundaries
        if (posX + speed > maxX || posX - speed < 0) {
            directionX *= -1;
        }
        if (posY + speed > maxY || posY - speed < 0) {
            directionY *= -1;
        }

        // Update positions
        posX += speed * directionX;
        posY += speed * directionY;
        fish.style.left = posX + 'px';
        fish.style.top = posY + 'px';

        requestAnimationFrame(move);
    }

    move();
}

function happy_face() {
    // TODO
    return true;
}


loadModels().then(() => {
    setupWebcam();
});
