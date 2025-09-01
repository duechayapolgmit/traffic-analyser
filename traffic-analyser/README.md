# Traffic Analyser: Android Application

This is an [Expo](https://expo.dev) React Native application, served as the object detection and tracking application of the project, using EfficientDet. This program will do these following tasks:
- Detect the objects on the screen and attempt to track those objects.
- Send data about the objects that are off the screen.
- Display the FPS (frames per second) of the camera feed as well as the mean confidence score throughout each of the predictions.

## Setting Up and Running
To start, the libaries required to run are to be installed using the following command:
```
npm install
```
To run the application, either install an Android emulator or conncet an Android mobile device to the machine (with Developers Mode and USB Debugging on) and run the following command:
```
npx expo run:android --variant release
``` 
This will attempt to install the application on your phone and run it. Alternatively, the application can be ran in development mode (while still building the application) using ```npm run android```. 

Do note that running the application using `npm start` or on a browser **does not work.**

## Important Notice
Upon running the program, your camera and location will be used. The location of where the application is ran might be uploaded to the cloud service.
