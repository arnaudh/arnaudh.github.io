#!/usr/bin/env python3

from statistics import mean
import sys


def convert_csv(file_path):
    with open(file_path, 'r') as file:
        lines = file.readlines()

    # Initialize structures to store parsed data
    trials_data = []
    current_trial_data = []
    trial_number = -1

    # Parse each line based on its type
    for line in lines:
        parts = line.strip().split(',', 2)
        if len(parts) < 3:
            continue
        timestamp, event, metadata = parts
        if event == "Trial started":
            # Starting new trial
            trial_number = int(metadata)
            print("trial_number", trial_number)
            if current_trial_data:
                # Save previous trial data before starting new
                trials_data.append(current_trial_data)
                current_trial_data = []
        elif trial_number > -1:
            # Accumulate data for the current trial
            structured_data = {'timestamp': timestamp, 'event': event, 'metadata': metadata, 'trial_number': trial_number}
            print("structured_data", structured_data)
            current_trial_data.append(structured_data)

    # Handle last trial if any
    if current_trial_data:
        trials_data.append(current_trial_data)

    # Simplify the data by processing each trial's data
    simplified_data = []
    for trial in trials_data:
        trial_number = trial[0]['trial_number']
        happy_values = []
        face_detected_count = 0
        no_face_detected_count = 0
        fish_clicked_correctly_count = 0
        fish_clicked_incorrectly_count = 0
        starfish_image = None

        for data in trial:
            if data['event'] == 'Face detected':
                happy_value = float(data['metadata'].split('happy')[1].split(',')[1].strip())
                happy_values.append(happy_value)
                face_detected_count += 1
            if data['event'] == 'No face detected':
                no_face_detected_count += 1
            if data['event'] == 'Fish clicked correctly':
                fish_clicked_correctly_count += 1
            if data['event'] == 'Fish clicked incorrectly':
                fish_clicked_incorrectly_count += 1
            if data['event'] == 'Starfish appeared':
                starfish_image = data['metadata']

        trial_dict = {
            'trial_number': trial_number,
            'Average Happy': mean(happy_values) if happy_values else None,
            'Face detected': face_detected_count,
            'No face detected': no_face_detected_count,
            'Fish clicked correctly': fish_clicked_correctly_count,
            'Fish clicked incorrectly': fish_clicked_incorrectly_count,
            'starfish_image': starfish_image
        }
        simplified_data.append(trial_dict)

    # Output file path
    output_path = file_path.replace('.csv', '_simplified.csv')
    with open(output_path, 'w') as output_file:
        output_file.write(','.join(simplified_data[0].keys()) + '\n')
        for trial in simplified_data:
            output_file.write(','.join(str(value) for value in trial.values()) + '\n')
    print("Wrote to file:", output_path)

    return output_path

for file_path in sys.argv[1:]:
    convert_csv(file_path)
