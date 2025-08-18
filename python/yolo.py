from ultralytics import YOLO
import geocoder
import time
import requests

# Params
URL = 'http://localhost:5000/api/data'
THRESHOLD = 5

# Class for the objects:
class Obj:
    def __init__(self, id, timestamp, cls, direction, centre):
        self.id = id
        self.cls = cls
        self.direction = direction
        self.timestamp = timestamp
        self.centre = centre

# Function to send data to the server
def send_data(obj):
    # Data for Server - all
    g = geocoder.ip('me')
    latitude = g.latlng[0]
    longitude = g.latlng[1]

    # Data for Server - individual
    class_name = model.names[int(obj.cls)]
    obj_to_send = {'latitude': latitude, 
                    'longitude': longitude, 
                    'category': class_name, 
                    'timestamp': obj.timestamp, 
                    'direction': obj.direction}
    
    print(obj_to_send)

    # Send to Server
    requests.post(URL, json=obj_to_send)
    print('New object sent: ', obj.id, obj.timestamp, class_name, latitude, longitude)

# Load a model
model = YOLO("yolo11n.pt")
prev_objs = []

# Run inference
results = model.track(source=0, show= True, tracker="bytetrack.yaml", conf=0.5, stream=True, verbose=False) # 1 = Logitech Webcam

# Tracking and results
for result in results:
    # Current frame data
    curr_ids = result.boxes.id
    curr_classes = result.boxes.cls
    curr_boxes = result.boxes.xywh
    curr_objs = []

    # Previous frame data
    prev_objs_dict = {obj.id: obj for obj in prev_objs}

    # Check the current frame
    if curr_ids is None: # If current frame doesn't have any objects, assumed that all the previous objects are gone
        for prev_obj in prev_objs:
            send_data(prev_obj)
    else: # If current frame has an object, compare with the previous one (via ID) and pop out the one that doesn't match
        for i in range(len(curr_ids)):
            # Get current object's data
            curr_id = int(curr_ids[i])
            curr_centre = curr_boxes[i][0].item()
            curr_cls = int(curr_classes[i])

            # Detect if same as one of the previous ones or not - if yes, check direction and update
            if curr_id in prev_objs_dict:
                prev_obj = prev_objs_dict[curr_id]

                # Get direction
                if curr_centre > prev_obj.centre + THRESHOLD:
                    prev_obj.direction = 'RIGHT'
                elif curr_centre < prev_obj.centre - THRESHOLD:
                    prev_obj.direction = 'LEFT'

                # Update
                prev_obj.centre = curr_centre
                curr_objs.append(prev_obj)
            else: # If it's not the same object -> it's a new one, so create a new object
                new_obj = Obj(curr_id, timestamp=int(time.time()*1000), cls=curr_cls, direction='STILL', centre=curr_centre)
                curr_objs.append(new_obj)

    # Check the previous frame
    if prev_objs:
        for prev_obj in prev_objs:
            exist = False
            for curr_obj in curr_objs:
                if prev_obj.id == curr_obj.id:
                    exist = True
                    break
            if not exist:
                send_data(prev_obj) # If doesn't exist in the current frame anymore - send the data

    prev_objs = curr_objs.copy()