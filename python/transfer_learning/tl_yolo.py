import cv2
import os

from ultralytics import YOLO

# Load the YOLO model
model = YOLO("./yolo11n.pt")

# Open the video file
video_name = '20250821_160229.mp4'
video_path = "./data/" + video_name
cap = cv2.VideoCapture(video_path)

# Outputs
output_dir = './output'
os.makedirs(output_dir, exist_ok=True)
frame_count = 0

# Loop through the video frames
while cap.isOpened():
    # Read a frame from the video
    success, frame = cap.read()

    if success:
        # Run YOLO inference on the frame
        results = model(frame)

        # Save the detection boxes
        boxes = results[0].boxes
        if boxes is not None:
            box_data = boxes.xyxy.cpu().numpy()
            class_ids = boxes.cls.cpu().numpy()

            for i, (box, class_id) in enumerate(zip(box_data, class_ids)):
                x1, y1, x2, y2 = map(int, box[:4])
                cropped = frame[y1:y2, x1:x2]

                # Get class name
                class_name = model.names[int(class_id)]

                # Save cropped image with class name in filename
                crop_path = os.path.join(
                    output_dir,
                    f"{video_name}_frame_{frame_count:05d}_box_{i}_{class_name}.jpg"
                )
                cv2.imwrite(crop_path, cropped)

        # Visualize the results on the frame
        annotated_frame = results[0].plot()

        # Display the annotated frame
        cv2.imshow("YOLO Inference", annotated_frame)

        # Break the loop if 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    else:
        # Break the loop if the end of the video is reached
        break

# Release the video capture object and close the display window
cap.release()
cv2.destroyAllWindows()