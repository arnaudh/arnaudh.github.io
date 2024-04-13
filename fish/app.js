// TODO show/link to license of face-api.js

const urlParams = new URLSearchParams(window.location.search);
const show_video = urlParams.get('show_video') === 'true';
const timer_duration = urlParams.get('timer_duration') || 300;
const trial_duration = urlParams.get('trial_duration') || 5;

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
    // Check if the trial is complete
    if (remaining_seconds % trial_duration == 0) {
        // Check if both click and facial expression were correct
        if (correct_click && correct_face) {
            score++;
            document.getElementById('score').textContent = score;
        // if (correct_click) {
            // Display gold coin
            coinElement.style.visibility = 'visible';
            setTimeout(() => {
                coinElement.style.visibility = 'hidden';
            }, 100);
        }
        // Reset correct count for the next trial
        correct_click = false;
        correct_face = false;
    }
    if (remaining_seconds === 0) {
        timerElement.textContent = 'Game Complete!';
    } else {
        expected += interval;
        // Self-adjusting timer
        setTimeout(updateTimer, Math.max(0, interval - drift));
    }
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
