export interface AuthorizationObject {
  tenant?: string;
  token: string;
  idempotencyKey?: string;
}

export const encodeAuthorization = (
  authObj: AuthorizationObject,
): string => {
  const jsonString = JSON.stringify(authObj);

  // Node.js environment
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(jsonString, 'utf-8').toString('base64');
  }
  // Modern browser environment
  else if (typeof btoa === 'function' && typeof TextEncoder === 'function') {
    const encoder = new TextEncoder(); // UTF-8 by default
    const data = encoder.encode(jsonString);
    // Convert Uint8Array to binary string for btoa
    let binaryString = '';
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]);
    }
    return btoa(binaryString);
  }
  // Fallback or error if no supported method found
  else {
    throw new Error('Base64 encoding not supported in this environment.');
  }
};

export const decodeAuthorization = (
  encodedString: string,
): AuthorizationObject => {
  let jsonString: string;

  // Node.js environment
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    jsonString = Buffer.from(encodedString, 'base64').toString('utf-8');
  }
  // Modern browser environment
  else if (typeof atob === 'function' && typeof TextDecoder === 'function') {
    const binaryString = atob(encodedString);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder(); // UTF-8 by default
    jsonString = decoder.decode(bytes);
  }
  // Fallback or error if no supported method found
  else {
    throw new Error('Base64 decoding not supported in this environment.');
  }

  return JSON.parse(jsonString) as AuthorizationObject;
};