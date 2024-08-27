#!/usr/bin/env python3

# Script to extract emotions from a video.
#
# 1. Installation
#
# This script uses the [deepface library](https://github.com/serengil/deepface), which requires
# Python >=3.7. Ensure `which python` gives you 3.7 or above before proceeding. These instructions
# have been verified to work for Python 3.10.14 on MacOS 14.5.
#
# Best to install dependencies in a new python environment. You can create one with the built-in
# `venv` module:
#
#   ```
#   python -m venv fisher-deepface
#   ```
#
# This will create a folder/environment named `fisher-deepface` (you can pick a different name) in
# the directory where you ran that command.
#
# Activate the environment:
#
#   ```
#   source fisher-deepface/bin/activate
#   ```
#
# Then install the required dependencies:
#
#   ```
#   pip install deepface tf-keras
#   ```
#
# (Note installing `deepface` installs most of its dependencies, like OpenCV and Tensorflow. However
# I got an error trying to import it after `pip install deepface`: "You have tensorflow 2.17.0 and
# this requires tf-keras package.".  Pip installing `tf-keras` fixes it, hence why I put it in the
# command above.)
#
# 2. Run
#
# After activating the environment (you'll need to do this whenever you open a new terminal and want
# to run the script), you can run the script like so:
#
#   ```
#   python extract-emotions.py <path_to_input_video> <path_to_output_csv> [--interval x] [--epochs HH:MM:SS-HH:MM:SS]
#   ```
#
# (See full usage with `python extract-emotions.py -h`)
#
# Examples:
#
#   ```
#   python extract-emotions.py emotions_test.mov emotions.csv --interval 2.5  # extract every 2.5 seconds
#   python extract-emotions.py emotions_test.mov emotions.csv --epochs 00:00:00-00:00:30  # first 30 seconds only
#   python extract-emotions.py emotions_test.mov emotions.csv --epochs 01:15:00-01:30:00 01:45:00-01:50:00  # epoch1 (1hr15 - 1hr30), and also epoch2 (1hr45 - 1hr50)
#   ```
#
# Note the first time you run it, it will download model weights (~1GB) which may take some time.
#
import logging
import os
import cv2
import csv
from deepface import DeepFace
import argparse
from datetime import datetime

parser = argparse.ArgumentParser(
    description=(
        "Extract emotions and demographic data from a video, save frames with detected faces, "
        "and save timestamps to a CSV file."
    )
)
parser.add_argument(
    'video_path',
    type=str,
    help="Path to the input video file."
)
parser.add_argument(
    'output_csv',
    type=str,
    help="Path to the output CSV file."
)
parser.add_argument(
    '--epochs',
    type=str,
    nargs='+',
    help=(
        "Epochs to extract, in HH:MM:SS-HH:MM:SS format. If unspecified, will extract "
        "for the whole duration of the video."
    )
)
parser.add_argument(
    '--interval',
    type=float,
    default=0.1,
    help="Interval in seconds between frames to process. Default is 0.1 s."
)
parser.add_argument(
    '--debug',
    action='store_true',
    help="If set, enable debug mode and save frames to a directory."
)

args = parser.parse_args()

# Set logging level based on debug flag
log_level = logging.DEBUG if args.debug else logging.INFO
logging.basicConfig(level=log_level, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info(f"Importing modules")

def parse_time(time_str):
    h, m, s = map(int, time_str.split(':'))
    return h * 3600 + m * 60 + s

def seconds_to_hms(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02}.{ms:03}"

def extract_emotions(video_path, output_csv, epochs=None, interval_s=0.1, save_frames=False):
    # Initialize video capture
    logging.info(f"Opening video {video_path}")
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise ValueError("Error: Could not open video.")

    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps
    logging.info(f"Video opened: {video_path}")
    logging.info(f"FPS: {fps}, Frame count: {frame_count}, Duration: {duration:.2f}s")

    # Create a directory to save frames if in debug mode
    if save_frames:
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        frames_dir = f"frames_{timestamp_str}"
        os.makedirs(frames_dir, exist_ok=True)
        logging.info(f"Saving frames to directory: {frames_dir}")
    else:
        frames_dir = None

    # Parse epochs into start and end times in seconds
    if epochs:
        epochs_sec = [(parse_time(epoch.split('-')[0]), parse_time(epoch.split('-')[1])) for epoch in epochs]
    else:
        epochs = ["full video"]
        epochs_sec = [(0, duration)]

    # Calculate the interval in terms of frames
    frame_interval = int(interval_s * fps)
    logging.info(f"Frame interval: {frame_interval} frames ({interval_s}s)")

    # Prepare the output list
    results = []

    frame_number = 0
    current_epoch_idx = 0
    start_time, end_time = epochs_sec[current_epoch_idx]
    epoch_label = f"epoch{current_epoch_idx + 1} ({epochs[current_epoch_idx]})"

    while True:
        ret, frame = cap.read()
        timestamp = frame_number / fps

        if not ret or timestamp > epochs_sec[-1][1]:
            break

        if start_time <= timestamp <= end_time:
            if frame_number % frame_interval == 0:
                log_prefix = f"[timestamp {timestamp:.2f}s]"
                # Analyze the frame for emotions and demographic data
                face_results = DeepFace.analyze(frame, actions=['emotion', 'age', 'gender', 'race'], enforce_detection=False, silent=True)
                # Remove those with face_confidence == 0 (dunno why these show up in the first place)
                face_results = [r for r in face_results if r['face_confidence'] > 0]

                # Draw rectangle around detected face and save the frame if in debug mode
                if save_frames:
                    for result in face_results:
                        region = result['region']
                        x, y, w, h = region['x'], region['y'], region['w'], region['h']
                        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

                    frame_filename = f"{frames_dir}/frame_{frame_number:06d}.jpg"
                    cv2.imwrite(frame_filename, frame)
                    logging.info(f"{log_prefix} Saved frame to {frame_filename}")

                if len(face_results) != 1:
                    logging.warn(f"{log_prefix} Skipping because found {len(face_results)} faces")
                else:
                    result = face_results[0]

                    logging.debug(f"{log_prefix} result: {result}")
                    try:
                        row = {
                            "epoch": epoch_label,
                            "frame": frame_number,
                            "timestamp": seconds_to_hms(timestamp),
                            "timestamp_seconds": timestamp,
                            "gender": result['dominant_gender'],
                            "race": result['dominant_race'],
                            "age": result['age'],
                            "emotion": result['dominant_emotion'],
                        }
                        row.update({f"gender:{k}": v for k, v in result['gender'].items()})
                        row.update({f"race:{k}": v for k, v in result['race'].items()})
                        row.update({f"emotion:{k}": v for k, v in result['emotion'].items()})
                        logging.info(f"{log_prefix} Analysis: {row['gender']} {row['race']} {row['age']} {row['emotion']}")
                        logging.debug(f"{log_prefix} Full analysis: {row}")
                        results.append(row)

                    except:
                        raise ValueError(f"{log_prefix} Unexpected result format at {timestamp:.2f}s: {result}")

        if timestamp > end_time and current_epoch_idx < len(epochs_sec) - 1:
            current_epoch_idx += 1
            start_time, end_time = epochs_sec[current_epoch_idx]
            epoch_label = f"epoch{current_epoch_idx + 1} ({epochs[current_epoch_idx]})"

        frame_number += 1

    # Release the video capture object
    cap.release()

    # Write the results to a CSV file
    with open(output_csv, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    logging.info(f"Results saved to {output_csv}")
    if save_frames:
        logging.info(f"Frames saved in directory: {frames_dir}")

if __name__ == "__main__":
    extract_emotions(args.video_path, args.output_csv, args.epochs, args.interval, save_frames=args.debug)