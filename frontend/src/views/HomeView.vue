<script setup lang="ts">
const features = [
  {
    icon: 'mdi-clock-fast',
    title: 'Save Hours',
    description: 'What takes minutes in Photoshop takes 30 seconds here. No more complex layers or tools.'
  },
  {
    icon: 'mdi-message-text',
    title: 'Instant Chat Styling',
    description: 'Automatic GTA World chat color detection and formatting. No more manual color picking.'
  },
  {
    icon: 'mdi-gesture',
    title: 'One-Click Actions',
    description: 'Censoring, positioning, and scaling with simple clicks and drags. No more masking or complex tools.'
  },
  {
    icon: 'mdi-export',
    title: 'Quick Export',
    description: 'Export perfect screenshots in seconds. No more saving multiple files or format conversions.'
  }
];

const timeComparison = [
  {
    action: 'Import & Position',
    photoshop: '3-5 min',
    magician: '10 sec'
  },
  {
    action: 'Format Chat',
    photoshop: '5-10 min',
    magician: '5 sec'
  },
  {
    action: 'Censor Content',
    photoshop: '2-3 min',
    magician: '5 sec'
  },
  {
    action: 'Export',
    photoshop: '1-2 min',
    magician: '2 sec'
  }
];
</script>

<template>
  <div class="home-container">
    <!-- Hero Section -->
    <section class="hero-section">
      <v-container class="py-16">
        <v-row align="center" justify="center">
          <v-col cols="12" md="8" class="text-center">
            <h1 class="text-h2 font-weight-bold mb-6">
              Screenshot
              <span class="gradient-text">Magician</span>
            </h1>
            <p class="text-h6 text-medium-emphasis mb-4">
              Transform your screenshots into perfect compositions with our powerful editing suite.
              Designed specifically for GTA World.
            </p>
            <p class="text-h5 gradient-text mb-8">
              Replace Photoshop. Save Time. Get Better Results.
            </p>
            <div>
              <router-link to="/ssmag" style="text-decoration: none;">
                <v-btn
                  size="x-large"
                  color="primary"
                  class="px-8 text-uppercase"
                >
                  Get Started
                  <v-icon end icon="mdi-arrow-right" class="ml-2"></v-icon>
                </v-btn>
              </router-link>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <v-container class="py-16">
        <v-row>
          <v-col cols="12" class="text-center mb-12">
            <h2 class="text-h4 font-weight-bold mb-3">Why Switch?</h2>
            <p class="text-medium-emphasis">Everything you need, nothing you don't</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col 
            v-for="feature in features" 
            :key="feature.title" 
            cols="12" 
            sm="6" 
            md="3"
          >
            <v-hover v-slot="{ isHovering, props }">
              <v-card
                v-bind="props"
                :elevation="isHovering ? 8 : 2"
                :class="['feature-card', { 'on-hover': isHovering }]"
                height="220"
              >
                <v-card-item>
                  <v-icon
                    :icon="feature.icon"
                    size="48"
                    class="mb-4 gradient-icon"
                  ></v-icon>
                  <v-card-title class="text-h6 mb-2">{{ feature.title }}</v-card-title>
                  <v-card-text class="text-medium-emphasis">
                    {{ feature.description }}
                  </v-card-text>
                </v-card-item>
              </v-card>
            </v-hover>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Time Comparison Section -->
    <section class="comparison-section">
      <v-container class="py-16">
        <v-row>
          <v-col cols="12" class="text-center mb-12">
            <h2 class="text-h4 font-weight-bold mb-3">Time Saved</h2>
            <p class="text-medium-emphasis">Complete your edits in seconds, not minutes</p>
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-col cols="12" md="8">
            <v-table class="comparison-table">
              <thead>
                <tr>
                  <th class="text-left">Action</th>
                  <th class="text-center">Photoshop</th>
                  <th class="text-center">Screenshot Magician</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in timeComparison" :key="item.action">
                  <td>{{ item.action }}</td>
                  <td class="text-center photoshop-time">{{ item.photoshop }}</td>
                  <td class="text-center magician-time">{{ item.magician }}</td>
                </tr>
                <tr class="total-row">
                  <td class="text-left font-weight-bold">Total Time</td>
                  <td class="text-center photoshop-time">11-20 min</td>
                  <td class="text-center magician-time">22 sec</td>
                </tr>
              </tbody>
            </v-table>
          </v-col>
        </v-row>
      </v-container>
    </section>
  </div>
</template>

<style scoped>
.home-container {
  --home-bg: #121313;
  --home-surface: #1e1e1e;
  --home-text: #f5f7fa;
  --home-muted: rgba(245, 247, 250, 0.72);
  --home-border: rgba(255, 255, 255, 0.08);
  --home-border-strong: rgba(255, 255, 255, 0.14);
  --home-accent-a: #42a5f5;
  --home-accent-b: #ab47bc;
  background-color: #121313;
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
  color: var(--home-text);
}

.hero-section {
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle at center,
    rgba(66, 66, 66, 0.1) 0%,
    rgba(18, 19, 19, 0) 50%
  );
  animation: rotate 30s linear infinite;
}

.gradient-text {
  background: linear-gradient(45deg, var(--home-accent-a), var(--home-accent-b));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: inline-block;
}

.gradient-icon {
  background: linear-gradient(45deg, var(--home-accent-a), var(--home-accent-b));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.feature-card {
  transition: all 0.3s ease;
  background-color: var(--home-surface);
  border: 1px solid var(--home-border);
  color: var(--home-text) !important;
}

.feature-card.on-hover {
  transform: translateY(-5px);
  border-color: var(--home-border-strong);
}

.comparison-table {
  background-color: var(--home-surface) !important;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  color: var(--home-text) !important;
}

.photoshop-time {
  color: #ff5252 !important;
}

.magician-time {
  color: #4caf50 !important;
}

.total-row {
  border-top: 2px solid var(--home-border-strong);
}

.total-row td {
  padding-top: 16px !important;
}

.home-container :deep(.text-medium-emphasis) {
  color: var(--home-muted) !important;
}

.home-container :deep(.v-card-title),
.home-container :deep(.v-card-text),
.home-container :deep(.v-table),
.home-container :deep(.v-table th),
.home-container :deep(.v-table td) {
  color: var(--home-text) !important;
}

.home-container :deep(.v-table thead th) {
  font-weight: 700;
}

.home-container :deep(.v-table tbody tr:not(:last-child) td) {
  border-bottom-color: var(--home-border) !important;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .text-h2 {
    font-size: 2.5rem !important;
  }
  
  .text-h6 {
    font-size: 1rem !important;
  }
}
</style>
