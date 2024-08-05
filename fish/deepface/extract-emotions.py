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
#   python extract-emotions.py <path_to_input_video> <path_to_output_csv> [--epochs HH:MM:SS-HH:MM:SS]
#   ```
#
# Examples:
#
#   ```
#   python extract-emotions.py emotions_test.mov emotions.csv
#   python extract-emotions.py emotions_test.mov emotions.csv --epochs 00:00:00-00:00:30  # first 30 seconds only
#   python extract-emotions.py emotions_test.mov emotions.csv --epochs 01:15:00-01:30:00 01:45:00-01:50:00  # 1hr15 - 1hr30 epoch1, and also 1hr45 - 1hr50 epoch2
#   ```
#
# Note the first time you run it, it will download model weights (~1GB) which may take some time.
#

import logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info(f"Importing modules")

import argparse
import cv2
import csv
from deepface import DeepFace
import sys

parser = argparse.ArgumentParser(
    description=(
        "Extract emotions and demographic data from a video and "
        "save timestamps to a CSV file."
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
        "Epochs in HH:MM:SS-HH:MM:SS format. If unspecified, will extract "
        "for the whole duration of the video."
    )
)

def parse_time(time_str):
    h, m, s = map(int, time_str.split(':'))
    return h * 3600 + m * 60 + s

def extract_emotions(video_path, output_csv, epochs=None, interval_ms=100):
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

    # Parse epochs into start and end times in seconds
    if epochs:
        epochs_sec = [(parse_time(epoch.split('-')[0]), parse_time(epoch.split('-')[1])) for epoch in epochs]
    else:
        epochs_sec = [(0, duration)]

    # Calculate the interval in terms of frames
    frame_interval = int((interval_ms / 1000) * fps)
    logging.info(f"Frame interval: {frame_interval} frames ({interval_ms}ms)")

    # Prepare the output list
    results = []

    frame_number = 0
    current_epoch_idx = 0
    start_time, end_time = epochs_sec[current_epoch_idx]
    epoch_label = f"epoch{current_epoch_idx + 1}"

    while True:
        ret, frame = cap.read()
        timestamp = frame_number / fps

        if not ret or timestamp > epochs_sec[-1][1]:
            break

        if start_time <= timestamp <= end_time:
            if frame_number % frame_interval == 0:
                # Analyze the frame for emotions and demographic data
                result = DeepFace.analyze(frame, actions=['emotion', 'age', 'gender', 'race'], enforce_detection=False)

                if isinstance(result, list) and len(result) == 1:
                    result = result[0]
                else:
                    raise ValueError(f"Unexpected results {result}")

                logging.debug(f"result: {result}")
                try:
                    row = {
                        "epoch": epoch_label,
                        "timestamp_seconds": timestamp,
                        "gender": result['dominant_gender'],
                        "race": result['dominant_race'],
                        "age": result['age'],
                        "emotion": result['dominant_emotion'],
                    }
                    row.update(result['gender'])
                    row.update(result['race'])
                    row.update(result['emotion'])
                    logging.info(f"Analysed {row}")
                    results.append(row)
                except:
                    raise ValueError(f"Unexpected result format at {timestamp:.2f}s: {result}")

        if timestamp > end_time and current_epoch_idx < len(epochs_sec) - 1:
            current_epoch_idx += 1
            start_time, end_time = epochs_sec[current_epoch_idx]
            epoch_label = f"epoch{current_epoch_idx + 1}"

        frame_number += 1

    # Release the video capture object
    cap.release()

    # Write the results to a CSV file
    with open(output_csv, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    logging.info(f"Results saved to {output_csv}")

if __name__ == "__main__":
    args = parser.parse_args()
    extract_emotions(args.video_path, args.output_csv, args.epochs)