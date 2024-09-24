#!/usr/bin/env python3

# This script converts the raw CSV data from the experiment into a simplified CSV format.
# The simplified format has one row per trial, with columns for each emotion's average value, and other relevant data.
# Usage:
#     python3 convert_csv.py <path_to_raw_csv>
# Can also convert multiple files at once:
#     python3 convert_csv.py <path_to_raw_csv_1> <path_to_raw_csv_2> ...
# This will create a new file with the same name as the input file(s), but with '_simplified' appended to the name.

import csv
from statistics import mean
import sys


def convert_csv(file_path):
    with open(file_path, 'r') as file:
        rows = list(csv.reader(file))

    # Initialize structures to store parsed data
    trials_data = []
    current_trial_data = []
    trial_number = None

    # Parse each line based on its type
    for row in rows:
        if len(row) < 3:
            continue
        timestamp = row[0]
        event = row[1]
        metadata = ','.join(row[2:])
        if event == "Trial started":
            # Starting new trial
            trial_number = int(metadata)
            if current_trial_data:
                # Save previous trial data before starting new
                trials_data.append(current_trial_data)
                current_trial_data = []
        elif trial_number is not None:
            # Accumulate data for the current trial
            structured_data = {'timestamp': timestamp, 'event': event, 'metadata': metadata, 'trial_number': trial_number}
            current_trial_data.append(structured_data)

    # Handle last trial if any
    if current_trial_data:
        trials_data.append(current_trial_data)

    # Simplify the data by processing each trial's data
    simplified_data = []
    for trial in trials_data:
        trial_number = trial[0]['trial_number']
        # Note we hardcode the emotion names here in case some/all trials don't have detected faces
        emotions_dict = {
            'neutral': [],
            'happy': [],
            'sad': [],
            'angry': [],
            'fearful': [],
            'disgusted': [],
            'surprised': []
        }
        face_detected_count = 0
        no_face_detected_count = 0
        starfish_image = None
        average_happy = None
        fish_clicked_correctly_count = 0
        fish_clicked_incorrectly_count = 0

        for data in trial:
            if data['event'] == 'Face detected':
                face_detected_count += 1
                emotions = data['metadata'].split(',')
                for i in range(0, len(emotions), 2):
                    emotion = emotions[i]
                    value = float(emotions[i+1])
                    if emotion not in emotions_dict:
                        emotions_dict[emotion] = []
                    emotions_dict[emotion].append(value)
            if data['event'] == 'No face detected':
                no_face_detected_count += 1
            if data['event'] == 'Starfish appeared':
                starfish_image = data['metadata']
            if data['event'] == 'Average happy' and average_happy is None:
                average_happy = float(data['metadata']) if data['metadata'] else None
            if data['event'] == 'Fish clicked correctly':
                fish_clicked_correctly_count += 1
            if data['event'] == 'Fish clicked incorrectly':
                fish_clicked_incorrectly_count += 1

        trial_dict = {}
        trial_dict['trial_number'] = trial_number

        # Calculate average value for each emotion in emotions_dict
        for emotion, values in emotions_dict.items():
            average_value = round(mean(values), 2) if values else 'nan'
            trial_dict[emotion] = average_value

        trial_dict['Average Happy'] = round(average_happy, 2) if average_happy else 'nan'
        trial_dict['Face detected'] = face_detected_count
        trial_dict['No face detected'] = no_face_detected_count
        trial_dict['Fish clicked correctly'] = fish_clicked_correctly_count
        trial_dict['Fish clicked incorrectly'] = fish_clicked_incorrectly_count
        trial_dict['starfish_image'] = starfish_image
        simplified_data.append(trial_dict)

    # Output file path
    output_path = file_path.replace('.csv', '_simplified.csv')
    with open(output_path, 'w') as output_file:
        # Use first trial's data to get the column names
        output_file.write(','.join(simplified_data[0].keys()) + '\n')
        for trial in simplified_data:
            output_file.write(','.join(str(value) for value in trial.values()) + '\n')
    print("Wrote to file:", output_path)

    return output_path

# Convert each file passed as argument
for file_path in sys.argv[1:]:
    convert_csv(file_path)
