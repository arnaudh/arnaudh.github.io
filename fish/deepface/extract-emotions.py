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
#   python extract-emotions.py <path_to_input_video> <path_to_output_csv>
#   ```
#
# For example:
#
#   ```
#   python extract-emotions.py emotions_test.mov emotions.csv
#   ```
#

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info(f"Importing modules")

import argparse
import cv2
import csv
from deepface import DeepFace
import sys


parser = argparse.ArgumentParser(
    description="Extract emotions from a video and save timestamps to a CSV file."
)
parser.add_argument('video_path', type=str, help="Path to the input video file.")
parser.add_argument('output_csv', type=str, help="Path to the output CSV file.")


def extract_emotions(video_path, output_csv, interval_ms=100):
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

    # Calculate the interval in terms of frames
    frame_interval = int((interval_ms / 1000) * fps)
    logging.info(f"Frame interval: {frame_interval} frames ({interval_ms}ms)")

    # Prepare the output list
    results = []

    frame_number = 0

    while True:
        ret, frame = cap.read()

        if not ret:
            break

        timestamp = frame_number / fps

        if frame_number % frame_interval == 0:
            # Analyze the frame for emotions
            result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)

            if isinstance(result, list) and len(result) == 1:
                result = result[0]

            if 'dominant_emotion' in result and 'emotion' in result:
                row = {"timestamp_seconds": timestamp, "dominant_emotion": result['dominant_emotion']}
                logging.info(f"Analysing {row}")
                row.update(result['emotion'])

                results.append(row)
            else:
                raise ValueError(f"Unexpected result format at {timestamp:.2f}s: {result}")

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
    extract_emotions(args.video_path, args.output_csv)
