// Read only ONNX graph signatures and metadata. Tensor bytes remain zero-copy views.
// No model code, Python literals or metadata strings are ever evaluated.
const decoder = new TextDecoder();

function *fields(bytes) {
  let p = 0;
  const varint = () => {
    let value = 0, multiplier = 1;
    for (let count = 0; count < 10; count++) {
      if (p >= bytes.length) throw new Error('ONNX protobuf is truncated.');
      const byte = bytes[p++];
      value += (byte & 127) * multiplier;
      if (!(byte & 128)) return value;
      multiplier *= 128;
    }
    throw new Error('Invalid ONNX protobuf integer.');
  };
  while (p < bytes.length) {
    const tag = varint(), number = Math.floor(tag / 8), wire = tag & 7;
    if (!number) throw new Error('Invalid ONNX protobuf field.');
    if (wire === 0) yield {number, wire, value:varint()};
    else if (wire === 2) {
      const length = varint(), end = p + length;
      if (!Number.isSafeInteger(end) || end > bytes.length) throw new Error('ONNX protobuf is truncated.');
      yield {number, wire, value:bytes.subarray(p, end)};
      p = end;
    } else if (wire === 1 || wire === 5) {
      p += wire === 1 ? 8 : 4;
      if (p > bytes.length) throw new Error('ONNX protobuf is truncated.');
    } else throw new Error('Unsupported ONNX protobuf wire type.');
  }
}

function stringEntry(bytes) {
  let key = '', value = '';
  for (const field of fields(bytes)) {
    if (field.number === 1) key = decoder.decode(field.value);
    if (field.number === 2) value = decoder.decode(field.value);
  }
  return [key, value];
}

function signature(bytes) {
  const result = {name:'',dims:[],elemType:null};
  for (const field of fields(bytes)) {
    if (field.number === 1) result.name = decoder.decode(field.value);
    if (field.number !== 2) continue;
    for (const type of fields(field.value)) {
      if (type.number !== 1) continue; // tensor_type
      for (const tensor of fields(type.value)) {
        if (tensor.number === 1) result.elemType = tensor.value;
        if (tensor.number !== 2) continue;
        for (const shape of fields(tensor.value)) {
          if (shape.number !== 1) continue;
          let dimension = null;
          for (const dim of fields(shape.value)) {
            if (dim.number === 1) dimension = dim.value;
            if (dim.number === 2) dimension = decoder.decode(dim.value);
          }
          result.dims.push(dimension);
        }
      }
    }
  }
  return result;
}

export function parseLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'object') return Object.keys(value).sort((a,b)=>+a-+b).map(key=>String(value[key]));
  try { return parseLabels(JSON.parse(value)); } catch { /* Ultralytics stores a Python dict. */ }
  const labels = [];
  const entry = /(?:^|[{,])\s*(\d+)\s*:\s*(['"])((?:\\.|(?!\2).)*)\2\s*(?=,|})/g;
  for (const match of value.matchAll(entry)) {
    labels[Number(match[1])] = match[3].replace(/\\(['"\\])/g, '$1');
  }
  return labels.length && Array.from({length:labels.length},(_,i)=>labels[i]).every(x=>typeof x==='string') ? labels : [];
}

export function inspectOnnx(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 16) throw new Error('The file is too small to contain an ONNX model.');
  const result = {inputs:[],outputs:[],metadata:{},externalData:[],producer:''};
  let graphFound = false;
  const initializerNames = new Set();
  for (const field of fields(bytes)) {
    if (field.number === 2) result.producer = decoder.decode(field.value);
    if (field.number === 14) {
      const [key,value] = stringEntry(field.value);
      result.metadata[key] = value;
    }
    if (field.number !== 7) continue;
    graphFound = true;
    for (const graph of fields(field.value)) {
      if (graph.number === 11) result.inputs.push(signature(graph.value));
      if (graph.number === 12) result.outputs.push(signature(graph.value));
      if (graph.number !== 5) continue; // initializer
      let external = false, location = '';
      for (const tensor of fields(graph.value)) {
        if (tensor.number === 8) initializerNames.add(decoder.decode(tensor.value));
        if (tensor.number === 14 && tensor.value === 1) external = true;
        if (tensor.number === 13) {
          const [key,value] = stringEntry(tensor.value);
          if (key === 'location') location = value;
        }
      }
      if (external || location) result.externalData.push(location || '(unnamed external tensor)');
    }
  }
  result.inputs = result.inputs.filter(x=>!initializerNames.has(x.name));
  if (!graphFound || !result.inputs.length || !result.outputs.length) throw new Error('No ONNX graph input/output signature was found.');
  result.labels = parseLabels(result.metadata.names);
  return result;
}
