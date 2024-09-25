const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Get the URL and expected file path from command line arguments
const url = process.argv[2];
const expectedFilePath = process.argv[3];
const videoPath = process.argv[4];  // Custom video path as an optional argument

if (!url || !expectedFilePath) {
  console.error("Please provide both a URL and the path to the expected downloaded file.");
  process.exit(1);
}

// Check if the expected file already exists and remove it
if (fs.existsSync(expectedFilePath)) {
  console.error(`Expected downloaded file already exists: ${expectedFilePath}`);
  process.exit(1);
}

// Custom wait function for file existence
function waitForFile(filePath, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const interval = 100; // Check every 100ms
    const startTime = Date.now();

    const checkFile = () => {
      if (fs.existsSync(filePath)) {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for file to be created: ${filePath}`));
      } else {
        setTimeout(checkFile, interval);
      }
    };

    checkFile();
  });
}

(async () => {
  // Launch browser with flags to use a custom video for the fake camera stream if provided
  const launchOptions = {
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',    // Automatically grants access to the camera
      '--use-fake-device-for-media-stream', // Uses a fake video stream (useful for testing)
    ]
  };

  if (videoPath) {
    launchOptions.args.push('--use-file-for-fake-video-capture=' + videoPath);
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // Set the download behavior to download files to a custom directory
  const downloadDir = path.dirname(expectedFilePath);
  await page._client().send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir
  });

  // Navigate to the URL provided as a command-line argument
  await page.goto(url);

  // Wait for the 'start-game' button to become enabled and clickable
  await page.waitForSelector('#start-game:not([disabled])', { visible: true });

  // Click the 'start-game' button
  await page.click('#start-game');

  // Define a function to click the fish every 0.5 seconds
  const clickFish = async () => {
    const interval = setInterval(async () => {
      const fishVisible = await page.$eval('#fish', fish => fish.offsetParent !== null);
      if (fishVisible) {
        await page.click('#fish');
      }
    }, 500);

    // Wait until the 'download-log' button is visible
    await page.waitForSelector('#download-log', { visible: true });

    // Clear the interval to stop clicking on the fish
    clearInterval(interval);

    // Click the 'download-log' button
    await page.click('#download-log');
  };

  // Start clicking the fish
  await clickFish();

  // Wait for the expected file to be created
  try {
    await waitForFile(expectedFilePath, 3000);
    console.log(`File downloaded: ${expectedFilePath}`);
  } catch (err) {
    console.error(err.message);
  }

  // Close the browser after the file download is detected
  await browser.close();
})();