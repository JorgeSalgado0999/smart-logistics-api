# 🚀 Project: Smart Logistics Routing API

## 📝 Overview

This project is a RESTful API designed to solve a core computer science and logistics problem: **finding the most efficient path** between locations on a predefined network (a **Graph**). The goal is to build a robust, production-ready backend service that accepts route constraints and returns optimal routing solutions.

This project was specifically designed to target **TypeScript** and modern backend frameworks (e.g., NestJS, Fastify, Hono).

## ✨ Key Technical Objectives

Successful completion of this project requires demonstrating proficiency in the following backend domains:

1.  **RESTful API Design:** Implement the requested endpoints.
2.  **Algorithm Implementation:** Implementing a complex graph traversal algorithm.
3.  **Type Safety & Structure:** Utilizing TypeScript to enforce strict contracts across the entire application.
4.  **API Documentation:** Generating industry-standard documentation (OpenAPI/Swagger) directly from the codebase.

## ⚙️ Technology Stack

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Language** | **TypeScript** | Required for type safety and advanced structure. |
| **Database** | **In Memory** or **PostgreSQL** or **MongoDB** | To persist the network data (Nodes, Edges, Weights). If in memory just store the last 5 networks |
| **Testing** | **Jest** | Required for comprehensive unit testing of the core algorithm logic. |
| **Documentation** | Auto-generation of OpenAPI Specification from code. |

## 📐 Project Endpoints

The API will expose two main sets of functionality: **Network Management** (CRUD for the Graph) and **Route Calculation** (the core algorithm).

### 1. Network Management Endpoints

| HTTP Method | Endpoint | Description | Body Example |
| :--- | :--- | :--- | :--- |
| **POST** | `/network/upload` | Uploads a new graph definition (Nodes and Edges) and return the ID of the graph. | `{"edges":[{"from":"A","to":"B","cost":10,"maxWeight":5000,"noHazardous":true,"trafficMultiplier":1.5},{"from":"A","to":"C","cost":5}]}` |
| **GET** | `/network/nodes/{id}` | Retrieves all defined nodes/locations from. | *None* |

### 2. Route Optimization Endpoints

| HTTP Method | Endpoint | Description | Core Requirement | Body Example | Suggested Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/route/optimize/{id}` | Submits an asynchronous job to calculate the optimal path, potentially through multiple waypoints. | **Must be asynchronous.** | `{"originNodeId": "A", "destinationNodeId": "E", "waypoints": ["C"], "vehicleProfile": {"type": "truck", "weight": 4000, "hazardous": false}, "departureTime": "08:00"}` | `{"jobId":"job-987"}` (Status 202 Accepted) |
| **GET** | `/route/status/{jobId}` | Polls for the result of the asynchronous route calculation job. | **Must implement the algorithm.** | *None* | `{"status":"COMPLETED", "result":{"graphId":"uuid-123","totalCost":25.5,"path":["A","C","D","E"],"durationMs":4}}` |
| **GET** | `/docs` | Serves the generated **Swagger UI**. | **Must be auto-generated.** | *None* | *None* |

## 🧠 The Core Algorithm Challenge

The primary challenge lies in implementing the logic for the `/route/optimize` endpoint.

### Algorithm Requirement
The backend service must implement **Dijkstra's Algorithm** or **A\* Search** to find the shortest path between the `originNodeId` and the `destinationNodeId`.
If `waypoints` are provided, the algorithm must calculate the optimal path visiting each waypoint in the specified order (Multi-Stop Routing).

### Asynchronous Processing
Route optimization calculations can be resource-intensive. The `/route/optimize` endpoint must not block. It should return a `jobId` immediately (HTTP 202 Accepted), and the client will poll the `/route/status/{jobId}` endpoint to retrieve the calculated route once it is `COMPLETED`.



### Image of Dijkstra Algorithm Graph
![alt text](docs/resources/dijkstras-image.jpeg)


### Complex Scenarios
The algorithm must be able to handle request bodies that include dynamic constraints and advanced routing logic:

1.  **Vehicle Profiles & Constraints:** The request specifies a `vehicleProfile` (e.g., `weight: 4000`, `hazardous: true`). The graph edges define restrictions (e.g., `maxWeight: 5000`, `noHazardous: true`). Edges that cannot be traversed by the vehicle must be dynamically filtered out of the pathfinding calculation.
2.  **Time-Dependent Edge Weights:** Instead of static costs, edge costs should be influenced by the `departureTime`. For example, applying a `trafficMultiplier` defined on the edge during "peak hours" (e.g., applying a 1.5x penalty if departing between 07:00-09:00 or 17:00-19:00). The algorithm must account for this dynamically.
3.  **Multi-Stop Routing (TSP Variant):** If the request includes `waypoints`, the route must sequentially visit the `originNodeId`, all `waypoints` in the specified array order, and finally the `destinationNodeId`.
4.  **Error Handling:** Gracefully handle cases where the destination is unreachable, the input nodes are invalid, or constraints make the route impossible (return an appropriate error status in the job result).

## 🧪 Validation Example

To help candidates validate their implementation, here is a small test graph and expected outcomes.

**Upload Graph Payload:**
```json
{
  "edges": [
    { "from": "A", "to": "B", "cost": 10, "maxWeight": 10000, "noHazardous": false, "trafficMultiplier": 1.0 },
    { "from": "A", "to": "C", "cost": 15, "maxWeight": 5000, "noHazardous": true, "trafficMultiplier": 1.5 },
    { "from": "B", "to": "D", "cost": 12, "maxWeight": 10000, "noHazardous": false, "trafficMultiplier": 2.0 },
    { "from": "C", "to": "D", "cost": 5, "maxWeight": 5000, "noHazardous": true, "trafficMultiplier": 1.0 },
    { "from": "D", "to": "E", "cost": 10, "maxWeight": 8000, "noHazardous": false, "trafficMultiplier": 1.2 }
  ]
}
```

**Test Case 1 (Standard Path):**
- **Request:** `{"originNodeId": "A", "destinationNodeId": "E", "vehicleProfile": {"type": "van", "weight": 3000, "hazardous": false}, "departureTime": "12:00"}`
- **Expected Route:** A -> C -> D -> E
- **Explanation:** Vehicle is light and non-hazardous. The cost is `A->C` (15) + `C->D` (5) + `D->E` (10) = 30. (The path via B would cost 10 + 12 + 10 = 32).

**Test Case 2 (Weight Constraint):**
- **Request:** `{"originNodeId": "A", "destinationNodeId": "E", "vehicleProfile": {"type": "truck", "weight": 6000, "hazardous": false}, "departureTime": "12:00"}`
- **Expected Route:** A -> B -> D -> E
- **Explanation:** The truck exceeds the `5000` max weight limit on edges `A->C` and `C->D`, forcing it to take the path through B.

**Test Case 3 (Hazardous Constraint):**
- **Request:** `{"originNodeId": "A", "destinationNodeId": "E", "vehicleProfile": {"type": "truck", "weight": 3000, "hazardous": true}, "departureTime": "12:00"}`
- **Expected Route:** A -> B -> D -> E
- **Explanation:** The vehicle carries hazardous materials, so it cannot use `A->C` or `C->D` (`noHazardous: true`).

---

## ✅ Submission Checklist & Workflow

A successful submission should include:

* [ ] Complete source code for the REST API.
* [ ] A working implementation of **Dijkstra's Algorithm** within a service layer.
* [ ] Clear **TypeScript Interfaces** for `Node`, `Edge`, and the various Request DTOs.
* [ ] Unit tests using **Jest** for the core routing algorithm (i.e., testing the function that calculates the path directly).
* [ ] Proof that the Swagger documentation is accessible and accurately reflects all endpoints and data schemas.

### 💻 Submission Workflow

The expected delivery method for this project is as follows:

1.  **Fork this Repository:** Create a private fork of the original project repository (or create a new private repository if the project was provided as a zip/template).
2.  **Develop:** Complete all required features and tests within your private repository.
3.  **Invite:** Once development is complete, **invite the hiring manager/recruiter** (or specific email address, e.g., `[Insert Reviewer Email Here]`) as a **Collaborator** to your private repository.
4.  **Notification:** Notify the reviewer that the code is ready and providing the link to the repository or perform an invitation to your repository.

***Please DO NOT submit the code as a zip file or a Pull Request (PR) to the original repository.*** This process allows us to review your commit history and development workflow directly.