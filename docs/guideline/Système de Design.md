# 🧪 Distill — Design System

> Transformer le chaos des réunions en actions claires.

---

## Identité

### Nom
**Distill** — /dɪˈstɪl/

*Verbe* : Extraire l'essence de quelque chose, purifier, concentrer.

### Tagline
- Principal : **"From meetings to code, distilled."**
- Alternatif : **"Distill your meetings into action."**
- Court : **"Meetings → Tasks → Code"**

### Ton de voix
- **Précis** : pas de fluff, droit au but
- **Technique** : parle le langage des devs
- **Confiant** : l'outil sait ce qu'il fait

---

## Palette de couleurs — "Deep Focus"

### Couleurs de base

| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0A0A0F` | Fond principal |
| `--surface` | `#12121A` | Cards, modales, zones élevées |
| `--surface-hover` | `#1A1A24` | Hover sur surfaces |
| `--border` | `#1E1E2E` | Bordures, séparateurs |
| `--border-strong` | `#2E2E3E` | Bordures accentuées |

### Couleurs principales

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#6366F1` | Boutons principaux, liens |
| `--primary-hover` | `#818CF8` | Hover sur primary |
| `--primary-muted` | `#4F46E5` | États pressed/active |
| `--accent` | `#22D3EE` | Highlights, badges, focus |
| `--accent-muted` | `#06B6D4` | Accent secondaire |

### Couleurs de texte

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#F8FAFC` | Texte principal |
| `--text-secondary` | `#CBD5E1` | Texte secondaire |
| `--text-muted` | `#64748B` | Texte désactivé, placeholders |
| `--text-inverted` | `#0A0A0F` | Texte sur fond clair |

### Couleurs sémantiques

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#34D399` | Succès, validations |
| `--success-muted` | `#10B981` | Background success |
| `--warning` | `#FBBF24` | Avertissements |
| `--warning-muted` | `#F59E0B` | Background warning |
| `--error` | `#F87171` | Erreurs |
| `--error-muted` | `#EF4444` | Background error |
| `--info` | `#60A5FA` | Informations |

### Couleurs de complexité (spécifique Distill)

| Token | Hex | Usage |
|-------|-----|-------|
| `--complexity-simple` | `#34D399` | Badge "Simple" |
| `--complexity-moderate` | `#FBBF24` | Badge "Modéré" |
| `--complexity-critical` | `#F87171` | Badge "Critique" |

### Couleurs de type de tâche

| Token | Hex | Usage |
|-------|-----|-------|
| `--type-feature` | `#818CF8` | Nouvelle fonctionnalité |
| `--type-bugfix` | `#F87171` | Correction de bug |
| `--type-modification` | `#FBBF24` | Modification existante |
| `--type-documentation` | `#60A5FA` | Documentation |
| `--type-refactor` | `#A78BFA` | Refactoring |

---

## Typographie

### Police principale
**Inter** — Pour tout le texte UI

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Police code
**JetBrains Mono** — Pour le code et chemins de fichiers

```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Échelle typographique

| Token | Taille | Line Height | Usage |
|-------|--------|-------------|-------|
| `--text-xs` | 12px | 16px | Labels, badges |
| `--text-sm` | 14px | 20px | Texte secondaire, boutons |
| `--text-base` | 16px | 24px | Texte principal |
| `--text-lg` | 18px | 28px | Sous-titres |
| `--text-xl` | 20px | 28px | Titres de section |
| `--text-2xl` | 24px | 32px | Titres de page |
| `--text-3xl` | 30px | 36px | Titres principaux |

### Poids

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Texte courant |
| `--font-medium` | 500 | Labels, emphase légère |
| `--font-semibold` | 600 | Titres, boutons |
| `--font-bold` | 700 | Titres importants |

---

## Espacements

### Échelle

| Token | Valeur | Usage |
|-------|--------|-------|
| `--space-1` | 4px | Micro-espacements |
| `--space-2` | 8px | Entre éléments proches |
| `--space-3` | 12px | Padding boutons |
| `--space-4` | 16px | Padding cards |
| `--space-5` | 20px | Gaps moyens |
| `--space-6` | 24px | Sections |
| `--space-8` | 32px | Entre sections |
| `--space-10` | 40px | Grands espacements |
| `--space-12` | 48px | Marges de page |
| `--space-16` | 64px | Espacements majeurs |

---

## Rayons de bordure

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-sm` | 4px | Badges, tags |
| `--radius-md` | 8px | Boutons, inputs |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Modales |
| `--radius-full` | 9999px | Avatars, pills |

---

## Ombres

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);

/* Glow pour éléments focus/accent */
--glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
--glow-accent: 0 0 20px rgba(34, 211, 238, 0.3);
```

---

## Transitions

```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
--transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## Configuration Tailwind

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0A0A0F',
        surface: {
          DEFAULT: '#12121A',
          hover: '#1A1A24',
        },
        border: {
          DEFAULT: '#1E1E2E',
          strong: '#2E2E3E',
        },
        primary: {
          DEFAULT: '#6366F1',
          hover: '#818CF8',
          muted: '#4F46E5',
        },
        accent: {
          DEFAULT: '#22D3EE',
          muted: '#06B6D4',
        },
        muted: '#64748B',
        
        // Sémantiques
        success: {
          DEFAULT: '#34D399',
          muted: '#10B981',
        },
        warning: {
          DEFAULT: '#FBBF24',
          muted: '#F59E0B',
        },
        error: {
          DEFAULT: '#F87171',
          muted: '#EF4444',
        },
        
        // Complexité
        complexity: {
          simple: '#34D399',
          moderate: '#FBBF24',
          critical: '#F87171',
        },
        
        // Types de tâches
        task: {
          feature: '#818CF8',
          bugfix: '#F87171',
          modification: '#FBBF24',
          documentation: '#60A5FA',
          refactor: '#A78BFA',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-accent': '0 0 20px rgba(34, 211, 238, 0.3)',
      },
    },
  },
}
```

---

## Icônes — Heroicons

### Librairie
**Heroicons** (@heroicons/react) — par les créateurs de Tailwind CSS

```bash
npm install @heroicons/react
```

### Utilisation

```tsx
// Outline (24x24, stroke 1.5)
import { BeakerIcon } from '@heroicons/react/24/outline'

// Solid (24x24, filled)
import { BeakerIcon } from '@heroicons/react/24/solid'

// Mini (20x20, filled) — pour boutons, badges
import { BeakerIcon } from '@heroicons/react/20/solid'
```

### Icônes principales utilisées dans Distill

| Usage | Icône | Import |
|-------|-------|--------|
| Projet | `FolderIcon` | 24/outline |
| Réunion | `ChatBubbleLeftRightIcon` | 24/outline |
| Tâche | `ClipboardDocumentListIcon` | 24/outline |
| Feature | `SparklesIcon` | 24/solid |
| Bug | `BugAntIcon` | 24/solid |
| Modification | `PencilSquareIcon` | 24/solid |
| Documentation | `DocumentTextIcon` | 24/solid |
| Analyse | `MagnifyingGlassIcon` | 24/outline |
| Export | `ArrowUpTrayIcon` | 24/outline |
| GitHub | `CodeBracketIcon` | 24/outline |
| Branche | `ArrowsRightLeftIcon` | 24/outline |
| Succès | `CheckCircleIcon` | 24/solid |
| Erreur | `XCircleIcon` | 24/solid |
| Warning | `ExclamationTriangleIcon` | 24/solid |
| Loading | `ArrowPathIcon` | 24/outline (+ animation spin) |
| Menu | `Bars3Icon` | 24/outline |
| Fermer | `XMarkIcon` | 24/outline |
| Chevron | `ChevronDownIcon` | 20/solid |
| Plus | `PlusIcon` | 24/outline |

### Tailles standard

| Contexte | Classe Tailwind | Taille |
|----------|-----------------|--------|
| Navigation | `h-6 w-6` | 24px |
| Boutons | `h-5 w-5` | 20px |
| Badges | `h-4 w-4` | 16px |
| Inline texte | `h-4 w-4` | 16px |

### Couleurs

Les icônes héritent de `currentColor`. Utiliser les classes Tailwind :

```tsx
<BeakerIcon className="h-5 w-5 text-primary" />
<BeakerIcon className="h-5 w-5 text-muted" />
<CheckCircleIcon className="h-5 w-5 text-success" />
```

---

## Composants — Custom

> ⚠️ **Philosophie** : Nous créons tous nos composants from scratch. Pas de shadcn/ui, Radix, Headless UI, ou autre librairie de composants. Cela garantit un contrôle total sur le design, les animations, et évite les dépendances inutiles.

### Structure des composants

```
src/components/
├── ui/                    # Composants génériques réutilisables
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.types.ts
│   │   └── index.ts
│   ├── Input/
│   ├── Select/
│   ├── Modal/
│   ├── Card/
│   ├── Badge/
│   ├── Dropdown/
│   ├── Toast/
│   ├── Skeleton/
│   ├── Spinner/
│   └── ...
└── features/              # Composants métier spécifiques
    ├── ProjectCard/
    ├── TaskCard/
    ├── MeetingForm/
    ├── AnalysisResult/
    └── ...
```

### Principes de création

1. **Accessibilité** : Toujours inclure les attributs ARIA nécessaires
2. **Keyboard navigation** : Tab, Enter, Escape doivent fonctionner
3. **Focus visible** : Ring visible sur focus
4. **TypeScript strict** : Props typées, pas de `any`
5. **Composition** : Préférer la composition à l'héritage
6. **Variants** : Utiliser des props pour les variantes (size, variant, etc.)

### Pattern de composant recommandé

```tsx
// Button.types.ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

// Button.tsx
import { forwardRef } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import type { ButtonProps } from './Button.types'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    isLoading,
    leftIcon,
    rightIcon,
    children,
    className,
    disabled,
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-semibold transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variants
          variant === 'primary' && 'bg-primary text-white hover:bg-primary-hover',
          variant === 'secondary' && 'bg-surface border border-border text-text hover:bg-surface-hover',
          variant === 'ghost' && 'bg-transparent text-text hover:bg-surface',
          variant === 'danger' && 'bg-error text-white hover:bg-error-muted',
          // Sizes
          size === 'sm' && 'h-8 px-3 text-sm rounded-md gap-1.5',
          size === 'md' && 'h-10 px-4 text-sm rounded-md gap-2',
          size === 'lg' && 'h-12 px-6 text-base rounded-lg gap-2',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
        ) : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

---

```css
/* globals.css */
:root {
  /* Colors */
  --background: #0A0A0F;
  --surface: #12121A;
  --surface-hover: #1A1A24;
  --border: #1E1E2E;
  --border-strong: #2E2E3E;
  
  --primary: #6366F1;
  --primary-hover: #818CF8;
  --primary-muted: #4F46E5;
  --accent: #22D3EE;
  --accent-muted: #06B6D4;
  
  --text: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #64748B;
  
  --success: #34D399;
  --warning: #FBBF24;
  --error: #F87171;
  
  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Spacing */
  --space-unit: 4px;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
}

body {
  background-color: var(--background);
  color: var(--text);
  font-family: var(--font-sans);
}
```

---

## Spécifications détaillées des composants UI

### Bouton Primary

```
Background: var(--primary)
Text: white
Border-radius: var(--radius-md)
Padding: 12px 20px
Font-weight: 600
Font-size: 14px

Hover: var(--primary-hover)
Active: var(--primary-muted)
Disabled: opacity 0.5, cursor not-allowed
Focus: ring 2px var(--accent)
```

### Card

```
Background: var(--surface)
Border: 1px solid var(--border)
Border-radius: var(--radius-lg)
Padding: 20px

Hover (si clickable): border-color var(--border-strong)
```

### Badge de complexité

```
Border-radius: var(--radius-sm)
Padding: 4px 8px
Font-size: 12px
Font-weight: 500

Simple:   bg rgba(52, 211, 153, 0.15), text #34D399
Moderate: bg rgba(251, 191, 36, 0.15), text #FBBF24
Critical: bg rgba(248, 113, 113, 0.15), text #F87171
```

### Input

```
Background: var(--surface)
Border: 1px solid var(--border)
Border-radius: var(--radius-md)
Padding: 12px 16px
Color: var(--text)

Placeholder: var(--text-muted)
Focus: border-color var(--primary), ring 2px rgba(99, 102, 241, 0.2)
Error: border-color var(--error)
```

---

## Logo

### Concept
Le logo représente un entonnoir/filtre stylisé — symbolisant la "distillation" des infos brutes en essence pure.

### Variations
- **Icon only** : pour favicon, app icon
- **Horizontal** : icon + texte pour header
- **Stacked** : icon au-dessus du texte pour splash screens

### Couleurs logo
- Primary : `#6366F1` (indigo)
- Sur fond sombre : blanc `#F8FAFC`
- Monochrome : selon le contexte

---

## Favicon & App Icons

| Contexte | Taille | Format |
|----------|--------|--------|
| Favicon | 32x32 | .ico, .png |
| Apple Touch | 180x180 | .png |
| Android | 192x192, 512x512 | .png |
| OG Image | 1200x630 | .png |

---

## Références visuelles

Inspirations UI :
- **Linear** — Navigation, densité d'information
- **Raycast** — Couleurs, feel "pro-dev"
- **Vercel** — Clarté, espaces blancs
- **GitHub** — Familiarité pour les devs

---

*Design System v1.0 — Distill*
