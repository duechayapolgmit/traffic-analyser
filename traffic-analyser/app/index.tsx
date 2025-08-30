import React, { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useCameraPermissions } from "expo-camera";
import * as Location from 'expo-location';
import { TypedArray } from "expo-modules-core";

import { useTensorflowModel } from 'react-native-fast-tflite';
import { Camera, CameraDevice, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { Canvas, Rect } from '@shopify/react-native-skia';
import axios from 'axios';

import { COCO_CLASSES } from '../scripts/classes';

interface ScreenObject {
  id: number;
  box: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }
  category: string;
  direction: {
    'STILL': number;
    'LEFT': number;
    'RIGHT': number;
  }
  previous_direction: 'STILL' | 'LEFT' | 'RIGHT';
  frames?: number;
  checked?: boolean;
  score: number;
  time: number;
  grace: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MODEL = '../assets/model/model_efficientdet_lite3_512.tflite'
const IMG_SIZE = 512; // lite2 - 448, hybrid - 512
const TOLERANCE = 0.45;
const HEIGHT_TOLERANCE = 0.3;
const FRAME_THRESHOLD = 10;

const DB_LINK = 'http://52.18.101.172:5000/api/data'

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [totalConfidenceSum, setTotalConfidenceSum] = useState<number>(0);
  const [totalDetections, setTotalDetections] = useState<number>(0);
  const [currObjs, setCurrObjs] = useState<ScreenObject[]>([]);

  // Model
  const model = useTensorflowModel(require(MODEL));
  const actualModel = model.state === 'loaded' ? model.model : undefined;

  // Ref
  const prevObjs = React.useRef<ScreenObject[]>([]);

  // Other bits
  const { resize } = useResizePlugin();
  const device = useCameraDevice('back') as CameraDevice;

  // Start -> Model loading
  useEffect(() => {
    if (actualModel == null) return;
    console.log('Model has been loaded');
  }, [actualModel]);

  // Start -> Permission requests
  useEffect(() => {
    requestPermission();
  }, [requestPermission])

  // Start -> Others
  useEffect(() => {
    async function getCurrentLocation() {
      let {status} = await Location.requestForegroundPermissionsAsync();
      if (status != 'granted') {
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    }

    getCurrentLocation();
  },[])

  // JS state updates
  const updateFps = Worklets.createRunOnJS((fps: number) => {setFps(fps)});
  const updateCurrObjs = Worklets.createRunOnJS((objs: ScreenObject[]) => {setCurrObjs(objs)});
  const updateAccumulatedConfidence = Worklets.createRunOnJS((sum: number, count: number) => {
    setTotalConfidenceSum(prev => prev + sum);
    setTotalDetections(prev => prev + count);
  });

  // Tracks an object
  const trackFrame = (objs: ScreenObject[]) => {
    let current: ScreenObject[] = objs?.map(obj => ({ // initialise
      ...obj,
      frames: 1,
      checked: false,
      grace: 0
    }));
    let previous = [...prevObjs.current];

    let checked = [];

    if (previous.length > 0) {
      // Compare with previous frame objects
      for (let currObj of current) {
        for (let prevObj of previous) {
          if (checkObj(currObj, prevObj)) {
            currObj.checked = true;
            prevObj.grace = 0;

            // Direction
            const leftDiff = currObj.box.left - prevObj.box.left;
            const rightDiff = currObj.box.right - prevObj.box.right;
            if (leftDiff < 0 && rightDiff < 0) {
              prevObj.direction.LEFT += 1;
              prevObj.previous_direction = 'LEFT';
            }
            else if (leftDiff > 0  && rightDiff > 0) {
              prevObj.direction.RIGHT += 1;
              prevObj.previous_direction = 'RIGHT';
            } else {
              prevObj.direction.STILL += 1;
              prevObj.previous_direction = 'STILL';
            }
            prevObj.frames = (prevObj.frames ?? 0) + 1;
            checked.push(prevObj)
            break;
          } 
        }
        if (currObj.checked == false) checked.push(currObj)
      }

      // Check for disappeared objects
      const disappeared = previous.filter(obj => !current.some(c => checkObj(c, obj)));
      if (disappeared.length > 0) {
        disappeared.forEach(disObj => {
          if (disObj.grace <= FRAME_THRESHOLD) {
            disObj.grace = disObj.grace + 1;
            checked.push(disObj)
          } else {
            // Prep object for posting
            let latitude = 0;
            let longitude = 0;
            if (location != null) {
              latitude = location.coords.latitude;
              longitude = location.coords.longitude;
            }

            // Direction handling
            const directions = {
              'LEFT': disObj.direction.LEFT,
              'RIGHT': disObj.direction.RIGHT,
              'STILL': disObj.direction.STILL
            }
            const [direction, directionValue] = Object.entries(directions).reduce(
              (max, entry) => entry[1] > max[1] ? entry : max
            )

            let postObj = {
              category: disObj.category + ` (${disObj.id})`,
              timestamp: disObj.time,
              latitude: latitude,
              longitude: longitude,
              direction: direction
            };

            axios.post(DB_LINK, postObj).catch(err => {console.log(err)})
            console.log(`- New Object: ${disObj.category} (${disObj.id}) = ${disObj.frames} (${postObj.latitude})`);
          }
        });
      }
    } else {
      checked = current
    }

    prevObjs.current = checked;
  }

  // Check if two objects are similar
  const checkObj = (current: ScreenObject, previous: ScreenObject) => {
    if (!current || !previous) return false;
    
    const currHeight = current.box.bottom - current.box.top;
    const prevHeight = previous.box.bottom - previous.box.top;
    if (prevHeight <= 0) return false; // div by zero

    const difference = Math.abs(currHeight - prevHeight) / prevHeight;

    return difference <= HEIGHT_TOLERANCE && current.category === previous.category
  }

  // JS Worklets for misc functions
  const trackFrameEntry = Worklets.createRunOnJS( (objs: ScreenObject[]) => {trackFrame(objs)})

  const frameProcessor = useFrameProcessor( (frame) => {
    'worklet'
    if (actualModel == null) return;

    // Start timer for FPS
    const startTime = Date.now();

    // Resize the image
    const resized = resize(frame, { 
      scale: { 
        width: IMG_SIZE, 
        height: IMG_SIZE
      }, 
      pixelFormat: 'rgb', 
      dataType: 'uint8'});
    
    // Outputs and interpretation
    const outputs = actualModel.runSync([resized])
    const detection_boxes = outputs[0] as TypedArray;
    const detection_classes = outputs[1] as TypedArray;
    const detection_scores = outputs[2] as TypedArray;
    const num_detections = outputs[3];
    
    // Process the outputs to ScreenObject
    let objs: ScreenObject[] = [];
    let scoreSum = 0;
    let detections = 0;

    for (let i = 0; i < Number(num_detections[0]) * 4; i+= 4) {
      const currentIndex = Math.round(i / 4); // separate from the loop itself - for index 1, 2, 3, and not increments of 4

      if (detection_scores[currentIndex] < TOLERANCE) continue;

      // Scale according to screen size - output from model is 0-1
      const left = detection_boxes[i] * screenWidth;
      const top = detection_boxes[i + 1] * screenHeight;
      const right = detection_boxes[i + 2] * screenWidth;
      const bottom = detection_boxes[i + 3] * screenHeight;

      const catIndex = detection_classes[currentIndex] as number;
      const category = COCO_CLASSES[catIndex] ?? 'unknown';
      const score = detection_scores[currentIndex] as number;

      scoreSum += score;
      detections += 1;

      const objId = Math.floor(Math.random() * 1000);
      const screenObj: ScreenObject = {
        id: objId,
        box: { left: left, right: right, top: top, bottom: bottom },
        category: category,
        score: score,
        time: Date.now(),
        grace: 0,
        direction: { LEFT: 0, RIGHT: 0, STILL: 1 },
        previous_direction: "STILL"
      }
      objs.push(screenObj);
      
    }

    updateAccumulatedConfidence(scoreSum, detections);

    updateCurrObjs(objs);
    trackFrameEntry(objs);

    // Duration
    const duration = Date.now() - startTime;
    updateFps(1000 / duration)
  }, [actualModel])

  // FPS counter
  const renderFps = () => {
    return (
      <View style={styles.fpsContainer}>
        <Text>FPS: {String(fps.toFixed(1))}</Text>
      </View>
    )
  }

  // Top prediction
  const renderMeanConfidence = () => {
    const accumulatedMean = totalDetections > 0 ? totalConfidenceSum / totalDetections : 0;
    return (
      <View style={styles.predsContainer}>
        <Text>Mean Confidence: {accumulatedMean.toFixed(3)}</Text>
      </View>
    )
  }

  // Renders boxes for current objects
  const renderDetections = () => {
    if (currObjs == null) {
      console.log('No detections')
      return null;
    }
    const elements = [];

    for (let i = 0; i < currObjs.length; i++) {
      const currObj = currObjs[i]
      const width = currObj.box.right - currObj.box.left;
      const height = currObj.box.bottom - currObj.box.top;

      elements.push(
        <Rect
          key={`rect-${i}`}
          x={currObj.box.left}
          y={currObj.box.top}
          width={width}
          height={height}
          color="red"
          style="stroke"
          strokeWidth={2}
        />
      );
    }

    return elements;
  };

  // Render labels for current objects
  const renderLabels = () => {
    if (currObjs == null) {
      console.log('No detections')
      return null;
    }
    const elements = [];

    for (let i = 0; i < currObjs.length; i++) {
      const currObj = currObjs[i];

      const accuracyText = `${(currObj.score * 100).toFixed(1)}%`;

      elements.push(
        <View 
          key={`label-container-${i}`}
          style={{
            position: 'absolute',
            left: currObj.box.left,
            top: currObj.box.bottom + 5,
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 4,
            borderRadius: 2,
          }}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>
            {currObj.category} {accuracyText}
          </Text>
        </View>
      );
    }

    return elements;
  };

  // Permission screen
  if (!permission?.granted) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text>Camera permission is required to use this app.</Text>
        <Text>Please allow camera access in your device settings.</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >      
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} frameProcessor={frameProcessor} pixelFormat="yuv"/>
        <Canvas style={[StyleSheet.absoluteFill, { width: screenWidth, height: screenHeight }]}>
          {renderDetections()}
        </Canvas>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {renderLabels()}
        </View>

        {renderFps()}
        {renderMeanConfidence()}
      </ScrollView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  camera: {  
    width: '100%',
    height: '80%'},
  canvas:{
    ...StyleSheet.absoluteFillObject, 
    zIndex: 1000,
    backgroundColor: 'transparent'
  },
  fpsContainer: {
    position: 'absolute',
    top: 30,
    left: 10,
    width: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,
  },
  predsContainer: {
    position: 'absolute',
    top: 70,
    left: 10,
    width: 150,
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,
  },
})
