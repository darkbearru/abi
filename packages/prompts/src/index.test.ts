import { describe, expect, it } from 'vitest';

import {
  CHARACTER_FACT_EXTRACTION_PROMPT_ID,
  DEFAULT_PROMPT_TEMPLATES,
  LOCATION_FACT_EXTRACTION_PROMPT_ID,
  OBJECT_FACT_EXTRACTION_PROMPT_ID,
  PromptRegistryService,
  PromptTemplateNotFoundError,
  renderPromptTemplate,
  TIMELINE_FACT_EXTRACTION_PROMPT_ID,
  type PromptTemplate
} from './index.js';

describe('PromptRegistryService', () => {
  it('finds templates by id and version', () => {
    const template: PromptTemplate = {
      id: 'world-bible.extract',
      version: '1.0.0',
      template: 'Extract world bible.'
    };
    const registry = new PromptRegistryService([template]);

    expect(registry.get('world-bible.extract', '1.0.0')).toBe(template);
  });

  it('throws a typed error for missing templates', () => {
    const registry = new PromptRegistryService();

    expect(() => registry.get('missing')).toThrow(PromptTemplateNotFoundError);
  });

  it('registers the character extraction prompt by default', () => {
    const registry = new PromptRegistryService(DEFAULT_PROMPT_TEMPLATES);

    expect(registry.get(CHARACTER_FACT_EXTRACTION_PROMPT_ID, '1.0.0').template).toContain(
      'entityName MUST be that exact name'
    );
    expect(registry.get(LOCATION_FACT_EXTRACTION_PROMPT_ID, '1.0.0').template).toContain(
      'Country -> City -> Street'
    );
    expect(registry.get(OBJECT_FACT_EXTRACTION_PROMPT_ID, '1.0.0').template).toContain(
      'not a character and not a location'
    );
    expect(registry.get(TIMELINE_FACT_EXTRACTION_PROMPT_ID, '1.0.0').template).toContain(
      'the next day'
    );
  });

  it('renders prompt variables', () => {
    expect(renderPromptTemplate('Chunk: {{chunkId}}', { chunkId: 'abc' })).toBe('Chunk: abc');
  });
});
