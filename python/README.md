# Traffic Analyser: Python Scripts
This component consists of two parts:
* YOLO Script (`yolo.py`) = this is the script used for one of the two object detection approaches in the project. This script reads in from a web camera to predict what is on the screen.
* Tranfer Learning folder (`transfer_learning`) = this is the folder containing an attempt of transfer learning for EfficientDet, including BiFPN head and detection head.

## Setting up and Running the Scripts
To start, the libraries required to run the scripts are located in `requirements.txt`. These libraries can be installed by running the following command in the folder: 

```
pip install -r requirements.txt
```

To run the scripts simply do:

```
python path/to/script.py
```

## Important Notice
With `yolo.py` script running, it is important to note that the object detected as well as the position of where the script (based on the IP address) is ran is uploaded to the cloud service.