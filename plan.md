# Project: Cloud Network Cost Attribution — Research + Architecture + MVP Foundation

You are the lead engineer/researcher for a new developer infrastructure product.

## Product vision

We are building a **Sentry-like observability product for cloud network costs**.

Core problem:

> AWS/GCP/Azure billing tells a company how much it spent on network infrastructure, but it often does not clearly explain which application, service, container, workload, or eventually customer caused that network cost.

Our product should eventually answer:

> **“Why did my cloud network bill increase, and which part of my application caused it?”**

Initial focus:

**Kubernetes/AWS → network traffic → workload/service → estimated network cost**

Do NOT try to solve AWS + GCP + Azure + Vercel simultaneously in the MVP. The architecture should be provider-agnostic so those can be added later.

---

# IMPORTANT WORKING RULE

Do NOT immediately start coding.

Work in the following phases and complete them in order:

1. Research
2. Study Sentry
3. Competitive/technical analysis
4. System design
5. Test strategy
6. Basic Django foundation
7. Run all tests
8. Report what was actually proven vs what remains theoretical

Do not skip phases.

Do not invent technical facts.

If something is uncertain, explicitly mark it as uncertain and research it.

---

# PHASE 1 — RESEARCH

Before writing application code, research the current state of the technology.

Investigate:

### Existing products/projects

Research:

* Sentry architecture
* OpenCost
* Kubecost
* CAST AI network/egress monitoring
* CloudZero
* Finout
* Vantage network cost features
* AWS Cost Explorer
* AWS NAT Gateway billing
* AWS VPC Flow Logs
* AWS NAT Gateway metrics
* OpenTelemetry
* eBPF networking/observability
* Cilium/Hubble if relevant

Determine:

1. What already exists?
2. What exactly can each product attribute?
3. What is only approximate?
4. What uses eBPF?
5. What uses VPC Flow Logs?
6. How do they handle high-cardinality telemetry?
7. How do they aggregate network events?
8. What are the known limitations?
9. What is genuinely difficult about network-cost attribution?
10. What could differentiate our product?

Do NOT claim that our idea is completely new.

Create:

`docs/research.md`

Include sources/links and dates where appropriate.

---

# PHASE 2 — CLONE AND STUDY SENTRY

Clone the public Sentry repository locally.

Do NOT modify it.

Read enough of the repository to understand:

### Architecture

Study:

* event ingestion
* SDK/event model
* transport
* buffering
* batching
* rate limiting
* sampling
* queues
* asynchronous processing
* storage
* workers
* Django architecture
* API structure
* tests
* failure handling
* performance considerations
* observability of Sentry itself

Pay special attention to how Sentry prevents high-volume telemetry from destroying the backend.

Do not assume Kafka is automatically required.

Create:

`docs/sentry-study.md`

Document:

* relevant directories
* important components
* data flow
* what concepts are reusable
* what concepts are NOT reusable
* what we should learn from Sentry
* what would be a bad architectural copy

IMPORTANT:

We are taking architectural inspiration from Sentry.

We are NOT cloning Sentry's product or copying its implementation.

---

# PHASE 3 — TECHNICAL PROBLEM ANALYSIS

Create:

`docs/technical-risks.md`

Analyze solutions for:

1. Millions of network flows
2. High-cardinality metrics
3. Kafka/queue overload
4. CPU overhead
5. Memory overhead
6. Agent network overhead
7. Application latency
8. Agent failure
9. Backend failure
10. Network connectivity failure
11. Unknown/unattributable traffic
12. NAT attribution
13. Kubernetes pod/container → service mapping
14. HTTPS/encrypted traffic
15. Request-level attribution
16. Customer/tenant attribution
17. Double counting
18. AWS billing reconciliation
19. AWS pricing changes
20. Cross-AZ traffic
21. Privacy/security
22. Multi-cloud architecture
23. Serverless/Vercel limitations

For every problem provide:

* problem
* why it happens
* proposed solution
* alternative solutions
* trade-offs
* MVP approach
* future approach

---

# PHASE 4 — SYSTEM DESIGN

Now design the MVP.

Create:

`docs/system-design.md`

The initial architecture should look conceptually like:

Customer environment:

```
Application
    |
    | normal traffic
    v
   NAT
    |
 Internet
```

Separate observation path:

```
Workload
    |
    v
Collector Agent
    |
    v
Local aggregation
    |
    v
Batched telemetry
    |
    v
Django API
    |
    v
Attribution engine
    |
    v
Cost database
    |
    v
Dashboard
```

IMPORTANT:

The agent MUST NOT become a network proxy.

Customer traffic must never require:

Application → Our Agent → Internet

Instead:

Application → normal network path

and

Agent → telemetry backend

The application must continue working if our backend is unavailable.

---

# AGENT DESIGN

Design the collector around:

* low overhead
* local aggregation
* batching
* bounded memory
* rate limiting
* sampling where appropriate
* compression
* backpressure
* safe dropping of telemetry

Never send one backend event for every packet.

Example:

BAD:

```
1,000,000 network events
        ↓
1,000,000 API requests
```

GOOD:

```
1,000,000 events
        ↓
local aggregation
        ↓
100–1000 summaries
        ↓
compressed batches
```

Define a preliminary common telemetry schema that can eventually work across AWS/GCP/Azure.

For example:

```
provider
region
zone
node
pod
namespace
workload
source
destination
protocol
bytes
timestamp
```

Do NOT include packet payloads.

Do NOT capture credentials.

Do NOT capture HTTP bodies.

---

# ATTRIBUTION MODEL

The MVP should initially solve:

```
network traffic
    ↓
pod/container
    ↓
Kubernetes workload/service
    ↓
bytes
    ↓
estimated cost
```

Do NOT initially promise exact customer-level attribution.

For uncertain attribution, support:

```
attribution_confidence
```

Example:

```
image-worker
estimated_cost: $82.41
confidence: 0.97
```

Unknown traffic must remain:

```
UNKNOWN
```

Never fabricate attribution.

---

# COST MODEL

Separate:

1. observed network usage
2. estimated provider cost
3. actual cloud billing

Do not pretend the calculated number is the actual AWS bill.

Design reconciliation:

```
observed network usage
        ↓
pricing calculation
        ↓
estimated cost
```

and eventually:

```
AWS billing data
        ↓
reconciliation
        ↓
variance
```

---

# PHASE 5 — TEST-FIRST DEVELOPMENT

Before implementing the real system, create:

`docs/test-plan.md`

Tests must cover:

### Attribution

1. One service generates traffic → correct service identified.
2. Multiple services generate different traffic → correct attribution.
3. Service generates zero traffic → zero traffic reported.
4. Traffic to different destinations → destination preserved.
5. Unknown workload → UNKNOWN instead of fake attribution.

### Aggregation

6. 100,000 events must NOT become 100,000 backend events.
7. Same source/destination traffic should aggregate.
8. Batch size limits must work.
9. Memory limits must work.
10. Rate limits must work.

### Failure

11. Backend unavailable → application continues normally.
12. Backend unavailable → bounded local buffer.
13. Buffer full → telemetry is dropped safely.
14. Agent restart → recovery works.
15. Collector crash → application continues.

### Performance

16. Agent OFF vs ON CPU usage.
17. Agent OFF vs ON memory usage.
18. Agent OFF vs ON network overhead.
19. Agent OFF vs ON application latency.
20. High traffic load does not cause unacceptable overhead.

### Privacy

21. No payload capture.
22. No credentials stored.
23. Telemetry contains metadata only.

### Cost

24. Known bytes → expected estimated cost.
25. Region-specific pricing.
26. Different network-cost categories.
27. Reconciliation against known billing data where possible.

### API

28. Valid telemetry accepted.
29. Invalid telemetry rejected.
30. Duplicate batches handled safely.
31. Authentication works.
32. Rate limiting works.

Implement automated tests wherever practical.

---

# PHASE 6 — BASIC DJANGO FOUNDATION

Only after the research, architecture, and test plan are written:

Create a clean Django backend.

Use a sensible modern stack, but keep the MVP simple.

Suggested initial stack:

* Python
* Django
* Django REST Framework
* PostgreSQL
* pytest/pytest-django
* Docker Compose

Do NOT introduce Kafka yet unless the research proves it is necessary for the MVP.

Do NOT build a giant microservice architecture.

Start with:

```
Django API
PostgreSQL
worker/background processing only where justified
```

Create a basic project structure such as:

```
backend/
docs/
tests/
docker-compose.yml
README.md
```

Implement only the foundation needed for:

* organizations/projects
* agent registration
* telemetry ingestion
* aggregated network records
* workload metadata
* cost estimation
* health endpoints

Keep authentication simple for the prototype.

---

# PHASE 7 — TEST THE FOUNDATION

Run:

* unit tests
* API tests
* integration tests
* database tests

Then generate a test report:

`docs/test-report.md`

For every test state:

* PASS
* FAIL
* NOT IMPLEMENTED
* NOT TESTABLE YET

Do not claim something works if it has not been tested.

---

# PHASE 8 — FINAL ENGINEERING REPORT

Create:

`docs/MVP-status.md`

Include:

### Proven

What actually works.

### Not proven

What still needs real infrastructure testing.

### Biggest technical risks

Top 5.

### Next implementation step

What should be built next.

### Explicitly postponed

Examples:

* GCP
* Azure
* Vercel
* customer/tenant attribution
* production billing
* payment system
* advanced tracing
* Kafka at scale

---

# CRITICAL PRODUCT PRINCIPLES

1. We are NOT building another generic cloud-cost dashboard.

2. We are building network-cost attribution.

3. The initial question is:

   “Which workload caused this network cost?”

4. The agent must not sit in the traffic path.

5. Telemetry must be aggregated before transmission.

6. Customer application availability is more important than telemetry completeness.

7. Unknown attribution is better than incorrect attribution.

8. Never capture payloads unnecessarily.

9. Do not claim exact cost unless it is actually reconciled.

10. Optimize for correctness before UI polish.

11. Do not prematurely introduce Kafka/microservices.

12. Design provider interfaces so AWS is the first implementation, not the permanent architecture.

---

# FINAL DELIVERABLES

Before finishing this task, I expect:

```
docs/research.md
docs/sentry-study.md
docs/technical-risks.md
docs/system-design.md
docs/test-plan.md
docs/test-report.md
docs/MVP-status.md
```

and a runnable:

```
Django + PostgreSQL MVP foundation
```

with automated tests.

At the end, give me a concise summary containing:

1. What you researched
2. What you learned from Sentry
3. Existing competitors
4. Our proposed differentiation
5. Architecture
6. Tests created
7. Tests passing
8. What is still unproven
9. What should be built next

Do not skip research to start coding faster.

The goal is NOT to produce a lot of code.

The goal is to produce a **technically defensible foundation that we can safely build the network-cost attribution agent on top of.**
