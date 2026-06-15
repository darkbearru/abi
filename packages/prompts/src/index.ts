import { DynamicModule, Global, Inject, Injectable, Module, Optional } from '@nestjs/common';

export interface PromptTemplate {
  readonly id: string;
  readonly version: string;
  readonly template: string;
}

export const CHARACTER_FACT_EXTRACTION_PROMPT_ID = 'characters.extract-facts';
export const LOCATION_FACT_EXTRACTION_PROMPT_ID = 'locations.extract-facts';
export const TIMELINE_FACT_EXTRACTION_PROMPT_ID = 'timeline.extract-facts';

export const CHARACTER_FACT_EXTRACTION_PROMPT: PromptTemplate = {
  id: CHARACTER_FACT_EXTRACTION_PROMPT_ID,
  version: '1.0.0',
  template: `You extract character facts from a single normalized book chunk for a later World Bible merge step.

Do not create final canonical characters.
Do not merge ambiguous names into a final identity.
If names may refer to the same person, such as "John", "Johnny", and "Mr. Smith", save them as candidate aliases in candidateNames.

Return only JSON with this shape:
{
  "facts": [
    {
      "type": "CHARACTER_MENTION" | "CHARACTER_ALIAS" | "CHARACTER_APPEARANCE" | "CHARACTER_AGE" | "CHARACTER_PERSONALITY" | "CHARACTER_SPEECH_MANNER" | "CHARACTER_RELATIONSHIP" | "CHARACTER_PLOT_CHANGE" | "CHARACTER_CANDIDATE",
      "entityName": "Name exactly as observed or best local label",
      "value": {
        "summary": "Short factual statement",
        "candidateNames": ["Possible aliases or related mentions"],
        "targetEntityName": "For relationships only, if present",
        "relationshipType": "For relationships only, if present"
      },
      "confidence": 0.0,
      "quote": "Short supporting quote from the chunk",
      "timelineHint": "Optional local timeline hint"
    }
  ]
}

Book id: {{bookId}}
Analysis id: {{analysisId}}
Chunk id: {{chunkId}}
Chapter index: {{chapterIndex}}

Chunk text:
{{chunkText}}`
};

export const LOCATION_FACT_EXTRACTION_PROMPT: PromptTemplate = {
  id: LOCATION_FACT_EXTRACTION_PROMPT_ID,
  version: '1.0.0',
  template: `You extract location facts from a single normalized book chunk for a later World Bible merge step.

Extract cities, districts, streets, buildings, apartments, rooms, forests, parks, squares, and important objects inside locations.
Preserve parent-child hints, for example City -> Park -> Fountain.
Do not create final canonical locations.
Do not merge ambiguous names into a final identity; save possible duplicates in candidateNames.

Return only JSON with this shape:
{
  "facts": [
    {
      "type": "LOCATION_MENTION" | "LOCATION_ALIAS" | "LOCATION_HIERARCHY" | "LOCATION_ATMOSPHERE" | "LOCATION_ARCHITECTURE" | "LOCATION_ERA" | "LOCATION_SOCIAL_CONTEXT" | "LOCATION_LIGHTING" | "LOCATION_COLOR" | "LOCATION_RECURRING_OBJECT" | "LOCATION_CHANGE" | "LOCATION_CANDIDATE",
      "entityName": "Location or important object name exactly as observed",
      "value": {
        "summary": "Short factual statement",
        "candidateNames": ["Possible aliases or duplicate mentions"],
        "parentName": "Immediate parent location, if stated",
        "locationKind": "city | district | street | building | apartment | room | forest | park | square | object | other",
        "atmosphere": "Atmosphere/mood if present",
        "architecture": "Architecture if present",
        "era": "Historical/technological era if present",
        "socialContext": "Social context if present",
        "lighting": "Lighting if present",
        "colors": ["Recurring or important colors"],
        "recurringObjects": ["Objects repeatedly associated with the location"]
      },
      "confidence": 0.0,
      "quote": "Short supporting quote from the chunk",
      "timelineHint": "Optional local timeline hint"
    }
  ]
}

Book id: {{bookId}}
Analysis id: {{analysisId}}
Chunk id: {{chunkId}}
Chapter index: {{chapterIndex}}

Chunk text:
{{chunkText}}`
};

export const TIMELINE_FACT_EXTRACTION_PROMPT: PromptTemplate = {
  id: TIMELINE_FACT_EXTRACTION_PROMPT_ID,
  version: '1.0.0',
  template: `You extract timeline facts from a single normalized book chunk for a later World Bible merge step.

Extract explicit events and implicit temporal markers such as "a year later", "the next day", "in childhood", "before the war", and "after the funeral".
Preserve uncertainty. Do not invent absolute dates.
Mention involved character and location names as local candidates only; the merge step will resolve ids.
Detect character life periods when the chunk says a period applies to a character, for example childhood, youth, adulthood, exile, illness, reign, or old age.

Return only JSON with this shape:
{
  "facts": [
    {
      "type": "TIMELINE_EVENT" | "TIMELINE_MARKER" | "TIMELINE_CHARACTER_PERIOD" | "TIMELINE_CANDIDATE",
      "entityName": "Short event title or marker label",
      "value": {
        "title": "Short event title",
        "description": "Factual event description",
        "absoluteDate": "ISO-8601 date if explicitly stated",
        "relativeMarker": "Temporal marker exactly or compactly expressed",
        "relativeOrderHint": "before | after | same_time | childhood | next_day | year_later | unknown",
        "anchorEventTitle": "Event this marker is relative to, if stated",
        "characterNames": ["Characters involved or whose life period is described"],
        "locationNames": ["Locations involved"],
        "periodName": "For character periods only",
        "candidateNames": ["Possible duplicate event names or local aliases"]
      },
      "confidence": 0.0,
      "quote": "Short supporting quote from the chunk",
      "timelineHint": "Optional local timeline hint"
    }
  ]
}

Book id: {{bookId}}
Analysis id: {{analysisId}}
Chunk id: {{chunkId}}
Chapter index: {{chapterIndex}}

Chunk text:
{{chunkText}}`
};

export const DEFAULT_PROMPT_TEMPLATES = [
  CHARACTER_FACT_EXTRACTION_PROMPT,
  LOCATION_FACT_EXTRACTION_PROMPT,
  TIMELINE_FACT_EXTRACTION_PROMPT
] as const;

export const PROMPT_TEMPLATES = 'ABI_PROMPT_TEMPLATES';

export interface PromptsModuleOptions {
  readonly templates?: readonly PromptTemplate[];
}

export class PromptTemplateNotFoundError extends Error {
  constructor(id: string, version?: string) {
    super(
      version
        ? `Prompt template "${id}" version "${version}" is not registered.`
        : `Prompt template "${id}" is not registered.`
    );
    this.name = 'PromptTemplateNotFoundError';
  }
}

@Injectable()
export class PromptRegistryService {
  constructor(
    @Optional()
    @Inject(PROMPT_TEMPLATES)
    private readonly templates: readonly PromptTemplate[] = []
  ) {}

  list(): readonly PromptTemplate[] {
    return this.templates;
  }

  find(id: string, version?: string): PromptTemplate | undefined {
    return this.templates.find((template) => {
      if (template.id !== id) {
        return false;
      }

      return version ? template.version === version : true;
    });
  }

  get(id: string, version?: string): PromptTemplate {
    const template = this.find(id, version);

    if (!template) {
      throw new PromptTemplateNotFoundError(id, version);
    }

    return template;
  }

  render(
    id: string,
    values: Readonly<Record<string, string | number>>,
    version?: string
  ): string {
    const template = this.get(id, version).template;

    return renderPromptTemplate(template, values);
  }
}

export function renderPromptTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key];

    return value === undefined ? match : String(value);
  });
}

@Global()
@Module({
  providers: [
    {
      provide: PROMPT_TEMPLATES,
      useValue: DEFAULT_PROMPT_TEMPLATES
    },
    PromptRegistryService
  ],
  exports: [PROMPT_TEMPLATES, PromptRegistryService]
})
export class PromptsModule {
  static register(options: PromptsModuleOptions = {}): DynamicModule {
    return {
      module: PromptsModule,
      providers: [
        {
          provide: PROMPT_TEMPLATES,
          useValue: options.templates ?? DEFAULT_PROMPT_TEMPLATES
        },
        PromptRegistryService
      ],
      exports: [PROMPT_TEMPLATES, PromptRegistryService]
    };
  }
}
