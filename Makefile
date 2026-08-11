.PHONY: help dev server seed test clean docker-prod

help:
	@echo "🔥 Smoke Detector — Available Commands"
	@echo "----------------------------------------"
	@echo "  make dev         Run backend & frontend dev servers concurrently"
	@echo "  make server      Start frontend SPA dev server (port 3000)"
	@echo "  make seed        Seed database with 7 days (168h) of cost data"
	@echo "  make test        Run complete backend test suite (pytest)"
	@echo "  make docker-prod Launch full production stack (Postgres + Celery + Web)"

dev:
	@echo "Starting Django API and SPA Frontend..."
	python backend/manage.py runserver 8000 & python frontend/server.py 3000

server:
	python frontend/server.py 3000

seed:
	cd backend && python manage.py seed_demo

test:
	cd backend && pytest -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf backend/test_db.sqlite3
