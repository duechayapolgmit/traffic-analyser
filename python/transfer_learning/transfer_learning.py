import tensorflow as tf
from efficientnet import tfkeras as efficientnet
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB4
import os

# Disable warnings
os.environ['TF_XLA_FLAGS'] = '--tf_xla_enable_xla_devices=false'

# GPU Setup
gpus = tf.config.list_physical_devices('GPU')
if gpus:
  # Restrict TensorFlow to only allocate 4GB of memory on the first GPU - https://www.tensorflow.org/guide/gpu
  try:
    tf.config.set_logical_device_configuration(
        gpus[0],
        [tf.config.LogicalDeviceConfiguration(memory_limit=4096)])
    logical_gpus = tf.config.list_logical_devices('GPU')
    print(len(gpus), "Physical GPUs,", len(logical_gpus), "Logical GPUs")
  except RuntimeError as e:
    # Virtual devices must be set before GPUs have been initialized
    print(e)

# Parameters
IMAGE_SIZE = (512, 512)
NUM_CLASSES = len(os.listdir('./output'))
BIFPN_CHANNELS = 160
BIFPN_LAYERS = 3
BATCH_SIZE = 8

# Load EfficientNetB4 backbone
base_model = efficientnet.EfficientNetB4(
    weights='noisy-student',
    include_top=False,
    pooling='avg',
    input_shape=(512, 512, 3)
)
inputs = base_model.input

# Extract multi-scale features
P3 = base_model.get_layer('block3a_expand_activation').output
P4 = base_model.get_layer('block5a_expand_activation').output
P5 = base_model.get_layer('block7a_project_bn').output

# Add P6 and P7 layers
P6 = layers.Conv2D(BIFPN_CHANNELS, 3, strides=2, padding='same')(P5)
P7 = layers.Conv2D(BIFPN_CHANNELS, 3, strides=2, padding='same')(P6)

features = [P3, P4, P5, P6, P7]

# BiFPN block
def simple_bifpn(features, out_channels=BIFPN_CHANNELS):
    fused = []
    for f in features:
        f = layers.Conv2D(out_channels, 1, padding='same')(f)
        fused.append(f)
    # Simple fusion: sum all upsampled to P3 size
    target_h, target_w = fused[0].shape[1], fused[0].shape[2]
    upsampled = [layers.Resizing(target_h, target_w)(f) for f in fused]
    fused_output = layers.Add()(upsampled)
    return fused_output

# Stack BiFPN layers
fused = features
for _ in range(BIFPN_LAYERS):
    fused = [simple_bifpn(fused)]

# Detection head
def detection_head(features, num_classes):
    class_outputs = []
    box_outputs = []
    feat_count = 0
    for feat in features:
        x = layers.Conv2D(64, 3, padding='same', activation='relu')(feat)
        x = layers.Conv2D(64, 3, padding='same', activation='relu')(x)
        class_out = layers.Conv2D(num_classes, 1, activation='sigmoid')(x)
        box_out = layers.Dense(4, name=f'box_output_{feat_count}')(x)
        class_outputs.append(class_out)
        box_outputs.append(box_out)
        feat_count += 1
    return class_outputs, box_outputs

class_outs, box_outs = detection_head(fused, NUM_CLASSES)

# Merge outputs
class_out = layers.Concatenate(axis=1, name='class_output')(class_outs)
box_out = layers.Concatenate(axis=1, name='box_output')(box_outs)

# Build model
model = tf.keras.Model(inputs=inputs, outputs={
    'class_output': class_out,
    'box_output': box_out
})

# Compile model
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

# Load dataset from folder
dataset = tf.keras.utils.image_dataset_from_directory(
    "output",
    labels="inferred",
    label_mode="categorical",
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    shuffle=True
)

# Normalize and add dummy boxes
def preprocess(image, label):
    image = tf.cast(image, tf.float32) / 255.0
    return image, label

def add_dummy_boxes(image, label):
    batch_size = tf.shape(image)[0]
    dummy_boxes = tf.ones([batch_size, class_out.shape[1], class_out.shape[2], 4])
    class_map = tf.repeat(tf.expand_dims(label, axis=1), repeats=class_out.shape[1], axis=1)
    class_map = tf.repeat(tf.expand_dims(class_map, axis=2), repeats=class_out.shape[2], axis=2)
    return image, {'class_output': class_map, 'box_output': dummy_boxes}

dataset = dataset.map(preprocess).map(add_dummy_boxes)

# Train model
model.fit(dataset, epochs=10)

# Save the model
model.export("effdet_like_model")
converter = tf.lite.TFLiteConverter.from_saved_model("effdet_like_model")
converter.optimizations = [tf.lite.Optimize.DEFAULT]  # Optional: enables size/performance optimization
tflite_model = converter.convert()
with open("effdet_like_model.tflite", "wb") as f:
    f.write(tflite_model)