// src/App.vue

<script setup lang="ts">
import { RouterView } from 'vue-router'
import SideBar from '@/components/SideBar.vue';
</script>

<template>
  <v-app> <!-- Vuetify's main wrapper -->
    
    <SideBar /> <!-- Sidebar component directly inside v-app -->

    <v-main> <!-- v-main will automatically position itself next to the drawer sidebar component -->
      <v-container fluid> <!-- Container for content padding/layout -->
        <RouterView /> <!-- Main Content goes inside v-main -->
      </v-container>
    </v-main>

  </v-app>
</template>

<style scoped>
/* APP-WIDE styles */

</style>