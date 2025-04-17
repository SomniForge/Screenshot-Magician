// src/components/Footer.vue
<script setup>
import { ref } from 'vue';

const showChangelogDialog = ref(false);
const version = 'v2.0.4-beta'; // Incremented version

const changelog = [
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

const getChangeTypeIcon = (type) => {
    switch (type) {
        case 'new': return { icon: 'mdi-plus-circle', color: 'success', label: 'New Features' };
        case 'improved': return { icon: 'mdi-arrow-up-circle', color: 'info', label: 'Improvements' };
        case 'fixed': return { icon: 'mdi-wrench', color: 'warning', label: 'Fixes' };
        case 'removed': return { icon: 'mdi-minus-circle', color: 'error', label: 'Removed' };
        case 'coming': return { icon: 'mdi-clock-outline', color: 'grey', label: 'Coming Soon' };
        default: return { icon: 'mdi-circle-small', color: 'primary', label: 'Changes' };
    }
};
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
                    class="text-caption"
                    @click="showChangelogDialog = true"
                >
                    {{ version }} - Changelog
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