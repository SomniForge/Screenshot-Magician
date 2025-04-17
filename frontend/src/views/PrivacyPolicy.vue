<script setup lang="ts">

// import MyComponent from '@/components/MyComponent.vue';
</script>

<template>
  <div class="policy-container">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
          <h1 class="text-h3 mb-6 text-center">Privacy Policy</h1>
          <p class="text-subtitle-1 mb-6 text-center text-medium-emphasis">Last updated: April 17, 2025</p>

          <v-card class="mb-6 pa-4" variant="outlined">
            <div class="text-body-1">
              <h2 class="text-h5 mb-4">1. Introduction</h2>
              <p class="mb-4">
                At Screenshot Magician, we take your privacy seriously. This Privacy Policy explains how we collect, use, 
                and protect your information when you use our service. Screenshot Magician is open-source software 
                released under the MIT License, and our commitment to privacy is reflected in our source code which 
                is publicly available for review.
              </p>

              <h2 class="text-h5 mb-4">2. Information We Don't Collect (Directly)</h2>
              <p class="mb-4">
                Screenshot Magician itself is designed with privacy in mind. We do not directly:
              </p>
              <ul class="mb-4">
                <li>Store your images or chat logs</li>
                <li>Collect personal information beyond what's described in the Analytics section</li>
                <li>Share any data collected directly by the application with third parties, other than as described for analytics purposes</li>
              </ul>
              <p class="mb-4">
                Please see the "Analytics" section below for details on data collected by third-party services.
              </p>

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

              <h2 class="text-h5 mb-4">5. Analytics</h2>
              <p class="mb-4">
                To understand how our service is used and to improve user experience, we utilize Google Analytics. Google Analytics collects information such as:
              </p>
              <ul class="mb-4">
                <li>How often users visit the site</li>
                <li>What pages users visit when they do so</li>
                <li>What other sites they used prior to coming to our site</li>
                <li>Approximate geographical location</li>
                <li>Browser and device information</li>
              </ul>
              <p class="mb-4">
                Google Analytics collects only the IP address assigned to you on the date you visit this site, rather than your name or other identifying information. We do not combine the information collected through the use of Google Analytics with personally identifiable information. Although Google Analytics plants a permanent cookie on your web browser to identify you as a unique user the next time you visit this site, the cookie cannot be used by anyone but Google. Google’s ability to use and share information collected by Google Analytics about your visits to this site is restricted by the <a href="https://marketingplatform.google.com/about/analytics/terms/us/" target="_blank" rel="noopener">Google Analytics Terms of Use</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>. You can prevent Google Analytics from recognizing you on return visits to this site by disabling cookies on your browser or by installing the <a href="https://tools.google.com/dlpage/gaoptout/" target="_blank" rel="noopener">Google Analytics Opt-out Browser Add-on</a>.
              </p>

              <h2 class="text-h5 mb-4">6. Third-Party Services</h2>
              <p class="mb-4">
                Other than Google Analytics as described above, our website may contain links to third-party websites or services. We are not responsible for 
                the privacy practices or content of these external sites.
              </p>

              <h2 class="text-h5 mb-4">7. Children's Privacy</h2>
              <p class="mb-4">
                Our service is not directed to children under 13. We do not knowingly collect or store any 
                personal information from children under 13.
              </p>

              <h2 class="text-h5 mb-4">8. Changes to This Policy</h2>
              <p class="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>

              <h2 class="text-h5 mb-4">9. Contact Us</h2>
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