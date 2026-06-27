import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import "./styles.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import App from "./App.vue";
import { router } from "./router";

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "hokanTheme",
    themes: {
      hokanTheme: {
        dark: false,
        colors: {
          primary: "#166b64",
          secondary: "#2d7d46",
          surface: "#ffffff",
          background: "#f5faf8",
          warning: "#b76b00",
          error: "#b42318"
        }
      }
    }
  },
  defaults: {
    VBtn: {
      rounded: "sm",
      size: "large"
    },
    VTextField: {
      variant: "outlined",
      density: "comfortable"
    },
    VSelect: {
      variant: "outlined",
      density: "comfortable"
    }
  }
});

createApp(App).use(createPinia()).use(router).use(vuetify).mount("#app");
