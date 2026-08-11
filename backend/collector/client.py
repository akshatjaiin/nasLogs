import requests

class OpenCostError(Exception):
    pass

class OpenCostClient:
    def __init__(self, base_url, timeout=30):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout

    def fetch_allocation(self, window='1h', aggregate='namespace,controllerName', step=''):
        url = f"{self.base_url}/allocation/compute"
        params = {
            'window': window,
            'aggregate': aggregate,
        }
        if step:
            params['step'] = step

        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise OpenCostError(f"Failed to fetch allocation: {str(e)}")

    def parse_allocation_response(self, raw_response):
        results = []
        data = raw_response.get('data', [])
        for window_data in data:
            for key, val in window_data.items():
                if key == '__unallocated__':
                    continue
                    
                parts = key.split('/')
                namespace = parts[0] if len(parts) > 0 else 'unknown'
                controller_name = parts[1] if len(parts) > 1 else 'unknown'
                
                results.append({
                    'namespace': namespace,
                    'controller_kind': 'deployment', 
                    'controller_name': controller_name,
                    'network_cost': val.get('networkCost', 0),
                    'egress_bytes': val.get('networkEgressBytes', 0),
                    'cross_zone_cost': val.get('networkCrossZoneCost', 0),
                    'cross_region_cost': val.get('networkCrossRegionCost', 0),
                    'internet_cost': val.get('networkInternetCost', 0),
                })
        return results
