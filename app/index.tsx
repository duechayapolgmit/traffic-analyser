import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CameraType, useCameraPermissions } from "expo-camera";
import * as ScreenOrientation from 'expo-screen-orientation';

import { useTensorflowModel } from 'react-native-fast-tflite';
import { Camera, CameraDevice, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { Canvas, Rect } from '@shopify/react-native-skia';
import { TypedArray } from "expo-modules-core";

import { COCO_CLASSES } from '../scripts/classes';

const IMG_SIZE = 384;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [fps, setFps] = useState<number>(0);
  const [topPred, setTopPred] = useState<string>("");

  // Model
  const model = useTensorflowModel(require('../assets/model/model_efficientdet.tflite'));
  const actualModel = model.state === 'loaded' ? model.model : undefined;

  // Ref
  const preds = React.useRef<Canvas>(null);

  // Other bits
  const { resize } = useResizePlugin();
  const device = useCameraDevice('back') as CameraDevice;

  React.useEffect(() => {
    if (actualModel == null) return;
    console.log('Model has been loaded');
  }, [actualModel]);

  React.useEffect(() => {
    requestPermission();
  }, [requestPermission])

  function generateRects(detection_boxes: TypedArray): void {
    const canvasContainer: React.ReactElement[] = [];

    for (let i = 0; i < detection_boxes.length; i += 4) {
      const left = detection_boxes[i];
      const top = detection_boxes[i + 1];
      const right = detection_boxes[i + 2];
      const bottom = detection_boxes[i + 3];
      const width = right - left;
      const height = bottom - top;

      canvasContainer.push(
        <Rect x={left} y={top} width={width} height={height} color="red" />
      );
    }

    preds.current = canvasContainer;
  }
  const generateRectsJS = Worklets.createRunOnJS(generateRects)

  // JS state updates
  const updateFps = Worklets.createRunOnJS((fps: number) => {
    setFps(fps);
  });
  const updateTopPred = Worklets.createRunOnJS((top: string) => {
    setTopPred(top)
  })

  
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
    const detection_classes = outputs[1]
    const detection_scores = outputs[2];
    const num_detections = outputs[3]

    console.log(`Detected ${num_detections[0]} objects!`)

    let logMessage = '→ ';
    for (let i = 0; i < num_detections[0]; i++) {
      const classIndex = Math.round(Number(detection_classes[i]));
      const score = detection_scores[i] as number;
      const label = COCO_CLASSES[classIndex] ?? 'unknown';
      logMessage += `${label} (${(score * 100).toFixed(1)}%)`;

      if (i < Number(num_detections[0]) - 1) {
        logMessage += ', ';
      }

      // Set top pred if i = 0
      if (i == 0) updateTopPred(label)
    }

    console.log(logMessage);

    //generateRectsJS(detection_boxes);

    // Duration
    const duration = Date.now() - startTime;
    updateFps(1000 / duration)
  }, [model])


  // FPS counter
  const renderFps = () => {
    return (
      <View style={styles.fpsContainer}>
        <Text>FPS: {parseInt(fps)}</Text>
      </View>
    )
  }

  // Top prediction
  const renderTopPreds = () => {
    return (
      <View style={styles.predsContainer}>
        <Text>Top Pred: {topPred}</Text>
      </View>
    )
  }

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
        <Canvas ref={preds} style={styles.canvas}/>

        {renderFps()}
        {renderTopPreds()}
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
