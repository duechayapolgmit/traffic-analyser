// Taken from: https://codelabs.developers.google.com/tensorflowjs-transfer-learning-teachable-machine#7
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

// Constants
const STOP_DATA_GATHER = -1;
const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;

// Variables
let mobilenet = undefined;
let gatherDataState = STOP_DATA_GATHER;
let videoPlaying = false;
let examplesCount = [];
let predict = false;

// Model loading
export async function loadMobileNetFeatureModel() {
  const URL = 
    'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';
  
  mobilenet = await tf.loadGraphModel(URL, {fromTFHub: true});
  
  // Warm up the model by passing zeros through it once.
  tf.tidy(function () {
    let answer = mobilenet.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3]));
  });

  return mobilenet;
}

// Create a new model instance (don't define it at module level)
export function createModel(numClasses) {
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [1024], 
    units: 128, 
    activation: 'relu',
    name: 'dense_layer' // Give it a unique name
  }));
  model.add(tf.layers.dense({
    units: numClasses, 
    activation: numClasses === 2 ? 'sigmoid' : 'softmax',
    name: 'output_layer'
  }));

  model.summary();

  return model;
}

// Get a compiled model
export async function getModel(numClasses) {
  const newModel = await createModel(numClasses);
  newModel.compile({
    optimizer: 'adam',
    loss: numClasses === 2 ? 'binaryCrossentropy' : 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  return newModel;
}

export async function fitModel(mod, inputs, classOutputs, outputs) {
  return await mod.fit(inputs, classOutputs, {shuffle: true, batchSize: 5, epochs: 10, 
      callbacks: {onEpochEnd: logProgress} });
}

function logProgress(epoch, logs) {
    console.log(`Epoch ${epoch}: loss = ${logs.loss}, accuracy = ${logs.acc}`);
}