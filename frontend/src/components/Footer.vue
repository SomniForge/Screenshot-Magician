// src/components/Footer.vue
<script setup>

</script>

<template>
    <v-footer absolute app class="text-center d-flex flex-column ga-1 py-4" color="#131213">
        <div class="d-flex ga-4">
            <v-btn icon="mdi-github" key="mdi-github" density="comfortable" variant="text" href="https://github.com/SomniForge"></v-btn>
            <v-btn icon="mdi-twitter" key="mdi-twitter" density="comfortable" variant="text" href="https://x.com/SomniForge"></v-btn>
        </div>

        <v-divider class="my-2" thickness="1" width="150"></v-divider>

        <div class="text-caption font-weight-regular opacity-60">
            <router-link style="text-decoration: none; color: inherit;" to="/terms">Terms of Use</router-link>
            |
            <router-link style="text-decoration: none; color: inherit;" to="/privacy">Privacy Policy</router-link>
        </div>

        <v-divider></v-divider>

        <div>
        {{ new Date().getFullYear() }} — <strong>SomniForge</strong>
        </div>
    </v-footer>
</template>

<style>

</style>