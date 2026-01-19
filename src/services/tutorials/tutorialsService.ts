/**
 * Tutorials Service
 * 
 * Handles fetching tutorials from Supabase and provides mock data for development.
 */

import type { Tutorial, TutorialSummary } from './types';
import { supabase } from '../spolky/supabaseClient';

// ============================================================================
// Mock Data (for development before Supabase is set up)
// ============================================================================

const MOCK_TUTORIALS: Tutorial[] = [
  {
    id: 'mock-welcome-mendelu',
    associationId: 'supef',
    title: 'Welcome to Mendelu',
    description: 'Essential tips for new PEF students',
    isPublished: true,
    createdBy: 'admin@supef.cz',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    slides: [
      {
        id: 'slide-1',
        tutorialId: 'mock-welcome-mendelu',
        order: 1,
        layout: 'two-column',
        leftIcon: 'hand',
        leftTitle: 'NA ZNAMENÍ = Request stop',
        leftContent: `- It means that the stop is only on request.
- Wave when you see tram / bus arriving.
- To get off press a button for your tram / bus to stop.
- Some stops change to request stops at night or on weekends.`,
        rightIcon: 'ticket',
        rightTitle: 'Tickets',
        rightContent: `**Short term:**
- You can buy them in **machines** at some stops, in **DPMB app** or use **Beep and Go system** (you tap your debit card on the validation machine when you enter the vehicle).
- Paper tickets must be validated in the machine on board.`,
      },
      {
        id: 'slide-2',
        tutorialId: 'mock-welcome-mendelu',
        order: 2,
        layout: 'single',
        leftIcon: 'map-pin',
        leftTitle: 'Campus Locations',
        leftContent: `**Main Buildings:**
- **Budova Q** - Main PEF building, lectures and seminars
- **Knihovna** - University library, open until 10 PM
- **Menza** - Canteen with affordable meals

**Getting Around:**

The campus is walkable. Most buildings are within 5 minutes of each other.`,
      },
      {
        id: 'slide-3',
        tutorialId: 'mock-welcome-mendelu',
        order: 3,
        layout: 'two-column-wide-left',
        leftIcon: 'book-open',
        leftTitle: 'Study Tips',
        leftContent: `**Before the semester:**
- Check your schedule in IS MENDELU
- Register for exams early (they fill up fast!)
- Join study groups on Facebook/Discord

**During the semester:**
- Attend all lectures - professors often hint at exam questions
- Use reIS to track your materials and deadlines`,
        rightIcon: 'calendar',
        rightTitle: 'Key Dates',
        rightContent: `- **Week 1-2:** Course registration
- **Week 6-7:** Mid-term tests
- **Week 13:** Last lectures
- **Exam period:** Check IS for dates`,
      },
    ],
  },
  {
    id: 'mock-erasmus-guide',
    associationId: 'esn',
    title: 'Erasmus+ Student Guide',
    description: 'Everything you need to know as an exchange student',
    isPublished: true,
    createdBy: 'admin@esn-mendelu.cz',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
    slides: [
      {
        id: 'erasmus-slide-1',
        tutorialId: 'mock-erasmus-guide',
        order: 1,
        layout: 'two-column',
        leftIcon: 'home',
        leftTitle: 'Accommodation',
        leftContent: `**University Dorms:**
- Koleje - affordable student housing
- Apply through international office
- Shared rooms available

**What to bring:**
- Bedding is provided
- Bring adapters for EU plugs`,
        rightIcon: 'wallet',
        rightTitle: 'Banking',
        rightContent: `**Czech Bank Account:**
- Recommended: Fio Banka (free, English support)
- Bring passport + visa/permit
- Takes ~1 week to set up

**Payments:**
- Card payments widely accepted
- Cash still useful for small shops`,
      },
    ],
  },
];

// Flag to use mock data (set to false once Supabase is configured)
const USE_MOCK_DATA = false;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Fetch all published tutorials for the given associations
 * @param associationIds - List of association IDs the user is subscribed to
 * @returns Array of tutorials with their slides
 */
export async function fetchTutorials(associationIds: string[]): Promise<Tutorial[]> {
  if (USE_MOCK_DATA) {
    // Filter mock data by associations
    console.log('[TutorialsService] Filtering mock tutorials. associationIds:', associationIds);
    console.log('[TutorialsService] Available tutorials:', MOCK_TUTORIALS.map(t => ({ id: t.id, assoc: t.associationId })));
    const filtered = MOCK_TUTORIALS.filter(
      (t) => t.isPublished && associationIds.includes(t.associationId)
    );
    console.log('[TutorialsService] Filtered tutorials:', filtered.map(t => t.title));
    return filtered;
  }

  try {
    // Fetch tutorials
    const { data: tutorials, error: tutorialError } = await supabase
      .from('tutorials')
      .select('*')
      .eq('is_published', true)
      .in('association_id', associationIds)
      .order('created_at', { ascending: false });

    if (tutorialError) {
      console.error('[TutorialsService] Failed to fetch tutorials:', tutorialError);
      return [];
    }

    if (!tutorials || tutorials.length === 0) {
      return [];
    }

    // Fetch slides for all tutorials
    const tutorialIds = tutorials.map((t) => t.id);
    const { data: slides, error: slidesError } = await supabase
      .from('tutorial_slides')
      .select('*')
      .in('tutorial_id', tutorialIds)
      .order('order', { ascending: true });

    if (slidesError) {
      console.error('[TutorialsService] Failed to fetch slides:', slidesError);
      return [];
    }

    // Map database rows to TypeScript interfaces
    return tutorials.map((t) => ({
      id: t.id,
      associationId: t.association_id,
      title: t.title,
      description: t.description,
      isPublished: t.is_published,
      createdBy: t.created_by,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      slides: (slides || [])
        .filter((s) => s.tutorial_id === t.id)
        .map((s) => ({
          id: s.id,
          tutorialId: s.tutorial_id,
          order: s.order,
          layout: s.layout,
          leftIcon: s.left_icon,
          leftTitle: s.left_title,
          leftContent: s.left_content,
          leftImageUrl: s.left_image_url,
          rightIcon: s.right_icon,
          rightTitle: s.right_title,
          rightContent: s.right_content,
          rightImageUrl: s.right_image_url,
        })),
    }));
  } catch (error) {
    console.error('[TutorialsService] Unexpected error:', error);
    return [];
  }
}

/**
 * Fetch tutorial summaries (without slides) for listing
 * @param associationIds - List of association IDs
 * @returns Array of tutorial summaries
 */
export async function fetchTutorialSummaries(associationIds: string[]): Promise<TutorialSummary[]> {
  if (USE_MOCK_DATA) {
    return MOCK_TUTORIALS
      .filter((t) => t.isPublished && associationIds.includes(t.associationId))
      .map((t) => ({
        id: t.id,
        associationId: t.associationId,
        title: t.title,
        description: t.description,
        slideCount: t.slides.length,
      }));
  }

  try {
    const { data, error } = await supabase
      .from('tutorials')
      .select('id, association_id, title, description')
      .eq('is_published', true)
      .in('association_id', associationIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TutorialsService] Failed to fetch summaries:', error);
      return [];
    }

    // For real data, we'd need a separate query or RPC to get slide counts
    // For now, return 0 as placeholder
    return (data || []).map((t) => ({
      id: t.id,
      associationId: t.association_id,
      title: t.title,
      description: t.description,
      slideCount: 0, // Would need join or RPC
    }));
  } catch (error) {
    console.error('[TutorialsService] Unexpected error:', error);
    return [];
  }
}

/**
 * Fetch a single tutorial by ID with all slides
 * @param tutorialId - Tutorial ID
 * @returns Tutorial with slides or null
 */
export async function fetchTutorialById(tutorialId: string): Promise<Tutorial | null> {
  if (USE_MOCK_DATA) {
    return MOCK_TUTORIALS.find((t) => t.id === tutorialId) || null;
  }

  try {
    const { data: tutorial, error: tutorialError } = await supabase
      .from('tutorials')
      .select('*')
      .eq('id', tutorialId)
      .single();

    if (tutorialError || !tutorial) {
      console.error('[TutorialsService] Tutorial not found:', tutorialError);
      return null;
    }

    const { data: slides, error: slidesError } = await supabase
      .from('tutorial_slides')
      .select('*')
      .eq('tutorial_id', tutorialId)
      .order('order', { ascending: true });

    if (slidesError) {
      console.error('[TutorialsService] Failed to fetch slides:', slidesError);
      return null;
    }

    return {
      id: tutorial.id,
      associationId: tutorial.association_id,
      title: tutorial.title,
      description: tutorial.description,
      isPublished: tutorial.is_published,
      createdBy: tutorial.created_by,
      createdAt: tutorial.created_at,
      updatedAt: tutorial.updated_at,
      slides: (slides || []).map((s) => ({
        id: s.id,
        tutorialId: s.tutorial_id,
        order: s.order,
        layout: s.layout,
        leftIcon: s.left_icon,
        leftTitle: s.left_title,
        leftContent: s.left_content,
        leftImageUrl: s.left_image_url,
        rightIcon: s.right_icon,
        rightTitle: s.right_title,
        rightContent: s.right_content,
        rightImageUrl: s.right_image_url,
      })),
    };
  } catch (error) {
    console.error('[TutorialsService] Unexpected error:', error);
    return null;
  }
}
