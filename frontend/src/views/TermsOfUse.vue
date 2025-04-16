<script setup lang="ts">

// import MyComponent from '@/components/MyComponent.vue';
</script>

<template>
  <div class="terms-container">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
          <h1 class="text-h3 mb-6 text-center">Terms of Use</h1>
          <p class="text-subtitle-1 mb-6 text-center text-medium-emphasis">Last updated: April 2025</p>

          <v-card class="mb-6 pa-4" variant="outlined">
            <div class="text-body-1">
              <h2 class="text-h5 mb-4">1. Acceptance of Terms</h2>
              <p class="mb-4">
                By accessing and using Screenshot Magician, you accept and agree to be bound by these Terms of Use. 
                If you do not agree to these terms, please do not use our service.
              </p>

              <h2 class="text-h5 mb-4">2. Description of Service</h2>
              <p class="mb-4">
                Screenshot Magician is a web-based tool that allows users to edit and enhance screenshots with 
                features including chat overlay, censoring, and image manipulation. The service is provided 
                "as is" and "as available" without any warranties.
              </p>

              <h2 class="text-h5 mb-4">3. User Responsibilities</h2>
              <p class="mb-4">
                When using Screenshot Magician, you agree to:
              </p>
              <ul class="mb-4">
                <li>Use the service in compliance with all applicable laws and regulations</li>
                <li>Not attempt to circumvent, disable, or interfere with security features</li>
                <li>Not use the service for any illegal or unauthorized purpose</li>
                <li>Take responsibility for all content you process through the service</li>
              </ul>

              <h2 class="text-h5 mb-4">4. Intellectual Property</h2>
              <p class="mb-4">
                Screenshot Magician is open-source software released under the MIT License. This means:
              </p>
              <ul class="mb-4">
                <li>You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software</li>
                <li>All copies or substantial portions of the software must include the above copyright notice and permission notice</li>
                <li>The software is provided "as is", without warranty of any kind</li>
              </ul>
              <p class="mb-4">
                While Screenshot Magician's source code is open-source, its branding elements and trademarks are owned by SomniForge 
                and are protected by applicable trademark laws.
              </p>

              <h2 class="text-h5 mb-4">5. MIT License</h2>
              <p class="mb-4 license-text">
                Copyright (c) 2025 SomniForge<br><br>
                Permission is hereby granted, free of charge, to any person obtaining a copy
                of this software and associated documentation files (the "Software"), to deal
                in the Software without restriction, including without limitation the rights
                to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                copies of the Software, and to permit persons to whom the Software is
                furnished to do so, subject to the following conditions:<br><br>
                The above copyright notice and this permission notice shall be included in all
                copies or substantial portions of the Software.<br><br>
                THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
                SOFTWARE.
              </p>

              <h2 class="text-h5 mb-4">6. User Content</h2>
              <p class="mb-4">
                You retain all rights to any content you process through our service. We do not store or collect 
                any images, chat logs, or other content you process. All processing occurs locally in your browser.
              </p>

              <h2 class="text-h5 mb-4">7. Limitations of Liability</h2>
              <p class="mb-4">
                In no event shall Screenshot Magician, SomniForge, or its operators be liable for any damages 
                arising out of the use or inability to use the service. This includes but is not limited to:
              </p>
              <ul class="mb-4">
                <li>Loss of data</li>
                <li>Business interruption</li>
                <li>Personal injury</li>
                <li>Any other damages</li>
              </ul>

              <h2 class="text-h5 mb-4">8. Modifications to Service</h2>
              <p class="mb-4">
                We reserve the right to modify or discontinue, temporarily or permanently, the service with or 
                without notice. We shall not be liable to you or any third party for any modification, suspension, 
                or discontinuance of the service.
              </p>

              <h2 class="text-h5 mb-4">9. Changes to Terms</h2>
              <p class="mb-4">
                We reserve the right to update or modify these Terms of Use at any time without prior notice. 
                Your continued use of the service following any changes constitutes acceptance of those changes.
              </p>

              <h2 class="text-h5 mb-4">10. Contact Information</h2>
              <p class="mb-4">
                If you have any questions about these Terms of Use, please contact us:
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
.terms-container {
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

.license-text {
  font-family: monospace;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 16px;
  border-radius: 4px;
  white-space: pre-line;
}
</style>