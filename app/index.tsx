import { CameraView, useCameraPermissions } from "expo-camera";
import React from "react";
import { StyleSheet, View } from "react-native";

import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

import '@tensorflow/tfjs-react-native';

import * as ml from '../scripts/ml';
import * as util from '../scripts/util';

const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;
const CLASS_NAMES: string[] = ["0", "1"];

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [isTfReady, setIsTfReady] = React.useState(false);
  const [mobileNet, setMobileNet] = React.useState<tf.GraphModel | null>(null)
  const [predict, setPredict] = React.useState(false);
  const [model, setModel] = React.useState<tf.Sequential | null>(null);

  // Refs
  const status = React.useRef<HTMLParagraphElement | null>(null);
  const camera = React.useRef<CameraView | null>(null);

  // Data
  let trainingDataInputs: any[] = [];
  let trainingDataOutputs: any[] = [];

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

      // Load the model
      ml.getModel(CLASS_NAMES.length).then((res) => {
        setModel(res);
      });
    };

    prepare();
  }, []);

  async function trainAndPredict() {
    setPredict(false);
    
    tf.util.shuffleCombo(trainingDataInputs, trainingDataOutputs);
    let outputsAsTensor = tf.tensor1d(trainingDataOutputs, 'int32');
    let oneHotOutputs = tf.oneHot(outputsAsTensor, 2);
    let inputsAsTensor = tf.stack(trainingDataInputs);

    let results = await ml.fitModel(model, inputsAsTensor, oneHotOutputs, outputsAsTensor);

    setPredict(true);
    predictLoop();
  };

  const predictLoop = async () => {
    if (camera.current == null || mobileNet == null || model == null) {
      console.warn("Camera, MobileNet, or model is not ready.");
      return;
    } 

    console.log(predict);

      const image = await camera.current.takePictureAsync({});
      if (!image) return;

      // Convert to tf-able image data
      let imgData = {
        data: util.base64ToUint8Array(image.base64),
        width: image.width,
        height: image.height,
      };

      tf.tidy(function() {
        let videoFrameAsTensor = tf.browser.fromPixels(imgData);
        let resizedTensorFrame = tf.image.resizeBilinear(videoFrameAsTensor,[MOBILE_NET_INPUT_HEIGHT, 
            MOBILE_NET_INPUT_WIDTH], true);
        let normalizedTensorFrame = resizedTensorFrame.div(255);

        // Handle different return types from predict()
        const imageFeaturesOutput = mobileNet.predict(normalizedTensorFrame.expandDims());
        let imageFeatures: tf.Tensor;
        if (Array.isArray(imageFeaturesOutput)) {
          imageFeatures = imageFeaturesOutput[0].squeeze();
        } else if ('output' in imageFeaturesOutput) {
          imageFeatures = imageFeaturesOutput.output.squeeze();
        } else {
          imageFeatures = (imageFeaturesOutput as tf.Tensor).squeeze();
        }

        const features2D = imageFeatures.reshape([1, -1]);
        const prediction = model.predict(features2D);
        console.log(prediction) 

        /*
        let highestIndex = prediction.argMax().arraySync() as number;
        let predictionArray = prediction.arraySync() as number[];

        

        if (status.current != null) {
          status.current.innerText = `Prediction: ${CLASS_NAMES[highestIndex as number]} with ${
          Math.floor(predictionArray[highestIndex as number] * 100) }% confidence`;
        }*/
    });

      //window.requestAnimationFrame(predictLoop);
  }

  const gatherDataForClass = async (dataClass: string) => {
    let classNumber = parseInt(dataClass, 10);
    await gatherData(classNumber);
  };

  const gatherData = async (classNumber: number) => {
    if (camera.current == null) return;

    try {
      const image = await camera.current.takePictureAsync({});
      if (!image) return;

      // Convert to tf-able image data
      let imgData = {
        data: util.base64ToUint8Array(image.base64),
        width: image.width,
        height: image.height,
      };
      
      const imageFeatures = tf.tidy(() => {
        let imageTensor = tf.browser.fromPixels(imgData);
        let resizedTensorFrame = tf.image.resizeBilinear(
          imageTensor, 
          [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], 
          true
        );
        let normalizedTensorFrame = resizedTensorFrame.div(255);
        
        if (mobileNet == null) {
          // Return a dummy tensor to satisfy the type requirement
          return tf.zeros([MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3]);
        }
        let tens = mobileNet.predict(normalizedTensorFrame.expandDims()) as tf.Tensor;
        return tens.squeeze();
      });

      if (imageFeatures) {
        trainingDataInputs.push(imageFeatures);
        trainingDataOutputs.push(classNumber);
        console.log(`Gathered data for class ${classNumber}. Total samples: ${trainingDataInputs.length}`);
      }
    } catch (error) {
      console.error("Error gathering data:", error);
    }
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
      
      <button className="dataCollector" data-1hot="0" data-name="Class 1" onClick={async () => await gatherDataForClass("0")}>Gather Class 1 Data</button>
      <button className="dataCollector" data-1hot="1" data-name="Class 2" onClick={async () => await gatherDataForClass("1")}>Gather Class 2 Data</button>
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
