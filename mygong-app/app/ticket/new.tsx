import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { TicketFormView } from './[id]';
import { createTicket } from '@/db/tickets';
import { getAllArtists } from '@/db/artists';
import { iconForCategory } from '@/db/schema';
import type { Ticket, Artist } from '@/types';

export default function NewTicket() {
  const router = useRouter();
  // 초기값: 카테고리만 기본값. 날짜는 비워둠 → 사진 OCR 또는 사용자가 직접 입력
  const [form, setForm] = useState<Partial<Ticket>>({
    category: '콘서트',
    rating: 0,
  });
  const [artists, setArtists] = useState<Artist[]>([]);

  useFocusEffect(useCallback(() => { getAllArtists('all').then(setArtists); }, []));

  const save = async () => {
    if (!form.title?.trim()) { Alert.alert('제목이 비어있어요'); return; }
    if (!form.date) { Alert.alert('날짜를 입력하세요'); return; }
    const id = await createTicket({
      ...form,
      catIcon: iconForCategory(form.category),
      month: form.date?.slice(0, 7),
    });
    router.replace(`/ticket/${id}`);
  };

  return (
    <TicketFormView
      title="다녀온 공연 추가"
      form={form}
      setForm={setForm}
      artists={artists}
      onCancel={() => router.back()}
      onSave={save}
    />
  );
}
