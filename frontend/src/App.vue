// src/App.vue

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { RouterView } from 'vue-router'
import SideBar from '@/components/SideBar.vue';
import Footer from '@/components/Footer.vue';
import { useUnsavedNavigationStore } from '@/stores/unsavedNavigation';

const unsavedNavigationStore = useUnsavedNavigationStore();

const shouldIgnoreAnchorClick = (event: MouseEvent, anchor: HTMLAnchorElement) => {
  if (event.defaultPrevented) return true;
  if (event.button !== 0) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  if (anchor.target && anchor.target.toLowerCase() !== '_self') return true;

  const href = anchor.getAttribute('href');
  return !href || href.startsWith('#');
};

const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (shouldIgnoreAnchorClick(event, anchor)) return;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin === window.location.origin) return;
  if (destination.href === window.location.href) return;

  if (!unsavedNavigationStore.confirmNavigation()) {
    event.preventDefault();
  }
};

onMounted(() => {
  document.addEventListener('click', handleDocumentClick, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick, true);
});
</script>

<template>
  <v-app>
    <SideBar />
    
    <v-main>
      <RouterView />
    </v-main>

    <Footer />
  </v-app>
</template>

<style>
.v-application {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.v-main {
  height: calc(100vh - 48px);
}

.v-main > .v-container {
  height: 100%;
  padding: 0;
}

.v-footer {
  height: 48px !important;
}
</style>
