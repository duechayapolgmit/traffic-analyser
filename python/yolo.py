from ultralytics import YOLO
import geocoder
import time
import requests

# Params
URL = 'http://localhost:5000/api/data'

# Load a model
model = YOLO("yolo11n.pt")
history = []

# Run inference
results = model.track(source=1, show= True, tracker="bytetrack.yaml", conf=0.5, stream=True, verbose=False) # 1 = Logitech Webcam

# Tracking and results
for result in results:
    ids = result.boxes.id
    classes = result.boxes.cls

    if ids is not None:
        for i in range(len(ids)):
            id = ids[i]
            cls = classes[i]

            # if not in history (more than the length of the history) - add as history and add to database
            if int(id) > len(history):
                history.append(cls)

                # Data for Server
                g = geocoder.ip('me')
                latitude = g.latlng[0]
                longitude = g.latlng[1]
                class_name = model.names[int(cls)]
                timestamp = int(time.time()*1000)

                # Send to Server
                obj = {'latitude': latitude, 'longitude': longitude, 'category': class_name, 'timestamp': timestamp}
                requests.post(URL, json=obj)
                print('New object: ', latitude, longitude, class_name, timestamp)