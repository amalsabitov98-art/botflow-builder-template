export type BlockType =
  | 'top_banner'
  | 'headline'
  | 'cta_button'
  | 'testimonial'
  | 'text_block'
  | 'divider'
  | 'sticky_checkout'
  | 'lesson_guide'
  | 'lesson_video_hero'
  | 'header'
  | 'hero_image'
  | 'image'
  | 'text'
  | 'video'
  | 'button'
  | 'value_stack'
  | 'features_list'
  | 'features'
  | 'outcomes_list'
  | 'testimonials'
  | 'social_proof'
  | 'guarantee'
  | 'deadline'
  | 'progress_header'
  | 'video_pro'
  | 'timer_alert'
  | 'expert_grid'
  | 'telegram_cta'
  | 'rich_text'
  | 'social_proof_banner'
  | 'product_image'
  | 'quote_testimonial'
  | 'comparison'
  | 'process_flow'
  | 'stats_grid'
  | 'footer';

export interface WebAppBlock {
  id: string;
  type: BlockType;
  content: any;
}

export interface WebAppTemplate {
  id: string;
  name: string;
  theme: 'alice' | 'hormozi' | 'dotcom' | 'story' | 'cosmic';
  blocks: WebAppBlock[];
}
