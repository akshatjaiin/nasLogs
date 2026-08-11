import random
from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Organization, Project
from collector.models import CostSnapshot, WorkloadCost
from detector.models import AnomalyThreshold, Anomaly
from correlator.models import K8sEvent, Correlation
from incidents.models import Incident


class Command(BaseCommand):
    help = 'Seed the database with realistic demo data'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data...')
        Incident.objects.all().delete()
        Correlation.objects.all().delete()
        K8sEvent.objects.all().delete()
        Anomaly.objects.all().delete()
        AnomalyThreshold.objects.all().delete()
        WorkloadCost.objects.all().delete()
        CostSnapshot.objects.all().delete()
        Project.objects.all().delete()
        Organization.objects.all().delete()

        self.stdout.write('Creating Organization and Project...')
        org = Organization.objects.create(name='Acme Corp', slug='acme-corp')
        project = Project.objects.create(
            organization=org,
            name='Production Cluster',
            opencost_url='http://opencost:9003',
        )

        now = timezone.now()

        workloads = [
            {'ns': 'ecommerce', 'ctrl': 'cart-service', 'kind': 'deployment', 'baseline': 1.20, 'spike': 8.40, 'spike_h': 2, 'resolved': False},
            {'ns': 'media', 'ctrl': 'image-worker', 'kind': 'deployment', 'baseline': 80.0, 'spike': 248.0, 'spike_h': 4, 'resolved': False},
            {'ns': 'payments', 'ctrl': 'payment-api', 'kind': 'deployment', 'baseline': 0.50, 'spike': 4.00, 'spike_h': 1, 'resolved': False},
            {'ns': 'monitoring', 'ctrl': 'prometheus', 'kind': 'statefulset', 'baseline': 5.20, 'spike': 18.70, 'spike_h': 6, 'resolved': False},
            {'ns': 'batch', 'ctrl': 'data-pipeline', 'kind': 'deployment', 'baseline': 0.0, 'spike': 12.50, 'spike_h': 12, 'resolved': True},
            {'ns': 'logging', 'ctrl': 'fluentd', 'kind': 'daemonset', 'baseline': 15.0, 'spike': 89.0, 'spike_h': 24, 'resolved': True},
        ]

        self.stdout.write('Creating 168 hours of cost snapshots...')
        cost_histories = {wl['ctrl']: [] for wl in workloads}

        for hour in range(168, -1, -1):
            ts = now - timedelta(hours=hour)
            window_start = ts - timedelta(hours=1)
            window_end = ts

            snapshot = CostSnapshot.objects.create(
                project=project,
                timestamp=ts,
                window_start=window_start,
                window_end=window_end,
                raw_response={},
            )

            for wl in workloads:
                # Determine if spiking at this hour
                hours_ago = hour
                is_spiking = False
                if wl['resolved']:
                    # Spike happened spike_h ago, lasted ~4 hours, then resolved
                    is_spiking = wl['spike_h'] >= hours_ago > (wl['spike_h'] - 4)
                else:
                    # Still spiking from spike_h ago until now
                    is_spiking = hours_ago < wl['spike_h']

                if is_spiking:
                    cost = wl['spike'] * random.uniform(0.92, 1.08)
                elif wl['baseline'] == 0:
                    cost = 0.0
                else:
                    cost = wl['baseline'] * random.uniform(0.90, 1.10)

                WorkloadCost.objects.create(
                    snapshot=snapshot,
                    namespace=wl['ns'],
                    controller_kind=wl['kind'],
                    controller_name=wl['ctrl'],
                    network_cost_total=Decimal(str(round(cost, 6))),
                    network_egress_bytes=int(cost * 1073741824),
                    network_cross_zone_cost=Decimal(str(round(cost * 0.3, 6))),
                    network_cross_region_cost=Decimal(str(round(cost * 0.1, 6))),
                    network_internet_cost=Decimal(str(round(cost * 0.05, 6))),
                )
                cost_histories[wl['ctrl']].append(round(cost, 2))

        self.stdout.write(f'  Created {CostSnapshot.objects.count()} snapshots, {WorkloadCost.objects.count()} workload costs')

        self.stdout.write('Creating anomaly thresholds...')
        threshold = AnomalyThreshold.objects.create(
            project=project,
            metric='network_cost_total',
            method='pct_change',
            warning_value=2.0,
            critical_value=5.0,
            baseline_window_hours=168,
            min_cost_threshold=Decimal('0.01'),
        )

        self.stdout.write('Creating anomalies...')
        anomalies = {}
        for wl in workloads:
            baseline = wl['baseline']
            spike = wl['spike']
            if baseline > 0:
                deviation = (spike - baseline) / baseline
            else:
                deviation = 999.0
            severity = 'critical' if deviation >= 5.0 else 'warning'

            # Find the spike snapshot's workload cost
            spike_time = now - timedelta(hours=wl['spike_h'])
            spike_snapshot = CostSnapshot.objects.filter(
                project=project, timestamp__lte=spike_time
            ).order_by('-timestamp').first()

            spike_wc = WorkloadCost.objects.filter(
                snapshot=spike_snapshot,
                namespace=wl['ns'],
                controller_name=wl['ctrl'],
            ).first()

            anomaly = Anomaly.objects.create(
                project=project,
                workload_cost=spike_wc,
                threshold=threshold,
                metric='network_cost_total',
                baseline_value=Decimal(str(baseline)),
                spike_value=Decimal(str(spike)),
                deviation_score=round(deviation, 2),
                severity=severity,
                namespace=wl['ns'],
                controller_name=wl['ctrl'],
            )
            anomalies[wl['ctrl']] = anomaly

        self.stdout.write(f'  Created {len(anomalies)} anomalies')

        self.stdout.write('Creating K8s events...')
        events_config = {
            'cart-service': [
                {'kind': 'deployment', 'action': 'update', 'name': 'cart-service', 'delta_min': -5,
                 'details': {'image': 'cart:v2.0→cart:v2.1'}},
                {'kind': 'configmap', 'action': 'update', 'name': 'cart-config', 'delta_min': -20,
                 'details': {'key': 'REDIS_POOL_SIZE'}},
                {'kind': 'hpa', 'action': 'scale', 'name': 'cart-hpa', 'delta_min': 5,
                 'details': {'replicas': '3→8'}},
            ],
            'image-worker': [
                {'kind': 'deployment', 'action': 'update', 'name': 'image-worker', 'delta_min': -10,
                 'details': {'image': 'img-proc:v3.3→v3.4'}},
            ],
            'prometheus': [
                {'kind': 'statefulset', 'action': 'update', 'name': 'prometheus', 'delta_min': -15,
                 'details': {'retention': '15d→30d'}},
            ],
            'data-pipeline': [
                {'kind': 'configmap', 'action': 'update', 'name': 'pipeline-config', 'delta_min': -2,
                 'details': {'key': 'OUTPUT_ENDPOINT', 'change': 'internal→external S3'}},
            ],
            'fluentd': [
                {'kind': 'deployment', 'action': 'update', 'name': 'log-aggregator', 'delta_min': -8,
                 'details': {'image': 'log-agg:v1.2→v1.3'}},
            ],
        }

        k8s_events = {}
        for ctrl_name, events in events_config.items():
            anomaly = anomalies[ctrl_name]
            spike_time = anomaly.workload_cost.snapshot.timestamp
            k8s_events[ctrl_name] = []

            for ev_cfg in events:
                event = K8sEvent.objects.create(
                    project=project,
                    timestamp=spike_time + timedelta(minutes=ev_cfg['delta_min']),
                    kind=ev_cfg['kind'],
                    namespace=anomaly.namespace,
                    name=ev_cfg['name'],
                    action=ev_cfg['action'],
                    details=ev_cfg['details'],
                )
                k8s_events[ctrl_name].append((event, ev_cfg['delta_min']))

        self.stdout.write(f'  Created {K8sEvent.objects.count()} K8s events')

        self.stdout.write('Creating correlations...')
        for ctrl_name, event_list in k8s_events.items():
            anomaly = anomalies[ctrl_name]
            for event, delta_min in event_list:
                time_delta_sec = delta_min * 60
                # Score using correlation engine weights
                time_score = 1.0 - (abs(time_delta_sec) / 1800)
                ns_score = 1.0  # same namespace
                kind = event.kind
                event_type_scores = {'deployment': 1.0, 'replicaset': 0.8, 'statefulset': 0.9, 'configmap': 0.6, 'hpa': 0.7}
                event_type_score = event_type_scores.get(kind, 0.5)
                confidence = time_score * 0.5 + ns_score * 0.3 + event_type_score * 0.2
                confidence = max(0.0, min(1.0, round(confidence, 2)))

                is_before = delta_min < 0
                explanation = (
                    f"{kind.title()} '{event.name}' {event.action}d "
                    f"{abs(delta_min)} minutes {'before' if is_before else 'after'} the cost spike"
                )
                if event.details:
                    detail_str = ', '.join(f'{k}={v}' for k, v in event.details.items())
                    explanation += f" ({detail_str})"

                Correlation.objects.create(
                    anomaly=anomaly,
                    k8s_event=event,
                    time_delta_seconds=time_delta_sec,
                    confidence_score=confidence,
                    explanation=explanation,
                )

        self.stdout.write(f'  Created {Correlation.objects.count()} correlations')

        self.stdout.write('Creating incidents...')
        incident_config = {
            'cart-service': {'status': 'open', 'severity': 'critical'},
            'image-worker': {'status': 'open', 'severity': 'warning'},
            'payment-api': {'status': 'open', 'severity': 'critical'},
            'prometheus': {'status': 'acknowledged', 'severity': 'warning'},
            'data-pipeline': {'status': 'resolved', 'severity': 'warning'},
            'fluentd': {'status': 'resolved', 'severity': 'critical'},
        }

        for ctrl_name, cfg in incident_config.items():
            anomaly = anomalies[ctrl_name]
            wl = next(w for w in workloads if w['ctrl'] == ctrl_name)
            fingerprint = f"{project.id}:{wl['ns']}:{ctrl_name}:network_cost_total"

            # Build evidence with full correlation data
            corr_data = []
            for corr in anomaly.correlations.select_related('k8s_event').all():
                corr_data.append({
                    'event_kind': corr.k8s_event.kind,
                    'event_name': corr.k8s_event.name,
                    'event_action': corr.k8s_event.action,
                    'confidence': corr.confidence_score,
                    'time_delta_seconds': corr.time_delta_seconds,
                    'explanation': corr.explanation,
                    'details': corr.k8s_event.details,
                })

            evidence = {
                'anomaly': {
                    'metric': 'network_cost_total',
                    'baseline': float(anomaly.baseline_value),
                    'spike': float(anomaly.spike_value),
                    'deviation_pct': anomaly.deviation_score * 100 if anomaly.deviation_score < 100 else anomaly.deviation_score,
                    'method': 'pct_change',
                },
                'workload': {
                    'namespace': wl['ns'],
                    'controller_kind': wl['kind'],
                    'controller': ctrl_name,
                },
                'correlations': corr_data,
                'cost_history': cost_histories[ctrl_name][-24:],
            }

            Incident.objects.create(
                project=project,
                anomaly=anomaly,
                fingerprint=fingerprint,
                title=f"Cost Spike: {wl['ns']}/{ctrl_name}",
                summary=f"Network cost spiked from ${wl['baseline']:.2f}/hr to ${wl['spike']:.2f}/hr",
                severity=cfg['severity'],
                status=cfg['status'],
                evidence=evidence,
            )

        self.stdout.write(self.style.SUCCESS(
            f'\nSeeded successfully!\n'
            f'   {CostSnapshot.objects.count()} snapshots\n'
            f'   {WorkloadCost.objects.count()} workload costs\n'
            f'   {Anomaly.objects.count()} anomalies\n'
            f'   {K8sEvent.objects.count()} K8s events\n'
            f'   {Correlation.objects.count()} correlations\n'
            f'   {Incident.objects.count()} incidents'
        ))
