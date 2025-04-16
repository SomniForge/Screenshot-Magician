<script setup lang="ts">

// import MyComponent from '@/components/MyComponent.vue';
</script>

<template>
  <div class="policy-container">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
          <h1 class="text-h3 mb-6 text-center">Privacy Policy</h1>
          <p class="text-subtitle-1 mb-6 text-center text-medium-emphasis">Last updated: April 2025</p>

          <v-card class="mb-6 pa-4" variant="outlined">
            <div class="text-body-1">
              <h2 class="text-h5 mb-4">1. Introduction</h2>
              <p class="mb-4">
                At Screenshot Magician, we take your privacy seriously. This Privacy Policy explains how we collect, use, 
                and protect your information when you use our service. Screenshot Magician is open-source software 
                released under the MIT License, and our commitment to privacy is reflected in our source code which 
                is publicly available for review.
              </p>

              <h2 class="text-h5 mb-4">2. Information We Don't Collect</h2>
              <p class="mb-4">
                Screenshot Magician is designed with privacy in mind. We do not:
              </p>
              <ul class="mb-4">
                <li>Store your images or chat logs</li>
                <li>Track your usage patterns</li>
                <li>Collect personal information</li>
                <li>Use cookies for tracking purposes</li>
                <li>Share any data with third parties</li>
              </ul>

              <h2 class="text-h5 mb-4">3. Local Storage</h2>
              <p class="mb-4">
                We use local storage only to:
              </p>
              <ul class="mb-4">
                <li>Save your character name preference</li>
                <li>Remember your last editor state</li>
                <li>Store your canvas dimensions</li>
              </ul>
              <p class="mb-4">
                This data never leaves your device and is stored only in your browser.
              </p>

              <h2 class="text-h5 mb-4">4. Image Processing</h2>
              <p class="mb-4">
                All image processing occurs locally in your browser. Your images and chat logs are never uploaded 
                to any server and remain entirely on your device.
              </p>

              <h2 class="text-h5 mb-4">5. Third-Party Services</h2>
              <p class="mb-4">
                Our website may contain links to third-party websites or services. We are not responsible for 
                the privacy practices or content of these external sites.
              </p>

              <h2 class="text-h5 mb-4">6. Children's Privacy</h2>
              <p class="mb-4">
                Our service is not directed to children under 13. We do not knowingly collect or store any 
                personal information from children under 13.
              </p>

              <h2 class="text-h5 mb-4">7. Changes to This Policy</h2>
              <p class="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>

              <h2 class="text-h5 mb-4">8. Contact Us</h2>
              <p class="mb-4">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <ul>
                <li>Via GitHub: <a href="https://github.com/SomniForge" target="_blank" rel="noopener">@SomniForge</a></li>
                <li>Via Twitter: <a href="https://twitter.com/SomniForge" target="_blank" rel="noopener">@SomniForge</a></li>
              </ul>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.policy-container {
  padding: 32px 16px;
  min-height: 100%;
  background-color: #121313;
  overflow-y: auto;
  height: 100%;
  position: relative;
}

.v-container {
  max-width: 1200px;
  margin: 0 auto;
}

h1, h2 {
  color: #ffffff;
}

a {
  color: #42a5f5;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

ul {
  padding-left: 24px;
  margin-bottom: 16px;
}

li {
  margin-bottom: 8px;
}

.v-card {
  background-color: #1E1E1E !important;
  color: #E0E0E0 !important;
}
</style>