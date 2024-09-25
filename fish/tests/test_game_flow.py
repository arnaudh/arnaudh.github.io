import subprocess
import os
import time
import socket
import pytest
from pathlib import Path

PORT = 8000

TESTS_DIR = Path(__file__).parent
FISH_DIR = TESTS_DIR.parent
VIDEO_FILE = TESTS_DIR / "fixtures" / "video.y4m"

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("localhost", port))
        except OSError:
            return True
        return False


def test_game_flow():
    """
    End-to-end test to run the game using Puppeteer, download the CSV, and convert it.
    """
    if is_port_in_use(PORT):
        print(f"Server already running")
        server = None
    else:
        print(f"Starting server")
        server = subprocess.Popen(['python', '-m', 'http.server', '--directory', FISH_DIR, str(PORT)])
        time.sleep(0.5)  # Give the server time to start

    try:
        subject_id = "testyyy"
        session_number = 123456
        game_url = f'http://localhost:{PORT}/?subject_id={subject_id}&session_number={session_number}&number_of_trials=1&trial_duration=3000&log_detected=true&show_video=true'

        # Expected output files
        expected_downloaded_csv_file = Path.home() / "Downloads" / f"FISHER_results_{subject_id}_{session_number}.csv"
        expected_simplified_csv_file = expected_downloaded_csv_file.with_stem(f"{expected_downloaded_csv_file.stem}_simplified")
        # Delete output files if they already exist
        expected_downloaded_csv_file.unlink(missing_ok=True)
        expected_simplified_csv_file.unlink(missing_ok=True)

        print(f"Running the game")
        subprocess.run(['node', TESTS_DIR / "test_game_flow.js", game_url, expected_downloaded_csv_file, VIDEO_FILE], check=True)

        assert os.path.exists(expected_downloaded_csv_file), f"File not found: {expected_downloaded_csv_file}"

        print(f"Running convert_csv.py")
        subprocess.run(['python', FISH_DIR / "scripts" / "convert_csv.py", expected_downloaded_csv_file], check=True)

        assert os.path.exists(expected_simplified_csv_file), f"File not found: {expected_simplified_csv_file}"

        # TODO assertions on expected_downloaded_csv_file and expected_simplified_csv_file

    finally:
        if server:
            print(f"Stopping server")
            server.terminate()
