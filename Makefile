.PHONY: setup run-backend run-frontend docker-up docker-down test test-backend test-frontend test-frontend-coverage

setup:
	@echo "Setting up backend..."
	cd backend && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
	@echo "Setting up frontend..."
	cd frontend && npm install

run-backend:
	cd backend && ./venv/bin/python main.py

run-frontend:
	cd frontend && npm run dev

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

test: test-backend test-frontend

test-backend:
	cd backend && ./.venv/bin/pytest --tb=short -q

test-frontend:
	cd frontend && npx vitest run

test-frontend-coverage:
	cd frontend && npx vitest run --coverage
