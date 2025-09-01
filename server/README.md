# Traffic Analyser: Node Middleware Server
This component consists of a Node server script in `index.js`, containing two HTTP gateways for HTTP requests:
- GET method: returning all instances of the objects inside the database the server is running adjacent on.
- POST method: receiving an object's details about the timestamp, location (latitude and longitude), category, ID and the direction of where the object is going.

This server will **require an installation of a MongoDB server** to use its database capabilities.

## Setting Up and Running
To start, the libraries required to run are to be installed using the following command:
```
npm install
```
To run the server, use another command:
```
node .
```
This will listen to any requests in the port 5000. 

## Adjustments for Local Running
Adjustments can be made to the YOLO Python script as well as the traffic-analyser Android application to link to this server instead of a deployed server, by replacing:
- The URL constant in `python/yolo.py`, and
- The DB_LINK constant in `traffic-analyser/app/index.tsx`
with `localhost:5000/api/data`