<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <v-app> <!-- Vuetify's main wrapper -->
    <v-main> <!-- Ensures content is styled correctly within Vuetify layout -->
      <RouterView /> <!-- Main Content -->
    </v-main>
  </v-app>
</template>

<style scoped>
/* APP-WIDE styles */
</style>