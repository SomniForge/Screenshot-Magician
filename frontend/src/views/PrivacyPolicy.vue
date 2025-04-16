<script setup lang="ts">

// import MyComponent from '@/components/MyComponent.vue';
</script>

<template>
  <div style="border: 2px solid green;"> <!-- Main content div, holds everything that is NOT the sidebar or footer. -->
    <h2 id="mainHeader">Sebz.XYZ Privacy Policy</h2>

    <v-container> <!-- Container for main content BELOW footer -->
      <v-row no-gutters> <!-- Horizontal -->
        <v-col> <!-- Vertical -->
          <v-sheet class="pa-2 ma-2">
            .v-col-auto
          </v-sheet>
        </v-col> <!-- Vertical end-->
      </v-row> <!-- Horizontal end-->
    </v-container>

  </div>
</template>

<style scoped>
/* View Specific Styles */
h2 {
  color: #ffffff;
}

#mainHeader {
  text-align: center;
}

.v-container {
  background-color: #121313; /* Keeping background color the same in all main content */
}

.v-sheet {
  background-color: #121313; /* Keeping background color the same in all main content */
}

</style>