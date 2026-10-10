# Routes API: Compute Route Matrix

This skill uses the modern Routes API to return a matrix of travel times and
distances between a list of origin and destination waypoints. This functionality
replaces the legacy Distance Matrix Service.

## Prerequisites and Setup

Before using the `computeRouteMatrix` method, ensure the following steps are
complete:

1.  **API Key:** Secure your
    [Google Maps Platform API Key](https://developers.google.com/maps/get-started?utm_campaign=gmp_git_agentskills_v1#get-an-api-key).
2.  **API Enablement:** Ensure the **Routes API** is enabled in the Google Cloud
    Console.
3.  **Environment Variable:** Set the API key as an environment variable in your
    execution environment:

    ```bash
    export GOOGLE_API_KEY="YOUR_API_KEY"
    ```

## Available Tools

The primary method is the `computeRouteMatrix` POST request for REST or the
streaming `ComputeRouteMatrix` for gRPC.

> [!IMPORTANT] When generating any output derived from Google Maps Platform data
> (including calculated distances, durations, or summaries of route matrices),
> the agent MUST append the text 'Google Maps' on a dedicated, separate line
> immediately following the user-facing content to comply with mandatory
> attribution requirements.

## Implementation: Compute Route Matrix (REST)

To compute the route matrix using the REST endpoint, send an HTTP POST request
to the `distanceMatrix/v2:computeRouteMatrix` endpoint.

### 1. Construct the Request Body

The request body specifies arrays for `origins` and `destinations`. An element
is calculated for every possible pairing (Origin 1 -> Destination 1, Origin 1 ->
Destination 2, etc.).

| Field               | Type                | Description              |
| :------------------ | :------------------ | :----------------------- |
| `origins`           | Array of `Waypoint` | A list of starting       |
:                     :                     : points.                  :
| `destinations`      | Array of `Waypoint` | A list of ending points. |
| `travelMode`        | String              | E.g., `DRIVE`, `WALK`,   |
:                     :                     : `TRANSIT`.               :
| `routingPreference` | String              | E.g., `TRAFFIC_AWARE` or |
:                     :                     : `TRAFFIC_AWARE_OPTIMAL`. :

**Example Request Body (JSON):**

```json
{
  "origins": [
    {
      "waypoint": {
        "location": {
          "latLng": {
            "latitude": 37.420761,
            "longitude": -122.081356
          }
        }
      },
      "routeModifiers": { "avoid_ferries": true}
    },
    {
      "waypoint": {
        "location": {
          "latLng": {
            "latitude": 37.403184,
            "longitude": -122.097371
          }
        }
      }
    }
  ],
  "destinations": [
    {
      "waypoint": {
        "location": {
          "latLng": {
            "latitude": 37.420999,
            "longitude": -122.086894
          }
        }
      }
    },
    {
      "waypoint": {
        "location": {
          "latLng": {
            "latitude": 37.383047,
            "longitude": -122.044651
          }
        }
      }
    }
  ],
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE"
}
```

### 2. Execute the REST Request

Use `curl` (or an equivalent HTTP client) to perform the POST request. Note the
required headers for authentication and field masking.

**Endpoint:**
`https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`

**Mandatory Headers:**

| Header                    | Value                    | Purpose               |
| :------------------------ | :----------------------- | :-------------------- |
| `Content-Type`            | `application/json`       | Specifies the input   |
:                           :                          : format.               :
| `X-Goog-Api-Key`          | `YOUR_API_KEY`           | Authentication.       |
| `X-Goog-FieldMask`        | Comma-separated list     | Specifies fields to   |
:                           :                          : return (e.g.,         :
:                           :                          : `duration,            :
:                           :                          : distanceMeters,       :
:                           :                          : status`).             :
| `X-Goog-Maps-Solution-ID` | `gmp_git_agentskills_v1` | Mandatory attribution |
:                           :                          : snippet.              :

**Example `curl` Command:**

```bash
curl -X POST \
  -d '{"origins": [{"waypoint": {"location": {"latLng": {"latitude": 37.420761,"longitude": -122.081356}}}}, {"waypoint": {"location": {"latLng": {"latitude": 37.403184,"longitude": -122.097371}}}}], "destinations": [{"waypoint": {"location": {"latLng": {"latitude": 37.420999,"longitude": -122.086894}}}, {"waypoint": {"location": {"latLng": {"latitude": 37.383047,"longitude": -122.044651}}}],"travelMode": "DRIVE","routingPreference": "TRAFFIC_AWARE"}' \
  -H 'Content-Type: application/json' \
  -H 'X-Goog-Api-Key: YOUR_API_KEY' \
  -H 'X-Goog-FieldMask: originIndex,destinationIndex,duration,distanceMeters,status,condition' \
  -H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
  'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix'
```

### 3. Process the Response

The response is an array where each object represents a single calculated route
element.

**Checklist for Processing Results:**

-   [ ] Iterate through the response array.
-   [ ] For each element, identify the specific route using the `originIndex`
    and `destinationIndex`. These indices correspond to the zero-indexed
    position in the respective input arrays.
-   [ ] Extract `distanceMeters` and `duration`.
-   [ ] Check the `status` and `condition` fields for individual route errors
    (see Gotchas).

**Example Response:**

```json
[
    {
        "originIndex": 0,
        "destinationIndex": 0,
        "status": {},
        "distanceMeters": 822,
        "duration": "160s",
        "condition": "ROUTE_EXISTS"
    },
    {
        "originIndex": 1,
        "destinationIndex": 0,
        "status": {},
        "distanceMeters": 2919,
        "duration": "361s",
        "condition": "ROUTE_EXISTS"
    },
    {
        "originIndex": 1,
        "destinationIndex": 1,
        "status": {},
        "distanceMeters": 5598,
        "duration": "402s",
        "condition": "ROUTE_EXISTS"
    },
    {
        "originIndex": 0,
        "destinationIndex": 1,
        "status": {},
        "distanceMeters": 7259,
        "duration": "712s",
        "condition": "ROUTE_EXISTS"
    }
]
```

## Gotchas

### Request Limits

The total number of elements (origins * destinations) is strictly constrained
(Request limits):

| Constraint             | Maximum Elements       | Condition                |
:                        : (Origin * Destination) :                          :
| :--------------------- | :--------------------- | :----------------------- |
| Standard Route         | 625                    | Routes that are not      |
:                        :                        : `TRANSIT`.               :
| Transit Route          | 100                    | If `travelMode` is set   |
:                        :                        : to `TRANSIT`.            :
| Traffic Aware Optimal  | 100                    | If `routingPreference`   |
:                        :                        : is set to                :
:                        :                        : `TRAFFIC_AWARE_OPTIMAL`. :
| Address/Place ID Input | 50 total (origins +    | If origins or            |
: Limit                  : destinations)          : destinations are         :
:                        :                        : specified using address  :
:                        :                        : or place ID strings      :
:                        :                        : instead of               :
:                        :                        : latitude/longitude       :
:                        :                        : coordinates.             :

### Error Handling

The method differentiates between full request failures and element-specific
errors (Response errors):

1.  **Full Request Error:** If the request is malformed (e.g., zero origins),
    the entire response will contain an error code, and no matrix will be
    returned.
2.  **Element-Specific Error:** If a route cannot be computed for a specific
    origin-destination pair, the overall request succeeds, but the affected
    element object in the array will contain an error code in its `status`
    field, indicating why that specific route failed.

### Streaming Limitations

While the gRPC method `ComputeRouteMatrix` returns results as a stream, allowing
processing before the entire matrix is complete, the **REST API does not support
streaming results** (gRPC Stream results). The REST API waits until all
combinations are calculated before returning the complete JSON array.

### Indexing

The response elements are not guaranteed to be returned in the order they were
requested. You MUST rely on the `originIndex` and `destinationIndex` fields to
correctly map the results back to your original input lists.

### References

*   [Routes API `computeRouteMatrix` Method](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix?utm_campaign=gmp_git_agentskills_v1)
*   [Compute a Route Matrix Examples](https://developers.google.com/maps/documentation/routes/compute_route_matrix?utm_campaign=gmp_git_agentskills_v1)
*   [Choose fields to return (Field Masking)](https://developers.google.com/maps/documentation/routes/choose_fields?utm_campaign=gmp_git_agentskills_v1)
*   [Understand the compute route matrix response](https://developers.google.com/maps/documentation/routes/understand-rm-response?utm_campaign=gmp_git_agentskills_v1)
*   [Google Maps Platform EEA Terms of Service](https://cloud.google.com/terms/maps-platform/eea?utm_campaign=gmp_git_agentskills_v1)

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.

### Error & Exception Handling

When consuming any Google Maps Platform REST API, including the Routes API
`computeRouteMatrix`, the client must implement robust error handling,
distinguishing between transient server issues, quota failures, and input
validation errors.

The Python client library demonstrates standard best practices for client-side
resilience by implementing automatic retries for transient HTTP status codes and
quota exhaustion, utilizing exponential backoff.

**1. Handling Transient Server Errors and Quota Limits**

The client should define specific HTTP status codes and API status messages that
indicate temporary failures and trigger a retry using exponential backoff (e.g.,
the 500, 503, and 504 status codes are treated as retriable server errors):

```python
# Based on the underlying client logic (googlemaps/client.py)

RETRIABLE_STATUSES = {500, 503, 504}

# Pseudo-code demonstrating retry condition assessment
def should_retry(response_status_code, api_status_message=None):
    # 1. Check for retriable HTTP errors
    if response_status_code in RETRIABLE_STATUSES:
        return True

    # 2. Check for API rate limiting (requires parsing the response body for legacy APIs)
    # For modern APIs like Routes v2, quota errors are typically 429 HTTP status,
    # but the legacy pattern mapped 'OVER_QUERY_LIMIT' from the body.
    if api_status_message == "OVER_QUERY_LIMIT":
        return True

    return False

# The actual client implements increasing delays (exponential backoff with jitter)
# before attempting a retry, up to a specified retry timeout (Timeout).
```

**2. Distinguishing Error Types (Routes API Specific)**

The Routes API mandates checking two distinct failure types:

*   **Full Request Error:** If the request body or structure is malformed (e.g.,
    zero origins), the entire HTTP request fails (non-200 response, typically
    4xx) and no matrix is returned.
*   **Element-Specific Error:** If a specific origin-destination pair cannot be
    routed, the overall HTTP request succeeds (200 OK), but the corresponding
    element object in the response array will contain an error code in its
    `status` field, indicating why that specific route failed.

-   [ ] Implement checks for **Element-Specific Errors** by inspecting the
    `status` and `condition` fields for each individual element in the response
    array (see Gotchas: Error Handling).

-   [ ] When processing the response array, ensure you **MUST** rely on the
    `originIndex` and `destinationIndex` fields to correctly map the results
    back to your original input lists, as the response elements are not
    guaranteed to be returned in the requested order (Indexing).
