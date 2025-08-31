import tensorflow as tf
from efficientnet import tfkeras as efficientnet
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB4
import os

# Disable warnings
os.environ['TF_XLA_FLAGS'] = '--tf_xla_enable_xla_devices=false'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# GPU Setup
gpus = tf.config.list_physical_devices('GPU')
if gpus:
  # Restrict TensorFlow to only allocate 4GB of memory on the first GPU - https://www.tensorflow.org/guide/gpu
  try:
    tf.config.set_logical_device_configuration(
        gpus[0],
        [tf.config.LogicalDeviceConfiguration(memory_limit=5120)])
    logical_gpus = tf.config.list_logical_devices('GPU')
    print(len(gpus), "Physical GPUs,", len(logical_gpus), "Logical GPUs")
  except RuntimeError as e:
    # Virtual devices must be set before GPUs have been initialized
    print(e)

# Parameters
IMAGE_SIZE = (256, 256)
NUM_CLASSES = len(os.listdir('./output'))
BIFPN_CHANNELS = 160
BIFPN_LAYERS = 3
BATCH_SIZE = 2
MAX_DETECTIONS = 25 # from efficientdet

# Load EfficientNetB4 backbone
base_model = efficientnet.EfficientNetB0(
    weights='noisy-student',
    include_top=False,
    pooling='avg',
    input_shape=(256, 256, 3)
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

# Use only the last fused feature map (D4)
last_feature = fused[-1]

# Add a pooling layer before the detection head
pooled_feature = layers.GlobalAveragePooling2D()(last_feature)
pooled_feature = layers.Reshape((1, 1, BIFPN_CHANNELS))(pooled_feature)

def detection_head_single(feature, num_classes, max_detections):
    x = layers.Conv2D(64, 3, padding='same', activation='relu')(feature)
    x = layers.Conv2D(64, 3, padding='same', activation='relu')(x)
    # Output shape: (batch_size, 1, 1, max_detections * 4) for boxes
    box_out = layers.Conv2D(max_detections * 4, 1, activation='linear')(x)
    box_out = layers.Reshape((max_detections, 4))(box_out)
    # Output shape: (batch_size, 1, 1, max_detections * num_classes) for class logits
    class_logits = layers.Conv2D(max_detections * num_classes, 1, activation='linear')(x)
    class_logits = layers.Reshape((max_detections, num_classes))(class_logits)
    scores = layers.Lambda(lambda t: tf.reduce_max(tf.nn.sigmoid(t), axis=-1))(class_logits)
    classes = class_logits
    num_detections = layers.Lambda(lambda t: tf.fill([tf.shape(t)[0], 1], max_detections))(box_out)
    return box_out, classes, scores, num_detections

detection_boxes, detection_classes, detection_scores, num_detections = detection_head_single(
    pooled_feature, NUM_CLASSES, MAX_DETECTIONS
)

# Build model with formatted outputs
model = tf.keras.Model(inputs=inputs, outputs=[
    detection_boxes,
    detection_classes,
    detection_scores,
    num_detections
])

model.compile(
    optimizer='adam',
    loss=[
        tf.keras.losses.MeanSquaredError(),
        tf.keras.losses.SparseCategoricalCrossentropy(from_logits=False),
        tf.keras.losses.MeanSquaredError(),
        tf.keras.losses.MeanSquaredError()
    ],
    metrics=[
        'mse',
        'accuracy',
        'mse',
        'mse'
    ]
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
    # Dummy boxes: (batch_size, MAX_DETECTIONS, 4)
    dummy_boxes = tf.ones((batch_size, MAX_DETECTIONS, 4), dtype=tf.float32)
    # Classes: (batch_size, MAX_DETECTIONS)
    class_indices = tf.argmax(label, axis=-1, output_type=tf.int32)
    detection_classes = tf.tile(tf.expand_dims(class_indices, axis=-1), [1, MAX_DETECTIONS])
    detection_classes = tf.cast(detection_classes, tf.float32)
    # Scores: (batch_size, MAX_DETECTIONS)
    detection_scores = tf.ones((batch_size, MAX_DETECTIONS), dtype=tf.float32)
    # Num detections: (batch_size, 1)
    num_detections = tf.fill([batch_size, 1], tf.cast(MAX_DETECTIONS, tf.float32))
    # Return as tuple matching model outputs
    targets = (
        dummy_boxes,
        detection_classes,
        detection_scores,
        num_detections
    )
    return image, targets

dataset = dataset.map(preprocess).map(add_dummy_boxes)

model.summary()

# Train model
model.fit(dataset, epochs=20)

# Save the model
model.export("effdet_like_model")
converter = tf.lite.TFLiteConverter.from_saved_model("effdet_like_model")
converter.optimizations = [tf.lite.Optimize.DEFAULT] 
tflite_model = converter.convert()
with open("effdet_like_model.tflite", "wb") as f:
    f.write(tflite_model)