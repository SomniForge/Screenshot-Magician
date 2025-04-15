// src/App.vue

<script setup lang="ts">
import { RouterView } from 'vue-router'
import SideBar from '@/components/SideBar.vue';
import Footer from '@/components/Footer.vue';
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