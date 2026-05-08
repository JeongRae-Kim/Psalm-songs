/**
 * extract-bpm.js (ES Module 버전)
 * MIDI 파일에서 BPM을 추출하여 songs.json의 각 곡에 bpm 필드 추가
 *
 * 사용법:
 *   node scripts/extract-bpm.js
 *
 * 동작:
 * 1. public/songs.json 로드
 * 2. 각 곡의 midiFile 경로에서 MIDI 파일 읽기
 * 3. @tonejs/midi로 BPM 추출 (useMidiPlayer와 동일 라이브러리)
 * 4. 각 곡에 bpm 필드 추가 (기존 필드는 보존)
 * 5. songs.json 다시 저장 + 백업 (songs.json.backup)
 *
 * 안전 장치:
 * - 실행 전 songs.json.backup 자동 생성
 * - 추출 실패한 곡은 기존 값 보존 + 경고 출력
 * - 모든 결과를 콘솔에 표 형태로 출력
 *
 * 향후 (Phase 4):
 * - useMxlPlayer가 song.bpm을 직접 사용하면 useMidiPlayer 의존성 제거 가능
 *
 * 참고:
 * - 프로젝트 package.json에 "type": "module" 설정 → ES Module 문법 사용
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

// __dirname 대체 (ES Module에는 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SONGS_JSON_PATH = path.join(PUBLIC_DIR, 'songs.json');
const BACKUP_PATH = path.join(PUBLIC_DIR, 'songs.json.backup');

console.log('=== BPM 추출 스크립트 시작 ===\n');

// 1. songs.json 로드
if (!fs.existsSync(SONGS_JSON_PATH)) {
  console.error(`❌ songs.json을 찾을 수 없음: ${SONGS_JSON_PATH}`);
  process.exit(1);
}

const songsData = fs.readFileSync(SONGS_JSON_PATH, 'utf-8');
let songsRoot;
try {
  songsRoot = JSON.parse(songsData);
} catch (e) {
  console.error(`❌ songs.json 파싱 실패: ${e.message}`);
  process.exit(1);
}

// songs.json 구조: { version, lastUpdated, songs: [...] }
// 곡 배열을 찾아서 songs 변수에 할당
let songs;
if (Array.isArray(songsRoot)) {
  // 배열 형식
  songs = songsRoot;
} else if (Array.isArray(songsRoot.songs)) {
  // 객체 안에 songs 배열 형식 (현재 프로젝트 구조)
  songs = songsRoot.songs;
} else {
  console.error('❌ songs.json에서 곡 배열을 찾을 수 없음');
  console.error('   기대 형식: 배열 [...] 또는 { "songs": [...] }');
  process.exit(1);
}

if (songs.length === 0) {
  console.error('❌ 곡 배열이 비어있음');
  process.exit(1);
}

console.log(`📋 총 ${songs.length}곡 발견\n`);

// 2. 백업 생성
fs.writeFileSync(BACKUP_PATH, songsData, 'utf-8');
console.log(`💾 백업 생성: ${BACKUP_PATH}\n`);

// 3. 각 곡에서 BPM 추출
const results = [];
let successCount = 0;
let failCount = 0;
let skipCount = 0;

for (const song of songs) {
  const id = song.id || '?';
  const title = song.title || '?';

  if (!song.midiFile) {
    results.push({ id, title, status: '⏭️ MIDI 없음', bpm: '-' });
    skipCount++;
    continue;
  }

  // midiFile 경로 처리 (절대/상대 경로 모두 지원)
  let midiPath = song.midiFile;
  if (midiPath.startsWith('/')) {
    midiPath = path.join(PUBLIC_DIR, midiPath.substring(1));
  } else {
    midiPath = path.join(PUBLIC_DIR, midiPath);
  }

  if (!fs.existsSync(midiPath)) {
    results.push({ id, title, status: '❌ 파일 없음', bpm: '-', path: midiPath });
    failCount++;
    continue;
  }

  try {
    const buf = fs.readFileSync(midiPath);
    const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    if (!midi.header.tempos || midi.header.tempos.length === 0) {
      results.push({ id, title, status: '⚠️ tempo 없음', bpm: '-' });
      failCount++;
      continue;
    }

    const bpm = Math.round(midi.header.tempos[0].bpm);

    // 기존 bpm 필드와 비교
    const oldBpm = song.bpm;
    song.bpm = bpm;

    const statusMsg = oldBpm === undefined
      ? '✅ 신규'
      : oldBpm === bpm
        ? '✅ 동일'
        : `🔄 변경 (${oldBpm}→${bpm})`;

    results.push({ id, title, status: statusMsg, bpm });
    successCount++;
  } catch (e) {
    results.push({ id, title, status: `❌ ${e.message}`, bpm: '-' });
    failCount++;
  }
}

// 4. 결과 출력
console.log('=== 추출 결과 ===\n');
console.table(results.map(r => ({
  id: r.id,
  title: r.title.substring(0, 30),
  status: r.status,
  bpm: r.bpm,
})));
console.log('');

console.log(`✅ 성공: ${successCount}곡`);
console.log(`⚠️ 건너뜀: ${skipCount}곡`);
console.log(`❌ 실패: ${failCount}곡`);
console.log('');

// 5. songs.json 저장
if (successCount > 0) {
  // 원래 구조(songsRoot) 보존하여 저장 (version, lastUpdated 등 유지)
  // songs 배열은 이미 in-place로 수정되었음
  const dataToSave = Array.isArray(songsRoot) ? songs : songsRoot;
  const newJson = JSON.stringify(dataToSave, null, 2);
  fs.writeFileSync(SONGS_JSON_PATH, newJson, 'utf-8');
  console.log(`💾 songs.json 저장 완료\n`);
  console.log('다음 단계:');
  console.log('  1. public/songs.json 변경사항 확인 (git diff)');
  console.log('  2. 문제 없으면 commit + push');
  console.log('  3. 문제 있으면 백업 복원: copy songs.json.backup songs.json');
} else {
  console.log('⚠️ 저장하지 않음 (성공 0곡)');
  console.log(`백업 파일: ${BACKUP_PATH}`);
}

console.log('\n=== 완료 ===');
