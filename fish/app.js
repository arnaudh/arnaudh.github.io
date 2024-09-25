/*
This project uses face-api.js (https://github.com/justadudewhohacks/face-api.js),
whose license is pasted here:

MIT License

Copyright (c) 2018 Vincent Mühler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const urlParams = new URLSearchParams(window.location.search);


// **************** ADJUSTABLE URL SETTINGS **************** //
// You can set the below parameters directly in the URL query string, e.g.:
//   http://<address.com>/?subject_id=123&session_number=1&number_of_trials=60&trial_duration=5000
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
const fish_speed = urlParams.get('fish_speed') || 0.8;
// Interval between end of face detection and beggining of next face detection
const detect_faces_interval = urlParams.get('detect_faces_interval') || 100;
// Threshold settings.
// Originally prefixed these settings with "happy_", but I realized this could be seen by
// participants in the URL and may interfere with the experiment, hence now these are without
// the "happy_" prefix (but still allowing the "happy_" prefixed names for backward compatibility,
// so previously shared URLs still work).
// Note default timestamp depends on mode (1s for percent, 4s for ratio).
const threshold_mode = urlParams.get('threshold_mode') || urlParams.get('happy_threshold_mode') || 'percent';  // or 'ratio'
const threshold = urlParams.get('threshold') || urlParams.get('happy_threshold') || 0.1;
const threshold_timespan = urlParams.get('threshold_timespan') || urlParams.get('happy_threshold_timespan') || (threshold_mode == 'percent' ? 1000 : 4000);

// *** Debug settings
const show_video = urlParams.get('show_video') === 'true';
const log_detected = urlParams.get('log_detected') === 'true';

// **************** END OF ADJUSTABLE URL SETTINGS **************** //


const game_duration = number_of_trials * trial_duration;

// *** Game variables
let gameActive = false;
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
    fish_speed,
    detect_faces_interval,
    threshold_mode,
    threshold,
    threshold_timespan,
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

const canvas = document.createElement('canvas');
canvas.setAttribute('id', 'overlay');
document.body.appendChild(canvas);

if (show_video) {
    video.style.display = 'block';
    canvas.style.display = 'block';
} else {
    // Keep the video active, but set opacity to 0 to make it invisible.
    // Note `display = 'none'` worked for Chrome and Firefox, but not for Safari (video stream was frozen).
    // Setting `opacity = 0` works for all.
    video.style.display = 'block';
    video.style.opacity = '0';
    canvas.style.display = 'none';
}

function setupWebcam() {
    logEvent('Setting up webcam');
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            video.onloadeddata = () => {
                logEvent('Webcam ready');

                // Match the canvas size with the video size
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Set the size and position of the canvas to overlay the video
                canvas.style.width = video.videoWidth + 'px';
                canvas.style.height = video.videoHeight + 'px';

                // Do 1 face detection to warm things up (Safari can take a while on the first one)
                detectFaces(() => {
                    // Everything is ready, can now let the user start the game
                    startGameButton.textContent = "Start game";
                    startGameButton.disabled = false;
                    startGameButton.addEventListener('click', startGame);
                })
            };
        })
        .catch(err => {
            alert(`Error accessing webcam: ${err}`);
        });
}

const face_decetor_options = new faceapi.TinyFaceDetectorOptions();

let detectFacesTimeout;
async function detectFaces(callback) {
    detections = await faceapi.detectAllFaces(video, face_decetor_options).withFaceExpressions();

    // Clear the canvas before drawing the new detections
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length > 0) {
        // Draw face detections onto the canvas
        faceapi.draw.drawDetections(canvas, detections);

        // Iterate over each detection to log specific expressions or other properties
        detections.forEach((detection, index) => {
            let message = index == 0 ? 'Face detected' : `Face detected ${index + 1}`;
            logEvent(message, detection.expressions);
        });

    } else { 
        logEvent('No face detected');
    }
    if (gameActive) {
        // Repeat
        detectFacesTimeout = setTimeout(detectFaces, detect_faces_interval);
    }
    if (callback) {
        callback();
    }
}





function startGame() {
    gameActive = true;
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
        if (starfishShowing && is_happy_face()) {
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
    let imageName = `image${randomImageNumber}.png`;
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
    gameActive = false;
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


function escapeCsv(value) {
    // Escape double quotes by doubling them
    value_doubled_quotes = String(value).replace(/"/g, '""');
    // Always wrap the value in double quotes
    return `"${value_doubled_quotes}"`;
}

function eventToCsv(event) {
    let metadata = event.metadata;
    const metadataEntries = metadata && typeof metadata === 'object' ? Object.entries(metadata).flat() : [metadata];
    return [event.timestamp.toISOString(), event.gameEvent].concat(metadataEntries).map(escapeCsv).join(",");
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
function is_happy_face() {
    const currentTime = new Date();
    const pastTime = new Date(currentTime.getTime() - threshold_timespan);
    const faceDetections = gameLog.filter(event => event.gameEvent === "Face detected" && event.timestamp >= pastTime && event.timestamp <= currentTime);
    // console.log("faceDetections", faceDetections)
    if (faceDetections.length > 0) {
        const totalHappy = faceDetections.reduce((sum, event) => sum + event.metadata.happy, 0.0);
        const totalFearful = faceDetections.reduce((sum, event) => sum + event.metadata.fearful, 0.0);
        const averageHappy = totalHappy / faceDetections.length;
        logEvent('Average happy', averageHappy);
        logEvent('Total happy', totalHappy);
        logEvent('Total fearful', totalFearful);
        if (threshold_mode == 'percent') {
            return averageHappy >= threshold;
        } else if (threshold_mode == 'ratio') {
            return totalHappy > totalFearful;
        } else {
            error(`Unknown threshold_mode "${threshold_mode}"`)
        }
    } else {
        logEvent('Average happy', null);
        logEvent('Total happy', null);
        logEvent('Total fearful', null);
        return false;
    }
}


function error(s) {
    alert(s);
    throw new Error(s);
}

function collectSystemInfo(callback) {
    console.log('Collecting system info...')
    // Helper function to collect all enumerable properties of an object
    function getProperties(obj) {
        let result = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key) || typeof obj[key] !== 'function') {
                try {
                    result[key] = obj[key];
                } catch (error) {
                    result[key] = "N/A"; // If access to property fails (e.g., security issues)
                }
            }
        }
        return result;
    }

    // Create the info object
    let info = {
        navigator: getProperties(navigator),
        screen: getProperties(screen),
        window: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            screenX: window.screenX,
            screenY: window.screenY,
            location: {
                href: window.location.href,
                protocol: window.location.protocol,
                host: window.location.host,
                hostname: window.location.hostname,
                pathname: window.location.pathname,
                hash: window.location.hash
            }
        }
    };

    // Pass the info object to the callback
    callback(info);
}

function flattenObject(obj, parentKey = '', result = {}) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        // Recursively call for nested objects
        flattenObject(obj[key], newKey, result);
      } else {
        // Assign the value to the flat object
        result[newKey] = obj[key];
      }
    }
  }
  return result;
}

collectSystemInfo(function(info) {
    logEvent('System info', flattenObject(info));
    loadModels().then(() => {
        if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceExpressionNet.isLoaded) {
            setupWebcam();
        } else {
            alert('Models could not be loaded, cannot start the game.');
        }
    });
});
