import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const visualStyles = [
  {
    slug: 'cinematic-realism',
    name: 'Cinematic Realism',
    description: 'Grounded, filmic realism with natural proportions and production-design detail.',
    prompt: 'cinematic realism, natural lighting, lens-aware composition, detailed production design, coherent anatomy',
    negativePrompt: 'cartoon proportions, distorted anatomy, inconsistent costume details',
    primaryColor: '#2f3a3f',
    secondaryColor: '#b8a27c',
    accentColor: '#d9b45f',
    contrastLevel: 62,
    saturationLevel: 42,
    grainLevel: 18,
    lineThickness: 8,
    isDefault: true
  },
  {
    slug: 'dark-fantasy-illustration',
    name: 'Dark Fantasy Illustration',
    description: 'Moody fantasy illustration with dramatic light, aged textures, and ornate detail.',
    prompt: 'dark fantasy illustration, dramatic atmosphere, controlled chiaroscuro, ornate costume detail, weathered materials',
    negativePrompt: 'flat lighting, playful cartoon tone, glossy sci-fi surfaces',
    primaryColor: '#1d2026',
    secondaryColor: '#5e4a3f',
    accentColor: '#b15a3c',
    contrastLevel: 78,
    saturationLevel: 38,
    grainLevel: 42,
    lineThickness: 34,
    isDefault: false
  },
  {
    slug: 'watercolor-storybook',
    name: 'Watercolor Storybook',
    description: 'Soft literary watercolor with warm paper texture and gentle edges.',
    prompt: 'watercolor storybook illustration, soft pigment blooms, gentle ink accents, warm paper texture, readable silhouettes',
    negativePrompt: 'photorealistic rendering, harsh contrast, glossy 3d render',
    primaryColor: '#8eb7c2',
    secondaryColor: '#f1d6a5',
    accentColor: '#d9827b',
    contrastLevel: 34,
    saturationLevel: 46,
    grainLevel: 35,
    lineThickness: 18,
    isDefault: false
  },
  {
    slug: 'graphic-novel',
    name: 'Graphic Novel',
    description: 'Ink-forward sequential illustration with strong silhouettes and panel-ready lighting.',
    prompt: 'graphic novel illustration, bold silhouettes, structured ink lines, panel-ready composition, expressive shadows',
    negativePrompt: 'soft watercolor wash, photorealistic lens blur, low-detail faces',
    primaryColor: '#28313b',
    secondaryColor: '#d8d1c5',
    accentColor: '#c9433d',
    contrastLevel: 72,
    saturationLevel: 55,
    grainLevel: 22,
    lineThickness: 74,
    isDefault: false
  },
  {
    slug: 'anime-film-look',
    name: 'Anime Film Look',
    description: 'Clean cinematic animation language with expressive characters and atmospheric backgrounds.',
    prompt: 'cinematic animation still, clean character design, expressive acting, painted background depth, elegant color keys',
    negativePrompt: 'photorealistic skin pores, heavy comic crosshatching, muddy colors',
    primaryColor: '#6f9fd8',
    secondaryColor: '#f4c7a1',
    accentColor: '#f06f7b',
    contrastLevel: 52,
    saturationLevel: 66,
    grainLevel: 8,
    lineThickness: 32,
    isDefault: false
  },
  {
    slug: 'painterly-animation',
    name: 'Painterly Animation',
    description: 'Animated-feature visual language with visible brushwork and warm dimensional lighting.',
    prompt: 'painterly animation look, visible brush texture, warm rim light, rounded shape language, rich environmental color',
    negativePrompt: 'flat vector art, gritty monochrome comic texture, photographic realism',
    primaryColor: '#4f7f73',
    secondaryColor: '#f0b66d',
    accentColor: '#9d4f6d',
    contrastLevel: 50,
    saturationLevel: 62,
    grainLevel: 28,
    lineThickness: 22,
    isDefault: false
  },
  {
    slug: 'noir-comic',
    name: 'Noir Comic',
    description: 'High-contrast monochrome comic look with sparse accent color and hard-edged shadows.',
    prompt: 'noir comic illustration, stark black and white lighting, hard-edged shadows, sparse accent color, rain-slick surfaces',
    negativePrompt: 'pastel palette, soft diffuse daylight, cheerful storybook texture',
    primaryColor: '#111111',
    secondaryColor: '#e8e3d8',
    accentColor: '#b51f2b',
    contrastLevel: 92,
    saturationLevel: 18,
    grainLevel: 48,
    lineThickness: 82,
    isDefault: false
  },
  {
    slug: 'childrens-book',
    name: "Children's Book",
    description: 'Friendly illustrated look with clear shapes, warm colors, and gentle texture.',
    prompt: 'children book illustration, friendly shape language, clear readable characters, warm inviting colors, gentle texture',
    negativePrompt: 'horror atmosphere, harsh violence, complex photorealistic rendering',
    primaryColor: '#7fb7a3',
    secondaryColor: '#ffd27f',
    accentColor: '#ef7d6f',
    contrastLevel: 36,
    saturationLevel: 58,
    grainLevel: 20,
    lineThickness: 28,
    isDefault: false
  },
  {
    slug: 'historical-engraving',
    name: 'Historical Engraving',
    description: 'Period print-inspired linework with etched texture and restrained color.',
    prompt: 'historical engraving illustration, etched linework, archival print texture, restrained palette, precise period detail',
    negativePrompt: 'neon lighting, modern glossy render, soft airbrush gradients',
    primaryColor: '#2c2924',
    secondaryColor: '#d6c6a8',
    accentColor: '#7f4a35',
    contrastLevel: 68,
    saturationLevel: 22,
    grainLevel: 64,
    lineThickness: 88,
    isDefault: false
  },
  {
    slug: 'minimal-editorial-illustration',
    name: 'Minimal Editorial Illustration',
    description: 'Restrained editorial illustration with simplified forms and deliberate negative space.',
    prompt: 'minimal editorial illustration, simplified forms, deliberate negative space, limited palette, precise composition',
    negativePrompt: 'dense ornament, busy background, hyperreal texture',
    primaryColor: '#f4f1ea',
    secondaryColor: '#24323a',
    accentColor: '#df6b4f',
    contrastLevel: 48,
    saturationLevel: 36,
    grainLevel: 6,
    lineThickness: 16,
    isDefault: false
  }
];

const obsoletePresetSlugs = ['dark-fantasy-editorial', 'storybook-watercolor'];

async function main() {
  await prisma.visualStyle.deleteMany({
    where: {
      slug: {
        in: obsoletePresetSlugs
      }
    }
  });

  for (const style of visualStyles) {
    await prisma.visualStyle.upsert({
      where: {
        slug: style.slug
      },
      update: style,
      create: style
    });
  }
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
