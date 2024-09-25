# tests/conftest.py
def pytest_addoption(parser):
    parser.addoption(
        "--overwrite", action="store_true", default=False, help="Overwrite expected output files"
    )

def pytest_configure(config):
    config.addinivalue_line(
        "markers", "overwrite: mark test to overwrite expected outputs"
    )