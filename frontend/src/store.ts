import { reactive } from 'vue';

export const globalState = reactive({
  isScrolledPastSearch: false,
  isSearchOpen: false,
  liquidGlass: false
});