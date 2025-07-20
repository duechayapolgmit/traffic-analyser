import React, { useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useCameraPermissions } from "expo-camera";

import { useTensorflowModel } from 'react-native-fast-tflite';
import { Camera, CameraDevice, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { Canvas, Rect, useCanvasRef } from '@shopify/react-native-skia';
import { TypedArray } from "expo-modules-core";

import { COCO_CLASSES } from '../scripts/classes';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const IMG_SIZE = 384;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [fps, setFps] = useState<number>(0);
  const [topPred, setTopPred] = useState<string>("");
  const [numDetect, setNumDetect] = useState<number>(0);
  const [predBoxes, setBoxes] = useState<TypedArray>();
  const [predScores, setScores] = useState<TypedArray>();
  const [predClasses, setClasses] = useState<TypedArray>();

  // Model
  const model = useTensorflowModel(require('../assets/model/model_efficientdet.tflite'));
  const actualModel = model.state === 'loaded' ? model.model : undefined;

  // Ref
  const preds = useCanvasRef();

  // Other bits
  const { resize } = useResizePlugin();
  const device = useCameraDevice('back') as CameraDevice;
  let boxes = [];

  React.useEffect(() => {
    if (actualModel == null) return;
    console.log('Model has been loaded');
  }, [actualModel]);

  React.useEffect(() => {
    requestPermission();
  }, [requestPermission])

  // JS state updates
  const updateFps = Worklets.createRunOnJS((fps: number) => {setFps(fps)});
  const updateTopPred = Worklets.createRunOnJS((top: string, score: number) => {
    let str = `${top} (${(score * 100).toFixed(1)}%)`
    setTopPred(str)
  })
  const updateNumDetect = Worklets.createRunOnJS((count: number) => {setNumDetect(count)})
  const updateBoxes = Worklets.createRunOnJS((boxes: TypedArray) => {setBoxes(boxes)})
  const updateScores = Worklets.createRunOnJS((scores: TypedArray) => {setScores(scores)})
  const updateClasses = Worklets.createRunOnJS((classes: TypedArray) => {setClasses(classes)})

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
    const num_detections = outputs[3]

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
      if (i == 0) updateTopPred(label, score)
    }

    updateNumDetect(Number(num_detections))
    updateBoxes(detection_boxes)
    updateScores(detection_scores)
    updateClasses(detection_classes)

    // Duration
    const duration = Date.now() - startTime;
    updateFps(1000 / duration)
  }, [model])

  // FPS counter
  const renderFps = () => {
    return (
      <View style={styles.fpsContainer}>
        <Text>FPS: {String(fps.toFixed(1))}</Text>
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

  const renderDetections = () => {
    if (predBoxes == null || predScores == null) {
      console.log('No detections')
      return null;
    }
    const elements = [];
    const arrayLength = numDetect * 4;

    let currentItem = 0;
    for (let i = 0; i < arrayLength; i += 4) {
      // Scale coordinates from model output (0-1 range) to screen dimensions
      const left = predBoxes[i] * screenWidth;
      const top = predBoxes[i + 1] * screenHeight;
      const right = predBoxes[i + 2] * screenWidth;
      const bottom = predBoxes[i + 3] * screenHeight;
      const width = right - left;
      const height = bottom - top;

      if (predScores[Math.round(i / 4)] < 0.5) continue;

      elements.push(
        <Rect
          key={`rect-${i}`}
          x={left}
          y={top}
          width={width}
          height={height}
          color="red"
          style="stroke"
          strokeWidth={2}
        />
      );
      currentItem += 1;
    }

    return elements;
  };

  const renderLabels = () => {
    if (predBoxes == null || predScores == null || predClasses == null) return null;
    const labels = [];
    const arrayLength = numDetect * 4;

    for (let i = 0; i < arrayLength; i += 4) {
      const left = predBoxes[i] * screenWidth;
      const bottom = predBoxes[i + 3] * screenHeight;
      const classIndex = Math.round(predClasses[i / 4]);
      const score = predScores[i / 4];
      const label = COCO_CLASSES[classIndex] ?? 'unknown';
      const accuracyText = `${(score * 100).toFixed(1)}%`;

      if (predScores[Math.round(i / 4)] < 0.5) continue;

      labels.push(
        <View 
          key={`label-container-${i}`}
          style={{
            position: 'absolute',
            left: left,
            top: bottom + 5,
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 4,
            borderRadius: 2,
          }}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>
            {label} {accuracyText}
          </Text>
        </View>
      );
    }

    return labels;
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
