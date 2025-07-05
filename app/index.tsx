import { CameraView, useCameraPermissions } from "expo-camera";
import React from "react";
import { StyleSheet, View } from "react-native";

import * as tf from '@tensorflow/tfjs';

import * as util from '../scripts/util';

const MOBILENET_MODEL_PATH = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1';
const IMAGE_SIZE = 224;
const TOPK_PREDICTIONS = 10;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [isTfReady, setIsTfReady] = React.useState(false);
  const [mobileNet, setMobileNet] = React.useState<tf.GraphModel | null>(null)
  const [predict, setPredict] = React.useState(false);
  const [model, setModel] = React.useState<tf.Sequential | null>(null);

  // Refs
  const predsDiv = React.useRef<HTMLDivElement | null>(null);
  const camera = React.useRef<CameraView | null>(null);


  React.useEffect(() => {
    const prepare = async () => {
      await tf.ready();
      setIsTfReady(true);
      console.log("TensorFlow.js is ready");

      // Load the MobileNet model from TensorFlow Hub
      tf.loadGraphModel(MOBILENET_MODEL_PATH, { fromTFHub: true }).then((model) => {
        setMobileNet(model);
        // Warm up the model
        let predict = model.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3])) as tf.Tensor; 
        predict.dispose();
      });

    };

    prepare();
  }, []);

  async function predictImg(){
    console.log("Predicting...");

    tf.tidy(() => {
      if (camera.current == null || mobileNet == null) {
        console.log("Camera or MobileNet is not ready.");
        return;
      }

      const image = camera.current.takePictureAsync({}).then(image => {
        // Convert to tf-able image data
        let imgData = {
          data: util.base64ToUint8Array(image.base64),
          width: image.width,
          height: image.height,
        };

        const img = tf.cast(tf.browser.fromPixels(imgData), 'float32');
        const resized = tf.image.resizeBilinear(img, [IMAGE_SIZE, IMAGE_SIZE], true);
        const offset = tf.scalar(127.5);
        const normalized = resized.sub(offset).div(offset);
        const batched = normalized.reshape([1, IMAGE_SIZE, IMAGE_SIZE, 3]);

        let logits = mobileNet.predict(batched);

        util.getTopKClasses(logits, TOPK_PREDICTIONS).then((classes) => {
          showResults(classes);
        });
      
      });
    });

  }

  const showResults = (classes: any[]) => {
    if (predsDiv.current == null) {
      console.warn("Predictions div is not ready.");
      return;
    }

    // Clear previous predictions
    predsDiv.current.innerHTML = '';

    let predictionContainer: HTMLDivElement = document.createElement('div');
    predictionContainer.className = 'pred-container';

    let probsContainer : HTMLDivElement = document.createElement('div');
    for (let i = 0; i < classes.length; i++) {
      const row: HTMLDivElement = document.createElement('div');
      row.className = 'row';

      const classElement: HTMLDivElement = document.createElement('div');
      classElement.className = 'cell';
      classElement.innerText = classes[i].className;
      row.appendChild(classElement);

      const probsElement: HTMLDivElement = document.createElement('div');
      probsElement.className = 'cell';
      probsElement.innerText = classes[i].probability.toFixed(3);
      row.appendChild(probsElement);

      probsContainer.appendChild(row);
    }
    predictionContainer.appendChild(probsContainer);

    predsDiv.current.insertBefore(
      predictionContainer,
      predsDiv.current.firstChild
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
      <CameraView style={styles.camera} ref={camera} videoQuality="4:3"/>
      <button id="train" onClick={predictImg}> Predict!</button>

      <div style={styles.predictions} ref={predsDiv} id="predictions"></div>
    </View>
  );
};

const styles = StyleSheet.create({
  camera: {  
    width: 640,
    height: 480,},
  predictions: {
    width: '50%'}
})
