/**
 * Checklists DB 쿼리 헬퍼
 */
import { getDB } from './database';
import { ChecklistItem, ChecklistCategory } from '@/types';

function rowToChecklist(r: any): ChecklistItem {
  return {
    id: r.id,
    tripId: r.trip_id,
    title: r.title,
    category: r.category as ChecklistCategory,
    isChecked: !!r.is_checked,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

export async function getChecklist(tripId: number): Promise<ChecklistItem[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM checklists WHERE trip_id = ?
     ORDER BY is_checked ASC, sort_order ASC, id ASC`,
    [tripId]
  );
  return rows.map(rowToChecklist);
}

export async function createChecklistItem(data: Partial<ChecklistItem>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO checklists (trip_id, title, category, is_checked, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.tripId!,
      data.title ?? '',
      data.category ?? 'general',
      data.isChecked ? 1 : 0,
      data.sortOrder ?? 0,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function toggleChecklistItem(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE checklists SET is_checked = NOT is_checked WHERE id = ?', [id]);
}

export async function deleteChecklistItem(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM checklists WHERE id = ?', [id]);
}

export async function updateChecklistItem(id: number, data: Partial<ChecklistItem>): Promise<void> {
  const db = await getDB();
  const fields: string[] = [];
  const values: any[] = [];

  if ('title' in data) { fields.push('title = ?'); values.push(data.title); }
  if ('category' in data) { fields.push('category = ?'); values.push(data.category); }
  if ('isChecked' in data) { fields.push('is_checked = ?'); values.push(data.isChecked ? 1 : 0); }
  if ('sortOrder' in data) { fields.push('sort_order = ?'); values.push(data.sortOrder); }
  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE checklists SET ${fields.join(', ')} WHERE id = ?`, values);
}

/**
 * 기본 체크리스트 템플릿 (여행 시작할 때 일괄 추가 가능)
 */
export const DEFAULT_CHECKLIST_TEMPLATES: { category: ChecklistCategory; items: string[] }[] = [
  {
    category: 'document',
    items: ['여권', '여권 사본', '항공권', '비자 (필요시)', '여행자 보험증서', '숙소 예약 확인서'],
  },
  {
    category: 'electronics',
    items: ['휴대폰 충전기', '보조 배터리', '멀티 어댑터', '이어폰', '카메라', '셀카봉'],
  },
  {
    category: 'clothing',
    items: ['속옷', '양말', '잠옷', '겉옷', '수영복 (해변)', '운동화', '샌들/슬리퍼'],
  },
  {
    category: 'toiletries',
    items: ['칫솔/치약', '샴푸/컨디셔너', '바디워시', '선크림', '화장품', '수건'],
  },
  {
    category: 'medicine',
    items: ['상비약 (해열제/진통제)', '소화제', '감기약', '밴드/반창고', '개인 복용약'],
  },
  {
    category: 'general',
    items: ['현금', '신용카드', '지갑', '여분 가방', '우산/우비', '물병'],
  },
];

export async function addTemplateItems(tripId: number, category: ChecklistCategory): Promise<void> {
  const template = DEFAULT_CHECKLIST_TEMPLATES.find((t) => t.category === category);
  if (!template) return;
  const db = await getDB();
  const now = new Date().toISOString();
  for (let i = 0; i < template.items.length; i++) {
    await db.runAsync(
      `INSERT INTO checklists (trip_id, title, category, is_checked, sort_order, created_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [tripId, template.items[i], category, i, now]
    );
  }
}
