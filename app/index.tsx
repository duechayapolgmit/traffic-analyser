import React from "react";
import { View } from "react-native";

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

import * as ml from '../scripts/ml';

export default class Index extends React.Component {
  // References and constants
  status: React.RefObject<HTMLParagraphElement | null>;
  video: React.RefObject<HTMLVideoElement | null>;

  // Props handling
  constructor(props: {}) {
    super(props);
    this.state = {
      isTfReady: false,
    };

    // References
    this.status = React.createRef();
    this.video = React.createRef();
  }

  async componentDidMount() {
    await tf.ready();
    this.setState({ isTfReady: true });
    console.log("TensorFlow.js is ready");

    // Loading the MobileNet feature model
    ml.loadMobileNetFeatureModel().then((res) => {
      if (this.status.current == null) return;
      this.status.current.innerText = res;
    }).catch((err) => {
      console.error("Error loading MobileNet feature model:", err);
    });
  }
  
  enableCam() { // TODO
  }

  trainAndPredict() { // TODO
  }

  gatherDataForClass(dataClass : string) { // TODO
  }

  reset(){ // TODO
  }

  // TODO: Mouseover = TouchEnter
  render() {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <h1>Make your own "Teachable Machine" using Transfer Learning with MobileNet v3 in TensorFlow.js using saved graph model from TFHub.</h1>
    
        <p ref={this.status} >Awaiting TF.js load</p>
        
        <video ref={this.video} autoPlay muted></video>
        
        <button id="enableCam" onClick={this.enableCam}>Enable Webcam</button>
        <button className="dataCollector" data-1hot="0" data-name="Class 1" onMouseOver={() => this.gatherDataForClass("0")}>Gather Class 1 Data</button>
        <button className="dataCollector" data-1hot="1" data-name="Class 2" onMouseOver={() => this.gatherDataForClass("1")}>Gather Class 2 Data</button>
        <button id="train" onClick={this.trainAndPredict}>Train &amp; Predict!</button>
        <button id="reset" onClick={this.reset}>Reset</button>
      </View>
    );
  }
  
}
