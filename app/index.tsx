import { CameraView, useCameraPermissions } from "expo-camera";
import React from "react";
import { StyleSheet, View } from "react-native";

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

import * as ml from '../scripts/ml';
import * as util from '../scripts/util';

const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [isTfReady, setIsTfReady] = React.useState(false);
  const [mobileNet, setMobileNet] = React.useState<tf.GraphModel | null>(null)

  // Refs
  const status = React.useRef<HTMLParagraphElement | null>(null);
  const camera = React.useRef<CameraView | null>(null);

  // Data
  let trainingDataInputs = [];
  let trainingDataOutputs = [];

  React.useEffect(() => {
    const prepare = async () => {
      await tf.ready();
      setIsTfReady(true);
      console.log("TensorFlow.js is ready");

      // Loading the MobileNet feature model
      ml.loadMobileNetFeatureModel().then((res) => {
        if (status.current == null) return;
        setMobileNet(res);
        status.current.innerText = "MobileNet feature model loaded successfully!";
      }).catch((err) => {
        console.error("Error loading MobileNet feature model:", err);
      });
    };
    prepare();
  }, []);

  const trainAndPredict = () => {
    // TODO
  };

  const gatherDataForClass = (dataClass: string) => {
    let classNumber = parseInt(dataClass, 10);
    gatherData(classNumber);
  };

  const gatherData = (classNumber: number) => {
    if (camera.current == null) return;

    let imageFeatures = tf.tidy(() => {
      camera.current?.takePictureAsync({}).then((image) => {
        if (image == null) return;

        // Convert to tf-able image data
        let imgData = {
          data: util.base64ToUint8Array(image.base64),
          width: image.width,
          height: image.height,
        }
        
        let imageTensor = tf.browser.fromPixels(imgData);
        let resizedTensorFrame = tf.image.resizeBilinear(imageTensor, [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true);
        let normalizedTensorFrame = resizedTensorFrame.div(255);
        
        if (mobileNet == null) return;
        let tens = mobileNet.predict(normalizedTensorFrame.expandDims()) as tf.Tensor
        return tens.squeeze();
      }
    )})

    trainingDataInputs.push(imageFeatures);
    trainingDataOutputs.push(classNumber);

    console.log(`Gathered data for class ${classNumber}. Total samples: ${trainingDataInputs.length}`);
  }

  const reset = () => {
    // TODO
  };

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
        <h1>Camera permission is required to use this app.</h1>
        <p>Please allow camera access in your device settings.</p>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1>Make your own "Teachable Machine" using Transfer Learning with MobileNet v3 in TensorFlow.js using saved graph model from TFHub.</h1>
  
      <p ref={status} >Awaiting TF.js load</p>
      
      <CameraView style={styles.camera} ref={camera} videoQuality="480p"/>
      
      <button className="dataCollector" data-1hot="0" data-name="Class 1" onClick={() => gatherDataForClass("0")}>Gather Class 1 Data</button>
      <button className="dataCollector" data-1hot="1" data-name="Class 2" onClick={() => gatherDataForClass("1")}>Gather Class 2 Data</button>
      <button id="train" onClick={trainAndPredict}>Train &amp; Predict!</button>
      <button id="reset" onClick={reset}>Reset</button>
    </View>
  );
};

const styles = StyleSheet.create({
  camera: { 
    flex: 1, 
    width: '50%',}
})
