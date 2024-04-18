// TODO show/link to license of face-api.js

const urlParams = new URLSearchParams(window.location.search);
const show_video = urlParams.get('show_video') === 'true';
const timer_duration = urlParams.get('timer_duration') || 300;
const trial_duration = urlParams.get('trial_duration') || 5;


const starfish_onset = 1;
const starfish_offset = 4;

if (timer_duration % trial_duration != 0) {
    throw new Error('Timer duration should be a multiple of trial duration');
}

let smileDetected = false;
let score = 0;
let detections = null;

console.log('HERE');
async function loadModels() {
    // Load the models from their respective URIs
    await faceapi.nets.tinyFaceDetector.loadFromUri('models');
    await faceapi.nets.faceExpressionNet.loadFromUri('models');
    // Other models can be loaded similarly if needed
}


const timerElement = document.getElementById('timer');
const emojiElement = document.getElementById('emoji');
const coinElement = document.getElementById('coin');

this.video = document.createElement('video');
this.video.setAttribute('id', 'video');
this.video.setAttribute('autoplay', 'muted');
document.body.appendChild(this.video);

if (show_video) {
    document.getElementById('video').style.display = 'block';
} else {
    document.getElementById('video').style.display = 'none';
}

function setupWebcam() {
    const video = document.getElementById('video');

    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            console.log('got stream');
            video.srcObject = stream;
            video.onloadeddata = () => {
                // Video is ready. Now you can start face detection
                detectFaces();
            };
        })
        .catch(err => {
            console.error("Error accessing webcam:", err);
        });
}



async function detectFaces() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');

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
            smileDetected = detections[0].expressions.happy > 0.1;
            if (smileDetected) {
                console.log('Smile detected');
            }
        } { 
            // TODO error if no face detected?
        }
        // smileDetected = detections.some(detection => detection.expressions.happy > 0.1);
    } else {
        console.log('MODELS NOT LOADED');
    }

    // Repeat this function
    requestAnimationFrame(detectFaces);
}

loadModels().then(() => {
    setupWebcam();
});
const start_time = Date.now();
const interval = 1000;
let expected = start_time;

let correct_click = false;
let correct_face = false;

const trials_data = [];

let events = [];
function log_event(name, metadata) {
    const timestamp = new Date().toISOString();
    const event = {
        timestamp,
        name,
        metadata
    };
    events.push(event);
}


function updateTimer() {
    let drift = Date.now() - expected;
    let elapsed_milliseconds = Date.now() - start_time;
    console.log('elapsed_milliseconds', elapsed_milliseconds);
    let elapsed_seconds = Math.round(elapsed_milliseconds / 1000);
    console.log('elapsed_seconds', elapsed_seconds);
    let remaining_seconds = Math.max(timer_duration - elapsed_seconds, 0);
    let minutes = Math.floor(remaining_seconds / 60);
    let seconds = remaining_seconds % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (elapsed_seconds % trial_duration == 0 && remaining_seconds != 0) {
        // Start of trial
        
        // Show the smiling starfish at a random time between starfish_onset and starfish_offset
        const starfish_random_time = starfish_onset + Math.random() * (starfish_offset - starfish_onset);
        log('starfish_random_time', starfish_random_time);
        setTimeout(
            showSmilingStarfish,
            starfish_random_time * 1000
        );
    }


    if (elapsed_seconds > 0 && elapsed_seconds % trial_duration == 0) {
        // Store correct_click and correct_face in a 2D array
        trials_data.push([correct_click ? 1 : 0, correct_face ? 1 : 0]);

        // Reset correct count for the next trial
        correct_click = false;
        correct_face = false;
    }
    if (remaining_seconds === 0) {
        timerElement.textContent = 'Game Complete!';

        // Convert trials_data to CSV format
        let csv = trials_data.map(row => row.join(',')).join('\n');
        console.log('csv', csv);

        // Download the CSV file
        function downloadCSV(data, filename) {
            const csvBlob = new Blob([data], { type: 'text/csv' });
            const csvURL = URL.createObjectURL(csvBlob);
            const link = document.createElement('a');
            link.href = csvURL;
            link.download = filename;
            link.click();
        }
        // Example usage
        downloadCSV(csv, 'results.csv');
    } else {
        expected += interval;
        // Self-adjusting timer // TODO Actually don't need this, think about it if a trial is super long for some reason (eg browser GC), we don't want to speedup subsequent trials to "catch up", we want them to still be steady 5s.
        setTimeout(updateTimer, Math.max(0, interval - drift));
    }
}

function showSmilingStarfish() {
    log_event("starfish_onset");
    const container = document.getElementById('emojiContainer');
    const smilingStarfish = document.createElement('div');
    smilingStarfish.setAttribute('class', 'smiling-starfish');
    smilingStarfish.style.left = getRandomPosition(container.clientWidth) + 'px';
    smilingStarfish.style.top = getRandomPosition(container.clientHeight) + 'px';
    container.appendChild(smilingStarfish);

    setTimeout(() => {
        container.removeChild(smilingStarfish);
    }, 1000);
}

function getRandomPosition(max) {
    return Math.floor(Math.random() * max);
}

updateTimer();

function clickFish() {
    correct_click = true;
    // console.log('last detections', detections[0].expressions);
    if (smileDetected) {
        correct_face = true;
        // emojiElement.textContent = '🟢'; // Green circle for smile
    } else {
        // emojiElement.textContent = '🔴'; // Red circle for no smile
    }

    // // Reset to fish emoji after some time
    // setTimeout(() => {
    //     emojiElement.textContent = '🐟';
    // }, 500);
}
document.getElementById('emoji').addEventListener('click', clickFish);

function animateEmoji() {
    const emoji = document.getElementById('emoji');
    let posX = 10; // Horizontal position
    let posY = 10; // Vertical position
    let directionX = 1; // Horizontal direction
    let directionY = 1; // Vertical direction
    const speed = 1.2; // Movement speed
    const emojiSize = emoji.clientWidth;
    const container = document.getElementById('emojiContainer');
    const maxX = container.clientWidth - emojiSize;
    const maxY = container.clientHeight - emojiSize;

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
        emoji.style.left = posX + 'px';
        emoji.style.top = posY + 'px';

        requestAnimationFrame(move);
    }

    move();
}

animateEmoji();
