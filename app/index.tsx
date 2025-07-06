import React from "react";
import { Button, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CameraView, useCameraPermissions } from "expo-camera";

import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';

import * as util from '../scripts/util';

const MOBILENET_MODEL_PATH = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1';
const IMAGE_SIZE = 224;
const TOPK_PREDICTIONS = 5;

export default function Index() {
  // Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // States
  const [isTfReady, setIsTfReady] = React.useState(false);
  const [mobileNet, setMobileNet] = React.useState<tf.GraphModel | null>(null)
  const [predsView, setPredictions] = React.useState<any[]>([]);
  const [predictActive, setPredActive] = React.useState<boolean>(true);

  // Refs
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
        console.log("MobileNet is ready.")
        setPredActive(false);
      });
      requestPermission();
    };

    prepare();
  }, []);

  async function predictImg(){
    const predsView = (
      <View key={"waiting"}>
        <Text>Awaiting results.</Text>
      </View>
    )
    setPredictions([predsView])

    // Take a picture from the camera and process it
    if (camera.current == null) {
      console.log("Camera is not ready.");
      return;
    }
    const image = await camera.current.takePictureAsync({base64: true, skipProcessing: true});

    // Convert to Tensor-able image
    let imgTensor: any;
    if (Platform.OS === 'web') { // Web = use HTML Image
      const imgData = new Image();
      imgData.src = `${image.base64}`;
      await new Promise((resolve) => { // resolve the promise first
        imgData.onload = resolve;
      });

      imgTensor = tf.browser.fromPixels(imgData);
    } else { // Mobile = encoding magic
      if (image.base64 == null) { // Error handling
        console.warn("Image base64 is null. Ensure the camera is working correctly.");
        return;
      };
      const imgBuffer = tf.util.encodeString(image.base64, 'base64').buffer;                  
      const raw = new Uint8Array(imgBuffer);
      imgTensor = decodeJpeg(raw); // Decode the JPEG
    }

    const tensor = tf.tidy(() => {
        const resized = tf.image.resizeBilinear(imgTensor, [224, 224]);
        const normalized = resized.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
        return normalized.expandDims(0);
    });

    // Predictions
    if (mobileNet == null) {
      console.warn("MobileNet model is not loaded.");
      return;
    }
    const logits = mobileNet.predict(tensor) as tf.Tensor;
    const classes = await util.getTopKClasses(logits, TOPK_PREDICTIONS);

    showResults(classes);

    logits.dispose();
    tensor.dispose();
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
        <CameraView style={styles.camera} ref={camera} videoQuality="4:3"/>
        <Button title="Predict!" onPress={predictImg} disabled={predictActive}/>

        <View>
          {predsView}
        </View>
      </ScrollView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  camera: {  
    width: 640,
    height: 480},
  predictions: {
    width: '50%'},
})
