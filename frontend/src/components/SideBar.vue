// src/components/SideBar.vue

<script setup>
import { ref } from 'vue';

// Reactive variable to control the rail state
// Start with the drawer collapsed (in rail mode)
const isRail = ref(true);
</script>

<template>
  <v-navigation-drawer
    :rail="isRail"  
    permanent         
    @mouseenter="isRail = false" 
    @mouseleave="isRail = true"  
    >
    <!-- Removed expand-on-hover and will now control :rail directly -->
    <!-- Keep permanent so v-main always respects its space -->

    <v-list density="compact" nav>
      <router-link style="text-decoration: none; color: inherit;" to="/"><v-list-item prepend-icon="mdi-home" title="Home" value="home"></v-list-item></router-link>
      <v-divider></v-divider>
      <router-link style="text-decoration: none; color: inherit;" to="/ssmag"><v-list-item prepend-icon="mdi-camera-iris" title="Screenshot Magician" value="ssmag"></v-list-item></router-link>
      <v-list-item prepend-icon="mdi-information-outline" title="Starred" value="starred"></v-list-item>
      <v-list-item prepend-icon="mdi-github" title="Source Code" value="github"></v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<style scoped>
/* Styles now only apply to the drawer itself */

.v-navigation-drawer {
  transition: width 0.1s ease-in-out !important; /* Smooth the width change */
}

.v-list-item {
  color:aliceblue;
}
</style>