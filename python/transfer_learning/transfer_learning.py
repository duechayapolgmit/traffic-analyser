# Step 0: Disable verbose msgs
import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models
from efficientnet import tfkeras as efficientnet

# BiFPN
def simple_bifpn(features, out_channels=160):
    P3, P4, P5 = features

    # Align channel dimensions
    P3 = layers.Conv2D(out_channels, kernel_size=1, padding='same')(P3)
    P4 = layers.Conv2D(out_channels, kernel_size=1, padding='same')(P4)
    P5 = layers.Conv2D(out_channels, kernel_size=1, padding='same')(P5)

    # Upsample P5 to match P4
    P5_up = layers.Resizing(height=P4.shape[1], width=P4.shape[2], interpolation='nearest')(P5)
    P4_fused = layers.Add()([P4, P5_up])

    # Upsample P4_fused to match P3
    P4_up = layers.Resizing(height=P3.shape[1], width=P3.shape[2], interpolation='nearest')(P4_fused)
    P3_fused = layers.Add()([P3, P4_up])

    return P3_fused

# Detection head
def detection_head(fused_features, num_classes):
    x = layers.Conv2D(64, 3, padding='same', activation='relu')(fused_features)
    x = layers.Conv2D(64, 3, padding='same', activation='relu')(x)

    # Class scores
    class_output = layers.Conv2D(num_classes, 1, activation='sigmoid', name='class_output')(x)

    # Bounding boxes: [x, y, w, h]
    box_output = layers.Conv2D(4, 1, name='box_output')(x)

    return class_output, box_output

# Step 1: Define input
inputs = tf.keras.Input(shape=(512, 512, 3))

# Step 2: Load EfficientNetB4
base_model = efficientnet.EfficientNetB4(
    weights='noisy-student',
    include_top=False,
    input_shape=(512, 512, 3)
)

# Step 3: Extract multi-scale features dynamically
P3 = base_model.get_layer('block3a_expand_activation').output
P4 = base_model.get_layer('block5a_expand_activation').output
P5 = base_model.get_layer('block7a_project_bn').output

# Create a new model to extract features from inputs
feature_extractor = tf.keras.Model(inputs=base_model.input, outputs=[P3, P4, P5]) 
features = feature_extractor(inputs) # Apply feature extractor to input tensor

# Step 4: BiFPN
fused = simple_bifpn(features)

# Step 5: Detection head
class_out, box_out = detection_head(fused, num_classes=10)

# Step 6: Build full model
model = tf.keras.Model(inputs=inputs, outputs={
    'class_output': class_out,
    'box_output': box_out
})

model.compile(
    optimizer='adam',
    loss={
        'class_output': tf.keras.losses.BinaryCrossentropy(),
        'box_output': tf.keras.losses.MeanSquaredError()
    },
    metrics={
        'class_output': 'accuracy',
        'box_output': 'mse'
    }
)

# Dummy example
images = tf.random.uniform([10, 512, 512, 3], minval=0, maxval=255, dtype=tf.float32)
class_labels = tf.random.uniform([10, 128, 128, 10], maxval=2, dtype=tf.int32)
box_labels = tf.random.uniform([10, 128, 128, 4], minval=0, maxval=1, dtype=tf.float32)

model.fit(
    x=images,
    y={'class_output': class_labels, 'box_output': box_labels},
    batch_size=4,
    epochs=10
)
