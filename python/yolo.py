from ultralytics import YOLO

# Load a model
model = YOLO("yolo11n.pt")

# Run inference
results = model.track(source=1, show= True, tracker="bytetrack.yaml", conf=0.5) # 1 = Logitech Webcam