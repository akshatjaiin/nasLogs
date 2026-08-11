# Sentry Repository Study: Architecture & Testing Patterns

## Overview
This document summarizes findings from studying the `getsentry/sentry` repository, with a focus on extracting architectural patterns and test structures applicable to a "Network Cost Smoke Detector" for Kubernetes.

## 1. Test Patterns (MOST IMPORTANT)

### Test Structure & Organization
Sentry's tests are heavily categorized by domain (`tests/sentry/incidents`, `tests/sentry/grouping`, `tests/sentry/event_manager`, `tests/sentry/rules`, `tests/sentry/ratelimits`).
- **Base Test Classes**: They make extensive use of base classes like `SnubaTestCase`, `PerformanceIssueTestCase`, and `ConditionTestCase` to set up complex test states (e.g., configuring environments, datasets, and subscriptions) before the test runs.
- **Snapshot Testing**: For features with complex combinatorial outputs (like grouping and fingerprinting), Sentry uses `InstaSnapshotter` to compare parsed rules and hashes against expected snapshots instead of asserting individual fields manually.
- **Time Freezing**: Almost all time-series and anomaly-detection tests use `@freeze_time()` to make evaluation deterministic.

### Specific Test Patterns
- **Anomaly Detection (`tests/sentry/incidents/handlers/condition/test_anomaly_detection_handler.py`)**:
  - Tests verify condition triggers by mocking the external ML service ("Seer"). The mock returns explicit prediction responses (`high_confidence_seer_response`, `low_confidence_seer_response`).
  - Tests assert that the correct thresholds (sensitivity, seasonality) and context windows are passed to the external service.
  - Assertions check if `evaluation.result` correctly matches `DetectorPriorityLevel.HIGH` or `OK` based on the mocked model confidence.
- **Alerting & Metric Issues (`tests/sentry/incidents/test_metric_issue_detector_handler.py`)**:
  - Simulates data packets from Snuba query subscriptions.
  - Verifies that evaluating these packets correctly generates `IssueOccurrence` instances with the right `evidence_data` (data sources, conditions, triggers).
  - Tests different threshold layers (e.g., `warning_level` vs `critical_level`).
- **Event Grouping (`tests/sentry/grouping/test_fingerprinting.py`)**:
  - Tests the string parsing of `FingerprintingConfig` rules (e.g., `type:"DatabaseUnavailable" -> "DatabaseUnavailable"`).
  - Uses data-driven snapshot tests for various payload structures to ensure identical events hash to the same group.
- **Event Ingestion (`tests/sentry/event_manager/test_event_manager.py`)**:
  - Tests `EventManager.save()` by passing raw dictionaries (simulated incoming events) and asserting that appropriate pipeline side-effects occur (saving to Nodestore, inserting into eventstream/Kafka).

### Patterns We Should Adopt for Regression Tests
1. **Mock the ML/Math Boundary**: Like Sentry mocking Seer, we should unit test our anomaly handlers by injecting deterministic predictions.
2. **Snapshot for Rule Sets**: If we implement custom grouping rules for network costs (e.g., grouping by source/destination), we should use snapshot testing for rule parsing and hash generation.
3. **Evidence Data Assertions**: Ensure tests verify not just that an alert fired, but that the *evidence attached* to the alert is perfectly formatted for UI consumption.
4. **Base Fixtures**: Build base test classes that pre-configure kubernetes cluster mock data, snuba-equivalent datasets, and rate limiters.

---

## 2. Architecture Concepts

### Event Ingestion Pipeline
Events enter as JSON payloads. Sentry parses, normalizes, and passes them to `EventManager`. Raw large data is saved to a blob store (Nodestore), while searchable/aggregatable metadata is streamed to Kafka (Eventstream) to be consumed by Snuba (ClickHouse).

### Anomaly Detection & Alerts
- **Data Subscriptions**: Sentry uses query subscriptions against its time-series database (Snuba) to periodically pull metric windows.
- **Evaluation**: A `DataPacket` of the time-series is passed to a handler (`MetricIssueDetectorHandler` or `AnomalyDetectionHandler`).
- **External Evaluation**: For complex anomalies, the window and user-defined thresholds (sensitivity, seasonality) are posted to a specialized microservice (Seer). 
- **Evidence**: When a threshold is crossed, an `IssueOccurrence` is created. It attaches an `evidence_data` payload detailing exactly which query, threshold, and packet triggered the anomaly.

### Grouping and Fingerprinting
- Events are hashed based on specific metadata (e.g., stack trace lines).
- Sentry supports **Custom Fingerprinting Rules** allowing users to define matchers (`logger:sentry.*`) that override default hashing behavior, grouping diverse events into a single "Issue".

### Rate Limiting & High-Volume Telemetry
- **Sliding Windows**: `RedisSlidingWindowRateLimiter` enforces granular usage quotas per tenant/project.
- **Kafka Buffering**: Inbound telemetry is queued via Arroyo (Kafka streaming library), decoupling ingestion speed from processing speed.

---

## 3. What We Should Adopt (Transferable Concepts)

For a **Network Cost Smoke Detector**:
1. **Query Subscriptions & Handlers**: We should build an architecture where we query Kubernetes network metrics periodically over a sliding window. Handlers evaluate these windows against anomaly thresholds.
2. **Evidence Payloads**: When a network anomaly is detected (e.g., sudden egress spike from a specific pod), the alert must attach `evidence_data` (the specific flow logs, the baseline it deviated from, and the cost estimation) so the UI can explain *why* it alerted.
3. **Custom Fingerprinting**: Users will want to group network costs differently. We should adopt rule-based fingerprinting (e.g., `namespace:kube-system AND dst:internet -> "System Egress"`) to aggregate distinct pod spikes into one overarching "Issue".
4. **Decoupled Metric vs Blob Storage**: Store raw flow logs in cheap blob storage (like Sentry's Nodestore), and only keep aggregated cost metrics in time-series DB for the ML models to evaluate.

---

## 4. What We Should NOT Copy

- **Complex Stacktrace Parsing**: Sentry spends a massive amount of code extracting, minifying, and normalizing stack traces across 50+ languages. Network cost monitoring doesn't need this; we only care about IP, port, protocol, pod, and bytes.
- **Deep SDK Integrations**: Sentry relies on language-specific SDKs. We should rely on standard Kubernetes CNI/eBPF telemetry (like Cilium Hubble or VPC Flow Logs) rather than building our own app-level agents.
- **Massive Legacy Grouping Versions**: Sentry has to support backwards compatibility for grouping algorithms stretching back years. We should start with a clean, single grouping strategy for network flows.
