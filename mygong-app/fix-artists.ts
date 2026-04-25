import { getDB } from './src/db/database';

(async () => {
  const db = await getDB();
  
  await db.runAsync("UPDATE artists SET name = 'HYNN' WHERE external_id = 'wiki:2576396'");
  await db.runAsync("UPDATE artists SET name = '권진아' WHERE external_id = 'wiki:1057862'");
  await db.runAsync("UPDATE artists SET name = 'Aespa' WHERE external_id = 'wiki:2866656'");
  await db.runAsync("UPDATE artists SET name = '4월은 너의 거짓말' WHERE external_id = 'wiki:1162861'");
  
  console.log('✅ 수정 완료!');
})();
