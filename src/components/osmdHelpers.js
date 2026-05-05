/**
 * osmdHelpers.js
 * MXL(ZIP) 파일에서 MusicXML 문자열 추출
 *
 * MXL은 ZIP 포맷이며 내부에 score.xml (또는 다른 이름의 XML)이 있음.
 * META-INF/container.xml에서 실제 XML 파일명을 찾아서 추출.
 */

/**
 * ArrayBuffer(MXL) → MusicXML 문자열
 */
export async function extractXmlFromMxl(buffer) {
  const bytes = new Uint8Array(buffer);
  const files = await parseZip(bytes);

  // 1) container.xml에서 rootfile 경로 찾기
  let xmlPath = null;
  const containerEntry = files.find(
    (f) => f.name === "META-INF/container.xml"
  );
  if (containerEntry) {
    const containerXml = new TextDecoder("utf-8").decode(containerEntry.data);
    const match = containerXml.match(/full-path="([^"]+)"/);
    if (match) xmlPath = match[1];
  }

  // 2) rootfile 경로로 XML 찾기, 없으면 .xml 확장자로 탐색
  let xmlEntry = xmlPath ? files.find((f) => f.name === xmlPath) : null;

  if (!xmlEntry) {
    xmlEntry = files.find(
      (f) => f.name.endsWith(".xml") && !f.name.includes("META-INF")
    );
  }

  if (!xmlEntry) {
    throw new Error("MXL 내부에서 MusicXML 파일을 찾을 수 없습니다");
  }

  return new TextDecoder("utf-8").decode(xmlEntry.data);
}

/**
 * 간단한 ZIP 파서 — Local File Header만 읽음
 */
async function parseZip(bytes) {
  const files = [];
  let offset = 0;

  while (offset < bytes.length - 4) {
    // Local File Header signature: 0x04034b50
    if (
      bytes[offset] !== 0x50 ||
      bytes[offset + 1] !== 0x4b ||
      bytes[offset + 2] !== 0x03 ||
      bytes[offset + 3] !== 0x04
    ) {
      break;
    }

    const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
    const compressedSize =
      bytes[offset + 18] |
      (bytes[offset + 19] << 8) |
      (bytes[offset + 20] << 16) |
      (bytes[offset + 21] << 24);
    const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);

    const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const rawData = bytes.slice(dataStart, dataStart + compressedSize);

    let data;
    if (compressionMethod === 0) {
      // stored (무압축)
      data = rawData;
    } else if (compressionMethod === 8) {
      // deflate
      data = await inflateRaw(rawData);
    } else {
      data = rawData;
    }

    files.push({ name, data });
    offset = dataStart + compressedSize;
  }

  return files;
}

/**
 * Raw Deflate inflate — DecompressionStream API 사용
 */
async function inflateRaw(compressed) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "이 브라우저는 DecompressionStream을 지원하지 않습니다. Chrome 80+ 또는 Edge 80+ 필요"
    );
  }

  const ds = new DecompressionStream("raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  // compressed가 slice로 만들어진 Uint8Array일 수 있으므로 새 버퍼로 복사
  const input = new Uint8Array(compressed);
  writer.write(input);
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}
