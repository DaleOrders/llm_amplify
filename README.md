# skribh-demo-web-app
The locally-run web app used for product demonstration.

## How to Run Locally

### Install python dependencies
- `python -m venv .venv && source .venv/bin/activate`
- Confirm that the environment has been activated
    - Run `which python`.
        - If this outputs something like 'aliased to Python3.11', run `which Python3.11`. You should see output with ending similar to '...skribh-demo-web-app/.venv/bin/python3.11'
- `pip install -r requirements.txt`
- Confirm that VSCode has figured out that it should use the python interpreter from the venv
    - cmd+shift+p (or Windows equivalent) to show command palate
    - Select 'Python: Select Interpreter'
    - Make sure the interpreter in the venv just created is the selected option (VSCode sometimes does not detect the activated venv)
        - Select something like 'Python3 3.11.10 ('.venv': venv) ./.venv/bin/python'

### Install React dependencies
- `cd client && npm i`

### Run the Flask server (backend)
- `cd server && flask run`

### Run the Vite server (React frontend)
- `cd client && npm run dev`
- Click the link outputted from this command to view the web app in a browser

### Troubleshooting
The Vite dev server proxies requests to 'api/' to the same port as the Flask server at route '/'. By default, the Flask server runs on port 5000, which may have conflicts on some systems.

For example, to run everything on port 8000:
- Run `flask run -p 8000` from /server
- Modify the port number in client/vite.config.js
    ```js
    proxy: {
        '/api': {
            // change port to 8000 here 👇🏽
            target: 'http://127.0.0.1:8000',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''), 
        },
    },
    ```