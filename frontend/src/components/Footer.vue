// src/components/Footer.vue
<script setup>

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
            <div class="text-caption">
                {{ new Date().getFullYear() }} — <strong>SomniForge</strong>
            </div>
        </div>
    </v-footer>
</template>

<style scoped>
.footer-container {
    height: 48px !important;
}
</style>