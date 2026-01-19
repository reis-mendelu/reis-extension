/**
 * TutorialSlide Component
 * 
 * Renders a single slide with support for different layouts:
 * - single: Full-width single column
 * - two-column: Equal 50/50 split
 * - two-column-wide-left: 60/40 left-heavy
 * - two-column-wide-right: 40/60 right-heavy
 * 
 * Uses react-markdown for robust, XSS-safe content rendering.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as LucideIcons from 'lucide-react';
import type { TutorialSlide as TutorialSlideType, SlideLayout } from '../../services/tutorials/types';

interface TutorialSlideProps {
  slide: TutorialSlideType;
}

// Dynamic icon resolver - gets icon component by name
function getIcon(iconName?: string): React.ReactNode {
  if (!iconName) return null;
  
  // Convert snake_case or kebab-case to PascalCase for Lucide
  const pascalName = iconName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  const IconComponent = (LucideIcons as any)[pascalName] as React.ComponentType<{ className?: string }>;
  
  if (!IconComponent) {
    console.warn(`[TutorialSlide] Icon not found: ${iconName} (tried ${pascalName})`);
    return null;
  }
  
  return <IconComponent className="w-14 h-14 text-primary" />;
}

// Get grid classes based on layout
function getLayoutClasses(layout: SlideLayout): { container: string; left: string; right: string } {
  switch (layout) {
    case 'single':
      return { container: 'grid-cols-1', left: '', right: 'hidden' };
    case 'two-column':
      return { container: 'grid-cols-1 md:grid-cols-2', left: '', right: '' };
    case 'two-column-wide-left':
      return { container: 'grid-cols-1 md:grid-cols-5', left: 'md:col-span-3', right: 'md:col-span-2' };
    case 'two-column-wide-right':
      return { container: 'grid-cols-1 md:grid-cols-5', left: 'md:col-span-2', right: 'md:col-span-3' };
    default:
      return { container: 'grid-cols-1 md:grid-cols-2', left: '', right: '' };
  }
}

// Custom markdown components for consistent styling
const markdownComponents = {
  // Headings
  h1: ({ children }: any) => (
    <h1 className="text-3xl font-bold text-base-content mb-4">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-2xl font-bold text-base-content mb-3">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-xl font-semibold text-base-content mb-2">{children}</h3>
  ),
  
  // Paragraphs
  p: ({ children }: any) => (
    <p className="text-base leading-relaxed text-base-content/80 mb-3">{children}</p>
  ),
  
  // Lists - unordered
  ul: ({ children }: any) => (
    <ul className="space-y-2 mb-4">{children}</ul>
  ),
  
  // List items with custom bullet
  li: ({ children }: any) => (
    <li className="flex gap-3 items-center text-base leading-relaxed text-base-content/80">
      <span className="text-primary text-4xl flex-shrink-0 leading-none -mt-0.5">•</span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  
  // Ordered lists
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-2 mb-4 text-base-content/80">{children}</ol>
  ),
  
  // Strong/Bold
  strong: ({ children }: any) => (
    <strong className="font-semibold text-base-content">{children}</strong>
  ),
  
  // Emphasis/Italic
  em: ({ children }: any) => (
    <em className="italic">{children}</em>
  ),
  
  // Links
  a: ({ href, children }: any) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  
  // Code inline
  code: ({ children }: any) => (
    <code className="bg-base-300 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
  ),
  
  // Code blocks
  pre: ({ children }: any) => (
    <pre className="bg-base-300 p-4 rounded-lg overflow-x-auto mb-4 text-sm">{children}</pre>
  ),
  
  // Blockquotes
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary pl-4 italic text-base-content/70 mb-4">
      {children}
    </blockquote>
  ),
  
  // Horizontal rule
  hr: () => <hr className="border-base-300 my-6" />,
  
  // Images
  img: ({ src, alt }: any) => (
    <img 
      src={src} 
      alt={alt || ''} 
      className="rounded-xl max-h-64 object-contain border border-base-300 my-4"
    />
  ),
};

// Single column component
function SlideColumn({ 
  icon, 
  title, 
  content, 
  imageUrl 
}: { 
  icon?: string; 
  title?: string; 
  content?: string; 
  imageUrl?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Icon */}
      {icon && (
        <div className="flex items-center justify-start">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            {getIcon(icon)}
          </div>
        </div>
      )}
      
      {/* Title */}
      {title && (
        <h3 className="text-2xl font-bold text-base-content leading-tight">
          {title}
        </h3>
      )}
      
      {/* Content - rendered with react-markdown */}
      {content && (
        <div className="tutorial-content">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
      
      {/* Image */}
      {imageUrl && (
        <div className="mt-2">
          <img 
            src={imageUrl} 
            alt="" 
            className="rounded-xl max-h-48 object-contain border border-base-300"
          />
        </div>
      )}
    </div>
  );
}

export function TutorialSlide({ slide }: TutorialSlideProps) {
  const layoutClasses = getLayoutClasses(slide.layout);
  const isTwoColumn = slide.layout !== 'single';
  
  return (
    <div className={`grid ${layoutClasses.container} gap-8 md:gap-12 p-6 md:p-8`}>
      {/* Left/Main Column */}
      <div className={layoutClasses.left}>
        <SlideColumn
          icon={slide.leftIcon}
          title={slide.leftTitle}
          content={slide.leftContent}
          imageUrl={slide.leftImageUrl}
        />
      </div>
      
      {/* Right Column (only for two-column layouts) */}
      {isTwoColumn && (
        <div className={layoutClasses.right}>
          <SlideColumn
            icon={slide.rightIcon}
            title={slide.rightTitle}
            content={slide.rightContent}
            imageUrl={slide.rightImageUrl}
          />
        </div>
      )}
    </div>
  );
}
