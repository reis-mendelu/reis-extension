/**
 * TutorialSlide Component
 * 
 * Renders a single slide image in full-screen mode.
 * Images fill the entire available space in the modal.
 */

import type { TutorialSlide as TutorialSlideType } from '../../services/tutorials/types';

interface TutorialSlideProps {
  slide: TutorialSlideType;
}

export function TutorialSlide({ slide }: TutorialSlideProps) {
  // Image-only mode: display the slide image filling the entire available space
  const imageUrl = slide.leftImageUrl || slide.rightImageUrl;
  
  if (!imageUrl) {
    // Fallback for slides without images
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-base-content/60">No slide image available</p>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center h-full">
      <img 
        src={imageUrl} 
        alt="" 
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
