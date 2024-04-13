// TODO show/link to license of face-api.js

const urlParams = new URLSearchParams(window.location.search);
const showVideo = urlParams.get('showvideo') === 'true';
const timer_duration = urlParams.get('timer') || 300;

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

this.video = document.createElement('video');
this.video.setAttribute('id', 'video');
this.video.setAttribute('autoplay', 'muted');
document.body.appendChild(this.video);

if (showVideo) {
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

        console.log('detections', detections);



        // detections.forEach(detection => {
            // console.log(detection.expressions);
            // if (detection.expressions.happy > 0.5) {
            //     console.log("Smile Detected!");
            // }
        // });

        smileDetected = detections.some(detection => detection.expressions.happy > 0.1);
    } else {
        console.log('MODELS NOT LOADED');
    }

    // Repeat this function
    requestAnimationFrame(detectFaces);
}

loadModels().then(() => {
    setupWebcam();
});

let timer_completed = false;
const start = Date.now();
let timer = timer_duration;
const timerElement = document.getElementById('timer');
function updateTimer() {
    let delta = Date.now() - start; // milliseconds elapsed since start
    let remainingSeconds = Math.max(timer - Math.floor(delta / 1000), 0);
    let minutes = Math.floor(remainingSeconds / 60);
    let seconds = remainingSeconds % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (remainingSeconds === 0) {
        timer_completed = true;
        timerElement.textContent = 'Game Complete!';
        return;
    }
}
setInterval(updateTimer, 500);
updateTimer();

function clickFish() {
    console.log('last detections', detections[0].expressions);
    const emojiElement = document.getElementById('emoji');
    if (smileDetected) {
        score++;
        document.getElementById('score').textContent = score;
        emojiElement.textContent = '🟢'; // Green circle for smile
    } else {
        emojiElement.textContent = '🔴'; // Red circle for no smile
    }

    // Reset to fish emoji after some time
    setTimeout(() => {
        emojiElement.textContent = '🐟';
    }, 500);
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
