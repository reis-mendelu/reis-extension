import type { Tutorial, TutorialSummary, SlideLayout } from './types';
import { supabase } from '../spolky/supabaseClient';
import { MOCK_TUTORIALS } from './mockData';

const USE_MOCK_DATA = false;

interface SupabaseSlide {
    id: string; tutorial_id: string; order: number; layout: string;
    left_icon?: string; left_title?: string; left_content?: string; left_image_url?: string;
    right_icon?: string; right_title?: string; right_content?: string; right_image_url?: string;
}

const mapSlide = (s: SupabaseSlide) => ({
    id: s.id, tutorialId: s.tutorial_id, order: s.order, layout: s.layout as SlideLayout,
    leftIcon: s.left_icon, leftTitle: s.left_title, leftContent: s.left_content, leftImageUrl: s.left_image_url,
    rightIcon: s.right_icon, rightTitle: s.right_title, rightContent: s.right_content, rightImageUrl: s.right_image_url
});

export async function fetchTutorials(associationIds: string[]): Promise<Tutorial[]> {
  if (USE_MOCK_DATA) return MOCK_TUTORIALS.filter(t => t.isPublished && associationIds.includes(t.associationId));
  try {
    const { data: ts, error: te } = await supabase.from('tutorials').select('*').eq('is_published', true).in('association_id', associationIds).order('created_at', { ascending: false });
    if (te || !ts?.length) return [];
    const { data: ss, error: se } = await supabase.from('tutorial_slides').select('*').in('tutorial_id', ts.map(t => t.id)).order('order', { ascending: true });
    if (se) return [];
    return ts.map(t => ({
      id: t.id, associationId: t.association_id, title: t.title, description: t.description, isPublished: t.is_published,
      createdBy: t.created_by, createdAt: t.created_at, updatedAt: t.updated_at,
      slides: (ss || []).filter(s => s.tutorial_id === t.id).map(mapSlide)
    }));
  } catch (e) { console.error(e); return []; }
}

export async function fetchTutorialSummaries(associationIds: string[]): Promise<TutorialSummary[]> {
  if (USE_MOCK_DATA) return MOCK_TUTORIALS.filter(t => t.isPublished && associationIds.includes(t.associationId)).map(t => ({ id: t.id, associationId: t.associationId, title: t.title, description: t.description, slideCount: t.slides.length }));
  try {
    const { data, error } = await supabase.from('tutorials').select('id, association_id, title, description').eq('is_published', true).in('association_id', associationIds).order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(t => ({ id: t.id, associationId: t.association_id, title: t.title, description: t.description, slideCount: 0 }));
  } catch (e) { console.error(e); return []; }
}

export async function fetchTutorialById(id: string): Promise<Tutorial | null> {
  if (USE_MOCK_DATA) return MOCK_TUTORIALS.find(t => t.id === id) || null;
  try {
    const { data: t, error: te } = await supabase.from('tutorials').select('*').eq('id', id).single();
    if (te || !t) return null;
    const { data: ss, error: se } = await supabase.from('tutorial_slides').select('*').eq('tutorial_id', id).order('order', { ascending: true });
    if (se) return null;
    return { id: t.id, associationId: t.association_id, title: t.title, description: t.description, isPublished: t.is_published, createdBy: t.created_by, createdAt: t.created_at, updatedAt: t.updated_at, slides: (ss || []).map(mapSlide) };
  } catch (e) { console.error(e); return null; }
}
