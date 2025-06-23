import React from "react";
import { Text, View } from "react-native";

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

export default class Index extends React.Component {
  // Props
  constructor(props: {}) {
    super(props);
    this.state = {
      isTfReady: false,
    };
  }

  async componentDidMount() {
    await tf.ready();
    this.setState({ isTfReady: true });
    console.log("TensorFlow.js is ready");
  }

  render() {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text>Edit app/index.tsx to edit this screen.</Text>
      </View>
    );
  }
  
}
