// src/components/Footer.vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

defineOptions({
    name: 'AppFooter'
});

const showChangelogDialog = ref(false);
const version = 'v2.0.30-beta';
const LAST_SEEN_CHANGELOG_VERSION_KEY = 'magicianLastSeenChangelogVersion';
const lastSeenVersion = ref('');

const changelog = [
    {
        version: 'v2.0.30-beta',
        date: 'APR-22-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added a lightweight live stats backend to track unique visitors, active users, image exports, total visits, and unique exporters',
                    'Added a new Live Community Tracker section on the home page with automatically refreshed usage metrics',
                    'Added Docker and Portainer deployment support for running the stats backend separately from the static frontend'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Connected frontend session starts, activity heartbeats, and successful image exports to the backend stats service',
                    'Made backend CORS configurable so the stats service can be safely exposed from its own VPS subdomain'
                ]
            }
        ]
    },
    {
        version: 'v2.0.29-beta',
        date: 'APR-22-2026',
        changes: [
            {
                type: 'improved',
                items: [
                    'Refactored the Screenshot Magician editor into a more modular feature structure under frontend/src/features/magician/',
                    'Split shared editor types, constants, content, theme config, image effect presets, and chat color mappings out of Magician.vue',
                    'Moved theme management, project persistence, session persistence, chat layer behavior, image overlay runtime behavior, and canvas interaction logic into dedicated composables and helpers'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Resolved refactor-related TypeScript and ESLint issues and kept type-check and production builds passing through the modularization work'
                ]
            }
        ]
    },
    {
        version: 'v2.0.28-beta',
        date: 'APR-21-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added non-destructive image-layer masking with Move, Erase, and Restore tools plus adjustable brush size, softness, and strength controls',
                    'Added a new CCTV scene effect with surveillance-style monochrome treatment, scanlines, grain, and an adjustable lens-curve control'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved the left utility rail layout and scrolling so image-layer controls fit more cleanly and remain usable with larger projects',
                    'Improved live editing responsiveness for scene effects so dragging stays smooth while CCTV is enabled and refreshes swap in more cleanly'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed image-layer editing behind chat overlays so selected image layers can still be moved or brushed even when chats overlap them',
                    'Fixed CCTV preview and compositing issues that were hiding lens distortion, causing stale-frame bounce after drag release, or making the live preview disagree with export'
                ]
            }
        ]
    },
    {
        version: 'v2.0.27-beta',
        date: 'APR-21-2026',
        changes: [
            {
                type: 'improved',
                items: [
                    'Cleaned up the editor frontend so the current Vue, ESLint, and TypeScript Problems list is resolved again',
                    'Improved component metadata and TypeScript typing across shared editor components for more reliable tooling and maintenance'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed smart-guide typing and legacy editor-state migration issues that were surfacing as build-time TypeScript errors',
                    'Fixed template ref and saved-project typing edge cases so lint and type-check now pass cleanly'
                ]
            }
        ]
    },
    {
        version: 'v2.0.26-beta',
        date: 'APR-21-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Fixed image effects such as Inverse affecting chat overlays on the live canvas preview by keeping chat layers above the image effect stack'
                ]
            }
        ]
    },
    {
        version: 'v2.0.25-beta',
        date: 'APR-21-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Fixed Navigator viewport alignment so the blue preview box now matches the base screenshot position on the canvas much more precisely',
                    'Fixed Navigator preview rendering so the minimap always shows the full base screenshot without introducing crop drift'
                ]
            }
        ]
    },
    {
        version: 'v2.0.24-beta',
        date: 'APR-21-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added two new image effects: Inverse for full color inversion and Darken for a moody finishing pass',
                    'Added per-image-layer effect toggles so each overlay can either participate in image effects or stay clean above them'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved image-layer controls with hover tooltips for every compact action button in the left rail',
                    'Improved the left utility rail so large image layer stacks scroll cleanly without pushing important controls off-screen',
                    'Simplified the Inverse effect into a clean enabled-or-disabled toggle instead of an adjustable opacity effect'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed image effect preview and export mismatches so overlay layers now follow the same effect order in both places'
                ]
            }
        ]
    },
    {
        version: 'v2.0.23-beta',
        date: 'APR-21-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added Photoshop-style Smart Guides for chat layers and image overlays, including canvas alignment guides and equal-spacing guides between nearby objects',
                    'Added Smart Guides controls in Settings so snapping can be enabled or disabled and snap strength can be adjusted'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved canvas drag responsiveness by moving active drag visuals through a faster direct transform path before committing final positions on release',
                    'Improved drag fidelity so chat elements and image layers track the cursor much more closely during movement',
                    'Improved startup performance with route-level code splitting and vendor chunking to reduce initial app boot cost'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed the Navigator so it updates live again while moving or resizing the base screenshot instead of waiting until release',
                    'Fixed subtle chat-layer drag rendering issues introduced by compositor promotion during mousedown'
                ]
            }
        ]
    },
    {
        version: 'v2.0.22-beta',
        date: 'APR-20-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added stackable user image layers with per-layer positioning, scaling, opacity, duplication, visibility, locking, persistence, and export support',
                    'Added a dedicated left utility rail so navigator and image-layer controls no longer compete with the chat editor for sidebar space'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved image-layer management with automatic fit-to-canvas placement on import, thumbnail previews, readable wrapped layer labels, and layer reordering controls',
                    'Improved canvas targeting so only the selected image element responds to drag and resize input, with double-click canvas selection for image layers',
                    'Improved project status presentation by keeping autosave state messaging on a stable single line instead of shifting the sidebar layout'
                ]
            }
        ]
    },
    {
        version: 'v2.0.21-beta',
        date: 'APR-20-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added Discord-friendly Open Graph metadata and a dedicated social preview card so shared links now render a proper embed instead of an empty preview'
                ]
            }
        ]
    },
    {
        version: 'v2.0.20-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Added a confirmation step before deleting saved projects from the project browser so local work cannot be removed by a single accidental click'
                ]
            }
        ]
    },
    {
        version: 'v2.0.19-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Fixed additional light-theme readability issues in the editor sidebar by aligning the Censored Selections panel with the same dark subsection styling used by the Project and Navigator areas'
                ]
            }
        ]
    },
    {
        version: 'v2.0.18-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Fixed low-contrast helper text on dark custom surfaces when using light theme variants, improving readability in the editor sidebar navigator and home page ad rail'
                ]
            }
        ]
    },
    {
        version: 'v2.0.17-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added an image navigator preview for zoomed or panned screenshots, including click-to-recenter behavior and quick reset view controls'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Moved the navigator out of the canvas so it never covers the artwork and added a settings toggle to show or hide it while keeping it enabled by default'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed restored saved sessions coming back as unsaved work by persisting and restoring the active project identity alongside the editor snapshot'
                ]
            }
        ]
    },
    {
        version: 'v2.0.16-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added layer management controls for chat overlays, including duplicate, hide/show, and lock actions directly inside the Chat Layers panel'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved canvas interaction by allowing drag mode to be enabled from the canvas itself with double-click shortcuts for the screenshot and chat overlays',
                    'Improved chat overlay handling so image dragging no longer drops when the cursor passes across chat elements during a drag session'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed chat double-click activation conflicts caused by layer selection rerendering before the browser could complete the double-click gesture'
                ]
            }
        ]
    },
    {
        version: 'v2.0.15-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added full editor undo and redo controls with keyboard support so project-wide changes can be stepped backward or forward more naturally',
                    'Added keyboard shortcut discovery with shortcut-aware tooltips, a dedicated shortcuts dialog, toolbar access, and ? quick help'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Added lightweight autosave for named projects so saved work updates quietly in the background after editing pauses',
                    'Improved project management by supporting portable .ssmag project export and import for moving work between browsers or machines'
                ]
            }
        ]
    },
    {
        version: 'v2.0.14-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'improved',
                items: [
                    'Added leave-page protection for unsaved work when navigating with in-app links, external links, browser reload, tab close, or address bar changes',
                    'Improved session persistence so reopening the editor restores the full canvas session consistently instead of returning only the chat editor state'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed inconsistent session restore behavior where chat overlays persisted after reload but the dropped screenshot canvas came back empty'
                ]
            }
        ]
    },
    {
        version: 'v2.0.13-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added custom Google Analytics event tracking for key editor actions such as importing assets, parsing chatlogs, applying censoring, toggling image effects, saving and loading projects, exporting images, and completing the tutorial'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Added a centralized analytics helper so future tracking can be extended cleanly without scattering Google Analytics calls throughout the editor'
                ]
            }
        ]
    },
    {
        version: 'v2.0.12-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'improved',
                items: [
                    'Added a responsive compact toolbar for smaller displays so key editor controls remain usable below 1080p without changing the desktop layout',
                    'Moved Character and Canvas sizing controls into compact popover panels on narrower viewports to prevent the top bar from becoming too cramped'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed compact toolbar clipping so wrapped controls fully render instead of being cut off inside the default toolbar height at smaller resolutions'
                ]
            }
        ]
    },
    {
        version: 'v2.0.11-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Fixed native browser drag behavior on the rendered preview so the canvas can no longer be picked up like an image when drag modes are disabled',
                    'Fixed preview interaction edge cases by blocking dragstart across the drop zone, base image, effect layers, and chat overlays'
                ]
            }
        ]
    },
    {
        version: 'v2.0.10-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'fixed',
                items: [
                    'Fixed deployed canvas chat overlays still allowing text selection when drag mode was disabled',
                    'Fixed chat display selection behavior so only the editor textarea can be used for text selection and censoring workflows'
                ]
            }
        ]
    },
    {
        version: 'v2.0.9-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added a last-seen changelog tracker that shows a small New indicator when a newer version is available than the one the user last opened'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Added editor-style unsaved work protection when starting a new session or loading a different project',
                    'Improved project status messaging so the editor clearly tells you when the current session has unsaved changes'
                ]
            }
        ]
    },
    {
        version: 'v2.0.8-beta',
        date: 'APR-19-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added a Censored Selections panel in the chat editor so every censored range is listed clearly for the active chat layer'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved censor management by letting you jump directly to a censored selection or remove it without manually reselecting the same text',
                    'Added Google AdSense groundwork on the home page with environment-based ad slot configuration and a reusable loader for manual ad units',
                    'Added Google AdSense site verification meta tag support in the application head for ownership verification'
                ]
            }
        ]
    },
    {
        version: 'v2.0.7-beta',
        date: 'APR-18-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added stackable image effect layers with live preview and export support, including film grain, dust and scratches, vignette, and scanlines',
                    'Added first-run tutorial onboarding with a persistent "don\'t show again" option and manual reopen support',
                    'Added a Settings menu with built-in theme families, light and dark variants, custom theme creation, and shareable theme import/export'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Moved image effect controls into a non-blocking side drawer so the canvas stays visible while editing',
                    'Improved color swatch tooltips to describe their typical GTA World usage instead of only showing raw RGB values',
                    'Cleaned up project save UX so Save As New only appears when duplicating an existing saved project',
                    'Expanded built-in theme options with families such as Dracula, Solarized, and Nord, each with light and dark variants'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed fast chat dragging dropping selection mid-move by keeping drag tracking active outside the overlay element',
                    'Fixed black bar censor preview so the text no longer renders on top of the censor in the live DOM view',
                    'Fixed home page scrolling so the Time Saved section can be reached normally',
                    'Fixed automatic chat parsing so leading timestamps are stripped when present without requiring a manual toggle',
                    'Fixed shell theming regressions so the sidebar, footer, and chat panel framing stay visually consistent'
                ]
            }
        ]
    },
    {
        version: 'v2.0.6-beta',
        date: 'APR-18-2026',
        changes: [
            {
                type: 'new',
                items: [
                    'Added support for multiple independent chatlog layers on a single image',
                    'Added local browser project saving/loading so full sessions can be reopened later',
                    'Added inline manual text color overrides with built-in and custom swatches'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved the chat editor workflow with selectable chat layers and project status visibility',
                    'Refactored chat styling so preview and export use the same inline color and censor data'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed exported image positioning so dragged and zoomed screenshots now match the editor preview',
                    'Fixed project save failures caused by non-serializable reactive state in browser storage',
                    'Fixed selection offsets when timestamp stripping is enabled for inline color and censor operations',
                    'Fixed censor preview spacing so black bar and blur no longer push following text out of place',
                    'Fixed exported censor rendering so invisible, black bar, and blur now match the on-screen result',
                    'Fixed Toggle Black Bars changing chat wrapping and layout instead of only drawing bars behind the existing text'
                ]
            }
        ]
    },
    {
        version: 'v2.0.5-beta', // New version entry
        date: 'APR-18-2025', // Current date
        changes: [
            {
                type: 'new',
                items: [
                    'Made it possible to change the chatlog box width by dragging',
                    'Any resolution will now fit inside content area. If too large, it will be shrunk to fit with an indicator'
                ]
            },
            {
                type: 'fixed',
                items: [
                    'Fixed high resolution canvas not fitting in content area',
                    'Fixed bug created by chatlog resizing interaction with canvas',
                    'Fixed issue where canvas did not match 1:1 with exported image at different resolutions',
                    'Fixed issue with line-breaks on long chat lines at wide resolutions'
                ]
            },
            {
                type: 'coming',
                items: [
                    'Ability to change font, supporting all GTA World fonts',
                    'Ability to change font stroke (stroke is currently hardcoded to external black 2px)'
                ]
            },
            {
                type: 'known',
                items: [
                    'MAJOR: Exported image not matching canvas positions',
                    'Censors are not working properly after changes made to export process'
                ]
            }
        ]
    },
    {
        version: 'v2.0.4-beta', // New version entry
        date: 'APR-17-2025', // Current date
        changes: [
            {
                type: 'improved',
                items: [
                    'Increased width of Height/Width input fields to accommodate larger values'
                ]
            }
        ]
    },
    {
        version: 'v2.0.3-beta',
        date: 'APR-17-2025',
        changes: [
            {
                type: 'improved',
                items: [
                    'Added Google Analytics for usage tracking and site improvement'
                ]
            }
        ]
    },
    {
        version: 'v2.0.2-beta',
        date: 'APR-16-2025',
        changes: [
            {
                type: 'improved',
                items: [
                    'Added MIT License acknowledgment in Terms of Use',
                    'Enhanced Privacy Policy with open-source transparency',
                    'Fixed scrolling issues in legal documentation pages',
                    'Improved Terms and Privacy pages styling and readability'
                ]
            }
        ]
    },
    {
        version: 'v2.0.1-beta',
        date: 'APR-16-2025',
        changes: [
            {
                type: 'improved',
                items: [
                    'Added persistent storage for character name and editor state',
                    'Fixed HTML rendering in exported images for special messages ([!], Character Kill, etc)',
                    'Fixed partial text censoring in exported images',
                    'Improved text rendering quality and color accuracy'
                ]
            }
        ]
    },
    {
        version: 'v2.0.0-beta',
        date: 'APR-16-2025',
        changes: [
            {
                type: 'new',
                items: [
                    'Complete rewrite in Vue 3 + TypeScript',
                    'New image manipulation system with zoom and pan controls',
                    'Enhanced chat overlay with independent positioning',
                    'Advanced censoring system with multiple modes (invisible, black bar, blur)',
                    'Automatic chat color parsing and styling',
                    'Custom character name support',
                    'Export system with high-quality PNG output',
                    'Quick shortcuts (Ctrl+Enter for parsing)',
                    'Black bar toggle for chat messages',
                    'Customizable canvas dimensions',
                    'Drag and drop file support',
                    'Text file import for chat logs'
                ]
            },
            {
                type: 'improved',
                items: [
                    'Improved UI with dark theme and responsive design',
                    'Enhanced performance and stability',
                    'Better text rendering with Arial Black font'
                ]
            },
            {
                type: 'coming',
                items: [
                    'Layer system for multiple image support',
                    'All GTA World color swatches',
                    'Image overlay filters (Grime, etc)',
                    'Inline RP support. Eg. Name says: Haha *roleplay*'
                ]
            }
        ]
    }
];

const getChangeTypeIcon = (type: string) => {
    switch (type) {
        case 'new': return { icon: 'mdi-plus-circle', color: 'success', label: 'New Features' };
        case 'improved': return { icon: 'mdi-arrow-up-circle', color: 'info', label: 'Improvements' };
        case 'fixed': return { icon: 'mdi-wrench', color: 'warning', label: 'Fixes' };
        case 'removed': return { icon: 'mdi-minus-circle', color: 'error', label: 'Removed' };
        case 'coming': return { icon: 'mdi-clock-outline', color: 'grey', label: 'Coming Soon' };
        case 'known': return { icon: 'mdi-alert-circle-outline', color: 'deep-orange', label: 'Known Issues' }; // Added known issues type
        default: return { icon: 'mdi-circle-small', color: 'primary', label: 'Changes' };
    }
};

const hasUnreadChangelog = computed(() =>
    Boolean(lastSeenVersion.value) && lastSeenVersion.value !== version
);

const markChangelogAsSeen = () => {
    lastSeenVersion.value = version;

    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAST_SEEN_CHANGELOG_VERSION_KEY, version);
};

const openChangelog = () => {
    showChangelogDialog.value = true;
    markChangelogAsSeen();
};

onMounted(() => {
    if (typeof window === 'undefined') return;

    const storedVersion = window.localStorage.getItem(LAST_SEEN_CHANGELOG_VERSION_KEY);
    lastSeenVersion.value = storedVersion || version;
});

watch(showChangelogDialog, (isOpen) => {
    if (isOpen) {
        markChangelogAsSeen();
    }
});
</script>

<template>
    <v-footer app class="footer-container px-4 py-2" color="#131213">
        <div class="d-flex justify-space-between align-center w-100">
            <div class="d-flex align-center gap-2">
                <v-btn icon="mdi-github" density="comfortable" variant="text" href="https://github.com/SomniForge"></v-btn>
                <v-btn icon="mdi-twitter" density="comfortable" variant="text" href="https://x.com/SomniForge"></v-btn>
                <v-divider vertical class="mx-2"></v-divider>
                <div class="text-caption">
                    <router-link style="text-decoration: none; color: inherit;" to="/terms">Terms</router-link>
                    |
                    <router-link style="text-decoration: none; color: inherit;" to="/privacy">Privacy</router-link>
                </div>
            </div>
            <div class="d-flex align-center">
                <v-btn
                    variant="text"
                    density="comfortable"
                    class="text-caption changelog-button"
                    @click="openChangelog"
                >
                    {{ version }} - Changelog
                    <v-chip
                        v-if="hasUnreadChangelog"
                        size="x-small"
                        color="primary"
                        variant="flat"
                        class="ml-2 changelog-indicator"
                    >
                        New
                    </v-chip>
                </v-btn>
                <v-divider vertical class="mx-2"></v-divider>
                <div class="text-caption">
                    {{ new Date().getFullYear() }} — <strong>SomniForge</strong>
                </div>
            </div>
        </div>

        <!-- Changelog Dialog -->
        <v-dialog v-model="showChangelogDialog" max-width="600">
            <v-card>
                <v-card-title class="text-h5 pa-4">
                    Changelog
                </v-card-title>
                <v-card-text class="pa-4">
                    <div v-for="release in changelog" :key="release.version" class="mb-6">
                        <div class="d-flex align-center mb-4">
                            <span class="text-h6">{{ release.version }}</span>
                            <v-chip class="ml-2" size="small" color="primary" variant="flat">{{ release.date }}</v-chip>
                        </div>
                        <div v-for="changeGroup in release.changes" :key="changeGroup.type" class="mb-4">
                            <div class="d-flex align-center mb-2">
                                <v-icon
                                    :icon="getChangeTypeIcon(changeGroup.type).icon"
                                    :color="getChangeTypeIcon(changeGroup.type).color"
                                    class="mr-2"
                                ></v-icon>
                                <span class="text-subtitle-2">{{ getChangeTypeIcon(changeGroup.type).label }}</span>
                            </div>
                            <v-list density="compact" class="change-list">
                                <v-list-item
                                    v-for="(change, index) in changeGroup.items"
                                    :key="index"
                                    :title="change"
                                    class="change-item"
                                >
                                    <template v-slot:prepend>
                                        <v-icon
                                            :icon="getChangeTypeIcon(changeGroup.type).icon"
                                            :color="getChangeTypeIcon(changeGroup.type).color"
                                            size="small"
                                        ></v-icon>
                                    </template>
                                </v-list-item>
                            </v-list>
                        </div>
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4">
                    <v-spacer></v-spacer>
                    <v-btn
                        color="primary"
                        variant="text"
                        @click="showChangelogDialog = false"
                    >
                        Close
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-footer>
</template>

<style scoped>
.footer-container {
    height: 48px !important;
}

/* Add hover effect for the changelog button */
.v-btn.text-caption {
    opacity: 0.8;
    transition: opacity 0.2s ease;
}

.v-btn.text-caption:hover {
    opacity: 1;
}

.changelog-button {
    overflow: visible;
}

.changelog-indicator {
    min-width: 0;
    letter-spacing: 0.02em;
}

/* Style changes for the changelog dialog */
:deep(.change-list) {
    background: transparent !important;
}

:deep(.change-item) {
    min-height: 40px !important;
}

:deep(.v-list-item-title) {
    white-space: normal !important;
    word-wrap: break-word !important;
    line-height: 1.4 !important;
}
</style>
