export function base64ToUint8Array(base64) {
  const data = base64.split(',')[1]; // Remove the data URL prefix if present

  const binaryString = atob(data); // Decode the Base64 string to a binary string
  const length = binaryString.length;
  const bytes = new Uint8Array(length); // Create a Uint8Array of the appropriate size

  // Populate the Uint8Array with byte values from the binary string
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}