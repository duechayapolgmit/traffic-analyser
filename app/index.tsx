// Implementation adapted from: https://github.com/tensorflow/tfjs-examples/blob/master/react-native/pose-detection/App.tsx#L18
import React, { useState } from "react";
import { Dimensions, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as ScreenOrientation from 'expo-screen-orientation';

import * as tf from '@tensorflow/tfjs';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';

import { ExpoWebGLRenderingContext } from "expo-gl";
import * as util from '../scripts/util';

const MOBILENET_MODEL_PATH = 'https://www.kaggle.com/models/google/mobilenet-v3/TfJs/large-100-224-classification/1';
const TOPK_PREDICTIONS = 5;

const TensorCamera = cameraWithTensors(CameraView);
const CAM_PREVIEW_WIDTH = Dimensions.get('window').width;
const CAM_PREVIEW_HEIGHT = CAM_PREVIEW_WIDTH / (3 / 4); // Android only
const AUTO_RENDER = true; // auto-render TensorCamera preview

const IMG_SIZE = 224;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [isTfReady, setIsTfReady] = useState(false);
  const [mobileNet, setMobileNet] = useState<tf.GraphModel>()
  const [predsView, setPredictions] = useState<any[]>([]);
  const [predictActive, setPredActive] = useState<boolean>(true);
  const [fps, setFps] = useState(0);
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>();
  const [cameraType, setCameraType] = useState<CameraType>('back');

  // Refs
  const camera = React.useRef(null);

  React.useEffect(() => {
    const prepare = async () => {
      // Orientation
      const curOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(curOrientation);
      ScreenOrientation.addOrientationChangeListener((event) => {setOrientation(event.orientationInfo.orientation)});
      
      // Camera Permissions
      requestPermission();

      // Load TensorFlow
      await tf.ready();
      if (Platform.OS != 'web') tf.setBackend('wasm');
      setIsTfReady(true);
      console.log("TensorFlow.js is ready");
      tf.env().set('WEBGL_PACK_DEPTHWISECONV', false)

      // Load the MobileNet model from TensorFlow Hub
      tf.loadGraphModel(MOBILENET_MODEL_PATH, { fromTFHub: true }).then((model) => {
        setMobileNet(model);
        // Warm up the model
        let predict = model.predict(tf.zeros([1, IMG_SIZE, IMG_SIZE, 3])) as tf.Tensor;
        predict.dataSync();
        predict.dispose();
        console.log("MobileNet is ready.")
        setPredActive(false);
      });
    };
    prepare();
  }, []);

  async function handleCameraStream(images: IterableIterator<tf.Tensor3D>, updatePreview: () => void, gl: ExpoWebGLRenderingContext){
    const loop = async () => {
      if (mobileNet != null) {
        console.log('exists')
        const imgTensor = images.next().value as tf.Tensor3D;
        
        const startTime = Date.now();
        const logits = mobileNet.predict(imgTensor) as tf.Tensor;
        const classMetadata = mobileNet.metadata as {[key:string]:any};
        const classes = await util.getTopKClasses(logits, TOPK_PREDICTIONS, classMetadata['classNames']);
        const latency = Date.now() - startTime;
        setFps(Math.floor(1000 / latency));

        showResults(classes);
        
        tf.dispose([imgTensor, logits]);
      }
      requestAnimationFrame(loop);
    };

    loop();
  }

  const showResults = (classes: any[]) => {
    let probsContainer : any[] = [];
    for (let i = 0; i < classes.length; i++) {
     probsContainer.push(formatPreds(i, classes[i].className, classes[i].probability));
    }
    setPredictions(probsContainer);
  }

  // Display each prediction
  const formatPreds = (listNo: number, predict: string, probability: number) => {
    return (
      <View key={listNo} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16 }}>{predict}</Text>
        <Text style={{ fontSize: 16 }}>{probability.toFixed(3)}</Text>
      </View>
    )
  }

  // FPS counter
  const renderFps = () => {
    return (
      <View style={styles.fpsContainer}>
        <Text>FPS: {fps}</Text>
      </View>
    )
  }

  // TODO: Mouseover = TouchEnter
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
        <TensorCamera
          ref={camera}
          style={styles.camera}
          autorender={AUTO_RENDER}
          facing={cameraType}
          resizeWidth={IMG_SIZE}
          resizeHeight={IMG_SIZE}
          resizeDepth={3}
          cameraTextureHeight={1920}
          cameraTextureWidth={1080}
          useCustomShadersToResize={false}
          onReady={handleCameraStream}/>

        <View style={styles.predictions}>
          {predsView}
        </View>
        {renderFps()}
      </ScrollView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  camera: {  
    width: '100%',
    height: '80%'},
  predictions: {
    position: 'absolute',
    top: 50,
    left: 10,
    width: 300,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,},
  fpsContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,
  },
})
