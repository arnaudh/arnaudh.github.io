import os
import glob
import pytest
from convert_csv import convert_csv

# Dynamically list all input files in the fixtures directory
input_files = glob.glob('fixtures/input_*.csv')

@pytest.mark.parametrize("input_file", input_files)
def test_convert_csv(input_file, request):
    # Determine the expected output file based on input file name
    expected_output_file = input_file.replace('input_', 'expected_output_')

    # Run the convert_csv function
    output_file = convert_csv(input_file)

    # Check if we are in overwrite mode
    overwrite = request.config.getoption("--overwrite")

    if overwrite:
        # Overwrite the expected output with the generated output
        os.replace(output_file, expected_output_file)
        print(f"Overwritten expected output: {expected_output_file}")
    else:
        # Compare the generated output with the expected output
        with open(output_file, 'r') as output, open(expected_output_file, 'r') as expected:
            assert output.read() == expected.read(), f"Mismatch for {input_file}"
            os.remove(output_file)
