from ultralytics import YOLO
import geocoder
import time
import requests

# Params
URL = 'http://52.18.101.172:5000/api/data'
DIRECTION_THRESHOLD = 5
FRAME_THRESHOLD = 10 # grace period

# Class for the objects:
class Obj:
    def __init__(self, id, timestamp, cls, centre):
        self.id = id
        self.cls = cls
        self.direction = {'STILL': 0, 'LEFT': 0, 'RIGHT': 0}
        self.previous_direction = 'STILL'
        self.timestamp = timestamp
        self.centre = centre
        self.grace = 0

# Function to send data to the server
def send_data(obj):
    # Data for Server - all
    g = geocoder.ip('me')
    latitude = g.latlng[0]
    longitude = g.latlng[1]

    # Get direction
    direction = max(obj.direction, key=obj.direction.get)

    # Data for Server - individual
    class_name = '{} ({})'.format(model.names[int(obj.cls)], obj.id)
    obj_to_send = {'latitude': latitude, 
                    'longitude': longitude, 
                    'category': class_name, 
                    'timestamp': obj.timestamp, 
                    'direction': direction}

    # Send to Server
    requests.post(URL, json=obj_to_send)
    print('New object sent: ', class_name, obj.timestamp, latitude, longitude, direction)

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
    if curr_ids is not None: # If current frame doesn't have any objects, assumed that all the previous objects are gone
        for i in range(len(curr_ids)):
            # Get current object's data
            curr_id = int(curr_ids[i])
            curr_centre = curr_boxes[i][0].item()
            curr_cls = int(curr_classes[i])

            # Detect if same as one of the previous ones or not - if yes, check direction and update
            if curr_id in prev_objs_dict:
                prev_obj = prev_objs_dict[curr_id]

                # Get direction
                if curr_centre > prev_obj.centre + DIRECTION_THRESHOLD:
                    prev_obj.direction['RIGHT'] += 1
                elif curr_centre < prev_obj.centre - DIRECTION_THRESHOLD:
                    prev_obj.direction['LEFT'] += 1
                else:
                    prev_obj.direction[prev_obj.previous_direction] += 1

                # Update
                prev_obj.centre = curr_centre
                prev_obj.grace = 0
                curr_objs.append(prev_obj)
            else: # If it's not the same object -> it's a new one, so create a new object
                new_obj = Obj(curr_id, timestamp=int(time.time()*1000), cls=curr_cls, centre=curr_centre)
                new_obj.direction['STILL'] += 1
                curr_objs.append(new_obj)

    # Check the previous frame
    add_back = []
    if prev_objs:
        for prev_obj in prev_objs:
            exist = False
            for curr_obj in curr_objs:
                if prev_obj.id == curr_obj.id:
                    exist = True
                    break
            if not exist:
                if prev_obj.grace <= FRAME_THRESHOLD:
                    prev_obj.grace = prev_obj.grace + 1
                    add_back.append(prev_obj)
                else:
                    send_data(prev_obj) # If doesn't exist in the current frame anymore and passed the grace period - send the data
    
    # Add back the previous frame object - if any exists
    for ab in add_back:
        curr_objs.append(ab)

    prev_objs = curr_objs.copy()