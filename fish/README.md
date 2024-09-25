
All commands assume you are inside `fish/`.

# Local dev

```bash
python -m http.server
# Then go to http://localhost:8000/ (and not what python gives you http://[::]:8000/ otherwise webcam doesn't work)
```

# Tests

Install requirements (one off)
```bash
brew install node
npm install  # installs dependencies as specified in package*.json
```

Run tests:
```bash
pytest
```
Verbose mode:
```bash
pytest -v -s
```

Overwrite expected test outputs:
```bash
pytest --overwrite
```
