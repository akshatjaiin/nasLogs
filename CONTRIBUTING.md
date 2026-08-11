# Contributing to Smoke Detector

Thank you for your interest in contributing to **Smoke Detector**!

We welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## 🛠️ Development Setup

1. **Fork and Clone the Repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/smokedetector.git
   cd smokedetector
   ```

2. **Set Up Python Environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Run Database Migrations & Seed Data**:
   ```bash
   python manage.py migrate
   python manage.py seed_demo
   ```

4. **Run Tests**:
   ```bash
   pytest
   ```

---

## 📐 Architecture Overview

- `backend/collector/`: Telemetry snapshot & workload cost parsing.
- `backend/detector/`: Percentage Change & Z-Score anomaly algorithms.
- `backend/correlator/`: Temporal & resource weighted correlation engine.
- `backend/incidents/`: Fingerprinted incident container & evidence JSON format.
- `frontend/`: Pure HTML5 + Vanilla JS + Chart.js SPA dashboard.

---

## 📝 Pull Request Process

1. Create a topic branch (`git checkout -b feature/my-feature`).
2. Write unit tests for new features (`pytest`).
3. Ensure all tests pass before submitting PR.
4. Keep commit messages clear and concise.
