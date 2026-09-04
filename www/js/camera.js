// camera.js — Capacitor camera with input[type=file] fallback
// Returns: { dataUrl, base64, mediaType } | null

let _capacitorCamera = null;

async function getCapacitorCamera() {
  if (_capacitorCamera !== null) return _capacitorCamera;
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
      _capacitorCamera = window.Capacitor.Plugins.Camera;
      return _capacitorCamera;
    }
  } catch {}
  _capacitorCamera = false;
  return false;
}

async function fromCapacitor(source) {
  const cap = await getCapacitorCamera();
  if (!cap) return null;
  try {
    const photo = await cap.getPhoto({
      resultType: 'base64',
      source,
      quality: 85,
      allowEditing: false,
    });
    const base64 = photo.base64String;
    const mediaType = `image/${photo.format || 'jpeg'}`;
    return { base64, mediaType, dataUrl: `data:${mediaType};base64,${base64}` };
  } catch (e) {
    if (e && (e.message || '').toLowerCase().includes('cancel')) return null;
    throw e;
  }
}

function fromInput(capture) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const [meta, b64] = dataUrl.split(',');
        const mediaType = meta.match(/data:(.*?);/)[1] || 'image/jpeg';
        resolve({ dataUrl, base64: b64, mediaType });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function captureFromCamera() {
  const cap = await getCapacitorCamera();
  if (cap) return fromCapacitor('CAMERA');
  return fromInput(true);
}

export async function pickFromGallery() {
  const cap = await getCapacitorCamera();
  if (cap) return fromCapacitor('PHOTOS');
  return fromInput(false);
}

export async function downscaleImage(dataUrl, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const out = canvas.toDataURL('image/jpeg', 0.85);
      const [meta, b64] = out.split(',');
      resolve({ dataUrl: out, base64: b64, mediaType: 'image/jpeg' });
    };
    img.src = dataUrl;
  });
}
