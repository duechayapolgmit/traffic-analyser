import React from "react";
import { StyleSheet, View } from "react-native";

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

import { CameraView, useCameraPermissions } from "expo-camera";
import * as ml from '../scripts/ml';

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isTfReady, setIsTfReady] = React.useState(false);
  const status = React.useRef<HTMLParagraphElement | null>(null);
  const camera = React.useRef<CameraView | null>(null);

  React.useEffect(() => {
    const prepare = async () => {
      await tf.ready();
      setIsTfReady(true);
      console.log("TensorFlow.js is ready");

      // Loading the MobileNet feature model
      ml.loadMobileNetFeatureModel().then((res) => {
        if (status.current == null) return;
        status.current.innerText = res;
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
    // TODO
  };

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
      
      <button className="dataCollector" data-1hot="0" data-name="Class 1" onMouseOver={() => gatherDataForClass("0")}>Gather Class 1 Data</button>
      <button className="dataCollector" data-1hot="1" data-name="Class 2" onMouseOver={() => gatherDataForClass("1")}>Gather Class 2 Data</button>
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
