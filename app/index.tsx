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

interface ScreenObject {
  box: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }
  category: string;
  direction?: 'STILL' | 'LEFT' | 'RIGHT'
  frames?: number;
  checked?: boolean;
  score: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const IMG_SIZE = 384;
const TOLERANCE = 0.5;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [fps, setFps] = useState<number>(0);
  const [topPred, setTopPred] = useState<string>("");
  const [prevObjs, setPrevObjs] = useState<ScreenObject[]>();
  const [currObjs, setCurrObjs] = useState<ScreenObject[]>();

  // Model
  const model = useTensorflowModel(require('../assets/model/model_efficientdet.tflite'));
  const actualModel = model.state === 'loaded' ? model.model : undefined;

  // Ref
  const preds = useCanvasRef();

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

  // JS state updates
  const updateFps = Worklets.createRunOnJS((fps: number) => {setFps(fps)});
  const updateTopPred = Worklets.createRunOnJS((top: string, score: number) => {
    let str = `${top} (${(score * 100).toFixed(1)}%)`
    setTopPred(str)
  })
  const updatePrevObjs = Worklets.createRunOnJS((objs: ScreenObject[]) => {setPrevObjs(objs)});
  const updateCurrObjs = Worklets.createRunOnJS((objs: ScreenObject[]) => {setCurrObjs(objs)});

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
    for (let i = 0; i < Number(num_detections[0]) * 4; i+= 4) {
      const currentIndex = Math.round(i / 4); // separate from the loop itself - for index 1, 2, 3, and not increments of 4

      if (detection_scores[currentIndex] < TOLERANCE) continue;

      // Scale according to screen size - output from model is 0-1
      const left = detection_boxes[i] * screenWidth;
      const top = detection_boxes[i + 1] * screenHeight;
      const right = detection_boxes[i + 2] * screenWidth;
      const bottom = detection_boxes[i + 3] * screenHeight;

      const category = COCO_CLASSES[currentIndex] ?? 'unknown';
      const score = detection_scores[currentIndex] as number;

      const screenObj: ScreenObject = {
        box: {left: left, right: right, top: top, bottom: bottom},
        category: category,
        score: score
      }
      objs.push(screenObj);

      // Set top pred if i = 0
      if (i == 0) updateTopPred(category, score)
    }

    updateCurrObjs(objs);

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
