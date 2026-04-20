import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { FormView } from './[id]';
import { createEvent } from '@/db/events';
import { getAllArtists } from '@/db/artists';
import { iconForCategory } from '@/db/schema';
import type { Event, Artist } from '@/types';

export default function NewEvent() {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Event>>({
    category: '콘서트', date: todayISO(), time: '19:30', notifyEnabled: true,
  });
  const [artists, setArtists] = useState<Artist[]>([]);

  useFocusEffect(useCallback(() => { getAllArtists('all').then(setArtists); }, []));

  const save = async () => {
    if (!form.title?.trim()) { Alert.alert('제목이 비어있어요'); return; }
    if (!form.date) { Alert.alert('날짜를 입력하세요'); return; }
    const id = await createEvent({
      ...form,
      catIcon: iconForCategory(form.category),
      source: 'manual',
    });
    router.replace(`/event/${id}`);
  };

  return (
    <FormView
      title="공연 추가"
      form={form}
      setForm={setForm}
      artists={artists}
      onCancel={() => router.back()}
      onSave={save}
    />
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
