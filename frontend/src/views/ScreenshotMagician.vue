<script setup lang="ts">

// import MyComponent from '@/components/MyComponent.vue';
import Magician from '@/components/Magician.vue';
</script>

<template>
  <div> <!-- Header Div-->
    <h2 id="mainHeader">Screenshot Magician</h2>
    <Magician />
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

.v-btn {
  margin-bottom: 20px;
}
</style>


