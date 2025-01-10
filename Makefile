# Variables
PYTHON=python3
PIP=pip3
FLASK=flask
NPM=npm
VENV=.venv
CLIENT_DIR=client
SERVER_DIR=server

# Install dependencies, run backend and fr
.PHONY: backend
backend:
	$(PYTHON) -m venv $(VENV)
	. $(VENV)/bin/activate && $(PIP) install -r requirements.txt
	cd $(CLIENT_DIR) && $(NPM) install
	. $(VENV)/bin/activate && cd $(SERVER_DIR) && $(FLASK) run --debug -p 5001


.PHONY: frontend
frontend:
	cd $(CLIENT_DIR) && $(NPM) run dev

.PHONY: docker-backend
docker-backend:
	$(PYTHON) -m venv $(VENV)
	. $(VENV)/bin/activate && $(PIP) install -r requirements.txt
	cd $(CLIENT_DIR) && $(NPM) install
	docker build --build-arg ENVIRONMENT=development -t skribh-api .
	docker run -e FLASK_DEBUG=1 -p 5001:5000 skribh-api

.PHONY: ssh
ssh:	
	docker run -it skribh-api /bin/sh

.PHONY: lint
lint:
	pylint .

.PHONY: test
test:
	pytest --cov=server

